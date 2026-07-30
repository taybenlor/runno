#!/usr/bin/env bash
# Best-effort installer for the WASIX test toolchain.
#
# Probes for `wat2wasm` (from wabt) and `wasixcc` (from the wasix
# toolchain). Anything missing is installed via the host package
# manager where possible. Already-present tools are left alone and the
# script exits 0. A failed install attempt exits non-zero so the caller
# can see what broke.

set -uo pipefail

note() { printf '[install-wasix-tools] %s\n' "$*"; }
fail() { printf '[install-wasix-tools] ERROR: %s\n' "$*" >&2; exit 1; }

have() { command -v "$1" >/dev/null 2>&1; }

install_wabt() {
  if have wat2wasm; then
    note "wabt: already installed ($(wat2wasm --version 2>/dev/null || echo unknown))"
    return 0
  fi
  note "wabt: not installed — attempting install"
  case "$(uname -s)" in
    Linux*)
      if have apt-get; then
        sudo apt-get update && sudo apt-get install -y wabt \
          || fail "apt-get install wabt failed"
      else
        fail "no apt-get on this Linux — install wabt manually"
      fi
      ;;
    Darwin*)
      if have brew; then
        brew install wabt || fail "brew install wabt failed"
      else
        fail "Homebrew not found — install wabt manually"
      fi
      ;;
    *)
      fail "unsupported OS $(uname -s) — install wabt manually"
      ;;
  esac
}

install_wasixcc() {
  if have wasixcc; then
    note "wasixcc: already installed ($(wasixcc --version 2>/dev/null | head -n1 || echo unknown))"
    return 0
  fi

  # Install the pinned wasixcc release binary (wasixccenv), which
  # downloads the sysroot / LLVM / binaryen into ~/.wasixcc and symlinks
  # the wasixcc / wasix++ / wasixld executables into ~/.local/bin.
  local version="v0.4.3"
  local arch os target
  arch="$(uname -m)"
  os="$(uname -s)"
  case "$os-$arch" in
    Darwin-arm64) target="aarch64-apple-darwin" ;;
    Darwin-x86_64) target="x86_64-apple-darwin" ;;
    Linux-aarch64) target="aarch64-unknown-linux-gnu" ;;
    Linux-x86_64) target="x86_64-unknown-linux-gnu" ;;
    *) fail "unsupported platform $os/$arch — install wasixcc manually from https://github.com/wasix-org/wasixcc" ;;
  esac

  note "wasixcc: installing $version for $target"
  local tmpdir
  tmpdir="$(mktemp -d)"
  curl -fsSL -o "$tmpdir/wasixcc.tar.gz" \
    "https://github.com/wasix-org/wasixcc/releases/download/$version/wasixcc-$target.tar.gz" \
    || fail "download of wasixcc $version failed"
  tar -xzf "$tmpdir/wasixcc.tar.gz" -C "$tmpdir" || fail "extract failed"
  mkdir -p "$HOME/.local/bin"
  "$tmpdir/wasixccenv" download-all || fail "wasixccenv download-all failed"
  "$tmpdir/wasixccenv" install-executables "$HOME/.local/bin" \
    || fail "wasixccenv install-executables failed"
  rm -rf "$tmpdir"

  if ! have wasixcc; then
    note "wasixcc installed to ~/.local/bin — add it to your PATH:"
    note '  export PATH="$HOME/.local/bin:$PATH"'
  fi
}

install_wabt
install_wasixcc

note "all tools present"
