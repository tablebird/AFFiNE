import { EditorToolbar } from '@blocksuite/affine-components/toolbar';
import type {
  ToolbarActions,
  ToolbarContext,
} from '@blocksuite/affine-shared/services';
import type {
  FloatingElement,
  Placement,
  ReferenceElement,
} from '@floating-ui/dom';
import {
  // autoPlacement,
  autoUpdate,
  computePosition,
  flip,
  inline,
  offset,
  shift,
} from '@floating-ui/dom';
import groupBy from 'lodash.groupby';
import mergeWith from 'lodash.mergewith';
import toPairs from 'lodash.topairs';

export function autoUpdatePosition(
  referenceElement: ReferenceElement,
  floating: FloatingElement,
  placement: Placement = 'top-start'
  // allowedPlacements: Placement[] = ['top-start', 'bottom-start']
) {
  const update = async () => {
    const { x, y } = await computePosition(referenceElement, floating, {
      placement,
      middleware: [
        // offset(10),
        offset(50),
        inline(),
        shift({
          padding: 6,
        }),
        flip(),
        // autoPlacement({
        //   allowedPlacements,
        // }),
      ],
    });

    Object.assign(floating.style, {
      display: 'flex',
      transform: `translate3d(${x}px, ${y}px, 0)`,
    });
  };

  return autoUpdate(referenceElement, floating, () => {
    update().catch(console.error);
  });
}

export function initToolbar(
  style = {
    position: 'absolute',
    top: '0',
    left: '0',
    display: 'none',
    width: 'max-content',
    willChange: 'transform',
    zIndex: 'var(--affine-z-index-popover)',
  }
): EditorToolbar {
  const toolbar = new EditorToolbar();
  Object.assign(toolbar.style, style);
  return toolbar;
}

export function combine(actions: ToolbarActions, context: ToolbarContext) {
  const grouped = groupBy(actions, a => a.id);

  const paired = toPairs(grouped)
    .map(([_, items]) => {
      if (items.length === 1) return items;
      const [first, ...others] = items;
      if (others.length === 1) return merge({ ...first }, others[0]);
      return others.reduce(merge, { ...first });
    })
    .flat();

  const generated = paired.map(action => {
    if ('generate' in action && action.generate) {
      // TODO(@fundon): should delete `generate` fn
      return {
        ...action,
        ...action.generate(context),
      };
    }
    return action;
  });

  const filtered = generated.filter(action => {
    if (action.when) {
      if (typeof action.when === 'function') return action.when(context);
      return action.when;
    }
    return true;
  });

  return filtered;
}

const merge = (a: any, b: any) =>
  mergeWith(a, b, (obj, src) => {
    if (Array.isArray(obj)) {
      return obj.concat(src);
    }
    return src;
  });
