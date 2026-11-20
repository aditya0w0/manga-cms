import { extractValueByPath } from "./json-mapper";
import { PaginationType } from "@prisma/client";

export interface PaginationConfig {
  type: PaginationType;
  pageParam?: string; // default "page"
  limitParam?: string; // default "limit"
  offsetParam?: string; // default "offset"
  cursorParam?: string; // default "cursor"
  
  // JSON paths in response
  totalPagesPath?: string; // e.g. "total_pages" or "pagination.total"
  totalRecordsPath?: string; // e.g. "total" or "pagination.count"
  currentPagePath?: string; // e.g. "page" or "pagination.current"
  nextUrlPath?: string; // e.g. "next" or "links.next"
  nextCursorPath?: string; // e.g. "next_cursor" or "meta.cursor"
  
  defaultPageSize?: number; // default 20
  maxSafetyPages?: number; // default 50 to avoid runaway scraping
}

export interface ExtractedPaginationInfo {
  currentPage: number;
  totalPages?: number;
  totalRecords?: number;
  hasNextPage: boolean;
  nextUrl?: string;
  nextCursor?: string;
  nextQueryParams?: Record<string, string | number>;
}

/**
 * Detects likely pagination metadata from a raw JSON response
 */
export function detectPaginationPatterns(json: any): Partial<PaginationConfig> {
  const result: Partial<PaginationConfig> = {
    type: "PAGE",
    pageParam: "page",
    limitParam: "limit",
    defaultPageSize: 20,
    maxSafetyPages: 50,
  };

  if (!json || typeof json !== "object") return result;

  // Check for next URL pattern
  if (json.next || (json.links && json.links.next)) {
    result.type = "LINK";
    result.nextUrlPath = json.next ? "next" : "links.next";
    return result;
  }

  // Check for cursor patterns
  if (json.next_cursor || json.cursor || (json.meta && json.meta.cursor)) {
    result.type = "CURSOR";
    result.cursorParam = "cursor";
    result.nextCursorPath = json.next_cursor ? "next_cursor" : json.cursor ? "cursor" : "meta.cursor";
    return result;
  }

  // Check for nested pagination object (e.g. { pagination: { current: 1, last: 10 } })
  if (json.pagination && typeof json.pagination === "object") {
    result.type = "PAGE";
    if ("current" in json.pagination) result.currentPagePath = "pagination.current";
    if ("page" in json.pagination) result.currentPagePath = "pagination.page";
    if ("last" in json.pagination) result.totalPagesPath = "pagination.last";
    if ("total_pages" in json.pagination) result.totalPagesPath = "pagination.total_pages";
    if ("total" in json.pagination) result.totalRecordsPath = "pagination.total";
    return result;
  }

  // Direct top-level properties
  if ("total_pages" in json) result.totalPagesPath = "total_pages";
  if ("page" in json) result.currentPagePath = "page";
  if ("total" in json) result.totalRecordsPath = "total";

  return result;
}

/**
 * Extracts current pagination status and computes parameters for the next page
 */
export function extractPaginationInfo(
  responseJson: any,
  config: PaginationConfig,
  currentReqParams: Record<string, any> = {}
): ExtractedPaginationInfo {
  const pageParam = config.pageParam || "page";
  const limitParam = config.limitParam || "limit";
  const offsetParam = config.offsetParam || "offset";
  const cursorParam = config.cursorParam || "cursor";
  const pageSize = config.defaultPageSize || 20;

  let currentPage = Number(currentReqParams[pageParam] || 1);
  let totalPages: number | undefined;
  let totalRecords: number | undefined;
  let nextUrl: string | undefined;
  let nextCursor: string | undefined;

  if (config.totalPagesPath) {
    const val = extractValueByPath(responseJson, config.totalPagesPath);
    if (val !== undefined) totalPages = Number(val);
  }

  if (config.totalRecordsPath) {
    const val = extractValueByPath(responseJson, config.totalRecordsPath);
    if (val !== undefined) {
      totalRecords = Number(val);
      if (!totalPages && totalRecords > 0) {
        totalPages = Math.ceil(totalRecords / pageSize);
      }
    }
  }

  if (config.currentPagePath) {
    const val = extractValueByPath(responseJson, config.currentPagePath);
    if (val !== undefined) currentPage = Number(val);
  }

  if (config.nextUrlPath) {
    const val = extractValueByPath(responseJson, config.nextUrlPath);
    if (typeof val === "string" && val) nextUrl = val;
  }

  if (config.nextCursorPath) {
    const val = extractValueByPath(responseJson, config.nextCursorPath);
    if (val) nextCursor = String(val);
  }

  // Determine if next page exists
  let hasNextPage = false;
  const nextQueryParams: Record<string, string | number> = { ...currentReqParams };

  const maxPages = config.maxSafetyPages || 50;

  switch (config.type) {
    case "PAGE": {
      if (totalPages !== undefined) {
        hasNextPage = currentPage < totalPages && currentPage < maxPages;
      } else {
        // If unknown total pages, check if we received a full page of items
        hasNextPage = currentPage < maxPages;
      }
      if (hasNextPage) {
        nextQueryParams[pageParam] = currentPage + 1;
        nextQueryParams[limitParam] = pageSize;
      }
      break;
    }

    case "OFFSET": {
      const currentOffset = Number(currentReqParams[offsetParam] || 0);
      const nextOffset = currentOffset + pageSize;
      if (totalRecords !== undefined) {
        hasNextPage = nextOffset < totalRecords && Math.floor(nextOffset / pageSize) < maxPages;
      } else {
        hasNextPage = Math.floor(nextOffset / pageSize) < maxPages;
      }
      if (hasNextPage) {
        nextQueryParams[offsetParam] = nextOffset;
        nextQueryParams[limitParam] = pageSize;
      }
      break;
    }

    case "CURSOR": {
      hasNextPage = Boolean(nextCursor) && currentPage < maxPages;
      if (hasNextPage && nextCursor) {
        nextQueryParams[cursorParam] = nextCursor;
      }
      break;
    }

    case "LINK": {
      hasNextPage = Boolean(nextUrl) && currentPage < maxPages;
      break;
    }

    case "LIMIT":
    default:
      hasNextPage = false;
  }

  return {
    currentPage,
    totalPages,
    totalRecords,
    hasNextPage,
    nextUrl,
    nextCursor,
    nextQueryParams: hasNextPage ? nextQueryParams : undefined,
  };
}
