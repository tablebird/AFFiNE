import {
  type EditorToolbar,
  renderToolbarSeparator,
} from '@blocksuite/affine-components/toolbar';
import {
  ActionPlacement,
  type ToolbarAction,
  type ToolbarActions,
  type ToolbarContext,
  type ToolbarModuleConfig,
  ToolbarRegistryIdentifier,
  ToolbarRegistryScope,
} from '@blocksuite/affine-shared/services';
import type { BlockStdScope } from '@blocksuite/block-std';
import { MoreVerticalIcon } from '@blocksuite/icons/lit';
import { html, render, type TemplateResult } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { join } from 'lit/directives/join.js';
import { repeat } from 'lit/directives/repeat.js';
import orderBy from 'lodash.orderby';
import partition from 'lodash.partition';

import { combine } from './utils';

// A Renderer
export class Renderer {
  get toolbarRegistry() {
    const { container, provider } = this.std;
    return container
      .provider(ToolbarRegistryScope, provider)
      .get(ToolbarRegistryIdentifier);
  }

  constructor(
    readonly std: BlockStdScope,
    readonly context: ToolbarContext,
    readonly toolbar: EditorToolbar,
    readonly flavour: string
  ) {}

  render() {
    const { context, toolbar, toolbarRegistry, flavour } = this;

    // Merges the following configs:
    // 1. `affine:note`
    // 2. `custom:affine:note`
    // 3. `affine:*`
    // 4. `custom:affine:*`
    const module = toolbarRegistry.modules.get(flavour);
    if (!module) return;
    const customModule = toolbarRegistry.modules.get(`custom:${flavour}`);
    const customWildcardModule = toolbarRegistry.modules.get(`custom:affine:*`);
    const config = module.config satisfies ToolbarModuleConfig;
    const customConfig = (customModule?.config ?? {
      actions: [],
    }) satisfies ToolbarModuleConfig;
    const customWildcardConfig = (customWildcardModule?.config ?? {
      actions: [],
    }) satisfies ToolbarModuleConfig;

    const combined = combine(
      [
        ...config.actions,
        ...customConfig.actions,
        ...customWildcardConfig.actions,
      ],
      context
    );

    const ordered = orderBy(
      combined,
      ['placement', 'id', 'score'],
      ['asc', 'asc', 'asc']
    );

    const [moreActionGroup, primaryActionGroup] = partition(
      ordered,
      a => a.placement === ActionPlacement.More
    );

    if (moreActionGroup.length) {
      const moreMenuItems = renderActions(
        moreActionGroup,
        context,
        renderMenuActionItem
      );
      moreMenuItems.length &&
        primaryActionGroup.push({
          id: 'more',
          content: html`
            <editor-menu-button
              .contentPadding="${'8px'}"
              .button=${html`
                <editor-icon-button aria-label="More" .tooltip="${'More'}">
                  ${MoreVerticalIcon()}
                </editor-icon-button>
              `}
            >
              <div data-size="large" data-orientation="vertical">
                ${join(moreMenuItems, () =>
                  renderToolbarSeparator('horizontal')
                )}
              </div>
            </editor-menu-button>
          `,
        });
    }

    render(
      join(renderActions(primaryActionGroup, context), () =>
        renderToolbarSeparator()
      ),
      toolbar
    );
  }
}

function renderActions(
  actions: ToolbarActions,
  context: ToolbarContext,
  render = renderActionItem
) {
  return actions
    .map(action => {
      let content: TemplateResult | null = null;
      if ('content' in action && action.content) {
        if (typeof action.content === 'function') {
          content = action.content(context);
        } else {
          content = action.content;
        }
        return content;
      }

      if ('actions' in action && action.actions.length) {
        const combined = combine(action.actions, context);

        if (!combined.length) return content;

        const ordered = orderBy(combined, ['score', 'id'], ['asc', 'asc']);

        return repeat(
          ordered,
          b => b.id,
          b => render(b, context)
        );
      }

      if ('run' in action && action.run) {
        return render(action, context);
      }

      return content;
    })
    .filter(action => action !== null);
}

// TODO(@fundon): supports templates
function renderActionItem(action: ToolbarAction, context: ToolbarContext) {
  return html`
    <editor-icon-button
      data-testid=${action.id}
      ?active=${typeof action.active === 'function'
        ? action.active(context)
        : action.active}
      .tooltip=${action.tooltip}
      @click=${(event: MouseEvent) => {
        event.stopPropagation();
        action.run?.(context);
      }}
    >
      ${action.icon}
      ${action.label ? html`<span class="label">${action.label}</span>` : null}
    </editor-icon-button>
  `;
}

function renderMenuActionItem(action: ToolbarAction, context: ToolbarContext) {
  return html`
    <editor-menu-action
      data-testid=${action.id}
      class="${ifDefined(
        action.variant === 'destructive' ? 'delete' : undefined
      )}"
      ?active=${typeof action.active === 'function'
        ? action.active(context)
        : action.active}
      .tooltip=${ifDefined(action.tooltip)}
      @click=${() => action.run?.(context)}
    >
      ${action.icon}
      ${action.label ? html`<span class="label">${action.label}</span>` : null}
    </editor-menu-action>
  `;
}
