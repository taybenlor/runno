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

1. You can choose from a handful of runtimes including: `python`, `ruby`, `quickjs`, and `clang`.
2. The code all runs client-side in the browser - perfect for blogs, docs, and static websites
3. While running, you can input and output just like a normal terminal
4. You type code straight into HTML or Markdown and it will get dressed up and syntax highlighted

I'm not going to explore all the features of Runno here (I'd encourage you to
go check out the [docs](/docs/)) but I'll show you a few neat demos.

## Include extra files

If you want your code example to access files in the "filesystem" you can
use the `runno-file` element:

```html
<runno-run runtime="python" controls editor>
  print('file.txt contains:') print(open("file.txt").read()) print('----')
  print('other-file.txt contains:') print(open("other-file.txt").read())

  <runno-file path="/file.txt"> G'day world. Welcome to Runno. </runno-file>
  <runno-file path="/other-file.txt"> Another file. </runno-file>
</runno-run>
```

<div class="bg-lightGrey p-4 flow-root rounded mt-8">
<!-- prettier-ignore -->
<runno-run runtime="python" controls editor>
  print('file.txt contains:')
  print(open("file.txt").read())
  print('----')
  print('other-file.txt contains:')
  print(open("other-file.txt").read())

  <runno-file path="/file.txt">
    G'day world.
    Welcome to Runno.
  </runno-file>
  <runno-file path="/other-file.txt">
    Another file.
  </runno-file>
</runno-run>
</div>

Or you can upload a `.tar.gz` file that represents your whole filesystem using
the `fs-url="/python-package.tar.gz"` attribute.

## Syntax highlighting without running

Runno also ships a `runno-code` element that you can use to syntax highlight
without running code:

```html
<runno-code syntax="js">import "@runno/runtime"</runno-code>
```

<div class="bg-lightGrey p-4 flow-root rounded mt-8">
<!-- prettier-ignore -->
<runno-code syntax="js" class="text-sm p-3 bg-darkSlate rounded-lg">import "@runno/runtime"</runno-code>
</div>

## Run code headlessly

You can run code headlessly from JS if you want to do your own custom tasks:

```js
import { headlessRunCode } from "@runno/runtime";
const result = await headlessRunCode("python", "print('Hello World!')");
```

You could, for example, use this to run tests against the code that a user has
written. I can see this being really useful for education!

## Customise and Compose Runno

All the pieces that make up the `runno-run` element are available as
Web Components, and the element exposes a JavaScript API for its controls.
That means you can customise all the styling, or fully rebuild the component to
your own specifications.

```html
<button onclick="this.nextElementSibling.run()">My Custom Run Button</button>
<runno-run id="runnoElement" runtime="python" editor>
  print('You clicked the button.')
</runno-run>
```

<div class="bg-lightGrey p-4 flow-root rounded mt-8 ">
<button onclick="this.nextElementSibling.run()" class="bg-teal rounded mb-4 p-4 font-bold">
  My Custom Run Button
</button>

<!-- prettier-ignore -->
<runno-run id="runnoElement" runtime="python" editor class="overflow-hidden">
  print('You clicked the button.')
</runno-run>
</div>

The full list of methods available is in the [`RuntimeMethods` docs](https://runno.dev/docs/runtime/types/RuntimeMethods.html). The different elements you can compose are in the
same docs.

## Contributions welcome

I'm still working on Runno and trying to make it better, it's an open source
project hosted on GitHub. If you'd like to expand the possibilities, I'd love
to chat about how we can do that!
