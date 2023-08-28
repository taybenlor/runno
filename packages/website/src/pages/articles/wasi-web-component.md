# Running WASI binaries from your HTML using Web Components

Web Components are a really interesting API for JavaScript libraries. Here's a
Web Component I've built that can run WASI binaries. **Click the Run button**

<runno-wasi src="https://assets.runno.dev/ffmpeg/ffmpeg.wasm" controls></runno-wasi>

The HTML is very simple:

```html
<runno-wasi src="https://assets.runno.dev/ffmpeg/ffmpeg.wasm" controls>
</runno-wasi>
```

And it runs `ffmpeg`!

## Background

As part of recent work to make Runno hosted on its own browser-specific
[WASI](https://wasi.dev) runtime I built my own implementation of WASI
([`@runno/wasi`](/wasi)). After building the implementation, I rewrote the way
the main Runno package works to use my own WASI implementation under-the-hood.
Because Runno is all about using Web Components to run short snippets of code
directly from HTML, I realised it would be neat to also support running WASI
binaries this way.

It needs the same setup that a normal Runno runtime needs, you need to be in a
Cross-Origin Isolated Context, and you need to include the `@runno/runtime`
package ([see the docs](/docs)), but once you've done that it's pretty
straightforward to run WASI binaries. That opens up a bunch of ways to run
CLI tools in your web browser, whether they're built in Rust, C, Zig, C# or the
variety of other languages that support compiling to WASI.

_Note: If you're lost about what the heck WASI is, it stands for WebAssembly
System Interface. It's a standard interface for WASM (WebAssembly) binaries to
interact with a host (like an OS). In a binary built for an old Intel mac the
target might be `x86-macos`. In that string `x86` is the CPU and `macos` is the
operating system. These binaries are `wasm-wasi` so WASM is the CPU, and WASI is
the operating system._

## Examples

Running a CLI program with no args is very simple.

```html
<runno-wasi src="https://assets.runno.dev/ffmpeg/ffmpeg.wasm" controls>
</runno-wasi>
```

<runno-wasi src="https://assets.runno.dev/ffmpeg/ffmpeg.wasm" controls></runno-wasi>

You specify the `src` of the WASI binary as an attribute, just like an `img`.
I've used `controls` to give it a run button. If you want it to automatically
run, then specify `autorun` as an attribute. In this example we're running
`ffmpeg` with no args, and no files. You'll notice that terminal output is
automatically displayed, this terminal can be styled with CSS
([docs](/docs/runtime/)).

Running `ffmpeg` without anything in the filesystem isn't particularly useful,
so lets look at how we can add files to the `runno-wasi` element. The simplest
way to do this is with the `runno-file` element.

<!-- prettier-ignore -->
```html
<runno-wasi
  src="https://assets.runno.dev/examples/cat.wasi.wasm"
  args="/foo.txt /bar.txt"
  controls
>
  <runno-file path="/foo.txt">
    Hello, World!
  </runno-file>
  <runno-file path="/bar.txt">
    Lets concatenate these files.
  </runno-file>
</runno-wasi>
```

<runno-wasi src="https://assets.runno.dev/examples/cat.wasi.wasm" args="/foo.txt /bar.txt" controls>
  <!-- prettier-ignore -->
  <runno-file path="/foo.txt">
    Hello, World!
  </runno-file>
  <!-- prettier-ignore -->
  <runno-file path="/bar.txt">
    Lets concatenate these files.
  </runno-file>
</runno-wasi>

In this example I'm using a `cat` program implemented in Rust ([source](https://gist.github.com/taybenlor/da708221070d96616f1886b88f4a6728)). This program concatenates two
files passed as arguments. I've configured the two files by using `runno-file`
elements. The `path` attribute specifies the full path of these files in the
filesystem and must start with `/`.

Then to tell `cat` what the two files are, I've passed `args` as an attribute to
the element. This is just like your args in a shell, a space seperated string
that is passed to the program as part of execution. Putting it all together we
get **concatenation**!

Specifying files this way is neat, but it's going to be hard to use with
`ffmpeg`, we'd need to write out the video file as text in the web browser, and
I'm not sure HTML escape codes are up to the task. So instead we can specify a
`url` attribute on those `wasi-file` elements to have them pull down their
content from a URL.

```html
<runno-wasi
  src="https://assets.runno.dev/ffmpeg/ffprobe.wasm"
  args="/serenity.mp4"
  controls
>
  <runno-file
    path="/serenity.mp4"
    url="https://assets.runno.dev/ffmpeg/serenity.mp4"
  >
  </runno-file>
</runno-wasi>
```

<runno-wasi src="https://assets.runno.dev/ffmpeg/ffprobe.wasm" args="/serenity.mp4" controls>
<runno-file path="/serenity.mp4" url="https://assets.runno.dev/ffmpeg/serenity.mp4"></runno-file>
</runno-wasi>

In this example we're using `ffprobe` to get information about an `mp4` file.
The file in question is the [Serenity trailer](https://www.youtube.com/watch?v=w8JNjmK5lfk).
Before the WASI binary is run, the video file is downloaded. Then `ffprobe` runs
over the file and outputs metadata about it. You can see this was the DVD
Trailer from 2005!

In some circumstances you might want to specify a full filesystem, not just a
couple of files. In those cases you can pass an `fs-url` to the `runno-wasi`
element.

```
<runno-wasi
  src="/langs/python-3.11.3.wasm"
  fs-url="https://assets.runno.dev/examples/python-package.tar.gz"
  controls
>
</runno-wasi>
```

<runno-wasi src="/langs/python-3.11.3.wasm" fs-url="https://assets.runno.dev/examples/python-package.tar.gz" controls>
</runno-wasi>

In this example I've used a binary of Python 3.11 compiled to WASI, along with
the files required for a python package. When you run it you should get a Python
REPL, it's a little bit dodgy but mostly works.

That `python-package.tar.gz` file contains a minimal filesystem that looks like:

```
$ tar xzvf python-package.tar.gz
x package/
x package/__init__.py
```

When extracted, the files will have a `/` added to the front, to make
them compatible with the Runno filesystem. When python runs it will have this
package available in the local filesystem, you can try it yourself in the REPL
above:

```
>>> from package import say_hello
>>> say_hello()
```

Without `controls` or `autorun` you can call `run` directly on the element
reference. That's the handle you get back from running something like
`querySelector('runno-wasi')`.

## Headless

If you're interested in running WASI binaries in the browser headlessly, have a
look at my [`@runno/wasi`](https://www.npmjs.com/package/@runno/wasi) package.
It's the implementation that sits underneath these web components, and has a
pretty neat external interface.

## Post-script

Thanks for having a read and I hope you enjoyed these examples! I'm having a lot
of fun working with WASI in the browser. It's interesting seeing the cool stuff
you can do when you stick to standards. If you use Runno in one of your own
projects, I'd love to hear from you!

I'm heading over to Seattle from Australia to be at WASMCon2023, if you're
planning on attending and would like to chat, shoot me an email or find me
on Mastodon. The links are in the footer.

## Update (28th August, 2023)

I've had to update this post to switch from `autorun` to `controls` for each of
the examples, because it was costing me too much in bandwidth. It's still a fun
demo hopefully!
