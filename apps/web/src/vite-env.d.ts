/// <reference types="vite/client" />

declare module "process/browser";

interface ImportMetaEnv {
  readonly VITE_STELLAR_NETWORK?: "testnet" | "mainnet";
  readonly VITE_RPC_URL?: string;
  readonly VITE_NETWORK_PASSPHRASE?: string;
  readonly VITE_CONTRACT_ID?: string;
  readonly VITE_ROUND_ID?: string;
  readonly VITE_ESCROW_TOKEN_LABEL?: string;
  readonly VITE_TRUSTLESS_WORK_API_KEY?: string;
  readonly VITE_TRUSTLESS_WORK_BASE_URL?: string;
  readonly VITE_TRUSTLESS_WORK_API_VERSION?: "v1" | "v2";
  readonly VITE_TRUSTLESS_WORK_TRUSTLINE_CONTRACT_ID?: string;
  readonly VITE_TRUSTLESS_WORK_TRUSTLINE_SYMBOL?: string;
  readonly VITE_TRUSTLESS_WORK_TRUSTLINE_ADDRESS?: string;
  readonly VITE_ACTA_BASE_URL?: string;
  readonly VITE_ACTA_API_KEY?: string;
  readonly VITE_PASSKEY_WALLET_WASM_HASH?: string;
  readonly VITE_PASSKEY_RP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
