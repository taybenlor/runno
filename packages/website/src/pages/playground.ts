import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

import { WASI, WASIContext, WASIFS } from "@runno/wasi-motor";

import { Tailwind } from "../mixins/tailwind";

import "../components/file";

@customElement("page-playground")
export class PagePlayground extends Tailwind(LitElement) {
  static styles = css`
    .bg-sunset {
      background: linear-gradient(0deg, #030052, #06004f 70%, #330b24);
    }
  `;

  @state()
  args: string[] = [];

  @state()
  binary: File | null = null;

  @state()
  stdout: string = "";

  @state()
  stderr: string = "";

  @state()
  files: File[] = [];

  onArgsInput(event: InputEvent) {
    this.args = (event.target as HTMLInputElement).value.split(" ");
  }

  onBinaryInput(event: InputEvent) {
    const target = event.target as HTMLInputElement;
    if (!target.files) {
      return;
    }

    this.binary = target.files.item(0);
  }

  async onRunClick() {
    if (!this.binary) {
      return;
    }

    this.stderr = "";
    this.stdout = "";

    const fs: WASIFS = {};
    for (const file of this.files) {
      fs[file.name] = {
        path: file.name,
        timestamps: {
          change: new Date(file.lastModified),
          access: new Date(file.lastModified),
          modification: new Date(file.lastModified),
        },
        mode: "binary",
        content: new Uint8Array(await file.arrayBuffer()),
      };
    }

    const result = await WASI.start(
      fetch(URL.createObjectURL(this.binary)),
      new WASIContext({
        args: [this.binary.name, ...this.args],
        stdout: (out) => (this.stdout += out),
        stderr: (err) => (this.stderr += err),
        stdin: () => prompt("stdin (cancel to end stdin):"),
        fs,
      })
    );

    this.stdout += `\nReturn: ${result.exitCode}`;

    const newFiles: File[] = [];
    for (const [path, wasiFile] of Object.entries(result.fs)) {
      newFiles.push(
        new File([wasiFile.content], path, {
          lastModified: wasiFile.timestamps.modification.getTime(),
        })
      );
    }
    this.files = newFiles;
  }

  onFilesystemInput(event: InputEvent) {
    const inputElement = event.target as HTMLInputElement;
    const files = inputElement.files;
    if (!files) {
      return;
    }

    this.files = [...this.files, ...Array.from(files)];
    inputElement.files = null;
    inputElement.value = "";
  }

  onUpdateFile(i: number, event: CustomEvent) {
    this.files[i] = event.detail.file;
    this.files = [...this.files];
  }

  render() {
    return html`
      <div class="bg-sunset pb-8 relative">
        <website-header></website-header>

        <div class="container mx-auto relative p-4 sm:p-0">
          <h1
            class="
              text-2xl
              font-bold
              mt-14
              mb-10
            "
          >
            WASI Playground
          </h1>
          <div class="flex flex-wrap items-stretch pb-16 font-mono">
            <div
              class="flex flex-col flex-grow w-full mb-8 lg:w-auto lg:mr-8 lg:mb-0"
            >
              <div class="relative border border-yellow">
                <label
                  class="
              absolute
              -top-3
              left-4
              px-4
              bg-navy
              text-sm text-yellow
            "
                  for="binary"
                >
                  Command
                </label>
                <form class="flex justify-between">
                  <div class="flex-grow flex items-center gap-2 pl-3">
                    $
                    <input
                      id="binary"
                      type="file"
                      placeholder="WASI Binary"
                      @input=${this.onBinaryInput}
                    />
                    <input
                      type="text"
                      placeholder="args"
                      @input=${this.onArgsInput}
                      class="bg-transparent flex-grow p-3 h-full"
                    />
                  </div>
                  <button
                    type="button"
                    @click=${this.onRunClick}
                    class="bg-yellow text-black px-4 font-medium"
                  >
                    Run
                  </button>
                </form>
              </div>
              <pre class="border border-t-0 border-yellow h-64 p-3">
${this.stdout}</pre
              >
            </div>
            <div
              class="flex-grow flex flex-col items-stretch w-1/3 h-80 lg:h-auto"
            >
              <div class="relative border border-yellow">
                <label
                  class="
              absolute
              -top-3
              left-4
              px-4
              bg-navy
              text-sm text-yellow
            "
                  for="files"
                >
                  Filesystem
                </label>
                <div class="p-3 flex flex-col">
                  <input
                    id="binary"
                    type="file"
                    @input=${this.onFilesystemInput}
                  />
                  ${this.files.map(
                    (f, i) =>
                      html`
                        <playground-file
                          .file=${f}
                          @file-change=${(event: CustomEvent) =>
                            this.onUpdateFile(i, event)}
                          class="my-3"
                        ></playground-file>
                      `
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="relative">
        <img class="absolute top-0 right-0" src="images/sun-reflection.svg" />
      </div>
      <div class="flex flex-wrap container mx-auto my-16 relative">
        <runno-scroll-highlight
          class="mb-8 p-4 text-sm w-[65ch] md:text-base lg:w-auto sm:p-0"
        >
          <nav
            class="
          border border-lightBlue
          mr-8
          p-2
          list-none
          sticky
          top-4
          columns-2
          w-full
          sm:columns-3
          lg:w-auto lg:columns-1
        "
          >
            <li class="text-yellow">
              <a href="#playground">Runno WASI Playground</a>
            </li>
            <li class="pl-4">
              <a href="#intro">Introduction</a>
            </li>
            <li class="pl-4">
              <a href="#wasi">Understanding WASI</a>
            </li>
            <li class="pl-4">
              <a href="#runno-wasi">Runno and WASI</a>
            </li>
          </nav>
        </runno-scroll-highlight>
        <article
          class="
        prose
        p-4
        w-full
        sm:w-auto sm:p-0 sm:prose-sm
        md:prose md:w-auto
      "
        >
          <section>
            <h1 id="playground">Runno WASI Playground</h1>
            <h2 id="intro">Introduction</h2>
            <p>
              The Runno WASI playground is an interactive UI and terminal
              connected up to a Runno WASI runtime. You can select a WASI binary
              with the file input, attach files for that binary to run against
              and then run it, to get an interactive terminal.
            </p>

            <h2 id="wasi">Understanding WASI</h2>
            <p>
              The Web Assembly System Interface (WASI) is a standard (see:
              <a href="https://wasi.dev">wasi.dev</a>) for giving WebAssembly
              binaries access to system resources. A WebAssembly binary is not
              able to call out to the "host" system without being provided with
              an interface. WASI provides a set of functions, like
              <code>fd_read</code>, and <code>args_get</code>, that are similar
              enough to POSIX standards that most system-level programs can run.
            </p>
            <p>
              When a program is compiled to WASI the program becomes truly
              portable. The binary instructions are in WebAssembly, and the
              system calls are in WASI, and a runtime can translate these into
              local equivalents. This means WASI binaries can run in the cloud,
              on your machine (Mac, Windows, or Linux), on an embedded device,
              or in this case in your Web Browser.
            </p>

            <h2 id="runno-wasi">Runno and WASI</h2>
            <p>
              Runno uses a WASI runtime to run programming languages that have
              been compiled to WASI. This is non-trivial, since WASI has been
              designed for running on POSIX-like systems. WASI assumes that your
              environment has a filesystem, which browsers do not, and access to
              sockets, which browsers do not. Programming language binaries
              assume you can provide files like <code>STDIN</code> and
              <code>STDOUT</code>. These all have to be emulated (or ignored).
            </p>
            <p>
              The Runno WASI runtime is available as an NPM package
              (<code>@runno/wasi-motor</code>) and the source is available on
              Github. There are many other WASI runtimes, but Runno's is
              specifically designed for the Web. If you're trying to run WASI
              outside of a Web Browser, you won't get far with Runno. But if you
              have some system-level binaries you want to interact with then
              Runno is a great choice.
            </p>
          </section>
        </article>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "page-playground": PagePlayground;
  }
}
