import { decodeSealedProposal } from "@sub-rosa/sdk";
import { decodePayloadEnvelope } from "@sub-rosa/tlock";

export interface PilotSubmissionView {
  bidder: string;
  amount: string | null;
  timelineDays: number | null;
  approach: string | null;
  payload: string | null;
  valid: boolean;
}

export function decodePilotSubmission(
  bidder: string,
  mode: "Auction" | "ReceiptOnly",
  bytes: Uint8Array,
  valid: boolean,
): PilotSubmissionView {
  const envelope = decodePayloadEnvelope(bytes);

  if (mode === "ReceiptOnly") {
    const proposal = decodeSealedProposal(envelope.payload);
    return {
      bidder,
      amount: envelope.amount?.toString() ?? null,
      timelineDays: proposal.timelineDays,
      approach: proposal.approach,
      payload: null,
      valid,
    };
  }

  return {
    bidder,
    amount: envelope.amount?.toString() ?? null,
    timelineDays: null,
    approach: null,
    payload: envelope.payload.length
      ? new TextDecoder().decode(envelope.payload)
      : null,
    valid,
  };
}
