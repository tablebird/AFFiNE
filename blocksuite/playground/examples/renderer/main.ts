import { ViewportTurboRendererIdentifier } from '@blocksuite/affine-shared/viewport-renderer';
import { GfxControllerIdentifier } from '@blocksuite/block-std/gfx';
import { nextTick } from '@blocksuite/global/utils';
import { Text } from '@blocksuite/store';
import { Pane } from 'tweakpane';

import { doc, editor } from './editor.js';

type DocMode = 'page' | 'edgeless';

async function handleToCanvasClick() {
  const renderer = editor.std.get(ViewportTurboRendererIdentifier);
  await renderer.render();
  const viewport = editor.std.get(GfxControllerIdentifier).viewport;
  viewport.viewportUpdated.on(async () => {
    await renderer.render();
  });
}

async function handleModeChange(mode: DocMode) {
  editor.mode = mode;
  await nextTick();

  const renderer = editor.std.get(ViewportTurboRendererIdentifier);
  await renderer.render();
}

function initUI() {
  const pane = new Pane({
    container: document.querySelector('#tweakpane-container') as HTMLElement,
  });

  const params = {
    mode: 'edgeless' as DocMode,
  };

  pane
    .addButton({
      title: 'To Canvas',
    })
    .on('click', () => {
      handleToCanvasClick().catch(console.error);
    });
  pane
    .addBinding(params, 'mode', {
      label: 'Editor Mode',
      options: {
        Doc: 'page',
        Edgeless: 'edgeless',
      },
    })
    .on('change', ({ value }) => {
      handleModeChange(value as DocMode).catch(console.error);
    });
}

function addParagraph(content: string) {
  const note = doc.getBlocksByFlavour('affine:note')[0];
  const props = {
    text: new Text(content),
  };
  doc.addBlock('affine:paragraph', props, note.id);
}

function main() {
  initUI();

  document.querySelector('#left-column')?.append(editor);
  const firstParagraph = doc.getBlockByFlavour('affine:paragraph')[0];
  doc.updateBlock(firstParagraph, { text: new Text('Renderer') });

  addParagraph('Hello World!');
  addParagraph(
    'Hello World! Lorem ipsum dolor sit amet. Consectetur adipiscing elit. Sed do eiusmod tempor incididunt.'
  );
  addParagraph(
    '你好这是测试，这是一个为了换行而写的中文段落。这个段落会自动换行。'
  );
}

main();
