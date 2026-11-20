import { JSONPath } from "jsonpath-plus";

export type TransformType =
  | "none"
  | "to_string"
  | "to_number"
  | "to_integer"
  | "to_boolean"
  | "to_array"
  | "to_date"
  | "trim"
  | "lowercase"
  | "uppercase"
  | "split_comma"
  | "first_element";

export interface FieldMappingRule {
  path: string; // e.g. "data[].attributes.title.en" or "$.results[*].name"
  defaultValue?: any;
  transform?: TransformType;
  required?: boolean;
}

export type EntityMappingConfig = Record<string, FieldMappingRule>;

/**
 * Normalizes custom shorthand paths (e.g. data[].attributes.title)
 * into standard JSONPath expressions (e.g. $.data[*].attributes.title)
 */
export function normalizeJsonPath(pathStr: string): string {
  if (!pathStr || pathStr.trim() === "") return "$";
  let normalized = pathStr.trim();

  // If already starts with $, leave it
  if (!normalized.startsWith("$")) {
    if (normalized.startsWith(".")) {
      normalized = "$" + normalized;
    } else {
      normalized = "$." + normalized;
    }
  }

  // Replace array empty brackets [] with [*]
  normalized = normalized.replace(/\[\]/g, "[*]");
  return normalized;
}

/**
 * Applies a data transform rule to an extracted value
 */
export function applyTransform(value: any, transform?: TransformType): any {
  if (value === undefined || value === null) {
    return value;
  }

  switch (transform) {
    case "to_string":
      return String(value);

    case "to_number": {
      const num = Number(value);
      return isNaN(num) ? 0 : num;
    }

    case "to_integer": {
      const int = parseInt(String(value), 10);
      return isNaN(int) ? 0 : int;
    }

    case "to_boolean": {
      if (typeof value === "boolean") return value;
      const str = String(value).toLowerCase().trim();
      return str === "true" || str === "1" || str === "yes";
    }

    case "to_array": {
      if (Array.isArray(value)) return value;
      if (typeof value === "string") {
        return value.split(",").map((s) => s.trim()).filter(Boolean);
      }
      return [value];
    }

    case "split_comma": {
      if (Array.isArray(value)) return value;
      return String(value).split(",").map((s) => s.trim()).filter(Boolean);
    }

    case "first_element": {
      if (Array.isArray(value)) return value[0];
      return value;
    }

    case "trim":
      return typeof value === "string" ? value.trim() : value;

    case "lowercase":
      return typeof value === "string" ? value.toLowerCase() : value;

    case "uppercase":
      return typeof value === "string" ? value.toUpperCase() : value;

    case "to_date": {
      try {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d.toISOString();
      } catch {
        return null;
      }
    }

    case "none":
    default:
      return value;
  }
}

/**
 * Extracts a value from a JSON object given a path expression
 */
export function extractValueByPath(json: any, pathExpr: string): any {
  if (!json || !pathExpr) return undefined;

  try {
    const jsonPath = normalizeJsonPath(pathExpr);
    const results = JSONPath({
      path: jsonPath,
      json,
      wrap: true,
    });

    if (!results || results.length === 0) {
      return undefined;
    }

    // If query was looking for an array of items or wildcard
    if (jsonPath.includes("[*]") && results.length > 1) {
      return results;
    }

    return results[0];
  } catch (err) {
    console.warn(`JSONPath extraction error on path "${pathExpr}":`, err);
    return undefined;
  }
}

/**
 * Maps a single external item object to an internal normalized record
 */
export function mapItem(rawItem: any, mappingRules: EntityMappingConfig): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [internalField, rule] of Object.entries(mappingRules)) {
    let extracted = extractValueByPath(rawItem, rule.path);

    if (extracted === undefined || extracted === null) {
      extracted = rule.defaultValue;
    }

    if (rule.transform) {
      extracted = applyTransform(extracted, rule.transform);
    }

    result[internalField] = extracted;
  }

  return result;
}

/**
 * Finds the primary content array in a JSON response.
 * Handles patterns:
 * - root array: [ ... ]
 * - data array: { data: [ ... ] }
 * - results array: { results: [ ... ] }
 * - items array: { response: { items: [ ... ] } }
 */
export function findPrimaryArray(json: any, specifiedPath?: string): any[] {
  if (Array.isArray(json)) {
    return json;
  }

  if (specifiedPath) {
    const extracted = extractValueByPath(json, specifiedPath);
    if (Array.isArray(extracted)) return extracted;
  }

  // Common root candidate keys
  const candidates = [
    "data",
    "results",
    "popular",
    "latest",
    "trending",
    "items",
    "manga",
    "mangas",
    "comics",
    "series",
    "chapters",
    "pages",
    "images",
    "list",
    "data.items",
    "data.popular",
    "data.latest",
    "data.manga",
    "data.chapters",
    "response.items",
    "response.data",
  ];

  for (const candidate of candidates) {
    const val = extractValueByPath(json, candidate);
    if (Array.isArray(val)) {
      return val;
    }
  }

  // Fallback: check all object keys for first array
  if (json && typeof json === "object") {
    for (const key of Object.keys(json)) {
      if (Array.isArray(json[key])) {
        return json[key];
      }
    }
  }

  return [];
}

export interface SuggestedFieldMapping {
  field: string;
  suggestedPath: string;
  confidence: number;
  sampleValue: any;
}

/**
 * Inspects a raw JSON response and suggests field mappings based on heuristic key matching
 */
export function inspectAndSuggestMappings(
  sampleJson: any,
  entityType: "MANGA" | "CHAPTER" | "PAGE" = "MANGA"
): {
  primaryArrayPath: string;
  sampleItem: any;
  suggestions: SuggestedFieldMapping[];
} {
  const primaryArray = findPrimaryArray(sampleJson);
  const sampleItem = primaryArray.length > 0 ? primaryArray[0] : sampleJson;

  let primaryArrayPath = "$";
  if (Array.isArray(sampleJson)) {
    primaryArrayPath = "$[*]";
  } else if (sampleJson && typeof sampleJson === "object") {
    for (const key of Object.keys(sampleJson)) {
      if (Array.isArray(sampleJson[key])) {
        primaryArrayPath = `$.${key}[*]`;
        break;
      }
    }
  }

  // Heuristic patterns for auto-detection
  const patterns: Record<string, Record<string, string[]>> = {
    MANGA: {
      id: ["id", "comic_id", "manga_id", "slug", "_id", "comicId", "mangaId", "series_id"],
      title: ["title", "name", "title.en", "attributes.title.en", "romaji", "main_title", "comic_title", "manga_title", "series_title"],
      alternative_titles: ["alt_titles", "alternative_titles", "aliases", "synonyms", "other_names", "altTitles"],
      description: ["description", "synopsis", "summary", "description.en", "attributes.description.en", "overview", "desc", "details"],
      cover_url: ["img", "cover", "cover_url", "image", "image_url", "thumbnail", "poster", "poster_url", "thumb", "coverImage", "picture", "banner", "attributes.cover_url", "cover_image"],
      author: ["author", "author.name", "authors", "creator", "writer"],
      artist: ["artist", "artist.name", "illustrator", "draw"],
      status: ["status", "publication_status", "pub_status", "attributes.status", "state"],
      release_year: ["year", "release_year", "released", "start_year", "published_year", "releaseDate"],
      genres: ["genres", "genre", "tags", "categories", "category", "genre_list"],
      content_type: ["type", "content_type", "format", "comic_type"],
      rating: ["rating", "score", "average_rating", "vote_average", "stars"],
      language: ["language", "lang", "original_language"],
    },
    CHAPTER: {
      id: ["id", "chapter_id", "_id", "slug", "chapterId"],
      chapter_number: ["chapter", "chapter_number", "number", "num", "ch", "attributes.chapter", "chapterNum"],
      chapter_title: ["title", "chapter_title", "name", "chapter_name", "attributes.title"],
      volume: ["volume", "vol", "attributes.volume"],
      language: ["language", "lang", "translatedLanguage"],
      release_date: ["release_date", "published_at", "created_at", "createdAt", "date", "updated_at", "pub_date"],
      pages: ["pages", "images", "page_count", "total_pages"],
    },
    PAGE: {
      page_number: ["page", "page_number", "index", "order", "page_num"],
      image_url: ["url", "image", "image_url", "img", "src", "link", "page_url"],
    },
  };

  const targetEntityPatterns = patterns[entityType] || patterns.MANGA;
  const suggestions: SuggestedFieldMapping[] = [];

  function findKeyInItem(obj: any, keys: string[], prefix = ""): { path: string; value: any } | null {
    if (!obj || typeof obj !== "object") return null;

    // 1. Exact or dot-nested match
    for (const k of keys) {
      if (k.includes(".")) {
        const val = extractValueByPath(obj, k);
        if (val !== undefined) {
          return { path: prefix ? `${prefix}.${k}` : k, value: val };
        }
      } else if (k in obj && obj[k] !== undefined && obj[k] !== null) {
        return { path: prefix ? `${prefix}.${k}` : k, value: obj[k] };
      }
    }

    // 2. Case-insensitive key match
    const objKeys = Object.keys(obj);
    for (const k of keys) {
      if (!k.includes(".")) {
        const found = objKeys.find((actual) => actual.toLowerCase() === k.toLowerCase());
        if (found && obj[found] !== undefined && obj[found] !== null) {
          return { path: prefix ? `${prefix}.${found}` : found, value: obj[found] };
        }
      }
    }

    // 3. Shallow recursion into attributes / data object if present
    if (obj.attributes && typeof obj.attributes === "object") {
      const nested = findKeyInItem(obj.attributes, keys, prefix ? `${prefix}.attributes` : "attributes");
      if (nested) return nested;
    }
    if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
      const nested = findKeyInItem(obj.data, keys, prefix ? `${prefix}.data` : "data");
      if (nested) return nested;
    }

    return null;
  }

  for (const [field, candidateKeys] of Object.entries(targetEntityPatterns)) {
    const match = findKeyInItem(sampleItem, candidateKeys);
    if (match) {
      suggestions.push({
        field,
        suggestedPath: match.path,
        confidence: 0.9,
        sampleValue: match.value,
      });
    }
  }

  return {
    primaryArrayPath,
    sampleItem,
    suggestions,
  };
}
