import { describe, it, expect, beforeEach } from "vitest";
import { runFS } from "@runno/sandbox";
import type { WASIFS } from "@runno/wasi";

describe("@runno/sandbox streaming stdin", () => {
  let testFS: WASIFS;

  beforeEach(() => {
    // Create a simple Python program that reads from stdin and echoes it back
    testFS = {
      "/program.py": {
        path: "program.py",
        content: `import sys
for line in sys.stdin:
    print(f"Got: {line.rstrip()}")
`,
        mode: "string",
        timestamps: {
          access: new Date(),
          modification: new Date(),
          change: new Date(),
        },
      },
    };
  });

  describe("AsyncIterable<string>", () => {
    it("should handle small chunks via async generator", async () => {
      async function* smallChunks() {
        yield "hello\n";
        yield "world\n";
      }

      const result = await runFS("python", "/program.py", testFS, {
        stdin: smallChunks(),
      });

      expect(result.resultType).toBe("complete");
      if (result.resultType === "complete") {
        expect(result.stdout).toContain("Got: hello");
        expect(result.stdout).toContain("Got: world");
        expect(result.exitCode).toBe(0);
      }
    });

    it("should handle large chunks that exceed buffer size", async () => {
      // Generate a chunk larger than 8KiB (default stdinBuffer size)
      // Default buffer is 8192 bytes, minus 4 bytes header = 8188 usable
      // Let's create ~20KB string to test splitting
      const largeString = "x".repeat(20000) + "\n";

      async function* largeChunks() {
        yield largeString;
      }

      const result = await runFS("python", "/program.py", testFS, {
        stdin: largeChunks(),
      });

      expect(result.resultType).toBe("complete");
      if (result.resultType === "complete") {
        expect(result.stdout).toContain("Got: ");
        // The output should contain at least some of the x's
        expect(result.stdout.length).toBeGreaterThan(100);
        expect(result.exitCode).toBe(0);
      }
    });

    it("should handle UTF-8 multi-byte characters correctly", async () => {
      async function* utf8Chunks() {
        // Mix of ASCII and multi-byte UTF-8 characters
        yield "Hello\n";
        yield "你好世界\n"; // Chinese: "Hello World"
        yield "Привет\n"; // Russian: "Hello"
        yield "🌍🚀\n"; // Emojis (4-byte UTF-8)
      }

      const result = await runFS("python", "/program.py", testFS, {
        stdin: utf8Chunks(),
      });

      expect(result.resultType).toBe("complete");
      if (result.resultType === "complete") {
        expect(result.stdout).toContain("Got: Hello");
        expect(result.stdout).toContain("Got: 你好世界");
        expect(result.stdout).toContain("Got: Привет");
        expect(result.stdout).toContain("Got: 🌍🚀");
        expect(result.exitCode).toBe(0);
      }
    });

    it("should handle async delays between chunks", async () => {
      async function* delayedChunks() {
        yield "first\n";
        await new Promise((resolve) => setTimeout(resolve, 10));
        yield "second\n";
        await new Promise((resolve) => setTimeout(resolve, 10));
        yield "third\n";
      }

      const result = await runFS("python", "/program.py", testFS, {
        stdin: delayedChunks(),
      });

      expect(result.resultType).toBe("complete");
      if (result.resultType === "complete") {
        expect(result.stdout).toContain("Got: first");
        expect(result.stdout).toContain("Got: second");
        expect(result.stdout).toContain("Got: third");
        expect(result.exitCode).toBe(0);
      }
    });
  });

  describe("ReadableStream<string>", () => {
    it("should handle ReadableStream input", async () => {
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("line1\n");
          controller.enqueue("line2\n");
          controller.enqueue("line3\n");
          controller.close();
        },
      });

      const result = await runFS("python", "/program.py", testFS, {
        stdin: stream,
      });

      expect(result.resultType).toBe("complete");
      if (result.resultType === "complete") {
        expect(result.stdout).toContain("Got: line1");
        expect(result.stdout).toContain("Got: line2");
        expect(result.stdout).toContain("Got: line3");
        expect(result.exitCode).toBe(0);
      }
    });

    it("should handle ReadableStream with large chunk", async () => {
      const largeString = "a".repeat(20000);
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue(largeString + "\n");
          controller.close();
        },
      });

      const result = await runFS("python", "/program.py", testFS, {
        stdin: stream,
      });

      expect(result.resultType).toBe("complete");
      if (result.resultType === "complete") {
        expect(result.stdout).toContain("Got: ");
        expect(result.exitCode).toBe(0);
      }
    });
  });

  describe("Factory function returning AsyncIterable", () => {
    it("should handle factory function that returns async generator", async () => {
      function createStdinIterator(): AsyncIterable<string> {
        return (async function* () {
          yield "foo\n";
          yield "bar\n";
        })();
      }

      const result = await runFS("python", "/program.py", testFS, {
        stdin: createStdinIterator,
      });

      expect(result.resultType).toBe("complete");
      if (result.resultType === "complete") {
        expect(result.stdout).toContain("Got: foo");
        expect(result.stdout).toContain("Got: bar");
        expect(result.exitCode).toBe(0);
      }
    });
  });

  describe("Backward compatibility", () => {
    it("should still accept plain string stdin", async () => {
      const result = await runFS("python", "/program.py", testFS, {
        stdin: "backward_compat\n",
      });

      expect(result.resultType).toBe("complete");
      if (result.resultType === "complete") {
        expect(result.stdout).toContain("Got: backward_compat");
        expect(result.exitCode).toBe(0);
      }
    });

    it("should work with undefined stdin", async () => {
      const echoFS: WASIFS = {
        "/program.py": {
          path: "program.py",
          content: `print("No input needed")`,
          mode: "string",
          timestamps: {
            access: new Date(),
            modification: new Date(),
            change: new Date(),
          },
        },
      };

      const result = await runFS("python", "/program.py", echoFS, {
        stdin: undefined,
      });

      expect(result.resultType).toBe("complete");
      if (result.resultType === "complete") {
        expect(result.stdout).toContain("No input needed");
        expect(result.exitCode).toBe(0);
      }
    });
  });

  describe("UTF-8 boundary safety", () => {
    it("should not split multi-byte UTF-8 sequences", async () => {
      // Create a program that counts input characters
      const countFS: WASIFS = {
        "/program.py": {
          path: "program.py",
          content: `import sys
content = sys.stdin.read()
print(f"Chars: {len(content)}")
print(f"Content: {repr(content)}")
`,
          mode: "string",
          timestamps: {
            access: new Date(),
            modification: new Date(),
            change: new Date(),
          },
        },
      };

      // String with many multi-byte characters that will force splitting
      // Create 2000 Chinese characters (each is 3 bytes in UTF-8)
      const chineseChars = "你".repeat(2000) + "好\n";

      async function* chunks() {
        yield chineseChars;
      }

      const result = await runFS("python", "/program.py", countFS, {
        stdin: chunks(),
      });

      expect(result.resultType).toBe("complete");
      if (result.resultType === "complete") {
        // Python should be able to read the content without replacement characters
        expect(result.stdout).not.toContain("\\ufffd"); // Unicode replacement character
        expect(result.exitCode).toBe(0);
      }
    });

    it("should handle 4-byte UTF-8 emoji characters at boundaries", async () => {
      const countFS: WASIFS = {
        "/program.py": {
          path: "program.py",
          content: `import sys
content = sys.stdin.read()
# Just echo back to verify no corruption
print(repr(content))
`,
          mode: "string",
          timestamps: {
            access: new Date(),
            modification: new Date(),
            change: new Date(),
          },
        },
      };

      // Emojis are 4 bytes in UTF-8, good test for boundary cases
      const emojiString = "🌍🚀🎉🔥💯".repeat(1000) + "\n";

      async function* chunks() {
        yield emojiString;
      }

      const result = await runFS("python", "/program.py", countFS, {
        stdin: chunks(),
      });

      expect(result.resultType).toBe("complete");
      if (result.resultType === "complete") {
        expect(result.exitCode).toBe(0);
      }
    });
  });

  describe("Edge cases", () => {
    it("should handle empty async iterable", async () => {
      async function* emptyChunks() {
        // yield nothing
      }

      const result = await runFS("python", "/program.py", testFS, {
        stdin: emptyChunks(),
      });

      expect(result.resultType).toBe("complete");
      if (result.resultType === "complete") {
        // Should exit cleanly with no output (program reads nothing and exits)
        expect(result.exitCode).toBe(0);
      }
    });

    it("should handle single large chunk without intermediate yields", async () => {
      async function* singleLargeChunk() {
        yield "x".repeat(50000) + "\n";
      }

      const result = await runFS("python", "/program.py", testFS, {
        stdin: singleLargeChunk(),
      });

      expect(result.resultType).toBe("complete");
      if (result.resultType === "complete") {
        expect(result.exitCode).toBe(0);
      }
    });

    it("should handle very rapid chunk generation", async () => {
      async function* rapidChunks() {
        for (let i = 0; i < 100; i++) {
          yield `line${i}\n`;
        }
      }

      const result = await runFS("python", "/program.py", testFS, {
        stdin: rapidChunks(),
      });

      expect(result.resultType).toBe("complete");
      if (result.resultType === "complete") {
        // Check that at least some lines were processed
        expect(result.stdout).toContain("Got: line0");
        expect(result.exitCode).toBe(0);
      }
    });

    it("should handle chunks with newlines and special characters", async () => {
      async function* specialChunks() {
        yield "line with\ttab\n";
        yield "line with\\backslash\n";
        yield 'line with "quotes"\n';
        yield "line with\x00null\n"; // null character
      }

      const result = await runFS("python", "/program.py", testFS, {
        stdin: specialChunks(),
      });

      expect(result.resultType).toBe("complete");
      if (result.resultType === "complete") {
        expect(result.exitCode).toBe(0);
      }
    });
  });

  describe("RunFS with streaming stdin and filesystem", () => {
    it("should combine streaming stdin with virtual filesystem", async () => {
      const combinedFS: WASIFS = {
        "/program.py": {
          path: "program.py",
          content: `import sys
# Read from stdin
for line in sys.stdin:
    with open('/output.txt', 'a') as f:
        f.write(f"Processed: {line}")
`,
          mode: "string",
          timestamps: {
            access: new Date(),
            modification: new Date(),
            change: new Date(),
          },
        },
      };

      async function* chunks() {
        yield "data1\n";
        yield "data2\n";
      }

      const result = await runFS("python", "/program.py", combinedFS, {
        stdin: chunks(),
      });

      expect(result.resultType).toBe("complete");
      if (result.resultType === "complete") {
        // Check that output file was created
        expect(result.fs["/output.txt"]).toBeDefined();
        if (result.fs["/output.txt"]) {
          const content = result.fs["/output.txt"].content as string;
          expect(content).toContain("Processed: data1");
          expect(content).toContain("Processed: data2");
        }
        expect(result.exitCode).toBe(0);
      }
    });
  });

  describe("Multiple streaming operations in sequence", () => {
    it("should handle multiple sequential calls with streaming stdin", async () => {
      async function* firstChunks() {
        yield "first\n";
      }

      async function* secondChunks() {
        yield "second\n";
      }

      // First call
      const result1 = await runFS("python", "/program.py", testFS, {
        stdin: firstChunks(),
      });

      expect(result1.resultType).toBe("complete");
      if (result1.resultType === "complete") {
        expect(result1.stdout).toContain("Got: first");
      }

      // Second call
      const result2 = await runFS("python", "/program.py", testFS, {
        stdin: secondChunks(),
      });

      expect(result2.resultType).toBe("complete");
      if (result2.resultType === "complete") {
        expect(result2.stdout).toContain("Got: second");
      }
    });
  });
});
