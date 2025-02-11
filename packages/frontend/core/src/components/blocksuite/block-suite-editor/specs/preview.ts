import { AIChatBlockSpec } from '@affine/core/blocksuite/presets/blocks/ai-chat-block';
import { PeekViewService } from '@affine/core/modules/peek-view';
import { type SpecBuilder, SpecProvider } from '@blocksuite/affine/blocks';
import type { ExtensionType } from '@blocksuite/affine/store';
import type { FrameworkProvider } from '@toeverything/infra';

import {
  buildDocDisplayMetaExtension,
  getThemeExtension,
} from './custom/root-block';
import { patchPeekViewService } from './custom/spec-patchers';
import { getFontConfigExtension } from './font-extension';

const CustomSpecs: ExtensionType[] = [
  AIChatBlockSpec,
  getFontConfigExtension(),
].flat();

function patchPreviewSpec(id: string, specs: ExtensionType[]) {
  const specProvider = SpecProvider.getInstance();
  specProvider.extendSpec(id, specs);
}

export function effects() {
  // Patch edgeless preview spec for blocksuite surface-ref and embed-synced-doc
  patchPreviewSpec('edgeless:preview', CustomSpecs);
}

export function createPageModePreviewSpecs(
  framework: FrameworkProvider
): SpecBuilder {
  const specProvider = SpecProvider.getInstance();
  const pagePreviewSpec = specProvider.getSpec('page:preview');
  // Enable theme extension, doc display meta extension and peek view service
  const peekViewService = framework.get(PeekViewService);
  pagePreviewSpec.extend([
    getThemeExtension(framework),
    buildDocDisplayMetaExtension(framework),
    patchPeekViewService(peekViewService),
  ]);
  return pagePreviewSpec;
}
