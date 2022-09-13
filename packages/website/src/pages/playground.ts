import { html } from "lit";
import { customElement, query } from "lit/decorators.js";
import { TailwindElement } from "../mixins/tailwind";

import type { WebsitePlayground } from "../components/playground";

import { DEMOS, WASIExample } from "../demos/wasi-examples";

import "../components/file";
import "../components/playground";

@customElement("page-playground")
export class PagePlayground extends TailwindElement {
  @query("website-playground")
  _playground!: WebsitePlayground;

  loadDemo(demo: WASIExample) {
    this._playground.loadDemo(demo);
  }

  render() {
    return html`
      <div class="bg-navy pb-8 relative">
        <website-header></website-header>

        <div class="container mx-auto relative p-4 sm:p-0">
          <h1
            class="
              text-center
              text-3xl
              font-bold
              mt-14
              mb-10
            "
          >
            Try out WASI, with the Playground
          </h1>
          <website-playground class="pb-16 font-mono"></website-playground>
          
          <h1 class="text-xl my-12 mb-4 pb-2 border-b border-lightBlue text-yellow">
            Some demos you can try out!
          </h2>
          <div class="grid grid-cols-3 gap-8">
            ${DEMOS.map(
              (demo) => html`
                <div class="flex flex-col justify-between">
                  <pre class="whitespace-pre-wrap">${demo.instructions}</pre>
                  <div class="flex gap-4 items-center">
                    <button
                      class="bg-yellow text-black px-4 py-1 my-4 font-medium font-mono"
                      @click=${() => this.loadDemo(demo)}
                    >
                      Load
                    </button>
                    ${demo.source &&
                    html`<a
                      target="_blank"
                      href=${demo.source}
                      class="text-lightBlue"
                      >View Source</a
                    >`}
                  </div>
                </div>
              `
            )}
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
              connected up to a Runno WASI runtime. You can select a WASI
              binary, attach files for that binary to run against and then run
              it, to get an interactive terminal.
            </p>

            <h2 id="wasi">Understanding WASI</h2>
            <p>
              The WebAssembly System Interface (WASI) is a standard (see:
              <a href="https://wasi.dev">wasi.dev</a>) for giving WebAssembly
              binaries access to system resources. A
              WebAssembly binary is not able to call out to the "host" system
              without being provided with an interface. WASI defines a set of
              functions, like <code>fd_read</code>, and <code>args_get</code>,
              that are similar enough to POSIX standards that many system-level
              programs can be compiled without major changes.
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
