import {
  convertToDatabase,
  DATABASE_CONVERT_WHITE_LIST,
} from '@blocksuite/affine-block-database';
import {
  convertSelectedBlocksToLinkedDoc,
  getTitleFromSelectedModels,
  notifyDocCreated,
  promptDocTitle,
} from '@blocksuite/affine-block-embed';
import {
  formatBlockCommand,
  formatNativeCommand,
  formatTextCommand,
  isFormatSupported,
  textConversionConfigs,
  textFormatConfigs,
} from '@blocksuite/affine-components/rich-text';
import {
  draftSelectedModelsCommand,
  getBlockSelectionsCommand,
  getImageSelectionsCommand,
  getSelectedBlocksCommand,
  getSelectedModelsCommand,
  getTextSelectionCommand,
} from '@blocksuite/affine-shared/commands';
import type {
  ToolbarAction,
  ToolbarActionGenerator,
  ToolbarActionGroup,
  ToolbarModuleConfig,
} from '@blocksuite/affine-shared/services';
import {
  ActionPlacement,
  TelemetryProvider,
} from '@blocksuite/affine-shared/services';
import type { AffineTextAttributes } from '@blocksuite/affine-shared/types';
import type { BlockComponent } from '@blocksuite/block-std';
import { tableViewMeta } from '@blocksuite/data-view/view-presets';
import {
  ArrowDownSmallIcon,
  CopyIcon,
  DatabaseTableViewIcon,
  DeleteIcon,
  DuplicateIcon,
  // TODO(@fundon): update icon size
  HighLightDuotoneIcon,
  LinkedPageIcon,
  // TODO(@fundon): icon should support custom colors
  TextBackgroundDuotoneIcon,
  // TODO(@fundon): icon should support custom colors
  TextColorIcon,
} from '@blocksuite/icons/lit';
import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import { updateBlockType } from '../commands';

// Displays only in a single paragraph.
const conversionsActionGroup = {
  id: 'a.conversions',
  when: ({ chain }) => isFormatSupported(chain).run()[0],
  generate({ chain }) {
    const [ok, { selectedBlocks = [] }] = chain
      .tryAll(chain => [
        chain.pipe(getTextSelectionCommand),
        chain.pipe(getBlockSelectionsCommand),
      ])
      .pipe(getSelectedBlocksCommand, { types: ['text', 'block'] })
      .run();
    const vaild = ok && selectedBlocks.length === 1;
    if (!vaild) return null;

    const { model } = selectedBlocks[0];
    const conversion =
      textConversionConfigs.find(
        ({ flavour, type }) =>
          flavour === model.flavour &&
          (type ? 'type' in model && type === model.type : true)
      ) ?? textConversionConfigs[0];
    const update = (flavour: BlockSuite.Flavour, type?: string) => {
      chain
        .pipe(updateBlockType, {
          flavour,
          ...(type && { props: { type } }),
        })
        .run();
    };

    return {
      content: html`
        <editor-menu-button
          .contentPadding="${'8px'}"
          .button=${html`
            <editor-icon-button
              aria-label="conversions"
              .tooltip="${'Turn Into'}"
            >
              ${conversion.icon} ${ArrowDownSmallIcon()}
            </editor-icon-button>
          `}
        >
          <div data-size="large" data-orientation="vertical">
            ${repeat(
              textConversionConfigs.filter(c => c.flavour !== 'affine:divider'),
              item => item.name,
              ({ flavour, type, name, icon }) => html`
                <editor-menu-action
                  aria-label=${name}
                  ?data-selected=${conversion.name === name}
                  @click=${() => update(flavour, type)}
                >
                  ${icon}<span class="label">${name}</span>
                </editor-menu-action>
              `
            )}
          </div>
        </editor-menu-button>
      `,
    };
  },
} as const satisfies ToolbarActionGenerator;

const inlineTextActionGroup = {
  id: 'b.inline-text',
  when: ({ chain }) => isFormatSupported(chain).run()[0],
  actions: textFormatConfigs.map(
    ({ id, name, action, activeWhen, icon }, score) => {
      return {
        id,
        icon,
        score,
        tooltip: name,
        run: ({ host }) => action(host),
        active: ({ host }) => activeWhen(host),
      };
    }
  ),
} as const satisfies ToolbarActionGroup;

const colors = [
  'default',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'grey',
] as const;

const highlightActionGroup = {
  id: 'c.highlight',
  when: ({ chain }) => isFormatSupported(chain).run()[0],
  generate({ chain }) {
    const updateHighlight = (styles: AffineTextAttributes) => {
      const payload = { styles };
      chain
        .try(chain => [
          chain.pipe(getTextSelectionCommand).pipe(formatTextCommand, payload),
          chain
            .pipe(getBlockSelectionsCommand)
            .pipe(formatBlockCommand, payload),
          chain.pipe(formatNativeCommand, payload),
        ])
        .run();
    };
    const prefix = '--affine-text-highlight';
    return {
      content: html`
        <editor-menu-button
          .contentPadding="${'8px'}"
          .button=${html`
            <editor-icon-button
              aria-label="highlight"
              .tooltip="${'Highlight'}"
            >
              ${HighLightDuotoneIcon()} ${ArrowDownSmallIcon()}
            </editor-icon-button>
          `}
        >
          <div data-size="large" data-orientation="vertical">
            <div class="highligh-heading">Color</div>
            ${repeat(colors, color => {
              const isDefault = color === 'default';
              const value = isDefault
                ? null
                : `var(${prefix}-foreground-${color})`;
              return html`
                <editor-menu-action
                  data-testid="${color}"
                  @click=${() => updateHighlight({ color: value })}
                >
                  ${TextColorIcon({ style: `color: ${value ?? 'unset'}` })}
                  <span class="label"
                    >${isDefault ? `${color} color` : color}</span
                  >
                </editor-menu-action>
              `;
            })}

            <div class="highligh-heading">Background</div>
            ${repeat(colors, color => {
              const isDefault = color === 'default';
              const value = isDefault ? null : `var(${prefix}-${color})`;
              return html`
                <editor-menu-action
                  @click=${() => updateHighlight({ background: value })}
                >
                  ${TextBackgroundDuotoneIcon({
                    style: `color: ${value ?? 'transparent'}`,
                  })}
                  <span class="label"
                    >${isDefault ? `${color} background` : color}</span
                  >
                </editor-menu-action>
              `;
            })}
          </div>
        </editor-menu-button>
      `,
    };
  },
} as const satisfies ToolbarActionGenerator;

export const turnIntoDatabase = {
  id: 'd.convert-to-database',
  tooltip: 'Create Table',
  icon: DatabaseTableViewIcon(),
  when({ chain }) {
    const middleware = (count = 0) => {
      return (cx: { selectedBlocks: BlockComponent[] }, next: () => void) => {
        const { selectedBlocks } = cx;
        if (!selectedBlocks || selectedBlocks.length === count) return;

        const allowed = selectedBlocks.every(block =>
          DATABASE_CONVERT_WHITE_LIST.includes(block.flavour)
        );
        if (!allowed) return;

        next();
      };
    };

    let [ok] = chain
      .pipe(getTextSelectionCommand)
      .pipe(getSelectedBlocksCommand, {
        types: ['text'],
      })
      .pipe(middleware(1))
      .run();

    if (ok) return true;

    [ok] = chain
      .tryAll(chain => [
        chain.pipe(getBlockSelectionsCommand),
        chain.pipe(getImageSelectionsCommand),
      ])
      .pipe(getSelectedBlocksCommand, {
        types: ['block', 'image'],
      })
      .pipe(middleware(0))
      .run();

    return ok;
  },
  run({ host }) {
    convertToDatabase(host, tableViewMeta.type);
  },
} as const satisfies ToolbarAction;

export const turnIntoLinkedDoc = {
  id: 'e.convert-to-linked-doc',
  tooltip: 'Create Linked Doc',
  icon: LinkedPageIcon(),
  when({ chain }) {
    const [ok, { selectedModels }] = chain
      .pipe(getSelectedModelsCommand, {
        types: ['block', 'text'],
        mode: 'flat',
      })
      .run();
    return ok && Boolean(selectedModels?.length);
  },
  run({ chain, store, selection, std }) {
    const [ok, { draftedModels, selectedModels }] = chain
      .pipe(getSelectedModelsCommand, {
        types: ['block', 'text'],
        mode: 'flat',
      })
      .pipe(draftSelectedModelsCommand)
      .run();
    if (!ok || !draftedModels || !selectedModels?.length) return;

    selection.clear();

    const autofill = getTitleFromSelectedModels(selectedModels);
    promptDocTitle(std, autofill)
      .then(async title => {
        if (title === null) return;
        await convertSelectedBlocksToLinkedDoc(
          std,
          store,
          draftedModels,
          title
        );
        notifyDocCreated(std, store);

        // TODO(@fundon): should optimize this scenario
        const telemetry = std.getOptional(TelemetryProvider);
        telemetry?.track('DocCreated', {
          control: 'create linked doc',
          page: 'doc editor',
          module: 'format toolbar',
          type: 'embed-linked-doc',
        });
        telemetry?.track('LinkedDocCreated', {
          control: 'create linked doc',
          page: 'doc editor',
          module: 'format toolbar',
          type: 'embed-linked-doc',
        });
      })
      .catch(console.error);
  },
} as const satisfies ToolbarAction;

export const builtinToolbarConfig = {
  actions: [
    conversionsActionGroup,
    inlineTextActionGroup,
    highlightActionGroup,
    turnIntoDatabase,
    turnIntoLinkedDoc,
    {
      id: 'a.clipboard',
      placement: ActionPlacement.More,
      actions: [
        {
          id: 'copy',
          label: 'Copy',
          icon: CopyIcon(),
          run(_cx) {},
        },
        {
          id: 'duplicate',
          label: 'Duplicate',
          icon: DuplicateIcon(),
          run(_cx) {},
        },
      ],
    },
    {
      id: 'c.delete',
      placement: ActionPlacement.More,
      actions: [
        {
          id: 'delete',
          label: 'Delete',
          icon: DeleteIcon(),
          variant: 'destructive',
          run(_cx) {},
        },
      ],
    },
  ],
} as const satisfies ToolbarModuleConfig;
