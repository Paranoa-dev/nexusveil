import { spawn } from "node:child_process";

import { Keypair } from "@stellar/stellar-sdk";
import {
  basicNodeSigner,
  type SignAuthEntry,
  type SignTransaction,
} from "@stellar/stellar-sdk/contract";

export interface ScriptSigner {
  publicKey: string;
  signTransaction: SignTransaction;
  signAuthEntry?: SignAuthEntry;
}

function runStellar(args: string[], stdin?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("stellar", [...args, "--quiet"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `stellar ${args.slice(0, 2).join(" ")} failed (${code}): ${stderr.trim()}`,
          ),
        );
        return;
      }
      resolve(stdout.trim());
    });
    child.stdin.end(stdin);
  });
}

async function cliIdentitySigner(
  identity: string,
  networkPassphrase: string,
  rpcUrl: string,
): Promise<ScriptSigner> {
  const publicKey = await runStellar(["keys", "public-key", identity]);
  if (!publicKey.startsWith("G")) {
    throw new Error(`Stellar identity ${identity} returned an invalid public key`);
  }

  return {
    publicKey,
    signTransaction: async (xdr) => {
      const signedTxXdr = await runStellar(
        [
          "tx",
          "sign",
          "--sign-with-key",
          identity,
          "--network-passphrase",
          networkPassphrase,
          "--rpc-url",
          rpcUrl,
        ],
        xdr,
      );
      if (!signedTxXdr) {
        throw new Error(`Stellar identity ${identity} returned an empty signed transaction`);
      }
      return { signedTxXdr, signerAddress: publicKey };
    },
  };
}

export async function resolveScriptSigner(options: {
  secret?: string;
  identity?: string;
  secretEnvName: string;
  identityEnvName: string;
  networkPassphrase: string;
  rpcUrl: string;
}): Promise<ScriptSigner> {
  const secret = options.secret?.trim();
  const identity = options.identity?.trim();
  if (secret && identity) {
    throw new Error(
      `provide either ${options.secretEnvName} or ${options.identityEnvName}, not both`,
    );
  }
  if (secret) {
    const keypair = Keypair.fromSecret(secret);
    const signer = basicNodeSigner(keypair, options.networkPassphrase);
    return {
      publicKey: keypair.publicKey(),
      signTransaction: signer.signTransaction,
      signAuthEntry: signer.signAuthEntry,
    };
  }
  if (identity) {
    return cliIdentitySigner(identity, options.networkPassphrase, options.rpcUrl);
  }
  throw new Error(
    `missing signer: set ${options.secretEnvName} or ${options.identityEnvName}`,
  );
}
