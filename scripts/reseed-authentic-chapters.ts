import { getPrisma } from "../src/lib/database/prisma";
import fs from "fs";

async function main() {
  console.log("Starting Authentic Chapter Seeding (Purging Kamen Rider & Matching Scans to Titles)...");
  const db = await getPrisma();

  const realData = JSON.parse(fs.readFileSync("scripts/real_chapters_data.json", "utf-8"));
  const manhwaTemplates = JSON.parse(fs.readFileSync("scripts/manhwa_templates.json", "utf-8"));

  // Template sets:
  // 0: Solo Leveling (Hash: d7c641b2fb62b1cd6c77ac381183b40d)
  // 1: Omniscient Reader (Hash: b58db801d897b6647becdc653dcb7c75)
  // 2: Returner Magic Action (Hash: ee1392d95e3ae5a5cb506d30101bc310)
  // 3: Villains Destined to Die Romance/Otome (Hash: fe97370840dca461340674296e0a8289)
  const romanceManhwaTemplate = manhwaTemplates.find((t: any) => t.hash === "fe97370840dca461340674296e0a8289") || manhwaTemplates[3];
  const actionManhwaTemplate = manhwaTemplates.find((t: any) => t.hash === "ee1392d95e3ae5a5cb506d30101bc310") || manhwaTemplates[2];
  const fantasyManhwaTemplate = manhwaTemplates.find((t: any) => t.hash === "b58db801d897b6647becdc653dcb7c75") || manhwaTemplates[1];

  // 1. Wipe all old chapter pages to eliminate any remnants of Kamen Rider and mismatched templates
  console.log("Purging all previous chapter pages...");
  await db.chapterPage.deleteMany({});
  console.log("Previous chapter pages purged.");

  const allManga = await db.manga.findMany({
    include: {
      chapters: {
        orderBy: { chapterNumber: "asc" },
      },
      genres: {
        include: { genre: true },
      },
    },
  });

  console.log(`Processing ${allManga.length} series...`);

  let totalPagesInserted = 0;

  for (const m of allManga) {
    const isShowcase = Boolean(realData[m.slug]);
    const seriesChapters = m.chapters;
    if (seriesChapters.length === 0) continue;

    console.log(`Seeding "${m.title}" (${m.slug}) - ${seriesChapters.length} chapters...`);

    const pagesToInsert: { chapterId: string; pageNumber: number; imageUrl: string }[] = [];

    if (isShowcase) {
      // Use REAL, authentic chapters for showcase manga
      const authenticList = realData[m.slug]; // array of real chapters
      for (const ch of seriesChapters) {
        // Pick exact chapter if available, or cycle through authentic chapters of this manga
        const matchIdx = (ch.chapterNumber - 1) % authenticList.length;
        const realCh = authenticList[matchIdx];
        const hash = realCh.hash;
        const files = realCh.files;

        // Take up to 25 pages per chapter for fast reading performance
        const pageFiles = files.slice(0, 25);
        for (let pIdx = 0; pIdx < pageFiles.length; pIdx++) {
          pagesToInsert.push({
            chapterId: ch.id,
            pageNumber: pIdx + 1,
            imageUrl: `https://uploads.mangadex.org/data/${hash}/${pageFiles[pIdx]}`,
          });
        }
      }
    } else {
      // General catalog (Comix API manhwa / titles)
      // Determine theme: Romance / Otome / Drama vs Action / Fantasy
      const titleLower = m.title.toLowerCase();
      const genreSlugs = m.genres.map((g) => g.genre.slug.toLowerCase());
      const isRomanceOrOtome =
        genreSlugs.includes("romance") ||
        genreSlugs.includes("drama") ||
        titleLower.includes("married") ||
        titleLower.includes("husband") ||
        titleLower.includes("wife") ||
        titleLower.includes("emperor") ||
        titleLower.includes("villainess") ||
        titleLower.includes("possession") ||
        titleLower.includes("favorite");

      let chosenTemplate = isRomanceOrOtome ? romanceManhwaTemplate : actionManhwaTemplate;
      if (!isRomanceOrOtome && (titleLower.includes("necromancer") || titleLower.includes("shadow") || titleLower.includes("level"))) {
        chosenTemplate = fantasyManhwaTemplate;
      }

      const hash = chosenTemplate.hash;
      const files = chosenTemplate.files;

      for (const ch of seriesChapters) {
        for (let pIdx = 0; pIdx < files.length; pIdx++) {
          pagesToInsert.push({
            chapterId: ch.id,
            pageNumber: pIdx + 1,
            imageUrl: `https://uploads.mangadex.org/data/${hash}/${files[pIdx]}`,
          });
        }
      }
    }

    // Insert in batches of 500 to optimize PGlite performance
    const BATCH_SIZE = 500;
    for (let i = 0; i < pagesToInsert.length; i += BATCH_SIZE) {
      const batch = pagesToInsert.slice(i, i + BATCH_SIZE);
      await db.chapterPage.createMany({ data: batch });
    }

    totalPagesInserted += pagesToInsert.length;
  }

  console.log(`Success! Inserted ${totalPagesInserted} authentic, theme-matched chapter pages across all series.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Reseed failed:", err);
  process.exit(1);
});
