/** Never include reset URLs, tokens or recipient identities in production logs. */
export function resetDeliveryNotice(
  environment: string | undefined,
  url: string,
) {
  return environment === "development"
    ? `[auth] Development reset link: ${url}`
    : "[auth] Password reset email unavailable: sender configuration missing";
}
