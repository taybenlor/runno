# @runno/wasi - A WASI runner for the web

There are a bunch of different WASI runners out there, some of them even work in
the browser. This one is focused on sandboxed emulation. Not system integration.
It has been developed for the particular requirements of [Runno](runno.dev),
but you may find it useful as well.

This package allows you to run WASI binaries on the web with an emulated
filesystem. If the binary receives calls to stdin/out/err then you get callbacks
you'll need to handle. In future there may be other callbacks to intercept
interesting system level events, or hooks into the filesystem.

## Usage

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
    "some-file.txt": {
      path: "some-file.txt",
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
    "some-file.txt": {
      path: "some-file.txt",
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

## Run Tests

If this is the first time running tests, please run the prepare script first.
This will build the test programs and download existing test suites.

_You'll need to have cargo installed to run the tests_

```sh
$ npm run test:prepare
```

Then run the test suite:

```sh
$ npm run test
```

The test suite includes the following tests:

- args - tests of program args (mine)
- stdio - tests of stdio (mine)
- wasi-test-suite https://github.com/caspervonb/wasi-test-suite
  - core - the core WASI functionality called from assemblyscript
  - libc - WASI functionality called from libc (C)
  - libstd - WASI functionality called from libstd (Rust)
- [TODO] wasi-tests https://github.com/bytecodealliance/wasmtime/tree/main/crates/test-programs/wasi-tests
