# Just implementing the whole WASI standard

_Disclaimer: I have not finished this article_

So I spent the last two months writing real low level JavaScript like:

```js
view.setUint32(argv_ptr_ptr, argv_buf_ptr, true);
const data = new TextEncoder().encode(`${value}\0`);
const buffer = new Uint8Array(
  this.memory.buffer,
  argv_buf_ptr,
  data.byteLength
);
buffer.set(data);
```

Why? Why would I do a bunch of arcane manipulation of byte arrays, and why would
I do it in JavaScript? Well the answer is pretty simple. I got obsessed with a
dumb idea. I got [nerd-sniped](https://xkcd.com/356/) by myself. I got stuck
thinking&hellip;

> What if I just implemented the whole fricking WASI standard?

Now I'm guessing, reader, that you have no idea what WASI is. Which is fair
enough. You also probably have no concept of the journey I've taken to get to
the point of writing horrifying incantations like `1 << 3` or `view.setUint16`.

Using these incantations I was able to build a small little playground where you
can run demos like `ffmpeg`, `ruby`, in the browser. Or if you're feeling
adventurous, you can compile your own code to WASI and run it in my playground.

<a href="/wasi" target="_blank">
  <img src="/images/playground-screenshot.png" alt="Screenshot of the Runno WASI Playground">
</a>

Let's go on that journey together. Let's find out what WASI is. Let's discover
what madness would drive a person to reach for `Uint8Array`. Let's learn about
operating systems and what the heck a "syscall" is.

And then at the end, let's run `ffmpeg`, `ruby`, and some Rust in the browser.

## Finding out what WASI is

Okay so WASI stands for WebAssembly System Interface which is&hellip; wait okay
ummm

## Finding out what WebAssembly is

You've probably heard of WebAssembly, but maybe you're like "oh its that thing
where someone ran some old game, like Doom, in a web browser". Or maybe you're
thinking "it's that emscripten thing". Or maybe you're thinking "I've kind of
heard about it but I don't get it". Let's do a quick refresh.

It's kind of hard to figure out where to start with what WebAssembly is, because
we all have such different backgrounds with computers. Some people have come
here with a degree that covers writing a C. Some know some stuff from just being
interested. But most people don't write a C, they don't need to know this stuff.
In the most part, you don't really need to know what stuff like "Assembly" and
"Instruction Sets" are to be a programmer.

So the approach I'm going to take is to start with a quick history of
WebAssembly. And it starts with the original sin of JavaScript. JavaScript only
has one number type, `number`, and it's a "double precision float". If you're
keen on reading what that is [have a go here](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#number_type) but the quick summary is "spicy decimal numbers".

The result of this is that JavaScript can't tell if a number is an integer
(no decimal places) or a float (has decimal places). Which means that when
JavaScript is executing your code it has to treat every number like it might
have decimal places. This is much slower.

But there's a trick. If you take a number and then binary-or (`|`) it with 0,
then JavaScript forces the number to be an integer (no decimal places). It's
kind of like calling `Math.floor` on the number but you're doing it in a way
that's confusing instead of a way that makes sense. Here's a demo (you can
edit it):

<!-- <runno-run runtime="quickjs" editor controls>
console.log(1.5 | 0);
</runno-run> -->

What does this have to do with WebAssembly? Well back in like 2013 Alon Zakai
realised that you could make a kind of rudimentary "assembly" language by using
a bunch of these tricks. Basically, you could write super fast JavaScript that
behaved a lot like a virtual machine. But it was JavaScript so your
browser could run it. Alon created a project called Emscripten which compiled
things like C and C++ to "asm.js". Using `asm.js` some people did some super
wild and impressive things. Soon a formal standard for a thing that works kind
of like asm.js but is totally different in every way was made. It's called
WebAssembly, it's real, and it's my friend.

<iframe width="560" height="315" src="https://www.youtube.com/embed/BV32Cs_CMqo" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

## Actually finding out what WASI is

Emscripten had a problem though, you can create an assembly language that runs
C or C++ code through JavaScript in the browser, but how do you do things like
access files? Or communicate over a network? Or render to the screen? This is
the kind of stuff that operating systems provide through _syscalls_ (don't worry
we'll get to these). The solution that Emscripten has come up with works pretty
well, there's kind of two parts:

1. Emulate what you can
2. Provide helpers for what you can't

To do the emulation Emscripten has a runtime environment. This environment is
the JavaScript side of Emscripten. It provides functions that emulate the stuff
that an Operating System would usually have. What this means under the hood is
that you can write some program that reads and writes files using the regular
abstractions you are used to. Then if you compile to Emscripten, it will run
using a virtual filesystem in memory, and the _syscalls_ that make that
possible are basically the same as they would be for Linux. Just the
implementation is totally different.

<aside>

## Syscalls

Syscalls (short for System Calls) are kind of like super powered functions
that the operating system provides to let you do stuff that you can't be
trusted to do by yourself. They have strangely simple names like `open`, or
`connect`, which hide the complexity of what they do.

</aside>

For the stuff that can't be easily emulated, Emscripten provides a bunch of
helper functions that programs can call to do stuff that is browser specific.
This might be to do with browser APIs, like the DOM, or to do with the way the
event loop works in JavaScript.

The result is that if you've got a program written in C++, and you've decided to
port it to the web, the best case is that you compile with the Emscripten
toolchain and you're done. The worst case is that you have to make some
Emscripten specific changes, but mostly these have been thought about ahead of
time.

## &hellip;but what about WASI

Okay so what is WASI? Don't you just like&hellip; compile your program to WebAssembly
or something. You get front page on HackerNews, and Google calls to give you a
million dollars.

Well no, unfortunately WebAssembly doesn't really provide a way to do anything.
A pure WebAssembly program is just a bunch of functions that are never called.
For a WebAssembly program to do anything with the outside world it needs two
things:

1. Exports
2. Imports

The exports are functions defined in the WebAssembly program that can be run by
the Host environment. Think like `do_some_hard_calculation`.

The imports are functions provided by the Host environment that the WebAssembly
program needs to run. Think like `ask_user_for_name`.

WASI is a standard set of imports and exports. They're really similar to the
Runtime that Emscripten uses. The runtime is what makes it possible to run sytem
programs inside the browser. This is basically exactly what WASI is, except
instead of being a runtime, it's a standard for what a runtime should provide.
It's the Web Assembly System Interface, and much like an Interface in
programming it doesn't provide an implementation.

## Why invent WASI?

Right now would be the perfect time to talk about how I implemented WASI. I
made that interface / implementation joke, which was pretty good. It kind of all
lined up. Except I haven't really explained why WASI exists. Emscripten already
does a really good job of running programs in the browser. Why do we need WASI?

Here's the mindblowing part: WASI isn't for browsers.

<img src="" alt="Brain explode gif">

So you're like "What? WASI isn't for browsers? Why the frick is it called Web
Assembly then? You web-ass Embly!!".

Yeah I know right, pretty messed up! Why'd they call it that? IMO this is the
coolest thing about WebAssembly. It's a platform independent standard for
binaries that can run anywhere. Sure the main reason it was designed was the
web, but it's not limited to the web. That's actually super useful. It's like
the JVM except not controlled by ~~Sun~~ Oracle. It can run on your web browser,
but it can also run on a server somewhere, it can run on embedded systems, it
can run on other virtual machines. Whenever! Wherever!

The problem you have though, if you're trying to run binaries on every kind of
system, is what functionality the system should provide. Windows does things
differently to macOS, which is different to a browser, and different to an
arduino. That's why WASI was invented. It's a standard set of _syscalls_ that
provide a large chunk of what any binary would want, and that any system should
be able to provide. And if they can't provide it, they'll have to figure it out.

In a way, this makes WASI simpler than Emscripten. It doesn't need to pretend to
be something else. Where Emscripten provides a bunch of layers of emulation
focused on the browser, WASI just provides a standard set of functions to bind
against.

What's neat about this approach is that WASI doesn't actually have to&hellip;
you know&hellip; work anywhere. It's just an interface, it's up to other people
to write the implementations.

# Just implementing the whole frickin WASI standard

And here we get back to where we started. Me, minding my own business, and then
getting absolutely 360° no-scoped by myself.

Some background: in 2021 I wrote a tool called Runno that lets you [run snippets
of code in the web browser](https://dev.to/taybenlor/how-to-embed-runnable-code-samples-using-runno-4f5c). I based it off another
project called [WebAssembly.sh](https://webassembly.sh) which is a shell in the
brower. It combined a few different pieces, but one piece I really fell in love
with was WASI.

The idea that you could build a binary once, and then run it anywhere, is still
a fantasy in 2022. The closest thing we have is literally the web. When people
want to make cross-platform applications, they just build websites and then
package them up with a whole web browser, it makes no sense! I just want to
install some dependencies and not have to build frickin perl from source to do
it.

Anyway, so [I'm thoughtleading about WASI](https://dev.to/taybenlor/web-assembly-should-be-a-default-binary-target-44m6) and just generally chilling
when I see that [Cloudflare Workers now support running WASI](https://blog.cloudflare.com/announcing-wasi-on-workers/). So I went and had a poke at their implementation
and wow it was in TypeScript and super easy to read. This was the opposite of
the library I had used for my WASI support. It was copied and edited by like
three different layers of people, included no comments and made absolutely no
sense to me at all&hellip; Plus it had all these annoying dependencies that made
it really hard to package my own thing and anyway blah, blah&hellipl;

I got the bad thoughts and typed out `mkdir` inside `~/projects`.

I started out thinking I was just going to adapt the Cloudflare implementation
but then I got started annnd you know&hellip; one thing lead to another and
I just kind of liked it. So I wrote it all out myself, and it was really fun
and, for like a month every time I opened my mouth I spewed weird obscure things
I learned about WebAssembly, WASI, Uint8Arrays or DataViews. Actually I'm still
doing it. This is that. I really like WASI.

So let's take a tour through the stuff I built and I'll show you some cool stuff
you can do with it.

## Implementing some WASI, just a little bit, to make you feel alive

Let's start by implementing just a little bit of WASI, a little taste to see
what you think. You'll like it, I promise.

Here's the type signature for `args_get`:

```ts
args_get(argv_ptr: number, argv_buf_ptr: number): number;
```

This is the function that a WASI binary uses to get the command-line arguments
to itself. Command-line arguments is the stuff that gets passed when you run a
program from the terminal. You know you write something like:

```
$ npm install @runno/wasi
```

The args for that are `['npm', 'install', '@runno/wasi']`. This is kind of just
how it is, it's a convention. If you've written C before, it's like the
`char *argv[]` that is passed to `main`. Or if you've written Java it's like the
`String[] args` that get passed to `public static void main`. Gosh I haven't
written that in a long time.

Notice how every argument to `args_get` is a `number`? That's because they're
all pointers (prepare to go cross-eyed). Okay, so what the heck is a pointer?
It's actually kind of maybe not too hard to understand here.

You know how your RAM is like 8gb, or 16gb or whatever. You can think of that as
just one big array of numbers. 8 gigabytes of numbers. Every byte is a number.
It's like the most ridiculous big data ever. Okay so memory in WebAssembly works
the same way. You get an Array which represents all of the memory the program is
using. Just all of the memory. Right there. In an Array. It's kind of wild.

So when we look at that function signature, what we're seeing is indexes into
the big array that the program is using to store its own variables. When you see
or hear the word "pointer" think "index into a big array". `argv_ptr` is the
index of a&hellip; okay actually we need to implement something else first.

## How to start a new business wherein you deliver many pizzas

```ts
args_sizes_get(argc_ptr: number, argv_buf_size_ptr: number): number
```

This is the type signature for `args_sizes_get`. This is the function that tells
your WASI program how many arguments there are, and how big a buffer it will
need when it collects them from `args_get`. We need this because the program
running within WASI will need to allocate space in memory for our WASI
implementation to write some strings to. If you've never encountered programming
that looks anything like this, that's totally reasonable. Let's talk it through
with an analogy.

You run a business that outsources pizza deliveries. Your delivery drivers turn
up to pizza restaurants and collect a bunch of orders, then they go and make the
deliveries. Before the delivery driver goes to the restaurant, they need to know
how many orders they will be picking up, and how many total pizzas there are.

1. They need to know how many orders there are, so they can bring enough pieces
   of paper to write down the orders on.
2. They need to know how many pizzas there are, so they can use a vehicle that
   can fit all the pizzas.

`argc` (or arg count) represents the number of orders there are. It's how many
arguments will be passed to the caller when they call `args_get`. If our
arguments are `['npm', 'install', '@runno/wasi']` then the `argc` will be `3`.

`argv_buf_size` represents the size of the vehicle, it's how many pizzas in
total your business needs to deliver. What it's representing is the total size,
in bytes, of the strings that have been passed as arguments. As a simple example
in this case it will be the sum of `args.map((a) => a.length)` which is
`3 + 7 + 11`, which is `21`.

But we live in a Unicode world, so it will be UTF-8 encoded, so it will actually
be the sum of `args.map((a) => new TextEncoder().encode(a).byteLength)`. Which
is actually the same, but might be different if you pass an emoji as an
argument.

Oh also, we live in a world that is dominated by C-strings. These are strings
where you don't know how long they are in advance, you just keep reading them
until you get a NULL character. This is generally a bad idea, but we have to do
it in this case. So the actual length is:

```ts
args.map((a) => new TextEncoder().encode(`${a}\0`).byteLength);
```

## Anyway here's wonderwall

```ts
args_sizes_get(argc_ptr: number, argv_buf_size_ptr: number): number {
  const args: string[] = this.args;
  const totalByteLength = args.reduce((acc, value) => {
    return acc + new TextEncoder().encode(`${value}\0`).byteLength;
  }, 0);

  const view = new DataView(this.memory.buffer);
  view.setUint32(argc_ptr, args.length, true);
  view.setUint32(argv_buf_size_ptr, totalByteLength, true);

  return Result.SUCCESS;
}
```

Oh yeah, pointers! I almost forgot to mention, you know how I said that pointers
are just indexes into a really big array? Okay so that last bit there with the
`view` and stuff. What's happening there is that the program has called
`args_sizes_get` with `argc_ptr` and `argv_buf_size_ptr`. These are two
locations in the big memory array. `argc_ptr` is the location where the program
has stored the variable for `argc`. `argv_buf_size_ptr` is the location where
the program has stored the variable for `argv_buf_size`.

So we use a `DataView` which is a handy little abstraction that lets us put
numbers into locations in a big array. At the `argc_ptr` index we put the
length of the `args` (that's how many pizza orders we need to deliver). At the
`argv_buf_size_ptr` index we put the total number of bytes (that's how many
pizzas total we need to deliver).

Bloody, fricken, shit balls. Wow. Alright we are now halfway to implementing
`args_get` and all we've done is set some numbers. But that's okay because
setting some numbers is basically what this whole endeavour is all about.

## Visiting an old friend, who we have named `args_get` because it gets args

What's the next step here? We actually do the thing where we pass the arguments
back to the program. Let's look at `args_get` again.

```ts
args_get(argv_ptr: number, argv_buf_ptr: number): number;
```

This is unfortunately starting to look familiar, that's because I've infected
you with low-level programming brain worms. The deterioration is starting now.

`argv` (arg vector) is an array of pointers to arguments. In low-level
programming sometimes people call arrays vectors. Each pointer in this array
represents the start of a string in `argv_buf`.

`argv_buf` (arg vector buffer) is a pointer to a big area of memory. It will be
sized large enough to fit all the argument strings we have to give it. Remember
earlier with the pizzas? This is the vehicle big enough to fit the pizzas.

Okay, so now you know enough to implement this function as well. Kind of. Well
I'll show it to you and I reckon you can figure it out.

```ts
args_get(argv_ptr: number, argv_buf_ptr: number): number {
  const view = new DataView(this.memory.buffer);
  for (const argument of this.context.args) {
    view.setUint32(argv_ptr, argv_buf_ptr, true);
    argv_ptr += 4;

    const data: Uint8Array = new TextEncoder().encode(`${argument}\0`);
    const buffer = new Uint8Array(
      this.memory.buffer,
      argv_buf_ptr,
      data.byteLength
    );
    buffer.set(data);
    argv_buf_ptr += data.byteLength;
  }
  return Result.SUCCESS;
}
```

Alright, let's dive into this. The first step of the loop is the following:

```ts
view.setUint32(argv_ptr, argv_buf_ptr, true);
argv_ptr += 4;
```

Here we are saying "the string is at the location indexed by `argv_buf_ptr`".
We'll update `argv_buf_ptr` for each iteration of the loop.

Then we increment `argv_ptr` by 4, which is the size of a 32-bit integer
(4 bytes). That's because we stored 4 bytes with `setUint32`, so we need to move
the index up by 4.

The next part is maybe less confusing? Who knows I have a bad case of the brain
worms.

```ts
const data: Uint8Array = new TextEncoder().encode(`${argument}\0`);
const buffer = new Uint8Array(
  this.memory.buffer,
  argv_buf_ptr,
  data.byteLength
);
buffer.set(data);
argv_buf_ptr += data.byteLength;
```

`data` here is an array of bytes, representing the string `argument` with a NULL
at the end.

We create a `Uint8Array` which doesn't actually allocate any space. We are
making the array backed by `this.memory.buffer`. We start it at index
`argv_buf_ptr`, and make it as long as `data.byteLength`. Then we set every
element in that array, to be the corresponding value from `data`. It's like we
went:

```ts
for (let i = 0; i < data.byteLength; i++) {
  const memoryIndex = argv_buf_ptr + i;
  this.memory.buffer[memoryIndex] = data[i];
}
```

Finally we move the `argv_buf_ptr` index along memory so that we don't write
over ourselves.

<!-- TODO: Maybe need a diagram here of boxes or pizzas to represent memory
locations -->

## Alright, you've given me enough brain worms, what is this even for?

Okay so why did we go through all of that? What's the payoff? Well what's super
cool is that now our little WASI implementation can provide arguments to a WASI
binary. Okay cool, but it can't actually do anything with them? Yeah, true. Ok
lets implement just a little bit more and then we'll have something we can use,
which is wild.

If we implement a way to exit, then our little WASI implementation will be able
to run programs. Here's a quick way to do it:

```ts
proc_exit(code: number): void {
  console.log("Exit Code:", code);
  throw new Error('stop running');
}
```

Now we just need to wire it all up together:

```ts
const args = ["npm", "install", "@runno/wasi"];
const wasi = {
  proc_exit: (code: number): void => {
    // ...
  },
  args_get(argv_ptr: number, argv_buf_ptr: number): number {
    // ...
  },
  args_sizes_get(argc_ptr: number, argv_buf_size_ptr: number): number {
    // ...
  },
};

const { instance, module } = await WebAssembly.instantiateStreaming(
  fetch("/some_demo.wasm"),
  {
    wasi_snapshot_preview1: wasi,
    wasi_unstable: wasi,
  }
);

const memory = instance.exports.memory;
const entrypoint = this.instance.exports._start as () => void;

entrypoint();
```

Alright, what we've made here is a WASI implementation that can pass in
arguments and exit. But what's important is that it can exit with a number! That
means we can do a little bit of output. Let's write a program that runs in our
host environment!

Here's a rust program that counts the number of arguments and exits with that as
the exit code:

```rust
fn main() {
    let args: Vec<String> = std::env::args().collect();
    std::process::exit(args.len() as i32);
}
```

Let's compile that to wasi:

```
$ rustup target install wasm32-wasi
$ cargo build --target=wasm32-wasi
```

## I haven't finished this, sorry

I will in the future, maybe
