import * as fs from "fs";

export type Suite = "core" | "libc" | "libstd";

export function getStatus(suite: Suite, binary: string) {
  let status = 0;

  try {
    const statusData = fs.readFileSync(
      `public/bin/wasi-test-suite-main/${suite}/${binary.replace(
        "wasm",
        "status"
      )}`
    );
    status = parseInt(statusData.toString(), 10);
  } catch {
    // do nothing
  }

  return status;
}

export function getArgs(suite: Suite, binary: string) {
  let args: string[] = [];

  try {
    const argsData = fs.readFileSync(
      `public/bin/wasi-test-suite-main/${suite}/${binary.replace(
        "wasm",
        "arg"
      )}`
    );
    args = [];
    for (const line of argsData.toString().split("\n")) {
      if (!line.trim()) continue;
      args.push(line);
    }
  } catch {
    // do nothing
  }

  return args;
}

export function getEnv(suite: Suite, binary: string) {
  let env: {} | undefined = undefined;

  try {
    const envData = fs.readFileSync(
      `public/bin/wasi-test-suite-main/${suite}/${binary.replace(
        "wasm",
        "env"
      )}`
    );
    env = {};
    for (const line of envData.toString().split("\n")) {
      if (!line.trim()) continue;
      const [key, value] = line.trim().split("=");
      env[key] = value;
    }
  } catch {
    // do nothing
  }

  return env;
}

export function getStdin(suite: Suite, binary: string) {
  let stdin = "";

  try {
    const stdinData = fs.readFileSync(
      `public/bin/wasi-test-suite-main/${suite}/${binary.replace(
        "wasm",
        "stdin"
      )}`
    );
    stdin = stdinData.toString();
  } catch {
    // do nothing
  }

  return stdin;
}

export function getStdout(suite: Suite, binary: string) {
  let stdout = "";

  try {
    const stdoutData = fs.readFileSync(
      `public/bin/wasi-test-suite-main/${suite}/${binary.replace(
        "wasm",
        "stdout"
      )}`
    );
    stdout = stdoutData.toString();
  } catch {
    // do nothing
  }

  return stdout;
}

export function getStderr(suite: Suite, binary: string) {
  let stderr = "";

  try {
    const stderrData = fs.readFileSync(
      `public/bin/wasi-test-suite-main/${suite}/${binary.replace(
        "wasm",
        "stderr"
      )}`
    );
    stderr = stderrData.toString();
  } catch {
    // do nothing
  }

  return stderr;
}

export function getFS(suite: Suite, binary: string) {
  let files = {};

  try {
    const name = binary.replace("wasm", "dir");
    const exists = fs.existsSync(
      `public/bin/wasi-test-suite-main/${suite}/${name}`
    );
    if (exists) {
      const path = `${name}/.gitignore`;
      files = {
        ...files,
        [path]: {
          path,
          timestamps: {
            access: new Date(),
            change: new Date(),
            modification: new Date(),
          },
          mode: "string",
          content: "",
        },
      };
    }
  } catch {
    // do nothing
  }

  return files;
}
