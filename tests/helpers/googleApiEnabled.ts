/** True when Google rejected the call because that product is not enabled on the key (not invalid key / billing). */
export function isGoogleApiNotEnabled(result: { status?: string; error_message?: string | null }): boolean {
  const msg = result.error_message || "";
  if (/invalid API key/i.test(msg) || /API key is invalid/i.test(msg) || /IP address/i.test(msg) || /referer/i.test(msg) || /enable Billing/i.test(msg)) {
    return false;
  }
  if (/has not been used in project/i.test(msg)) return true;
  if (/not authorized to use this API/i.test(msg)) return true;
  if (/Enable it by visiting https:\/\/console/i.test(msg)) return true;
  if (/legacy API/i.test(msg) || /LegacyApiNotActivated/i.test(msg)) return true;
  if (/not enabled for your project/i.test(msg)) return true;
  if (result.status === "PERMISSION_DENIED") return true;
  return false;
}

export function skipIfGoogleApiNotEnabled(
  result: { status?: string; error_message?: string | null },
  apiLabel: string
): boolean {
  if (!isGoogleApiNotEnabled(result)) return false;
  // eslint-disable-next-line no-console
  console.warn(`[integration skip] ${apiLabel} is not enabled for this key: ${result.error_message || result.status}`);
  return true;
}
