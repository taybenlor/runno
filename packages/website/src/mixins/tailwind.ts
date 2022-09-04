import { LitElement, css, unsafeCSS } from "lit";

import maincss from "../main.css";

export class TailwindElement extends LitElement {
  static styles = css`
    ${unsafeCSS(maincss)}
  `;
}
