/** A repeat sign-in/focus or token refresh must not remount authenticated screens. */
export function needsAccessContext(currentUserId: string | null, nextUserId: string | null) {
  return nextUserId !== null && currentUserId !== nextUserId;
}

export function isTemporaryAuthError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const details = error as { name?: string; status?: number; message?: string };
  return details.name === "AuthRetryableFetchError" || details.name === "TypeError" ||
    details.status === 0 || (details.status !== undefined && details.status >= 500) ||
    /fetch|network|offline|demorou para responder/i.test(details.message ?? "");
}