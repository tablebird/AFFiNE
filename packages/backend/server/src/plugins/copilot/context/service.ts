import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { CopilotInvalidContext, CopilotSessionNotFound } from '../../../base';
import { ContextSession } from './session';
import { ContextConfig, ContextConfigSchema } from './types';

@Injectable()
export class CopilotContextService {
  private readonly sessionCache = new Map<string, ContextSession>();

  constructor(private readonly db: PrismaClient) {}

  private cacheSession(
    contextId: string,
    config: ContextConfig
  ): ContextSession {
    const context = new ContextSession(contextId, config, this.db);
    this.sessionCache.set(contextId, context);
    return context;
  }

  async create(sessionId: string): Promise<ContextSession> {
    const session = await this.db.aiSession.findFirst({
      where: { id: sessionId },
      select: { workspaceId: true },
    });
    if (!session) {
      throw new CopilotSessionNotFound();
    }

    // keep the context unique per session
    const existsContext = await this.getBySessionId(sessionId);
    if (existsContext) return existsContext;

    const context = await this.db.aiContext.create({
      data: {
        sessionId,
        config: { workspaceId: session.workspaceId, docs: [], files: [] },
      },
    });

    const config = ContextConfigSchema.parse(context.config);
    return this.cacheSession(context.id, config);
  }

  async get(id: string): Promise<ContextSession> {
    const context = this.sessionCache.get(id);
    if (context) return context;
    const ret = await this.db.aiContext.findUnique({
      where: { id },
      select: { config: true },
    });
    if (ret) {
      const config = ContextConfigSchema.safeParse(ret.config);
      if (config.success) return this.cacheSession(id, config.data);
    }
    throw new CopilotInvalidContext({ contextId: id });
  }

  async getBySessionId(sessionId: string): Promise<ContextSession | null> {
    const existsContext = await this.db.aiContext.findFirst({
      where: { sessionId },
      select: { id: true },
    });
    if (existsContext) return this.get(existsContext.id);
    return null;
  }
}
