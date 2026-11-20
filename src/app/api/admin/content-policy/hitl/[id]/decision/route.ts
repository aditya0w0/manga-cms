import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/auth";
import { getPrisma } from "@/lib/database/prisma";
import { PublicationStatus } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminUser = await requireAdmin();
    const body = await req.json();
    const db = await getPrisma();
    const action = body.action; // "APPROVE_CLEAR_FLAG" | "CONFIRM_VIOLATION" | "DELETE"
    const note = body.note || "";

    const manga = await db.manga.findUnique({
      where: { id: params.id },
    });

    if (!manga) {
      return NextResponse.json({ error: "Manga not found" }, { status: 404 });
    }

    const currentMetadata = (manga.rawMetadata as any) || {};

    if (action === "APPROVE_CLEAR_FLAG" || action === "APPROVE") {
      const updatedMetadata = {
        ...currentMetadata,
        falseFlagCleared: true,
        clearedBy: adminUser.username,
        clearedAt: new Date().toISOString(),
        adminNote: note || "False flag cleared by admin after visual inspection",
      };

      await db.manga.update({
        where: { id: params.id },
        data: {
          publicationStatus: PublicationStatus.PUBLISHED,
          rawMetadata: updatedMetadata,
        },
      });

      await db.auditLog.create({
        data: {
          action: "HITL_FALSE_FLAG_CLEARED",
          entityType: "Manga",
          entityId: params.id,
          userId: adminUser.id,
          details: {
            title: manga.title,
            action: "APPROVE_CLEAR_FLAG",
            clearedBy: adminUser.username,
            note,
          },
        },
      });

      return NextResponse.json({
        success: true,
        action: "APPROVE_CLEAR_FLAG",
        mangaId: params.id,
        newStatus: PublicationStatus.PUBLISHED,
      });
    }

    if (action === "CONFIRM_VIOLATION" || action === "ARCHIVE" || action === "REJECT") {
      const updatedMetadata = {
        ...currentMetadata,
        violationConfirmed: true,
        confirmedBy: adminUser.username,
        confirmedAt: new Date().toISOString(),
        adminNote: note || "Violation confirmed by admin after visual inspection",
      };

      await db.manga.update({
        where: { id: params.id },
        data: {
          publicationStatus: PublicationStatus.ARCHIVED,
          rawMetadata: updatedMetadata,
        },
      });

      await db.auditLog.create({
        data: {
          action: "HITL_VIOLATION_CONFIRMED",
          entityType: "Manga",
          entityId: params.id,
          userId: adminUser.id,
          details: {
            title: manga.title,
            action: "CONFIRM_VIOLATION",
            confirmedBy: adminUser.username,
            note,
          },
        },
      });

      return NextResponse.json({
        success: true,
        action: "CONFIRM_VIOLATION",
        mangaId: params.id,
        newStatus: PublicationStatus.ARCHIVED,
      });
    }

    if (action === "DELETE") {
      await db.manga.delete({
        where: { id: params.id },
      });

      await db.auditLog.create({
        data: {
          action: "HITL_MANGA_DELETED",
          entityType: "Manga",
          entityId: params.id,
          userId: adminUser.id,
          details: {
            title: manga.title,
            action: "DELETE",
            deletedBy: adminUser.username,
            note,
          },
        },
      });

      return NextResponse.json({
        success: true,
        action: "DELETE",
        mangaId: params.id,
      });
    }

    return NextResponse.json({ error: "Invalid action specified" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process HITL decision" },
      { status: 500 }
    );
  }
}
