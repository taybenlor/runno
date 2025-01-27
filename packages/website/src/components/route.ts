import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

@customElement("website-route")
export class WebsiteRoute extends LitElement {
  @property({ type: String })
  route: string = "";

  @property({ type: Object })
  meta: Record<string, string> = {};

  @state()
  location: Location = window.location;

  get routeRegex() {
    return new RegExp(this.route);
  }

  onPopState = (_: PopStateEvent) => {
    this.location = window.location;

    if (this.routeRegex.test(this.location.pathname)) {
      this.updateMeta();
    }
  };

  updateMeta() {
    for (const [key, value] of Object.entries(this.meta)) {
      document.head
        .querySelector(`meta[name="${key}"]`)
        ?.setAttribute("content", value);

      // Just use the same name/value for the Facebook Open Graph meta tags
      document.head
        .querySelector(`meta[name="og:${key}"]`)
        ?.setAttribute("content", value);

      if (key === "title") {
        document.title = value;
      }
    }
  }

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
      this.updateMeta();
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
