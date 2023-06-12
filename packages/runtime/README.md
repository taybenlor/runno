👨‍💻 **Use Runno** 👉 [Runno.dev](https://runno.dev/)

📖 **Documentation** 👉 [Runno.dev](https://runno.dev/#web-components)

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
