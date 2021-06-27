# make.run

An embeddable browser-based system for making code run.

This project is based off a number of tools provided by [Wasmer](https://wasmer.io/). Wasmer provides a Web Assembly Package Manager ([wapm](https://wapm.io)) and a shell that can execute arbitrary packages from wapm in an in-memory file system using a terminal emulator. Using these tools together we can arbitrarily pull down packages that implement programming languages, and run them in the browser.

This is very handy for programming education it means:

- No need for newbies to install complex programming tools to run code
- Programming examples can be made runnable in the browser with no server
- Simple programs can be tested for correctness inside a sandbox on the user's machine

## TODO: Other projects to look at

### Browsix

Browsix - https://browsix.org/ - a unix implementation in Typescript

https://unix.bpowers.net/

https://github.com/plasma-umass/browsix

### JSLinux

A virtual machine running in the browser

https://bellard.org/jslinux/

# Using make.run

## Current Runtimes

The system supports a number of runtimes based on existing packages published to WAPM. These runtimes are tied to make.run and will be supported by make.run going forward.

- `python` - Runs python3 code, not pinned to a particular version but is at least `3.6`

## Future runtimes

### Clang

There are packages in WAPM for a `c` runtime based on `clang`. See:

https://www.youtube.com/watch?v=5N4b-rU-OAA&t=4s

https://wapm.io/package/clang

https://wapm.io/package/syrusakbary/clang

## Raw Commands

Raw commands can be run on the shell to be executed without using the existing runtimes. You should only use this if you know what you're doing. This will allow you to execute arbitrary commands from WAPM within the shell.

## Embedding make.run

# Customising make.run

## Packages

This repo is broken down into a few packages:

- `runtime` - a static website that implements a web assembly shell, and interfaces for running things on it
- `host` - helpers for running code on the runtime when embedded in another website
- `website` - the make.run website that includes instructions and examples

# Thanks

Big thanks to the [Wasmer team](https://wasmer.io/) who provided the original
work this system was based off. See: [webassembly.sh](https://webassembly.sh/)
and their [Announcement Article](https://medium.com/wasmer/webassembly-sh-408b010c14db).
