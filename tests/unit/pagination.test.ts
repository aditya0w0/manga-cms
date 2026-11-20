import { describe, it, expect } from "vitest";
import {
  detectPaginationPatterns,
  extractPaginationInfo,
} from "@/modules/api-providers/pagination";

describe("API Pagination Detection & Resolver", () => {
  it("detects page-based pagination pattern", () => {
    const json = {
      data: [],
      pagination: {
        page: 2,
        total_pages: 10,
        total: 100,
      },
    };

    const pattern = detectPaginationPatterns(json);
    expect(pattern.type).toBe("PAGE");
    expect(pattern.currentPagePath).toBe("pagination.page");
    expect(pattern.totalPagesPath).toBe("pagination.total_pages");
  });

  it("detects link-based pagination pattern", () => {
    const json = {
      results: [],
      next: "https://api.example.com/manga?page=3",
    };

    const pattern = detectPaginationPatterns(json);
    expect(pattern.type).toBe("LINK");
    expect(pattern.nextUrlPath).toBe("next");
  });

  it("calculates next page query parameters correctly for page pagination", () => {
    const json = {
      items: [1, 2, 3],
      total_pages: 5,
    };

    const info = extractPaginationInfo(
      json,
      {
        type: "PAGE",
        totalPagesPath: "total_pages",
        pageParam: "page",
        limitParam: "limit",
        defaultPageSize: 20,
      },
      { page: 2, limit: 20 }
    );

    expect(info.currentPage).toBe(2);
    expect(info.totalPages).toBe(5);
    expect(info.hasNextPage).toBe(true);
    expect(info.nextQueryParams?.page).toBe(3);
    expect(info.nextQueryParams?.limit).toBe(20);
  });

  it("calculates offset pagination correctly", () => {
    const json = {
      items: [1, 2],
      total: 100,
    };

    const info = extractPaginationInfo(
      json,
      {
        type: "OFFSET",
        totalRecordsPath: "total",
        offsetParam: "offset",
        limitParam: "limit",
        defaultPageSize: 20,
      },
      { offset: 40, limit: 20 }
    );

    expect(info.hasNextPage).toBe(true);
    expect(info.nextQueryParams?.offset).toBe(60);
  });

  it("stops pagination when reaching total pages or safety limit", () => {
    const json = { items: [], total_pages: 3 };

    const info = extractPaginationInfo(
      json,
      {
        type: "PAGE",
        totalPagesPath: "total_pages",
        pageParam: "page",
      },
      { page: 3 }
    );

    expect(info.hasNextPage).toBe(false);
  });
});
