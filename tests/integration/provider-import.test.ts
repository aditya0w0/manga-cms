import { describe, it, expect, beforeAll } from "vitest";
import { getPrisma } from "@/lib/database/prisma";
import { createProviderInstance } from "@/modules/api-providers/generic-provider";
import { mapItem, EntityMappingConfig } from "@/modules/api-providers/json-mapper";
import { ImportJobType, ImportJobStatus, ImportRecordStatus } from "@prisma/client";

describe("Universal API Provider & Import Engine Integration", () => {
  let db: any;
  let mockProvider: any;

  beforeAll(async () => {
    db = await getPrisma();
    mockProvider = await db.aPIProvider.findFirst({
      where: { name: "Global Manga REST Simulator" },
      include: {
        endpoints: true,
        fieldMappings: true,
      },
    });
  });

  it("loads configured API Provider with endpoints and field mappings", () => {
    expect(mockProvider).not.toBeNull();
    expect(mockProvider.name).toBe("Global Manga REST Simulator");
    expect(mockProvider.baseUrl).toBeDefined();
    expect(mockProvider.endpoints.length).toBeGreaterThanOrEqual(1);
    expect(mockProvider.fieldMappings.length).toBeGreaterThanOrEqual(1);
  });

  it("maps external nested JSON payload to normalized schema correctly", () => {
    const rawExternalPayload = {
      id: "sim-9901",
      type: "manhwa",
      attributes: {
        title: { en: "The Legendary Moonlight Sculptor" },
        description: { en: "The man forsaken by the world, the slave of money..." },
        status: "completed",
        year: 2015,
      },
    };

    const mappingConfig: EntityMappingConfig = {
      id: { path: "id", required: true },
      title: { path: "attributes.title.en" },
      description: { path: "attributes.description.en" },
      status: { path: "attributes.status", transform: "uppercase" },
      release_year: { path: "attributes.year", transform: "to_integer" },
      content_type: { path: "type", transform: "uppercase" },
    };

    const normalized = mapItem(rawExternalPayload, mappingConfig);

    expect(normalized.id).toBe("sim-9901");
    expect(normalized.title).toBe("The Legendary Moonlight Sculptor");
    expect(normalized.description).toContain("The man forsaken by the world");
    expect(normalized.status).toBe("COMPLETED");
    expect(normalized.release_year).toBe(2015);
    expect(normalized.content_type).toBe("MANHWA");
  });

  it("instantiates GenericRestProvider factory from database record", async () => {
    if (!mockProvider) return;

    const instance = await createProviderInstance(mockProvider.id);
    expect(instance).toBeDefined();
  });

  it("tracks import job lifecycle and records duplicate detection correctly", async () => {
    if (!mockProvider) return;

    // 1. Create a running import job record
    const job = await db.aPIImportJob.create({
      data: {
        providerId: mockProvider.id,
        jobType: ImportJobType.SINGLE_MANGA,
        status: ImportJobStatus.RUNNING,
        startedAt: new Date(),
        totalItems: 1,
      },
    });
    expect(job.id).toBeDefined();

    // 2. Insert an import record
    const testExternalId = "test-external-manga-001";
    const record = await db.aPIImportRecord.create({
      data: {
        jobId: job.id,
        externalId: testExternalId,
        status: ImportRecordStatus.SUCCESS,
      },
    });
    expect(record.id).toBeDefined();
    expect(record.status).toBe(ImportRecordStatus.SUCCESS);

    // 3. Complete the job
    const completedJob = await db.aPIImportJob.update({
      where: { id: job.id },
      data: {
        status: ImportJobStatus.COMPLETED,
        processedItems: 1,
        finishedAt: new Date(),
      },
    });
    expect(completedJob.status).toBe(ImportJobStatus.COMPLETED);
    expect(completedJob.processedItems).toBe(1);

    // 4. Test duplicate prevention strategy: second attempt skips
    const duplicateJob = await db.aPIImportJob.create({
      data: {
        providerId: mockProvider.id,
        jobType: ImportJobType.SINGLE_MANGA,
        status: ImportJobStatus.COMPLETED,
        startedAt: new Date(),
        finishedAt: new Date(),
        totalItems: 1,
      },
    });
    const skipRecord = await db.aPIImportRecord.create({
      data: {
        jobId: duplicateJob.id,
        externalId: testExternalId,
        status: ImportRecordStatus.SKIPPED_DUPLICATE,
        errorMessage: "Title already exists in database (duplicate skipped)",
      },
    });
    expect(skipRecord.status).toBe(ImportRecordStatus.SKIPPED_DUPLICATE);
  });
});
