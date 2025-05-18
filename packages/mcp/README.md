# `@runno/mcp`

Overview

`@runno/mcp` is a Model Context Protocol (MCP) server that provides a secure code execution environment for AI assistants. It enables models to execute code in various programming languages inside a sandboxed environment using WebAssembly, offering a safe way to run code snippets during AI interactions.

## Features

- **Secure Sandboxed Environment**: Runs code in isolation without access to the filesystem, network, or system resources
- **Multiple Language Support**: Execute code in Python, JavaScript (QuickJS), C, C++, Ruby, and PHP
- **MCP Compliant**: Implements the Model Context Protocol for seamless integration with AI assistants
- **Simple CLI Tool**: Easy to run via npx without complex setup
- **Standard I/O Communication**: Uses stdio for communication with the client

## How It Works

The `@runno/mcp` server provides a `run_code` tool that AI assistants can use to execute code snippets in various programming languages. It leverages the `@runno/sandbox` package, which uses WebAssembly to create isolated environments for code execution.

When an AI assistant calls the `run_code` tool, the server:

1. Validates the request parameters (runtime and code)
2. Executes the code in the specified runtime environment
3. Returns the execution results, including stdout, stderr, and exit code
4. Handles various execution outcomes (completion, crash, termination, timeout)

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

To use the Runno MCP server with an MCP client, you need to:

1. Start the server using the command above
2. Configure your MCP client to connect to the server's stdio
3. The client can then use the `run_code` tool to execute code

### Example MCP Client Integration

While the specific integration depends on the MCP client you're using, here's a general outline:

```javascript
// Example of how an MCP client might connect to the Runno MCP server
const { spawn } = require("child_process");
const mcpProcess = spawn("npx", ["@runno/mcp"]);

// Set up communication channels
mcpProcess.stdout.on("data", (data) => {
  // Process MCP responses
});

// Send requests to the MCP server
mcpProcess.stdin.write(
  JSON.stringify({
    jsonrpc: "2.0",
    id: "1",
    method: "mcp.callTool",
    params: {
      name: "run_code",
      arguments: {
        runtime: "python",
        code: 'print("Hello, world!")',
      },
    },
  })
);
```

## Security Considerations

- The Runno MCP server provides strong isolation of executed code through WebAssembly
- However, resource consumption (CPU, memory) should still be monitored
- For production use, consider implementing additional controls such as timeouts and resource limits

## Installation

If you want to install the package locally:

```bash
npm install @runno/mcp
```
