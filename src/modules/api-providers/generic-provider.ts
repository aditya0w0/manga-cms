import { safeFetch, SafeFetchResponse } from "@/lib/security/safe-fetch";
import { decryptCredential } from "@/lib/security/encryption";
import { mapItem, findPrimaryArray, EntityMappingConfig } from "./json-mapper";
import { extractPaginationInfo, PaginationConfig } from "./pagination";
import { ContentPolicyService } from "../content-policy/content-policy-service";
import { getPrisma } from "@/lib/database/prisma";
import { APIProvider, APIEndpoint, APIFieldMapping, APIAuthType, HttpMethod } from "@prisma/client";

export interface NormalizedManga {
  externalId: string;
  title: string;
  alternativeTitles?: string[];
  description?: string;
  coverUrl?: string;
  bannerUrl?: string;
  author?: string;
  artist?: string;
  releaseYear?: number;
  status?: string;
  contentType?: string;
  rating?: number;
  language?: string;
  genres?: string[];
  tags?: string[];
  rawMetadata?: any;
}

export interface NormalizedChapter {
  externalId: string;
  chapterNumber: number;
  chapterTitle?: string;
  volume?: number;
  language?: string;
  scanlationGroup?: string;
  releaseDate?: string;
  externalUrl?: string;
  rawMetadata?: any;
}

export interface NormalizedPage {
  pageNumber: number;
  imageUrl: string;
}

export interface ProviderExecutionResult<T> {
  data: T;
  rawResponse?: any;
  durationMs: number;
  statusCode: number;
  pagination?: {
    currentPage: number;
    totalPages?: number;
    hasNextPage: boolean;
  };
}

export class GenericRestProvider {
  private provider: APIProvider;
  private endpoints: Map<string, APIEndpoint>;
  private fieldMappings: Map<string, EntityMappingConfig>;

  constructor(
    provider: APIProvider,
    endpoints: APIEndpoint[],
    mappings: APIFieldMapping[]
  ) {
    this.provider = provider;
    this.endpoints = new Map(endpoints.map((e) => [e.name, e]));
    this.fieldMappings = new Map(
      mappings.map((m) => [m.entityType, (m.mappings as unknown as EntityMappingConfig) || {}])
    );
  }

  /**
   * Prepares headers including decrypted authentication credentials
   */
  private getAuthHeadersAndQuery(): {
    headers: Record<string, string>;
    queryParams: Record<string, string>;
  } {
    const headers: Record<string, string> = {};
    const queryParams: Record<string, string> = {};

    // Custom headers from provider configuration
    if (this.provider.customHeaders && typeof this.provider.customHeaders === "object") {
      Object.assign(headers, this.provider.customHeaders);
    }

    const credentials = this.provider.encryptedCredentials
      ? decryptCredential(this.provider.encryptedCredentials)
      : "";

    switch (this.provider.authType) {
      case APIAuthType.BEARER_TOKEN:
        if (credentials) headers["Authorization"] = `Bearer ${credentials}`;
        break;

      case APIAuthType.API_KEY_HEADER:
        if (credentials) headers["X-API-Key"] = credentials;
        break;

      case APIAuthType.API_KEY_QUERY:
        if (credentials) queryParams["api_key"] = credentials;
        break;

      case APIAuthType.BASIC:
        if (credentials) {
          const b64 = Buffer.from(credentials).toString("base64");
          headers["Authorization"] = `Basic ${b64}`;
        }
        break;

      case APIAuthType.CUSTOM_HEADERS:
        if (credentials) {
          try {
            const parsed = JSON.parse(credentials);
            Object.assign(headers, parsed);
          } catch {
            // treat as single raw header
          }
        }
        break;

      case APIAuthType.NONE:
      default:
        break;
    }

    return { headers, queryParams };
  }

  /**
   * Executes an endpoint request, replacing path variables and applying query params
   */
  async executeEndpoint(
    endpointName: string,
    params: {
      pathParams?: Record<string, string | number>;
      queryParams?: Record<string, any>;
      overrideUrl?: string;
    } = {}
  ): Promise<{ response: SafeFetchResponse; json: any; durationMs: number }> {
    const endpoint = this.endpoints.get(endpointName);
    if (!endpoint && !params.overrideUrl) {
      throw new Error(`Endpoint "${endpointName}" not configured for provider "${this.provider.name}"`);
    }

    const { headers: authHeaders, queryParams: authQuery } = this.getAuthHeadersAndQuery();

    let fullUrl = params.overrideUrl;

    if (!fullUrl && endpoint) {
      // Build path with variable substitution: /manga/{id}/chapters -> /manga/123/chapters
      let urlPath = endpoint.urlTemplate;
      if (params.pathParams) {
        for (const [key, value] of Object.entries(params.pathParams)) {
          urlPath = urlPath.replace(new RegExp(`\\{${key}\\}`, "g"), encodeURIComponent(String(value)));
        }
      }

      const base = this.provider.baseUrl.replace(/\/+$/, "");
      const cleanPath = urlPath.startsWith("/") ? urlPath : `/${urlPath}`;
      fullUrl = `${base}${cleanPath}`;
    }

    const urlObj = new URL(fullUrl!);

    // Merge default query params + auth query + call params
    const mergedQuery: Record<string, any> = {
      ...authQuery,
      ...((endpoint?.queryParams as Record<string, any>) || {}),
      ...(params.queryParams || {}),
    };

    for (const [k, v] of Object.entries(mergedQuery)) {
      if (v !== undefined && v !== null && v !== "") {
        urlObj.searchParams.set(k, String(v));
      }
    }

    // Merge default headers
    const mergedHeaders: Record<string, string> = {
      ...authHeaders,
      ...((endpoint?.defaultHeaders as Record<string, string>) || {}),
    };

    const startTime = Date.now();
    let res: SafeFetchResponse;
    let errorMsg: string | undefined;

    try {
      res = await safeFetch(urlObj.toString(), {
        method: endpoint ? (endpoint.method as any) : "GET",
        headers: mergedHeaders,
        timeoutMs: this.provider.timeoutMs || 10000,
      });
    } catch (err: any) {
      errorMsg = err.message || String(err);
      // Log failed request
      await this.logRequest(urlObj.toString(), endpoint?.method || HttpMethod.GET, 0, Date.now() - startTime, mergedHeaders, undefined, errorMsg);
      throw err;
    }

    let parsedJson: any = null;
    try {
      parsedJson = JSON.parse(res.data);
    } catch {
      parsedJson = { raw: res.data };
    }

    // Log successful request
    await this.logRequest(
      urlObj.toString(),
      endpoint?.method || HttpMethod.GET,
      res.status,
      res.durationMs,
      mergedHeaders,
      res.data.substring(0, 500),
      undefined
    );

    return {
      response: res,
      json: parsedJson,
      durationMs: res.durationMs,
    };
  }

  private async logRequest(
    url: string,
    method: HttpMethod,
    statusCode: number,
    durationMs: number,
    headers: Record<string, string>,
    snippet?: string,
    error?: string
  ) {
    try {
      const db = await getPrisma();
      // Sanitize authorization headers from log
      const sanitizedHeaders = { ...headers };
      if (sanitizedHeaders["Authorization"]) sanitizedHeaders["Authorization"] = "[REDACTED]";
      if (sanitizedHeaders["X-API-Key"]) sanitizedHeaders["X-API-Key"] = "[REDACTED]";

      await db.aPIRequestLog.create({
        data: {
          providerId: this.provider.id,
          endpointUrl: url,
          method,
          statusCode,
          durationMs,
          requestHeaders: sanitizedHeaders,
          responseSnippet: snippet,
          error,
        },
      });
    } catch (logErr) {
      console.warn("Failed to write APIRequestLog:", logErr);
    }
  }

  /**
   * Search for manga
   */
  async search(query: string, options: { page?: number; limit?: number } = {}): Promise<ProviderExecutionResult<NormalizedManga[]>> {
    const { json, durationMs, response } = await this.executeEndpoint("search", {
      queryParams: {
        q: query,
        query,
        title: query,
        page: options.page || 1,
        limit: options.limit || 20,
      },
    });

    const mapping = this.fieldMappings.get("MANGA") || {};
    const items = findPrimaryArray(json);
    const mapped = items.map((item) => this.normalizeMangaRecord(item, mapping));

    // Global Content Exclusion Policy: filter out policy violations from search
    const policyFiltered: NormalizedManga[] = [];
    for (const item of mapped) {
      const check = await ContentPolicyService.evaluateMangaContent({
        title: item.title,
        alternativeTitles: item.alternativeTitles,
        description: item.description,
        genres: item.genres,
        tags: item.tags,
        rawMetadata: item.rawMetadata,
        providerId: this.provider.id,
      });
      if (check.allowed && check.action !== "REJECT") {
        policyFiltered.push(item);
      }
    }

    const endpoint = this.endpoints.get("search");
    const paginationConfig = (endpoint?.paginationConfig as unknown as PaginationConfig) || {
      type: endpoint?.paginationType || "PAGE",
    };
    const pagination = extractPaginationInfo(json, paginationConfig, options);

    return {
      data: policyFiltered,
      rawResponse: json,
      durationMs,
      statusCode: response.status,
      pagination: {
        currentPage: pagination.currentPage,
        totalPages: pagination.totalPages,
        hasNextPage: pagination.hasNextPage,
      },
    };
  }

  /**
   * Get single manga details
   */
  async getManga(externalId: string): Promise<ProviderExecutionResult<NormalizedManga>> {
    const { json, durationMs, response } = await this.executeEndpoint("manga_detail", {
      pathParams: { id: externalId, manga_id: externalId },
      queryParams: { id: externalId },
    });

    const mapping = this.fieldMappings.get("MANGA") || {};
    const primaryArray = findPrimaryArray(json);
    const rawItem = primaryArray.length > 0 ? primaryArray[0] : json.data || json;
    const mapped = this.normalizeMangaRecord(rawItem, mapping);

    // Global Content Exclusion Policy: reject prohibited manga detail
    const check = await ContentPolicyService.evaluateMangaContent({
      title: mapped.title,
      alternativeTitles: mapped.alternativeTitles,
      description: mapped.description,
      genres: mapped.genres,
      tags: mapped.tags,
      rawMetadata: mapped.rawMetadata,
      providerId: this.provider.id,
    });
    if (!check.allowed || check.action === "REJECT") {
      throw new Error(`Content policy violation: ${check.reason}`);
    }

    return {
      data: mapped,
      rawResponse: json,
      durationMs,
      statusCode: response.status,
    };
  }

  /**
   * Get chapter listing for a manga
   */
  async getChapters(
    mangaExternalId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<ProviderExecutionResult<NormalizedChapter[]>> {
    const { json, durationMs, response } = await this.executeEndpoint("chapters", {
      pathParams: { id: mangaExternalId, manga_id: mangaExternalId },
      queryParams: {
        manga_id: mangaExternalId,
        page: options.page || 1,
        limit: options.limit || 100,
      },
    });

    const mapping = this.fieldMappings.get("CHAPTER") || {};
    const items = findPrimaryArray(json);
    const mapped = items.map((item) => this.normalizeChapterRecord(item, mapping));

    return {
      data: mapped,
      rawResponse: json,
      durationMs,
      statusCode: response.status,
    };
  }

  /**
   * Get page image URLs for a chapter
   */
  async getChapterPages(chapterExternalId: string): Promise<ProviderExecutionResult<NormalizedPage[]>> {
    const { json, durationMs, response } = await this.executeEndpoint("chapter_pages", {
      pathParams: { id: chapterExternalId, chapter_id: chapterExternalId },
      queryParams: { chapter_id: chapterExternalId },
    });

    const mapping = this.fieldMappings.get("PAGE") || {};
    const items = findPrimaryArray(json);

    let pages: NormalizedPage[] = [];
    if (items.length > 0 && typeof items[0] === "string") {
      // Array of direct URL strings: ["https://.../1.jpg", "https://.../2.jpg"]
      pages = items.map((url, idx) => ({
        pageNumber: idx + 1,
        imageUrl: url,
      }));
    } else {
      pages = items.map((item, idx) => {
        const mapped = mapItem(item, mapping);
        return {
          pageNumber: Number(mapped.page_number || idx + 1),
          imageUrl: mapped.image_url || mapped.url || item.url || item,
        };
      });
    }

    return {
      data: pages,
      rawResponse: json,
      durationMs,
      statusCode: response.status,
    };
  }

  /**
   * Get popular / trending manga list
   */
  async getPopular(options: { page?: number; limit?: number } = {}): Promise<ProviderExecutionResult<NormalizedManga[]>> {
    // If 'popular' endpoint not explicitly defined, fallback to 'search' or 'latest'
    const endpointName = this.endpoints.has("popular") ? "popular" : "search";
    const { json, durationMs, response } = await this.executeEndpoint(endpointName, {
      queryParams: {
        sort: "popular",
        order: "desc",
        page: options.page || 1,
        limit: options.limit || 20,
      },
    });

    const mapping = this.fieldMappings.get("MANGA") || {};
    const items = findPrimaryArray(json);
    const mapped = items.map((item) => this.normalizeMangaRecord(item, mapping));

    // Global Content Exclusion Policy: filter out policy violations from popular/trending
    const policyFiltered: NormalizedManga[] = [];
    for (const item of mapped) {
      const check = await ContentPolicyService.evaluateMangaContent({
        title: item.title,
        alternativeTitles: item.alternativeTitles,
        description: item.description,
        genres: item.genres,
        tags: item.tags,
        rawMetadata: item.rawMetadata,
        providerId: this.provider.id,
      });
      if (check.allowed && check.action !== "REJECT") {
        policyFiltered.push(item);
      }
    }

    return {
      data: policyFiltered,
      rawResponse: json,
      durationMs,
      statusCode: response.status,
    };
  }

  private normalizeMangaRecord(rawItem: any, mapping: EntityMappingConfig): NormalizedManga {
    const mapped = mapItem(rawItem, mapping);

    // Fallbacks if mapping didn't find specific key
    const externalId = String(mapped.id || rawItem.id || rawItem.manga_id || rawItem.slug || "");
    const title = String(mapped.title || rawItem.title || rawItem.name || "Untitled");

    let genres: string[] = [];
    if (Array.isArray(mapped.genres)) {
      genres = mapped.genres.map((g: any) => (typeof g === "object" ? g.name || g.label : String(g)));
    } else if (typeof mapped.genres === "string") {
      genres = mapped.genres.split(",").map((s) => s.trim()).filter(Boolean);
    }

    return {
      externalId,
      title,
      alternativeTitles: Array.isArray(mapped.alternative_titles)
        ? mapped.alternative_titles
        : typeof mapped.alternative_titles === "string"
        ? [mapped.alternative_titles]
        : undefined,
      description: mapped.description || rawItem.description || rawItem.synopsis,
      coverUrl: (() => {
        let rawCover = mapped.cover_url || rawItem.cover || rawItem.thumbnail || rawItem.image || rawItem.img;
        if (rawCover && typeof rawCover === "string" && rawCover.startsWith("/")) {
          if (rawCover.startsWith("/images/")) {
            return `https://comix.to${rawCover}`;
          }
          return `${this.provider.baseUrl.replace(/\/+$/, "")}${rawCover}`;
        }
        return rawCover;
      })(),
      bannerUrl: mapped.banner_url || rawItem.banner,
      author: mapped.author || rawItem.author,
      artist: mapped.artist || rawItem.artist,
      releaseYear: mapped.release_year ? Number(mapped.release_year) : undefined,
      status: mapped.status || "ONGOING",
      contentType: mapped.content_type || "MANGA",
      rating: mapped.rating ? Number(mapped.rating) : 0,
      language: mapped.language || this.provider.defaultLanguage || "en",
      genres,
      tags: Array.isArray(mapped.tags) ? mapped.tags : undefined,
      rawMetadata: rawItem,
    };
  }

  private normalizeChapterRecord(rawItem: any, mapping: EntityMappingConfig): NormalizedChapter {
    const mapped = mapItem(rawItem, mapping);
    const externalId = String(mapped.id || rawItem.id || rawItem.chapter_id || "");
    const chapterNumber = Number(mapped.chapter_number || rawItem.chapter || rawItem.chapter_number || 1);

    return {
      externalId,
      chapterNumber,
      chapterTitle: mapped.chapter_title || rawItem.title || rawItem.name,
      volume: mapped.volume ? Number(mapped.volume) : undefined,
      language: mapped.language || rawItem.language || "en",
      scanlationGroup: mapped.scanlation_group || rawItem.group,
      releaseDate: mapped.release_date || rawItem.created_at,
      externalUrl: mapped.external_url || rawItem.url,
      rawMetadata: rawItem,
    };
  }
}

/**
 * Factory helper: loads provider, its endpoints, and mappings from DB and instantiates GenericRestProvider
 */
export async function createProviderInstance(providerId: string): Promise<GenericRestProvider> {
  const db = await getPrisma();
  const provider = await db.aPIProvider.findUnique({
    where: { id: providerId },
    include: {
      endpoints: true,
      fieldMappings: true,
    },
  });

  if (!provider) {
    throw new Error(`API Provider "${providerId}" not found`);
  }

  return new GenericRestProvider(provider, provider.endpoints, provider.fieldMappings);
}
