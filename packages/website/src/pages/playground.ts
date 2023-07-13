import { html } from "lit";
import { customElement, query } from "lit/decorators.js";
import { TailwindElement } from "../lib/tailwind";

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
      <div class="bg-navy pb-8 relative text-white">
        <website-header></website-header>

        <div class="container mx-auto relative p-4 sm:p-0 ">
          <div class="flex flex-col items-center">
            <h1 class="
                text-center
                text-4xl
                font-bold
                mt-14
                mb-8
                w-1/2
              ">
              Run WebAssembly made for outside the browser, inside the browser.
            </h1>

            <div class="flex justify-center mb-12">
              <pre
                class="border border-yellow bg-black p-2 px-3"
              ><code><span class="text-yellow">$</span> npm install <a class="hover:underline" target="_blank" href="https://www.npmjs.com/package/@runno/wasi">@runno/wasi</a></code></pre>
            </div>

          </div>
          
          <h1
            class="
              text-yellow
              text-2xl
              font-bold
              mt-14
              mb-8
            "
          >
            Use the WASI Playground to try it out.
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
        <img class="absolute top-0 right-0" src="/images/sun-reflection.svg" />
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
            <li class="text-teal">
              <a href="#playground">Runno WASI Playground</a>
            </li>
            <li class="pl-4">
              <a href="#intro">Introduction</a>
            </li>
            <li class="pl-4">
              <a href="#running-wasi">Running WASI</a>
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
              This playground lets you run system programs that have been
              compiled for the WebAssembly System Interface (WASI). You can
              interact with them from the terminal, and easily control the files
              they have access to. Try one of the demos above, or select your
              own <code>.wasi.wasm</code> binary.
            </p>
            <p>
              If you'd like to try something a bit more complex, I've written an
              article about running FFmpeg inside the Runno WASI playground:
              <a href="/articles/ffmpeg">
                I built a WASI playground and you can run FFmpeg in it,
                which is cool
              </a>
            </p>


            <h2 id="running-wasi">Running WASI</h2>
            <p>
              This playground runs WASI binaries, basically executable files
              made of WebAssembly that use the Web Assembly System Interface.
              These binaries can be compiled from system languages like C,
              C++, and Rust.
            </p>
            <p>
              Some of the demos above were written in Rust. To compile to WASI
              in Rust it's as easy as:
            </p>

            <pre>$ rustup target install wasm32-wasi
$ cargo build --target=wasm32-wasi</pre>

            <p>
              Once you've built a <code>.wasi.wasm</code> file you can upload it
              here and run it. Click the "Choose binary file&hellip;" button
              from the playground.. 
            </p>

            <p>
              You can also use LLVM to compile C, and C++ to WASI with the
              <a href="https://github.com/WebAssembly/wasi-sdk">wasi-sdk</a>.
            </p>

            <h2 id="wasi">Understanding WASI</h2>
            <p>
              The WebAssembly System Interface (WASI) is a standard (see:
              <a href="https://wasi.dev">wasi.dev</a>) for giving WebAssembly
              binaries access to system resources. A WebAssembly binary is not
              able to call out to the "host" system without being provided with
              an interface. WASI defines a set of functions, like
              <code>fd_read</code>, and <code>args_get</code>,
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
              The Runno WASI runtime is not yet available as an NPM package
              but the source is available
              <a href="https://github.com/taybenlor/runno/tree/main/packages/wasi">
                on Github
              </a>.
              <!-- There are many other WASI runtimes, but Runno's is specifically
              designed for the Web. If you're trying to run WASI outside of a
              Web Browser, you won't get far with Runno. But if you have some
              system-level binaries you want to interact with then Runno is a
              great choice. -->
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
