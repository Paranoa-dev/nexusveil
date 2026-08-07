import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  RoundContract,
  SUB_ROSA_DEPLOYMENTS,
  assertMainnetConfirmed,
  contractExplorerUrl,
  nativeXlmSacId,
} from "../src/index.js";
import { resolveScriptSigner } from "./script-signer.js";

const DRAND_GENESIS = 1_692_803_367n;
const DRAND_PERIOD = 3n;
const DST = "BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_";
const DRAND_PUBKEY_C1C0 =
  "03cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a01a714f2edb74119a2f2b0d5a7c75ba902d163700a61bc224ededd8e63aef7be1aaf8e93d7a9718b047ccddb3eb5d68b0e5db2b6bfbb01c867749cadffca88b36c24f3012ba09fc4d3022c5c37dce0f977d3adb5d183c7477c442b1f04515273";
const DRAND_NEGGEN_C1C0 =
  "13e02b6052719f607dacd3a088274f65596bd0d09920b61ab5da61bbdc7f5049334cf11213945d57e5ac7d055d042b7e024aa2b2f08f0a91260805272dc51051c6e47ad4fa403b02b4510b647ae3d1770bac0326a805bbefd48056c8c121bdb813fa4d4a0ad8b1ce186ed5061789213d993923066dddaf1040bc3ff59f825c78df74f2d75467e25e0f55f8a00fa030ed0d1b3cc2c7027888be51d9ef691d77bcb679afda66c73f17f9ee3837a55024f78c71363275a75d75d86bab79f74782aa";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing required env var ${name}`);
  return value;
}

async function main() {
  assertMainnetConfirmed();
  const deployment = SUB_ROSA_DEPLOYMENTS.mainnet;
  const rpcUrl = process.env.RPC_URL?.trim() || deployment.rpcUrl;
  const networkPassphrase =
    process.env.NETWORK_PASSPHRASE?.trim() || deployment.networkPassphrase;
  if (networkPassphrase !== deployment.networkPassphrase) {
    throw new Error("mainnet-v2-deploy requires the Stellar mainnet passphrase");
  }

  const wasmHash = required("WASM_HASH").toLowerCase();
  if (wasmHash !== deployment.wasmHash) {
    throw new Error(
      `refusing deployment: WASM ${wasmHash} != reviewed Core v2 ${deployment.wasmHash}`,
    );
  }

  const operator = await resolveScriptSigner({
    secret: process.env.OPERATOR_SECRET,
    identity: process.env.OPERATOR_IDENTITY,
    secretEnvName: "OPERATOR_SECRET",
    identityEnvName: "OPERATOR_IDENTITY",
    networkPassphrase,
    rpcUrl,
  });
  const nativeSac = nativeXlmSacId(networkPassphrase);

  const deployTx = await RoundContract.deploy(
    {
      drand_pubkey: Buffer.from(DRAND_PUBKEY_C1C0, "hex"),
      g2_neg_generator: Buffer.from(DRAND_NEGGEN_C1C0, "hex"),
      dst: Buffer.from(DST, "utf8"),
      drand_genesis: DRAND_GENESIS,
      drand_period: DRAND_PERIOD,
      usdc: nativeSac,
    },
    {
      wasmHash,
      rpcUrl,
      networkPassphrase,
      publicKey: operator.publicKey,
      signTransaction: operator.signTransaction,
      ...(operator.signAuthEntry
        ? { signAuthEntry: operator.signAuthEntry }
        : {}),
    },
  );
  const deployed = await deployTx.signAndSend();
  const contractId = deployed.result.options.contractId;
  const deployTransactionHash = deployed.sendTransactionResponse?.hash ?? null;
  const artifactPath = resolve(
    process.env.DEPLOYMENT_ARTIFACT ||
      "artifacts/deployments/core-v2-mainnet.local.json",
  );
  const artifact = {
    protocolVersion: "core-v2",
    network: "mainnet",
    networkPassphrase,
    rpcUrl,
    contractId,
    wasmHash,
    deployTransactionHash,
    explorerContract: contractExplorerUrl("mainnet", contractId),
    deployedBy: operator.publicKey,
    deployedAt: new Date().toISOString(),
  };
  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, {
    mode: 0o600,
  });

  console.log("CORE V2 MAINNET DEPLOYED");
  console.log(JSON.stringify(artifact, null, 2));
  console.log(`Local artifact: ${artifactPath}`);
  console.log("Next: set ROUND_CONTRACT_ID above and run pnpm mainnet:v2:verify");
  console.log("Then run pnpm mainnet:v2:smoke -- --dry-run");
}

main().catch((error) => {
  console.error("CORE V2 MAINNET DEPLOY FAILED");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
