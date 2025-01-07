import { ViewDropdown } from './dropdown';

export * from './dropdown';

export function effects() {
  customElements.define('affine-view-dropdown', ViewDropdown);
}
