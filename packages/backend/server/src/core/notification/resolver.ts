import { Args, Mutation, Query } from '@nestjs/graphql';

import { PaginationInput } from '../../base';
import { CurrentUser } from '../auth/session';
import { UserType } from '../user';
import {
  MentionNotification,
  MentionNotificationInput,
  Notification,
} from './types';

export class NotificationResolver {
  // constructor(private readonly notification: NotificationService) {}

  @Query(() => [Notification], {
    name: 'notifications',
    description: 'Get current user notifications',
  })
  async notifications(
    @CurrentUser() me: UserType,
    @Args('pagination') pagination: PaginationInput
  ): Promise<(typeof Notification)[]> {
    console.log(me, pagination);
    // const notifications = await this.notification.getNotifications(me.id);

    return [];
  }

  @Mutation(() => MentionNotification, {
    name: 'sendMentionNotification',
    description: 'Send mention notification to other user',
  })
  async sendMentionNotification(
    @CurrentUser() me: UserType,
    @Args('input') input: MentionNotificationInput
  ): Promise<typeof MentionNotification> {
    console.log(me, input);
    // const notifications = await this.notification.getNotifications(me.id);

    return {} as any;
  }
}
