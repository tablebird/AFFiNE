import type { ToolbarActions } from './action';

export type ToolbarModuleConfig = {
  actions: ToolbarActions;

  // https://floating-ui.com/docs/computePosition#placement
  placement?: 'top' | 'top-start';
  // https://floating-ui.com/docs/autoPlacement#allowedplacements
  allowedPlacements?: ['top', 'bottom'] | ['top-start' | 'bottom-start'];
};
