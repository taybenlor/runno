import "../lib/main";
import {
  CompleteResult,
  CrashResult,
  Runtime,
  TerminatedResult,
  headlessRunCode,
} from "../lib/main";

globalThis.Runno = {
  headlessRunCode,
};

export type TestRunResult =
  | CrashResult
  | TerminatedResult
  | Omit<CompleteResult, "fs">;

globalThis.test = {
  /**
   * Returning the fs in a test environment from playwright can result in a massive transfer
   * of files over the boundary between the headless browser and the playwright test runner.
   * This can cause tests to slow down significantly.
   *
   * So this wrapper strips out the `fs` from the result.
   */
  async headlessRunCode(
    runtime: Runtime,
    code: string,
    stdin?: string
  ): Promise<TestRunResult> {
    const result = await headlessRunCode(runtime, code, stdin);

    if (result.resultType !== "complete") {
      return result;
    }

    return {
      resultType: "complete",
      stdin: result.stdin,
      stdout: result.stdout,
      stderr: result.stderr,
      tty: result.tty,
      exitCode: result.exitCode,
    };
  },
};
