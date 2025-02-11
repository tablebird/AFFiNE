import type { EditorHost } from '@blocksuite/block-std';
import type {
  GfxController,
  Viewport,
  Viewport,
} from '@blocksuite/block-std/gfx';

import { getSentenceRects, segmentSentences } from './text-utils';
import { type ParagraphLayout, type SectionLayout } from './types';

class CanvasRenderer {
  private readonly worker: Worker;
  private readonly canvas: HTMLCanvasElement = document.createElement('canvas');
  private lastZoom: number | null = null;
  private lastSection: SectionLayout | null = null;
  private lastBitmap: ImageBitmap | null = null;
  private lastMode: 'page' | 'edgeless' = 'edgeless';
  private initialized = false;

  constructor(
    private readonly host: EditorHost,
    private readonly viewport: GfxController['viewport']
  ) {
    this.worker = new Worker(new URL('./painter.worker.ts', import.meta.url), {
      type: 'module',
    });
  }

  private get targetContainer(): HTMLElement {
    return this.host;
  }

  getHostRect() {
    return this.host.getBoundingClientRect();
  }

  getHostLayout() {
    const paragraphBlocks = this.host.querySelectorAll(
      '.affine-paragraph-rich-text-wrapper [data-v-text="true"]'
    );

    const zoom = this.viewport.zoom;
    const hostRect = this.getHostRect();

    let sectionMinX = Infinity;
    let sectionMinY = Infinity;
    let sectionMaxX = -Infinity;
    let sectionMaxY = -Infinity;

    const paragraphs: ParagraphLayout[] = Array.from(paragraphBlocks).map(p => {
      const sentences = segmentSentences(p.textContent || '');
      const sentenceLayouts = sentences.map(sentence => {
        const rects = getSentenceRects(p, sentence);
        rects.forEach(({ rect }) => {
          sectionMinX = Math.min(sectionMinX, rect.x);
          sectionMinY = Math.min(sectionMinY, rect.y);
          sectionMaxX = Math.max(sectionMaxX, rect.x + rect.w);
          sectionMaxY = Math.max(sectionMaxY, rect.y + rect.h);
        });
        return {
          text: sentence,
          rects: rects.map(rect => {
            const [x, y] = this.viewport.toModelCoordFromClientCoord([
              rect.rect.x,
              rect.rect.y,
            ]);
            return {
              ...rect,
              rect: {
                x,
                y,
                w: rect.rect.w / zoom / this.viewport.viewScale,
                h: rect.rect.h / zoom / this.viewport.viewScale,
              },
            };
          }),
        };
      });

      return {
        sentences: sentenceLayouts,
        zoom,
      };
    });

    if (paragraphs.length === 0) return null;

    const sectionModelCoord = this.viewport.toModelCoordFromClientCoord([
      sectionMinX,
      sectionMinY,
    ]);
    const w = (sectionMaxX - sectionMinX) / zoom / this.viewport.viewScale;
    const h = (sectionMaxY - sectionMinY) / zoom / this.viewport.viewScale;
    const section: SectionLayout = {
      paragraphs,
      rect: {
        x: sectionModelCoord[0],
        y: sectionModelCoord[1],
        w: Math.max(w, 0),
        h: Math.max(h, 0),
      },
    };

    return { section, hostRect };
  }

  private initSectionRenderer(width: number, height: number) {
    const dpr = window.devicePixelRatio;
    this.worker.postMessage({
      type: 'initSection',
      data: { width, height, dpr, zoom: this.viewport.zoom },
    });
  }

  private async renderSection(section: SectionLayout): Promise<void> {
    return new Promise(resolve => {
      if (!this.worker) return;

      this.worker.postMessage({
        type: 'paintSection',
        data: { section },
      });

      this.worker.onmessage = (e: MessageEvent) => {
        if (e.data.type === 'bitmapPainted') {
          this.handlePaintedBitmap(e.data.bitmap, section, resolve);
        }
      };
    });
  }

  private handlePaintedBitmap(
    bitmap: ImageBitmap,
    section: SectionLayout,
    resolve: () => void
  ) {
    const tempCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.drawImage(bitmap, 0, 0);
    const bitmapCopy = tempCanvas.transferToImageBitmap();

    this.updateCacheState(section, bitmapCopy);
    this.drawBitmap(bitmap, section);
    resolve();
  }

  private syncCanvasSize() {
    const hostRect = this.getHostRect();
    const dpr = window.devicePixelRatio;
    this.canvas.style.position = 'absolute';
    this.canvas.style.left = '0px';
    this.canvas.style.top = '0px';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.width = hostRect.width * dpr;
    this.canvas.height = hostRect.height * dpr;
    this.canvas.style.pointerEvents = 'none';
  }

  private updateCacheState(section: SectionLayout, bitmapCopy: ImageBitmap) {
    this.lastZoom = this.viewport.zoom;
    this.lastSection = section;
    this.lastMode = 'edgeless';
    if (this.lastBitmap) {
      this.lastBitmap.close();
    }
    this.lastBitmap = bitmapCopy;
  }

  private canUseCache(currentZoom: number): boolean {
    return (
      this.lastZoom === currentZoom &&
      !!this.lastSection &&
      !!this.lastBitmap &&
      this.lastMode === 'edgeless'
    );
  }

  private drawBitmap(bitmap: ImageBitmap, section: SectionLayout) {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const bitmapCanvas = new OffscreenCanvas(
      section.rect.w * window.devicePixelRatio * this.viewport.zoom,
      section.rect.h * window.devicePixelRatio * this.viewport.zoom
    );
    const bitmapCtx = bitmapCanvas.getContext('bitmaprenderer');
    if (!bitmapCtx) return;

    const tempCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.drawImage(bitmap, 0, 0);
    const bitmapCopy = tempCanvas.transferToImageBitmap();

    bitmapCtx.transferFromImageBitmap(bitmapCopy);

    const sectionViewCoord = this.viewport.toViewCoord(
      section.rect.x,
      section.rect.y
    );

    ctx.drawImage(
      bitmapCanvas,
      sectionViewCoord[0] * window.devicePixelRatio,
      sectionViewCoord[1] * window.devicePixelRatio,
      section.rect.w * window.devicePixelRatio * this.viewport.zoom,
      section.rect.h * window.devicePixelRatio * this.viewport.zoom
    );
  }

  private checkMount() {
    if (this.initialized) return;
    if (!this.targetContainer) return;
    this.targetContainer.append(this.canvas);
    this.initialized = true;
  }

  public async render(): Promise<void> {
    if (!this.targetContainer) return;
    this.checkMount();

    const hostLayout = this.getHostLayout();
    if (!hostLayout) return;

    const { section } = hostLayout;
    const currentZoom = this.viewport.zoom;

    if (this.canUseCache(currentZoom)) {
      this.drawBitmap(this.lastBitmap!, this.lastSection!);
    } else {
      this.syncCanvasSize();
      this.initSectionRenderer(section.rect.w, section.rect.h);
      await this.renderSection(section);
    }
  }

  dispose() {
    if (this.lastBitmap) {
      this.lastBitmap.close();
    }
    this.worker.terminate();
    this.canvas.remove();
  }
}

export class CanvasRendererExtension {
  private renderer: CanvasRenderer | null = null;

  constructor(
    private readonly host: EditorHost,
    private readonly viewport: Viewport
  ) {}

  mount() {
    this.renderer = new CanvasRenderer(this.host, this.viewport);
  }

  unmount() {
    this.renderer?.dispose();
    this.renderer = null;
  }

  async render() {
    await this.renderer?.render();
  }
}
