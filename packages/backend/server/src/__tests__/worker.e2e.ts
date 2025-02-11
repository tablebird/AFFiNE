import type { TestFn } from 'ava';
import ava from 'ava';
import Sinon from 'sinon';

import { WorkerModule } from '../plugins/worker';
import { createTestingApp, TestingApp } from './utils';

const test = ava as TestFn<{
  app: TestingApp;
}>;

test.before(async t => {
  const app = await createTestingApp({
    imports: [WorkerModule],
  });

  t.context.app = app;
});

test.after.always(async t => {
  await t.context.app.close();
});

test('should proxy image', async t => {
  const { app } = t.context;

  const assertAndSnapshot = async (
    route: string,
    origin: string,
    status: number,
    message: string
  ) => {
    const res = app.GET(route).set('Origin', origin).expect(status);
    t.notThrowsAsync(res, message);
    t.snapshot((await res).body);
  };

  {
    await assertAndSnapshot(
      '/api/worker/image-proxy',
      'http://localhost',
      400,
      'should return 400 if "url" query parameter is missing'
    );
  }

  {
    await assertAndSnapshot(
      '/api/worker/image-proxy?url=http://example.com/image.png',
      'http://invalid.com',
      400,
      'should return 400 for invalid origin header'
    );
  }

  {
    const fakeBuffer = Buffer.from('fake image');
    const fakeResponse = {
      ok: true,
      headers: {
        get: (header: string) => {
          if (header.toLowerCase() === 'content-type') return 'image/png';
          if (header.toLowerCase() === 'content-disposition') return 'inline';
          return null;
        },
      },
      arrayBuffer: async () => fakeBuffer,
    } as any;

    const fetchSpy = Sinon.stub(global, 'fetch').resolves(fakeResponse);

    await assertAndSnapshot(
      '/api/worker/image-proxy?url=http://example.com/image.png',
      'http://localhost',
      200,
      'should return image buffer'
    );

    fetchSpy.restore();
  }
});
