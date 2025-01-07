import { EmbedFigmaBlockSchema } from '@blocksuite/affine-model';
import { ToolbarModuleExtension } from '@blocksuite/affine-shared/services';
import {
  BlockServiceIdentifier,
  BlockViewExtension,
  FlavourExtension,
} from '@blocksuite/block-std';
import type { ExtensionType } from '@blocksuite/store';
import { literal } from 'lit/static-html.js';

import { createBuiltinToolbarConfigForExternal } from '../configs/toolbar';
import { EmbedFigmaBlockAdapterExtensions } from './adapters/extension';
import { EmbedFigmaBlockComponent } from './embed-figma-block';
import { EmbedFigmaBlockService } from './embed-figma-service';

const flavour = EmbedFigmaBlockSchema.model.flavour as BlockSuite.Flavour;

export const EmbedFigmaBlockSpec: ExtensionType[] = [
  FlavourExtension(flavour),
  EmbedFigmaBlockService,
  BlockViewExtension(flavour, model => {
    return model.parent?.flavour === 'affine:surface'
      ? literal`affine-embed-edgeless-figma-block`
      : literal`affine-embed-figma-block`;
  }),
  EmbedFigmaBlockAdapterExtensions,
  ToolbarModuleExtension({
    id: BlockServiceIdentifier(flavour),
    config: createBuiltinToolbarConfigForExternal(EmbedFigmaBlockComponent),
  }),
].flat();
