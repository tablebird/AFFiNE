import '../../_common/components/ask-ai-button';

import {
  ActionPlacement,
  type AffineFormatBarWidget,
  toolbarDefaultConfig,
  type ToolbarModuleConfig,
} from '@blocksuite/affine/blocks';
import { html, type TemplateResult } from 'lit';

import { pageAIGroups } from '../../_common/config';

export function setupFormatBarAIEntry(formatBar: AffineFormatBarWidget) {
  toolbarDefaultConfig(formatBar);
  formatBar.addRawConfigItems(
    [
      {
        type: 'custom' as const,
        render(formatBar: AffineFormatBarWidget): TemplateResult | null {
          const richText = getRichText();
          if (richText?.dataset.disableAskAi !== undefined) return null;
          return html`
            <ask-ai-toolbar-button
              .host=${formatBar.host}
              .actionGroups=${pageAIGroups}
            ></ask-ai-toolbar-button>
          `;
        },
      },
      { type: 'divider' },
    ],
    0
  );
}
const getRichText = () => {
  const selection = getSelection();
  if (!selection) return null;
  if (selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const commonAncestorContainer =
    range.commonAncestorContainer instanceof Element
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
  if (!commonAncestorContainer) return null;
  return commonAncestorContainer.closest('rich-text');
};

export function toolbarAIEntryConfig(): ToolbarModuleConfig {
  return {
    actions: [
      {
        id: 'ai',
        placement: ActionPlacement.Start,
        score: -1,
        when({ host, std }) {
          const range = std.range.value;
          if (!range) return true;
          const commonAncestorContainer =
            range.commonAncestorContainer instanceof Element
              ? range.commonAncestorContainer
              : range.commonAncestorContainer.parentElement;
          if (!commonAncestorContainer) return true;
          const richText = commonAncestorContainer.closest('rich-text');
          return richText
            ? host.contains(richText) &&
                richText.dataset.disableAskAi === undefined
            : true;
        },
        content({ host }) {
          return html`
            <ask-ai-toolbar-button
              .host=${host}
              .actionGroups=${pageAIGroups}
            ></ask-ai-toolbar-button>
          `;
        },
      },
    ],
  };
}
