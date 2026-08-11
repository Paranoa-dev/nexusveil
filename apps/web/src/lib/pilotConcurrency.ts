function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function hasContractError(
  error: unknown,
  code: number,
  name: string,
): boolean {
  const message = errorMessage(error);
  return (
    message.includes(name) ||
    message.includes(`Contract, #${code}`) ||
    message.includes(`ContractError(${code})`)
  );
}

export function isRevealAlreadyOpen(error: unknown): boolean {
  return hasContractError(error, 14, "RevealAlreadyOpen");
}

export function isSubmissionAlreadyRevealed(error: unknown): boolean {
  return hasContractError(error, 32, "AlreadyRevealed");
}

export function isTxBadSeqError(error: unknown): boolean {
  const message = errorMessage(error);
  return (
    message.includes("txBadSeq") ||
    message.includes("tx_bad_seq") ||
    message.includes('"value":-5') ||
    message.includes('"value": -5')
  );
}
