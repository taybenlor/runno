import { LitElement, css, unsafeCSS, CSSResultGroup } from "lit";

import maincss from "../main.css";

export class TailwindElement extends LitElement {
  static styles: CSSResultGroup = [
    css`
      ${unsafeCSS(maincss)}
    `,
  ];
}
