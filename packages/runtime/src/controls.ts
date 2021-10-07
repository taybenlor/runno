import { html, css, LitElement } from "lit";
import { property } from "lit/decorators.js";

export class ControlsElement extends LitElement {
  static styles = css`
    :host {
      display: block;
      background: white;
    }

    #run {
      font-size: 16px;
      font-family: monospace;
      background: #ffe234;
      border: none;
      color: black;
      padding: 8px;
      margin: 8px;
      display: inline-flex;
      align-items: center;
      height: 36px;
    }

    #run svg {
      margin-left: 8px;
    }

    #stop {
      font-size: 16px;
      font-family: monospace;
      border: none;
      background: #d0d0d0;
      color: black;
      padding: 0px;
      margin: 8px;
      display: inline-flex;
      align-items: center;
      height: 36px;
    }

    #stop span {
      padding: 0 8px;
    }

    #stop svg {
      padding: 0 8px;
      background: #ff3449;
      height: 36px;
    }
  `;

  @property({ type: Boolean }) running: boolean = false;

  run() {
    const event = new Event("runno-run", {
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  stop() {
    const event = new Event("runno-stop", {
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  render() {
    if (this.running) {
      return html`
        <button id="stop" @click=${this.stop}>
          <span>Running&hellip;</span>
          <svg
            width="13px"
            height="13px"
            viewBox="0 0 13 13"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
          >
            <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
              <line
                x1="1"
                y1="1"
                x2="12"
                y2="12"
                id="Path-21"
                stroke="#FFFFFF"
              ></line>
              <line
                x1="1"
                y1="1"
                x2="12"
                y2="12"
                id="Path-21"
                stroke="#FFFFFF"
                transform="translate(6.500000, 6.500000) scale(1, -1) translate(-6.500000, -6.500000) "
              ></line>
            </g>
          </svg>
        </button>
      `;
    } else {
      return html`
        <button id="run" @click=${this.run}>
          <span>Run</span>
          <svg
            width="13px"
            height="18px"
            viewBox="0 0 13 18"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
          >
            <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
              <polyline
                stroke="#000000"
                points="3.33556662 14.65592 0.5 17 0.5 1 3.33556662 2.80955051"
              ></polyline>
              <polyline
                stroke="#000000"
                points="6.5 12.6288197 12 8.14251005 6.5 4.53125876"
              ></polyline>
            </g>
          </svg>
        </button>
      `;
    }
  }
}
