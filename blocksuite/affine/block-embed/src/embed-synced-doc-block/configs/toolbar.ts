import { toast } from '@blocksuite/affine-components/toast';
import { EmbedSyncedDocBlockSchema } from '@blocksuite/affine-model';
import {
  ActionPlacement,
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
} from '@blocksuite/icons/lit';
import { Slice } from '@blocksuite/store';
import { signal } from '@preact/signals-core';
import { html } from 'lit';

import { EmbedSyncedDocBlockComponent } from '../embed-synced-doc-block';

export const builtinToolbarConfig = {
  actions: [
    {
      id: 'a.conversions',
      actions: [
        {
          id: 'inline-view',
          label: 'Inline view',
          run(cx) {
            const component = cx.getCurrentBlockComponentBy(
              BlockSelection,
              EmbedSyncedDocBlockComponent
            );
            component?.covertToInline();
          },
        },
        {
          id: 'card-view',
          label: 'Card view',
          run(cx) {
            const component = cx.getCurrentBlockComponentBy(
              BlockSelection,
              EmbedSyncedDocBlockComponent
            );
            component?.convertToCard();
          },
        },
        {
          id: 'embed-view',
          label: 'Embed view',
          disabled: true,
        },
      ],
      content(cx) {
        const model = cx.getCurrentBlockModelBy(
          BlockSelection,
          EmbedSyncedDocBlockSchema
        );
        if (!model) return null;

        const actions = this.actions.map(action => ({ ...action }));

        return html`<affine-view-dropdown
          .actions=${actions}
          .context=${cx}
          .viewType$=${signal(actions[2].label)}
        ></affine-view-dropdown>`;
      },
    } satisfies ToolbarActionGroup<ToolbarAction>,
    {
      id: 'b.caption',
      tooltip: 'Caption',
      icon: CaptionIcon(),
      run(cx) {
        const component = cx.getCurrentBlockComponentBy(
          BlockSelection,
          EmbedSyncedDocBlockComponent
        );
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
