import { CompleteResult, RuntimeMethods } from "@runno/runtime";
import { RunElement } from "@runno/runtime";
import { html, css, LitElement, svg } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { StdinElement } from "./stdin-element";
import { StdoutElement, StdoutMatch } from "./stdout-element";
import { Status } from "./types";

class ProviderMissingError extends Error {}

type Feedback =
  | {
      message: string;
    }
  | {
      message: string;
      error: string;
    }
  | {
      message: string;
      expected: string;
      received: string;
    };

@customElement("cs-check")
export class CheckElement extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: flex-start;
      margin-bottom: 1em;
    }

    .status {
      width: 2em;
      flex-shrink: 0;
      text-transform: uppercase;
      font-weight: bold;
    }

    .test {
      flex-grow: 1;
    }

    .pass {
      color: #5ec269;
    }

    .fail {
      color: #dd524c;
    }

    .checking {
      color: #97a2b6;
    }

    .none {
      color: #97a2b6;
    }

    .feedback {
      background: #f2f5f9;
      padding: 1em;
    }

    .comparison {
      display: flex;
      margin-top: 1em;
    }

    .expected {
      flex-grow: 1;
      margin-top: 0;
    }

    .received {
      margin-left: 1em;
      flex-grow: 1;
    }

    pre {
      font-size: 14px;
      background: black;
      color: white;
      padding: 0.5em 0.75em;
      border-radius: 0.25em;
      overflow-x: auto;
    }

    p {
      margin: 0;
    }

    svg {
      margin-top: 4px;
      width: 1.2em;
    }

    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }
    .spin {
      animation: 1s linear infinite spin;
      animation-play-state: inherit;
      will-change: transform;
    }
  `;

  @property()
  for?: string;

  @property()
  status: Status = "none";

  @state()
  feedback?: Feedback;

  render() {
    // TODO: Replace status with icon
    return html`
      <div class="status ${this.status}">${this.renderStatus()}</div>
      <div class="test">
        <slot></slot>
        ${this.renderFeedback()}
      </div>
    `;
  }

  renderStatus() {
    if (this.status == "pass") {
      return svg`
        <svg aria-hidden="true" focusable="false" data-prefix="far" data-icon="check-square" class="svg-inline--fa fa-check-square fa-w-14" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M400 32H48C21.49 32 0 53.49 0 80v352c0 26.51 21.49 48 48 48h352c26.51 0 48-21.49 48-48V80c0-26.51-21.49-48-48-48zm0 400H48V80h352v352zm-35.864-241.724L191.547 361.48c-4.705 4.667-12.303 4.637-16.97-.068l-90.781-91.516c-4.667-4.705-4.637-12.303.069-16.971l22.719-22.536c4.705-4.667 12.303-4.637 16.97.069l59.792 60.277 141.352-140.216c4.705-4.667 12.303-4.637 16.97.068l22.536 22.718c4.667 4.706 4.637 12.304-.068 16.971z"></path></svg>
      `;
    } else if (this.status == "fail") {
      return svg`
        <svg aria-hidden="true" focusable="false" data-prefix="far" data-icon="caret-square-down" class="svg-inline--fa fa-caret-square-down fa-w-14" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M125.1 208h197.8c10.7 0 16.1 13 8.5 20.5l-98.9 98.3c-4.7 4.7-12.2 4.7-16.9 0l-98.9-98.3c-7.7-7.5-2.3-20.5 8.4-20.5zM448 80v352c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V80c0-26.5 21.5-48 48-48h352c26.5 0 48 21.5 48 48zm-48 346V86c0-3.3-2.7-6-6-6H54c-3.3 0-6 2.7-6 6v340c0 3.3 2.7 6 6 6h340c3.3 0 6-2.7 6-6z"></path></svg>
      `;
    } else if (this.status == "checking") {
      return svg`
        <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="circle-notch" class="spin svg-inline--fa fa-circle-notch fa-w-16" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M288 39.056v16.659c0 10.804 7.281 20.159 17.686 23.066C383.204 100.434 440 171.518 440 256c0 101.689-82.295 184-184 184-101.689 0-184-82.295-184-184 0-84.47 56.786-155.564 134.312-177.219C216.719 75.874 224 66.517 224 55.712V39.064c0-15.709-14.834-27.153-30.046-23.234C86.603 43.482 7.394 141.206 8.003 257.332c.72 137.052 111.477 246.956 248.531 246.667C393.255 503.711 504 392.788 504 256c0-115.633-79.14-212.779-186.211-240.236C302.678 11.889 288 23.456 288 39.056z"></path></svg>
      `;
    } else {
      return svg`
        <svg aria-hidden="true" focusable="false" data-prefix="far" data-icon="square" class="svg-inline--fa fa-square fa-w-14" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M400 32H48C21.5 32 0 53.5 0 80v352c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48V80c0-26.5-21.5-48-48-48zm-6 400H54c-3.3 0-6-2.7-6-6V86c0-3.3 2.7-6 6-6h340c3.3 0 6 2.7 6 6v340c0 3.3-2.7 6-6 6z"></path></svg>
      `;
    }
  }

  renderFeedback() {
    if (!this.feedback) {
      return null;
    }

    if ("error" in this.feedback) {
      return html`
        <div class="feedback">
          <p class="message">${this.feedback.message}</p>
          <pre>${this.feedback.error}</pre>
        </div>
      `;
    }

    if ("received" in this.feedback) {
      return html`
        <div class="feedback">
          <p class="message">${this.feedback.message}</p>
          <div class="comparison">
            <div class="expected">
              <p>
                <strong>We expected to see:</strong>
              </p>
              <pre>${this.feedback.expected}</pre>
            </div>
            <div class="received">
              <p>
                <strong>You printed out:</strong>
              </p>
              <pre>${this.feedback.received}</pre>
            </div>
          </div>
        </div>
      `;
    }

    return html` <div class="feedback">
      <p class="message">${this.feedback.message}</p>
    </div>`;
  }

  getStdin() {
    let stdin = undefined;
    const stdinEl = this.querySelector<StdinElement>("cs-stdin");
    if (stdinEl) {
      stdin = stdinEl.stdin;
    }
    return stdin;
  }

  matchStdout(result: CompleteResult): StdoutMatch {
    const stdoutEl = this.querySelector<StdoutElement>("cs-stdout");
    if (!stdoutEl) {
      return {
        matches: true,
      };
    }

    return stdoutEl.matchStdout(result.stdout);
  }

  clearStatus() {
    this.status = "none";
    this.feedback = undefined;
  }

  async check(provider?: RuntimeMethods) {
    if (this.for) {
      provider = document.getElementById(this.for) as RunElement;
    }

    if (!provider) {
      throw new ProviderMissingError(
        `Check element has no runtime provider, for=${this.for}`
      );
    }

    this.status = "checking";

    const program = await provider.getEditorProgram();
    const stdin = this.getStdin() + "\n";
    const result = await provider.headlessRunCode("python", program, stdin);

    if (result.resultType === "crash") {
      this.status = "none";
      this.feedback = {
        message: "There was a system error running your program.",
      };

      return {
        status: this.status,
        result,
      };
    } else if (result.resultType === "terminated") {
      this.status = "none";
      this.feedback = {
        message: "Your program was terminated early.",
      };

      return {
        status: this.status,
        result,
      };
    } else if (result.exitCode != 0) {
      this.status = "fail";
      this.feedback = {
        message: "Your program had an error.",
        error: result.tty,
      };

      return {
        status: this.status,
        result,
      };
    }

    const stdoutMatch = this.matchStdout(result);

    if (stdoutMatch.matches) {
      this.status = "pass";

      return {
        status: this.status,
        result,
      };
    }

    this.status = "fail";
    this.feedback = {
      // TODO: Add ability to customise this message (prop?)
      message: "Your output didn't match what we expected.",
      expected: stdoutMatch.expected,
      received: stdoutMatch.received,
    };

    return {
      status: this.status,
      result,
    };
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cs-check": CheckElement;
  }
}
