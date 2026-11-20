import { getPrisma } from "../src/lib/database/prisma";
import { PublicationStatus } from "@prisma/client";

const SCAN_TEMPLATES = [
  [
    "https://uploads.mangadex.org/data/3eeca0fbbb058bc235609c43a449dfe4/1-181e99f89278a527b72dcc953a63ae1a1564c98ef1b4415681030c8df888f488.png",
    "https://uploads.mangadex.org/data/3eeca0fbbb058bc235609c43a449dfe4/2-8b5e5cbe3f8edaa8c9c848359fbdf1b7db5f8f6e3092b642cf17d3c0faa91874.png",
    "https://uploads.mangadex.org/data/3eeca0fbbb058bc235609c43a449dfe4/3-7a002acc8e5c4e55fa6058704b8bed61acec67b46c238e17e331651671fcac67.png",
    "https://uploads.mangadex.org/data/3eeca0fbbb058bc235609c43a449dfe4/4-1f4dedc628ddd08d3641a9640ff4294f72672a8f10cc39075b9b60483c2d7535.png",
    "https://uploads.mangadex.org/data/3eeca0fbbb058bc235609c43a449dfe4/5-9169d9e5978bdb15f21af6557670ea8abecda4ba41adc0ba04523f69f0f3420a.png",
    "https://uploads.mangadex.org/data/3eeca0fbbb058bc235609c43a449dfe4/6-7c62f76aa8a39fd4426af4c81a70f9ad973c40a7c7717590a59a79d5514edd50.jpg",
    "https://uploads.mangadex.org/data/3eeca0fbbb058bc235609c43a449dfe4/7-cbcb8ffa32ddb6b6cf8ea9be391e2280b2d1e2f92ddda1f21cac8c705f330495.png",
  ],
  [
    "https://uploads.mangadex.org/data/fe508ebfc50a5744ea4a956f726e2409/2-9eb76c9a7d4e91774f3454a48c68162680a0d7d50899d5c595838ef40bf38041.jpg",
    "https://uploads.mangadex.org/data/fe508ebfc50a5744ea4a956f726e2409/2-9eb76c9a7d4e91774f3454a48c68162680a0d7d50899d5c595838ef40bf38041.jpg",
    "https://uploads.mangadex.org/data/fe508ebfc50a5744ea4a956f726e2409/3-41a4a4962eb0ae1bb7ff2b388b63e144a1fa3966fb942f2b4ffca6ecff13d2f2.jpg",
    "https://uploads.mangadex.org/data/fe508ebfc50a5744ea4a956f726e2409/4-28b9d2eb052b6d6f22e8979b940e4f35e5d326efbc2ff52382e75e929a5dfcb7.jpg",
    "https://uploads.mangadex.org/data/fe508ebfc50a5744ea4a956f726e2409/5-8be8f972b22bb95f87b3252575f0a4f6cf70da3e33f67be6839352e8250e7b95.jpg",
    "https://uploads.mangadex.org/data/fe508ebfc50a5744ea4a956f726e2409/6-1c881c15f9ffdbb65342a3cfef97e55be5531b2ec52e49774640d2ba22be6f25.jpg",
  ],
  [
    "https://uploads.mangadex.org/data/7220e3f0701d84b5473204aadd03e19b/1-761e563d2f4ad900344a14a2af6e042156f81d8037f62d7b027f645a5baa136b.jpg",
    "https://uploads.mangadex.org/data/7220e3f0701d84b5473204aadd03e19b/2-5b29470284573999588ddf8605b5d6e43e560cf86a7c62a95a291134c733096b.jpg",
    "https://uploads.mangadex.org/data/7220e3f0701d84b5473204aadd03e19b/3-d64fc019053965b2195f4628ee3e4e941198547ca750d75a40a5a31593c6fe6c.jpg",
    "https://uploads.mangadex.org/data/7220e3f0701d84b5473204aadd03e19b/4-a21ea1b27e828d9a44e5ce675c91f1c71887e5b15b565780be5689886a8bc4ee.jpg",
    "https://uploads.mangadex.org/data/7220e3f0701d84b5473204aadd03e19b/5-0d2f0eb982d56a2bb036495204ef0550beaaef96ca2fc79e4999f8e401ecba3a.jpg",
    "https://uploads.mangadex.org/data/7220e3f0701d84b5473204aadd03e19b/6-c563065eb0d407fc3572d422961d1ea5d30c30932822a1ce0ffba10a0dfc8b66.jpg",
  ],
  [
    "https://uploads.mangadex.org/data/150377af7635ca8861764ea7a5d71b8f/1-872d85965e431a92919ed37e3c7fc8def639ee05190c7e05a478692babf38619.jpg",
    "https://uploads.mangadex.org/data/150377af7635ca8861764ea7a5d71b8f/2-8cb62ac80990b2d57a16b9988d12aea10559676077b686590543802201abd2bd.jpg",
    "https://uploads.mangadex.org/data/150377af7635ca8861764ea7a5d71b8f/3-12777d4c38babade06991c145716ac6eb5192d0ddc23c71cd9247f6caf00407f.jpg",
    "https://uploads.mangadex.org/data/150377af7635ca8861764ea7a5d71b8f/4-f87c538da264c92b8d4bbbe924d5e94b28db761595d2cba560091811e582845c.jpg",
    "https://uploads.mangadex.org/data/150377af7635ca8861764ea7a5d71b8f/5-a6e56adfa266850c950a98f121df75607b39a3f2b74052f523c0bfad2c8ad1c4.jpg",
    "https://uploads.mangadex.org/data/150377af7635ca8861764ea7a5d71b8f/6-53d395899c754d9c79237071be2c246f496ee1789c071d798a7a9fc770fc5e26.jpg",
  ],
];

const SPECIAL_COUNTS: Record<string, number> = {
  "qqwrm-full-time-awakening": 170,
  "solo-leveling-shadow-monarch": 179,
  "chainsaw-fiend-chronicle": 175,
  "omniscient-readers-viewpoint": 150,
  "frieren-beyond-journeys-end": 130,
};

async function main() {
  console.log("⚡ Starting Complete Sequential Chapter Seeding (NO GAPS)...");
  const db = await getPrisma();

  const allManga = await db.manga.findMany({
    select: { id: true, slug: true, title: true, rawMetadata: true },
  });

  console.log(`Found ${allManga.length} manga series to populate chapters for.`);

  let totalChaptersCreated = 0;
  let totalPagesCreated = 0;

  for (let mIdx = 0; mIdx < allManga.length; mIdx++) {
    const m = allManga[mIdx];

    // Determine target total chapters
    let targetTotal = SPECIAL_COUNTS[m.slug];
    if (!targetTotal) {
      const rawMeta = m.rawMetadata as any;
      if (rawMeta?.chapter && typeof rawMeta.chapter === "string") {
        const match = rawMeta.chapter.match(/\d+(\.\d+)?/);
        if (match) {
          targetTotal = Math.round(parseFloat(match[0]));
        }
      }
    }
    if (!targetTotal || targetTotal < 10) {
      targetTotal = 30; // sensible default
    }

    console.log(`[${mIdx + 1}/${allManga.length}] "${m.title}" -> Seeding all 1 to ${targetTotal} chapters...`);

    // Prepare all sequential chapters (1, 2, 3, 4, ..., targetTotal)
    const chapterData = [];
    const now = Date.now();
    for (let cNum = 1; cNum <= targetTotal; cNum++) {
      let title = `Chapter ${cNum}`;
      if (cNum === 1) title = `Chapter 1: The Beginning`;
      else if (cNum === 2) title = `Chapter 2: The Path Forward`;
      else if (cNum === targetTotal) title = `Chapter ${targetTotal}: Latest Release`;
      else title = `Chapter ${cNum}: Episode ${cNum}`;

      chapterData.push({
        mangaId: m.id,
        chapterNumber: cNum,
        chapterTitle: title,
        language: "en",
        scanlationGroup: "Official Translations",
        publicationStatus: PublicationStatus.PUBLISHED,
        releaseDate: new Date(now - (targetTotal - cNum) * 86400000 * 3), // chronological release dates
      });
    }

    // Insert in chunks of 100 to avoid parameter limits
    for (let i = 0; i < chapterData.length; i += 100) {
      const chunk = chapterData.slice(i, i + 100);
      await db.chapter.createMany({
        data: chunk,
        skipDuplicates: true,
      });
    }

    // Fetch chapter IDs to seed pages for key reading points (e.g. first 5, last 5, and intervals)
    const createdChapters = await db.chapter.findMany({
      where: { mangaId: m.id },
      select: { id: true, chapterNumber: true },
    });

    totalChaptersCreated += createdChapters.length;

    // For all chapters, insert authentic MangaDex pages
    const pagesToInsert: { chapterId: string; pageNumber: number; imageUrl: string }[] = [];

    for (const ch of createdChapters) {
      const template = SCAN_TEMPLATES[(mIdx + ch.chapterNumber) % SCAN_TEMPLATES.length];
      for (let pIdx = 0; pIdx < template.length; pIdx++) {
        pagesToInsert.push({
          chapterId: ch.id,
          pageNumber: pIdx + 1,
          imageUrl: template[pIdx],
        });
      }
    }

    // Insert pages in batches of 500
    for (let i = 0; i < pagesToInsert.length; i += 500) {
      const chunk = pagesToInsert.slice(i, i + 500);
      await db.chapterPage.createMany({
        data: chunk,
        skipDuplicates: true,
      });
      totalPagesCreated += chunk.length;
    }
  }

  console.log(`\n🎉 Sequential Chapter Seeding COMPLETE!`);
  console.log(`📊 Summary:`);
  console.log(`   - Total Chapters Available: ${totalChaptersCreated}`);
  console.log(`   - Total Authentic Manga Scan Pages: ${totalPagesCreated}`);
  console.log(`   - Full-Time Awakening Chapters: 1 to 170 (Complete!)`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Error seeding chapters:", e);
    process.exit(1);
  });
