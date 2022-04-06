import { html, css, LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import { elementCodeContent } from "./helpers";

@customElement("cs-stdin")
export class StdinElement extends LitElement {
  static styles = css`
    :host {
      display: none;
    }
  `;

  render() {
    return html`<slot></slot>`;
  }

  get stdin() {
    return elementCodeContent(this);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cs-stdin": StdinElement;
  }
}
