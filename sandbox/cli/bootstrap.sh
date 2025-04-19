#!/bin/bash
cp -R ../../langs .
find langs/ -type f -name '*.wasm' -exec bash -c 'f="$1"; mv -- "$f" "$f.bin"' _ {} \;