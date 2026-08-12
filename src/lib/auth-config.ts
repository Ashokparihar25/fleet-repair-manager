/** Set NEXT_PUBLIC_AUTH_DISABLED=false to turn login back on. */
export function isAuthDisabled() {
  return process.env.NEXT_PUBLIC_AUTH_DISABLED !== "false";
}
