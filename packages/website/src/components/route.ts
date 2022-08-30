import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

@customElement("website-route")
export class WebsiteRoute extends LitElement {
  @property({ type: String })
  route: string = "";

  @state()
  location: Location = window.location;

  onPopState = (_: PopStateEvent) => {
    this.location = window.location;
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("popstate", this.onPopState);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("popstate", this.onPopState);
  }

  render() {
    if (this.location.pathname === this.route) {
      return html`<slot></slot>`;
    }
    return html``;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "website-route": WebsiteRoute;
  }
}
