import { html, css } from "lit";
import { customElement, state, query } from "lit/decorators.js";

import { Runtime } from "@runno/host";

import { TailwindElement } from "../lib/tailwind";

import "../components/starfield";
import "../components/form";
import "../components/version";
import "../components/header";

import { exampleForRuntime } from "../examples";
import { WebsiteForm } from "../components/form";

@customElement("page-home")
export class PageHome extends TailwindElement {
  static styles = [
    TailwindElement.styles,
    css`
      .bg-sunset {
        background: linear-gradient(180deg, #030052, #06004f 70%, #70164e);
      }
    `,
  ];

  @state()
  runtime: Runtime = "python";

  @state()
  code: string = exampleForRuntime(this.runtime);

  @state()
  controls: boolean = false;

  @state()
  editor: boolean = false;

  @query("website-form", true)
  _form!: WebsiteForm;

  onFormInput = () => {
    this.runtime = this._form.runtime;
    this.code = this._form.code;
    this.controls = this._form.controls;
    this.editor = this._form.showEditor;
  };

  firstUpdated() {
    // TODO: It's weird but lit won't let me listen to this event from the template
    this._form.addEventListener("form-input", this.onFormInput);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._form.removeEventListener("form-input", this.onFormInput);
  }

  render() {
    return html`
      <div class="bg-sunset pb-8 relative">
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
            ><code>$ npm install @runno/runtime</code></pre>
          </div>
        </div>
      </div>

      <!-- Runno below the fold -->
      <div class="bg-white">
        <div class="container mx-auto">
          <div class="flex flex-wrap items-stretch py-16 font-mono -mt-28">
            <website-form></website-form>
            <div
              class="rounded-lg overflow-clip flex-grow bg-white drop-shadow-2xl shadow-2xl"
            >
              <div
                class="flex justify-center border-b border-b-lightGrey rounded"
              >
                <span class="text-black bg-lightGrey px-8 m-2">Preview</span>
              </div>
              <!-- <runno-run
                class="w-full h-full"
                runtime="python"
                controls
                editor
              ></runno-run> -->
              <runno-run
                class="w-full h-full"
                runtime="python"
                .code=${this.code}
                ?controls=${this.controls}
                ?editor=${this.editor}
              ></runno-run>
            </div>
          </div>
        </div>
      </div>

      <!-- Runno dark background -->
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
            <li class="text-yellow">
              <a href="#know-runno">Getting to know Runno</a>
            </li>
            <li class="pl-4">
              <a href="#using-runno">Using Runno</a>
            </li>
            <li class="pl-4">
              <a href="#examples">Examples</a>
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
            <h2 id="using-runno">Using Runno</h2>
            <p>
              Runno helps you make runnable code examples that can be embedded
              in web pages. This is very handy for educational tools, it means:
            </p>

            <ul>
              <li>
                You can make code examples that don't need users to install
                complex tools.
              </li>
              <li>
                No need to run a server, it all runs client-side in the browser.
              </li>
              <li>
                Your users can edit and re-run any code examples you make.
              </li>
              <li>All examples are extremely customisable.</li>
            </ul>

            <p>
              For advanced uses, the iframe can be controlled with the
              <a href="/docs#host-api">host API</a>. With the host API you can
              pass files, collect <code>STDOUT</code> and automate running in
              both interactive and headless modes. Or bake Runno into your app
              with the
              <a href="/docs#web-components">runtime web components</a>.
            </p>

            <h2 id="examples">Examples</h2>
            <p>
              Lets say you're writing a blog post and want to explain how an
              <code>if</code> statement works. You've written a code sample like
              this:
            </p>
            <pre><code>name = input("What's your name? ")
if "i" in name.lower():
  print("You've got an I in your name, how selfish.")
else:
  print("There's no I in your name.")
</code></pre>

            <p>
              You can take that snippet to Runno, select the <code>python</code>
              runtime and paste in your code. Then you can select the embed
              field and copy the generated iframe. Paste it into your blog like:
            </p>

            <pre><code>&lt;p&gt;
  Here's an example of an if statement:
&lt;/p&gt;

&lt;iframe src="&hellip;" crossorigin allow="cross-origin-isolated" width="640" height="320" frameBorder="0"&gt;&lt;/iframe&gt;

&lt;p&gt;
  You can use an if statement to&hellip;
&lt;/p&gt;
</code></pre>

            <p>And it would work something like:</p>

            <div class="bg-white px-4 flow-root rounded text-black">
              <p>Here's an example of an if statement:</p>
              <iframe
                src="https://runno.run/?editor=1&amp;runtime=python&amp;code=bmFtZSA9IGlucHV0KCJXaGF0J3MgeW91ciBuYW1lPyAiKQppZiAiaSIgaW4gbmFtZS5sb3dlcigpOgogIHByaW50KCJZb3UndmUgZ290IGFuIEkgaW4geW91ciBuYW1lLCBob3cgc2VsZmlzaC4iKQplbHNlOgogIHByaW50KCJUaGVyZSdzIG5vIEkgaW4geW91ciBuYW1lLiIp"
                crossorigin
                allow="cross-origin-isolated"
                height="320"
                class="w-full p-1.5 bg-black rounded"
              ></iframe>
              <p>You can use an if statement to&hellip;</p>
            </div>

            <p>
              Now your readers can run your example to try it out. They can even
              edit it and check they understand how it works!
            </p>

            <p>
              If you find you're using Runno a lot on your blog, you can use the
              Runno Web Components (<a href="#web-components">documentation</a
              >). First follow the
              <a href="#component-quickstart">quickstart guide</a> to make sure
              it's set up correctly.
            </p>

            <p>
              Once you've got Runno installed you can use the same features
              without needing to use an iframe. Lets say you were explaining how
              infinite loops work in JavaScript:
            </p>

            <pre><code>&lt;p&gt;
An infinite loop runs forever:
&lt;/p&gt;

&lt;runno-run runtime="quickjs" editor controls&gt;
  while (true) {
    console.log("Help I'm trapped in a code factory!");
  }
&lt;/runno-run&gt;

&lt;p&gt;
Try changing the text to your own example!
&lt;/p&gt;
        </code></pre>

            <p>And it would work in the same way as the iframe:</p>

            <div class="bg-white px-4 flow-root rounded text-black">
              <p>An infinite loop runs forever:</p>
              <!-- prettier-ignore -->
              <runno-run
            runtime="quickjs"
            editor
            controls
            class="w-full bg-black p-1.5 rounded text-sm"
          >
            while (true) {
              console.log("Help I'm trapped in a code factory!");
            }
          </runno-run>
              <p>Try changing the text to your own example!</p>
            </div>

            <h2 id="thanks">Big thanks to</h2>

            <p>
              A number of open-source projects and standards have been used to
              make Runno possible. These include:
            </p>
            <ul>
              <li>
                Wasmer, WAPM, and WebAssembly.sh - the Wasmer team have built a
                lot of great tools for running Web Assembly. WAPM, the Web
                Assembly Package Manager is key to how Runno works.
                WebAssembly.sh was a great inspiration and starting point.
              </li>
              <li>
                WASI and Web Assembly - a bunch of people from various working
                groups and especially the Bytecode Alliance have been involved
                in making WASM and WASI what it is today.
              </li>
              <li>
                XTerm.js - a fully featured terminal that can be run in the
                browser
              </li>
              <li>
                CodeMirror - a great web-based code editor that's always a
                delight to integrate
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
