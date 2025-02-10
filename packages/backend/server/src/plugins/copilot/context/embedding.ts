import OpenAI from 'openai';

import { Embedding, EmbeddingClient } from './types';

export class OpenAIEmbeddingClient extends EmbeddingClient {
  constructor(private readonly client: OpenAI) {
    super();
  }

  private cleanInput(input: string[]): string[] {
    return input.map(i =>
      i
        // Remove unnecessary newlines and extra spaces
        .replace(/\n+/g, ' ') // Merge multiple newlines into a single space
        .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
        // Remove "Figure X" and "Table X" style labels
        .replace(/(Figure|Table)\s+\d+\./g, '')
        // Remove null characters
        .replaceAll('\x00', '')
        // Remove trailing spaces
        .trim()
    );
  }

  async getEmbeddings(
    input: string[],
    signal?: AbortSignal
  ): Promise<Embedding[]> {
    const clearedInput = this.cleanInput(input);
    const resp = await this.client.embeddings.create(
      {
        input: clearedInput,
        model: 'text-embedding-3-small',
        dimensions: 512,
        encoding_format: 'float',
      },
      { signal }
    );
    return resp.data.map(e => ({ ...e, content: clearedInput[e.index] }));
  }
}

export class MockEmbeddingClient extends EmbeddingClient {
  async getEmbeddings(input: string[]): Promise<Embedding[]> {
    return input.map((_, i) => ({
      index: i,
      content: input[i],
      embedding: Array.from({ length: 512 }, () => Math.random()),
    }));
  }
}
