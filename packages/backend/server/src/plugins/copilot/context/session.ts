import { File } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';

import { Prisma, PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';

import { BlobQuotaExceeded, OneMB, PrismaTransaction } from '../../../base';
import {
  ChunkSimilarity,
  ContextConfig,
  ContextDoc,
  ContextFile,
  ContextFileStatus,
  ContextList,
  DocChunkSimilarity,
  Embedding,
  EmbeddingClient,
  FileChunkSimilarity,
} from './types';

export class ContextSession implements AsyncDisposable {
  constructor(
    private readonly client: EmbeddingClient,
    private readonly contextId: string,
    private readonly config: ContextConfig,
    private readonly db: PrismaClient,
    private readonly dispatcher?: (
      config: ContextConfig,
      tx?: PrismaTransaction
    ) => Promise<void>
  ) {}

  get id() {
    return this.contextId;
  }

  get workspaceId() {
    return this.config.workspaceId;
  }

  listDocs(): ContextDoc[] {
    return [...this.config.docs];
  }

  listFiles() {
    return this.config.files.map(f => ({ ...f }));
  }

  get sortedList(): ContextList {
    const { docs, files } = this.config;
    return [...docs, ...files].toSorted(
      (a, b) => a.createdAt - b.createdAt
    ) as ContextList;
  }

  private readStream(
    readable: Readable,
    maxSize = 50 * OneMB
  ): Promise<Buffer<ArrayBuffer>> {
    return new Promise<Buffer<ArrayBuffer>>((resolve, reject) => {
      const chunks: Uint8Array[] = [];
      let totalSize = 0;

      readable.on('data', chunk => {
        totalSize += chunk.length;
        if (totalSize > maxSize) {
          reject(new BlobQuotaExceeded());
          readable.destroy(new BlobQuotaExceeded());
          return;
        }
        chunks.push(chunk);
      });

      readable.on('end', () => {
        resolve(Buffer.concat(chunks, totalSize));
      });

      readable.on('error', err => {
        reject(err);
      });
    });
  }

  async addDocRecord(docId: string): Promise<ContextList> {
    if (!this.config.docs.some(f => f.id === docId)) {
      this.config.docs.push({ id: docId, createdAt: Date.now() });
      await this.save();
    }
    return this.sortedList;
  }

  async removeDocRecord(docId: string): Promise<boolean> {
    const index = this.config.docs.findIndex(f => f.id === docId);
    if (index >= 0) {
      this.config.docs.splice(index, 1);
      await this.save();
      return true;
    }
    return false;
  }

  async addStream(
    readable: Readable,
    name: string,
    blobId: string,
    signal?: AbortSignal
  ): Promise<ContextList | undefined> {
    if (signal?.aborted) return;
    const buffer = await this.readStream(readable, 50 * OneMB);
    const file = new File([buffer], name);
    return await this.addFile(file, blobId, signal);
  }

  async addFile(
    file: File,
    blobId: string,
    signal?: AbortSignal
  ): Promise<ContextList | undefined> {
    const embeddings = await this.client.getFileEmbeddings(file, signal);
    if (embeddings && !signal?.aborted) {
      await this.insertEmbeddings(file.name, blobId, embeddings);
      return this.sortedList;
    }
    return undefined;
  }

  async removeFile(fileId: string): Promise<boolean> {
    return await this.db.$transaction(async tx => {
      const ret = await tx.aiContextEmbedding.deleteMany({
        where: { contextId: this.contextId, fileId },
      });
      this.config.files = this.config.files.filter(f => f.id !== fileId);
      await this.save(tx);
      return ret.count > 0;
    });
  }

  async matchFileChunks(
    content: string,
    topK: number = 5,
    signal?: AbortSignal
  ): Promise<FileChunkSimilarity[]> {
    const embedding = await this.client
      .getEmbeddings([content], signal)
      .then(r => r?.[0]?.embedding);
    if (!embedding) return [];
    return await this.db.$queryRaw<Array<FileChunkSimilarity>>`
      SELECT "file_id" as "fileId", "chunk", "content", "embedding" <=> ${embedding}::vector as "distance" 
      FROM "ai_context_embeddings"
      ORDER BY "distance" ASC
      LIMIT ${topK};
    `;
  }

  async matchWorkspaceChunks(
    content: string,
    topK: number = 5,
    signal?: AbortSignal
  ): Promise<ChunkSimilarity[]> {
    const embedding = await this.client
      .getEmbeddings([content], signal)
      .then(r => r?.[0]?.embedding);
    if (!embedding) return [];
    return await this.db.$queryRaw<Array<DocChunkSimilarity>>`
      SELECT "doc_id" as "docId", "chunk", "content", "embedding" <=> ${embedding}::vector as "distance" 
      FROM "ai_workspace_embeddings"
      WHERE "workspace_id" = ${this.workspaceId}
      ORDER BY "distance" ASC
      LIMIT ${topK};
    `;
  }

  private processEmbeddings(fileId: string, embeddings: Embedding[]) {
    const groups = embeddings.map(e => [
      randomUUID(),
      this.contextId,
      fileId,
      e.index,
      e.content,
      Prisma.raw(`'[${e.embedding.join(',')}]'`),
      new Date(),
    ]);
    return Prisma.join(groups.map(row => Prisma.sql`(${Prisma.join(row)})`));
  }

  private async insertEmbeddings(
    name: string,
    blobId: string,
    embeddings: Embedding[]
  ) {
    const fileId = nanoid();
    await this.saveFileRecord(fileId, file => ({
      ...file,
      blobId,
      chunk_size: embeddings.length,
      name,
      createdAt: Date.now(),
    }));

    const values = this.processEmbeddings(fileId, embeddings);
    return this.db.$transaction(async tx => {
      await tx.$executeRaw`
        INSERT INTO "ai_context_embeddings"
        ("id", "context_id", "file_id", "chunk", "content", "embedding", "updated_at") VALUES ${values}
        ON CONFLICT (context_id, file_id, chunk) DO UPDATE SET
        content = EXCLUDED.content, embedding = EXCLUDED.embedding, updated_at = excluded.updated_at;
      `;
      await this.saveFileRecord(
        fileId,
        file => ({
          ...(file as ContextFile),
          status: ContextFileStatus.finished,
        }),
        tx
      );
      return fileId;
    });
  }

  private async saveFileRecord(
    fileId: string,
    cb: (
      record: Pick<ContextFile, 'id' | 'status'> &
        Partial<Omit<ContextFile, 'id' | 'status'>>
    ) => ContextFile,
    tx?: PrismaTransaction
  ) {
    const files = this.config.files;
    const file = files.find(f => f.id === fileId);
    if (file) {
      Object.assign(file, cb({ ...file }));
    } else {
      const file = { id: fileId, status: ContextFileStatus.processing };
      files.push(cb(file));
    }
    await this.save(tx);
  }

  async save(tx?: PrismaTransaction) {
    await this.dispatcher?.(this.config, tx);
  }

  async [Symbol.asyncDispose]() {
    await this.save();
  }
}
