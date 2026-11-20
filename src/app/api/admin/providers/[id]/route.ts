import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/auth";
import { getPrisma } from "@/lib/database/prisma";
import { encryptCredential } from "@/lib/security/encryption";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
    const db = await getPrisma();

    const provider = await db.aPIProvider.findUnique({
      where: { id: params.id },
      include: {
        endpoints: { orderBy: { createdAt: "asc" } },
        fieldMappings: true,
        importJobs: { orderBy: { createdAt: "desc" }, take: 5 },
        requestLogs: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    const { encryptedCredentials, ...safeProvider } = provider;

    return NextResponse.json({
      provider: {
        ...safeProvider,
        hasCredentials: Boolean(encryptedCredentials),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch provider" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const db = await getPrisma();

    const existing = await db.aPIProvider.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    const {
      name,
      slug,
      description,
      baseUrl,
      apiVersion,
      defaultLanguage,
      authType,
      credentials,
      customHeaders,
      timeoutMs,
      rateLimitRequests,
      rateLimitWindowSec,
      isEnabled,
      healthStatus,
    } = body;

    const data: any = {
      name: name !== undefined ? name.trim() : existing.name,
      slug: slug !== undefined ? slug : existing.slug,
      description: description !== undefined ? description : existing.description,
      baseUrl: baseUrl !== undefined ? baseUrl.trim() : existing.baseUrl,
      apiVersion: apiVersion !== undefined ? apiVersion : existing.apiVersion,
      defaultLanguage: defaultLanguage || existing.defaultLanguage,
      authType: authType || existing.authType,
      customHeaders: customHeaders !== undefined ? customHeaders : existing.customHeaders,
      timeoutMs: timeoutMs !== undefined ? Number(timeoutMs) : existing.timeoutMs,
      rateLimitRequests: rateLimitRequests !== undefined ? Number(rateLimitRequests) : existing.rateLimitRequests,
      rateLimitWindowSec: rateLimitWindowSec !== undefined ? Number(rateLimitWindowSec) : existing.rateLimitWindowSec,
      isEnabled: isEnabled !== undefined ? Boolean(isEnabled) : existing.isEnabled,
      healthStatus: healthStatus || existing.healthStatus,
    };

    if (credentials !== undefined && credentials !== "") {
      data.encryptedCredentials = encryptCredential(credentials);
    }

    const updated = await db.aPIProvider.update({
      where: { id: params.id },
      data,
    });

    await db.auditLog.create({
      data: {
        userId: admin.id,
        action: "PROVIDER_UPDATED",
        entityType: "APIProvider",
        entityId: updated.id,
        details: { name: updated.name },
      },
    });

    return NextResponse.json({ success: true, provider: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update provider" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();
    const db = await getPrisma();

    await db.aPIProvider.delete({
      where: { id: params.id },
    });

    await db.auditLog.create({
      data: {
        userId: admin.id,
        action: "PROVIDER_DELETED",
        entityType: "APIProvider",
        entityId: params.id,
      },
    });

    return NextResponse.json({ success: true, message: "Provider deleted" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete provider" }, { status: 500 });
  }
}
