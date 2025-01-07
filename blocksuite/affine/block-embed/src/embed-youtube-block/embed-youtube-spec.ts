import { EmbedYoutubeBlockSchema } from '@blocksuite/affine-model';
import { ToolbarModuleExtension } from '@blocksuite/affine-shared/services';
import {
  BlockServiceIdentifier,
  BlockViewExtension,
  FlavourExtension,
} from '@blocksuite/block-std';
import type { ExtensionType } from '@blocksuite/store';
import { literal } from 'lit/static-html.js';

import { createBuiltinToolbarConfigForExternal } from '../configs/toolbar';
import { EmbedYoutubeBlockAdapterExtensions } from './adapters/extension';
import { EmbedYoutubeBlockComponent } from './embed-youtube-block';
import { EmbedYoutubeBlockService } from './embed-youtube-service';

const flavour = EmbedYoutubeBlockSchema.model.flavour as BlockSuite.Flavour;

export const EmbedYoutubeBlockSpec: ExtensionType[] = [
  FlavourExtension(flavour),
  EmbedYoutubeBlockService,
  BlockViewExtension(flavour, model => {
    return model.parent?.flavour === 'affine:surface'
      ? literal`affine-embed-edgeless-youtube-block`
      : literal`affine-embed-youtube-block`;
  }),
  EmbedYoutubeBlockAdapterExtensions,
  ToolbarModuleExtension({
    id: BlockServiceIdentifier(flavour),
    config: createBuiltinToolbarConfigForExternal(EmbedYoutubeBlockComponent),
  }),
].flat();
