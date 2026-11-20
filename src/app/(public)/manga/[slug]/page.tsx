import React from "react";
import { notFound } from "next/navigation";
import { getMangaBySlug } from "@/modules/manga/manga-service";
import { MangaDetailClient } from "./MangaDetailClient";

export const dynamic = "force-dynamic";

export default async function MangaDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const manga = await getMangaBySlug(params.slug);
  if (!manga) {
    notFound();
  }

  return <MangaDetailClient initialManga={manga as any} />;
}
