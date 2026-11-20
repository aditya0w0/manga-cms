import React from "react";
import { notFound } from "next/navigation";
import { getChapterWithPages } from "@/modules/chapters/chapter-service";
import { MangaReader } from "@/components/reader/MangaReader";

export const dynamic = "force-dynamic";

export default async function ChapterReaderPage({
  params,
}: {
  params: { chapterId: string };
}) {
  const chapter = await getChapterWithPages(params.chapterId);
  if (!chapter) {
    notFound();
  }

  return <MangaReader chapter={chapter as any} />;
}
