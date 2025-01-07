import { ActionPlacement, type ToolbarModuleConfig } from '@blocksuite/affine-shared/services';

export const builtinToolbarConfig = {
  actions: [
    {
      id: 'download',
      tooltip: 'Download',
      run(_cx) {},
    },
    {
      id: 'caption',
      tooltip: 'Caption',
      run(_cx) {},
    },
    {
      id: 'clipboard',
      placement: ActionPlacement.More,
      actions: [
        {
          id: 'copy',
          label: 'Copy',
          run(_cx) {},
        },
        {
          id: 'duplicate',
          label: 'Duplicate',
          run(_cx) {},
        },
      ],
    },
    {
      id: 'conversions',
      placement: ActionPlacement.More,
      actions: [
        {
          id: 'turn-into-card-view',
          label: 'Turn into card view',
          run(_cx) {},
        },
      ],
    },
    {
      id: 'delete',
      placement: ActionPlacement.More,
      actions: [
        {
          id: 'delete',
          label: 'Delete',
          run(_cx) {},
        },
      ],
    },
  ],
} as const satisfies ToolbarModuleConfig;
