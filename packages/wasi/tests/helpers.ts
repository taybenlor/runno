import * as fs from "fs";
import type { WASIFS } from "../lib/types";

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
    for (const line of argsData.toString("utf8").split("\n")) {
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
    for (const line of envData.toString("utf8").split("\n")) {
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
    stdin = stdinData.toString("utf8");
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
    stdout = stdoutData.toString("utf8");
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
    stderr = stderrData.toString("utf8");
  } catch {
    // do nothing
  }

  return stderr;
}

export function getFS(suite: Suite, binary: string) {
  let files: WASIFS = {};

  try {
    const name = binary.replace("wasm", "dir");
    addFilesFromPath(
      files,
      `public/bin/wasi-test-suite-main/${suite}/${name}`,
      name
    );
  } catch {
    // do nothing
  }

  try {
    // Some tests expect the stdin file to be in the cwd
    const stdinFile = binary.replace("wasm", "stdin");
    const stdinData = fs.readFileSync(
      `public/bin/wasi-test-suite-main/${suite}/${stdinFile}`
    );

    files[stdinFile] = {
      path: stdinFile,
      timestamps: {
        access: new Date(),
        change: new Date(),
        modification: new Date(),
      },
      mode: "string",
      content: stdinData.toString("utf8"),
    };
  } catch {
    // do nothing
  }

  return files;
}

function addFilesFromPath(files: WASIFS, path: string, rootPath: string) {
  const stat = fs.statSync(path);
  if (stat.isDirectory()) {
    const list = fs.readdirSync(path);
    for (const file of list) {
      if (fs.statSync(`${path}/${file}`).isDirectory()) {
        addFilesFromPath(files, `${path}/${file}`, `${rootPath}/${file}`);
        continue;
      }

      const filePath = `/${rootPath}/${file}`;
      files[filePath] = {
        path: filePath,
        timestamps: {
          access: new Date(),
          change: new Date(),
          modification: new Date(),
        },
        mode: "string",
        content: fs.readFileSync(`${path}/${file}`).toString("utf8"),
      };
    }
  }
}
