export function assertUnreachable(_: never, message?: string): never {
  throw new Error(message ?? "Unexpectedly reached unreachable code.");
}
