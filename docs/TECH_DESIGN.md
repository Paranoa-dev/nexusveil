# Technical Design

See [ARCHITECTURE.md](../ARCHITECTURE.md) for the component map and trust
boundaries. This document covers the Core v2 cryptography, storage, and
settlement model.

## Core v2

Sub Rosa is sealed-round infrastructure for Stellar applications. Participants
commit versioned, timelock-encrypted payloads to a future Drand round `R`. The
Soroban contract verifies the Drand BLS12-381 signature before accepting
reveals, validates every payload against its commitment, and completes the
configured reviewed mode deterministically.

| Mode | Escrow | Completion |
| --- | --- | --- |
| `Auction` | One contract-enforced fixed escrow from every bidder and lot custody from seller | Highest valid bid pays seller; lot moves to winner; remaining escrow is refunded |
| `ReceiptOnly` | Forbidden | Revealed submission set and canonical completion receipt |

## Payload envelope

Core v2 binds the complete structured submission, not only a numeric value. The
domain-separated envelope includes:

- envelope version;
- schema identifier;
- optional amount;
- nonce;
- application payload bytes.

The contract rejects unsupported versions, malformed payloads, and oversized
application data. SDK templates own schema-specific encoding so partner
applications do not construct envelope bytes manually.

## Partner policy

`create_partner_round_v2` stores a policy separately from the durable `RoundV2`
record, preserving compatibility with earlier rounds. An empty participant list
means open access; a non-empty list is an on-chain allowlist. Auction policy
requires a positive `fixed_escrow`, and `commit_v2` rejects any different
amount. Receipt-only policy requires zero escrow. The allowlist and protocol cap
bound a round to at most 25 participants.

## Cryptography

### Timelock encryption

- Drand network: quicknet `bls-unchained-g1-rfc9380`
- Ciphertext: tlock IBE sealed to a future round `R`
- Commitment: SHA-256 over the canonical plaintext envelope
- Unlock: round-`R` threshold signature verified on-chain

### Auditor identity blob

- X25519 ECDH
- HKDF-SHA256
- XChaCha20-Poly1305
- Stored alongside the ciphertext in temporary contract storage

The auditor blob provides selective identity recovery. It does not give the
auditor early access to the encrypted application payload.

## Storage

| Tier | Contents | Lifetime |
| --- | --- | --- |
| Instance | Drand configuration and round counter | Contract lifetime with TTL extension |
| Persistent | Round configuration, participant state, escrow, clearing and settlement flags | Through completion/void and configured retention |
| Temporary | Ciphertext and auditor blob | Through reveal deadline plus observer buffer |

Seal TTL is derived from the reveal deadline. Settlement never depends on
temporary ciphertext after the validated reveal state has been persisted.

## Auction settlement

The `Auction` mode uses two SEP-41 Stellar Asset Contracts:

```text
winner payment escrow -> seller
lot custody            -> winner
unused winner escrow   -> winner
loser escrow           -> each loser
```

These transfers occur under one reviewed settlement path. If a round is voided
or has no valid winner, the contract returns the lot and bidder escrow according
to the tested void rules.

`ReceiptOnly` rejects non-zero escrow and does not invoke asset transfers.

## Permissionless lifecycle

The operator configures the round but does not control reveal or settlement.
After the relevant deadlines and Drand round, any account may invoke lifecycle
operations. A keeper provides operational liveness without receiving special
decryption or settlement authority.

Opening reveal is one transaction, while decrypted envelopes are persisted in
bounded, retry-safe per-participant transactions. This avoids an unbounded
all-reveal transaction and prevents one malformed ciphertext from forcing the
whole cohort to fail. It does not claim atomic reveal of all ciphertexts.

## SDK and bindings

| Package | Role |
| --- | --- |
| `@sub-rosa/sdk` | Client, templates, preflight, receipts, status API |
| `@sub-rosa/tlock` | Timelock seal/open, payload encoding, auditor encryption |
| `@sub-rosa/round-bindings` | Generated spec-accurate Soroban client and types |

The public packages ship compiled ESM and TypeScript declarations. Generated
bindings are never hand-edited; CI checks them against the contract WASM.

## Optional transaction submitter

Direct Soroban RPC is the default. The SDK also supports an OpenZeppelin Relayer
Channels submitter. Signing stays local; the submitter changes transaction
delivery and fee sponsorship, not contract authorization or settlement rules.

## Verified deployments

- Core v2 testnet contract:
  `CCOVGOQQZJKZ2R55GRWBLTJTGBAMSHXZVN3ICPG3WRVMLMM6RHISC5OV`
- Core v2 testnet WASM:
  `2c7bc6b4c91940ac185df38a3d0a8532b555140d818df94f03f894e5952ebf42`
- Legacy v1 mainnet settlement proof:
  `CA7KSDEYJEPGZEB2ZROTLUWKQQ6GIRIQNGG6Z745MZ34QHP4UJPWODEX`

Core v2 is not described as audited production software. See
[LIMITATIONS.md](./LIMITATIONS.md).
