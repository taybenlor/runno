# Contributors Guide

G'day! Thanks for considering contributing to Runno. I'll be happy to take your
contributions. As an upfront warning, I have a full-time job and Runno is a
passion side-project. That means I won't be able to respond quickly to issues or
pull requests.

Because this is a passion project I have particular thoughts about the direction
it should head. This means that I might choose to close issues that I don't
agree with, or reject pull requests that make changes I don't like. That doesn't
mean your ideas or work are bad, or that they're not appreciated. They just
don't fit with the direction I have in mind.

Some things I'd be very happy for other people to contribute:

- **Support for new languages** (most useful!)
- Fixing bugs
- WASI Test cases
- Small enhancements to the API
- Performance improvements
- Ideas, suggestions and feedback in Issues or by email

What I would be cautious about accepting:

- Refactors to the way Runno works
- Changes to the look and feel of Runno
- Substantial new features
- Documentation
- Examples
- Tests (outside of WASI)

Tests, documentation, and examples would normally be useful contributions. But I
haven't thought through how I want to fit them all in. For now these sorts of
contributions would be best as issues, or elsewhere as blog posts.

Runno doesn't have a full test suite yet, so I'll be cautious about merging
changes until I've worked through how I want to do testing. Please feel free to
make suggestions in issues.

If you're interested in adding tests to the `@runno/wasi` package go ahead! That
would be very useful. Check how the existing tests are being done to see how to
contribute.

Overall the best thing you can do to contribute to Runno is to help add a new
language!

## Adding a language to Runno

Runno only supports WASI binaries. If you can run the binary in the [Runno
Playground (https://runno.dev/wasi)](https://runno.dev/wasi), then it should
work in the Runno Runtime (`@runno/runtime`).

### Building your language runtime

If you're unfamiliar with WASI you can learn more in the [initial announcement](https://hacks.mozilla.org/2019/03/standardizing-wasi-a-webassembly-system-interface/).
It's a standard binding interface to help system applications run in Web
Assembly. Clang has support for WASI and you can learn how to use Clang to
compile for WASM with WASI [in this blog post](https://00f.net/2019/04/07/compiling-to-webassembly-with-llvm-and-clang/).

To help you compile things to WASI you can also use some existing tools:

- [wasienv](https://github.com/wasienv/wasienv) - simplifies configuring your compiler
- [WABT](https://github.com/WebAssembly/wabt) - binary toolkit (helpful tools)
- [Zig toolchain](https://zig.news/kristoff/compile-a-c-c-project-with-zig-368j) -
  Zig aims for compatibility with C and you can use the Zig tools to build
  existing projects, including building them cross-platform

Compiling a compiled language to WASM also has the added downside of needing the
language to already support WASM + WASI. So if you're thinking of compiling your
favourite compiled language, make sure it supports WASI itself. Interpreted
languages don't have this downside.

If you need any help with this, please email me! I'm very keen to see other
languages get on Runno.

_I'm sorry I'm not able to provide a general purpose guide! I've been using
binaries that other people have built to save time, so I don't have a lot of
experience with it_

### Adding your language runtime to Runno

If you've managed to get a language built and running on WASI, then I'm happy to
do the work of putting it in Runno. Just throw up an issue, or email me! But if
you're keen on doing the PR yourself here's some tips.

Adding a new language to Runno means adding the name of the runtime in a bunch
of different places. This might change as Runno changes, but if you look for the
term `clang` in the codebase you should be able to find them all.

The most important part is adding the commands to `commands.ts`. Figuring out
the best way to do this can be a bit hit-and-miss, but there should be enough
examples there to work with.

Once you've got it working you'll need to add an example for the language to
`examples.ts`.

## Disclaimer about toxicity

I want Runno to be an inclusive little project. I won't tolerate any toxic or
discrimatory behaviour in this repo, and will remove any I see. Hassling me, or
anyone else, posting incessantly, or making rude remarks will get your comments
or issues deleted. This isn't a community project, it's my project. I control
this space. If you're nice, I'll be nice! I like being nice!
