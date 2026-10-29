export function safeReturnPath(value: string | string[] | FormDataEntryValue | null | undefined): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/";
  }

  return value;
}

export function safeReturnPathFromReferer(referer: string | null): string {
  if (!referer) return "/";

  try {
    const url = new URL(referer);
    if (url.pathname === "/login") return "/";
    const path = safeReturnPath(`${url.pathname}${url.search}`);
    return path;
  } catch {
    return "/";
  }
}
