import dns from "dns/promises";
import ipaddr from "ipaddr.js";
import http from "http";
import https from "https";

export interface SafeFetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "HEAD";
  headers?: Record<string, string>;
  body?: string | Buffer;
  timeoutMs?: number;
  maxRedirects?: number;
  maxResponseSizeBytes?: number;
  allowPrivateForTest?: boolean;
}

export interface SafeFetchResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: string;
  durationMs: number;
  resolvedIp?: string;
}

/**
 * Checks if an IP address string is private, loopback, link-local, multicast, or cloud metadata.
 */
export function isPrivateOrRestrictedIp(ipString: string): boolean {
  try {
    let addr = ipaddr.parse(ipString);

    // If it's an IPv4-mapped IPv6 address (e.g. ::ffff:127.0.0.1), unmap to IPv4
    if (addr.kind() === "ipv6" && (addr as ipaddr.IPv6).isIPv4MappedAddress()) {
      addr = (addr as ipaddr.IPv6).toIPv4Address();
    }

    const range = addr.range();

    // Blocked ranges for IPv4 and IPv6
    const blockedRanges = [
      "loopback",        // 127.0.0.0/8 or ::1
      "private",         // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
      "uniqueLocal",     // fc00::/7 (IPv6 ULA private range)
      "linkLocal",       // 169.254.0.0/16 (includes 169.254.169.254 AWS/GCP metadata), fe80::/10
      "multicast",       // 224.0.0.0/4, ff00::/8
      "broadcast",       // 255.255.255.255/32
      "carrierGradeNat", // 100.64.0.0/10
      "reserved",        // 240.0.0.0/4
      "unspecified",     // 0.0.0.0, ::
    ];

    if (blockedRanges.includes(range)) {
      return true;
    }

    return false;
  } catch {
    // If it cannot be parsed, treat as unsafe
    return true;
  }
}

/**
 * Validates a URL against SSRF rules.
 * Resolves DNS to check all A and AAAA records.
 */
export async function validateSafeUrl(
  rawUrl: string,
  allowPrivate = false
): Promise<{ safe: boolean; error?: string; resolvedIp?: string; parsedUrl?: URL }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { safe: false, error: "Invalid URL syntax" };
  }

  // Scheme validation: only http and https allowed
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, error: `Disallowed URL protocol: ${parsed.protocol}` };
  }

  // Hostname validation
  const hostname = parsed.hostname.toLowerCase();

  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "127.0.0.1" || hostname === "::1") {
    if (!allowPrivate) {
      return { safe: false, error: "Access to localhost is blocked for security" };
    }
  }

  // Check if hostname is direct IP literal
  if (ipaddr.isValid(hostname)) {
    if (!allowPrivate && isPrivateOrRestrictedIp(hostname)) {
      return { safe: false, error: `Access to private/restricted IP (${hostname}) is blocked` };
    }
    return { safe: true, resolvedIp: hostname, parsedUrl: parsed };
  }

  // DNS lookup to resolve destination host IPs
  try {
    const lookupResults = await dns.lookup(hostname, { all: true });
    if (!lookupResults || lookupResults.length === 0) {
      return { safe: false, error: `DNS resolution failed for host: ${hostname}` };
    }

    for (const record of lookupResults) {
      if (!allowPrivate && isPrivateOrRestrictedIp(record.address)) {
        return {
          safe: false,
          error: `Host ${hostname} resolves to blocked internal IP: ${record.address}`,
          resolvedIp: record.address,
        };
      }
    }

    return {
      safe: true,
      resolvedIp: lookupResults[0].address,
      parsedUrl: parsed,
    };
  } catch (err: any) {
    return { safe: false, error: `DNS resolution error: ${err.message || String(err)}` };
  }
}

/**
 * Safe outbound HTTP request executor with SSRF protection,
 * redirect re-validation, timeout enforcement, and response size limits.
 */
export async function safeFetch(
  url: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResponse> {
  const {
    method = "GET",
    headers = {},
    body,
    timeoutMs = 12000,
    maxRedirects = 5,
    maxResponseSizeBytes = 10 * 1024 * 1024, // 10MB
    allowPrivateForTest = process.env.ALLOW_PRIVATE_NETWORK === "true",
  } = options;

  let currentUrl = url;
  let redirectCount = 0;
  const startTime = Date.now();

  while (redirectCount <= maxRedirects) {
    const validation = await validateSafeUrl(currentUrl, allowPrivateForTest);
    if (!validation.safe || !validation.parsedUrl) {
      throw new Error(`SSRF Prevention Block: ${validation.error}`);
    }

    const parsedUrl = validation.parsedUrl;
    const isHttps = parsedUrl.protocol === "https:";
    const transport = isHttps ? https : http;

    const requestHeaders: Record<string, string> = {
      "User-Agent": "MangaCMS-ConnectorEngine/1.0",
      Accept: "application/json, text/plain, */*",
      ...headers,
    };

    const requestPromise = new Promise<SafeFetchResponse>((resolve, reject) => {
      const req = transport.request(
        parsedUrl,
        {
          method,
          headers: requestHeaders,
          timeout: timeoutMs,
        },
        (res) => {
          // Handle redirects
          if (
            res.statusCode &&
            [301, 302, 303, 307, 308].includes(res.statusCode) &&
            res.headers.location
          ) {
            res.resume(); // discard response body
            const nextUrl = new URL(res.headers.location, currentUrl).toString();
            resolve({
              status: res.statusCode,
              statusText: res.statusMessage || "Redirect",
              headers: res.headers as Record<string, string>,
              data: nextUrl,
              durationMs: Date.now() - startTime,
              resolvedIp: validation.resolvedIp,
            });
            return;
          }

          let responseData = "";
          let byteCount = 0;

          res.setEncoding("utf8");

          res.on("data", (chunk: string) => {
            byteCount += Buffer.byteLength(chunk, "utf8");
            if (byteCount > maxResponseSizeBytes) {
              req.destroy();
              reject(new Error(`Response body size exceeded maximum limit of ${maxResponseSizeBytes} bytes`));
              return;
            }
            responseData += chunk;
          });

          res.on("end", () => {
            const rawHeaders: Record<string, string> = {};
            for (const [key, val] of Object.entries(res.headers)) {
              if (val !== undefined) {
                rawHeaders[key] = Array.isArray(val) ? val.join(", ") : val;
              }
            }

            resolve({
              status: res.statusCode || 200,
              statusText: res.statusMessage || "OK",
              headers: rawHeaders,
              data: responseData,
              durationMs: Date.now() - startTime,
              resolvedIp: validation.resolvedIp,
            });
          });
        }
      );

      req.on("timeout", () => {
        req.destroy();
        reject(new Error(`Request timed out after ${timeoutMs}ms`));
      });

      req.on("error", (err) => {
        reject(err);
      });

      if (body) {
        req.write(body);
      }
      req.end();
    });

    const response = await requestPromise;

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      currentUrl = response.data; // Location
      redirectCount++;
      continue;
    }

    return response;
  }

  throw new Error(`Exceeded maximum redirect count of ${maxRedirects}`);
}
