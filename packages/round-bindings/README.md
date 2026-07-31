# `@sub-rosa/round-bindings`

Generated TypeScript bindings for the Sub Rosa Round Soroban contract.

```bash
npm install @sub-rosa/round-bindings
```

The package exports the generated contract client and spec-accurate types from
its root entry point. The stable event snapshot used by indexers and receipt
tooling is available from:

```ts
import {
  ALL_ROUND_EVENT_NAMES,
  ROUND_EVENT_SNAPSHOT,
} from "@sub-rosa/round-bindings/events";
```

Do not hand-edit `src/index.ts`. It is generated from the contract WASM:

```bash
pnpm bindings:generate
pnpm bindings:check
```

Event changes require updating the event snapshot and fixture according to
[`SNAPSHOT_TESTS.md`](./SNAPSHOT_TESTS.md).

This package contains client code, not a security endorsement of a deployment.
Applications must pin the intended Stellar network and reviewed contract ID.
