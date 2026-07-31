# `@sub-rosa/tlock`

Drand timelock encryption and auditor identity encryption for Sub Rosa sealed
rounds.

```bash
npm install @sub-rosa/tlock
```

## Seal a bid

```ts
import {
  generateAuditorKeypair,
  generateNonce,
  quicknet,
  sealBid,
} from "@sub-rosa/tlock";

const auditor = generateAuditorKeypair();
const drand = quicknet();

const sealed = await sealBid({
  value: 700n,
  nonce: generateNonce(),
  round: revealRound,
  client: drand,
  identity: bidderAddress,
  auditorPublicKey: auditor.publicKey,
});
```

## Structured payloads

`sealPayload` and `openPayload` use the versioned Core v2 payload envelope.
Prefer the typed helpers in `@sub-rosa/sdk` for standard auction and proposal
schemas.

## Auditor recovery CLI

```bash
sub-rosa-recover-identities \
  --auditor-secret-hex <32-byte-hex> \
  --blob-hex <blob-hex>
```

Payload confidentiality depends on Drand and the underlying cryptographic
libraries. Review the repository threat model before using the package with
production funds.
