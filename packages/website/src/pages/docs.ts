import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { Tailwind } from "../mixins/tailwind";

import "../components/scroll-highlight";
import "../components/header";

@customElement("page-docs")
export class PageDocs extends Tailwind(LitElement) {
  render() {
    return html`
      <website-header></website-header>
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
            <li class="text-yellow mt-2">
              <a href="#host-api">Host API</a>
            </li>
            <li class="pl-4">
              <a href="#host-quickstart">Quickstart</a>
            </li>
            <li class="pl-4">
              <a href="#host-how">How it works</a>
            </li>
            <li class="pl-4">
              <a href="#host-headers">Headers</a>
            </li>
            <li class="pl-4">
              <a href="#host-runtimes">Runtimes</a>
            </li>
            <li class="pl-4">
              <a href="#host-params">Params</a>
            </li>
            <li class="pl-4">
              <a href="#host-methods">Methods</a>
            </li>
            <li class="text-yellow mt-2">
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
            <h1 id="host-api">Host API</h1>
            <p>
              The Host API lets you control a Runno iframe and receive the
              resulting IO and filesystem. Runno exposes methods for setting the
              editor, adding files, and running code in interactive or headless
              modes. There's also a bunch of helpers.
            </p>
            <p>
              You'll need to be using a modern web stack that includes a bundler
              of some sort to use the Host API. If you get stuck,
              <a
                target="_blank"
                href="https://github.com/taybenlor/runno/blob/main/packages/host/src/index.ts"
              >
                the source is relatively easy to understand
              </a>
              .
            </p>

            <h2 id="host-quickstart">Quickstart</h2>

            <p>Start by adding <code>@runno/host</code> to your package:</p>

            <pre><code>$ npm install @runno/host</code></pre>

            <p>Then you'll be able to import <code>ConnectRunno</code>.</p>

            <pre><code>import { ConnectRunno } from '@runno/host'</code></pre>

            <p>And use it with an existing Runno iframe.</p>

            <pre><code>const runno = await ConnectRunno(iframe);</code></pre>

            <p>
              To run a code sample interactively use
              <code>interactiveRunCode</code>.
            </p>

            <pre><code>const { result } = await runno.interactiveRunCode("python", codeSample);</code></pre>

            <p>
              The result has properties for <code>stdin</code>,
              <code>stdout</code>, <code>stderr</code>, <code>tty</code>, and
              <code>fs</code> (the file system). This represents the input that
              the user has typed, the output they received, any errors displayed
              and the full terminal text (input, output and errors).
            </p>

            <p>
              If you want to run code without user input or output, you can use
              <code>headlessRunCode</code>.
            </p>

            <pre><code>const { result } = await runno.headlessRunCode("python", codeSample, stdin);</code></pre>

            <p>
              The <code>stdin</code> is optional, but necessary if the code
              expects input.
            </p>

            <h2 id="host-how">How it works</h2>
            <p>
              The connection between the iframe and the host is established via
              <code>postMessage</code> (
              <a
                target="_blank"
                href="https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage"
              >
                mdn docs </a
              >). Which is managed by the <code>post-me</code> npm package (
              <a target="_blank" href="https://github.com/alesgenova/post-me"
                >github repo</a
              >).
            </p>
            <p>
              Methods are exposed within the iframe that can be called using a
              promise-based interface. This makes it quite easy to integrate
              with your existing code while allowing the iframe to be hosted
              externally.
            </p>

            <h2 id="host-headers">Cross-Origin Headers</h2>

            <p>
              To get the best experience your page should provide a
              <a
                target="_blank"
                href="https://web.dev/cross-origin-isolation-guide/"
                >Cross-Origin Isolated context</a
              >
              so it can internally use <code>SharedArrayBuffer</code>. Without
              this Runno falls back to a lower performance hack that has the
              potential to break in the future.
            </p>

            <p>
              To make your website Cross-Origin Isolated set the following
              headers in your HTTP response:
            </p>

            <pre><code>Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp</code></pre>

            <p>
              You can test that your page is Cross-Origin Isolated by opening
              the browser console and checking
              <code>crossOriginIsolated</code> (see:
              <a
                target="_blank"
                href="https://developer.mozilla.org/en-US/docs/Web/API/crossOriginIsolated"
                >mdn docs</a
              >).
            </p>

            <h2 id="host-runtimes">Supported Runtimes</h2>

            <p>
              Runno supports a number of runtimes based on existing packages
              published to WAPM. These runtimes will be supported by Runno going
              forward, but may change in underlying binary implementation.
            </p>

            <ul>
              <li>
                <code>python</code> - Runs Python 3 code, not pinned to a
                particular version but is at least 3.6.
              </li>
              <li>
                <code>ruby</code> - Runs Ruby code, not pinned to a particular
                version but is at least 3.2.
              </li>
              <li>
                <code>quickjs</code> - Runs JavaScript code using the
                <a target="_blank" href="https://bellard.org/quickjs/"
                  >QuickJS engine</a
                >.
              </li>
              <li>
                <code>sqlite</code> - Runs SQLite commands. Currently just by
                piping SQL into the sqlite command.
              </li>
              <li>
                <code>clang</code> - Compiles and runs C code using Ben Smith's
                llvm fork (see:
                <a target="_blank" href="https://github.com/binji/wasm-clang"
                  >wasm-clang</a
                >).
              </li>
              <li>
                <code>clangpp</code> - Compiles and runs C++ code using the same
                llvm fork.
              </li>
            </ul>

            <p>
              Over time Runno will support more languages. If your favourite
              language isn't in this list then consider compiling its tools to
              Web Assembly and uploading them to WAPM. If you do that part I'll
              absolutely get support into Runno. For now it needs to be a WASI
              binary. Some good starting resources are
              <a
                target="_blank"
                href="https://00f.net/2019/04/07/compiling-to-webassembly-with-llvm-and-clang/"
              >
                this blog post
              </a>
              and
              <a target="_blank" href="https://github.com/wasienv/wasienv"
                >wasienv</a
              >.
            </p>

            <h2 id="host-params">Client Params</h2>

            <p>
              The client supports parameters which can be used to customise its
              look and behaviour. These can be set as query parameters as part
              of the url, like: <code>http://runno.run/?editor=0</code>
            </p>

            <ul>
              <li>
                <code>controls</code> - Whether to display controls, valid
                values are: <code>0</code> and <code>1</code>.
              </li>
              <li>
                <code>editor</code> - Whether to display the editor, valid
                values are: <code>0</code> and <code>1</code>.
              </li>
              <li>
                <code>autorun</code> - Whether to automatically run the given
                code on load, valid values are: <code>0</code> and
                <code>1</code>.
              </li>
              <li>
                <code>runtime</code> - Which runtime to use, see
                <a href="#host-runtimes">runtimes</a>.
              </li>
              <li>
                <code>code</code> - URL safe base64 string containing the code
                to use. See:
                <a
                  target="_blank"
                  href="https://github.com/commenthol/url-safe-base64"
                  >url-safe-base64</a
                >.
              </li>
            </ul>

            <h2 id="host-methods">Methods and Helpers</h2>

            <h3>Helpers</h3>

            <h4><code>generateEmbedURL</code></h4>
            <pre><code>export function generateEmbedURL(
code: string,
runtime: string,
options?: {
showControls?: boolean; // Default: true
showEditor?: boolean; // Default: true
autorun?: boolean; // Default: false
baseUrl?: string; // Default: "https://runno.run/"
}
): URL</code></pre>
            <p>
              Generates a URL that can be used as the <code>src</code> of an
              iframe to embed Runno. Arguments and options correspond to the
              options in <a href="#host-params">Client Params</a>.
            </p>

            <h4><code>generateEmbedHTML</code></h4>
            <pre><code>export function generateEmbedHTML(url: URL): string</code></pre>
            <p>
              Generates a string representing the HTML for an iframe that can be
              embedded. It generates the same embed HTML as on this website.
            </p>

            <h4><code>ConnectRunno</code></h4>
            <pre><code>export async function ConnectRunno(
iframe: HTMLIFrameElement
): Promise&lt;RunnoHost&gt;</code></pre>
            <p>
              Connects to the Runno instance in the passed iframe. Returns a
              <code>RunnoHost</code> object that can be used to control the
              Runno client iframe.
            </p>

            <h3 id="runno-host"><code>RunnoHost</code> methods</h3>

            <p>
              These methods are all exposed on the <code>RunnoHost</code> object
              returned by <code>ConnectRunno</code>.
            </p>

            <h4><code>showControls</code></h4>
            <pre><code>showControls(): Promise&lt;void&gt;</code></pre>
            <p>Shows the controls (run button).</p>

            <h4><code>hideControls</code></h4>
            <pre><code>hideControls(): Promise&lt;void&gt;</code></pre>
            <p>Hides the controls (run button).</p>

            <h4><code>showEditor</code></h4>
            <pre><code>showEditor(): Promise&lt;void&gt;</code></pre>
            <p>Shows the editor.</p>

            <h4><code>hideEditor</code></h4>
            <pre><code>hideEditor(): Promise&lt;void&gt;</code></pre>
            <p>Hides the editor.</p>

            <h4><code>setEditorProgram</code></h4>
            <pre><code>setEditorProgram(
syntax: Syntax,
runtime: Runtime,
code: string
): Promise&lt;void&gt;</code></pre>
            <p>
              Sets the program in the editor, how to highlight it, and how to
              run it. <code>Syntax</code> can be <code>python</code>,
              <code>ruby</code>, <code>js</code>, <code>sql</code>,
              <code>cpp</code>, or <code>undefined</code>.
            </p>

            <h4><code>getEditorProgram</code></h4>
            <pre><code>getEditorProgram(): Promise&lt;string&gt;</code></pre>
            <p>Gets the current program in the editor.</p>

            <h4><code>interactiveRunCode</code></h4>
            <pre><code>interactiveRunCode(runtime: Runtime, code: string): Promise&lt;RunResult&gt;</code></pre>
            <p>
              Runs some code interactively using the given <code>Runtime</code>.
              It does not change or update the program in the editor.
            </p>

            <h4><code>interactiveRunFS</code></h4>
            <pre><code>interactiveRunFS(
runtime: Runtime,
entryPath: string,
fs: FS
): Promise&lt;RunResult&gt;</code></pre>
            <p>
              Runs a filesystem object interactively using the given
              <code>Runtime</code>. The <code>entryPath</code> is used as the
              "main" file to run. It does not change or update the program in
              the editor.
            </p>

            <h4><code>interactiveUnsafeCommand</code></h4>
            <pre><code>interactiveUnsafeCommand(command: string, fs: FS): Promise&lt;RunResult&gt;</code></pre>
            <p>
              Runs a concrete command in a similar way to
              <a target="_blank" href="https://webassembly.sh">
                webassembly.sh </a
              >. This is internally used to support Runno's runtimes. You could
              use this to pull your own packages from WAPM and run them.
            </p>

            <h4><code>interactiveStop</code></h4>
            <pre><code>interactiveStop(): Promise&lt;void&gt;</code></pre>
            <p>
              Stops the currently running program. The result will be returned
              as usual by the <code>Promise</code> associated with the call that
              started running code.
            </p>

            <h4><code>headlessRunCode</code></h4>
            <pre><code>headlessRunCode(
runtime: Runtime,
code: string,
stdin?: string
): Promise&lt;RunResult&gt;</code></pre>
            <p>
              Runs code headlessly. The user will not have an opportunity to
              interact with this code. You can provide <code>stdin</code> to
              specify the input. This is useful for testing code a user has
              written.
            </p>

            <h4><code>headlessRunFS</code></h4>
            <pre><code>headlessRunFS(
runtime: Runtime,
entryPath: string,
fs: FS,
stdin?: string
): Promise&lt;RunResult&gt;</code></pre>
            <p>
              Corresponding headless version of running with an FS. See:
              <code>interactiveRunFS</code>
            </p>

            <h4><code>headlessUnsafeCommand</code></h4>
            <pre><code>headlessUnsafeCommand(
command: string,
fs: FS,
stdin?: string
): Promise&lt;RunResult&gt;</code></pre>
            <p>
              Corresponding headless version of running an unsafe command. See:
              <code>interactiveUnsafeCommand</code>
            </p>

            <h3 class="host-types">Important Types</h3>

            <h4><code>Runtime</code></h4>
            <pre><code>export type Runtime = "python" | "quickjs" | "sqlite" | "clang" | "clangpp" | "ruby";</code></pre>
            <p>Runtimes that Runno supports.</p>

            <h4><code>Syntax</code></h4>
            <pre><code>export type Syntax = "python" | "js" | "sql" | "cpp" | "ruby" | undefined;</code></pre>
            <p>Syntax highlighting options that the Runno editor supports.</p>

            <h4><code>CommandResult</code></h4>
            <pre><code>export type CommandResult = {
stdin: string;
stdout: string;
stderr: string;
tty: string;
fs: FS;
exit: number;
};</code></pre>
            <p>The result from running a command.</p>

            <h4><code>RunResult</code></h4>
            <pre><code>export type RunResult = {
result?: CommandResult;
prepare?: CommandResult;
};</code></pre>
            <p>
              The result from running using Runno. If the runtime has a
              compilation or other type of preparation then the output from this
              step will be in the optional <code>prepare</code> field.
            </p>

            <h4><code>FS</code></h4>
            <pre><code>export type FS = {
[name: string]: File;
};</code></pre>
            <p>
              A snapshot of a filesystem that can be passed to Runno. If folders
              are necessary the slashes should be part of the <code>name</code>.
            </p>

            <h4><code>File</code></h4>
            <pre><code>export type File = {
name: string;
content: string | Uint8Array;
};</code></pre>
            <p>A snapshot of a file that can be passed to Runno.</p>
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

            <p>Then you'll be able to import <code>defineElements</code>.</p>

            <pre><code>import { defineElements } from '@runno/runtime'</code></pre>

            <p>And call it as part of your main script while the page loads.</p>

            <pre><code>defineElements();</code></pre>

            <p>
              Once you've called <code>defineElements</code> you can use runno
              elements on the page.
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
            <p>Some things work differently without the iframe:</p>
            <ul>
              <li>
                For browsers that don't support
                <code>SharedArrayBuffer</code> the fallback is a prompt. It's
                possible to fix this with a <code>ServiceWorker</code>. Contact
                me if you need help.
              </li>
              <li>
                Without the iframe as an extra layer, some security mitigations
                won't work. For example: it will be easier to lock up the tab
                with an infinite loop.
              </li>
              <li>There's no <code>autorun</code> option.</li>
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
                <code
                  >runCommand(command: string): Promise&lt;RunResult&gt;</code
                >
                - Runs a raw command (see:
                <code>interactiveUnsafeCommand</code>)
              </li>
              <li>
                <code>isReadyForCommand()</code>
                - Whether it's ready for a command (not running one)
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
