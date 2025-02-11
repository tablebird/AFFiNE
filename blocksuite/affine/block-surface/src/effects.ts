import { SurfaceBlockComponent } from './surface-block.js';
import { SurfaceBlockVoidComponent } from './surface-block-void.js';
import type { SurfaceBlockService } from './surface-service.js';

export function effects() {
  customElements.define('affine-surface-void', SurfaceBlockVoidComponent);
  customElements.define('affine-surface', SurfaceBlockComponent);
}

declare global {
  namespace BlockSuite {
    interface BlockServices {
      'affine:surface': SurfaceBlockService;
    }
  }
}
