import { runCode, runFS } from "../lib/main.ts";

const codeResult = await runCode(
  "python",
  `
print("Hello, World!");
`
);

console.log("Run Code Result:", codeResult);

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
