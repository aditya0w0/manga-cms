import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/auth";
import { safeFetch } from "@/lib/security/safe-fetch";
import { inspectAndSuggestMappings } from "@/modules/api-providers/json-mapper";
import { detectPaginationPatterns } from "@/modules/api-providers/pagination";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();

    const {
      url,
      method = "GET",
      headers = {},
      authType = "NONE",
      credentials = "",
      queryParams = {},
      entityType = "MANGA",
      timeoutMs = 12000,
    } = body;

    if (!url || !url.trim()) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Prepare URL and query parameters
    let targetUrl: URL;
    try {
      targetUrl = new URL(url.trim());
    } catch {
      return NextResponse.json({ error: "Invalid URL syntax" }, { status: 400 });
    }

    // Merge query params
    for (const [k, v] of Object.entries(queryParams)) {
      if (v !== undefined && v !== null && v !== "") {
        targetUrl.searchParams.set(k, String(v));
      }
    }

    // Prepare Headers
    const requestHeaders: Record<string, string> = { ...headers };

    if (authType === "BEARER_TOKEN" && credentials) {
      requestHeaders["Authorization"] = `Bearer ${credentials}`;
    } else if (authType === "API_KEY_HEADER" && credentials) {
      requestHeaders["X-API-Key"] = credentials;
    } else if (authType === "API_KEY_QUERY" && credentials) {
      targetUrl.searchParams.set("api_key", credentials);
    } else if (authType === "BASIC" && credentials) {
      requestHeaders["Authorization"] = `Basic ${Buffer.from(credentials).toString("base64")}`;
    }

    const startTime = Date.now();

    const response = await safeFetch(targetUrl.toString(), {
      method: method.toUpperCase() as any,
      headers: requestHeaders,
      timeoutMs: Number(timeoutMs) || 12000,
      allowPrivateForTest: process.env.ALLOW_PRIVATE_NETWORK === "true",
    });

    let json: any = null;
    let isJson = false;

    try {
      json = JSON.parse(response.data);
      isJson = true;
    } catch {
      json = { raw: response.data.substring(0, 1000) };
    }

    let mappingAnalysis = null;
    let paginationAnalysis = null;

    if (isJson) {
      try {
        mappingAnalysis = inspectAndSuggestMappings(json, entityType);
        paginationAnalysis = detectPaginationPatterns(json);
      } catch (analysisErr) {
        console.warn("Analysis warning:", analysisErr);
      }
    }

    return NextResponse.json({
      success: true,
      statusCode: response.status,
      statusText: response.statusText,
      durationMs: response.durationMs,
      resolvedIp: response.resolvedIp,
      headers: response.headers,
      isJson,
      data: json,
      mappingAnalysis,
      paginationAnalysis,
    });
  } catch (err: any) {
    console.error("Test connection error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to execute test request",
        isSsrfBlock: String(err.message).includes("SSRF"),
      },
      { status: 400 }
    );
  }
}
