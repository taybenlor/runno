# `@runno/mcp`

## Overview

`@runno/mcp` is a Model Context Protocol (MCP) server that provides a secure code execution environment for AI assistants. It enables models to execute code in various programming languages inside a sandboxed environment using WebAssembly, offering a safe way to run code snippets during AI interactions.

## Features

- **Secure Sandboxed Environment**: Runs code in isolation without access to the filesystem, network, or system resources
- **Multiple Language Support**: Execute code in Python, JavaScript (QuickJS), C, C++, Ruby, and PHP
- **MCP Compliant**: Implements the Model Context Protocol for seamless integration with AI assistants
- **Simple CLI Tool**: Easy to run via npx without complex setup
- **Standard I/O Communication**: Uses stdio for communication with the client

## Examples

In this example I gave Claude a leetcode problem. It solved it by writing Python: [Leetcode problem](https://claude.ai/share/04393426-e2c1-4fce-a779-ad538512da66).

In this example I told Claude to efficiently calculate 5000 primes. It solved it by writing Python. Then when I told it to use C, it rewrote the solution in C (and ran it): [5000 primes](https://claude.ai/share/dc1011a0-5ea5-429e-99da-095d98be1997).

In this example I asked Claude to tell me the p75 of a short list of numbers. It solved it by first writing Python with Numpy (which didn't work) but then re-orienting and writing just using the standard library: [p75 calculation](https://claude.ai/share/69bb7cee-ff7d-4773-9e01-efc5b24a8cdf).

## How It Works

The `@runno/mcp` server provides a `run_code` tool that AI assistants can use to execute code snippets in various programming languages. It leverages the `@runno/sandbox` package, which uses WebAssembly to create isolated environments for code execution. The result of the code execution is provided over STDIO.

The `@runno/sandbox` uses precompiled WebAssembly binaries for multiple programming languages. It then executes those binaries against a virtual file system using the `@runno/wasi` implementation of WASI preview1.

You can read more about how the Runno sandbox works in my article [I made a Python package for sandboxing code](https://runno.dev/articles/sandbox-python/). This is for an older version of the sandbox, but it works basically the same way.

## Supported Runtimes

| Runtime | Programming Language |
| ------- | -------------------- |
| python  | Python               |
| quickjs | JavaScript           |
| clang   | C                    |
| clangpp | C++                  |
| ruby    | Ruby                 |
| php-cgi | PHP                  |

## Tool Usage

The `run_code` tool accepts the following parameters:

- `runtime`: The runtime environment to use (one of the supported runtimes)
- `code`: The code string to execute

The tool returns:

- Execution status (completed, crashed, terminated, or timed out)
- Exit code (for completed executions)
- TTY output (combined stdout and stderr)
- Error details (for crashed executions)

## Limitations

Code executed within the sandbox:

- Cannot access the filesystem
- Cannot make network connections
- Cannot execute system commands
- Cannot import packages from package managers
- Cannot execute external programs
- Is limited to core programming language capabilities

## Running the Server

### Using npx

The simplest way to run the Runno MCP server is with npx:

```bash
npx @runno/mcp
```

This will start the server on stdio, making it immediately available for integration with MCP-compatible clients.

### Integration with MCP Clients

To use the Runno MCP server with an MCP client, you simply need to configure it to run `npx @runno/mcp`.

For Claude you can edit the [MCP Config](https://modelcontextprotocol.io/quickstart/user):

```
{
  "mcpServers": {
    "runno": {
      "command": "/usr/local/bin/npx",
      "args": ["@runno/mcp"]
    }
  }
}
```

_Note: To get the right path for `npx` run `which npx`._

## Security Considerations

- The Runno MCP server provides strong isolation of executed code through WebAssembly
- However, resource consumption (CPU, memory) should still be monitored
- For production use, consider implementing additional controls such as timeouts and resource limits
