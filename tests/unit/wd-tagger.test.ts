import { describe, it, expect } from "vitest";
import {
  WdTaggerService,
  WD_TAG_TO_CATEGORY,
  DEFAULT_WD_CONFIG,
} from "@/modules/content-policy/wd-tagger-service";

describe("WaifuDiffusion Tagger & HITL Decision Engine : Unit Tests", () => {
  it("maps WaifuDiffusion anime tags to platform exclusion categories accurately", () => {
    // Yaoi & BL tags
    expect(WD_TAG_TO_CATEGORY["yaoi"]).toBe("Yaoi");
    expect(WD_TAG_TO_CATEGORY["boys_love"]).toBe("BL (Boys' Love)");
    expect(WD_TAG_TO_CATEGORY["shounen_ai"]).toBe("Shounen Ai");
    expect(WD_TAG_TO_CATEGORY["males_only"]).toBe("BL (Boys' Love)");

    // Yuri & GL tags
    expect(WD_TAG_TO_CATEGORY["yuri"]).toBe("Yuri");
    expect(WD_TAG_TO_CATEGORY["girls_love"]).toBe("GL (Girls' Love)");
    expect(WD_TAG_TO_CATEGORY["shoujo_ai"]).toBe("Shoujo Ai");

    // Smut & Explicit
    expect(WD_TAG_TO_CATEGORY["smut"]).toBe("Smut");
    expect(WD_TAG_TO_CATEGORY["intercourse"]).toBe("Explicit Sexual Content");
    expect(WD_TAG_TO_CATEGORY["uncensored"]).toBe("Explicit Sexual Content");
    expect(WD_TAG_TO_CATEGORY["nipples"]).toBe("Explicit Sexual Content");
    expect(WD_TAG_TO_CATEGORY["hentai"]).toBe("Hentai");
  });

  it("evaluates clean, safe manga artwork as ALLOW with zero violation flags", () => {
    const result = WdTaggerService.interpretRawModelOutput(
      "https://example.com/safe_hero.jpg",
      { general: 0.95, sensitive: 0.04, questionable: 0.01, explicit: 0.0 },
      [
        { tag: "1boy", confidence: 0.96 },
        { tag: "sword", confidence: 0.92 },
        { tag: "armor", confidence: 0.88 },
        { tag: "action_pose", confidence: 0.85 },
      ],
      DEFAULT_WD_CONFIG
    );

    expect(result.recommendation).toBe("ALLOW");
    expect(result.hitlRequired).toBe(false);
    expect(result.matchedViolations).toHaveLength(0);
  });

  it("routes borderline tag detection to Human In The Loop quarantine to prevent false flags", () => {
    // For example: two male friends hanging out, tagger predicts boys_love with 0.48 confidence
    const result = WdTaggerService.interpretRawModelOutput(
      "https://example.com/two_buddies.jpg",
      { general: 0.65, sensitive: 0.25, questionable: 0.08, explicit: 0.02 },
      [
        { tag: "2boys", confidence: 0.92 },
        { tag: "school_uniform", confidence: 0.88 },
        { tag: "boys_love", confidence: 0.48 }, // Borderline (between 0.35 and 0.85)
      ],
      DEFAULT_WD_CONFIG
    );

    expect(result.recommendation).toBe("QUARANTINE_HITL");
    expect(result.hitlRequired).toBe(true);
    expect(result.reason).toContain("Human In The Loop");
    expect(result.matchedViolations).toHaveLength(1);
    expect(result.matchedViolations[0].tag).toBe("boys_love");
    expect(result.matchedViolations[0].category).toBe("BL (Boys' Love)");
  });

  it("routes high-confidence prohibited visual flags to Human In The Loop quarantine rather than automated bans", () => {
    const result = WdTaggerService.interpretRawModelOutput(
      "https://example.com/bl_explicit_cover.jpg",
      { general: 0.05, sensitive: 0.15, questionable: 0.70, explicit: 0.10 },
      [
        { tag: "boys_love", confidence: 0.92 }, // High confidence visual signal
        { tag: "yaoi", confidence: 0.88 },
      ],
      DEFAULT_WD_CONFIG
    );

    expect(result.recommendation).toBe("QUARANTINE_HITL");
    expect(result.hitlRequired).toBe(true);
    expect(result.reason).toContain("High-confidence visual flag");
  });

  it("routes high explicit rating to Human In The Loop quarantine rather than automated bans", () => {
    const result = WdTaggerService.interpretRawModelOutput(
      "https://example.com/explicit_nsfw.jpg",
      { general: 0.0, sensitive: 0.05, questionable: 0.05, explicit: 0.90 },
      [{ tag: "smut", confidence: 0.89 }],
      DEFAULT_WD_CONFIG
    );

    expect(result.recommendation).toBe("QUARANTINE_HITL");
    expect(result.hitlRequired).toBe(true);
    expect(result.reason).toContain("Quarantined for Human In The Loop verification");
  });

  it("routes elevated adult rating to Human In The Loop review", () => {
    const result = WdTaggerService.interpretRawModelOutput(
      "https://example.com/borderline_cover.jpg",
      { general: 0.15, sensitive: 0.15, questionable: 0.68, explicit: 0.02 },
      [{ tag: "bikini", confidence: 0.85 }],
      DEFAULT_WD_CONFIG
    );

    expect(result.recommendation).toBe("QUARANTINE_HITL");
    expect(result.hitlRequired).toBe(true);
    expect(result.reason).toContain("Elevated adult artwork rating");
  });

  it("micro-batches parallel classifyImage requests within the wait window", async () => {
    const start = Date.now();
    const urls = [
      "https://example.com/img1.jpg",
      "https://example.com/img2.jpg",
      "https://example.com/img3.jpg",
      "https://example.com/img4.jpg",
    ];

    // Fire 4 parallel requests concurrently
    const promises = urls.map((url) => WdTaggerService.classifyImage(url));
    const results = await Promise.all(promises);

    expect(results).toHaveLength(4);
    for (const r of results) {
      expect(r).toBeDefined();
      expect(r.recommendation).toBeDefined();
    }
    // Micro-batch should complete in under 2000ms
    expect(Date.now() - start).toBeLessThan(2000);
  }, 15000);

  it("returns cached result instantly (0ms) on repeated requests for the same image URL", async () => {
    const testUrl = `https://example.com/repeat_test_${Date.now()}.jpg`;

    // First call (populates cache)
    const res1 = await WdTaggerService.classifyImage(testUrl);
    expect(res1).toBeDefined();

    // Second call (hits LRU cache)
    const t0 = Date.now();
    const res2 = await WdTaggerService.classifyImage(testUrl);
    const duration = Date.now() - t0;

    expect(res2.imageUrl).toBe(testUrl);
    expect(duration).toBeLessThan(15); // near 0ms cache retrieval
  });
});
