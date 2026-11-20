import { describe, it, expect } from "vitest";
import { ContentPolicyService } from "@/modules/content-policy/content-policy-service";

describe("Global Content Exclusion Policy : Unit Tests", () => {
  it("rejects exact prohibited genre names", async () => {
    const prohibited = [
      "Yaoi",
      "BL (Boys' Love)",
      "BL",
      "Shounen Ai",
      "Yuri",
      "GL (Girls' Love)",
      "GL",
      "Shoujo Ai",
      "Smut",
      "Explicit Sexual Content",
      "Erotica",
      "Hentai",
      "Pornographic Content",
    ];

    for (const genre of prohibited) {
      const result = await ContentPolicyService.evaluateMangaContent({
        title: "Test Manga Title",
        genres: [genre],
      });
      expect(result.allowed).toBe(false);
      expect(result.action).toBe("REJECT");
      expect(result.violations.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("rejects case variations of prohibited genres", async () => {
    const variations = ["yaoi", "bL", "ShOuNeN aI", "yUrI", "gl", "sMuT", "eRoTiCa", "hEnTaI", "pOrNoGrApHiC"];

    for (const genre of variations) {
      const result = await ContentPolicyService.evaluateMangaContent({
        title: "Case Variation Test",
        genres: [genre],
      });
      expect(result.allowed).toBe(false);
      expect(result.action).toBe("REJECT");
    }
  });

  it("rejects common aliases (Boys' Love, Girls' Love, Danmei, Baihe)", async () => {
    const aliases = ["Boys Love", "Boy's Love", "Boys' Love", "Girls Love", "Girl's Love", "Danmei", "Baihe", "Shonen-Ai", "Shoujo-Ai"];

    for (const alias of aliases) {
      const result = await ContentPolicyService.evaluateMangaContent({
        title: "Alias Test Title",
        genres: [alias],
      });
      expect(result.allowed).toBe(false);
      expect(result.action).toBe("REJECT");
    }
  });

  it("does NOT produce false positives on benign words containing partial tokens (boy, glass, global)", async () => {
    const safeGenres = ["Boys Adventure", "Schoolboy Life", "Glass Artisan", "Global Conquest", "Gladiator Arena", "Blade Master"];

    for (const genre of safeGenres) {
      const result = await ContentPolicyService.evaluateMangaContent({
        title: `Safe Manga ${genre}`,
        genres: [genre],
      });
      expect(result.allowed).toBe(true);
      expect(result.action).toBe("ALLOW");
      expect(result.violations).toHaveLength(0);
    }
  });

  it("rejects titles with multiple genres where only ONE is prohibited", async () => {
    const result = await ContentPolicyService.evaluateMangaContent({
      title: "Heroic Chronicles",
      genres: ["Action", "Fantasy", "Adventure", "Comedy", "Smut", "Isekai"],
    });

    expect(result.allowed).toBe(false);
    expect(result.action).toBe("REJECT");
    expect(result.violations[0].matchedTerm).toBe("Smut");
  });

  it("detects prohibited content in alternative titles", async () => {
    const result = await ContentPolicyService.evaluateMangaContent({
      title: "My Roommate",
      alternativeTitles: ["My Innocent Roommate", "Dangerous Roommate (BL)"],
      genres: ["Slice of Life", "Romance"],
    });

    expect(result.allowed).toBe(false);
    expect(result.action).toBe("REJECT");
    expect(result.violations[0].sourceField).toBe("alternativeTitles");
  });

  it("detects explicit content classification in raw metadata (NSFW, R18, Erotica)", async () => {
    const resultNsfw = await ContentPolicyService.evaluateMangaContent({
      title: "Secret Garden",
      genres: ["Romance"],
      rawMetadata: { isNsfw: true },
    });
    expect(resultNsfw.allowed).toBe(false);
    expect(resultNsfw.action).toBe("REJECT");

    const resultErotica = await ContentPolicyService.evaluateMangaContent({
      title: "Midnight Tale",
      genres: ["Drama"],
      rawMetadata: { contentRating: "erotica" },
    });
    expect(resultErotica.allowed).toBe(false);
    expect(resultErotica.action).toBe("REJECT");
  });

  it("resolves nested genre structures and objects", async () => {
    const result = await ContentPolicyService.evaluateMangaContent({
      title: "Nested Structure Test",
      genres: [
        { id: "g1", name: "Action" },
        { id: "g2", genre: { name: "Yaoi", slug: "yaoi" } },
      ],
    });

    expect(result.allowed).toBe(false);
    expect(result.action).toBe("REJECT");
  });

  it("quarantines content when genre metadata is missing under QUARANTINE policy", async () => {
    const result = await ContentPolicyService.evaluateMangaContent(
      {
        title: "Unclassified Mystery Manga",
        genres: [],
        tags: [],
      },
      {
        unknownGenrePolicy: "QUARANTINE",
        customAliases: [],
        providerMappings: {},
      }
    );

    expect(result.allowed).toBe(true);
    expect(result.action).toBe("QUARANTINE");
    expect(result.reason).toContain("Quarantined for administrator review");
  });

  it("rejects content when genre metadata is missing under REJECT policy", async () => {
    const result = await ContentPolicyService.evaluateMangaContent(
      {
        title: "Strict Rejection Mystery Manga",
        genres: [],
        tags: [],
      },
      {
        unknownGenrePolicy: "REJECT",
        customAliases: [],
        providerMappings: {},
      }
    );

    expect(result.allowed).toBe(false);
    expect(result.action).toBe("REJECT");
    expect(result.reason).toContain("Missing genre metadata");
  });

  it("resolves provider-specific tag mappings", async () => {
    const customConfig = {
      unknownGenrePolicy: "QUARANTINE" as const,
      customAliases: [],
      providerMappings: {
        mangadex_custom: {
          "uuid-tag-bl-99": "BL (Boys' Love)",
        },
      },
    };

    const result = await ContentPolicyService.evaluateMangaContent(
      {
        title: "External Provider Series",
        providerId: "mangadex_custom",
        tags: ["uuid-tag-bl-99"],
      },
      customConfig
    );

    expect(result.allowed).toBe(false);
    expect(result.action).toBe("REJECT");
    expect(result.violations[0].category).toBe("BL (Boys' Love)");
  });
});
