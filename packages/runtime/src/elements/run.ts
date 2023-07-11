import type { RunResult, Runtime, RuntimeMethods, Syntax } from "@runno/host";

import { RUNTIMES, SYNTAXES } from "@runno/host";
import { WASIFS } from "@runno/wasi";
import { fetchWASIFS } from "../helpers";
import { FileElement } from "./file";
import { ControlsElement } from "./controls";
import { EditorElement } from "./editor";
import { TerminalElement } from "./terminal";
import { RunnoProvider } from "../provider";

const ATTRIBUTE_MAP = {
  runtime: "runtime",
  syntax: "syntax",
  code: "code",
  "fs-url": "fsURL",
  editor: "editor",
  controls: "controls",
  autorun: "autorun",
} as const;

const BOOLEAN_ATTRIBUTES = ["controls", "autorun", "editor"];

type BooleanAttribute = "controls" | "autorun" | "editor";

function isBooleanAttribute(key: string): key is BooleanAttribute {
  return BOOLEAN_ATTRIBUTES.includes(key);
}

function isRuntime(value: string): value is Runtime {
  return RUNTIMES.includes(value as Runtime);
}

function isSyntax(value: string): value is Syntax {
  return SYNTAXES.includes(value as Syntax);
}

export class RunElement extends HTMLElement {
  static get observedAttributes() {
    return Object.keys(ATTRIBUTE_MAP);
  }

  private _runtime?: Runtime;
  private _syntax?: Syntax;
  private _code?: string;
  fs: WASIFS = {};
  fsURL?: string;

  // Boolean controls
  _editor: boolean = false;
  _controls: boolean = false;
  autorun: boolean = false;

  private hasRun = false;
  private _running = false;
  private _provider!: RuntimeMethods;

  get running() {
    return this._running;
  }

  private set running(value: boolean) {
    this._running = value;

    const el =
      this.shadowRoot!.querySelector<ControlsElement>("runno-controls");

    if (value) {
      el?.removeAttribute("running");
    } else {
      el?.setAttribute("running", "");
    }
  }

  get controls() {
    return this._controls;
  }

  set controls(value: boolean) {
    this._controls = value;

    const el =
      this.shadowRoot!.querySelector<ControlsElement>("runno-controls");

    if (value) {
      el?.removeAttribute("hidden");
    } else {
      el?.setAttribute("hidden", "");
    }
  }

  get editor() {
    return this._editor;
  }

  set editor(value: boolean) {
    this._editor = value;

    const el = this.shadowRoot!.querySelector<EditorElement>("runno-editor");

    if (value) {
      el?.removeAttribute("hidden");
    } else {
      el?.setAttribute("hidden", "");
    }
  }

  get runtime() {
    return this._runtime;
  }

  set runtime(value: Runtime | undefined) {
    this._runtime = value;
    this.shadowRoot!.querySelector<EditorElement>("runno-editor")!.runtime =
      value;
  }

  get syntax() {
    return this._syntax;
  }

  set syntax(value: Syntax | undefined) {
    this._syntax = value;
    this.shadowRoot!.querySelector<EditorElement>("runno-editor")!.syntax =
      value;
  }

  get code() {
    return this._code;
  }

  set code(value: string | undefined) {
    this._code = value;
    this.shadowRoot!.querySelector<EditorElement>("runno-editor")!.code = value;
  }

  constructor() {
    super();

    this.attachShadow({ mode: "open" });
    this.shadowRoot!.innerHTML = `
    <style>
      :host {
        display: flex;
        flex-direction: column;
        min-height: 140px;
      }
  
      runno-editor {
        background: white;
        color: black;
        height: var(--runno-editor-height, auto);
        max-height: var(--runno-editor-max-height, 60%);
      }
  
      runno-controls {
        flex-shrink: 0;
      }
  
      runno-terminal {
        background: black;
        flex-grow: 1;
        height: var(--runno-terminal-height, auto);
        min-height: var(--runno-terminal-min-height, 4rem);
      }
    </style>
    <runno-editor hidden></runno-editor>
    <runno-controls hidden></runno-controls>
    <runno-terminal></runno-terminal>
    <pre hidden><slot></slot></pre>
    `;
  }

  //
  // Public Helpers
  //

  public async run(): Promise<RunResult> {
    const editor =
      this.shadowRoot!.querySelector<EditorElement>("runno-editor")!;
    if (!editor.runtime) {
      throw new Error("The editor has no runtime");
    }

    this.running = true;

    let fs: WASIFS = this.fs;

    if (this.fsURL) {
      const baseFS = await fetchWASIFS(this.fsURL);
      fs = { ...baseFS, ...fs };
    }

    const fileElements = Array.from(
      this.querySelectorAll<FileElement>("runno-file")
    );
    const files = await Promise.all(fileElements.map((f) => f.getFile()));
    for (const file of files) {
      fs[file.path] = file;
    }

    fs = {
      ...fs,
      "/program": {
        path: "program",
        content: editor.program,
        mode: "string",
        timestamps: {
          access: new Date(),
          modification: new Date(),
          change: new Date(),
        },
      },
    };

    return this.interactiveRunFS(editor.runtime, "/program", fs);
  }

  //
  // Lifecycle Methods
  //

  connectedCallback() {
    this.addEventListener("runno-run", this.onRunEvent);
    this.addEventListener("runno-stop", this.onStopEvent);

    this._provider = new RunnoProvider(
      this.shadowRoot!.querySelector<TerminalElement>("runno-terminal")!,
      this.shadowRoot!.querySelector<EditorElement>("runno-editor")!
    );
  }

  disconnectedCallback() {
    this.removeEventListener("runno-run", this.onRunEvent);
    this.removeEventListener("runno-stop", this.onStopEvent);
  }

  attributeChangedCallback(
    name: keyof typeof ATTRIBUTE_MAP,
    _: string,
    newValue: string
  ) {
    if (name === "autorun" && !this.hasRun) {
      this.run();
    }

    console.log("attribute changed callback", { name, _, newValue });

    if (isBooleanAttribute(name)) {
      this[ATTRIBUTE_MAP[name]] = newValue !== null;
    } else if (name === "runtime") {
      this[ATTRIBUTE_MAP[name]] = isRuntime(newValue) ? newValue : undefined;
    } else if (name === "syntax") {
      this[ATTRIBUTE_MAP[name]] = isSyntax(newValue) ? newValue : undefined;
    } else {
      this[ATTRIBUTE_MAP[name]] = newValue;
    }
  }

  //
  // Events
  //

  onRunEvent = () => {
    this.run();
  };

  onStopEvent = () => {
    this.interactiveStop();
  };

  //
  // Helpers
  //

  async interactiveRunCode(runtime: Runtime, code: string): Promise<RunResult> {
    this._running = true;
    const result = await this._provider.interactiveRunCode(runtime, code);
    this._running = false;
    return result;
  }

  async interactiveRunFS(
    runtime: Runtime,
    entryPath: string,
    fs: WASIFS
  ): Promise<RunResult> {
    this._running = true;
    const result = await this._provider.interactiveRunFS(
      runtime,
      entryPath,
      fs
    );
    this._running = false;
    return result;
  }

  interactiveStop() {
    return this._provider.interactiveStop();
  }

  headlessRunCode(
    runtime: Runtime,
    code: string,
    stdin?: string
  ): Promise<RunResult> {
    return this._provider.headlessRunCode(runtime, code, stdin);
  }

  headlessRunFS(
    runtime: Runtime,
    entryPath: string,
    fs: WASIFS,
    stdin?: string
  ): Promise<RunResult> {
    return this._provider.headlessRunFS(runtime, entryPath, fs, stdin);
  }
}

customElements.define("runno-run", RunElement);
