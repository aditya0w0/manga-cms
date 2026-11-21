import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import { AuthService } from "@/modules/auth/auth-service";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

const SAMPLE_SCHEMATIC_JSON = `{
  "$schema": "https://mangacms.local/schemas/schematic-v1.json",
  "schemaVersion": "1.0",
  "batchId": "batch_archive_4000_sample",
  "sourceMode": "archive",
  "compressionPreset": "auto",
  "autoPublish": true,
  "defaults": {
    "conflictPolicy": "skip_existing",
    "pageSort": "natural",
    "onChapterError": "continue"
  },
  "comics": [
    {
      "slug": "sample-solo-adventure",
      "title": "Sample Solo Adventure",
      "manifestPath": "sample-solo-adventure/manifest.json",
      "createIfMissing": true,
      "enabled": true
    },
    {
      "slug": "sample-epic-odyssey",
      "title": "Sample Epic Odyssey (4,000 Chapters Streaming)",
      "manifestPath": "sample-epic-odyssey/manifest.json",
      "createIfMissing": true,
      "enabled": true
    },
    {
      "slug": "sample-auto-discovery",
      "title": "Sample Auto Discovery Comic",
      "manifestPath": "sample-auto-discovery/manifest.json",
      "createIfMissing": true,
      "enabled": true
    }
  ]
}
`;

const SAMPLE_INLINE_MANIFEST_JSON = `{
  "chaptersMode": "inline",
  "chapters": [
    {
      "chapterKey": "1",
      "displayNumber": "1",
      "title": "Prologue: The Awakening",
      "volume": 1,
      "source": "ch_001.cbz"
    },
    {
      "chapterKey": "2",
      "displayNumber": "2",
      "title": "Chapter 2: The First Trial",
      "volume": 1,
      "source": "ch_002/"
    },
    {
      "chapterKey": "2.5",
      "displayNumber": "2.5",
      "title": "Omake: Behind the Scenes",
      "volume": 1,
      "source": "ch_002_extra/"
    }
  ]
}
`;

const SAMPLE_STREAMING_MANIFEST_JSON = `{
  "chaptersMode": "ndjson",
  "ndjsonPath": "chapters.ndjson"
}
`;

const SAMPLE_CHAPTERS_NDJSON = `{"chapterKey":"1","displayNumber":"1","title":"Dawn of the Adventure","volume":1,"source":"chapters/ch_0001.cbz"}
{"chapterKey":"2","displayNumber":"2","title":"The Straw Hat Guy","volume":1,"source":"chapters/ch_0002.cbz"}
{"chapterKey":"1400","displayNumber":"1400","title":"The High Seas Clash","volume":140,"source":"chapters/ch_1400/"}
{"chapterKey":"1401","displayNumber":"1401","title":"Uncharted Horizons","volume":140,"source":"chapters/ch_1401/"}
{"chapterKey":"4000","displayNumber":"4000","title":"The Grand Finale","volume":400,"source":"chapters/ch_4000/"}
`;

const SAMPLE_AUTO_MANIFEST_JSON = `{
  "chaptersMode": "auto_with_overrides",
  "chapterRegex": "(?:Ch\\\\.?|Chapter)\\\\s*(\\\\d+(?:\\\\.\\\\d+)?)",
  "volumeRegex": "(?:Vol\\\\.?|Volume)\\\\s*(\\\\d+)",
  "overrides": {
    "Ch 00 Special Edition": {
      "displayNumber": "0.5",
      "title": "Special Prequel Episode"
    },
    "Rough Drafts": {
      "skip": true
    }
  }
}
`;

const README_MD = `# MangaCMS Batch Ingestion Schematic Specifications (v1.0)

This archive contains the official template files and folder structure for high-throughput batch ingestion into MangaCMS.

## Architecture Overview

MangaCMS uses a 2-Tier Modular Schematic Architecture:
1. **Tier 1 (Root Orchestration)**: \`schematic.json\` at the root of your archive or directory controls the overall batch, global defaults, and declares each comic.
2. **Tier 2 (Per-Comic Manifest)**: Inside each comic subfolder, a \`manifest.json\` defines the chapter indexing strategy.

## Chapter Modes Supported

1. **Streaming NDJSON Mode (\`chaptersMode: "ndjson"\`)**:
   - Recommended for 500 to 10,000+ chapters across large series.
   - Points to a \`chapters.ndjson\` file with one JSON object per line.
   - Streamed via line-by-line streaming without overloading Node.js memory.

2. **Inline Mode (\`chaptersMode: "inline"\`)**:
   - Best for small or medium releases (under 500 chapters).
   - Chapters are declared directly as a JSON array inside \`manifest.json\`.

3. **Auto-Discovery Mode (\`chaptersMode: "auto_with_overrides"\`)**:
   - Zero chapter list authoring.
   - Chapters and volumes are auto-extracted from folder and archive names via regex.
   - Optional overrides can rename, renumber, or skip specific folders.

## Checkpoint Recovery & Resumability

Each chapter is committed atomically to the database. If an ingestion of 4,000 chapters encounters an error at Chapter 1,401, Chapters 1 through 1,400 remain permanently saved. Resuming the batch will only queue the failed and pending chapters from the failure checkpoint.
`;

export async function GET(req: NextRequest) {
  try {
    await AuthService.requireUser(req, Role.EDITOR);

    const zip = new AdmZip();

    zip.addFile("schematic.json", Buffer.from(SAMPLE_SCHEMATIC_JSON, "utf-8"));
    zip.addFile("sample-solo-adventure/manifest.json", Buffer.from(SAMPLE_INLINE_MANIFEST_JSON, "utf-8"));
    zip.addFile("sample-epic-odyssey/manifest.json", Buffer.from(SAMPLE_STREAMING_MANIFEST_JSON, "utf-8"));
    zip.addFile("sample-epic-odyssey/chapters.ndjson", Buffer.from(SAMPLE_CHAPTERS_NDJSON, "utf-8"));
    zip.addFile("sample-auto-discovery/manifest.json", Buffer.from(SAMPLE_AUTO_MANIFEST_JSON, "utf-8"));
    zip.addFile("README.md", Buffer.from(README_MD, "utf-8"));

    const zipBuffer = zip.toBuffer();

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="mangacms-schematic-templates.zip"',
        "Content-Length": String(zipBuffer.length),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to generate schematic template bundle";
    const status = msg.includes("UNAUTHORIZED") ? 401 : msg.includes("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
