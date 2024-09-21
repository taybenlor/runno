👨‍💻 **Use Runno** 👉 [Runno.dev](https://runno.dev/)

📖 **Documentation** 👉 [Runno.dev](https://runno.dev/docs)

# Runno Runtime

The `@runno/runtime` implements all the core features to make code run. It also
exports Web Components that can be used to create runno instances in your code
without using iframes.

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

## Headless Usage

Runno supports a headless API.

```
import { headlessRunCode, headlessRunFS } from "@runno/runtime";
```

You can use this headless API to run code in a particular language without
having to use the DOM. For example:

```
const result = await headlessRunCode("python", "print('Hello World!')");
```

If you want to provide more than a single code snippet, you can use
`headlessRunFS` to provide each of the files, and the entrypoint file.

## Styling

The <code>runno-run</code> element can be styled with css
variables to change the height of the individual
<code>runno-editor</code> and <code>runno-terminal</code> elements
inside.

```css
runno-run {
  /* Sets a specific height for the editor */
  --runno-editor-height: auto;

  /* Sets a maximum height for the editor */
  --runno-editor-max-height: 60%;

  /* Sets a specific height for the terminal */
  --runno-terminal-height: auto;

  /* Sets a minimum height for the terminal */
  --runno-terminal-min-height: 4rem;
}
```

By default the editor will resize to fit the content you put
inside it, and the terminal will be its minimum height. If you set
the element to be a fixed height, they will share the space so
that the editor gets 60% and the controls and terminal get the
rest.

## Local Development

Start by starting the `packages/website` server as that is where the langs get served from

```bash
cd packages/website && npm i && npm run build && npm run dev
```

## How to attach a debugger in a TS project:

1. cd into the directory that has vite.config.js
2. Execute `npm run dev`
3. On the command palette, Run the `Debug: packages/runtime` debugger

## How to attach a debugger to debug a nodejs library in a TS project:

https://maximomussini.com/posts/debugging-javascript-libraries#using-a-local-library-

### Problem: If you simply attach a debugger, and try to step into a library import, it will show the transpiled JS code and not the ts code. If you want to step into the ts library code then do the following:

Please add the following to `tsconfig.json` to both the project and the cloned library locally

1. tsconfig.json: compilerOptions: {
   "sourceMap": true,
   "inlineSources": true,
   }

2. vite.config.js —> build.sourcemap: true

3. Clone the library to de-bugged locally in a sibling folder
4. cd into the library and execute the following:
   1. npm link
   2. npm dev
5. cd into the project directory that has vite.config.js
   1. npm link <NAME OF LIBRARY AS DEFINED IN ITS PACKAGE.JSON>
   2. npm dev
6. On the command palette, enter `> Debug: Open link` and then enter the `url` or pick the correct debugger config from vscode
