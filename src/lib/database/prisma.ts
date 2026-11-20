import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PGlite } from "@electric-sql/pglite";
import { createPgConfig } from "@electric-sql/pglite/node-postgres";
import net from "net";
import fs from "fs";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
  initPromise: Promise<PrismaClient> | undefined;
};

async function testTcpConnection(host: string, port: number, timeoutMs = 400): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let hasResolved = false;

    socket.setTimeout(timeoutMs);

    socket.on("connect", () => {
      hasResolved = true;
      socket.destroy();
      resolve(true);
    });

    socket.on("timeout", () => {
      if (!hasResolved) {
        hasResolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.on("error", () => {
      if (!hasResolved) {
        hasResolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.connect(port, host);
  });
}

export async function initPrisma(): Promise<PrismaClient> {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }
  if (globalForPrisma.initPromise) {
    return globalForPrisma.initPromise;
  }

  globalForPrisma.initPromise = (async () => {
    const databaseUrl = process.env.DATABASE_URL;
    let connected = false;
    let pool: Pool | null = null;

    if (databaseUrl && !databaseUrl.includes("unconfigured") && !databaseUrl.includes("johndoe")) {
      try {
        const parsed = new URL(databaseUrl);
        const host = parsed.hostname || "localhost";
        const port = Number(parsed.port) || 5432;

        const isReachable = await testTcpConnection(host, port, 400);
        if (isReachable) {
          const testPool = new Pool({
            connectionString: databaseUrl,
            connectionTimeoutMillis: 2000,
          });
          await testPool.query("SELECT 1;");
          pool = testPool;
          connected = true;
          console.log("[DB] Connected to PostgreSQL at", databaseUrl.replace(/:[^:@]*@/, ":***@"));
        }
      } catch {
        // Fallback to embedded PGlite
      }
    }

    if (!connected || !pool) {
      console.log("[DB] Using high-performance embedded PostgreSQL engine (PGlite).");
      const dataDir = path.resolve(process.cwd(), "data", "pgdata");
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Clean up stale lock/pid file if left behind by interrupted process
      const pidFile = path.join(dataDir, "postmaster.pid");
      if (fs.existsSync(pidFile)) {
        try {
          fs.unlinkSync(pidFile);
        } catch {}
      }

      let pglite: PGlite;
      try {
        pglite = new PGlite(dataDir);
        await pglite.waitReady;
      } catch (bootErr) {
        console.warn("[DB] Data store was interrupted or encountered WAL corruption, self-healing...", bootErr);
        try {
          fs.rmSync(dataDir, { recursive: true, force: true });
          fs.mkdirSync(dataDir, { recursive: true });
        } catch {}
        pglite = new PGlite(dataDir);
        await pglite.waitReady;
      }

      try {
        const tableCheck = await pglite.query(
          "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Manga';"
        );
        if (tableCheck.rows.length === 0) {
          console.log("[DB] Initializing PostgreSQL schema in local data store...");
          const migrationFile = path.resolve(process.cwd(), "prisma", "migrations", "0_init", "migration.sql");
          if (fs.existsSync(migrationFile)) {
            const sql = fs.readFileSync(migrationFile, "utf-8");
            await pglite.exec(sql);
            console.log("[DB] Local schema successfully applied!");
          }
        }

        // Apply bulk ingest pipeline migration if not already applied
        const colCheck = await pglite.query(
          "SELECT column_name FROM information_schema.columns WHERE table_name = 'Manga' AND column_name = 'coverImageId';"
        );
        if (colCheck.rows.length === 0) {
          console.log("[DB] Applying 1_bulk_ingest_pipeline migration...");
          const migration1 = path.resolve(process.cwd(), "prisma", "migrations", "1_bulk_ingest_pipeline", "migration.sql");
          if (fs.existsSync(migration1)) {
            const sql1 = fs.readFileSync(migration1, "utf-8");
            await pglite.exec(sql1);
            console.log("[DB] 1_bulk_ingest_pipeline migration applied successfully!");
          }
        }
      } catch (initErr) {
        console.error("[DB] Migration check failed:", initErr);
      }

      pool = new Pool(createPgConfig(pglite));
    }

    const adapter = new PrismaPg(pool);
    const client = new PrismaClient({ adapter });

    globalForPrisma.prisma = client;
    globalForPrisma.pgPool = pool;
    return client;
  })();

  return globalForPrisma.initPromise;
}

export async function getPrisma(): Promise<PrismaClient> {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }
  return await initPrisma();
}

export default {
  initPrisma,
  getPrisma,
};
