#!/usr/bin/env bash
# Upload and deploy the reviewed Core v2 WASM to Stellar mainnet.
set -euo pipefail

cd "$(dirname "$0")/../../.."

[[ "${MAINNET_CONFIRM:-}" == "SUB_ROSA_MAINNET" ]] || {
  echo "error: set MAINNET_CONFIRM=SUB_ROSA_MAINNET" >&2
  exit 1
}
if [[ -n "${OPERATOR_SECRET:-}" && -n "${OPERATOR_IDENTITY:-}" ]]; then
  echo "error: set only one of OPERATOR_SECRET or OPERATOR_IDENTITY" >&2
  exit 1
fi
SIGNER_REF="${OPERATOR_SECRET:-${OPERATOR_IDENTITY:-}}"
[[ -n "$SIGNER_REF" ]] || {
  echo "error: set OPERATOR_IDENTITY (preferred) or OPERATOR_SECRET" >&2
  exit 1
}

RPC_URL="${RPC_URL:-https://mainnet.sorobanrpc.com}"
NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-Public Global Stellar Network ; September 2015}"

bash packages/sdk/scripts/mainnet-v2-prepare.sh

echo "Uploading reviewed Core v2 WASM to mainnet"
WASM_HASH="$(stellar contract upload \
  --wasm artifacts/sub_rosa_round.wasm \
  --optimize=false \
  --quiet \
  --source-account "$SIGNER_REF" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE")"

if [[ ! "$WASM_HASH" =~ ^[[:xdigit:]]{64}$ ]]; then
  echo "error: upload returned an invalid WASM hash: $WASM_HASH" >&2
  exit 1
fi

DEPLOY_ENV=(
  "MAINNET_CONFIRM=$MAINNET_CONFIRM"
  "RPC_URL=$RPC_URL"
  "NETWORK_PASSPHRASE=$NETWORK_PASSPHRASE"
  "WASM_HASH=$WASM_HASH"
)
if [[ -n "${OPERATOR_SECRET:-}" ]]; then
  DEPLOY_ENV+=("OPERATOR_SECRET=$OPERATOR_SECRET")
else
  DEPLOY_ENV+=("OPERATOR_IDENTITY=$OPERATOR_IDENTITY")
fi
env "${DEPLOY_ENV[@]}" pnpm --filter @sub-rosa/sdk exec tsx scripts/mainnet-v2-deploy.ts
