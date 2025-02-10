import { Injectable } from '@nestjs/common';
import { NotificationLevel, NotificationType, Prisma } from '@prisma/client';
import { z } from 'zod';

import { BaseModel } from './base';

export { NotificationLevel, NotificationType };

export const MentionNotificationBodySchema = z.object({
  workspaceId: z.string(),
  docId: z.string(),
  blockId: z.string(),
});
export type MentionNotificationBody = z.infer<
  typeof MentionNotificationBodySchema
>;

export const CommentNotificationBodySchema =
  MentionNotificationBodySchema.extend({
    commentId: z.string(),
    content: z.string(),
  });
export type CommentNotificationBody = z.infer<
  typeof CommentNotificationBodySchema
>;

export const NotificationBodySchema = MentionNotificationBodySchema.merge(
  CommentNotificationBodySchema
).partial();
export type NotificationBody = z.infer<typeof NotificationBodySchema>;

@Injectable()
export class NotificationModel extends BaseModel {
  async create(data: Prisma.NotificationCreateInput) {
    return this.db.notification.create({
      data,
    });
  }

  async findMany(userId: string) {
    return this.db.notification.findMany({
      where: {
        userId,
      },
      include: {
        createdByUser: true,
      },
    });
  }
}
