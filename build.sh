#!/bin/bash
set -e

echo "=== Adblock Rust Firefox Extension Builder ==="

# Ensure rustup's toolchain is used (not homebrew's)
export PATH="$HOME/.rustup/toolchains/$(rustup show active-toolchain | cut -d' ' -f1)/bin:$PATH"

# Check prerequisites
if ! command -v wasm-pack &> /dev/null; then
    echo "ERROR: wasm-pack not found. Install with: cargo install wasm-pack"
    exit 1
fi

if ! rustup target list --installed | grep -q wasm32-unknown-unknown; then
    echo "Adding wasm32-unknown-unknown target..."
    rustup target add wasm32-unknown-unknown
fi

# Build WASM
echo "Building WASM module..."
cd wasm
wasm-pack build --target web --out-dir ../extension/pkg --release
cd ..

# Clean up wasm-pack artifacts not needed for extension
rm -f extension/pkg/.gitignore extension/pkg/package.json extension/pkg/README.md

echo ""
echo "=== Build complete ==="
echo "Load extension in Firefox:"
echo "  1. Open about:debugging#/runtime/this-firefox"
echo "  2. Click 'Load Temporary Add-on'"
echo "  3. Select extension/manifest.json"
