import { toast } from '@blocksuite/affine-components/toast';
import {
  BookmarkStyles,
  EmbedGithubBlockSchema,
  isExternalEmbedModel,
} from '@blocksuite/affine-model';
import {
  ActionPlacement,
  EmbedOptionProvider,
  type ToolbarAction,
  type ToolbarActionGroup,
  type ToolbarModuleConfig,
} from '@blocksuite/affine-shared/services';
import { getBlockProps } from '@blocksuite/affine-shared/utils';
import { BlockSelection } from '@blocksuite/block-std';
import {
  CaptionIcon,
  CopyIcon,
  DeleteIcon,
  DuplicateIcon,
  ResetIcon,
} from '@blocksuite/icons/lit';
import { Slice, Text } from '@blocksuite/store';
import { signal } from '@preact/signals-core';
import { html } from 'lit';
import * as Y from 'yjs';

import type { EmbedFigmaBlockComponent } from '../embed-figma-block';
import type { EmbedGithubBlockComponent } from '../embed-github-block';
import type { EmbedLoomBlockComponent } from '../embed-loom-block';
import type { EmbedYoutubeBlockComponent } from '../embed-youtube-block';

// External embed blocks
export function createBuiltinToolbarConfigForExternal(
  klass:
    | typeof EmbedGithubBlockComponent
    | typeof EmbedFigmaBlockComponent
    | typeof EmbedLoomBlockComponent
    | typeof EmbedYoutubeBlockComponent
) {
  return {
    actions: [
      {
        id: 'a.preview',
        content(cx) {
          const model = cx.getCurrentBlockBy(BlockSelection)?.model;
          if (!model) return null;

          if (!isExternalEmbedModel(model)) return null;

          const { url } = model;
          const options = cx.std
            .get(EmbedOptionProvider)
            .getEmbedBlockOptions(url);

          if (options?.viewType !== 'card') return null;

          return html`<affine-link-preview .url=${url}></affine-link-preview>`;
        },
      },
      {
        id: 'b.conversions',
        actions: [
          {
            id: 'inline-view',
            label: 'Inline view',
            run(cx) {
              const model = cx.getCurrentBlockBy(BlockSelection)?.model;
              if (!model) return;

              if (!isExternalEmbedModel(model)) return;

              const { title, caption, url: link, parent } = model;
              const index = parent?.children.indexOf(model);

              const yText = new Y.Text();
              const insert = title || caption || link;
              yText.insert(0, insert);
              yText.format(0, insert.length, { link });

              const text = new Text(yText);

              cx.store.addBlock('affine:paragraph', { text }, parent, index);

              cx.store.deleteBlock(model);
            },
          },
          {
            id: 'card-view',
            label: 'Card view',
            disabled(cx) {
              const model = cx.getCurrentBlockBy(BlockSelection)?.model;
              if (!model) return true;

              if (!isExternalEmbedModel(model)) return true;

              const { url } = model;
              const options = cx.std
                .get(EmbedOptionProvider)
                .getEmbedBlockOptions(url);

              return options?.viewType === 'card';
            },
            run(cx) {
              const model = cx.getCurrentBlockBy(BlockSelection)?.model;
              if (!model) return;

              if (!isExternalEmbedModel(model)) return;

              const { url, caption, parent } = model;
              const index = parent?.children.indexOf(model);
              const options = cx.std
                .get(EmbedOptionProvider)
                .getEmbedBlockOptions(url);

              let { style } = model;
              let flavour = 'affine:bookmark';

              if (options?.viewType === 'card') {
                flavour = options.flavour;
                if (!options.styles.includes(style)) {
                  style = options.styles[0];
                }
              } else {
                style =
                  BookmarkStyles.find(s => s !== 'vertical' && s !== 'cube') ??
                  BookmarkStyles[1];
              }

              cx.store.addBlock(
                flavour as BlockSuite.Flavour,
                { url, caption, style },
                parent,
                index
              );

              cx.store.deleteBlock(model);
            },
          },
          {
            id: 'embed-view',
            label: 'Embed view',
            disabled(cx) {
              const model = cx.getCurrentBlockBy(BlockSelection)?.model;
              if (!model) return false;

              if (!isExternalEmbedModel(model)) return false;

              const { url } = model;
              const options = cx.std
                .get(EmbedOptionProvider)
                .getEmbedBlockOptions(url);

              return options?.viewType === 'embed';
            },
            when(cx) {
              const model = cx.getCurrentBlockBy(BlockSelection)?.model;
              if (!model) return false;

              if (!isExternalEmbedModel(model)) return false;

              const { url } = model;
              const options = cx.std
                .get(EmbedOptionProvider)
                .getEmbedBlockOptions(url);

              return options?.viewType === 'embed';
            },
            run(cx) {
              const model = cx.getCurrentBlockBy(BlockSelection)?.model;
              if (!model) return;

              if (!isExternalEmbedModel(model)) return;

              const { url, caption, parent } = model;
              const index = parent?.children.indexOf(model);
              const options = cx.std
                .get(EmbedOptionProvider)
                .getEmbedBlockOptions(url);

              if (options?.viewType !== 'embed') return;

              const { flavour, styles } = options;
              let { style } = model;

              if (!styles.includes(style)) {
                style =
                  styles.find(s => s !== 'vertical' && s !== 'cube') ??
                  styles[0];
              }

              cx.store.addBlock(
                flavour as BlockSuite.Flavour,
                { url, caption, style },
                parent,
                index
              );

              cx.store.deleteBlock(model);
            },
          },
        ],
        content(cx) {
          const model = cx.getCurrentBlockBy(BlockSelection)?.model;
          if (!model) return null;

          if (!isExternalEmbedModel(model)) return null;

          const { url } = model;
          const viewType =
            cx.std.get(EmbedOptionProvider).getEmbedBlockOptions(url)
              ?.viewType ?? 'card';
          const actions = this.actions.filter(action => {
            if (action.when) {
              if (typeof action.when === 'function') return action.when(cx);
              return action.when;
            }
            return true;
          });

          return html`<affine-view-dropdown
            .actions=${actions}
            .context=${cx}
            .viewType$=${signal(
              `${viewType === 'card' ? 'Card' : 'Embed'} view`
            )}
          ></affine-view-dropdown>`;
        },
      } satisfies ToolbarActionGroup<ToolbarAction>,
      {
        id: 'c.style',
        actions: [
          {
            id: 'horizontal',
            label: 'Large horizontal style',
          },
          {
            id: 'list',
            label: 'Small horizontal style',
          },
        ],
        content(cx) {
          const model = cx.getCurrentBlockModelBy(
            BlockSelection,
            EmbedGithubBlockSchema
          );
          if (!model) return null;

          const actions = this.actions.map(action => ({
            ...action,
            run: ({ store }) => {
              store.updateBlock(model, { style: action.id });

              // TODO(@fundon): add tracking event
            },
          })) satisfies ToolbarAction[];

          return html`<affine-card-style-dropdown
            .actions=${actions}
            .context=${cx}
            .style$=${model.style$}
          ></affine-card-style-dropdown>`;
        },
      } satisfies ToolbarActionGroup<ToolbarAction>,
      {
        id: 'd.caption',
        tooltip: 'Caption',
        icon: CaptionIcon(),
        run(cx) {
          const component = cx.getCurrentBlockComponentBy(
            BlockSelection,
            klass
          );
          if (!component) return;

          component?.captionEditor?.show();
        },
      },
      {
        placement: ActionPlacement.More,
        id: 'a.clipboard',
        actions: [
          {
            id: 'copy',
            label: 'Copy',
            icon: CopyIcon(),
            run(cx) {
              const model = cx.getCurrentBlockBy(BlockSelection)?.model;
              if (!model) return;

              const slice = Slice.fromModels(cx.store, [model]);
              cx.clipboard
                .copySlice(slice)
                .then(() => toast(cx.host, 'Copied to clipboard'))
                .catch(console.error);
            },
          },
          {
            id: 'duplicate',
            label: 'Duplicate',
            icon: DuplicateIcon(),
            run(cx) {
              const model = cx.getCurrentBlockBy(BlockSelection)?.model;
              if (!model) return;

              const { flavour, parent } = model;
              const props = getBlockProps(model);
              const index = parent?.children.indexOf(model);

              cx.store.addBlock(
                flavour as BlockSuite.Flavour,
                props,
                parent,
                index
              );
            },
          },
        ],
      },
      {
        placement: ActionPlacement.More,
        id: 'b.reload',
        label: 'Reload',
        icon: ResetIcon(),
        run(cx) {
          const component = cx.getCurrentBlockComponentBy(
            BlockSelection,
            klass
          );
          if (!component) return;

          component?.refreshData();
        },
      },
      {
        placement: ActionPlacement.More,
        id: 'c.delete',
        label: 'Delete',
        icon: DeleteIcon(),
        variant: 'destructive',
        run(cx) {
          const model = cx.getCurrentBlockBy(BlockSelection)?.model;
          if (!model) return;

          cx.store.deleteBlock(model);
        },
      },
    ],
  } as const satisfies ToolbarModuleConfig;
}
