import { describe, it, expect } from "vitest";
import {
  extractValueByPath,
  normalizeJsonPath,
  applyTransform,
  mapItem,
  findPrimaryArray,
  inspectAndSuggestMappings,
} from "@/modules/api-providers/json-mapper";

describe("JSON Mapper & Extraction Engine", () => {
  it("normalizes path notations into valid JSONPath expressions", () => {
    expect(normalizeJsonPath("data[].title")).toBe("$.data[*].title");
    expect(normalizeJsonPath("$.results[*].id")).toBe("$.results[*].id");
    expect(normalizeJsonPath("item.attributes.name")).toBe("$.item.attributes.name");
  });

  it("extracts nested properties from diverse JSON structures", () => {
    const payloadA = {
      data: [
        {
          id: "manga-1",
          attributes: {
            title: { en: "Solo Leveling" },
            score: 9.8,
          },
        },
      ],
    };

    expect(extractValueByPath(payloadA, "data[0].attributes.title.en")).toBe("Solo Leveling");
    expect(extractValueByPath(payloadA, "data[0].attributes.score")).toBe(9.8);

    const payloadB = {
      results: [
        {
          manga_id: 105,
          name: "Tower of God",
          tags: ["Action", "Fantasy"],
        },
      ],
    };

    expect(extractValueByPath(payloadB, "results[0].name")).toBe("Tower of God");
    expect(extractValueByPath(payloadB, "results[0].manga_id")).toBe(105);
  });

  it("applies data transformation rules accurately", () => {
    expect(applyTransform(" 123 ", "to_number")).toBe(123);
    expect(applyTransform("45.67", "to_integer")).toBe(45);
    expect(applyTransform("Action, Fantasy, Sci-Fi", "split_comma")).toEqual(["Action", "Fantasy", "Sci-Fi"]);
    expect(applyTransform("true", "to_boolean")).toBe(true);
    expect(applyTransform("ongoing", "uppercase")).toBe("ONGOING");
    expect(applyTransform("COMPLETED", "lowercase")).toBe("completed");
    expect(applyTransform("  hello world  ", "trim")).toBe("hello world");
  });

  it("maps external JSON item to internal normalized schema", () => {
    const rawExternal = {
      id: "abc-999",
      attributes: {
        title: { en: "Omniscient Reader" },
        status: "ongoing",
        year: "2020",
        genres: [{ name: "Action" }, { name: "Fantasy" }],
      },
      poster: "https://example.com/poster.jpg",
    };

    const mapping = {
      id: { path: "id", required: true },
      title: { path: "attributes.title.en" },
      status: { path: "attributes.status", transform: "uppercase" as const },
      release_year: { path: "attributes.year", transform: "to_integer" as const },
      cover_url: { path: "poster" },
      genres: { path: "attributes.genres[*].name" },
    };

    const mapped = mapItem(rawExternal, mapping);

    expect(mapped.id).toBe("abc-999");
    expect(mapped.title).toBe("Omniscient Reader");
    expect(mapped.status).toBe("ONGOING");
    expect(mapped.release_year).toBe(2020);
    expect(mapped.cover_url).toBe("https://example.com/poster.jpg");
    expect(mapped.genres).toEqual(["Action", "Fantasy"]);
  });

  it("detects primary arrays across different candidate keys", () => {
    expect(findPrimaryArray({ data: [1, 2, 3] })).toEqual([1, 2, 3]);
    expect(findPrimaryArray({ results: ["a", "b"] })).toEqual(["a", "b"]);
    expect(findPrimaryArray({ response: { items: [10, 20] } })).toEqual([10, 20]);
    expect(findPrimaryArray([9, 8, 7])).toEqual([9, 8, 7]);
  });

  it("inspects raw JSON and suggests field mappings based on heuristic key matching", () => {
    const sample = {
      data: [
        {
          id: "m-123",
          title: "Berserk",
          synopsis: "Guts is a wandering mercenary...",
          thumbnail: "https://example.com/berserk.jpg",
          year: 1989,
          status: "completed",
        },
      ],
    };

    const result = inspectAndSuggestMappings(sample, "MANGA");
    expect(result.suggestions.length).toBeGreaterThanOrEqual(4);

    const titleSug = result.suggestions.find((s) => s.field === "title");
    expect(titleSug?.suggestedPath).toBe("title");
    expect(titleSug?.sampleValue).toBe("Berserk");

    const coverSug = result.suggestions.find((s) => s.field === "cover_url");
    expect(coverSug?.suggestedPath).toBe("thumbnail");
  });
});
