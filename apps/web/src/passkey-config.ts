/** Public testnet smart-wallet WASM (passkey-kit demo). Not a secret. */
export const PASSKEY_TESTNET_WALLET_WASM_HASH =
  "ecd990f0b45ca6817149b6175f79b32efb442f35731985a084131e8265c4cd90";

export const PASSKEY_RPC_URL = RPC_URL;

export const PASSKEY_NETWORK_PASSPHRASE = NETWORK;

export function resolvePasskeyWalletWasmHash(): string | undefined {
  const fromEnv = import.meta.env.VITE_PASSKEY_WALLET_WASM_HASH?.trim();
  if (fromEnv) return fromEnv;
  // The bundled wallet WASM is testnet-only. Mainnet requires an explicit hash.
  return STELLAR_NETWORK === "testnet"
    ? PASSKEY_TESTNET_WALLET_WASM_HASH
    : undefined;
}
import {
  NETWORK,
  RPC_URL,
  STELLAR_NETWORK,
} from "./lib/chain";
