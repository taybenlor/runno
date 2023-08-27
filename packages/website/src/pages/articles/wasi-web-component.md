# Running WASI binaries from your HTML using Web Components

Web Components are a really interesting API for JavaScript libraries. Here's a
Web Component I've built that can run WASI binaries.

<runno-wasi src="https://assets.runno.dev/ffmpeg/ffmpeg.wasm" autorun></runno-wasi>

The HTML is very simple:

```html
<runno-wasi src="https://assets.runno.dev/ffmpeg/ffmpeg.wasm" autorun>
</runno-wasi>
```

## Background

As part of recent work to make Runno hosted on its own browser-specific
[WASI](https://wasi.dev) runtime I built my own implementation of WASI
([`@runno/wasi`](/wasi)). After building the implementation, I rewrote the way
the main Runno package works to use my own WASI implementation under-the-hood.
Because Runno is all about using Web Components to run short snippets of code
directly from HTML, I realised it would be neat to also support running WASI
binaries this way.

So I've added a `<runno-wasi>` element to
[`@runno/runtime`](https://www.npmjs.com/package/@runno/runtime). It needs the
same setup that a normal Runno runtime needs, you need to be in a Cross-Origin
Isolated Context, and you need to include the `@runno/runtime` package
([see the docs](/docs)), but once you've done that it's pretty straightforward
to run WASI binaries. That opens up a whole host of ways to run CLI tools in
your web browser, whether they're built in Rust, C, Zig, C# or the variety of
other languages that support compiling to WASI.

## Examples

Running a CLI program with no args is very simple.

```html
<runno-wasi src="https://assets.runno.dev/ffmpeg/ffmpeg.wasm" autorun>
</runno-wasi>
```

<runno-wasi src="https://assets.runno.dev/ffmpeg/ffmpeg.wasm" autorun></runno-wasi>

You specify the `src` of the WASI binary as an attribute, just like an `img`.
If you want it to automatically run, then specify `autorun` as an attribute. In
this example we're running `ffmpeg` with no args, and no files. You'll notice
that terminal output is automatically displayed, this terminal can be styled
with CSS ([docs](/docs/runtime/)).

Running `ffmpeg` without anything in the filesystem isn't particularly useful,
so lets look at how we can add files to the `runno-wasi` element. The simplest
way to do this is with the `runno-file` element.

<!-- prettier-ignore -->
```html
<runno-wasi
  src="https://assets.runno.dev/examples/cat.wasi.wasm"
  args="/foo.txt /bar.txt"
  autorun
>
  <runno-file path="/foo.txt">
    Hello, World!
  </runno-file>
  <runno-file path="/bar.txt">
    Lets concatenate these files.
  </runno-file>
</runno-wasi>
```

<runno-wasi src="https://assets.runno.dev/examples/cat.wasi.wasm" args="/foo.txt /bar.txt" autorun>
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

This is cool, but it's going to be hard to use with `ffmpeg`, we'd need to write
out the video file as text in the web browser, and I'm not sure HTML escape
codes are up to the task. So instead we can specify a `url` attribute on those
`wasi-file` elements to have them pull down their content from a URL.

```html
<runno-wasi
  src="https://assets.runno.dev/ffmpeg/ffprobe.wasm"
  args="/serenity.mp4"
  autorun
>
  <runno-file
    path="/serenity.mp4"
    url="https://assets.runno.dev/ffmpeg/ffprobe.wasm"
  >
  </runno-file>
</runno-wasi>
```

<runno-wasi src="https://assets.runno.dev/ffmpeg/ffprobe.wasm" args="/serenity.mp4" autorun>
<runno-file path="/serenity.mp4" url="https://assets.runno.dev/ffmpeg/serenity.mp4"></runno-file>
</runno-wasi>

In this example we're using `ffprobe` to get information about an `mp4` file.
The file in question is the [Serenity trailer](https://www.youtube.com/watch?v=w8JNjmK5lfk).
Before the WASI binary is run, the video file is downloaded.

In some circumstances you might want to specify a full filesystem, not just a
couple of files. In those cases you can pass a `fs-url` to the `runno-wasi`
element.

```
<runno-wasi src="/langs/python-3.11.3.wasm" fs-url="python-3.11.3.tar.gz" controls>
</runno-wasi>
```

<runno-wasi src="/langs/python-3.11.3.wasm" fs-url="python-3.11.3.tar.gz" controls>
</runno-wasi>

In this example I've used a binary of Python 3.11 compiled to WASI, along with
the required supporting files for the standard library. When you run it you
should get a Python REPL, it's a little bit dodgy but mostly works. That
`python-3.11.3.tar.gz` file contains a filesystem that looks like:

```
$ tar xzvf python-3.11.3.tar.gz
x usr/
x usr/local/
x usr/local/lib/
x usr/local/lib/python311.zip
x usr/local/lib/python3.11/
x usr/local/lib/python3.11/lib-dynload/
x usr/local/lib/python3.11/os.py
x usr/local/lib/python3.11/lib-dynload/.empty
```

When extracted, each of these files will have a `/` added to the front, to make
them compatible with the Runno filesystem.

If you'd like to go have a look yourself, try these two commands inside the
Python REPL above:

```
>>> import os
>>> os.listdir("/usr/local/lib")
```

I've also specified `controls` as an attribute, this gives the user a run button
that they can click to run the code. Without `controls` or `autorun` you can
call `run` directly on the element reference. That's the handle you get back
from running something like `querySelector('runno-wasi')`.

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
