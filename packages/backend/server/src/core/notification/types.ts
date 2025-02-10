import {
  createUnionType,
  Field,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';

import { NotificationLevel, NotificationType } from '../../models';

registerEnumType(NotificationLevel, {
  name: 'NotificationLevel',
  description: 'Notification level',
});

registerEnumType(NotificationType, {
  name: 'NotificationType',
  description: 'Notification type',
});

@ObjectType()
export class NotificationBase {
  @Field()
  id!: string;

  @Field(() => NotificationLevel)
  level!: NotificationLevel;

  @Field(() => NotificationType)
  type!: NotificationType;

  @Field()
  read!: boolean;

  @Field()
  starred!: boolean;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class MentionNotification extends NotificationBase {
  @Field()
  workspaceId!: string;

  @Field()
  docId!: string;

  @Field()
  blockId!: string;
}

// TODO(@fengmk2): just for extension example
@ObjectType()
export class CommentNotification extends NotificationBase {
  // @Field()
  // commentId!: string;
  // @Field()
  // content!: string;
}

export const Notification = createUnionType({
  name: 'Notification',
  types: () => [MentionNotification, CommentNotification] as const,
  resolveType(value: NotificationBase) {
    if (value.type === NotificationType.Mention) {
      return MentionNotification;
    }
    return CommentNotification;
  },
});

@InputType()
export class MentionNotificationInput {
  @Field()
  userId!: string;

  @Field()
  workspaceId!: string;

  @Field()
  docId!: string;

  @Field()
  blockId!: string;
}
