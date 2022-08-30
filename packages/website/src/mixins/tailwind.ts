import { LitElement } from "lit";

export const Tailwind = (superClass: typeof LitElement) => {
  return class TailwindElement extends superClass {
    connectedCallback() {
      super.connectedCallback();

      // TODO: Figure out a way to do this using constructable style sheets
      // See: https://web.dev/constructable-stylesheets/
      const styleTag = document.head.querySelector("style")?.cloneNode(true);
      if (styleTag) {
        this.shadowRoot!.append(styleTag);
      }
    }
  };
};
