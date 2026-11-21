import crypto from "crypto";
import { BatchQueueService } from "../modules/upload-pipeline/batch-queue-service";
import { getPrisma } from "@/lib/database/prisma";

export class BatchIngestWorker {
  readonly workerId: string;
  private isRunning = false;
  private activeJobs = new Set<string>();
  private readonly concurrency: number;
  private readonly pollIntervalMs: number;
  private lastStaleReclaim = 0;

  constructor(options?: { concurrency?: number; pollIntervalMs?: number }) {
    this.workerId = `worker_${process.pid}_${crypto.randomBytes(4).toString("hex")}`;
    this.concurrency = options?.concurrency || 2;
    this.pollIntervalMs = options?.pollIntervalMs || 1000;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[BatchIngestWorker] Started worker ${this.workerId} (concurrency: ${this.concurrency})`);

    // Ensure database connection is initialized
    await getPrisma();

    this.runLoop();
  }

  private async runLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        // Periodic stale lock recovery (every 60 seconds)
        const now = Date.now();
        if (now - this.lastStaleReclaim > 60_000) {
          this.lastStaleReclaim = now;
          const reclaimed = await BatchQueueService.reclaimStaleJobs(10).catch(() => 0);
          if (reclaimed > 0) {
            console.log(`[BatchIngestWorker] Reclaimed ${reclaimed} stale jobs`);
          }
        }

        // Fill available concurrency slots
        while (this.isRunning && this.activeJobs.size < this.concurrency) {
          const job = await BatchQueueService.claimNextChapterJob(this.workerId);
          if (!job) break;

          this.activeJobs.add(job.id);
          this.processJobAsync(job.id);
        }
      } catch (err) {
        console.error("[BatchIngestWorker] Error in poll loop:", err);
      }

      // Wait before polling if no work was available or queue is full
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }
  }

  private async processJobAsync(jobId: string): Promise<void> {
    try {
      await BatchQueueService.executeChapterJob(jobId, this.workerId);
    } catch (err) {
      console.error(`[BatchIngestWorker] Unhandled error processing job ${jobId}:`, err);
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  isRunningStatus(): boolean {
    return this.isRunning;
  }

  getActiveJobCount(): number {
    return this.activeJobs.size;
  }

  async stop(): Promise<void> {
    console.log(`[BatchIngestWorker] Stopping worker ${this.workerId}... Waiting for ${this.activeJobs.size} active jobs.`);
    this.isRunning = false;

    const maxWaitMs = 30_000;
    const start = Date.now();

    while (this.activeJobs.size > 0 && Date.now() - start < maxWaitMs) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log(`[BatchIngestWorker] Worker ${this.workerId} stopped cleanly.`);
  }

  /**
   * Helper to run worker continuously until process signal is received.
   */
  static runAsCli(): void {
    const worker = new BatchIngestWorker();

    const handleShutdown = async (signal: string) => {
      console.log(`[BatchIngestWorker] Received ${signal}. Shutting down...`);
      await worker.stop();
      process.exit(0);
    };

    process.on("SIGINT", () => handleShutdown("SIGINT"));
    process.on("SIGTERM", () => handleShutdown("SIGTERM"));

    worker.start().catch((err) => {
      console.error("[BatchIngestWorker] Fatal startup error:", err);
      process.exit(1);
    });
  }
}

let activeInProcessWorker: BatchIngestWorker | null = null;

/**
 * Starts or returns the singleton in-process worker to consume queued jobs immediately.
 */
export function getOrStartInProcessWorker(concurrency = 2): BatchIngestWorker {
  if (!activeInProcessWorker || !activeInProcessWorker.isRunningStatus()) {
    activeInProcessWorker = new BatchIngestWorker({ concurrency, pollIntervalMs: 1200 });
    activeInProcessWorker.start().catch((err) => {
      console.error("[BatchIngestWorker] Error starting in-process worker:", err);
    });
  }
  return activeInProcessWorker;
}

/**
 * Returns current health and running status of the in-process worker.
 */
export function getInProcessWorkerStatus() {
  return {
    isRunning: activeInProcessWorker?.isRunningStatus() || false,
    workerId: activeInProcessWorker?.workerId || null,
    activeJobCount: activeInProcessWorker?.getActiveJobCount() || 0,
  };
}

// If executed directly from CLI: npm run worker:ingest
if (require.main === module) {
  BatchIngestWorker.runAsCli();
}
