import { BlockSelection, type BlockStdScope } from '@blocksuite/block-std';
import type {
  Block,
  PropsGetter,
  SchemaToModel,
  SelectionConstructor,
} from '@blocksuite/store';
import type { Signal } from '@preact/signals-core';

import { DocModeProvider } from '../doc-mode-service';
import { ThemeProvider } from '../theme-service';

abstract class ToolbarContextBase {
  constructor(
    readonly std: BlockStdScope,
    readonly flags$: Signal<number>
  ) {}

  get command() {
    return this.std.command;
  }

  get chain() {
    return this.command.chain();
  }

  get doc() {
    return this.store.doc;
  }

  get workspace() {
    return this.std.workspace;
  }

  get host() {
    return this.std.host;
  }

  get clipboard() {
    return this.std.clipboard;
  }

  get selection() {
    return this.std.selection;
  }

  get store() {
    return this.std.store;
  }

  get view() {
    return this.std.view;
  }

  get readonly() {
    return this.store.readonly;
  }

  get docModeProvider() {
    return this.std.get(DocModeProvider);
  }

  get editorMode() {
    return this.docModeProvider.getEditorMode() ?? 'page';
  }

  get isPageMode() {
    return this.editorMode === 'page';
  }

  get isEdgelessMode() {
    return this.editorMode === 'edgeless';
  }

  get themeProvider() {
    return this.std.get(ThemeProvider);
  }

  get theme() {
    return this.themeProvider.theme;
  }

  getCurrentBlockBy<T extends SelectionConstructor>(type: T): Block | null {
    const selection = this.selection.find(type ?? BlockSelection);
    return (selection && this.store.getBlock(selection.blockId)) ?? null;
  }

  getCurrentBlockModelBy<
    T extends SelectionConstructor,
    S extends {
      model: {
        props: PropsGetter<object>;
        flavour: string;
      };
    },
  >(type: T, schema: S) {
    const block = this.getCurrentBlockBy<T>(type);
    return block?.model.flavour === schema.model.flavour
      ? (block.model as SchemaToModel<S>)
      : null;
  }

  getCurrentBlockComponentBy<
    T extends SelectionConstructor,
    K extends abstract new (...args: any) => any,
  >(type: T, klass: K): InstanceType<K> | null {
    const block = this.getCurrentBlockBy<T>(type);
    const component = block && this.view.getBlock(block.id);
    return component instanceof klass ? (component as InstanceType<K>) : null;
  }

  show() {
    this.flags$.value &= ~0b100000;
  }

  hide() {
    this.flags$.value |= 0b100000;
  }
}

export class ToolbarContext extends ToolbarContextBase {}
