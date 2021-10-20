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

Then you'll be able to import `defineElements`.

```
import { defineElements } from '@runno/runtime'
```

And call it as part of your main script while the page loads.

```
defineElements();
```

Once you've called defineElements you can use runno elements on the page.

```
<runno-run runtime="python" editor controls>
print('Hello, World!')
</runno-run>
```
