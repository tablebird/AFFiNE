import '../core/version/config';

import { Controller, Get, HttpStatus, INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import ava, { TestFn } from 'ava';
import request from 'supertest';

import { AppModule } from '../app.module';
import { Runtime, UseNamedGuard } from '../base';
import { Public } from '../core/auth/guard';
import { createTestingApp, initTestingDB } from './utils';

const test = ava as TestFn<{
  runtime: Runtime;
  cookie: string;
  app: INestApplication;
}>;

@Public()
@Controller('/guarded')
class GuardedController {
  @UseNamedGuard('version')
  @Get('/test')
  test() {
    return 'test';
  }
}

test.before(async t => {
  const { app } = await createTestingApp({
    imports: [AppModule],
    controllers: [GuardedController],
  });

  t.context.runtime = app.get(Runtime);
  t.context.app = app;
});

test.beforeEach(async t => {
  await initTestingDB(t.context.app.get(PrismaClient));
  // reset runtime
  await t.context.runtime.loadDb('version/enable');
  await t.context.runtime.loadDb('version/allowedVersion');
  await t.context.runtime.set('version/enable', false);
  await t.context.runtime.set('version/allowedVersion', '>=0.0.1');
});

test.after.always(async t => {
  await t.context.app.close();
});

async function fetchWithVersion(
  server: any,
  version: string | undefined,
  status: number
) {
  let req = request(server).get('/guarded/test');
  if (version) {
    req = req.set({ 'x-affine-version': version });
  }
  const res = await req.expect(status);
  if (res.body.message) {
    throw new Error(res.body.message);
  }
  return res;
}

test('should be able to prevent requests if version outdated', async t => {
  const { app, runtime } = t.context;

  {
    await runtime.set('version/enable', false);
    await t.notThrowsAsync(
      fetchWithVersion(app.getHttpServer(), undefined, HttpStatus.OK),
      'should not check version if disabled'
    );
  }

  {
    await runtime.set('version/enable', true);
    await t.throwsAsync(
      fetchWithVersion(app.getHttpServer(), undefined, HttpStatus.FORBIDDEN),
      {
        message:
          'Unsupported client version: [Not Provided], please upgrade to 0.0.1.',
      },
      'should check version exists'
    );
    await t.throwsAsync(
      fetchWithVersion(
        app.getHttpServer(),
        'not_a_version',
        HttpStatus.FORBIDDEN
      ),
      {
        message:
          'Unsupported client version: not_a_version, please upgrade to 0.0.1.',
      },
      'should check version exists'
    );
    await t.notThrowsAsync(
      fetchWithVersion(app.getHttpServer(), '0.0.1', HttpStatus.OK),
      'should check version exists'
    );
  }

  {
    await runtime.set('version/allowedVersion', 'unknownVersion');
    await t.notThrowsAsync(
      fetchWithVersion(app.getHttpServer(), undefined, HttpStatus.OK),
      'should not check version if invalid allowedVersion provided'
    );
    await t.notThrowsAsync(
      fetchWithVersion(app.getHttpServer(), '0.0.1', HttpStatus.OK),
      'should not check version if invalid allowedVersion provided'
    );

    await runtime.set('version/allowedVersion', '0.0.1');
    await t.throwsAsync(
      fetchWithVersion(app.getHttpServer(), '0.0.0', HttpStatus.FORBIDDEN),
      {
        message: 'Unsupported client version: 0.0.0, please upgrade to 0.0.1.',
      },
      'should reject version if valid allowedVersion provided'
    );

    await runtime.set(
      'version/allowedVersion',
      '0.17.5 || >=0.18.0-nightly || >=0.18.0'
    );
    await t.notThrowsAsync(
      fetchWithVersion(app.getHttpServer(), '0.17.5', HttpStatus.OK),
      'should pass version if version satisfies allowedVersion'
    );
    await t.throwsAsync(
      fetchWithVersion(app.getHttpServer(), '0.17.4', HttpStatus.FORBIDDEN),
      {
        message:
          'Unsupported client version: 0.17.4, please upgrade to 0.18.0.',
      },
      'should reject version if valid allowedVersion provided'
    );
    await t.throwsAsync(
      fetchWithVersion(
        app.getHttpServer(),
        '0.17.6-nightly-f0d99f4',
        HttpStatus.FORBIDDEN
      ),
      {
        message:
          'Unsupported client version: 0.17.6-nightly-f0d99f4, please upgrade to 0.18.0.',
      },
      'should reject version if valid allowedVersion provided'
    );
    await t.notThrowsAsync(
      fetchWithVersion(
        app.getHttpServer(),
        '0.18.0-nightly-cc9b38c',
        HttpStatus.OK
      ),
      'should pass version if version satisfies allowedVersion'
    );
    await t.notThrowsAsync(
      fetchWithVersion(app.getHttpServer(), '0.18.1', HttpStatus.OK),
      'should pass version if version satisfies allowedVersion'
    );
  }

  {
    await runtime.set(
      'version/allowedVersion',
      '>=0.0.1 <=0.1.2 || ^0.2.0-nightly <0.2.0 || 0.3.0'
    );

    await t.notThrowsAsync(
      fetchWithVersion(app.getHttpServer(), '0.0.1', HttpStatus.OK),
      'should pass version if version satisfies allowedVersion'
    );
    await t.notThrowsAsync(
      fetchWithVersion(app.getHttpServer(), '0.1.2', HttpStatus.OK),
      'should pass version if version satisfies allowedVersion'
    );
    await t.throwsAsync(
      fetchWithVersion(app.getHttpServer(), '0.1.3', HttpStatus.FORBIDDEN),
      {
        message: 'Unsupported client version: 0.1.3, please upgrade to 0.3.0.',
      },
      'should reject version if valid allowedVersion provided'
    );

    await t.notThrowsAsync(
      fetchWithVersion(
        app.getHttpServer(),
        '0.2.0-nightly-cc9b38c',
        HttpStatus.OK
      ),
      'should pass version if version satisfies allowedVersion'
    );

    await t.throwsAsync(
      fetchWithVersion(app.getHttpServer(), '0.2.0', HttpStatus.FORBIDDEN),
      {
        message: 'Unsupported client version: 0.2.0, please upgrade to 0.3.0.',
      },
      'should reject version if valid allowedVersion provided'
    );

    await t.throwsAsync(
      fetchWithVersion(app.getHttpServer(), '0.3.1', HttpStatus.FORBIDDEN),
      {
        message:
          'Unsupported client version: 0.3.1, please downgrade to 0.3.0.',
      },
      'should reject version if valid allowedVersion provided'
    );
  }
});
