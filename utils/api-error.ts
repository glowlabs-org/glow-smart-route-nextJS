export function parseUnknownError(error: unknown): string {
  if (!error) return "Unknown error";
  if (error instanceof Error) return error.message;
  const maybe: any = error;
  return maybe?.error?.message ?? maybe?.message ?? "Unknown error";
}


