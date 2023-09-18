import { html } from "lit";
import { customElement } from "lit/decorators.js";
import { TailwindElement } from "../lib/tailwind";

import "../components/scroll-highlight";
import "../components/header";

@customElement("page-docs")
export class PageDocs extends TailwindElement {
  render() {
    return html`
      <div class="bg-navy text-white pb-3">
        <website-header></website-header>
      </div>
      <div class="flex flex-wrap container mx-auto my-16 relative">
        <runno-scroll-highlight
          class="mb-8 p-4 text-sm w-[65ch] md:text-base lg:w-auto sm:p-0"
        >
          <nav
            class="
          border border-lightGrey
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
              <a href="#api-docs">API Docs</a>
            </li>
            <li class="pl-4 text-pink font-mono text-sm">
              <a href="/docs/runtime/">@runno/runtime</a>
            </li>
            <li class="pl-4 pb-2 text-pink font-mono text-sm">
              <a href="/docs/wasi/">@runno/wasi</a>
            </li>
            <li class="text-teal">
              <a href="#know-runno">Quickstart</a>
            </li>
            <li class="pl-4">
              <a href="#install">Install &amp; configure</a>
            </li>
            <li class="pl-4">
              <a href="#using">Using Runno</a>
            </li>
            <li class="pl-4">
              <a href="#how-it-works">How it works</a>
            </li>
            <li class="pl-4">
              <a href="#why-browser">Why the browser?</a>
            </li>
            <li class="pl-4">
              <a href="#limitations">Limitations</a>
            </li>
            <li class="pl-4">
              <a href="#security">Security</a>
            </li>
            <li class="pl-4">
              <a href="#thanks">Thanks to</a>
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
            <h1 id="api-docs">API Docs</h1>
            <p>Reference generated docs for the two Runno packages:</p>
            <ul class="pb-8 ml-0" style="padding-left: 0px">
              <li class="list-none">
                <a href="/docs/runtime/">@runno/runtime</a>
              </li>
              <li class="list-none">
                <a href="/docs/wasi/">@runno/wasi</a>
              </li>
            </ul>
            <h1 id="know-runno">Quickstart</h1>

            <p>
              Lets say you're writing a blog post and want to explain how an
              <code>if</code> statement works. You come to this website (👋 hi)
              to add Runno to your blog.
            </p>

            <h2 id="install">Install &amp; Configure</h2>
            <p>
              First you'll need to install the <code>@runno/runtime</code>
              package:
            </p>

            <pre><code><span class="text-yellow">$</span> npm install @runno/runtime</code></pre>

            <p>
              Then add the Runno Web Components to your JavaScript with an
              import:
            </p>

            <runno-code syntax="js" class="text-sm p-3 bg-darkSlate rounded-lg"
              >import "@runno/runtime"</runno-code
            >

            <p>
              Once imported Runno will define all the Web Components necessary
              for it to work.
            </p>

            <p>
              Runno uses <code>SharedArrayBuffer</code> under the hood. For it
              to work, you need to provide a
              <a href="https://web.dev/cross-origin-isolation-guide/">
                Cross-Origin Isolated context </a
              >. That means you'll need to change some HTTP headers on your web
              server. Depending on your language, framework, and hosting this
              will be different (I recommend a google). The headers you need to
              set are:
            </p>

            <runno-code class="text-sm p-3 bg-darkSlate rounded-lg">
              Cross-Origin-Opener-Policy: same-origin
              Cross-Origin-Embedder-Policy: require-corp
            </runno-code>

            <h2 id="using">Using Runno on your page</h2>

            <p>
              Now you've done all the setup you can add a runnable snippet into
              your post! Just write HTML however you like to write HTML.
            </p>

            <!-- prettier-ignore -->
            <runno-code syntax="html" class="text-sm p-3 bg-darkSlate rounded-lg">
              &lt;p&gt;
                You can use if statements to run different code
                depending on a decision:
              &lt;/p&gt;

              &lt;runno-run runtime="python" editor controls&gt;
                name = input("What's your name? ")
                if "i" in name:
                  print("You've got an I in your name, how selfish.")
                else:
                  print("There's no I in your name.")
              &lt;/runno-run&gt;

              &lt;p&gt;
                Try out the example with different names!
              &lt;/p&gt;
            </runno-code>

            <p>And it would work something like:</p>

            <div class="bg-lightGrey px-4 flow-root rounded text-black">
              <p>
                You can use if statements to run different code depending on a
                decision:
              </p>

              <!-- prettier-ignore -->
              <runno-run
                runtime="python"
                editor
                controls
                class="overflow-hidden"
              >
                name = input("What's your name? ")
                if "i" in name:
                  print("You've got an I in your name, how selfish.")
                else:
                  print("There's no I in your name.")
              </runno-run>

              <p>Try out the example with different names!</p>
            </div>

            <p>
              Now your readers can run your example to try it out. They can even
              edit it and check they understand how it works!
            </p>

            <p>
              For a more complete set of examples, check out the
              <a
                target="_blank"
                href="https://github.com/taybenlor/runno/tree/main/examples"
                >examples on GitHub</a
              >.
            </p>

            <h2 id="how-it-works">How it works</h2>
            <p>
              Runno uses Web Assembly to run code in the browser. Code runs in a
              unix-like sandbox that connects to a web-based terminal emulator.
              This means it behaves a lot like running code natively on a linux
              terminal. It's not perfect, but it's handy for making simple code
              examples run.
            </p>
            <p>
              When you click run on a Runno example the web assembly binary for
              that programming language is downloaded from Runno.dev. It's then
              run using <code>@runno/wasi</code> in a sandboxed Web Worker with
              an in-memory file system. It's connected up to a terminal emulator
              and simple IO is routed back and forth.
            </p>

            <h2 id="why-browser">Why run in the browser?</h2>
            <p>
              The way Runno is built shifts the work of running code examples
              from the server to the client. Running code examples on your
              server is risky, it means having to implement protections from
              potentially hostile clients and limiting resources. This means
              that it's difficult to build a system that is open for anyone to
              use.
            </p>
            <p>
              If you're writing a blog post, your own course, or writing
              documentation it's difficult to implement your own sandbox. You
              really want to use something that someone else has built. Even if
              an open source solution existed you'd have to deploy a server and
              maintain it! By running on the client you eliminate needing any
              servers or third party involvement.
            </p>
            <p>
              Plus it's pretty cool that you can just run code in your browser!
            </p>

            <h2 id="limitations">Limitations</h2>
            <p>
              The programming languages available are limited by what has
              already been compiled to Web Assembly using WASI. A great way to
              help more languages become available would be to compile your
              favourite programming language tools to Web Assembly and file a
              ticket on GitHub.
            </p>
            <p>
              WASI doesn't provide a full linux environment, so most system
              based interfaces won't work. Packages and modules are possible to
              install inside the Runno environment, but they can't run native
              binaries. If you want to import anything, you'll need to provide
              it alongside your example.
            </p>
            <p>
              Runno is best for small code examples that use
              <code>STDIN</code> and <code>STDOUT</code>. That is typically the
              sort of thing that is taught in a CS1 course at university. This
              isn't an inherent limitation of the system though! As more work is
              put into Runno and the ecosystem of tools it depends on, more will
              become available.
            </p>

            <h2 id="security">Security</h2>
            <p>
              Running arbitrary code is always going to have some security
              risks, even if you're running it on the client. The goal of the
              Runno sandbox is to make it as safe as possible for a client to
              press run. They should be able to trust that their browser won't
              do anything they don't expect it to do.
            </p>
            <p>
              Because Runno runs within the browser on the client, you don't
              have to worry about it damaging your servers. But we also need to
              make sure Runno won't damage your clients.
            </p>
            <p>
              By running as WebAssembly, in a Web Worker, we create a layer of
              sandboxing. The worker cannot lock up the system, and any system
              resources (like files) that the binary uses are all emulated
              through a layer of JavaScript that Runno controls.
            </p>
            <p>
              With the browser sandboxing, the Web Worker sandboxing, the Web
              Assembly sandboxing, and the in-memory file system it's difficult
              for a user to hurt themselves, for you to hurt a user, or for
              users to hurt each other. But that doesn't mean Runno is 100%
              safe.
            </p>
            <p>
              The intention is for Runno to either fix security issues, or to
              disclose the risks upfront. So if you find a security issue with
              the way Runno works, please
              <a href="mailto:security@taybenlor.com"
                >contact me (security@taybenlor.com)</a
              >!
            </p>

            <h2 id="thanks">Big thanks to</h2>

            <p>
              A number of open-source projects and standards have been used to
              make Runno possible. These include:
            </p>
            <ul>
              <li>
                WASI and Web Assembly - a bunch of people from various working
                groups and especially the Bytecode Alliance have been involved
                in making WASM and WASI the portable platform it is.
              </li>
              <li>
                XTerm.js - a fully featured terminal that can be run in the
                browser.
              </li>
              <li>
                CodeMirror - a great web-based code editor that's always a
                delight to integrate.
              </li>
              <li>
                Wasmer - the Wasmer team have built a lot of great tools for
                running Web Assembly. WebAssembly.sh was a great inspiration and
                starting point.
              </li>
              <li>
                The extensive work by many in the web development community on
                making native code and APIs run successfully inside the browser.
              </li>
            </ul>
            <p>
              Thanks to everyone who has built compatibility layers for the web.
              The web becomes a better platform with every new piece of software
              we can run on it!
            </p>
            <p>
              Also big thanks to my friends who tolerate me constantly talking
              about WASM. Thanks especially to Shelley, Katie, Jesse, Jim, Odin,
              Hailey, Sam and other Sam.
            </p>
          </section>
        </article>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "page-docs": PageDocs;
  }
}
