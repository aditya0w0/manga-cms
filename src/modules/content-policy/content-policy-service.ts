import { getPrisma } from "@/lib/database/prisma";
import { PublicationStatus } from "@prisma/client";
import { WdTaggerService, WdClassificationResult } from "./wd-tagger-service";

/**
 * Global Content Exclusion Policy: Prohibited Core Categories
 * These 11 core categories are strictly mandatory and enabled globally across the platform.
 */
export interface BannedCategoryDefinition {
  id: string;
  name: string;
  description: string;
  defaultAliases: string[];
  isCore: boolean;
}

export const CORE_BANNED_CATEGORIES: BannedCategoryDefinition[] = [
  {
    id: "yaoi",
    name: "Yaoi",
    description: "Male-male explicit or romantic focus (Yaoi)",
    defaultAliases: ["yaoi", "801", "danmei"],
    isCore: true,
  },
  {
    id: "bl",
    name: "BL (Boys' Love)",
    description: "Boys' Love content and variants",
    defaultAliases: ["bl", "boys love", "boy's love", "boys' love", "boyslove"],
    isCore: true,
  },
  {
    id: "shounen_ai",
    name: "Shounen Ai",
    description: "Male-male romance (Shounen Ai)",
    defaultAliases: ["shounen ai", "shounen-ai", "shonen ai", "shonen-ai"],
    isCore: true,
  },
  {
    id: "yuri",
    name: "Yuri",
    description: "Female-female explicit or romantic focus (Yuri)",
    defaultAliases: ["yuri", "baihe"],
    isCore: true,
  },
  {
    id: "gl",
    name: "GL (Girls' Love)",
    description: "Girls' Love content and variants",
    defaultAliases: ["gl", "girls love", "girl's love", "girls' love", "girlslove"],
    isCore: true,
  },
  {
    id: "shoujo_ai",
    name: "Shoujo Ai",
    description: "Female-female romance (Shoujo Ai)",
    defaultAliases: ["shoujo ai", "shoujo-ai", "shojo ai", "shojo-ai"],
    isCore: true,
  },
  {
    id: "smut",
    name: "Smut",
    description: "Smut and sexually graphic manga",
    defaultAliases: ["smut", "smutty", "adult smut"],
    isCore: true,
  },
  {
    id: "explicit_sexual_content",
    name: "Explicit Sexual Content",
    description: "Explicit, 18+, adult, or NSFW classified content",
    defaultAliases: ["explicit sexual content", "explicit content", "explicit", "nsfw", "adult content", "r18", "r-18", "18+"],
    isCore: true,
  },
  {
    id: "erotica",
    name: "Erotica",
    description: "Erotica and sexually suggestive depictions",
    defaultAliases: ["erotica", "erotic"],
    isCore: true,
  },
  {
    id: "hentai",
    name: "Hentai",
    description: "Pornographic anime/manga (Hentai)",
    defaultAliases: ["hentai", "doujinshi hentai"],
    isCore: true,
  },
  {
    id: "pornographic_content",
    name: "Pornographic Content",
    description: "Hardcore pornography and sexually explicit works",
    defaultAliases: ["pornographic content", "pornographic", "pornography", "porn", "hardcore"],
    isCore: true,
  },
];

export type UnknownGenreAction = "QUARANTINE" | "REJECT" | "ALLOW";

export interface ContentPolicyConfig {
  unknownGenrePolicy: UnknownGenreAction;
  customAliases: string[];
  providerMappings: Record<string, Record<string, string>>; // providerId -> { externalTagId: standardCategory }
}

const DEFAULT_CONFIG: ContentPolicyConfig = {
  unknownGenrePolicy: "QUARANTINE",
  customAliases: [],
  providerMappings: {
    // Standard MangaDex / AniList UUIDs and common provider IDs
    mangadex: {
      "5920b825-41dd-4264-826c-76d61630c53b": "BL (Boys' Love)", // Boys' Love
      "a3c67850-4684-40e0-ac5f-301663476496": "GL (Girls' Love)", // Girls' Love
      "b13b2a48-c720-44a9-9c77-39c9979373fb": "Pornographic Content", // Pornographic
      "97893a4c-12af-4dac-b6be-0d0d376120ea": "Erotica", // Erotica
    },
  },
};

export interface MangaContentInput {
  title?: string;
  alternativeTitles?: string[] | any;
  description?: string;
  genres?: string[] | any[];
  tags?: string[] | any[];
  rawMetadata?: any;
  providerId?: string;
  coverUrl?: string;
}

export interface PolicyViolation {
  category: string;
  matchedTerm: string;
  sourceField: string;
}

export interface ContentPolicyCheckResult {
  allowed: boolean;
  action: "ALLOW" | "REJECT" | "QUARANTINE";
  reason?: string;
  violations: PolicyViolation[];
  visualClassification?: WdClassificationResult;
  hitlRequired?: boolean;
}

export class ContentPolicyService {
  private static cachedConfig: ContentPolicyConfig | null = null;
  private static lastConfigFetch = 0;
  private static CACHE_TTL_MS = 60_000; // 1 minute cache

  /**
   * Normalizes a text string: Unicode NFKD, lowercased, trimmed, whitespace collapsed
   */
  public static normalizeText(str: string): string {
    if (!str) return "";
    return str
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^\w\s-]/g, " ") // replace special punctuation with space
      .replace(/[\s_-]+/g, " ")
      .trim();
  }

  /**
   * Fetches the dynamic policy configuration from SiteSetting or defaults
   */
  public static async getConfig(): Promise<ContentPolicyConfig> {
    const now = Date.now();
    if (this.cachedConfig && now - this.lastConfigFetch < this.CACHE_TTL_MS) {
      return this.cachedConfig;
    }

    try {
      const db = await getPrisma();
      const setting = await db.siteSetting.findUnique({
        where: { key: "content_policy_settings" },
      });

      if (setting && setting.value) {
        const parsed = JSON.parse(setting.value);
        this.cachedConfig = {
          unknownGenrePolicy: parsed.unknownGenrePolicy || DEFAULT_CONFIG.unknownGenrePolicy,
          customAliases: Array.isArray(parsed.customAliases) ? parsed.customAliases : [],
          providerMappings: parsed.providerMappings || DEFAULT_CONFIG.providerMappings,
        };
      } else {
        this.cachedConfig = { ...DEFAULT_CONFIG };
      }
    } catch {
      this.cachedConfig = { ...DEFAULT_CONFIG };
    }

    this.lastConfigFetch = now;
    return this.cachedConfig;
  }

  /**
   * Saves policy configuration to SiteSetting
   */
  public static async updateConfig(newConfig: Partial<ContentPolicyConfig>): Promise<ContentPolicyConfig> {
    const current = await this.getConfig();
    const updated: ContentPolicyConfig = {
      unknownGenrePolicy: newConfig.unknownGenrePolicy || current.unknownGenrePolicy,
      customAliases: newConfig.customAliases !== undefined ? newConfig.customAliases : current.customAliases,
      providerMappings: newConfig.providerMappings || current.providerMappings,
    };

    const db = await getPrisma();
    await db.siteSetting.upsert({
      where: { key: "content_policy_settings" },
      create: {
        key: "content_policy_settings",
        value: JSON.stringify(updated),
        description: "Global Content Exclusion Policy Configuration",
      },
      update: {
        value: JSON.stringify(updated),
      },
    });

    this.cachedConfig = updated;
    this.lastConfigFetch = Date.now();
    return updated;
  }

  /**
   * Checks if a single string token or phrase matches a prohibited term with strict word boundaries
   */
  public static matchesProhibitedTerm(textToTest: string, prohibitedTerm: string): boolean {
    const normalizedText = this.normalizeText(textToTest);
    const normalizedTerm = this.normalizeText(prohibitedTerm);

    if (!normalizedText || !normalizedTerm) return false;

    // 1. Exact match
    if (normalizedText === normalizedTerm) {
      return true;
    }

    // 2. Strict word boundary match (to avoid false positives like "boy" matching "BL" or "glass" matching "GL")
    // If term is short (e.g. "bl", "gl"), require exact token or word boundaries
    const escapedTerm = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(^|\\s)${escapedTerm}(\\s|$)`, "i");

    return regex.test(normalizedText);
  }

  /**
   * Evaluates any incoming Manga record against the global content policy.
   * Checks genres, tags, titles, explicit flags, and provider-specific metadata.
   */
  public static async evaluateMangaContent(
    input: MangaContentInput,
    overrideConfig?: ContentPolicyConfig
  ): Promise<ContentPolicyCheckResult> {
    const config = overrideConfig || (await this.getConfig());
    const violations: PolicyViolation[] = [];

    // Collect all active banned terms and their categories
    const categoryChecks: Array<{ category: string; terms: string[] }> = CORE_BANNED_CATEGORIES.map((cat) => ({
      category: cat.name,
      terms: [...cat.defaultAliases],
    }));

    // Add any custom global aliases configured by admin
    if (config.customAliases && config.customAliases.length > 0) {
      categoryChecks.push({
        category: "Custom Prohibited Keywords",
        terms: config.customAliases,
      });
    }

    // Helper: test a list of string values from a source field
    const testValues = (values: string[], sourceField: string) => {
      for (const val of values) {
        if (!val) continue;

        // Check against provider-specific ID/tag mappings if providerId supplied
        if (input.providerId && config.providerMappings[input.providerId]) {
          const mappedCategory = config.providerMappings[input.providerId][val];
          if (mappedCategory) {
            violations.push({
              category: mappedCategory,
              matchedTerm: val,
              sourceField: `${sourceField} (Provider Mapping)`,
            });
            continue;
          }
        }

        // Test against core categories and aliases
        for (const check of categoryChecks) {
          for (const term of check.terms) {
            if (this.matchesProhibitedTerm(val, term)) {
              violations.push({
                category: check.category,
                matchedTerm: val,
                sourceField,
              });
              break; // Don't duplicate violations for the same value
            }
          }
        }
      }
    };

    // 1. Normalize genres
    const genreStrings: string[] = [];
    if (Array.isArray(input.genres)) {
      for (const g of input.genres) {
        if (typeof g === "string") {
          genreStrings.push(g);
        } else if (g && typeof g === "object") {
          if (g.name) genreStrings.push(String(g.name));
          if (g.slug) genreStrings.push(String(g.slug));
          if (g.genre && typeof g.genre === "object") {
            if (g.genre.name) genreStrings.push(String(g.genre.name));
            if (g.genre.slug) genreStrings.push(String(g.genre.slug));
          }
        }
      }
    }
    testValues(genreStrings, "genres");

    // 2. Normalize tags
    const tagStrings: string[] = [];
    if (Array.isArray(input.tags)) {
      for (const t of input.tags) {
        if (typeof t === "string") {
          tagStrings.push(t);
        } else if (t && typeof t === "object") {
          if (t.name) tagStrings.push(String(t.name));
          if (t.id) tagStrings.push(String(t.id));
          if (t.attributes?.name?.en) tagStrings.push(String(t.attributes.name.en));
        }
      }
    }
    testValues(tagStrings, "tags");

    // 3. Alternative titles
    const altTitles: string[] = [];
    if (Array.isArray(input.alternativeTitles)) {
      for (const at of input.alternativeTitles) {
        if (typeof at === "string") altTitles.push(at);
        else if (at && typeof at === "object" && at.title) altTitles.push(String(at.title));
      }
    }
    testValues(altTitles, "alternativeTitles");

    // 4. Explicit rating and classification fields
    if (input.rawMetadata && typeof input.rawMetadata === "object") {
      const raw = input.rawMetadata;
      const contentRating = String(raw.contentRating || raw.content_rating || raw.rating || "").toLowerCase();
      const isAdult = raw.isAdult === true || raw.is_adult === true || raw.adult === true;
      const isNsfw = raw.isNsfw === true || raw.is_nsfw === true || raw.nsfw === true;
      const ageRating = Number(raw.ageRating || raw.age_rating || 0);

      if (
        contentRating.includes("erotica") ||
        contentRating.includes("pornographic") ||
        contentRating.includes("hentai") ||
        contentRating.includes("r18")
      ) {
        violations.push({
          category: "Explicit Sexual Content",
          matchedTerm: `contentRating: ${contentRating}`,
          sourceField: "rawMetadata.contentRating",
        });
      }

      if (isAdult || isNsfw || ageRating >= 18) {
        violations.push({
          category: "Explicit Sexual Content",
          matchedTerm: isAdult ? "isAdult: true" : isNsfw ? "isNsfw: true" : `ageRating: ${ageRating}`,
          sourceField: "rawMetadata.classification",
        });
      }

      // Check raw tags array if present in metadata
      if (Array.isArray(raw.tags)) {
        const rawTagNames = raw.tags
          .map((item: any) => (typeof item === "string" ? item : item?.attributes?.name?.en || item?.name || item?.id))
          .filter(Boolean);
        testValues(rawTagNames, "rawMetadata.tags");
      }
    }

    // 5. Visual AI Evaluation using WD Tagger (RTX 4070 pass-through)
    // Acts as an observational signal that feeds Human In The Loop quarantine rather than automated bans
    let visualClassification: WdClassificationResult | undefined;
    let hitlRequired = false;

    if (input.coverUrl) {
      try {
        visualClassification = await WdTaggerService.classifyImage(input.coverUrl);

        if (
          visualClassification.recommendation === "QUARANTINE_HITL" ||
          visualClassification.hitlRequired ||
          visualClassification.matchedViolations.length > 0
        ) {
          hitlRequired = true;
        }
      } catch (tagErr) {
        console.warn("WD Tagger evaluation warning:", tagErr);
      }
    }

    // Decision Logic:
    // If ANY definitive metadata violation is found in title, genre, or provider metadata -> STRICT REJECTION
    if (violations.length > 0) {
      const uniqueCategories = Array.from(new Set(violations.map((v) => v.category)));
      const reason = `Contains prohibited content: [${uniqueCategories.join(", ")}] (matched: "${violations[0].matchedTerm}" in ${violations[0].sourceField})`;

      return {
        allowed: false,
        action: "REJECT",
        reason,
        violations,
        visualClassification,
        hitlRequired: false,
      };
    }

    // If WD Tagger flagged artwork via visual signal -> Human In The Loop quarantine to prevent false flag!
    if (hitlRequired && visualClassification) {
      return {
        allowed: true,
        action: "QUARANTINE",
        reason: visualClassification.reason || "Artwork flagged by Visual AI classifier. Quarantined for Human In The Loop review.",
        violations: [],
        visualClassification,
        hitlRequired: true,
      };
    }

    // Check for missing or uninterpretable genre metadata
    const hasGenres = genreStrings.length > 0;
    const hasTags = tagStrings.length > 0;

    if (!hasGenres && !hasTags) {
      if (config.unknownGenrePolicy === "REJECT") {
        return {
          allowed: false,
          action: "REJECT",
          reason: "Missing genre metadata. Policy requires rejection of unclassified content.",
          violations: [],
        };
      } else if (config.unknownGenrePolicy === "QUARANTINE") {
        return {
          allowed: true, // allowed into system only under quarantine status
          action: "QUARANTINE",
          reason: "Missing genre metadata. Quarantined for administrator review.",
          violations: [],
        };
      }
    }

    return {
      allowed: true,
      action: "ALLOW",
      violations: [],
    };
  }

  /**
   * Database Audit & Cleanup Engine
   * Scans existing Manga records against the prohibited policy and quarantines or archives violations.
   */
  public static async runDatabaseAuditAndCleanup(options: {
    action?: "ARCHIVE" | "QUARANTINE" | "DELETE" | "DRY_RUN";
    limit?: number;
  } = {}) {
    const db = await getPrisma();
    const config = await this.getConfig();
    const action = options.action || "ARCHIVE";

    const allManga = await db.manga.findMany({
      include: {
        genres: {
          include: { genre: true },
        },
      },
      take: options.limit || 5000,
    });

    let scannedCount = 0;
    let violationCount = 0;
    let updatedCount = 0;
    const details: Array<{
      mangaId: string;
      title: string;
      slug: string;
      violations: PolicyViolation[];
      actionTaken: string;
    }> = [];

    for (const manga of allManga) {
      scannedCount++;
      const genresList = manga.genres.map((mg) => mg.genre.name);

      const check = await this.evaluateMangaContent(
        {
          title: manga.title,
          alternativeTitles: manga.alternativeTitles,
          description: manga.description || undefined,
          genres: genresList,
          rawMetadata: manga.rawMetadata,
          coverUrl: manga.coverUrl || undefined,
        },
        config
      );

      if (!check.allowed || check.action === "REJECT") {
        violationCount++;
        let actionTaken = "DETECTED_VIOLATION";

        if (action === "ARCHIVE") {
          await db.manga.update({
            where: { id: manga.id },
            data: { publicationStatus: PublicationStatus.ARCHIVED },
          });
          actionTaken = "ARCHIVED";
          updatedCount++;
        } else if (action === "QUARANTINE") {
          await db.manga.update({
            where: { id: manga.id },
            data: { publicationStatus: PublicationStatus.PENDING_REVIEW },
          });
          actionTaken = "QUARANTINED";
          updatedCount++;
        } else if (action === "DELETE") {
          await db.manga.delete({ where: { id: manga.id } });
          actionTaken = "DELETED";
          updatedCount++;
        }

        // Record in AuditLog
        await db.auditLog.create({
          data: {
            action: `CONTENT_POLICY_${actionTaken}`,
            entityType: "Manga",
            entityId: manga.id,
            details: {
              title: manga.title,
              slug: manga.slug,
              violations: check.violations,
              reason: check.reason,
            } as any,
          },
        });

        details.push({
          mangaId: manga.id,
          title: manga.title,
          slug: manga.slug,
          violations: check.violations,
          actionTaken,
        });
      }
    }

    return {
      scannedCount,
      violationCount,
      updatedCount,
      actionApplied: action,
      details,
    };
  }
}

export default ContentPolicyService;
