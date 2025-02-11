import { GfxControllerIdentifier } from '@blocksuite/block-std/gfx';
import { CanvasRendererExtension } from '@blocksuite/blocks';
import { Text } from '@blocksuite/store';
import { Pane } from 'tweakpane';

import { doc, editor } from './editor.js';

type DocMode = 'page' | 'edgeless';

// Initialize renderer after editor is mounted and rendered
let renderer: CanvasRendererExtension;

async function initRenderer() {
  // Ensure editor is mounted and rendered
  await editor.updateComplete;
  const gfx = editor.std.get(GfxControllerIdentifier);
  renderer = new CanvasRendererExtension(editor.std.host, gfx.viewport);
  return gfx;
}

async function handleToCanvasClick() {
  if (!renderer) {
    const gfx = await initRenderer();
    gfx.viewport.viewportUpdated.on(async () => {
      await renderer.render();
    });
  }
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
      editor.mode = value as DocMode;
    });

  document.querySelector('#container')!.append(editor);
}

function addParagraph(content: string) {
  const note = doc.getBlocksByFlavour('affine:note')[0];
  const props = {
    text: new Text(content),
  };
  doc.addBlock('affine:paragraph', props, note.id);
}

async function main() {
  initUI();
  await editor.updateComplete;
  await initRenderer();

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

main().catch(console.error);
