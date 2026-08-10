import { decodeSealedProposal, type SealedProposalMilestone } from "@sub-rosa/sdk";
import { decodePayloadEnvelope } from "@sub-rosa/tlock";

export interface PilotSubmissionView {
  bidder: string;
  amount: string | null;
  timelineDays: number | null;
  approach: string | null;
  totalAmount?: number;
  currency?: string;
  deliverables?: string[];
  milestones?: SealedProposalMilestone[];
  metadata?: Record<string, string>;
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
      ...(proposal.totalAmount === undefined
        ? {}
        : { totalAmount: proposal.totalAmount }),
      ...(proposal.currency === undefined ? {} : { currency: proposal.currency }),
      ...(proposal.deliverables === undefined
        ? {}
        : { deliverables: proposal.deliverables }),
      ...(proposal.milestones === undefined
        ? {}
        : { milestones: proposal.milestones }),
      ...(proposal.metadata === undefined
        ? {}
        : { metadata: proposal.metadata }),
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
