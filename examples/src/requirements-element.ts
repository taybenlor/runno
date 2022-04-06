import { html, css, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { CheckElement } from "./check-element";
import { Status } from "./types";

@customElement("cs-requirements")
export class RequirementsElement extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
  `;

  @property({ reflect: true })
  status: Status = "none";

  render() {
    return html`<div @cs-check=${this.handleCheck}><slot></slot></div>`;
  }

  async handleCheck() {
    const checkElements = this.querySelectorAll<CheckElement>("cs-check");
    for (const checkEl of checkElements) {
      checkEl.clearStatus();
    }

    const statuses: Status[] = [];
    for (const checkEl of checkElements) {
      const { status } = await checkEl.check();
      statuses.push(status);
    }

    if (statuses.every((s) => s == "pass")) {
      this.status = "pass";
    } else if (statuses.every((s) => s == "none")) {
      this.status = "none";
    } else {
      this.status = "fail";
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cs-requirements": RequirementsElement;
  }
}
