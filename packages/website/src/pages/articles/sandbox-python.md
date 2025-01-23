# I made it so you can `pip install runno` and run Ruby inside Python

_Note: you can also run Python inside Python and C, and C++, and JavaScript but
the Ruby one is funniest I think_

Over the holidays I made a version of the Runno sandbox for Python, and released
it to [PyPI](https://pypi.org/project/runno/). This was a bit of a
spicy endeavour because Runno is written in TypeScript and works inside the
browser.

tl;dr - it lets you do this:

<!-- prettier-ignore -->
<runno-code syntax="python">

```
# /// script
# dependencies = ["runno"]
# ///

import asyncio
from runno import run_code

async def hello():
  result = await run_code(
    "ruby",
    "puts('Hello Python!')"
  )
  return result.stdout

message = asyncio.run(hello())
print("Ruby says:", message)

```

</runno-code>

_Note: you can run that example with `$ uv run example.py` on python 3.13 to try it out._

Why would I make this? Mostly because it seemed interesting.

But the reason it seemed interesting is that people keep making LLMs write code.
It's scary to me to just run the code that an LLM writes. Especially if you are
using the code-running as a tool that the LLM can call out to.
Who knows what that LLM will write?

So you should probably run it in a sandbox. But if you are writing
stuff with LLMs you are probably writing Python, so how can you run this code in
a sandbox from Python?

That's the problem I wanted to tackle, and I already had a sandbox in my pocket.
It's called Runno (hello you are on the Runno website) and it runs code in the
browser. So I decided to use that sandbox as the basis for this sandbox.

In this post I'll talk about:

1. What you can do after you `pip install runno`
2. How I made the `runno` package using `deno compile`
3. The architecture of Runno, and what makes it a secure sandbox
4. Limitations of Runno and the `runno` package

## 1. What you can do after you `pip install runno`

The main thing you can do with the `runno` Python package is use the `run_code`
function to run code in a bunch of programming languages. `runno` supports the
following language runtimes:

1. `python` - CPython version `3.11.3` compiled by VMWare Labs ([github](https://github.com/vmware-labs/webassembly-language-runtimes))
2. `ruby` - MRI Ruby version `3.2.0` compiled by VMWare Labs ([github](https://github.com/vmware-labs/webassembly-language-runtimes))
3. `quickjs` - WASMEdge's QuickJS fork ([github](https://github.com/second-state/wasmedge-quickjs))
4. `clang` - Clang fork for WASM by Binji ([github](https://github.com/binji/wasm-clang))
5. `clangpp` - Using the same Clang fork

Plus a couple of bonus spicy ones that work a bit differently:

6. `php-cgi` - PHP CGI version `8.2.0` compiled by VMWare Labs ([github](https://github.com/vmware-labs/webassembly-language-runtimes))
7. `sqlite` - SQLite from WAPM ([github](https://github.com/wapm-packages/sqlite))

_Note: All of these runtimes are packaged with the Runno binary and will run locally
without connecting to the internet._

### Using `run_code`

Here's the function signature for `run_code`:

<!-- prettier-ignore -->
<runno-code syntax="python">

async def run_code(
runtime: Runtime, code: str, \*\*kwargs: Options
) -> RunResult:

</runno-code>

So to use `run_code` you just throw in the string name of the `Runtime` you want
to use, and then a string of the code you want to run. Here's some more
examples:

**Doing a calculation in a sandbox**

<!-- prettier-ignore -->
<runno-code syntax="python">

```
# ... asyncio code omitted
from runno import run_code

async def sandbox(calculation):
  result = await run_code("python", f"print({calculation})")
  return int(result.stdout)

result = sandbox("1 + 1")
print(f"1 + 1 = {result}")
```

</runno-code>

This is slightly less expensive than getting an LLM to do the addition.

**Running some generated C code**

<!-- prettier-ignore -->
<runno-code syntax="python">
# ... asyncio code omitted
from runno import run_code

code = await llm("Write a C program to calculate 1000 digits of pi.")
result = await run_code("clang", code)

print(result.tty)

</runno-code>

To run the C code Runno uses a WASI compiled release of clang set up to target
`wasm32-unknown-wasi`. First it compiles the C-code to WebAssembly inside the
Runno sandbox, then it runs the compiled WebAssembly binary inside the
sandbox.

**Running some code with a time limit**

<!-- prettier-ignore -->
<runno-code syntax="python">
# ... asyncio code omitted
from runno import run_code

code = "while True: pass"
result = await run_code("python", code, timeout=5)

if result.result_type == "timeout":
print("Timed out.")
else:
print("Wow, it ran forever.")

</runno-code>

The `timeout` is enforced in two layers, on the Python side, and then on the
Runno sandbox side. There's no guarantee it will be exact, but it will limit
execution time.

### Using `run_fs` to provide files

If you want the program to operate on some files in the file system you can
provide them by using `run_fs`. The function signature is:

<!-- prettier-ignore -->
<runno-code syntax="python">
async def run_fs(
    runtime: Runtime, entry_path: WASIPath, fs: WASIFS, **kwargs: Options
) -> RunResult:

</runno-code>

The `entry_path` is the file you want to run, you'll need to provide that as
part of the `fs`. Under the hood it is invoking whichever runtime with that file
as an argument, so if it was python it's doing `$ python <entry_path>`.

Let's imagine you want to do some calculations with a CSV file, you could do:

<!-- prettier-ignore -->
<runno-code syntax="python">

```
# ... asyncio code omitted
from runno import run_code

code = await llm(
  user_prompt,
  system_prompt="Respond with Python code that uses data.csv"
)

result = await run_fs("python", "program.py", {
  "/program.py": StringFile(
    path="/program.py",
    content=code,
    mode="string",
    timestamps=WASITimestamps(
      access=datetime.now(),
      modification=datetime.now(),
      change=datetime.now(),
    ),
  ),
  "/data.csv": StringFile(
    path="/data.csv",
    content="""
    a,b,c
    1,2,3
    """,
    mode="string",
    timestamps=WASITimestamps(
      access=datetime.now(),
      modification=datetime.now(),
      change=datetime.now(),
    ),
  )
})

print(result.tty)
```

</runno-code>

You can also grab any files written out of the `result`. They'll be packaged up
as the `fs`.

### Using `run_fs` to provide packages

Many programming languages (including Python) can use packages directly from the
local file system. Runno has no package manager (yet?) but you can absolutely
provide your dependencies within the `fs`. You'll just need to load them in when
you call `run_fs`.

Figuring this out is left as an exercise to the reader.

## 2. How I made the runno package using `deno compile`

_Note: I'm going to skip over the bit where I built Runno and what it is. It's
a tool for running programming languages in the browser. You can find out more
by browsing this website._

In the opening section I mentioned that Runno is built for the browser using
Typescript. So how did I get it running in Python? Python is a different
programming language and does not normally interface with browsers (without the
distance of a network connection and a HTTP request).

Runno is built for the browser, but the core is TypeScript that runs
WebAssembly. Any modern JavaScript runtime (like Node, Deno, or Bun) can do
that. In fact because of great work by the [WinterTC](https://wintercg.org/) the
stuff I wrote for browsers basically all just works vanilla in any JavaScript
runtime.

So I had a plan:

1. Make Runno run using a JS Runtime like Node
2. ????
3. Run that from Python

The bit in the middle took me a while to come up with an idea for, but in a
thread with
[Simon Willison](https://fedi.simonwillison.net/@simon/113452907697338848) he
linked to some of his
[own attempts at sandboxing](https://til.simonwillison.net/deno/pyodide-sandbox)
which mentions using `deno compile` to package up a sandbox for distribution.

`deno compile` is a command provided by `deno` that takes your TypeScript and
packages it up for distribution. It includes the deno runtime, and outputs a
single binary. Perfect for a CLI. I thought this was a pretty neat idea, once I
had a binary I could just shell out to it from Python and bob's your uncle.

So now my plan is:

1. Make Runno run using Deno
2. Compile Runno to a binary with `deno compile`
3. Run that from Python

Step one was not too onerous. I put together a proof of concept in a night. Then
refined it in my spare time until it had a neat little CLI interface.

Getting that to compile was also not too bad, deno does a good job of packaging
up your dependencies. You can even include whole folders of assets, and it
figures out how to grab them from within the resulting binary. I ended up with
a short command like:

```
$ deno compile --frozen --include langs --output runno bin/main.ts
```

That's how I've packaged up all the WASM language binaries for distribution.
All in one neat little binary (the binary is almost `100mb`).

Finally I needed to dust off my Python and write some bindings for the binary
I'd built. This was a fun bit of airport hacking on the way to see my family for
Christmas. After taking some time to understand what had happened with the
Python packaging ecosystem, I got started. Shortly after, with some asyncio
magic I had something running locally! I even had tests.

So I thought to myself "Time to ship to PyPI!".

Not so fast.

This is where the headaches began. To make this whole thing work nicely, I
didn't want to impose a Deno dependency on my users. I wanted to build wheels
that included the compiled version of Runno. That way the whole thing would
"just run". No need to compile locally or anything. I hate when I go to
install a package and it ends up spending an hour compiling.

This is totally possible with Python. You build the binary, then package up a
binary release (a wheel). Unfortunately you do need to make one for each
platform (OS & CPU combo). So I started looking at
[`hatch`](https://hatch.pypa.io/1.8/) and
[`cibuildwheel`](https://cibuildwheel.pypa.io/en/stable/).

These are both awesome tools and a huge shoutout to the maintainers. However the
200 or so commits I needed to configure them both to build may have inflicted
permanent psychic damage. If you're interested you can
[go look](https://github.com/taybenlor/runno/pull/306).

After some late nights arguing with my computer I had a package on PyPI,
I texted a friend and they got it running on their machine too (thanks Jim!).

Wow. We did it!

Now you can install it too, with `pip install runno`.

## 3. The architecture of Runno, and what makes it a secure sandbox

I do want to say up front that Runno is Open Source software with an MIT
License, which specifically states:

```
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND
```

I stand by that lack of a warranty. But I also think the sandbox is pretty good
and I'd love to make it really good. It's fun.

The main way that the Runno sandbox isolates code is by running it as
WebAssembly inside V8. WebAssembly has some neat properties:

1. Execution is all virtualised, it's not running directly on your CPU and RAM
2. Code and Data are seperate, you can't jump into data
3. The only interface with the outside world is via user-provided functions

That last point (3) is the most important one. If you run a WebAssembly binary
and don't provide it with any functions it literally cannot do anything. It's
like a box with no windows or doors, nothing can get in or out.

But we do want some things to get in and out. That's what WASI is for. WASI is a
specification for an interface (the WebAssembly System Interface) that defines
a standard set of functions that a WebAssembly binary can call like they are
system calls. Mostly they do things like read and write files.

_Note: this is actually a definition of WASI preview1, preview2 / 0.2 is a
different beast and is very cool but out of scope of this article._

Runno at it's core is an implementation of WASI preview1. It's kind of like a
very lightweight Operating System implemented in TypeScript. It has a virtual
file system which is made up of virtual files (basically just byte arrays stored
in memory). So it never accesses your real file system either. It also has no
network access or anything else like that.

So 1) it's a virtual machine, 2) it's a virtual file system, and 3) it has no
network access. That's all the stuff inside WebAssembly. That's pretty good.
But what about the TypeScript that runs the Sandbox. Couldn't it be vulnerable
to some sort of supply chain attack? That stuff is always happening in the
JS packaging ecosystem.

Well because it's compiled with Deno, it can't do that. Deno (by default)
prevents access to system resources. I've intentionally not enabled file or
network access. So my TypeScript can't access your filesystem. And that
TypeScript is running in the V8 virtual machine as well.

Plus, even if the TypeScript did start sucking up CPU cycles, you can limit it
with the `timeout` argument. That timeout is controlled from Python by running
the Runno binary as a subprocess.

Anyway point is, there's a lot of layers to this onion which I think is pretty
good. I've heard onions are good for security. Tell me if you find some holes
in my onion though, I'm interested!

## 4. Limitations of Runno and the `runno` package

I've talked it up a bit through this post, so now it's time to be real.

1. These are very early 0.x releases of Runno. I don't know if it will ever be
   "production ready". I have not invested deeply in testing, reliability,
   performance, or security. This is not battle tested.

2. There is no easy way to use packages with Runno. It's a problem I'm thinking
   about. I would love for popular packages from the Python ecosystem to work,
   similar to the way they do for Pyodide. But I want to do it in a way that will
   work for any programming language.

3. If you want any output, you'll probably need to take it from `STDOUT`. It's not
   a particularly neat foreign function interface, but it isn't too hard to wrap up
   and turn into your own thing.

4. You can't pass `STDIN`. This isn't an inherent limitation, I just haven't set
   it up yet. The version I run in the browser does some really nice `STDIN`
   interactions, and I'd like to figure out a way to do them from Python.

## Conclusion

I spent some months in my spare time making my browser-based programming
language runner work on servers as well. It was fun and challenging. I hope
someone finds it useful!

Thanks for reading!

Now try out `runno` yourself with `pip install runno`.

```
$ pip install runno
$ python -m asyncio
>>> from runno import run_code
>>> result = await run_code("python", "print('hello friend')")
>>> result.tty
```
