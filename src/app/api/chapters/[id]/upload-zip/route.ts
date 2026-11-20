import { NextRequest, NextResponse } from "next/server";
import { processChapterZipUpload } from "@/modules/chapters/chapter-service";
import { requireAdmin } from "@/lib/security/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "ZIP file is required" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".zip")) {
      return NextResponse.json({ error: "Uploaded file must be a .zip archive" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const report = await processChapterZipUpload(params.id, buffer);

    return NextResponse.json({
      success: true,
      message: `Extracted and imported ${report.totalPages} pages successfully`,
      report,
    });
  } catch (err: any) {
    console.error("ZIP chapter upload error:", err);
    return NextResponse.json({ error: err.message || "Failed to process ZIP upload" }, { status: 500 });
  }
}
