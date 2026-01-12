import { toast } from "sonner";

export async function copyTextToClipboard(
  text: string,
  opts: { successMessage?: string; errorMessage?: string } = {}
) {
  try {
    await navigator.clipboard.writeText(text);
    if (opts.successMessage) toast.success(opts.successMessage);
    return { ok: true as const };
  } catch (error) {
    toast.error(opts.errorMessage ?? "Failed to copy", {
      description: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}


