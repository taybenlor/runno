// TODO: Investigate these tests https://github.com/caspervonb/wasi-test-suite

// TODO: Also investigate these tests https://github.com/bytecodealliance/wasmtime/tree/main/crates/test-programs/wasi-tests

import * as fs from "fs";

import { test, expect } from "@playwright/test";

import type { WASI, WASIContext } from "../lib/main";
import {
  getEnv,
  getStatus,
  getStdin,
  getStderr,
  getStdout,
  getFS,
} from "./helpers.js";

const files = fs.readdirSync("public/bin/wasi-test-suite-main/libc");
const wasmFiles = files.filter((f) => f.endsWith(".wasm"));

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:5173");
  await page.waitForLoadState("domcontentloaded");
});

for (const name of wasmFiles) {
  const expectedStatus = getStatus("libc", name);
  const env = getEnv("libc", name);
  const stdin = getStdin("libc", name);
  const stdout = getStdout("libc", name);
  const stderr = getStderr("libc", name);
  const fs = getFS("libc", name);

  test.describe(`libc/${name}`, () => {
    test(`Gives a ${expectedStatus} exit code${
      env ? ` with env ${JSON.stringify(env)}` : ""
    }`, async ({ page }) => {
      const {
        exitCode,
        stderr: stderrResult,
        stdout: stdoutResult,
      } = await page.evaluate(
        async function ({ url, env, stdin, fs }) {
          while (window["WASI"] === undefined) {
            await new Promise((resolve) => setTimeout(resolve));
          }

          const W: typeof WASI = (window as any)["WASI"];
          const WC: typeof WASIContext = (window as any)["WASIContext"];

          let stderr = "";
          let stdout = "";
          return W.start(
            fetch(url),
            new WC({
              args: [],
              env,
              stdout: (s) => {
                stdout += s;
              },
              stderr: (s) => {
                stderr += s;
              },
              stdin: (maxByteLength: number) => {
                const retvalue = stdin;
                stdin = "";
                return retvalue;
              },
              fs,
            })
          ).then((result) => {
            return {
              ...result,
              stderr,
              stdout,
            };
          });
        },
        { url: `/bin/wasi-test-suite-main/libc/${name}`, env, stdin, fs }
      );

      expect(exitCode).toBe(expectedStatus);

      if (stdout) {
        expect(stdoutResult).toEqual(stdout);
      }

      if (stderr) {
        expect(stderrResult).toEqual(stderr);
      }
    });
  });
}
