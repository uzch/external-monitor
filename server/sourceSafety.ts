import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export interface SafeUrlResult {
  url: URL;
  diagnostics: string[];
}

export interface SafeFetchResponse {
  body: Uint8Array;
  contentType: string;
  finalUrl: string;
  diagnostics: string[];
  headers: Headers;
  status: number;
}

const maxRedirects = 3;

export async function fetchSafeText(
  inputUrl: string,
  timeoutMs: number,
  maxBytes: number,
): Promise<{ body: string; finalUrl: string; diagnostics: string[]; status: number }> {
  const result = await fetchSafeResponse(inputUrl, timeoutMs, maxBytes, {
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
  });

  return {
    body: new TextDecoder().decode(result.body),
    finalUrl: result.finalUrl,
    diagnostics: result.diagnostics,
    status: result.status,
  };
}

export async function fetchSafeResponse(
  inputUrl: string,
  timeoutMs: number,
  maxBytes: number,
  acceptHeaders: Record<string, string> = {},
): Promise<SafeFetchResponse> {
  const diagnostics: string[] = [];
  let current = await validatePublicHttpUrl(inputUrl);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(current.url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "external-account-signal-monitor/1.0 local",
          ...acceptHeaders,
        },
      });

      diagnostics.push(...current.diagnostics);

      if (isRedirect(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          throw new Error("Redirect response did not include a Location header");
        }
        const next = new URL(location, current.url);
        current = await validatePublicHttpUrl(next.toString());
        diagnostics.push(`followed redirect to ${current.url.hostname}`);
        continue;
      }

      if (!response.ok) {
        throw new Error(`Source returned HTTP ${response.status}`);
      }

      const body = await readLimitedBytes(response, maxBytes);
      return {
        body,
        contentType: response.headers.get("content-type") ?? "",
        finalUrl: current.url.toString(),
        diagnostics,
        headers: response.headers,
        status: response.status,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Source retrieval timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`Source exceeded ${maxRedirects} redirects`);
}

export async function validatePublicHttpUrl(inputUrl: string): Promise<SafeUrlResult> {
  let url: URL;
  try {
    url = new URL(inputUrl);
  } catch {
    throw new Error("Source URL is not a valid URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Source URL must use http or https");
  }

  if (url.username || url.password) {
    throw new Error("Source URL must not include credentials");
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("Source URL must not target localhost");
  }

  const diagnostics: string[] = [];
  const literalIpVersion = isIP(hostname);
  const addresses = literalIpVersion
    ? [{ address: hostname, family: literalIpVersion }]
    : await lookup(hostname, { all: true, verbatim: true });

  if (addresses.length === 0) {
    throw new Error("Source hostname did not resolve");
  }

  for (const address of addresses) {
    if (isPrivateOrUnsafeAddress(address.address)) {
      throw new Error("Source URL resolves to a private, loopback, or link-local address");
    }
  }

  diagnostics.push(`resolved ${hostname} to ${addresses.length} public address${addresses.length === 1 ? "" : "es"}`);
  return { url, diagnostics };
}

function isRedirect(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}

async function readLimitedBytes(response: Response, maxBytes: number): Promise<Uint8Array> {
  if (!response.body) {
    return new Uint8Array();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`Source response exceeded ${maxBytes} bytes`);
    }
    chunks.push(value);
  }

  return concat(chunks, total);
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function isPrivateOrUnsafeAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const parts = address.split(".").map(Number);
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a >= 224)
    );
  }

  if (version === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized === "::1" ||
      normalized.startsWith("fe80:") ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:192.168.")
    );
  }

  return true;
}
