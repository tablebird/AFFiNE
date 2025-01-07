import { EmbedLoomBlockSchema } from '@blocksuite/affine-model';
import { ToolbarModuleExtension } from '@blocksuite/affine-shared/services';
import {
  BlockServiceIdentifier,
  BlockViewExtension,
  FlavourExtension,
} from '@blocksuite/block-std';
import type { ExtensionType } from '@blocksuite/store';
import { literal } from 'lit/static-html.js';

import { createBuiltinToolbarConfigForExternal } from '../configs/toolbar';
import { EmbedLoomBlockAdapterExtensions } from './adapters/extension';
import { EmbedLoomBlockComponent } from './embed-loom-block';
import { EmbedLoomBlockService } from './embed-loom-service';

const flavour = EmbedLoomBlockSchema.model.flavour as BlockSuite.Flavour;

export const EmbedLoomBlockSpec: ExtensionType[] = [
  FlavourExtension(flavour),
  EmbedLoomBlockService,
  BlockViewExtension(flavour, model => {
    return model.parent?.flavour === 'affine:surface'
      ? literal`affine-embed-edgeless-loom-block`
      : literal`affine-embed-loom-block`;
  }),
  EmbedLoomBlockAdapterExtensions,
  ToolbarModuleExtension({
    id: BlockServiceIdentifier(flavour),
    config: createBuiltinToolbarConfigForExternal(EmbedLoomBlockComponent),
  }),
].flat();
