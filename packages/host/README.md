👨‍💻 **Use Runno** 👉 [Runno.dev](https://runno.dev/)

📖 **Documentation** 👉 [Runno.dev](https://runno.dev/#host-api)

# Runno Host

This packages is meant to be used in concert with a `https://runno.run` client
iframe. The easiest way to create one is on the [Runno Website](https://runno.dev).

## Quickstart

Start by adding `@runno/host` to your package:

```
$ npm install @runno/host
```

Then you'll be able to import ConnectRunno.

```
import { ConnectRunno } from '@runno/host'
```

And use it with an existing Runno iframe.

```
const runno = await ConnectRunno(iframe);
```

To run a code sample interactively use interactiveRunCode.

```
const result = await runno.interactiveRunCode("python", codeSample);
```

The result has properties for stdin, stdout, stderr, tty, and fs (the file system). This represents the input that the user has typed, the output they received, any errors displayed and the full terminal text (input, output and errors).

If you want to run code without user input or output, you can use headlessRunCode.

```
const result = await runno.headlessRunCode("python", codeSample, stdin);
```

The stdin is optional, but necessary if the code expects input.

## Cross-Origin Headers

To get the best experience your page should provide a [Cross-Origin Isolated](https://web.dev/cross-origin-isolation-guide/) context so it can internally use SharedArrayBuffer. Without this Runno falls back to a lower performance hack that has the potential to break in the future.

To make your website Cross-Origin Isolated set the following headers in your HTTP response:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

You can test that your page is Cross-Origin Isolated by opening the browser console and checking `crossOriginIsolated` (see: [mdn docs](https://developer.mozilla.org/en-US/docs/Web/API/crossOriginIsolated)).
