👨‍💻 **Use Runno** 👉 [Runno.dev](https://runno.dev/)

📖 **Documentation** 👉 [Runno.dev](https://runno.dev/#know-runno)

# Runno

Runno helps you make runnable code examples that can be embedded in web pages.

This project is powered by [WASI](https://wasi.dev) the Web Assembly System
Interface. It provides a standard way for programs to interact with an
operating system. By emulating this interface, we can provide a fake file system
and operating system, all running within the browser. Then we can run
programming languages in the browser, without modification.

This is very handy for programming education it means:

- No need for newbies to install complex programming tools to run code
- Programming examples can be made runnable in the browser with no server
- Simple programs can be tested for correctness inside a sandbox on the user's machine

Runno also ships its own WASI runtime ([`@runno/wasi`](https://github.com/taybenlor/runno/tree/main/packages/wasi)) which is used to power
Runno under the hood. It can be used independently to run WASI binaries in the
browser.

## Two parts to Runno

There are two main parts to runno:

1. `@runno/runtime` - web components and headless tools for running code examples in the browser.
2. `@runno/wasi` - an implementation of WASI made for the browser.

The `@runno/runtime` is built on top of the primitives provided by `@runno/wasi`.

# Using `@runno/runtime`

## Quickstart

Start by adding `@runno/runtime` to your package:

```
$ npm install @runno/runtime
```

Import `@runno/runtime` in whatever place you'll be using the runno elements.
The simplest is in your entrypoint file (e.g. `main.ts` or `index.ts`).

```
import '@runno/runtime';
```

Once you've imported them you can use runno elements on the page.

```
<runno-run runtime="python" editor controls>
print('Hello, World!')
</runno-run>
```

For the code to run though, you'll need to set some HTTP headers:

```HTTP
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

```
<runno-wasi src="/ffmpeg.wasm" autorun></runno-wasi>
```

## Examples

There are more examples for how to use Runno in the `examples` directory in this
repo. It includes practical ways you can use Runno, and how to configure it to
run.

# Full documentation

Visit [`@runno/runtime`](https://github.com/taybenlor/runno/tree/main/packages/runtime) to read the full documentation.

# Using `@runno/wasi`

## Quickstart

There are two parts to running a WASI binary with Runno. The `WASI` instance
which does the actual running and the `WASIContext` which sets up an environment
to run the binary in.

Be aware that this will run on the main thread, not inside a worker. So you will
interrupt any interactive use of the browser until it completes.

```js
import { WASI, WASIContext } from "@runno/wasi";

//...

const context = new WASIContext({
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

const result = WASI.start(fetch("/binary.wasm"), context);
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
- `client` - **DEPRECATED** a static website that exposes the runno runtime to be embedded as an iframe
- `host` - **DEPRECATED** helpers for running code on the client from another website

## Running locally

If you're lucky everything should work after doing:

```
$ npm install
$ npm run bootstrap
$ npm run build  # make sure the dependent libraries are built
$ npm run dev
```

At that point you should be able to navigate to:

- `localhost:4321` - Website
- `localhost:1234` - Client

If you're unlucky then you might have to run the two independently. In two different terminal sessions do:

```
$ cd packages/client
$ npm run dev
```

and

```
$ cd packages/website
$ npm run dev
```

If you edit `host`, `terminal`, `wasi` or `runtime` you will need to re-build them with `npm run build`.

## Testing

Coming soon!

# About Runno

## How does it work?

Runno uses Web Assembly to run code in the browser. Code runs in a unix-like sandbox that connects to a web-based terminal emulator. This means it behaves a lot like running code natively on a linux terminal. It's not perfect, but it's handy for making code examples run.

When you click run on a Runno example the web assembly binary for that programming language is collected from [WAPM](wapm.io) (the Web Assembly Package Manager). It's then run in a Web Worker, inside a sandbox with an in-memory file system. It's connected up to a terminal emulator and simple IO is routed back and forth.

## Why run in the browser?

The way Runno is built shifts the work of running code examples from the server to the client. Running code examples on your server is risky, it means having to implement protections from potentially hostile clients and limiting resources. This means that it's difficult to build a system that is open for anyone to use.

If you're just writing a blog post, your own course, or writing documentation it's going to be difficult to implement this. You really want to use something that someone else has built. But that would mean running on their servers, which is going to cost them money! By running on the client you eliminate needing any third party involvement.

Plus it's pretty cool that you can just run code in your browser!

## Limitations

The programming languages available are limited by what has already been compiled to Web Assembly using WASI and uploaded to WAPM. A great way to help more languages become available would be to compile your favourite programming language tools to Web Assembly and upload them to WAPM.

WASI doesn't provide a full linux environment, so most system based interfaces won't work. Packages and modules are also difficult to install inside the Runno environment. If you want to import code, you'll need to provide that code alongside your example.

Runno is best for small code examples that use STDIN and STDOUT. That is typically the sort of thing that is taught in a CS1 course at university. This isn't an inherent limitation of the system though! As more work is put into Runno and the ecosystem of tools it depends on, more will become available.

## Security

Running arbitrary code is always going to have some security risks, even if you're running it on the client. The goal of the Runno sandbox is to make it as safe as possible for a client to press run. They should be able to trust that their browser won't do anything they don't expect it to do.

Because Runno runs within the browser on the client, you don't have to worry about it damaging your servers. But we also need to make sure Runno won't damage your clients.

There are two main layers of sandboxing that help make Runno secure:

1. By running as WebAssembly we create a layer of sandboxing, any system resources that the binary wants have to be passed through a layer of JavaScript that Runno controls.
2. By embedding Runno inside an iframe from another domain we sandbox it from any secrets inside your webpage. This prevents Runno from having access to cookies or from making API calls as a user.

With these two layers combined it's difficult for a user to hurt themselves, for you to hurt a user, or for users to hurt each other. But that doesn't mean Runno is 100% safe.

Runno can quite easily be used to hog resources on a client. An infinite loop can lock up a tab. Large binaries can potentially be dynamically loaded from WAPM, using surprising amounts of bandwidth. While not ideal, these are typical risks a user has in navigating to any website.

The intention is for Runno to either disclose security risks upfront, or to fix them. So if you find a security issue with the way Runno works, please [contact me](security@make.expert)!

# Big thanks to

A number of open-source projects and standards have been used to make Runno possible. These include:

- WASI and WebAssembly - a bunch of people from various working groups and especially the Bytecode Alliance have been involved in making WASM and WASI what it is today. Thanks heaps!

- [XTerm.js](https://xtermjs.org/) - a fully featured terminal that can be run in the browser

- [CodeMirror](https://codemirror.net) - a great web-based code editor that's always a delight to integrate

- [Wasmer](https://wasmer.io/), [WAPM](https://wapm.io/), and [WebAssembly.sh](https://webassembly.sh) - the Wasmer team have built a lot of great tools for running Web Assembly. WebAssembly.sh was a great inspiration and starting point.

- The extensive work by many in the web development community on making native code and APIs run successfully inside the browser.

Thanks to everyone who has built compatibility layers for the web. The web becomes a better platform with every new piece of software we can run on it!

Also big thanks to my friends who tolerate me constantly talking about WASM. Thanks especially to Shelley, Katie, Jesse, Jim, Odin, Hailey, Sam and other Sam.
