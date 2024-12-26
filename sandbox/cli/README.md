# Runno Sandbox

Run untrusted code inside a WebAssembly sandbox.

This is an unreleased proof of concept.

## Quickstart CLI

`bin/main.ts` is a CLI program that runs files using Runno.

```
$ deno --allow-read bin/main.ts python test.py
Hello, World!
```

Supported runtimes are: `python`, `ruby`, `quickjs`, `php-cgi`, `sqlite`, `clang`, and `clangpp`.

## Quickstart API

The simplest use is to run some code in a supported language:

```ts
import { runCode } from "@runno/sandbox";

const result = await runCode(
  "python",
  `
print("Hello, World!");
`
);

console.log("Result:", result);
```

When run using Deno:

```
$ deno demo.ts
```

This gives the following output:

```sh
Result: {
  resultType: "complete",
  stdin: "",
  stdout: "Hello, World!\n",
  stderr: "",
  tty: "Hello, World!\n",
  fs: {
    "/program": {
      path: "program",
      content: '\nprint("Hello, World!");\n',
      mode: "string",
      timestamps: {
        access: 2024-11-10T04:20:02.987Z,
        modification: 2024-11-10T04:20:02.987Z,
        change: 2024-11-10T04:20:02.987Z
      }
    }
  },
  exitCode: 0
}
```

## Specifying a File System

You can specify a file system by using `runFS`. This allows you to add packages
that are available to the python runtime.

Like so:

```ts
import { runFS } from "@runno/sandbox";

const fsResult = await runFS("python", "/program", {
  "/program": {
    path: "/program",
    content: `
from package import say_hello
say_hello()
          
print('------')
          
import os
print("/package contains", os.listdir('/package'))
`,
    mode: "string",
    timestamps: {
      access: new Date(),
      modification: new Date(),
      change: new Date(),
    },
  },
  "/package/__init__.py": {
    path: "/package/__init__.py",
    content: `
def say_hello():
    print("Hello from package")
`,
    mode: "string",
    timestamps: {
      access: new Date(),
      modification: new Date(),
      change: new Date(),
    },
  },
});

console.log("Run FS Result:", fsResult);
```

Which gives the following result:

```sh
$ deno --allow-net src/main.ts

Run FS Result: {
  resultType: "complete",
  stdin: "",
  stdout: "Hello from package\n" +
    "------\n" +
    "/package contains ['__init__.py', '__pycache__']\n",
  stderr: "",
  tty: "Hello from package\n" +
    "------\n" +
    "/package contains ['__init__.py', '__pycache__']\n",
  fs: {
    "/program": {
      path: "/program",
      content: "\n" +
        "from package import say_hello\n" +
        "say_hello()\n" +
        "          \n" +
        "print('------')\n" +
        "          \n" +
        "import os\n" +
        `print("/package contains", os.listdir('/package'))\n`,
      mode: "string",
      timestamps: {
        access: 2024-11-10T04:44:08.692Z,
        modification: 2024-11-10T04:44:08.692Z,
        change: 2024-11-10T04:44:08.692Z
      }
    },
    "/package/__init__.py": {
      path: "/package/__init__.py",
      content: '\ndef say_hello():\n    print("Hello from package")\n',
      mode: "string",
      timestamps: {
        access: 2024-11-10T04:44:08.692Z,
        modification: 2024-11-10T04:44:08.692Z,
        change: 2024-11-10T04:44:08.692Z
      }
    },
    "/package/__pycache__/.runno": {
      path: "/package/__pycache__/.runno",
      timestamps: {
        access: 2024-11-10T04:44:09.402Z,
        modification: 2024-11-10T04:44:09.402Z,
        change: 2024-11-10T04:44:09.402Z
      },
      mode: "string",
      content: ""
    },
    "/package/__pycache__/__init__.cpython-311.pyc": {
      path: "/package/__pycache__/__init__.cpython-311.pyc",
      mode: "binary",
      content: Uint8Array(314) [
        167,  13,  13, 10,   0,   0,   0, 0,  24, 58,  48, 103,
         50,   0,   0,  0, 227,   0,   0, 0,   0,  0,   0,   0,
          0,   0,   0,  0,   0,   1,   0, 0,   0,  0,   0,   0,
          0, 243,  12,  0,   0,   0, 151, 0, 100,  0, 132,   0,
         90,   0, 100,  1,  83,   0,  41, 2,  99,  0,   0,   0,
          0,   0,   0,  0,   0,   0,   0, 0,   0,  3,   0,   0,
          0,   3,   0,  0,   0, 243,  36, 0,   0,  0, 151,   0,
        116,   1,   0,  0,   0,   0,   0, 0,   0,  0,   0,   0,
        100,   1, 166,  1,
        ... 214 more items
      ],
      timestamps: {
        access: 2024-11-10T04:44:09.402Z,
        modification: 2024-11-10T04:44:09.402Z,
        change: 2024-11-10T04:44:09.402Z
      }
    }
  },
  exitCode: 0
}
```
