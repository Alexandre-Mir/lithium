export function coverUrlHiRes(url: string | null): string | null {
  if (!url) return null;
  let result = url.replace(/^http:\/\//i, "https://").replace(/&edge=curl/g, "");
  if (/books\.google\.com/i.test(result)) result = result.replace(/zoom=1/g, "zoom=2");
  if (/covers\.openlibrary\.org/i.test(result)) result = result.replace(/-(S|M)\.jpg$/i, "-L.jpg");
  return result;
}
