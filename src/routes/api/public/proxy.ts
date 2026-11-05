import { createFileRoute } from "@tanstack/react-router";

const HOP_BY_HOP = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
  "x-frame-options",
  "content-security-policy",
  "content-security-policy-report-only",
  "cross-origin-opener-policy",
  "cross-origin-embedder-policy",
  "cross-origin-resource-policy",
  "permissions-policy",
  "strict-transport-security",
  "x-content-type-options",
  "report-to",
  "nel",
]);

export type ProxyRegion = "jp" | "intl";

/** 海外経由にするときに使う中継サーバー（上から順に試す） */
const INTL_RELAYS = [
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
];

function proxied(target: string, region: ProxyRegion = "jp"): string {
  const suffix = region === "intl" ? "&r=intl" : "";
  return `/api/public/proxy?url=${encodeURIComponent(target)}${suffix}`;
}

function unwrapProxyUrl(value: string, proxyOrigin: string): string {
  let current = value;
  for (let depth = 0; depth < 5; depth += 1) {
    try {
      const parsed = new URL(current);
      if (
        parsed.origin !== proxyOrigin ||
        parsed.pathname !== "/api/public/proxy"
      ) {
        return current;
      }
      const nested = parsed.searchParams.get("url");
      if (!nested) return current;
      current = nested;
    } catch {
      return current;
    }
  }
  return current;
}

function normalizeKnownUpstreamUrl(targetUrl: URL, proxyOrigin: string): URL {
  if (targetUrl.hostname.toLowerCase() === "devs-api.poki.comsa") {
    targetUrl.hostname = "devs-api.poki.com";
  }

  if (targetUrl.hostname.toLowerCase() === "devs-api.poki.com") {
    for (const key of ["href", "referrer"]) {
      const value = targetUrl.searchParams.get(key);
      if (value) {
        targetUrl.searchParams.set(key, unwrapProxyUrl(value, proxyOrigin));
      }
    }
  }

  return targetUrl;
}

function toAbs(value: string, base: URL): string | null {
  const v = value.trim();
  if (!v || /^(data:|blob:|javascript:|mailto:|tel:|#|about:)/i.test(v)) {
    return null;
  }
  try {
    return new URL(v, base).toString();
  } catch {
    return null;
  }
}

function rewriteSrcset(value: string, base: URL, region: ProxyRegion): string {
  return value
    .split(",")
    .map((part) => {
      const seg = part.trim().split(/\s+/);
      const u = seg[0] ? toAbs(seg[0], base) : null;
      if (!u) return part;
      return [proxied(u, region), ...seg.slice(1)].join(" ");
    })
    .join(", ");
}

function rewriteCssUrls(css: string, base: URL, region: ProxyRegion): string {
  return css.replace(
    /url\(\s*(["']?)([^"')]+)\1\s*\)/gi,
    (match, _q: string, value: string) => {
      const abs = toAbs(value, base);
      return abs ? `url("${proxied(abs, region)}")` : match;
    },
  );
}

function injectedScript(base: URL, region: ProxyRegion): string {
  const code = `(function(){
  var P="/api/public/proxy?url=";
  var R=${JSON.stringify(region === "intl" ? "&r=intl" : "")};
  var BASE=${JSON.stringify(base.toString())};
  function abs(u){try{return new URL(u,BASE).toString()}catch(e){return null}}
  function px(u){
    if(typeof u!=="string"||!u)return u;
    if(u.indexOf(P)===0||u.indexOf(location.origin+P)===0)return u;
    if(/^(data:|blob:|javascript:|mailto:|tel:|about:|#)/i.test(u))return u;
    var a=abs(u);return a?P+encodeURIComponent(a)+R:u;
  }
  window.__proxify=px;
  var f=window.fetch;
  window.fetch=function(i,init){
    try{
      if(typeof i==="string")i=px(i);
      else if(i&&i.url)i=new Request(px(i.url),i);
    }catch(e){}
    return f.call(this,i,init);
  };
  var xo=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u){
    try{arguments[1]=px(u);}catch(e){}
    return xo.apply(this,arguments);
  };
  try{
    var hp=history.pushState,hr=history.replaceState;
    history.pushState=function(s,t,u){if(u!=null){try{arguments[2]=px(String(u))}catch(e){}}return hp.apply(history,arguments)};
    history.replaceState=function(s,t,u){if(u!=null){try{arguments[2]=px(String(u))}catch(e){}}return hr.apply(history,arguments)};
  }catch(e){}
  window.open=function(u){try{if(u)location.href=px(String(u))}catch(e){}return window};
  try{
    if(navigator.serviceWorker){
      navigator.serviceWorker.register=function(){return Promise.reject(new Error("sw disabled"))};
    }
  }catch(e){}
  document.addEventListener("submit",function(ev){
    var form=ev.target;
    if(!form||form.__pxd)return;
    var action=form.getAttribute("action")||BASE;
    form.setAttribute("action",px(action));
    form.setAttribute("target","_self");
    form.__pxd=1;
  },true);
  document.addEventListener("click",function(ev){
    var el=ev.target;
    while(el&&el.tagName!=="A")el=el.parentElement;
    if(!el)return;
    var t=el.getAttribute("target");
    if(t&&t!=="_self")el.setAttribute("target","_self");
    var h=el.getAttribute("href");
    if(h)el.setAttribute("href",px(h));
  },true);
  try{
    var pairs=[[window.HTMLImageElement,"src"],[window.HTMLScriptElement,"src"],
      [window.HTMLIFrameElement,"src"],[window.HTMLSourceElement,"src"],
      [window.HTMLMediaElement,"src"],[window.HTMLLinkElement,"href"]];
    for(var i=0;i<pairs.length;i++){(function(C,prop){
      if(!C)return;
      var d=Object.getOwnPropertyDescriptor(C.prototype,prop);
      if(!d||!d.set)return;
      Object.defineProperty(C.prototype,prop,{
        get:function(){return d.get.call(this)},
        set:function(v){try{v=px(String(v))}catch(e){}return d.set.call(this,v)},
        configurable:true,enumerable:d.enumerable
      });
    })(pairs[i][0],pairs[i][1]);}
    var ATTRS=["src","href","action","poster"];
    function fix(el){
      if(!el||el.nodeType!==1)return;
      for(var a=0;a<ATTRS.length;a++){
        var v=el.getAttribute&&el.getAttribute(ATTRS[a]);
        if(v){var n=px(v);if(n!==v)el.setAttribute(ATTRS[a],n);}
      }
      var ss=el.getAttribute&&el.getAttribute("srcset");
      if(ss){
        var nn=ss.split(",").map(function(part){
          var seg=part.trim().split(/\s+/);
          if(!seg[0])return part;
          seg[0]=px(seg[0]);return seg.join(" ");
        }).join(", ");
        if(nn!==ss)el.setAttribute("srcset",nn);
      }
    }
    function scan(root){
      fix(root);
      if(root.querySelectorAll)
        root.querySelectorAll("[src],[href],[action],[poster],[srcset]").forEach(fix);
    }
    try{
      new MutationObserver(function(ms){
        for(var i=0;i<ms.length;i++){
          var m=ms[i];
          if(m.type==="attributes")fix(m.target);
          else for(var j=0;j<m.addedNodes.length;j++)scan(m.addedNodes[j]);
        }
      }).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:ATTRS.concat(["srcset"])});
      scan(document.documentElement);
      document.addEventListener("DOMContentLoaded",function(){scan(document.documentElement)});
    }catch(e){}
    var sa=Element.prototype.setAttribute;
    Element.prototype.setAttribute=function(n,v){
      try{var l=String(n).toLowerCase();
        if(l==="src"||l==="href"||l==="action"||l==="poster")v=px(String(v));
      }catch(e){}
      return sa.call(this,n,v);
    };
  }catch(e){}
})();`;
  return `<script>${code}</script>`;
}

function rewriteHtml(html: string, base: URL, region: ProxyRegion): string {
  let out = html;
  out = out.replace(/<meta[^>]*http-equiv=["']?content-security-policy["']?[^>]*>/gi, "");
  out = out.replace(/\sintegrity=["'][^"']*["']/gi, "");
  out = out.replace(
    /\s(href|src|action|poster)=["']([^"']+)["']/gi,
    (match, attr: string, value: string) => {
      const abs = toAbs(value, base);
      return abs ? ` ${attr}="${proxied(abs, region)}"` : match;
    },
  );
  out = out.replace(
    /\ssrcset=["']([^"']+)["']/gi,
    (match, value: string) => ` srcset="${rewriteSrcset(value, base, region)}"`,
  );
  out = out.replace(
    /\sstyle=["']([^"']*)["']/gi,
    (match, value: string) => ` style="${rewriteCssUrls(value, base, region)}"`,
  );
  out = out.replace(
    /(<style[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_m, open: string, css: string, close: string) =>
      open + rewriteCssUrls(css, base, region) + close,
  );
  out = out.replace(/\starget=["'](_blank|_top|_parent)["']/gi, ' target="_self"');
  out = out.replace(/<base[^>]*>/gi, "");

  const script = injectedScript(base, region);
  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, `<head$1>${script}`);
  } else {
    out = script + out;
  }
  return out;
}

function cookieNamespace(host: string): string {
  if (/(^|\.)duckduckgo\.com$/i.test(host)) return "";
  return `p_${host.replace(/^www\./, "").replace(/[^a-z0-9]/gi, "_")}_`;
}

function rewriteSetCookie(value: string, host: string): string {
  const ns = cookieNamespace(host);
  const eq = value.indexOf("=");
  const name = eq > 0 ? value.slice(0, eq).trim() : "";
  const rest = eq > 0 ? value.slice(eq) : value;
  const renamed = name && !name.startsWith(ns) ? `${ns}${name}${rest}` : value;
  return renamed
    .replace(/;\s*Domain=[^;]*/gi, "")
    .replace(/;\s*Path=[^;]*/gi, "")
    .replace(/;\s*SameSite=[^;]*/gi, "")
    .replace(/;\s*Partitioned/gi, "")
    .concat("; Path=/; SameSite=Lax");
}

function upstreamCookie(cookieHeader: string, host: string): string {
  const ns = cookieNamespace(host);
  return cookieHeader
    .split(/;\s*/)
    .filter((c) => c.startsWith(ns))
    .map((c) => c.slice(ns.length))
    .join("; ");
}

const TELEMETRY_PATTERNS: Array<{ host: RegExp; path: RegExp }> = [
  { host: /(^|\.)google\.[a-z.]+$/i, path: /^\/(log|gen_204|generate_204)/ },
  { host: /(^|\.)youtube\.com$/i, path: /^\/(api\/stats|ptracking|generate_204)/ },
  { host: /(^|\.)doubleclick\.net$/i, path: /.*/ },
  { host: /(^|\.)google-analytics\.com$/i, path: /.*/ },
  { host: /(^|\.)googletagmanager\.com$/i, path: /.*/ },
];

function isTelemetryUrl(target: URL): boolean {
  return TELEMETRY_PATTERNS.some(
    (p) => p.host.test(target.hostname) && p.path.test(target.pathname),
  );
}

const STATIC_ASSET_EXTENSIONS = new Set([
  "css", "gif", "ico", "jpeg", "jpg", "js", "mjs", "png", "svg", "webp", "woff", "woff2",
]);

function staticAssetFallback(target: URL): Response | null {
  const extension = target.pathname.split(".").pop()?.toLowerCase();
  if (!extension || !STATIC_ASSET_EXTENSIONS.has(extension)) return null;

  const contentTypes: Record<string, string> = {
    css: "text/css; charset=utf-8",
    js: "application/javascript; charset=utf-8",
    mjs: "application/javascript; charset=utf-8",
    svg: "image/svg+xml",
  };

  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
      "content-type": contentTypes[extension] ?? "application/octet-stream",
      "x-proxy-fallback": "upstream-unavailable",
    },
  });
}

async function handle(request: Request) {
  const url = new URL(request.url);
  const target = url.searchParams.get("url");
  if (!target) return new Response("Missing ?url=", { status: 400 });
  const region: ProxyRegion = url.searchParams.get("r") === "intl" ? "intl" : "jp";

  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }
  if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
    return new Response("Only http/https is allowed", { status: 400 });
  }

  if (/(^|\.)google\.[a-z.]+$/i.test(targetUrl.hostname)) {
    const real = targetUrl.searchParams.get("q") ?? targetUrl.searchParams.get("url");
    if (
      (targetUrl.pathname === "/url" || targetUrl.pathname === "/interstitial") &&
      real &&
      /^https?:\/\//i.test(real)
    ) {
      targetUrl = new URL(real);
    }
  }

  let guard = 0;
  while (
    targetUrl.pathname === "/api/public/proxy" &&
    targetUrl.searchParams.get("url") &&
    guard++ < 5
  ) {
    const nested = targetUrl.searchParams.get("url");
    if (!nested) break;
    try {
      targetUrl = new URL(nested);
    } catch {
      return new Response("Invalid nested url", { status: 400 });
    }
  }
  targetUrl = normalizeKnownUpstreamUrl(targetUrl, url.origin);
  if (targetUrl.host === url.host) return new Response("Refusing to proxy self", { status: 400 });
  targetUrl.hostname = targetUrl.hostname.replace(/\.+$/, "");
  if (!/^[a-z0-9.-]+$/i.test(targetUrl.hostname) || !targetUrl.hostname.includes(".")) {
    return new Response("Invalid host", { status: 400 });
  }
  if (
    /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/i.test(targetUrl.hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(targetUrl.hostname) ||
    /\.(local|internal)$/i.test(targetUrl.hostname)
  ) {
    return new Response("Private hosts are not allowed", { status: 400 });
  }

  const upstreamHeaders: Record<string, string> = {
    "user-agent":
      request.headers.get("user-agent") ??
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
    accept: request.headers.get("accept") ?? "*/*",
    "accept-language": request.headers.get("accept-language") ?? "ja,en;q=0.9",
    referer: targetUrl.origin + "/",
    origin: targetUrl.origin,
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": request.headers.get("sec-fetch-mode") ?? "cors",
    "sec-fetch-dest": request.headers.get("sec-fetch-dest") ?? "empty",
  };
  const cookie = request.headers.get("cookie");
  if (cookie) {
    const forward = upstreamCookie(cookie, targetUrl.hostname);
    if (forward) upstreamHeaders["cookie"] = forward;
  }
  const contentType = request.headers.get("content-type");
  if (contentType && request.method !== "GET" && request.method !== "HEAD") {
    upstreamHeaders["content-type"] = contentType;
  }
  const xsrf = request.headers.get("x-csrf-token") ?? request.headers.get("x-youtube-client-name");
  if (xsrf) upstreamHeaders["x-csrf-token"] = xsrf;

  if (isTelemetryUrl(targetUrl)) {
    return new Response(null, {
      status: 204,
      headers: { "access-control-allow-origin": "*" },
    });
  }

  let body: ArrayBuffer | null = null;
  if (request.method === "POST") {
    try {
      body = await request.arrayBuffer();
    } catch {
      return new Response(null, { status: 499 });
    }
  }

  const fetchUpstream = async () => {
    const direct = () =>
      fetch(targetUrl, {
        method: request.method === "POST" ? "POST" : "GET",
        headers: upstreamHeaders,
        body,
        redirect: "manual",
      });

    if (region !== "intl" || request.method === "POST") return direct();

    for (const relay of INTL_RELAYS) {
      try {
        const res = await fetch(relay(targetUrl.toString()), {
          method: "GET",
          headers: {
            "user-agent": upstreamHeaders["user-agent"] as string,
            accept: upstreamHeaders["accept"] as string,
          },
          redirect: "follow",
        });
        if (res.ok) return res;
      } catch {
        /* fallback */
      }
    }
    return direct();
  };

  let upstream: Response;
  try {
    upstream = await fetchUpstream();
  } catch (e) {
    const fallback = staticAssetFallback(targetUrl);
    if (fallback) return fallback;
    return new Response(
      `Upstream fetch failed: ${targetUrl.hostname} (${e instanceof Error ? e.message : "unknown"})`,
      {
        status: 502,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "access-control-allow-origin": "*",
        },
      },
    );
  }

  const isGoogle = /(^|\.)google\.[a-z.]+$/i.test(targetUrl.hostname);
  const blockedByGoogle =
    isGoogle &&
    (upstream.status === 429 ||
      targetUrl.pathname.startsWith("/sorry") ||
      (upstream.headers.get("location") ?? "").includes("/sorry/"));
  if (blockedByGoogle) {
    const q = targetUrl.searchParams.get("q") ?? "";
    const fallback = `https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
    return new Response(null, {
      status: 302,
      headers: {
        location: proxied(fallback, region),
        "access-control-allow-origin": "*",
      },
    });
  }

  const headers = new Headers();
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (HOP_BY_HOP.has(k)) return;
    if (k === "location") {
      const abs = toAbs(value, targetUrl);
      headers.set("location", abs ? proxied(abs, region) : value);
      return;
    }
    if (k === "set-cookie") {
      headers.append("set-cookie", rewriteSetCookie(value, targetUrl.hostname));
      return;
    }
    headers.set(key, value);
  });
  headers.set("access-control-allow-origin", "*");

  const upstreamType = upstream.headers.get("content-type") ?? "";
  const base = new URL(targetUrl);

  if (upstreamType.includes("text/html")) {
    const html = await upstream.text();
    headers.delete("content-length");
    return new Response(rewriteHtml(html, base, region), {
      status: upstream.status,
      headers,
    });
  }

  if (upstreamType.includes("text/css")) {
    const css = await upstream.text();
    headers.delete("content-length");
    return new Response(rewriteCssUrls(css, base, region), {
      status: upstream.status,
      headers,
    });
  }

  return new Response(upstream.body, { status: upstream.status, headers });
}

async function safeHandle(request: Request) {
  try {
    return await handle(request);
  } catch (e) {
    if (request.signal?.aborted || (e instanceof Error && /abort/i.test(e.message))) {
      return new Response(null, { status: 499 });
    }
    return new Response(
      `Proxy error: ${e instanceof Error ? e.message : "unknown"}`,
      {
        status: 502,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "access-control-allow-origin": "*",
        },
      },
    );
  }
}

export const Route = createFileRoute("/api/public/proxy")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, POST, OPTIONS",
            "access-control-allow-headers":
              "Content-Type, Authorization, X-Requested-With, Accept, Origin",
            "access-control-max-age": "86400",
          },
        }),
      GET: async ({ request }) => safeHandle(request),
      POST: async ({ request }) => safeHandle(request),
    },
  },
});
