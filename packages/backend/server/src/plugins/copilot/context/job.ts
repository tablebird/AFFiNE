import { Injectable, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Prisma, PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

import {
  AFFiNELogger,
  Cache,
  CallMetric,
  Config,
  metrics,
} from '../../../base';
import { DocContentService } from '../../../core/doc-renderer';
import { OpenAIEmbeddingClient } from './embedding';
import { EmbeddingClient } from './types';

const EMBEDDING_QUEUE_CACHE_KEY = 'context:queue';
const EMBEDDING_QUEUE_POLL_INTERVAL = 1000 * 1; // 1 second

@Injectable()
export class CopilotContextDocJob {
  private busy = false;
  private readonly client: EmbeddingClient | undefined;

  constructor(
    config: Config,
    private readonly cache: Cache,
    private readonly db: PrismaClient,
    private readonly doc: DocContentService,
    private readonly logger: AFFiNELogger,
    @Optional() private readonly registry?: SchedulerRegistry
  ) {
    this.logger.setContext(CopilotContextDocJob.name);
    const configure = config.plugins.copilot.openai;
    if (configure) {
      this.client = new OpenAIEmbeddingClient(new OpenAI(configure));
    }
  }

  // public this client to allow overriding in tests
  get embeddingClient() {
    return this.client as EmbeddingClient;
  }

  onModuleInit() {
    if (this.registry) {
      this.registry.addInterval(
        this.autoEmbedPendingDocs.name,
        // scheduler registry will clean up the interval when the app is stopped
        setInterval(() => {
          if (this.busy) {
            return;
          }
          this.busy = true;
          this.autoEmbedPendingDocs()
            .catch(() => {
              /* never fail */
            })
            .finally(() => {
              this.busy = false;
            });
        }, EMBEDDING_QUEUE_POLL_INTERVAL)
      );

      this.logger.log('Updates pending queue auto merging cron started');
    }
  }

  @OnEvent('workspace.doc.embedding')
  async addQueue({ workspaceId, docId }: Events['workspace.doc.embedding']) {
    return await this.cache.mapIncrease(
      EMBEDDING_QUEUE_CACHE_KEY,
      `${workspaceId}::${docId}`
    );
  }

  private async randomDoc() {
    const key = await this.cache.mapRandomKey(EMBEDDING_QUEUE_CACHE_KEY);
    if (key) {
      const calledCount = await this.cache.mapIncrease(
        EMBEDDING_QUEUE_CACHE_KEY,
        key,
        0
      );

      if (calledCount > 0) {
        const [workspaceId, id] = key.split('::');
        const count = await this.db.snapshot.count({
          where: {
            workspaceId,
            id,
          },
        });
        if (count > 0) {
          // only embedding the doc if exists
          return { workspaceId, docId: id };
        }
      }
    }
    return null;
  }

  @CallMetric('doc', 'auto_embed_pending_docs')
  async autoEmbedPendingDocs() {
    let randomDoc: { workspaceId: string; docId: string } | null = null;
    try {
      randomDoc = await this.randomDoc();
      if (!randomDoc) return;

      const { workspaceId, docId } = randomDoc;
      const content = await this.doc.getPageContent(workspaceId, docId);
      if (content) {
        const embeddings = await this.embeddingClient.getFileEmbeddings(
          new File([content.summary], `${content.title}.md`)
        );
        if (embeddings) {
          const groups = embeddings.map(e => [
            workspaceId,
            docId,
            e.index,
            e.content,
            Prisma.raw(`'[${e.embedding.join(',')}]'`),
            new Date(),
          ]);
          const values = Prisma.join(
            groups.map(row => Prisma.sql`(${Prisma.join(row)})`)
          );
          await this.db.$executeRaw`
            INSERT INTO "ai_workspace_embeddings"
            ("workspace_id", "doc_id", "chunk", "content", "embedding", "updated_at") VALUES ${values}
            ON CONFLICT (context_id, file_id, chunk) DO UPDATE SET
            embedding = EXCLUDED.embedding, updated_at = excluded.updated_at;
          `;
        }
      }
    } catch (e) {
      metrics.doc.counter('auto_embed_pending_docs_error').add(1);
      this.logger.error('Failed to embed pending doc', randomDoc || '', e);
    }
  }
}
