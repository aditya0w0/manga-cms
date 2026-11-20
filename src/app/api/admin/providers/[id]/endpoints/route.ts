import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/auth";
import { getPrisma } from "@/lib/database/prisma";
import { HttpMethod, PaginationType } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const db = await getPrisma();

    const {
      name,
      method = HttpMethod.GET,
      urlTemplate,
      queryParams,
      defaultHeaders,
      paginationType = PaginationType.PAGE,
      paginationConfig,
      cacheTtlSec = 300,
    } = body;

    if (!name || !urlTemplate) {
      return NextResponse.json({ error: "Endpoint name and urlTemplate are required" }, { status: 400 });
    }

    const endpoint = await db.aPIEndpoint.upsert({
      where: {
        providerId_name: {
          providerId: params.id,
          name: name.trim(),
        },
      },
      update: {
        method,
        urlTemplate: urlTemplate.trim(),
        queryParams: queryParams || undefined,
        defaultHeaders: defaultHeaders || undefined,
        paginationType,
        paginationConfig: paginationConfig || undefined,
        cacheTtlSec: Number(cacheTtlSec) || 300,
      },
      create: {
        providerId: params.id,
        name: name.trim(),
        method,
        urlTemplate: urlTemplate.trim(),
        queryParams: queryParams || undefined,
        defaultHeaders: defaultHeaders || undefined,
        paginationType,
        paginationConfig: paginationConfig || undefined,
        cacheTtlSec: Number(cacheTtlSec) || 300,
      },
    });

    await db.auditLog.create({
      data: {
        userId: admin.id,
        action: "ENDPOINT_CONFIGURED",
        entityType: "APIEndpoint",
        entityId: endpoint.id,
        details: { providerId: params.id, name: endpoint.name },
      },
    });

    return NextResponse.json({ success: true, endpoint });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to configure endpoint" }, { status: 500 });
  }
}
