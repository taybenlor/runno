// Path helpers for the WASIX cwd surface. Dependency-free so they are
// directly unit-testable; not re-exported from lib/main.ts.

/**
 * Resolve a guest-supplied path against the current working directory.
 * Absolute paths (leading `/`) bypass the cwd join. The result is
 * normalised so `..` segments fold correctly and trailing slashes are
 * dropped (except for the root).
 *
 * Used by `chdir` to compute the absolute target of a relative cwd
 * change. Other syscalls do not call this — wasix-libc resolves
 * relative paths against `getcwd()` itself before calling `path_*`,
 * so by the time a path reaches the runtime it is already preopen-
 * relative.
 */
export function resolveAbsolute(cwd: string, path: string): string {
  const joined = path.startsWith("/") ? path : `${cwd}/${path}`;
  const segments = joined.split("/");
  const out: string[] = [];
  for (const segment of segments) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (out.length > 0) out.pop();
      continue;
    }
    out.push(segment);
  }
  return "/" + out.join("/");
}

export function stripLeadingSlash(path: string): string {
  return path.startsWith("/") ? path.slice(1) : path;
}
