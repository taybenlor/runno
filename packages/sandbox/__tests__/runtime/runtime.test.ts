import { describe, it, expect } from "vitest";
import { runCode } from "../../lib/main.js";

describe("@runno/sandbox runtime", () => {
  it("should run Python code successfully", async () => {
    const result = await runCode("python", "print('Hello, world!')");
    expect(result.resultType).toBe("complete");
    if (result.resultType === "complete") {
      expect(result.stdout).toBe("Hello, world!\n");
      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
    }
  });

  it("should run Ruby code successfully", async () => {
    const result = await runCode("ruby", 'puts "Hello, World!"');
    expect(result.resultType).toBe("complete");
    if (result.resultType === "complete") {
      expect(result.stdout).toBe("Hello, World!\n");
      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
    }
  });

  it("should run JavaScript code successfully", async () => {
    const result = await runCode("quickjs", 'console.log("Hello, World!");');
    expect(result.resultType).toBe("complete");
    if (result.resultType === "complete") {
      expect(result.stdout).toBe("Hello, World!\n");
      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
    }
  });

  it("should run PHP code successfully", async () => {
    const result = await runCode(
      "php-cgi",
      '<?php\nprint "Hello, World!\\n";\n?>'
    );
    expect(result.resultType).toBe("complete");
    if (result.resultType === "complete") {
      expect(result.stdout).toContain("Hello, World!\n");
      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
    }
  });

  it("should run C code successfully", async () => {
    const result = await runCode(
      "clang",
      '#include <stdio.h>\nint main() {\n  printf("Hello, World!\\n");\n  return 0;\n}'
    );
    expect(result.resultType).toBe("complete");
    if (result.resultType === "complete") {
      expect(result.stdout).toBe("Hello, World!\n");
      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
    }
  });

  it("should run C++ code successfully", async () => {
    const result = await runCode(
      "clangpp",
      '#include <iostream>\nint main() {\n  std::cout << "Hello, World!" << std::endl;\n  return 0;\n}'
    );
    expect(result.resultType).toBe("complete");
    if (result.resultType === "complete") {
      expect(result.stdout).toBe("Hello, World!\n");
      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
    }
  });

  it("should handle timeouts correctly", async () => {
    const result = await runCode("python", "while True: pass", {
      timeout: 0.1,
    });
    expect(result.resultType).toBe("timeout");
  });
});
