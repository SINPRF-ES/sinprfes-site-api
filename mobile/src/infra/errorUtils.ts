export function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(String(error));
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
