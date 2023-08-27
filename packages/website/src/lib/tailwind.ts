import { LitElement, css, unsafeCSS, CSSResultArray } from "lit";

import maincss from "../main.css?inline";

export class TailwindElement extends LitElement {
  static styles: CSSResultArray = [
    css`
      ${unsafeCSS(maincss)}
    `,
  ];
}
