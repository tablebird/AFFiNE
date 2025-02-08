import { Injectable } from '@nestjs/common';
import { Prisma, RuntimeConfig, RuntimeConfigType } from '@prisma/client';

import { BaseModel } from './base';

export type { RuntimeConfig };
export { RuntimeConfigType };

@Injectable()
export class RuntimeConfigModel extends BaseModel {
  async upsert(id: string, data: Prisma.RuntimeConfigCreateInput) {
    const config = await this.db.runtimeConfig.upsert({
      where: {
        id,
        deletedAt: null,
      },
      create: data,
      update: {
        // old deleted setting should be restored
        ...data,
        deletedAt: null,
      },
    });
    return config;
  }

  async get(id: string) {
    return await this.db.runtimeConfig.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  /**
   * Find all runtime configs by module.
   * If module is not provided, find all runtime configs.
   */
  async findManyByModule(module?: string) {
    return await this.db.runtimeConfig.findMany({
      where: {
        module,
        deletedAt: null,
      },
    });
  }

  async findManyByIds(ids: string[]) {
    return await this.db.runtimeConfig.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
      },
    });
  }

  async deleteByIds(ids: string[]) {
    const { count } = await this.db.runtimeConfig.updateMany({
      where: {
        id: {
          in: ids,
        },
      },
      data: {
        deletedAt: new Date(),
      },
    });
    this.logger.log(`Deleted ${count} runtime configs, ids: ${ids}`);
    return count;
  }
}
