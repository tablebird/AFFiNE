import {
  Args,
  Context,
  Field,
  Float,
  ID,
  InputType,
  Mutation,
  ObjectType,
  Parent,
  Query,
  registerEnumType,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { PrismaClient } from '@prisma/client';
import type { Request } from 'express';
import { SafeIntResolver } from 'graphql-scalars';
import GraphQLUpload from 'graphql-upload/GraphQLUpload.mjs';

import {
  CallMetric,
  CopilotFailedToMatchContext,
  CopilotFailedToModifyContext,
  CopilotSessionNotFound,
  EventBus,
  type FileUpload,
  RequestMutex,
  Throttle,
  TooManyRequest,
} from '../../../base';
import { CurrentUser } from '../../../core/auth';
import { PermissionService } from '../../../core/permission';
import { COPILOT_LOCKER, CopilotType } from '../resolver';
import { ChatSessionService } from '../session';
import { CopilotContextService } from './service';
import {
  ContextDoc,
  type ContextFile,
  ContextFileStatus,
  DocChunkSimilarity,
  FileChunkSimilarity,
} from './types';

@InputType()
class AddContextDocInput {
  @Field(() => String)
  contextId!: string;

  @Field(() => String)
  docId!: string;
}

@InputType()
class AddContextFileInput {
  @Field(() => String)
  contextId!: string;

  @Field(() => String)
  fileName!: string;

  @Field(() => String)
  blobId!: string;
}

@InputType()
class RemoveContextFileInput {
  @Field(() => String)
  contextId!: string;

  @Field(() => String)
  fileId!: string;
}

@ObjectType('CopilotContext')
export class CopilotContextType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  workspaceId!: string;
}

registerEnumType(ContextFileStatus, { name: 'ContextFileStatus' });

@ObjectType()
class CopilotContextDoc implements ContextDoc {
  @Field(() => ID)
  id!: string;

  @Field(() => SafeIntResolver)
  createdAt!: number;
}

@ObjectType()
class CopilotContextFile implements ContextFile {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => SafeIntResolver)
  chunkSize!: number;

  @Field(() => ContextFileStatus)
  status!: ContextFileStatus;

  @Field(() => String)
  blobId!: string;

  @Field(() => SafeIntResolver)
  createdAt!: number;
}

@ObjectType()
class CopilotContextListItem {
  @Field(() => ID)
  id!: string;

  @Field(() => SafeIntResolver)
  createdAt!: number;

  @Field(() => String, { nullable: true })
  name!: string;

  @Field(() => SafeIntResolver, { nullable: true })
  chunkSize!: number;

  @Field(() => ContextFileStatus, { nullable: true })
  status!: ContextFileStatus;

  @Field(() => String, { nullable: true })
  blobId!: string;
}

@ObjectType()
class ContextMatchedFileChunk implements FileChunkSimilarity {
  @Field(() => String)
  fileId!: string;

  @Field(() => SafeIntResolver)
  chunk!: number;

  @Field(() => String)
  content!: string;

  @Field(() => Float, { nullable: true })
  distance!: number | null;
}

@ObjectType()
class ContextWorkspaceEmbeddingStatus {
  @Field(() => SafeIntResolver)
  total!: number;

  @Field(() => SafeIntResolver)
  embedded!: number;
}

@ObjectType()
class ContextMatchedDocChunk implements DocChunkSimilarity {
  @Field(() => String)
  docId!: string;

  @Field(() => SafeIntResolver)
  chunk!: number;

  @Field(() => String)
  content!: string;

  @Field(() => Float, { nullable: true })
  distance!: number | null;
}

@Throttle()
@Resolver(() => CopilotType)
export class CopilotContextRootResolver {
  constructor(
    private readonly db: PrismaClient,
    private readonly event: EventBus,
    private readonly mutex: RequestMutex,
    private readonly permissions: PermissionService,
    private readonly chatSession: ChatSessionService,
    private readonly context: CopilotContextService
  ) {}

  private async checkChatSession(
    user: CurrentUser,
    sessionId: string,
    workspaceId?: string
  ): Promise<void> {
    const session = await this.chatSession.get(sessionId);
    if (
      !session ||
      session.config.workspaceId !== workspaceId ||
      session.config.userId !== user.id
    ) {
      throw new CopilotSessionNotFound();
    }
  }

  @ResolveField(() => [CopilotContextType], {
    description: 'Get the context list of a session',
    complexity: 2,
  })
  @CallMetric('ai', 'context_create')
  async contexts(
    @Parent() copilot: CopilotType,
    @CurrentUser() user: CurrentUser,
    @Args('sessionId') sessionId: string,
    @Args('contextId', { nullable: true }) contextId?: string
  ) {
    const lockFlag = `${COPILOT_LOCKER}:context:${sessionId}`;
    await using lock = await this.mutex.acquire(lockFlag);
    if (!lock) {
      return new TooManyRequest('Server is busy');
    }
    await this.checkChatSession(user, sessionId, copilot.workspaceId);

    if (contextId) {
      const context = await this.context.get(contextId);
      if (context) return [context];
    } else {
      const context = await this.context.getBySessionId(sessionId);
      if (context) return [context];
    }
    return [];
  }

  @Mutation(() => String, {
    description: 'Create a context session',
  })
  @CallMetric('ai', 'context_create')
  async createCopilotContext(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId') workspaceId: string,
    @Args('sessionId') sessionId: string
  ) {
    const lockFlag = `${COPILOT_LOCKER}:context:${sessionId}`;
    await using lock = await this.mutex.acquire(lockFlag);
    if (!lock) {
      return new TooManyRequest('Server is busy');
    }
    await this.checkChatSession(user, sessionId, workspaceId);

    const context = await this.context.create(sessionId);
    return context.id;
  }

  @Mutation(() => Boolean, {
    description: 'queue workspace doc embedding',
  })
  @CallMetric('ai', 'context_queue_workspace_doc')
  async queueWorkspaceEmbedding(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId') workspaceId: string,
    @Args('docId', { type: () => [String] }) docIds: string[]
  ) {
    await this.permissions.checkCloudWorkspace(workspaceId, user.id);
    for (const docId of docIds) {
      this.event.emit('workspace.doc.embedding', { workspaceId, docId });
    }
    return true;
  }

  @Query(() => ContextWorkspaceEmbeddingStatus, {
    description: 'query workspace embedding status',
  })
  @CallMetric('ai', 'context_query_workspace_embedding_status')
  async queryWorkspaceEmbeddingStatus(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId') workspaceId: string
  ) {
    await this.permissions.checkCloudWorkspace(workspaceId, user.id);

    const total = await this.db.snapshot.count({ where: { workspaceId } });
    const embedded = await this.db.snapshot.count({
      where: { workspaceId, embedding: { isNot: null } },
    });
    return { total, embedded };
  }
}

@Throttle()
@Resolver(() => CopilotContextType)
export class CopilotContextResolver {
  constructor(
    private readonly mutex: RequestMutex,
    private readonly permissions: PermissionService,
    private readonly context: CopilotContextService
  ) {}

  private getSignal(req: Request) {
    const controller = new AbortController();
    req.on('close', () => controller.abort());
    return controller.signal;
  }

  @ResolveField(() => [CopilotContextDoc], {
    description: 'list files in context',
  })
  @CallMetric('ai', 'context_file_list')
  async docs(@Parent() context: CopilotContextType): Promise<ContextDoc[]> {
    const session = await this.context.get(context.id);
    return session.listDocs();
  }

  @Mutation(() => [CopilotContextListItem], {
    description: 'add a doc to context',
  })
  @CallMetric('ai', 'context_doc_add')
  async addContextDoc(
    @Args({ name: 'options', type: () => AddContextDocInput })
    options: AddContextDocInput
  ) {
    const lockFlag = `${COPILOT_LOCKER}:context:${options.contextId}`;
    await using lock = await this.mutex.acquire(lockFlag);
    if (!lock) {
      return new TooManyRequest('Server is busy');
    }
    const session = await this.context.get(options.contextId);

    try {
      return await session.addDocRecord(options.docId);
    } catch (e: any) {
      throw new CopilotFailedToModifyContext({
        contextId: options.contextId,
        message: e.message,
      });
    }
  }

  @Mutation(() => Boolean, {
    description: 'remove a doc from context',
  })
  @CallMetric('ai', 'context_doc_remove')
  async removeContextDoc(
    @Args({ name: 'options', type: () => RemoveContextFileInput })
    options: RemoveContextFileInput
  ) {
    const lockFlag = `${COPILOT_LOCKER}:context:${options.contextId}`;
    await using lock = await this.mutex.acquire(lockFlag);
    if (!lock) {
      return new TooManyRequest('Server is busy');
    }
    const session = await this.context.get(options.contextId);

    try {
      return await session.removeDocRecord(options.fileId);
    } catch (e: any) {
      throw new CopilotFailedToModifyContext({
        contextId: options.contextId,
        message: e.message,
      });
    }
  }

  @ResolveField(() => [CopilotContextFile], {
    description: 'list files in context',
  })
  @CallMetric('ai', 'context_file_list')
  async files(
    @Parent() context: CopilotContextType
  ): Promise<CopilotContextFile[]> {
    const session = await this.context.get(context.id);
    return session.listFiles();
  }

  @Mutation(() => [CopilotContextListItem], {
    description: 'add a file to context',
  })
  @CallMetric('ai', 'context_file_add')
  async addContextFile(
    @Context() ctx: { req: Request },
    @Args({ name: 'options', type: () => AddContextFileInput })
    options: AddContextFileInput,
    @Args({ name: 'content', type: () => GraphQLUpload })
    content: FileUpload
  ) {
    const lockFlag = `${COPILOT_LOCKER}:context:${options.contextId}`;
    await using lock = await this.mutex.acquire(lockFlag);
    if (!lock) {
      return new TooManyRequest('Server is busy');
    }
    const session = await this.context.get(options.contextId);

    try {
      const signal = this.getSignal(ctx.req);
      return await session.addStream(
        content.createReadStream(),
        content.filename,
        options.blobId,
        signal
      );
    } catch (e: any) {
      throw new CopilotFailedToModifyContext({
        contextId: options.contextId,
        message: e.message,
      });
    }
  }

  @Mutation(() => Boolean, {
    description: 'remove a file from context',
  })
  @CallMetric('ai', 'context_file_remove')
  async removeContextFile(
    @Args({ name: 'options', type: () => RemoveContextFileInput })
    options: RemoveContextFileInput
  ) {
    const lockFlag = `${COPILOT_LOCKER}:context:${options.contextId}`;
    await using lock = await this.mutex.acquire(lockFlag);
    if (!lock) {
      return new TooManyRequest('Server is busy');
    }
    const session = await this.context.get(options.contextId);

    try {
      return await session.removeFile(options.fileId);
    } catch (e: any) {
      throw new CopilotFailedToModifyContext({
        contextId: options.contextId,
        message: e.message,
      });
    }
  }

  @Mutation(() => [ContextMatchedFileChunk], {
    description: 'remove a file from context',
  })
  @CallMetric('ai', 'context_file_remove')
  async matchContext(
    @Context() ctx: { req: Request },
    @Args('contextId') contextId: string,
    @Args('content') content: string,
    @Args('limit', { type: () => SafeIntResolver, nullable: true })
    limit?: number
  ) {
    const lockFlag = `${COPILOT_LOCKER}:context:${contextId}`;
    await using lock = await this.mutex.acquire(lockFlag);
    if (!lock) {
      return new TooManyRequest('Server is busy');
    }
    const session = await this.context.get(contextId);

    try {
      return await session.matchFileChunks(
        content,
        limit,
        this.getSignal(ctx.req)
      );
    } catch (e: any) {
      throw new CopilotFailedToMatchContext({
        contextId,
        // don't record the large content
        content: content.slice(0, 512),
        message: e.message,
      });
    }
  }

  @Mutation(() => ContextMatchedDocChunk, {
    description: 'match workspace doc',
  })
  @CallMetric('ai', 'context_match_workspace_doc')
  async matchWorkspaceContext(
    @CurrentUser() user: CurrentUser,
    @Context() ctx: { req: Request },
    @Args('contextId') contextId: string,
    @Args('content') content: string,
    @Args('limit', { type: () => SafeIntResolver, nullable: true })
    limit?: number
  ) {
    const session = await this.context.get(contextId);
    await this.permissions.checkCloudWorkspace(session.workspaceId, user.id);

    try {
      return await session.matchFileChunks(
        content,
        limit,
        this.getSignal(ctx.req)
      );
    } catch (e: any) {
      throw new CopilotFailedToMatchContext({
        contextId,
        // don't record the large content
        content: content.slice(0, 512),
        message: e.message,
      });
    }
  }
}
