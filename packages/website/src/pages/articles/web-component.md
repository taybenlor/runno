# The Web Component for Code

Since I released Runno a few years ago, Web Components have become a lot more
popular. I thought it was time to re-introduce Runno, the Web
Component for Code. Here's how to use it:

```html
<runno-run runtime="python" controls editor>
  print("Hello, World!") name = input("What's your name? ") print(f"G'day
  {name}, welcome to Runno.")
</runno-run>
```

And this is how that will display in the browser:

<div class="bg-lightGrey p-4 flow-root rounded">
<!-- prettier-ignore -->
<runno-run runtime="python" controls editor>
  print("Hello, World!")
  name = input("What's your name? ")
  print(f"G'day {name}, welcome to Runno.")
</runno-run>
</div>

Some details that are important here:

1. You can choose from several runtimes including: `python`, `ruby`, `quickjs`, and `clang`.
2. All code runs client-side in the browser, making it perfect for blogs, docs, and static sites.
3. The code interacts just like a normal terminal, allowing both input and output.
4. Code can be written directly into HTML or Markdown with syntax highlighting.

I'm not going to explore all the features of Runno here (I'd encourage you to
go check out the [docs](/docs/)) but I'll show you a few neat demos.

## Include extra files

If you want your code example to access files in the "filesystem" you can
use the `runno-file` element:

```html
<runno-run runtime="python" controls editor>
  print('file.txt contains:') print(open("file.txt").read())

  <runno-file path="/file.txt"> G'day world. Welcome to Runno. </runno-file>
</runno-run>
```

<div class="bg-lightGrey p-4 flow-root rounded mt-8">
<!-- prettier-ignore -->
<runno-run runtime="python" controls editor>
  print('file.txt contains:')
  print(open("file.txt").read())

  <runno-file path="/file.txt">
    G'day world.
    Welcome to Runno.
  </runno-file>
</runno-run>
</div>

You can also preload a complete virtual filesystem by specifying a `.tar.gz` archive using the `fs-url` attribute (like `<runno-run fs-url="/python-package.tar.gz">`).

## Syntax highlighting without running

If you only need to display formatted code without execution, you can use the
`runno-code` element:

```html
<runno-code syntax="js">import "@runno/runtime"</runno-code>
```

<div class="bg-lightGrey p-4 flow-root rounded mt-8">
<!-- prettier-ignore -->
<runno-code syntax="js" class="text-sm p-3 bg-darkSlate rounded-lg">import "@runno/runtime"</runno-code>
</div>

## Run code headlessly

For scenarios where you need to execute code programmatically without embedding
a UI, Runno provides a `headlessRunCode` API. This is useful for automating
tests, grading assignments, or validating user input.

Here's how that works:

```js
import { headlessRunCode } from "@runno/runtime";
const result = await headlessRunCode("python", "print('Hello World!')");
```

I can see this being really useful for education!

## Customise and Compose Runno

All the pieces that make up the `runno-run` element are available as
Web Components, and the element exposes a JavaScript API for its controls.
That means you can customise all the styling, or fully rebuild the component to
your own specifications.

For example, here I've created my own custom run button that I use to run the
code element:

```html
<button onclick="this.nextElementSibling.run()">My Custom Run Button</button>
<runno-run id="runnoElement" runtime="python">
  print('You clicked the button.')
</runno-run>
```

<div class="bg-lightGrey p-4 flow-root rounded mt-8 ">
<button onclick="this.nextElementSibling.run()" class="bg-teal rounded mb-4 p-4 font-bold">
  My Custom Run Button
</button>

<!-- prettier-ignore -->
<runno-run id="runnoElement" runtime="python" class="overflow-hidden">
  print('You clicked the button.')
</runno-run>
</div>

The full list of methods available is in the [`RuntimeMethods` docs](https://runno.dev/docs/runtime/types/RuntimeMethods.html). The different elements you can compose are in the
same docs.

## Contributions welcome

I'm still working on Runno and trying to make it better, it's an open source
project hosted on GitHub. Runno is open source and always evolving! If you’re
interested in contributing, check out the [GitHub repo](https://github.com/taybenlor/runno).
