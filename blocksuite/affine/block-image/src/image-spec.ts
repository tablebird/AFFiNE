import { ToolbarModuleExtension } from '@blocksuite/affine-shared/services';
import {
  BlockFlavourIdentifier,
  BlockViewExtension,
  FlavourExtension,
  WidgetViewMapExtension,
} from '@blocksuite/block-std';
import type { ExtensionType } from '@blocksuite/store';
import { literal } from 'lit/static-html.js';

import { ImageBlockAdapterExtensions } from './adapters/extension';
import { ImageProxyService } from './image-proxy-service';
import { builtinToolbarConfig } from './configs/toolbar';
import { ImageBlockService, ImageDropOption } from './image-service';

const flavour = 'affine:image';

export const ImageBlockSpec: ExtensionType[] = [
  FlavourExtension(flavour),
  ImageBlockService,
  BlockViewExtension(flavour, model => {
    const parent = model.doc.getParent(model.id);

    if (parent?.flavour === 'affine:surface') {
      return literal`affine-edgeless-image`;
    }

    return literal`affine-image`;
  }),
  WidgetViewMapExtension(flavour, {
    imageToolbar: literal`affine-image-toolbar-widget`,
  }),
  ImageDropOption,
  ImageBlockAdapterExtensions,
  ToolbarModuleExtension({
    id: BlockFlavourIdentifier(flavour),
    config: builtinToolbarConfig,
  }),
].flat();

export const ImageStoreSpec: ExtensionType[] = [ImageProxyService].flat();
