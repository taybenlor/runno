# `@runno/sandbox`

A WebAssembly-based sandbox for running code in various programming languages safely in Node.js and compatible JavaScript runtimes.

## Description

`@runno/sandbox` is a part of the Runno project, providing a secure environment to execute code in various languages using WebAssembly. It allows you to run code snippets or entire file systems in a controlled sandbox, with support for Python, JavaScript (QuickJS), SQLite, C/C++ (Clang), Ruby, and PHP.

## Installation

```bash
npm install @runno/sandbox
```

## API

### `runCode(runtime, code, options?)`

Executes a code snippet in the specified runtime environment.

**Parameters:**

- `runtime`: The runtime environment to use (e.g., "python", "quickjs", "sqlite", "clang", "clangpp", "ruby", "php-cgi")
- `code`: The code string to execute
- `options`: Optional configuration:
  - `stdin`: Input to be passed to the standard input
  - `timeout`: Maximum execution time in seconds

**Returns:** A Promise that resolves to a `RunResult`, which could be:

- `CompleteResult`: Successful execution with stdout, stderr, filesystem state, and exit code
- `CrashResult`: Execution error details
- `TerminatedResult`: Execution was manually terminated
- `TimeoutResult`: Execution timed out

**Example:**

```javascript
import { runCode } from "@runno/sandbox";

const result = await runCode("python", 'print("Hello, world!")');
console.log(result.stdout); // "Hello, world!"
```

### `runFS(runtime, entryPath, fs, options?)`

Executes code from a virtual filesystem in the specified runtime environment.

**Parameters:**

- `runtime`: The runtime environment to use
- `entryPath`: The path to the entry file in the filesystem
- `fs`: A WASI filesystem structure defining files and directories
- `options`: Optional configuration:
  - `stdin`: Input to be passed to the standard input
  - `timeout`: Maximum execution time in seconds

**Returns:** A Promise that resolves to a `RunResult` (same structure as `runCode`)

**Example:**

```javascript
import { runFS } from "@runno/sandbox";

const fs = {
  "/program.py": {
    path: "program.py",
    content: 'print("Hello from filesystem!")',
    mode: "string",
    timestamps: {
      access: new Date(),
      modification: new Date(),
      change: new Date(),
    },
  },
};

const result = await runFS("python", "/program.py", fs);
console.log(result.stdout); // "Hello from filesystem!"
```

### `fetchWASIFS(fsURL)`

Fetches and extracts a tar.gz file representing a base filesystem for use with `runFS()`.

**Parameters:**

- `fsURL`: The URL of the filesystem to fetch (local path or remote URL)

**Returns:** A Promise that resolves to a WASI filesystem structure

**Example:**

```javascript
import { fetchWASIFS, runFS } from "@runno/sandbox";

// Load a base filesystem for Python
const baseFS = await fetchWASIFS("./python-base-fs.tar.gz");

// Add your own files to the base filesystem
const completeFS = {
  ...baseFS,
  "/myprogram.py": {
    path: "myprogram.py",
    content: "import numpy as np\nprint(np.array([1,2,3]))",
    mode: "string",
    timestamps: {
      access: new Date(),
      modification: new Date(),
      change: new Date(),
    },
  },
};

const result = await runFS("python", "/myprogram.py", completeFS);
console.log(result.stdout);
```

## Supported Runtimes

- `python`: Python interpreter
- `quickjs`: JavaScript interpreter
- `sqlite`: SQLite database engine
- `clang`: C language compiler
- `clangpp`: C++ language compiler
- `ruby`: Ruby interpreter
- `php-cgi`: PHP CGI interpreter

## Development

The package includes several npm scripts to help with development:

- `npm test`: Run Vitest tests once
- `npm run test:watch`: Run Vitest tests in watch mode
- `npm run build`: Build the package using tsup and copy language files to the dist folder

## License

MIT © [Ben Taylor](https://github.com/taybenlor)
