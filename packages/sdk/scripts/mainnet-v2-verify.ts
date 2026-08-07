import { rpc } from "@stellar/stellar-sdk";

import {
  SUB_ROSA_DEPLOYMENTS,
  SubRosaClient,
  contractExplorerUrl,
  fetchContractWasmHash,
  resolveSubRosaDeployment,
  verifyReceiptV2,
} from "../src/index.js";

const DEFAULT_READER_PUBKEY =
  "GCDARJFKKSTJYAZC647H4ZSSSPXPPSKOWOHGMUNCT22VG74KXZ5BHVNR";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing required env var ${name}`);
  return value;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const contractId = required("ROUND_CONTRACT_ID");
  const deployment = SUB_ROSA_DEPLOYMENTS.mainnet;
  const resolved = resolveSubRosaDeployment("mainnet", {
    contractId,
    rpcUrl: process.env.RPC_URL,
    networkPassphrase: process.env.NETWORK_PASSPHRASE,
  });

  console.log("Sub Rosa Core v2 mainnet verification");
  console.log("Contract:", contractExplorerUrl("mainnet", contractId));
  console.log("Expected WASM:", deployment.wasmHash);
  console.log(`Mode: ${dryRun ? "DRY-RUN" : "READ-ONLY LIVE"}`);

  if (dryRun) {
    console.log("Checks prepared: mainnet passphrase, contract existence, Core v2 WASM hash");
    if (process.env.ROUND_ID?.trim()) {
      console.log("Optional settled Core v2 receipt check prepared for round", process.env.ROUND_ID);
    }
    console.log("Transactions submitted: 0");
    return;
  }

  const server = new rpc.Server(resolved.rpcUrl);
  const onChainWasm = await fetchContractWasmHash(server, contractId);
  if (onChainWasm.toLowerCase() !== deployment.wasmHash) {
    throw new Error(
      `contract WASM ${onChainWasm} != reviewed Core v2 ${deployment.wasmHash}`,
    );
  }

  const result: Record<string, unknown> = {
    network: "mainnet",
    networkPassphrase: resolved.networkPassphrase,
    rpcUrl: resolved.rpcUrl,
    contractId,
    wasmHash: onChainWasm,
    contractVerified: true,
    transactionsSubmitted: 0,
  };

  const roundValue = process.env.ROUND_ID?.trim();
  if (roundValue) {
    const roundId = BigInt(roundValue);
    const reader = new SubRosaClient({
      network: "mainnet",
      rpcUrl: resolved.rpcUrl,
      contractId,
      publicKey:
        process.env.MAINNET_READER_PUBKEY?.trim() || DEFAULT_READER_PUBKEY,
    });
    const receipt = await reader.exportReceiptV2(roundId);
    const verification = verifyReceiptV2(receipt);
    if (!verification.valid) {
      throw new Error(
        `round ${roundId} receipt verification failed: ${JSON.stringify(verification.issues)}`,
      );
    }
    if (receipt.status !== "Settled") {
      throw new Error(`round ${roundId} is ${receipt.status}, expected Settled`);
    }
    if (
      receipt.network !== resolved.networkPassphrase ||
      receipt.contractId !== contractId
    ) {
      throw new Error(`round ${roundId} receipt provenance does not match the requested deployment`);
    }
    result.roundId = roundId.toString();
    result.roundStatus = receipt.status;
    result.receiptVerified = true;
  }

  console.log("CORE V2 MAINNET VERIFY PASSED");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("CORE V2 MAINNET VERIFY FAILED");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
