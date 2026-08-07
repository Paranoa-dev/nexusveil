import {
  isSubRosaNetwork,
  resolveSubRosaDeployment,
  type SubRosaNetwork,
} from "@sub-rosa/sdk";

const DEFAULT_RPC_URL = "https://soroban-testnet.stellar.org";
const DEFAULT_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

export interface KeeperNetworkConfig {
  network?: SubRosaNetwork;
  contractId: string;
  rpcUrl: string;
  networkPassphrase: string;
}

function required(
  env: Record<string, string | undefined>,
  name: string,
): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`missing required env var ${name}`);
  return value;
}

export function parseKeeperNetworkConfig(
  env: Record<string, string | undefined> = process.env,
): KeeperNetworkConfig {
  const requested = env.STELLAR_NETWORK?.trim();
  if (!requested) {
    return {
      contractId: required(env, "ROUND_CONTRACT_ID"),
      rpcUrl: env.RPC_URL?.trim() || DEFAULT_RPC_URL,
      networkPassphrase:
        env.NETWORK_PASSPHRASE?.trim() || DEFAULT_NETWORK_PASSPHRASE,
    };
  }
  if (!isSubRosaNetwork(requested)) {
    throw new Error(
      `STELLAR_NETWORK must be testnet or mainnet, got ${JSON.stringify(requested)}`,
    );
  }

  const deployment = resolveSubRosaDeployment(requested, {
    contractId: env.ROUND_CONTRACT_ID,
    rpcUrl: env.RPC_URL,
    networkPassphrase: env.NETWORK_PASSPHRASE,
  });
  return {
    network: requested,
    contractId: deployment.contractId,
    rpcUrl: deployment.rpcUrl,
    networkPassphrase: deployment.networkPassphrase,
  };
}
