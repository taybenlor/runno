import { html, css, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("cs-trigger")
export class TriggerElement extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
    }
  `;

  @property({ reflect: true })
  event: string = "check";

  render() {
    return html`<slot></slot>`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("click", this._dispatchEvent);
  }

  disconnectedCallback(): void {
    super.connectedCallback();
    this.removeEventListener("click", this._dispatchEvent);
  }

  _dispatchEvent() {
    this.dispatchEvent(
      new CustomEvent(`cs-${this.event}`, {
        bubbles: true,
        composed: true,
      })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cs-trigger": TriggerElement;
  }
}
