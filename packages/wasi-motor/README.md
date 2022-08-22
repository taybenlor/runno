# @runno/wasi-motor - A WASI runner for the web

There are a bunch of different WASI runners out there, some of them even work in
the browser. This one is focused on the particular requirements of
[Runno](runno.dev), but you may find it useful as well.

This package allows you to run WASI binaries on the web with an emulated
filesystem. If the binary receives calls to stdin/out/err then you get callbacks
you'll need to handle. In future there may be other callbacks to intercept
interesting system level events.

## Usage

```js
import { WASI, WASIContext } from "@runno/wasi-motor";

//...

const context = new WASIContext({
  args: ["your-wasi-binary", "--do-something", "some-file.txt"],
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

const result = WASI.start(fetch("/your-wasi-binary.wasm"), context);
```

You can see a more complete example in `src/main.ts`.

## Run Tests

If this is the first time running tests, please run the prepare script first.
This will build the test programs and download existing test suites.

```sh
$ npm run test:prepare
```

Then run the test suite:

```sh
$ npm run test
```
