export type WASIExample = {
  binary: string;
  files: File[];
  args: string[];
  env: string;
  settings?: Partial<{
    echoSTDIN: boolean;
  }>;
  title: string;
  instructions: string;
  source?: string;
};

export const WRITE: WASIExample = {
  binary: `${import.meta.env.VITE_HOST}wasi-demos/write.wasi.wasm`,
  files: [],
  args: ["hello.txt"],
  env: ``,
  settings: {
    echoSTDIN: true,
  },
  title: "write",
  instructions: `write - Write STDIN to arg1

This demo writes whatever you type to the file specified in args. When the program finishes you'll see a file in the filesystem with your contents. 

To finish entering text press ctrl+d.`,

  source: "https://gist.github.com/taybenlor/df261f5958ce9be694b15f6fb7ce44f6",
};

export const CAT: WASIExample = {
  binary: `${import.meta.env.VITE_HOST}wasi-demos/cat.wasi.wasm`,
  files: [new File(["G'day WASI!"], "/gday.txt")],
  args: ["gday.txt"],
  env: ``,
  title: "cat",
  instructions: `cat - print each args file to STDOUT

This demo prints out whatever is in the files listed as arguments.`,
  source: "https://gist.github.com/taybenlor/da708221070d96616f1886b88f4a6728",
};

export const QUICKJS: WASIExample = {
  binary: `${import.meta.env.VITE_HOST}wasi-demos/quickjs.wasi.wasm`,
  files: [],
  args: [],
  env: ``,
  title: "QuickJS",
  instructions: `quickjs - embeddable ES2020 Javascript engine

console.log / print - print to STDOUT
std.in.getline - get a line from STDIN

For more on the standard library, click view source.`,
  source: "https://bellard.org/quickjs/",
};

export const DEMOS = [WRITE, CAT, QUICKJS];
