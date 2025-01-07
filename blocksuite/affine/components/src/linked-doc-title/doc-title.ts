import {
  PropTypes,
  requiredProperties,
  ShadowlessElement,
} from '@blocksuite/block-std';
import { css } from 'lit';
import { property } from 'lit/decorators.js';
import { html } from 'lit-html';

@requiredProperties({
  title: PropTypes.string,
  open: PropTypes.instanceOf(Function),
})
export class DocTitle extends ShadowlessElement {
  static override styles = css`
    editor-icon-button .label {
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

  @property({ attribute: false })
  override accessor title!: string;

  @property({ attribute: false })
  accessor open!: () => void;

  override render() {
    const { title, open } = this;

    return html`
      <editor-icon-button
        aria-label="Doc title"
        .hover=${false}
        .labelHeight="${'20px'}"
        .tooltip=${title}
        @click=${open}
      >
        <span class="label">${title}</span>
      </editor-icon-button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-linked-doc-title': DocTitle;
  }
}
