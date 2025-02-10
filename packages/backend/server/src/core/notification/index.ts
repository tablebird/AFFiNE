import { Module } from '@nestjs/common';

import { NotificationResolver } from './resolver';

@Module({
  // imports: [],
  providers: [NotificationResolver],
  // exports: [NotificationService],
})
export class NotificationModule {}
