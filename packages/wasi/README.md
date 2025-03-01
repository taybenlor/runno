# A WASI runner for the web (`@runno/wasi`)

There are a bunch of different WASI runners out there, some of them even work in
the browser. This one is focused on sandboxed emulation. Not system integration.
It has been developed for the particular requirements of [Runno](runno.dev),
but you may find it useful as well.

This package allows you to run WASI binaries on the web with an emulated
filesystem. If the binary receives calls to stdin/out/err then you get callbacks
you'll need to handle. In future there may be other callbacks to intercept
interesting system level events, or hooks into the filesystem.

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

## Custom Instantiation

There are two parts to running a WASI binary with Runno. The `WASI` instance
which represents the emulated system, and the WebAssembly runtime provided by
the browser. If you'd like to customise the way the WebAssembly runtime is
instantiated, you can split these parts up.

```js
import { WASI } from "@runno/wasi";

// First set up the WASI emulated system
const wasi = new WASI({
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

const myMemory = new WebAssembly.Memory({ initial: 32, maximum: 10000 });

// Then instantiate your binary with the imports provided by the wasi object
const wasm = await WebAssembly.instantiateStreaming(fetch("/binary.wasm"), {
  ...wasi.getImportObject(),

  // Your own custom imports (e.g. custom memory)
  env: {
    memory: myMemory,
  },
});

// Finally start the WASI binary (with the custom memory)
const result = wasi.start(wasm, {
  memory: myMemory,
});
```

If you are working with a Reactor instead of a command, you can instead use:

```js
const exports = wasi.initialize(wasm, {
  memory: myMemory,
});
```

The returned exports will be the exports from your WebAssembly module.

## Using the WASIWorker

A worker is provided for using the WASI runner outside of the main thread. It
requires the availability of `SharedArrayBuffer` which is only available when
the browser is Cross-Origin Isolated (see below).

### Using the WASIWorkerHost

The `WASIWorkerHost` will create a worker and then communicate with it. In this
mode `stdin` does not work as a callback, instead it must be pushed onto a
buffer which is then handled asynchronously. See `@runno/runtime` for examples
on how to do this.

```ts
import { WASIWorkerHost } from "@runno/wasi";

// ...

const workerHost = new WASIWorkerHost(binaryURL, {
  args: ["binary-name", "--do-something", "some-file.txt"],
  env: { SOME_KEY: "some value" },
  stdout: (out) => console.log("stdout", out),
  stderr: (err) => console.error("stderr", err),
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

const result = await workerHost.start();

// ... Somewhere else

workerHost.pushStdin("Some text from the user");
```

The `WASIWorkerHost` will manage fetching the WASM binary and the WASIContext.
If you've already fetched the binary you can use `URL.createObjectURL` to get a
valid URL.

### Cross-Origin Headers

To get `SharedArrayBuffer` to work on your page you must provide a
[Cross-Origin Isolated](https://web.dev/cross-origin-isolation-guide/) context.

To make your website Cross-Origin Isolated set the following headers in your
HTTP response:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

You can test that your page is Cross-Origin Isolated by opening the browser
console and checking `crossOriginIsolated` (see: [mdn docs](https://developer.mozilla.org/en-US/docs/Web/API/crossOriginIsolated)).

## Initializing a WASI Reactor

Reactors are modules that respond to calls, rather than running as a command.

You can initialize a WASI Reactor with `initialize` instead of `start`:

```js
import { WASI } from "@runno/wasi";

//...

const exports = WASI.initialize(fetch("/binary.wasm"), {
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

The `WASI.initialize` call will return the exports from the WebAssembly module.

## The filesystem

`@runno/wasi` internally emulates a unix-like filesystem (FS) from a flat
structure. All files must start with a `/` to indicate they are in the root
directory. The `/` directory is preopened by `@runno/wasi` for your WASI binary
to use.

Paths provided to the FS can include directory names `/like/this.png`. The FS
will treat files with the same prefix `/like/so.png` as if they are in the same
folder. Any folders created will contain an empty `.runno` file `/like/.runno`
as a placeholder.

WASI has a complex permissions system that is entirely ignored. All files you
provide can be accessed by the WASI binary, with all permissions.

## Which WASI standards are supported?

Currently `@runno/wasi` supports running only `unstable` and `snapshot-preview1`
WASI binaries. The `snapshot-preview1` standard is more recent, and preferred.
Additionally its likely some details of `unstable` have been missed. If you spot
these, please file a bug.

Other extension standards like WASMEdge, and WASIX are currently not supported,
but could be. WASI Modules are also not supported, but I'm interested in
learning more about them.

# Contributing

The most useful way to contribute to `@runno/wasi` is to add tests. Particularly
if you find something that doesn't work!

## Running Tests

If this is the first time running tests, please run the prepare script first.
This will build the test programs and download existing test suites.

_You'll need to have cargo installed to run the tests_

```sh
npm run test:prepare
```

Then run the test suite:

```sh
npm run test
```

The test suite includes the following tests:

- args - tests of program args (mine)
- stdio - tests of stdio (mine)
- wasi-test-suite https://github.com/caspervonb/wasi-test-suite
  - core - the core WASI functionality called from assemblyscript
  - libc - WASI functionality called from libc (C)
  - libstd - WASI functionality called from libstd (Rust)
- [TODO] wasi-tests https://github.com/bytecodealliance/wasmtime/tree/main/crates/test-programs/wasi-tests
