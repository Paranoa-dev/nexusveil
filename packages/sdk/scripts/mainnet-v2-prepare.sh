#!/usr/bin/env bash
# Read-only/local Core v2 mainnet deployment preparation. Sends no transaction.
set -euo pipefail

cd "$(dirname "$0")/../../.."

echo "[1/4] Building public packages"
pnpm packages:build >/dev/null

echo "[2/4] Building deterministic Core v2 WASM"
stellar contract build --out-dir artifacts >/dev/null

EXPECTED_HASH="2c7bc6b4c91940ac185df38a3d0a8532b555140d818df94f03f894e5952ebf42"
ACTUAL_HASH="$(shasum -a 256 artifacts/sub_rosa_round.wasm | awk '{print $1}')"
if [[ "$ACTUAL_HASH" != "$EXPECTED_HASH" ]]; then
  echo "error: built WASM $ACTUAL_HASH does not match reviewed Core v2 $EXPECTED_HASH" >&2
  exit 1
fi

echo "[3/4] Checking generated bindings"
pnpm bindings:check >/dev/null

echo "[4/4] Verifying mainnet execution remains locked"
if [[ -n "${MAINNET_CONFIRM:-}" || -n "${OPERATOR_SECRET:-}" || -n "${OPERATOR_IDENTITY:-}" ]]; then
  echo "warning: preparation ignores mainnet signer settings; no transaction was sent" >&2
fi

echo
echo "CORE V2 MAINNET PREPARE OK"
echo "WASM:     artifacts/sub_rosa_round.wasm"
echo "SHA-256:  $ACTUAL_HASH"
echo "Network:  Stellar Mainnet"
echo "RPC:      ${RPC_URL:-https://mainnet.sorobanrpc.com}"
echo "Writes:   0"
echo
echo "Blocked on funding/approval:"
echo "  MAINNET_CONFIRM=SUB_ROSA_MAINNET OPERATOR_IDENTITY=... pnpm mainnet:v2:deploy"
