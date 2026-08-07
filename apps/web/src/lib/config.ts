import {
  SUB_ROSA_DEPLOYMENTS,
  isSubRosaNetwork,
  type SubRosaNetwork,
} from "@sub-rosa/sdk";

export interface ConfigIssue {
  key: string;
  message: string;
}

const CRITICAL_KEYS = [
  "VITE_RPC_URL",
  "VITE_NETWORK_PASSPHRASE",
  "VITE_CONTRACT_ID",
] as const;

const LEGACY_V1_MAINNET_CONTRACT =
  "CA7KSDEYJEPGZEB2ZROTLUWKQQ6GIRIQNGG6Z745MZ34QHP4UJPWODEX";

export interface PublicNetworkConfig {
  network: SubRosaNetwork;
  rpcUrl: string;
  networkPassphrase: string;
  contractId: string | undefined;
}

export function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

const PLACEHOLDER_VALUES: Record<string, string[]> = {
  VITE_CONTRACT_ID: [
    "CC2QMOXZERI6UOR67YKSORT7QTUHQ5QUGMHQBYVP23YM3NMUNNOEOGZY",
    "CAPTODBCDEVIK23ALBJBS2TXRTIK47ZA5MBTHYF4XLHG2BK7JPYUCU2Y",
  ],
};

export function validatePublicConfig(
  env: Record<string, string | undefined> = import.meta.env,
): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const namedNetwork = env.VITE_STELLAR_NETWORK?.trim();

  if (namedNetwork && !isSubRosaNetwork(namedNetwork)) {
    issues.push({
      key: "VITE_STELLAR_NETWORK",
      message: `VITE_STELLAR_NETWORK must be testnet or mainnet, got ${JSON.stringify(namedNetwork)}.`,
    });
  }

  if (namedNetwork && isSubRosaNetwork(namedNetwork)) {
    const deployment = SUB_ROSA_DEPLOYMENTS[namedNetwork];
    const configuredPassphrase = env.VITE_NETWORK_PASSPHRASE?.trim();
    if (
      configuredPassphrase &&
      configuredPassphrase !== deployment.networkPassphrase
    ) {
      issues.push({
        key: "VITE_NETWORK_PASSPHRASE",
        message: `VITE_STELLAR_NETWORK=${namedNetwork} requires ${deployment.networkPassphrase}.`,
      });
    }
    const configuredContract = env.VITE_CONTRACT_ID?.trim();
    if (!configuredContract && !deployment.contractId) {
      issues.push({
        key: "VITE_CONTRACT_ID",
        message: `No Core v2 ${namedNetwork} contract is configured. Set VITE_CONTRACT_ID to a reviewed Core v2 contract.`,
      });
    }
    if (
      namedNetwork === "mainnet" &&
      configuredContract === LEGACY_V1_MAINNET_CONTRACT
    ) {
      issues.push({
        key: "VITE_CONTRACT_ID",
        message: "The configured mainnet contract is the legacy v1 proof, not a Core v2 deployment.",
      });
    }
  }

  for (const key of namedNetwork ? [] : CRITICAL_KEYS) {
    const value = env[key];
    if (!value || value.trim() === "") {
      issues.push({
        key,
        message: `${key} is missing — the demo will not function correctly. Set it in .env.local or deployment environment variables.`,
      });
    }
  }

  for (const key of CRITICAL_KEYS) {
    const value = env[key];
    if (value && value.trim() !== "") {
      const trimmed = key === "VITE_RPC_URL" ? normalizeUrl(value) : value.trim();
      const placeholders = PLACEHOLDER_VALUES[key];
      if (placeholders?.includes(trimmed)) {
        issues.push({
          key,
          message: `${key} appears to be a default/example value (${value}). Update it to your own contract and network config.`,
        });
      }
    }
  }

  const rpcUrl = env.VITE_RPC_URL;
  if (rpcUrl && rpcUrl.trim() !== "") {
    const normalized = normalizeUrl(rpcUrl);
    if (!/^https?:\/\//.test(normalized)) {
      issues.push({
        key: "VITE_RPC_URL",
        message: `VITE_RPC_URL is not a valid URL (${rpcUrl}). It must start with http:// or https://.`,
      });
    }
  }

  return issues;
}

export function resolvePublicNetworkConfig(
  env: Record<string, string | undefined> = import.meta.env,
): PublicNetworkConfig {
  const requested = env.VITE_STELLAR_NETWORK?.trim();
  const network = isSubRosaNetwork(requested) ? requested : "testnet";
  const deployment = SUB_ROSA_DEPLOYMENTS[network];
  return {
    network,
    rpcUrl: normalizeUrl(env.VITE_RPC_URL || deployment.rpcUrl),
    networkPassphrase:
      env.VITE_NETWORK_PASSPHRASE?.trim() || deployment.networkPassphrase,
    contractId: env.VITE_CONTRACT_ID?.trim() || deployment.contractId || undefined,
  };
}

export function hasConfigIssues(
  env: Record<string, string | undefined> = import.meta.env,
): boolean {
  return validatePublicConfig(env).length > 0;
}
