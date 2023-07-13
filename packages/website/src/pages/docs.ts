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
              <a href="#know-runno">Getting to know Runno</a>
            </li>
            <li class="pl-4">
              <a href="#using-runno">Using Runno</a>
            </li>
            <li class="pl-4">
              <a href="#examples">Examples</a>
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
            <li class="text-teal mt-2">
              <a href="#web-components">Web Components</a>
            </li>
            <li class="pl-4">
              <a href="#component-quickstart">Quickstart</a>
            </li>
            <li class="pl-4">
              <a href="#component-how">How it works</a>
            </li>
            <li class="pl-4">
              <a href="#component-elements">Elements</a>
            </li>
            <li class="pl-4">
              <a href="#component-helpers">Helpers</a>
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
              <a href="#host-api">host API</a>. With the host API you can pass
              files, collect <code>STDOUT</code> and automate running in both
              interactive and headless modes. Or bake Runno into your app with
              the <a href="#web-components">runtime web components</a>.
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
              that programming language is collected from
              <a target="_blank" href="https://wapm.io">WAPM</a> (the Web
              Assembly Package Manager). It's then run in a Web Worker, inside a
              sandbox with an in-memory file system. It's connected up to a
              terminal emulator and simple IO is routed back and forth.
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
              already been compiled to Web Assembly using WASI and uploaded to
              WAPM. A great way to help more languages become available would be
              to compile your favourite programming language tools to Web
              Assembly and upload them to WAPM.
            </p>
            <p>
              WASI doesn't provide a full linux environment, so most system
              based interfaces won't work. Packages and modules are also
              difficult to install inside the Runno environment. If you want to
              import code, you'll need to provide that code alongside your
              example.
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
              There are two main layers of sandboxing that help make Runno
              secure:
            </p>
            <ol>
              <li>
                By running as WebAssembly we create a layer of sandboxing, any
                system resources that the binary wants have to be passed through
                a layer of JavaScript that Runno controls.
              </li>
              <li>
                By embedding Runno inside an iframe from another domain we
                sandbox it from any secrets inside your webpage. This prevents
                Runno from having access to cookies or from making API calls as
                a user.
              </li>
            </ol>
            <p>
              With these two layers combined it's difficult for a user to hurt
              themselves, for you to hurt a user, or for users to hurt each
              other. But that doesn't mean Runno is 100% safe.
            </p>
            <p>
              Runno can quite easily be used to hog resources on a client. An
              infinite loop can lock up a tab. Large binaries can potentially be
              dynamically loaded from WAPM, using surprising amounts of
              bandwidth. While not ideal, these are typical risks a user has in
              navigating to any website.
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

          <section class="flow-root mt-16">
            <h1 id="web-components">Web Components</h1>
            <p>
              The building blocks of Runno are available as Web Components that
              can be bundled into your page. You can then use them just like
              other HTML in your website.
            </p>
            <p>
              You'll need to be using a modern web stack that includes a bundler
              of some sort to use the web components. If you haven't used web
              components before you can
              <a
                target="_blank"
                href="https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements"
                >learn about them on MDN</a
              >, or dive in. They work like normal HTML elements, you can style
              them with classes, give them ids etc - but also they have custom
              behaviour.
            </p>

            <h2 id="component-quickstart">Quickstart</h2>
            <p>Start by adding <code>@runno/runtime</code> to your package:</p>

            <pre><code>$ npm install @runno/runtime</code></pre>

            <p>Then import the package to define the elements:</p>

            <pre><code>import '@runno/runtime'</code></pre>

            <p>
              Once you've imported the runtime, you can use the custom elements
              on your page.
            </p>

            <pre><code>&lt;runno-run runtime="python" editor controls&gt;
print('Hello, World!')
&lt;/runno-run&gt;</code></pre>

            <p>Which would render as:</p>

            <runno-run runtime="python" editor controls>
              print('Hello, World!')
            </runno-run>

            <h2 id="component-how">How it works</h2>
            <p>
              The Runno iframe is implemented using these web components and so
              there is a lot of overlap in how they work. Rather than repeating
              the documentation:
            </p>
            <ul>
              <li>
                Your webpage needs to be a
                <a href="#host-headers">Cross-Origin Isolated context</a>.
              </li>
              <li>
                The <code>runno-run</code> element implements the
                <a href="#runno-host">
                  <code class="!text-pink">RunnoHost</code> methods </a
                >.
              </li>
              <li>
                All the <code>Runtime</code> and <code>Syntax</code> options can
                have the same variables.
              </li>
              <li>
                The code still runs within a WebAssembly sandbox isolating it
                from your page.
              </li>
            </ul>

            <h2 id="component-elements">Elements</h2>

            <h4><code>runno-run</code></h4>
            <pre><code>&lt;runno-run
syntax="Syntax" &lt;!-- optional --&gt;
runtime="Runtime" &lt;!-- optional --&gt;
code="string" &lt;!-- optional --&gt;
editor &lt;!-- optional, presence displays the editor --&gt;
controls &lt;!-- optional, presence displays the controls --&gt;
&gt;
&lt;!-- content is treated as code if not set as an attribute --&gt;
&lt;/runno-run&gt;
</code></pre>
            <p>
              The <code>runno-run</code> element implements all of Runno's
              public APIs and acts as a wrapper around the editor, terminal and
              controls. It's the main thing you should be using.
            </p>

            <p>
              On top of the
              <a href="#runno-host">
                <code class="!text-pink">RunnoHost</code> methods
              </a>
              you can also call:
            </p>
            <ul>
              <li>
                <code>run()</code> - runs the code in the editor (needs a
                runtime)
              </li>
              <li><code>stop()</code> - stops the code running</li>
              <li>
                <code>running</code> - property, whether the element is
                currently running
              </li>
            </ul>

            <p>
              The <code>runno-run</code> element can be styled with css
              variables to change the height of the individual
              <code>runno-editor</code> and <code>runno-terminal</code> elements
              inside.
            </p>

            <pre><code>runno-run {
/* Sets a specific height for the editor */
--runno-editor-height: auto;

/* Sets a maximum height for the editor */
--runno-editor-max-height: 60%;

/* Sets a specific height for the terminal */
--runno-terminal-height: auto;

/* Sets a minimum height for the terminal */
--runno-terminal-min-height: 4rem;
}</code></pre>

            <p>
              By default the editor will resize to fit the content you put
              inside it, and the terminal will be its minimum height. If you set
              the element to be a fixed height, they will share the space so
              that the editor gets 60% and the controls and terminal get the
              rest.
            </p>

            <h4><code>runno-editor</code></h4>
            <pre><code>&lt;runno-editor
syntax="Syntax" &lt;!-- optional --&gt;
runtime="Runtime" &lt;!-- optional --&gt;
code="string" &lt;!-- optional --&gt;
&gt;
&lt;!-- content is treated as code if not set as an attribute --&gt;
&lt;/runno-editor&gt;
</code></pre>
            <p>
              The editor doesn't do much by itself, but does provide a neat
              little instance of CodeMirror. You can also call:
            </p>
            <ul>
              <li><code>program</code> - gets the current program</li>
              <li>
                <code
                  >setProgram(syntax: Syntax, runtime: Runtime, code:
                  string)</code
                >
                - sets the current program
              </li>
            </ul>

            <h4><code>runno-terminal</code></h4>
            <pre><code>&lt;runno-terminal&gt;&lt;/runno-terminal&gt;</code></pre>
            <p>
              The terminal is responsible for actually running the code. Without
              a <code>runno-run</code> element to command it, it's a bit harder
              to use. But you might find something cool to do with it!
            </p>
            <ul>
              <li>
                <code
                  >writeFile(path: string, content: string | Buffer |
                  Uint8Array)</code
                >
                - writes a file to the local file system
              </li>
              <li>
                <code>stop()</code>
                - Stops the currently running program
              </li>
              <li>
                <code>focus()</code>
                - Focuses the input
              </li>
              <li>
                <code>clear()</code>
                - Clears the terminal
              </li>
            </ul>

            <h4><code>runno-controls</code></h4>
            <pre><code>&lt;runno-controls
running &lt;!-- optional, presence displays the stop button --&gt;
&gt;&lt;/runno-controls&gt;</code></pre>
            <p>
              The controls don't do much without being hooked up! When the
              buttons are clicked, they fire events:
            </p>

            <ul>
              <li>
                <code>runno-run</code>
                - when the run button is clicked
              </li>
              <li>
                <code>runno-stop</code>
                - when the stop button is clicked
              </li>
            </ul>

            <p>You can also cause these events to be triggered:</p>

            <ul>
              <li>
                <code>run()</code>
                - emits a run event
              </li>
              <li>
                <code>stop()</code>
                - emits a stop event
              </li>
            </ul>

            <h2 id="component-helpers">Helpers</h2>

            <h4><code>headlessRunCommand</code></h4>
            <pre><code>headlessRunCommand(
command: string,
fs: FS,
stdin?: string
): Promise&lt;RunResult&gt;</code></pre>
            <p>
              Same as <code>headlessUnsafeCommand</code> in the Host API. Handy
              if you want to use Runno's runtime without any UI.
            </p>

            <h4><code>class RunnoProvider</code></h4>
            <pre><code>class RunnoProvider(
terminal: TerminalElement,
editor: EditorElement,
controls?: ControlsElement
)</code></pre>
            <p>
              If you wanted to piece together the bits of a
              <code>runno-run</code> element, this is how you'd do it. Construct
              a <code>RunnoProvider</code>
              with a terminal, editor and controls then call it like it's a
              <code>RunnoHost</code>.
            </p>

            <h2>Integration</h2>
            <p>
              If you'd like to do more with the web components or runtime,
              please contact me. I'm quite interested in adding extra features!
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
