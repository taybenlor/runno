👨‍💻 **Use Runno** 👉 [Runno.dev](https://runno.dev/)

📖 **Documentation** 👉 [Runno.dev](https://runno.dev/docs/)

# Runno

Runno is a collection of JavaScript Packages for running code in various languages
inside a sandbox. It's made of the following packages:

- [`@runno/runtime`](https://github.com/taybenlor/runno/tree/main/packages/runtime) - web components and headless tools for running code examples in the browser.
- [`@runno/sandbox`](https://github.com/taybenlor/runno/tree/main/packages/sandbox) - a secure sandbox for running code examples in Node and other JS Runtimes.
- [`@runno/wasi`](https://github.com/taybenlor/runno/tree/main/packages/wasi) - an isomorphic package for running WebAssembly WASI binaries inside a sandbox.
- [`@runno/mcp`](https://github.com/taybenlor/runno/tree/main/packages/mcp) - an MCP Server for running code using the `@runno/sandbox` package.

There's also a Python package called [`runno`](https://github.com/taybenlor/runno/tree/main/sandbox)
that works like the sandbox package.

This project is powered by [WASI](https://wasi.dev) the Web Assembly System
Interface. It provides a standard way for programs to interact with an
operating system. By emulating this interface, we can provide a fake file system
and operating system, all running within JavaScript.

# Using `@runno/runtime`

The `@runno/runtime` package provides Web Components for running code in the browser.

This is very handy for programming education it means:

- No need for newbies to install complex programming tools to run code
- Programming examples can be made runnable in the browser with no server
- Simple programs can be tested for correctness inside a sandbox on the user's machine

## Quickstart

Start by adding `@runno/runtime` to your package:

```sh
npm install @runno/runtime
```

Import `@runno/runtime` in whatever place you'll be using the runno elements.
The simplest is in your entrypoint file (e.g. `main.ts` or `index.ts`).

```js
import "@runno/runtime";
```

Once you've imported them you can use runno elements on the page.

```html
<runno-run runtime="python" editor controls> print('Hello, World!') </runno-run>
```

For the code to run though, you'll need to set some HTTP headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

These create a [cross-origin isolated context](https://web.dev/cross-origin-isolation-guide/) which allows the use of `SharedArrayBuffer` used to implement STDIN.

## Supported Runtimes

The system supports a number of runtimes based on existing packages published to WAPM. These runtimes are tied to Runno and will be supported by Runno going forward.

- `python` - Runs python3 code, not pinned to a particular version but is at least `3.6`
- `ruby` - Runs standard Ruby, not pinned but is at least `3.2.0`
- `quickjs` - Runs JavaScript code using the [QuickJS](https://bellard.org/quickjs/) engine
- `sqlite` - Runs SQLite commands
- `clang` - Compiles and runs C code
- `clangpp` - Compiles and runs C++ code
- `php-cgi` - Runs PHP CGI compiled by VMWare

## Running WASI binaries

The runtime also provides a component for running WASI binaries directly.

```html
<runno-wasi src="/ffmpeg.wasm" autorun></runno-wasi>
```

## Examples

There are more examples for how to use Runno in the `examples` directory in this
repo. It includes practical ways you can use Runno, and how to configure it to
run.

## Full documentation

Visit [`@runno/runtime`](https://github.com/taybenlor/runno/tree/main/packages/runtime) to read the full documentation.

## How does it work?

Runno uses Web Assembly to run code from JavaScript. Code runs in a unix-like sandbox that connects to a web-based terminal emulator. This means it behaves a lot like running code natively on a linux terminal. It's not perfect, but it's handy for making code examples run.

Plus it's pretty cool that you can just run code in your browser!

# Using `@runno/sandbox`

## Quickstart

Install the sandbox with `npm install @runno/sandbox`. Then use it to run code
like:

```ts
import { runCode } from "@runno/sandbox";

const result = await runCode("ruby", "puts 'Hello, world!'");

if (result.resultType === "complete") {
  console.log(result.stdout);
} else {
  console.log("Oh no!");
}
```

You can also do more complicated things, like run against a virtual file system
with `runFS`:

```ts
function runFS(
  runtime: Runtime,
  entryPath: string,
  fs: WASIFS,
  options?: {
    stdin?: string;
    timeout?: number;
  }
): Promise<RunResult>;
```

# Using `@runno/wasi`

## Quickstart

The quickest way to get started with Runno is by using the `WASI.start` class
method. It will set up everything you need and run the Wasm binary directly.

Be aware that this will run on the main thread, not inside a worker. So you will
interrupt any interactive use of the browser until it completes.

```js
import { WASI } from "@runno/wasi";

//...

const result = WASI.start(fetch("/binary.wasm"), {
  args: ["binary-name", "--do-something", "some-file.txt"],
  env: { SOME_KEY: "some value" },
  stdout: (out) => console.log("stdout", out),
  stderr: (err) => console.error("stderr", err),
  stdin: () => prompt("stdin:"),
  fs: {
    "/some-file.txt": {
      path: "/some-file.txt",
      timestamps: {
        access: new Date(),
        change: new Date(),
        modification: new Date(),
      },
      mode: "string",
      content: "Some content for the file.",
    },
  },
});
```

You can see a more complete example in `src/main.ts`.

_Note: The `args` should start with the name of the binary. Like when you run
a terminal command, you write `cat somefile` the name of the binary is `cat`._

# Full documentation

Visit [`@runno/wasi`](https://github.com/taybenlor/runno/tree/main/packages/wasi) to read the full documentation including instructions for running inside a worker, and how the
virtual file-system works.

# Development

## Packages

This repo is broken down into a few packages using [lerna](https://lerna.js.org/):

- `website` - the runno website that includes instructions and examples
- `runtime` - a library that provides web components and helpers that can be bundled into your own project for using runno without an iframe
- `wasi` - a library for running WASI binaries in the browser
- `sandbox` - a sandbox for running programming languages from any JavaScript runtime
- `mcp` - an MCP Server implementation built on the `sandbox`

## Running locally

If you're lucky everything should work after doing:

```sh
npm install
npm run bootstrap
npm run build  # make sure the dependent libraries are built
npm run dev
```

## Testing

Runno has a small suite of tests, mostly focused on end-to-end integration. The `wasi` package has the most extensive suite of tests, comprehensively testing the WASI preview1 implementation. The other packages mostly have a few smoke tests to make sure they're working.

# About Runno

## Limitations

The programming languages available are limited by what has already been compiled to Web Assembly using WASI. A great way to help more languages become available would be to compile your favourite programming language tools to Web Assembly and upload them to WAPM.

WASI doesn't provide a full linux environment, so most system based interfaces won't work. Packages and modules are also difficult to install inside the Runno environment. If you want to import code, you'll need to provide that code alongside your example.

Runno is best for small code examples that use STDIN and STDOUT. That is typically the sort of thing that is taught in a CS1 course at university. This isn't an inherent limitation of the system though! As more work is put into Runno and the ecosystem of tools it depends on, more will become available.

## Security

I do want to say up front that Runno is Open Source software with an MIT
License, which specifically states:

```
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND
```

I stand by that lack of a warranty. But I also think the sandbox is pretty good
and I'd love to make it really good. It's fun.

The main way that the Runno sandbox isolates code is by running it as
WebAssembly inside V8. WebAssembly has some neat properties:

1. Execution is all virtualised, it's not running directly on your CPU and RAM
2. Code and Data are seperate, you can't jump into data
3. The only interface with the outside world is via user-provided functions

That last point (3) is the most important one. If you run a WebAssembly binary
and don't provide it with any functions it literally cannot do anything. It's
like a box with no windows or doors, nothing can get in or out.

But we do want some things to get in and out. That's what WASI is for. WASI is a
specification for an interface (the WebAssembly System Interface) that defines
a standard set of functions that a WebAssembly binary can call like they are
system calls. Mostly they do things like read and write files.

_Note: this is actually a definition of WASI preview1, preview2 / 0.2 is a
different beast and is very cool but currently out of scope._

Runno at it's core is an implementation of WASI preview1. It's kind of like a
very lightweight Operating System implemented in TypeScript. It has a virtual
file system which is made up of virtual files (basically just byte arrays stored
in memory). So it never accesses your real file system either. It also has no
network access or anything else like that.

So 1) it's a virtual machine, 2) it's a virtual file system, and 3) it has no
network access. That's pretty good.

There's a lot of layers to this onion which I think is pretty good. I've heard
onions are good for security. Tell me if you find some holes in my onion though,
I'm interested! Email [security@taybenlor.com](mailto:security@taybenlor.com).

# Big thanks to

A number of open-source projects and standards have been used to make Runno possible. These include:

- WASI and WebAssembly - a bunch of people from various working groups and especially the Bytecode Alliance have been involved in making WASM and WASI what it is today. Thanks heaps!

- [XTerm.js](https://xtermjs.org/) - a fully featured terminal that can be run in the browser

- [CodeMirror](https://codemirror.net) - a great web-based code editor that's always a delight to integrate

- [Wasmer](https://wasmer.io/), [WAPM](https://wapm.io/), and [WebAssembly.sh](https://webassembly.sh) - the Wasmer team have built a lot of great tools for running Web Assembly. WebAssembly.sh was a great inspiration and starting point.

- The extensive work by many in the web development community on making native code and APIs run successfully inside the browser.

Thanks to everyone who has built compatibility layers for the web. The web becomes a better platform with every new piece of software we can run on it!

Also big thanks to my friends who tolerate me constantly talking about WASM. Thanks especially to Shelley, Katie, Jesse, Jim, Odin, Hailey, Sam and other Sam.
