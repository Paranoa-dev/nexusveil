import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageDirs = [
  "packages/round-bindings",
  "packages/tlock",
  "packages/sdk",
];

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

try {
  run("npm", ["whoami"]);
} catch {
  process.stderr.write(
    "npm authentication is required. Run `npm login`, confirm access to the " +
      "@sub-rosa scope, then retry `pnpm packages:publish`.\n",
  );
  process.exit(1);
}

run("node", ["scripts/verify-public-packages.mjs"]);

for (const packageDir of packageDirs) {
  run(
    "pnpm",
    ["publish", "--access", "public", "--no-git-checks"],
    resolve(root, packageDir),
  );
}

process.stdout.write("Published all Sub Rosa public packages.\n");
