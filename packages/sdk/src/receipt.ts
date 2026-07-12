// Public, verifiable round receipts.
//
// A receipt is the *outcome artifact* of a sealed round: a single, shareable,
// independently checkable record of what happened on-chain. It turns a round
// from an opaque contract interaction into a usage signal a pilot partner (or
// an SCF reviewer) can inspect without trusting the operator.
//
// The receipt is assembled purely from on-chain reads (get_round + per-bidder
// get_bid_state) plus the transaction hashes observed during the round, so
// anyone can regenerate it from the contract state and compare.

import type { Round, Status } from "@sub-rosa/round-bindings";
import type { SubRosaClient } from "./client.js";

export type RoundStatusTag = Status["tag"];

/** A single settlement/refund/movement line in the receipt. */
export interface ReceiptEntry {
  bidder: string;
  /** Public escrow the bidder locked at commit. */
  escrow: string;
  /** Revealed bid value, if the bidder revealed; otherwise null. */
  revealedValue: string | null;
  /** Whether the reveal was a valid, in-budget, positive bid. */
  valid: boolean;
  /** True for the winning bidder. */
  won: boolean;
  /** Amount refunded to this bidder at settlement (surplus or full escrow). */
  refunded: string;
  /** Amount paid from this bidder's escrow to the operator (winner only). */
  paidToOperator: string;
}

/** Transaction hashes gathered while the round was driven, keyed by phase. */
export interface RoundTxRefs {
  createRound?: string;
  commits?: Record<string, string>;
  openReveal?: string;
  reveals?: Record<string, string>;
  clear?: string;
  settle?: string;
  void?: string;
}

export interface RoundReceipt {
  schema: "sub-rosa.round-receipt/v1";
  generatedAt: string;
  network: {
    passphrase: string;
    contractId: string;
    /** Optional Stellar Expert base, e.g. https://stellar.expert/explorer/public */
    explorerBase?: string;
  };
  round: {
    id: string;
    operator: string;
    status: RoundStatusTag;
    revealRound: string;
    commitDeadline: string;
    revealDeadline: string;
    clearingRule: string;
    itemRefHex: string;
    bidderCount: number;
    winner: string | null;
    winningBid: string | null;
  };
  totals: {
    escrowed: string;
    settledToOperator: string;
    refunded: string;
    validBids: number;
  };
  entries: ReceiptEntry[];
  transactions: RoundTxRefs;
  /** Convenience explorer links, only present when explorerBase is supplied. */
  links: {
    contract?: string;
    createRound?: string;
    settle?: string;
    void?: string;
  };
}

const asString = (v: bigint | number): string => v.toString();

const toHex = (b: Uint8Array | Buffer): string =>
  Buffer.from(b).toString("hex");

function txLink(base: string | undefined, hash: string | undefined) {
  if (!base || !hash) return undefined;
  return `${base.replace(/\/$/, "")}/tx/${hash}`;
}

function contractLink(base: string | undefined, contractId: string) {
  if (!base) return undefined;
  return `${base.replace(/\/$/, "")}/contract/${contractId}`;
}

/**
 * Pure settlement math for a single bidder — the same rules the on-chain
 * `settle`/`void` paths enforce. Extracted so it can be unit-tested without a
 * network: given a status, the bidder's escrow, and whether they won, it
 * returns how much is refunded to them and how much of their escrow is paid to
 * the operator. The two never overlap and never exceed the escrow.
 */
export function computeEntrySettlement(params: {
  status: RoundStatusTag;
  escrow: bigint;
  won: boolean;
  winningBid: bigint;
}): { refunded: bigint; paidToOperator: bigint } {
  const { status, escrow, won, winningBid } = params;
  if (status === "Settled") {
    if (won) {
      const surplus = escrow - winningBid;
      return {
        paidToOperator: winningBid,
        refunded: surplus > 0n ? surplus : 0n,
      };
    }
    return { paidToOperator: 0n, refunded: escrow };
  }
  if (status === "Voided") {
    return { paidToOperator: 0n, refunded: escrow };
  }
  // Open / Revealing / Cleared: nothing has moved back out yet.
  return { paidToOperator: 0n, refunded: 0n };
}

export interface BuildReceiptOptions {
  roundId: number | bigint;

  /** Transaction hashes captured while driving the round. Optional. */
  transactions?: RoundTxRefs;
  /** Stellar Expert base for link generation. Optional. */
  explorerBase?: string;
}

/**
 * Assemble a public receipt for a round straight from on-chain state.
 *
 * This is read-only: it calls get_round + get_bid_state for each bidder and
 * derives the settlement math from the same rules the contract enforces, so
 * the numbers are reproducible by any third party.
 */
export async function buildRoundReceipt(
  client: SubRosaClient,
  options: BuildReceiptOptions,
): Promise<RoundReceipt> {
  const round: Round = await client.getRound(options.roundId);
  const bidders = await client.getBidders(options.roundId);

  const winner = round.winner ?? null;
  const winningBid = round.winner ? asString(round.winning_bid) : null;

  let escrowed = 0n;
  let settledToOperator = 0n;
  let refunded = 0n;
  let validBids = 0;

  const entries: ReceiptEntry[] = [];
  for (const bidder of bidders) {
    const state = await client.getBidState(options.roundId, bidder);
    const escrow = BigInt(state.escrow);
    escrowed += escrow;
    const revealed =
      state.revealed_value != null ? BigInt(state.revealed_value) : null;
    if (state.valid) validBids += 1;

    const won = winner != null && bidder === winner;
    const { paidToOperator, refunded: entryRefund } = computeEntrySettlement({
      status: round.status.tag,
      escrow,
      won,
      winningBid: round.winning_bid,
    });

    settledToOperator += paidToOperator;
    refunded += entryRefund;


    entries.push({
      bidder,
      escrow: asString(escrow),
      revealedValue: revealed != null ? asString(revealed) : null,
      valid: state.valid,
      won,
      refunded: asString(entryRefund),
      paidToOperator: asString(paidToOperator),
    });
  }

  const explorerBase = options.explorerBase;
  const tx = options.transactions ?? {};

  return {
    schema: "sub-rosa.round-receipt/v1",
    generatedAt: new Date().toISOString(),
    network: {
      passphrase: client.networkPassphrase,
      contractId: client.contractId,
      explorerBase,
    },
    round: {
      id: asString(BigInt(options.roundId)),
      operator: round.operator,
      status: round.status.tag,
      revealRound: asString(round.reveal_round),
      commitDeadline: asString(round.commit_deadline),
      revealDeadline: asString(round.reveal_deadline),
      clearingRule: round.clearing_rule.tag,
      itemRefHex: toHex(round.item_ref),
      bidderCount: bidders.length,
      winner,
      winningBid,
    },
    totals: {
      escrowed: asString(escrowed),
      settledToOperator: asString(settledToOperator),
      refunded: asString(refunded),
      validBids,
    },
    entries,
    transactions: tx,
    links: {
      contract: contractLink(explorerBase, client.contractId),
      createRound: txLink(explorerBase, tx.createRound),
      settle: txLink(explorerBase, tx.settle),
      void: txLink(explorerBase, tx.void),
    },
  };
}

/** Render a receipt as a compact, human-readable text block (for logs/CLI). */
export function formatReceiptText(receipt: RoundReceipt): string {
  const lines: string[] = [];
  lines.push(`Sub Rosa — Round #${receipt.round.id} receipt`);
  lines.push(`  status        : ${receipt.round.status}`);
  lines.push(`  operator      : ${receipt.round.operator}`);
  lines.push(`  clearing rule : ${receipt.round.clearingRule}`);
  lines.push(`  reveal round  : ${receipt.round.revealRound}`);
  lines.push(`  bidders       : ${receipt.round.bidderCount}`);
  lines.push(`  valid bids    : ${receipt.totals.validBids}`);
  if (receipt.round.winner) {
    lines.push(`  winner        : ${receipt.round.winner}`);
    lines.push(`  winning bid   : ${receipt.round.winningBid}`);
  } else {
    lines.push(`  winner        : (none — voided)`);
  }
  lines.push(`  escrowed      : ${receipt.totals.escrowed}`);
  lines.push(`  to operator   : ${receipt.totals.settledToOperator}`);
  lines.push(`  refunded      : ${receipt.totals.refunded}`);
  if (receipt.links.contract) {
    lines.push(`  contract      : ${receipt.links.contract}`);
  }
  return lines.join("\n");
}
