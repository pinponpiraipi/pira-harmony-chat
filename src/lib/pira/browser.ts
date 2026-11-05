export type ProxyRegion = "jp" | "intl";

/** Turns typed text into a URL: full URL, bare domain, or a Google search. */
export function normalizeInput(input: string): string {
  const t = input.trim();
  if (!t) return "https://www.google.com/search?igu=1";
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/i.test(t)) return `https://${t}`;
  return `https://www.google.com/search?q=${encodeURIComponent(t)}&igu=1`;
}

export function proxyUrl(url: string, region: ProxyRegion = "jp") {
  return `/api/public/proxy?url=${encodeURIComponent(url)}${region === "intl" ? "&r=intl" : ""}`;
}
