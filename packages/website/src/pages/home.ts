import { html, css } from "lit";
import { customElement } from "lit/decorators.js";

import { TailwindElement } from "../lib/tailwind";

import "../components/starfield";
import "../components/form";
import "../components/version";
import "../components/header";
import "../components/demo";

@customElement("page-home")
export class PageHome extends TailwindElement {
  static styles = [
    TailwindElement.styles,
    css`
      .bg-sunset {
        background: linear-gradient(180deg, #030052, #06004f 70%, #70164e);
      }

      runno-run {
        --runno-terminal-min-height: 8rem;
      }
    `,
  ];

  render() {
    return html`
      <div class="bg-sunset pb-8 relative text-white">
        <website-starfield class="pointer-events-none">
          <img src="/images/star.svg" />
        </website-starfield>
        <website-header></website-header>

        <img class="absolute bottom-0 right-0 w-1/5" src="/images/sun.svg" />
        <div class="container mx-auto relative p-4 sm:p-0">
          <h1
            class="
              text-3xl
              sm:text-4xl
              md:text-5xl
              font-bold
              text-center
              mt-16
              mb-6
            "
          >
            Run code examples on your website
          </h1>
          <div class="w-1/3 mx-auto">
            <hr class="border-t border-yellow my-2 h-0" />
            <hr class="w-4/5 border-t border-yellow my-2 h-0 mx-auto" />
            <hr class="w-3/5 border-t border-yellow my-2 h-0 mx-auto" />
          </div>

          <div class="flex justify-center mt-12 mb-32">
            <pre
              class="border border-yellow bg-black p-2 px-3"
            ><code><span class="text-yellow">$</span> npm install <a class="hover:underline" target="_blank" href="https://www.npmjs.com/package/@runno/runtime">@runno/runtime</a></code></pre>
          </div>
        </div>
      </div>

      <!-- Runno main demo -->
      <website-demo>
        <h1 class="text-2xl font-bold mb-4">Write HTML, get runnable code</h1>
        <p class="font-sans">
          Runno helps you add simple code examples to your website. You can
          customise it with HTML, style it with CSS, and extend it with
          JavaScript. It can run code written in a bunch of languages, using
          standard implementations.
          <strong>It all runs client-side in the browser</strong>, powered by
          WebAssembly and the WebAssembly System Interface (WASI).
        </p>
      </website-demo>

      <!-- Runno grey -->
      <div class="bg-gradient-to-b from-white to-lightGrey text-black">
        <div class="container mx-auto pb-16 px-4 md:px-0">
          <h1 class="text-xl font-bold mb-8">Supported languages</h1>
          <div class="flex flex-wrap md:flex-nowrap gap-8">
            <div
              class="w-full md:w-2/3 lg:w-1/2 flex flex-wrap justify-between gap-8"
            >
              <img
                class="h-16"
                src="/images/languages/python.svg"
                alt="Python"
              />
              <img class="h-12" src="/images/languages/ruby.svg" alt="Ruby" />
              <img
                class="h-16 -top-2 relative"
                src="/images/languages/sqlite.svg"
                alt="SQLite"
              />
              <img class="h-20" src="/images/languages/php.svg" alt="PHP" />
              <img
                class="h-20"
                src="/images/languages/javascript.svg"
                alt="JavaScript"
              />
              <img class="h-20" src="/images/languages/c.svg" alt="C" />
              <img class="h-20" src="/images/languages/cpp.svg" alt="C++" />
            </div>
            <div class="w-full md:w-1/3 lg:w-1/2 flex justify-center">
              <div
                class="w-full lg:w-auto outline-2 outline-dashed outline-navy bg-white rounded p-8 flex-shrink"
              >
                <p class="text-2xl font-bold font-sans lg:w-64 mb-8">
                  Contribute your own language runtime.
                </p>
                <a
                  target="_blank"
                  class="flex justify-center text-center font-sans bg-blue hover:bg-navy shadow-lg text-white font-bold p-4 text-lg rounded-lg"
                  href="https://github.com/taybenlor/runno/issues"
                >
                  <img src="/images/github-light.png" class="w-7 h-7 mr-3" />
                  View Issues
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Runno dark background -->
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
              <a href="#know-runno">Getting to know Runno</a>
            </li>
            <li class="pl-4">
              <a href="#about-runno">About Runno</a>
            </li>
            <li class="pl-4">
              <a href="#quickstart">Quickstart</a>
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
            <h1 id="know-runno">Getting to know Runno</h1>
            <h2 id="about-runno">About Runno</h2>
            <p>
              Runno helps you make runnable code examples that can be embedded
              in web pages. This is very handy for educational tools, it means:
            </p>

            <ul>
              <li>
                You can make code examples that don't need users to install
                scary tools.
              </li>
              <li>
                No need to run a server, it all runs client-side in the browser.
              </li>
              <li>
                Your users can edit and re-run any code examples you make.
              </li>
              <li>
                The examples are extremely customisable with HTML, CSS and
                JavaScript!
              </li>
            </ul>

            <h2 id="quickstart">Quickstart</h2>
            <p>
              Lets say you're writing a blog post and want to explain how an
              <code>if</code> statement works. You come to this website (👋 hi)
              to add Runno to your blog.
            </p>

            <h3>Install &amp; Configure</h3>
            <p>
              First you'll need to install the <code>@runno/runtime</code>
              package:
            </p>

            <pre><code><span class="text-yellow">$</span> npm install @runno/runtime</code></pre>

            <p>
              Then add the Runno Web Components to your JavaScript with an
              import:
            </p>

            <pre><code>import "@runno/runtime"</code></pre>

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

            <pre><code>Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp</code></pre>

            <h3>Using Runno on your page</h3>

            <p>
              Now you've done all the setup you can add a runnable snippet into
              your post! Just write HTML however you like to write HTML.
            </p>

            <pre><code>&lt;p&gt;
  You can use if statements to run different code depending on a decision:
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
        </code></pre>

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
    "page-home": PageHome;
  }
}
