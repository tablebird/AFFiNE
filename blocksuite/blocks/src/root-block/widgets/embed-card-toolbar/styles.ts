import { css } from 'lit';

export const embedCardToolbarStyle = css`
  :host {
    position: absolute;
    top: 0;
    left: 0;
    z-index: var(--affine-z-index-popover);
  }

  .card-style-select icon-button.selected {
    border: 1px solid var(--affine-brand-color);
  }

  editor-icon-button.doc-title .label {
    max-width: 110px;
    display: inline-block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    user-select: none;
    cursor: pointer;
    color: var(--affine-link-color);
    font-feature-settings:
      'clig' off,
      'liga' off;
    font-family: var(--affine-font-family);
    font-size: var(--affine-font-sm);
    font-style: normal;
    font-weight: 400;
    text-decoration: none;
    text-wrap: nowrap;
  }
`;
