import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { Tailwind } from "../mixins/tailwind";

@customElement("page-playground")
export class PagePlayground extends Tailwind(LitElement) {
  render() {
    return html`
      <div class="flex flex-wrap container mx-auto my-16 relative">
        <div>
          <h2>Command</h2>
          <form>
            $
            <select>
              <option value="">some-binary</option>
            </select>
            <input type="text" placeholder="args" />
            <button>Run</button>
          </form>
          <pre><!-- TODO: Put an XTerm here --></pre>
        </div>
        <div>
          <h2>Files</h2>
          <ul>
            <!-- TODO: list of files -->
          </ul>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "page-playground": PagePlayground;
  }
}
