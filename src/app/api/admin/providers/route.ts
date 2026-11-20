import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/auth";
import { getPrisma } from "@/lib/database/prisma";
import { encryptCredential } from "@/lib/security/encryption";
import { APIAuthType, ProviderHealth } from "@prisma/client";

export async function GET() {
  try {
    await requireAdmin();
    const db = await getPrisma();

    const providers = await db.aPIProvider.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            endpoints: true,
            fieldMappings: true,
            importJobs: true,
            mangas: true,
          },
        },
      },
    });

    // Strip encrypted credentials from response
    const sanitized = providers.map(({ encryptedCredentials, ...rest }) => ({
      ...rest,
      hasCredentials: Boolean(encryptedCredentials),
    }));

    return NextResponse.json({ providers: sanitized });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch providers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const db = await getPrisma();

    const {
      name,
      slug,
      description,
      baseUrl,
      apiVersion,
      defaultLanguage = "en",
      authType = APIAuthType.NONE,
      credentials,
      customHeaders,
      timeoutMs = 10000,
      rateLimitRequests = 60,
      rateLimitWindowSec = 60,
      isEnabled = true,
    } = body;

    if (!name || !baseUrl) {
      return NextResponse.json({ error: "Name and Base API URL are required" }, { status: 400 });
    }

    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const encryptedCredentials = credentials ? encryptCredential(credentials) : undefined;

    const provider = await db.aPIProvider.create({
      data: {
        name: name.trim(),
        slug: finalSlug,
        description,
        baseUrl: baseUrl.trim(),
        apiVersion,
        defaultLanguage,
        authType,
        encryptedCredentials,
        customHeaders: customHeaders || undefined,
        timeoutMs: Number(timeoutMs) || 10000,
        rateLimitRequests: Number(rateLimitRequests) || 60,
        rateLimitWindowSec: Number(rateLimitWindowSec) || 60,
        isEnabled: Boolean(isEnabled),
        healthStatus: ProviderHealth.UNKNOWN,
      },
    });

    await db.auditLog.create({
      data: {
        userId: admin.id,
        action: "PROVIDER_CREATED",
        entityType: "APIProvider",
        entityId: provider.id,
        details: { name: provider.name, baseUrl: provider.baseUrl },
      },
    });

    return NextResponse.json({ success: true, provider }, { status: 201 });
  } catch (err: any) {
    console.error("Create provider error:", err);
    return NextResponse.json({ error: err.message || "Failed to create provider" }, { status: 500 });
  }
}
