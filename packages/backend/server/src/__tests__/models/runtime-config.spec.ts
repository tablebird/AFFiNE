import ava, { TestFn } from 'ava';

import { Config } from '../../base/config';
import {
  RuntimeConfigModel,
  RuntimeConfigType,
} from '../../models/runtime-config';
import { createTestingModule, type TestingModule } from '../utils';

interface Context {
  config: Config;
  module: TestingModule;
  runtimeConfig: RuntimeConfigModel;
}

const test = ava as TestFn<Context>;

test.before(async t => {
  const module = await createTestingModule({});

  t.context.runtimeConfig = module.get(RuntimeConfigModel);
  t.context.config = module.get(Config);
  t.context.module = module;
});

test.beforeEach(async t => {
  await t.context.module.initTestingDB();
});

test.after(async t => {
  await t.context.module.close();
});

test('should create, get, update and delete runtime config', async t => {
  const config = await t.context.runtimeConfig.upsert('test', {
    id: 'test',
    module: 'test',
    key: 'test',
    value: 'test',
    type: RuntimeConfigType.String,
    description: 'test',
  });
  t.truthy(config.id);
  t.is(config.deletedAt, null);
  t.is(config.value, 'test');
  t.is(config.type, RuntimeConfigType.String);
  t.is(config.description, 'test');
  t.is(config.module, 'test');
  t.is(config.key, 'test');

  const getConfig = await t.context.runtimeConfig.get('test');
  t.deepEqual(config, getConfig);

  const updatedConfig = await t.context.runtimeConfig.upsert('test', {
    id: 'test',
    module: 'test',
    key: 'test',
    value: 'updated',
    type: RuntimeConfigType.String,
    description: 'updated',
  });
  t.is(updatedConfig.value, 'updated');
  // t.is(updatedConfig.description, 'updated');

  const deletedConfig = await t.context.runtimeConfig.deleteByIds(['test']);
  t.is(deletedConfig, 1);
  const getDeletedConfig = await t.context.runtimeConfig.get('test');
  t.is(getDeletedConfig, null);
});

test('should find many runtime configs by module', async t => {
  await t.context.runtimeConfig.upsert('test', {
    id: 'test',
    module: 'test',
    key: 'test',
    value: 'test',
    type: RuntimeConfigType.String,
    description: 'test',
  });
  await t.context.runtimeConfig.upsert('test2', {
    id: 'test2',
    module: 'test',
    key: 'test2',
    value: 'test2',
    type: RuntimeConfigType.String,
    description: 'test2',
  });

  const configs = await t.context.runtimeConfig.findManyByModule('test');
  t.is(configs.length, 2);
  t.is(configs[0].id, 'test');
  t.is(configs[0].module, 'test');
  t.is(configs[0].key, 'test');
  t.is(configs[1].id, 'test2');
  t.is(configs[1].module, 'test');
  t.is(configs[1].key, 'test2');

  // test findManyByModule with no module
  const configs2 = await t.context.runtimeConfig.findManyByModule();
  t.is(configs2.length, 3);
  t.is(configs2[0].id, 'auth/password.min');
  t.is(configs2[0].module, 'auth');
  t.is(configs2[0].key, 'password.min');
  t.is(configs2[1].id, 'test');
  t.is(configs2[1].module, 'test');
  t.is(configs2[1].key, 'test');
  t.is(configs2[2].id, 'test2');
  t.is(configs2[2].module, 'test');
  t.is(configs2[2].key, 'test2');
});

test('should find many runtime configs by ids', async t => {
  await t.context.runtimeConfig.upsert('test', {
    id: 'test',
    module: 'test',
    key: 'test',
    value: 'test',
    type: RuntimeConfigType.String,
    description: 'test',
  });
  await t.context.runtimeConfig.upsert('test2', {
    id: 'test2',
    module: 'test',
    key: 'test2',
    value: 'test2',
    type: RuntimeConfigType.String,
    description: 'test2',
  });

  const configs = await t.context.runtimeConfig.findManyByIds([
    'test',
    'test2',
  ]);
  t.is(configs.length, 2);
  t.is(configs[0].id, 'test');
  t.is(configs[0].module, 'test');
  t.is(configs[0].key, 'test');
  t.is(configs[0].value, 'test');
  t.is(configs[0].type, RuntimeConfigType.String);
  t.is(configs[0].description, 'test');
  t.is(configs[1].id, 'test2');
  t.is(configs[1].module, 'test');
  t.is(configs[1].key, 'test2');
  t.is(configs[1].value, 'test2');
  t.is(configs[1].type, RuntimeConfigType.String);
  t.is(configs[1].description, 'test2');
});
