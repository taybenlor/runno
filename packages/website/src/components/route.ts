import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

@customElement("website-route")
export class WebsiteRoute extends LitElement {
  @property({ type: String })
  route: string = "";

  @state()
  location: Location = window.location;

  get routeRegex() {
    return new RegExp(this.route);
  }

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
    if (this.routeRegex.test(this.location.pathname)) {
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
