import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packages = [
  { name: "@sub-rosa/round-bindings", dir: "packages/round-bindings" },
  { name: "@sub-rosa/tlock", dir: "packages/tlock" },
  { name: "@sub-rosa/sdk", dir: "packages/sdk" },
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    if (options.capture) {
      process.stderr.write(result.stdout ?? "");
      process.stderr.write(result.stderr ?? "");
    }
    throw new Error(`${command} ${args.join(" ")} failed`);
  }

  return result;
}

const workDir = mkdtempSync(join(tmpdir(), "sub-rosa-pack-"));
const packDir = join(workDir, "packs");
const consumerDir = join(workDir, "consumer");
mkdirSync(packDir);
mkdirSync(consumerDir);

try {
  for (const pkg of packages) {
    run("pnpm", ["run", "build"], { cwd: join(root, pkg.dir) });
    run("pnpm", ["pack", "--pack-destination", packDir], {
      cwd: join(root, pkg.dir),
    });
  }

  const tarballs = readdirSync(packDir)
    .filter((entry) => entry.endsWith(".tgz"))
    .map((entry) => join(packDir, entry));

  if (tarballs.length !== packages.length) {
    throw new Error(
      `expected ${packages.length} tarballs, found ${tarballs.length}`,
    );
  }

  writeFileSync(
    join(consumerDir, "package.json"),
    `${JSON.stringify(
      {
        name: "sub-rosa-package-verification",
        version: "1.0.0",
        private: true,
        type: "module",
        dependencies: Object.fromEntries(
          packages.map((pkg) => {
            const slug = pkg.name.replace("@sub-rosa/", "sub-rosa-");
            const tarball = tarballs.find((entry) => entry.includes(slug));
            if (!tarball) throw new Error(`missing tarball for ${pkg.name}`);
            return [pkg.name, `file:${tarball}`];
          }),
        ),
      },
      null,
      2,
    )}\n`,
  );

  writeFileSync(
    join(consumerDir, "verify.mjs"),
    `import { ASSET_AUCTION_SCHEMA_ID, SubRosaClient } from "@sub-rosa/sdk";\n` +
      `import { payloadCommitment } from "@sub-rosa/tlock";\n` +
      `import { Errors } from "@sub-rosa/round-bindings";\n` +
      `if (!ASSET_AUCTION_SCHEMA_ID || typeof SubRosaClient !== "function") throw new Error("sdk exports missing");\n` +
      `if (typeof payloadCommitment !== "function") throw new Error("tlock exports missing");\n` +
      `if (!Errors[1]) throw new Error("bindings exports missing");\n` +
      `console.log("public package imports verified");\n`,
  );

  run(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
    { cwd: consumerDir },
  );

  for (const pkg of packages) {
    const manifestPath = join(
      consumerDir,
      "node_modules",
      ...pkg.name.split("/"),
      "package.json",
    );
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const dependencySpecs = Object.values(manifest.dependencies ?? {});
    if (manifest.private === true) {
      throw new Error(`${pkg.name} is still marked private in its tarball`);
    }
    if (!String(manifest.main ?? "").startsWith("./dist/")) {
      throw new Error(`${pkg.name} does not expose compiled JavaScript`);
    }
    if (dependencySpecs.some((spec) => String(spec).startsWith("workspace:"))) {
      throw new Error(`${pkg.name} contains an unresolved workspace dependency`);
    }
  }

  run("node", ["verify.mjs"], { cwd: consumerDir });

  process.stdout.write(
    `Verified ${packages.map((pkg) => pkg.name).join(", ")} from packed tarballs.\n`,
  );
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
