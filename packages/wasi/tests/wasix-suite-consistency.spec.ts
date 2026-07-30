// Consistency checks for the wasix suite metadata. Pure Node-side —
// no browser page involved. These exist so the suite's coverage
// denominator stays visible and honest:
//
//   1. WASIX_INCLUDE_DIRS ∪ WASIX_BUILD_EXCLUDES exactly partitions the
//      vendored upstream test directories. A wasmer SHA bump that adds a
//      new upstream test fails here until the new test is classified.
//   2. Every WASIX_SUITE_SKIPS key refers to a test that is actually
//      built and run (i.e. is in WASIX_INCLUDE_DIRS). Skip entries for
//      unbuilt or non-existent tests are dead metadata — they caused a
//      long-standing situation where the skip map implied coverage the
//      harness never had.
//   3. The lists stay alphabetised (they're hand-maintained grep
//      targets).
//
// When the vendor checkout is missing locally the partition test is
// skipped (CI always fetches the vendor before running).

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { test, expect } from "@playwright/test";

import {
  WASIX_BUILD_EXCLUDES,
  WASIX_INCLUDE_DIRS,
  WASIX_VENDOR_DIR,
} from "./wasix-suite.constants";
import { WASIX_SUITE_SKIPS } from "./wasix-suite.skip";

const pkgDir = process.cwd();
const wasixTestsDir = join(
  pkgDir,
  WASIX_VENDOR_DIR,
  "wasmer",
  "tests",
  "wasix",
);

function listVendorTestDirs(): string[] {
  return readdirSync(wasixTestsDir)
    .filter((entry) => statSync(join(wasixTestsDir, entry)).isDirectory())
    .sort();
}

test.describe("wasix suite metadata consistency", () => {
  test("include list and build excludes exactly partition the vendored tests", () => {
    test.skip(
      !existsSync(wasixTestsDir),
      "vendor checkout missing — run `npm run test:prepare:wasmer`",
    );

    const vendorDirs = listVendorTestDirs();
    const include = new Set(WASIX_INCLUDE_DIRS);
    const exclude = new Set(Object.keys(WASIX_BUILD_EXCLUDES));

    const overlap = [...include].filter((name) => exclude.has(name));
    expect(
      overlap,
      "tests listed in BOTH WASIX_INCLUDE_DIRS and WASIX_BUILD_EXCLUDES",
    ).toEqual([]);

    const unclassified = vendorDirs.filter(
      (name) => !include.has(name) && !exclude.has(name),
    );
    expect(
      unclassified,
      "upstream test dirs missing from both WASIX_INCLUDE_DIRS and " +
        "WASIX_BUILD_EXCLUDES — classify them (usually after a SHA bump)",
    ).toEqual([]);

    const vendorSet = new Set(vendorDirs);
    const staleInclude = [...include].filter((name) => !vendorSet.has(name));
    expect(
      staleInclude,
      "WASIX_INCLUDE_DIRS entries that no longer exist upstream",
    ).toEqual([]);

    const staleExclude = [...exclude].filter((name) => !vendorSet.has(name));
    expect(
      staleExclude,
      "WASIX_BUILD_EXCLUDES entries that no longer exist upstream",
    ).toEqual([]);
  });

  test("every skip entry refers to a test that is built and run", () => {
    const include = new Set(WASIX_INCLUDE_DIRS);
    const deadSkips = Object.keys(WASIX_SUITE_SKIPS).filter(
      (name) => !include.has(name),
    );
    expect(
      deadSkips,
      "WASIX_SUITE_SKIPS keys not present in WASIX_INCLUDE_DIRS — a skip " +
        "for a test that is never built is dead metadata; move it to " +
        "WASIX_BUILD_EXCLUDES or delete it",
    ).toEqual([]);
  });

  test("hand-maintained lists stay alphabetised", () => {
    const sortedInclude = [...WASIX_INCLUDE_DIRS].sort();
    expect(WASIX_INCLUDE_DIRS).toEqual(sortedInclude);

    const excludeKeys = Object.keys(WASIX_BUILD_EXCLUDES);
    expect(excludeKeys).toEqual([...excludeKeys].sort());

    const skipKeys = Object.keys(WASIX_SUITE_SKIPS);
    expect(skipKeys).toEqual([...skipKeys].sort());
  });
});
