import { EmbedGithubBlockSchema } from '@blocksuite/affine-model';
import { ToolbarModuleExtension } from '@blocksuite/affine-shared/services';
import {
  BlockServiceIdentifier,
  BlockViewExtension,
  FlavourExtension,
} from '@blocksuite/block-std';
import type { ExtensionType } from '@blocksuite/store';
import { literal } from 'lit/static-html.js';

import { createBuiltinToolbarConfigForExternal } from '../configs/toolbar';
import { EmbedGithubBlockAdapterExtensions } from './adapters/extension';
import { EmbedGithubBlockComponent } from './embed-github-block';
import { EmbedGithubBlockService } from './embed-github-service';

const flavour = EmbedGithubBlockSchema.model.flavour as BlockSuite.Flavour;

export const EmbedGithubBlockSpec: ExtensionType[] = [
  FlavourExtension(flavour),
  EmbedGithubBlockService,
  BlockViewExtension(flavour, model => {
    return model.parent?.flavour === 'affine:surface'
      ? literal`affine-embed-edgeless-github-block`
      : literal`affine-embed-github-block`;
  }),
  EmbedGithubBlockAdapterExtensions,
  ToolbarModuleExtension({
    id: BlockServiceIdentifier(flavour),
    config: createBuiltinToolbarConfigForExternal(EmbedGithubBlockComponent),
  }),
].flat();
