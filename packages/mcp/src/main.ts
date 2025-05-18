#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  InitializeRequestSchema,
  ListToolsRequestSchema,
  ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import pkg from "../package.json";
import { runCode } from "@runno/sandbox";

const TIMEOUT = 10000; // 10 second timeout

const RunCodeSchema = z.object({
  runtime: z.enum([
    "python",
    "quickjs",
    //"sqlite", - not useful in this context
    "clang",
    "clangpp",
    "ruby",
    "php-cgi",
  ]),
  code: z.string(),
});

const runCodeTool = {
  name: "run_code",
  description: `
Run code in a sandboxed environment.

Specify a runtime and then provide some code to run.

| runtime | Programming Language |
|---------|----------------------|
| python  | Python               |
| quickjs | JavaScript           |
| clang   | C                    |
| clangpp | C++                  |
| ruby    | Ruby                 |
| php-cgi | PHP                  |

You can write code for any of the available runtimes, so use the best
programming language for the job.

If you're unsure, try Python or JavaScript first.

Use this tool for the following scenarios:
 * Running a complex calculation to get an accurate answer
 * Solving a problem that requires an algorithm
 * Generating statistics or analysing data
 * Seeing the result of a small snippet of code run in isolation
 * Debugging code by running small snippets
 * Testing code by running small snippets

You can use STDOUT to print out results so that you can use them.
Following execution you'll be provided with the STDIN, STDOUT, and
STDERR combined in the form of TTY output.

Make sure that all the data you need is provided inside the program,
you won't be able to access the file system or connect to the internet.

The code is executed in a safe and secure temporary sandbox. You
won't be able to make network connections, access the filesystem, or
execute system commands. You won't be able to import any packages
from a package manager or execute any external programs. Only the
core programming language capabilities are available.
`,
  inputSchema: zodToJsonSchema(RunCodeSchema),
  annotations: {
    title: "Run Code Using Runno Sandbox",
    readOnlyHint: true,
    idempotentHint: true,
  },
} as const;

// Server setup
const server = new Server(
  {
    name: "Runno Code Sandbox Server",
    version: pkg.version,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async (request) => {
  return {
    tools: [runCodeTool],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (name === "run_code") {
    const { runtime, code } = RunCodeSchema.parse(args);

    const result = await runCode(runtime, code, {
      timeout: TIMEOUT,
    });

    switch (result.resultType) {
      case "complete":
        return {
          content: [
            {
              type: "text",
              text: `Execution completed with exit code ${result.exitCode}.`,
            },
            {
              type: "text",
              text: `Following is the TTY output.`,
            },
            {
              type: "text",
              text: result.tty,
            },
          ],
        };
      case "crash":
        return {
          content: [
            {
              type: "text",
              text: `Execution crashed with error ${result.error.type}: ${result.error.message}.`,
            },
          ],
        };
      case "terminated":
        return {
          content: [
            {
              type: "text",
              text: "The program was terminated.",
            },
          ],
        };
      case "timeout":
        return {
          content: [
            {
              type: "text",
              text: "Execution timed out.",
            },
          ],
        };
    }
  }
  throw new Error("Tool not found");
});

// Start server
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Runno Code Sandbox Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
