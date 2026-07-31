function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
