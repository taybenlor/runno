function seenPosition(
  position: [number, number],
  seen: Array<[number, number]>
) {
  const [x1, y1] = position;
  for (const [x2, y2] of seen) {
    const distance = Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
    const distanceInPx = (distance / 100) * window.innerWidth;
    if (distanceInPx < 20) {
      return true;
    }
  }
  return false;
}

function avoidPosition(position: [number, number]) {
  const [x, y] = position;
  //     Avoid logo            Avoid nav             Avoid title text
  return (
    (x < 30 && y < 10) ||
    (x > 80 && y < 25) ||
    (x > 20 && x < 80 && y > 15 && y < 50)
  );
}

export class StarfieldElement extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: "open" });

    this.shadowRoot!.innerHTML = `
        <style>
        :host {
            position: absolute;
            top: 0px;
            left: 0px;
            right: 0px;
            height: 100%;
            z-index: 0;
            overflow: hidden;
        }
        </style>
    `;

    const template = this.firstElementChild!;
    this.removeChild(template);

    const count = window.innerWidth / 16;

    const seen: Array<[number, number]> = [];
    for (let i = 0; i < count; i++) {
      const clone = template.cloneNode(true) as HTMLElement;
      clone.style.position = "absolute";

      let position: [number, number] = [
        Math.random() * 100,
        Math.random() * 100,
      ];
      let giveUpCount = 10;
      while (
        giveUpCount-- > 0 &&
        (avoidPosition(position) || seenPosition(position, seen))
      ) {
        position = [Math.random() * 100, Math.random() * 100];
      }
      clone.style.left = `${position[0]}%`;
      clone.style.top = `${position[1]}%`;
      this.shadowRoot?.appendChild(clone);
      seen.push(position);
    }
  }
}

customElements.define("website-starfield", StarfieldElement);
