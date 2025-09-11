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
import { CompleteResult, runCode, runFS, RunResult } from "@runno/sandbox";
import { WASIFile } from "@runno/wasi";

const TIMEOUT = 10000; // 10 second timeout

// Tools and schemas

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

const RunFilesSchema = z.object({
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
  input_files: z.array(
    z.union([
      z.object({
        name: z.string(),
        encoding: z.literal("text"),
        content: z.string(),
      }),
      z.object({
        name: z.string(),
        encoding: z.literal("base64"),
        content: z
          .string()
          .base64()
          .transform((content) => Buffer.from(content, "base64")),
      }),
    ]),
  ),
  output_file_names: z.array(z.string()),
});

const runFilesTool = {
  name: "run_code_with_files",
  description: `
Run code in a sandboxed environment against some files, then get the resulting files.

Specify a runtime, some code to run, some files for the code to operate on, and the names of the files you want to output.

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

If you need to process binary data, then it might be best to use C or C++.

If you are processing text data, then it might be best to use Python or JavaScript.

If you're unsure, try Python or JavaScript first.

Use this tool for the following scenarios:
 * Numerically analysing structured data
 * Manipulating images or other media
 * Performing transformations on data
 * Generating reports or visualizations

You can provide files to be processed either as text, or as base64 binary data.
Use the appropriate encoding for the file type. All file names must be
fully qualified paths starting at the root. For example: \`/data.csv\`.

You can use STDOUT to print out results so that you can use them.
Following execution you'll be provided with the STDIN, STDOUT, and
STDERR combined in the form of TTY output.

The files you specify in \`output_file_names\` will also be returned to you
so that you can give them back to the user, or run additional processing on them.

The code is executed in a safe and secure temporary sandbox. You
won't be able to make network connections, or execute system commands.
The only files available to you will be those that you pass in.
You won't be able to import any packages from a package manager
or execute any external programs. Only the core programming language
capabilities are available.
`,
  inputSchema: zodToJsonSchema(RunFilesSchema),
  annotations: {
    title: "Run Code Using Runno Sandbox",
    readOnlyHint: true,
    idempotentHint: true,
  },
} as const;

async function handleRunCode({ runtime, code }: z.infer<typeof RunCodeSchema>) {
  const result = await runCode(runtime, code, {
    timeout: TIMEOUT,
  });

  const type = result.resultType;
  switch (type) {
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
    case "terminated":
    case "timeout":
      return handleErrorResults(result);
    default:
      const unknownType = type satisfies never;
      throw new Error(`Unexpected result type: ${unknownType}`);
  }
}

async function handleRunFiles({
  runtime,
  code,
  input_files,
  output_file_names,
}: z.infer<typeof RunFilesSchema>) {
  // Convert input files to a format suitable for the sandbox
  const files = input_files.reduce(
    (acc, file) => {
      let resultFile: Partial<WASIFile> = {
        path: file.name,
        mode: file.encoding === "text" ? "string" : "binary",
      };
      if (file.encoding === "text") {
        resultFile.content = file.content;
      } else {
        resultFile.content = Uint8Array.from(file.content);
      }
      acc[file.name] = resultFile as WASIFile;
      return acc;
    },
    {} as Record<string, WASIFile>,
  );

  const result = await runFS(
    runtime,
    "/program",
    {
      "/program": {
        path: "/program",
        mode: "string",
        timestamps: {
          access: new Date(),
          modification: new Date(),
          change: new Date(),
        },
        content: code,
      },
      ...files,
    },
    {
      timeout: TIMEOUT,
    },
  );

  const type = result.resultType;
  switch (type) {
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
          ...output_file_names.map((fileName) => {
            const file = result.fs[fileName];
            if (!file) {
              return {
                type: "text",
                text: `Output file ${fileName} not found in the result.`,
              };
            }

            const mode = file.mode;
            switch (mode) {
              case "string":
                return {
                  type: "resource",
                  uri: fileName,
                  text: file.content,
                };
              case "binary":
                return {
                  type: "resource",
                  uri: fileName,
                  blob: Buffer.from(file.content).toString("base64"),
                };
              default:
                const unknownType = mode satisfies never;
                throw new Error(`Unexpected file mode: ${unknownType}`);
            }
          }),
        ],
      };
    case "crash":
    case "terminated":
    case "timeout":
      return handleErrorResults(result);
    default:
      const unknownType = type satisfies never;
      throw new Error(`Unexpected result type: ${unknownType}`);
  }
}

// Helper functions
function handleErrorResults(result: Exclude<RunResult, CompleteResult>) {
  const type = result.resultType;
  switch (type) {
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
    default:
      const unknownType = type satisfies never;
      throw new Error(`Unexpected result type: ${unknownType}`);
  }
}

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
  },
);

server.setRequestHandler(ListToolsRequestSchema, async (request) => {
  return {
    tools: [runCodeTool],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (name === "run_code") {
    return handleRunCode(RunCodeSchema.parse(args));
  } else if (name === "run_code_with_files") {
    return handleRunFiles(RunFilesSchema.parse(args));
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
