function pageOffset(element: Element | HTMLElement): number {
  if (!(element instanceof HTMLElement)) {
    return 0;
  }

  return (
    element.offsetTop +
    (element.offsetParent ? pageOffset(element.offsetParent) : 0)
  );
}

// TODO: Jumping to links by id doesn't work through the Shadow DOM boundary

export class ScrollHighlightElement extends HTMLElement {
  highlighted?: HTMLAnchorElement = undefined;

  connectedCallback() {
    document.addEventListener("scroll", this.onScroll);
  }

  disconnectedCallback() {
    document.removeEventListener("scroll", this.onScroll);
  }

  onScroll = () => {
    this.highlighted?.classList.remove("text-pink");

    const scrollOffset = window.scrollY;
    const headings = (
      this.getRootNode() as HTMLElement
    ).querySelectorAll<HTMLHeadingElement>("h1,h2");
    let topHeading: HTMLHeadingElement | undefined = undefined;
    for (const heading of Array.from(headings)) {
      const offset = pageOffset(heading);
      if (offset > scrollOffset + window.innerHeight / 2) {
        break;
      }
      topHeading = heading;
    }

    if (!topHeading) {
      return;
    }

    const newHighlight = this.querySelector<HTMLAnchorElement>(
      `a[href="#${topHeading.id}"]`
    );
    if (!newHighlight) {
      return;
    }

    this.highlighted = newHighlight;
    this.highlighted.classList.add("text-pink");
  };
}

customElements.define("runno-scroll-highlight", ScrollHighlightElement);
declare global {
  interface HTMLElementTagNameMap {
    "runno-scroll-highlight": ScrollHighlightElement;
  }
}
