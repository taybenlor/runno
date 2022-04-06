import { html, css, LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import { elementCodeContent } from "./helpers";

export type StdoutMatch =
  | {
      matches: true;
    }
  | {
      matches: false;
      expected: string;
      received: string;
    };

@customElement("cs-stdout")
export class StdoutElement extends LitElement {
  static styles = css`
    :host {
      display: none;
    }
  `;

  render() {
    return html`<slot></slot>`;
  }

  get stdout() {
    return elementCodeContent(this);
  }

  matchStdout(output: string): StdoutMatch {
    // TODO: handle other kinds of matches
    //       e.g. partial and regex
    if (output.trim() == this.stdout.trim()) {
      return {
        matches: true,
      };
    }

    return {
      matches: false,
      expected: this.stdout,
      received: output,
      // TODO: include the diff to highlight?
    };
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cs-stdout": StdoutElement;
  }
}
