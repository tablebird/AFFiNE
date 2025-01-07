import { DatabaseSelection } from '@blocksuite/affine-block-database';
import {
  getBlockSelectionsCommand,
  getSelectedBlocksCommand,
} from '@blocksuite/affine-shared/commands';
import {
  ToolbarContext,
  ToolbarRegistryIdentifier,
  ToolbarRegistryScope,
} from '@blocksuite/affine-shared/services';
import { matchFlavours } from '@blocksuite/affine-shared/utils';
import {
  BlockSelection,
  SurfaceSelection,
  TextSelection,
  WidgetComponent,
} from '@blocksuite/block-std';
import { Bound, getCommonBound, throttle } from '@blocksuite/global/utils';
import type { Placement, ReferenceElement } from '@floating-ui/dom';
import { batch, effect, signal } from '@preact/signals-core';

import { Renderer } from './renderer';
import { autoUpdatePosition, initToolbar } from './utils';

enum Flag {
  Surface = 0b1,
  Block = 0b10,
  Text = 0b100,
  Native = 0b1000,
  // Hovering something, e.g. inline links
  Hovering = 0b10000,
  // Dragging something or opening modal, e.g. drag handle, drag resources from outside, bookmark rename modal
  Hiding = 0b100000,
}

export const AFFINE_TOOLBAR_WIDGET = 'affine-toolbar-widget';

export class AffineToolbarWidget extends WidgetComponent {
  range$ = signal<Range | null>(null);

  flavour$ = signal('affine:note');

  flags$ = signal(0b000000);

  toggleWith(flag: Flag, activated: boolean) {
    if (activated) {
      this.flags$.value |= flag;
      return;
    }
    this.flags$.value &= ~flag;
  }

  checkWith(flag: Flag, value = this.flags$.peek()) {
    return (value & flag) === flag;
  }

  containsWith(flag: number, value = this.flags$.peek()) {
    return (value & flag) !== 0;
  }

  refreshWith(flag: Flag) {
    batch(() => {
      this.toggleWith(flag, false);
      this.toggleWith(flag, true);
    });
  }

  toolbar = initToolbar();

  get toolbarRegistry() {
    const { container, provider } = this.std;
    return container
      .provider(ToolbarRegistryScope, provider)
      .get(ToolbarRegistryIdentifier);
  }

  override connectedCallback() {
    super.connectedCallback();

    const {
      flags$,
      flavour$,
      range$,
      disposables,
      toolbar,
      toolbarRegistry,
      host,
      std,
    } = this;
    const context = new ToolbarContext(std, flags$);

    // TODO(@fundon): fix toolbar position shaking when the wheel scrolls
    // document.body.append(toolbar);
    this.shadowRoot!.append(toolbar);

    disposables.add(
      effect(() => {
        const value = flags$.value;
        const flavour = flavour$.value;
        if (this.containsWith(Flag.Hovering | Flag.Hiding, value)) return;
        if (!this.containsWith(Flag.Text | Flag.Native | Flag.Block, value))
          return;

        let virtualEl: ReferenceElement | null = null;

        if (this.checkWith(Flag.Block, value)) {
          const [ok, { selectedBlocks }] = context.chain
            .pipe(getBlockSelectionsCommand)
            .pipe(getSelectedBlocksCommand, { types: ['block'] })
            .run();

          if (!ok || !selectedBlocks?.length) return;

          virtualEl = {
            getBoundingClientRect: () => {
              const rects = selectedBlocks.map(e => e.getBoundingClientRect());
              const bounds = getCommonBound(rects.map(Bound.fromDOMRect));
              if (!bounds) return rects[0];
              return new DOMRect(bounds.x, bounds.y, bounds.w, bounds.h);
            },
            getClientRects: () =>
              selectedBlocks.map(e => e.getBoundingClientRect()),
          };
        } else {
          const range = range$.value;
          if (!range) return;

          virtualEl = {
            getBoundingClientRect: () => range.getBoundingClientRect(),
            getClientRects: () => range.getClientRects(),
          };
        }

        if (!virtualEl) return;

        // TODO(@fundon): improves here
        const isNote = flavour === 'affine:note';
        const placement = isNote ? ('top' as Placement) : undefined;
        // const allowedPlacements = isNote
        //   ? (['top', 'bottom'] as Placement[])
        //   : undefined;

        return autoUpdatePosition(
          virtualEl,
          toolbar,
          placement
          // allowedPlacements
        );
      })
    );

    // Formatting
    // Selects text in note.
    disposables.add(
      std.selection.find$(TextSelection).subscribe(result => {
        const activated = Boolean(
          result &&
            !result.isCollapsed() &&
            result.from.length + (result.to?.length ?? 0)
        );
        this.toggleWith(Flag.Text, activated);
      })
    );

    // Formatting
    // Selects `native` text in database's cell.
    disposables.addFromEvent(document, 'selectionchange', () => {
      if (!host.event.active) return;

      let activated = false;
      let range = std.range.value ?? null;
      const valid = Boolean(range && !range.collapsed);

      if (valid) {
        const result = std.selection.find(DatabaseSelection);
        const viewSelection = result?.viewSelection;

        activated = Boolean(
          viewSelection &&
            ((viewSelection.selectionType === 'area' &&
              viewSelection.isEditing) ||
              (viewSelection.selectionType === 'cell' &&
                viewSelection.isEditing))
        );
      }

      batch(() => {
        range$.value = valid ? range : null;
        this.toggleWith(Flag.Native, activated);

        if (activated) {
          flavour$.value = 'affine:note';

          this.refreshWith(Flag.Native);
          return;
        }

        if (!this.checkWith(Flag.Text)) return;

        this.refreshWith(Flag.Text);
      });
    });

    // Selects blocks in note.
    disposables.add(
      std.selection.filter$(BlockSelection).subscribe(result => {
        const count = result.length;
        let flavour = 'affine:note';
        let activated = Boolean(count);

        if (activated) {
          // Handles a signal block.
          const block = count === 1 && std.store.getBlock(result[0].blockId);

          // Chencks if block's config exists.
          if (block) {
            const modelFlavour = block.model.flavour;
            const existed =
              toolbarRegistry.modules.has(modelFlavour) ||
              toolbarRegistry.modules.has(`custom:${modelFlavour}`);
            if (existed) {
              flavour = modelFlavour;
            } else {
              activated = matchFlavours(block.model, [
                'affine:paragraph',
                'affine:list',
                'affine:code',
                'affine:image',
              ]);
            }
          }
        }

        batch(() => {
          flavour$.value = flavour;

          this.toggleWith(Flag.Block, activated);

          if (!activated) return;

          this.refreshWith(Flag.Block);
        });
      })
    );

    // Selects elements in edgeless.
    // Triggered only when not in editing state.
    disposables.add(
      std.selection.filter$(SurfaceSelection).subscribe(result => {
        const activated =
          Boolean(result.length) && !result.some(e => e.editing);
        this.toggleWith(Flag.Surface, activated);
      })
    );

    disposables.add(
      std.selection.slots.changed.on(() => {
        const value = flags$.peek();
        if (this.containsWith(Flag.Hovering | Flag.Hiding, value)) return;

        if (!this.checkWith(Flag.Text)) return;

        // refresh
        this.refreshWith(Flag.Text);
      })
    );

    // TODO(@fundon): improve these cases
    disposables.add(
      std.store.slots.blockUpdated.on(record => {
        if (record.type === 'delete') {
          flags$.value = 0;
          return;
        }
      })
    );

    // Handles `drag and drop`
    const dragStart = () => this.toggleWith(Flag.Hiding, true);
    const dragEnd = () => this.toggleWith(Flag.Hiding, false);
    const dragOptions = { global: true };
    const eventOptions = { passive: false };
    this.handleEvent('dragStart', dragStart, dragOptions);
    this.handleEvent('dragEnd', dragEnd, dragOptions);
    this.handleEvent('nativeDrop', dragEnd, dragOptions);
    disposables.addFromEvent(host, 'dragenter', dragStart, eventOptions);
    disposables.addFromEvent(
      host,
      'dragleave',
      throttle(
        event => {
          const { x, y, target } = event;
          if (target === this) return;
          const rect = host.getBoundingClientRect();
          if (
            x >= rect.left &&
            y >= rect.top &&
            x <= rect.bottom &&
            y <= rect.right
          )
            return;
          dragEnd();
        },
        144,
        { trailing: true }
      ),
      eventOptions
    );

    disposables.add(
      flags$.subscribe(value => {
        console.log('flags', value);
        // Hides toolbar
        if (value === 0) {
          console.log('hide toolbar');
          toolbar.style.display = 'none';
          return;
        }

        // Hides toolbar
        if (this.checkWith(Flag.Hiding, value)) {
          console.log('hiding');
          toolbar.style.display = 'none';
          return;
        }

        // Shows toolbar of inline links
        if (this.checkWith(Flag.Hovering, value)) {
          console.log('hovering');
          return;
        }

        // Shows `format-bar`
        // *   text: note
        // * native: database
        if (this.containsWith(Flag.Text | Flag.Native, value)) {
          console.log('show formatting toolbar in note');
          new Renderer(std, context, toolbar, flavour$.peek()).render();
          return;
        }

        // Shows normal toolbar in note
        if (this.checkWith(Flag.Block, value)) {
          console.log('show normal toolbar in note');
          new Renderer(std, context, toolbar, flavour$.peek()).render();
          return;
        }

        // Shows toolbar in edgeles
        console.log('show toolbar in edgeless');
      })
    );
  }
}
