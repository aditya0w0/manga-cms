import fs from "fs";
import path from "path";
import stream from "stream";
import { promisify } from "util";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const pipeline = promisify(stream.pipeline);

export interface StorageAdapter {
  readonly driver: "local" | "r2" | "supabase";
  putObject(params: {
    key: string;
    body: Buffer | NodeJS.ReadableStream;
    contentType: string;
  }): Promise<{ key: string; publicUrl: string; byteSize: number }>;
  getObjectStream(key: string): Promise<NodeJS.ReadableStream>;
  exists(key: string): Promise<boolean>;
  deleteObject(key: string): Promise<void>;
  getPublicUrl(key: string): string;
  createSignedUploadUrl?(params: {
    key: string;
    contentType: string;
    expiresInSec?: number;
  }): Promise<{ uploadUrl: string; key: string }>;
}

export interface LocalDiskStorageConfig {
  baseDir?: string;
  publicBaseUrl?: string;
}

export class LocalDiskStorageAdapter implements StorageAdapter {
  readonly driver = "local" as const;
  private readonly baseDir: string;
  private readonly publicBaseUrl: string;

  constructor(config?: LocalDiskStorageConfig) {
    this.baseDir = path.resolve(process.cwd(), config?.baseDir || "storage");
    this.publicBaseUrl = config?.publicBaseUrl || "/api/v1/media";
    this.ensureDirectory(this.baseDir);
    this.ensureDirectory(path.join(this.baseDir, "staging"));
    this.ensureDirectory(path.join(this.baseDir, "media"));
  }

  private ensureDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private resolveSafePath(key: string): string {
    const resolved = path.resolve(this.baseDir, key);
    if (!resolved.startsWith(this.baseDir + path.sep) && resolved !== this.baseDir) {
      throw new Error(`Security violation: Key "${key}" attempts directory traversal`);
    }
    return resolved;
  }

  async putObject(params: {
    key: string;
    body: Buffer | NodeJS.ReadableStream;
    contentType: string;
  }): Promise<{ key: string; publicUrl: string; byteSize: number }> {
    const filePath = this.resolveSafePath(params.key);
    const parentDir = path.dirname(filePath);
    this.ensureDirectory(parentDir);

    let byteSize = 0;
    if (Buffer.isBuffer(params.body)) {
      await fs.promises.writeFile(filePath, params.body);
      byteSize = params.body.length;
    } else {
      const writeStream = fs.createWriteStream(filePath);
      let count = 0;
      params.body.on("data", (chunk: Buffer) => {
        count += chunk.length;
      });
      await pipeline(params.body as stream.Readable, writeStream);
      byteSize = count;
    }

    return {
      key: params.key,
      publicUrl: this.getPublicUrl(params.key),
      byteSize,
    };
  }

  async getObjectStream(key: string): Promise<NodeJS.ReadableStream> {
    const filePath = this.resolveSafePath(key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Object not found for key: ${key}`);
    }
    return fs.createReadStream(filePath);
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.resolveSafePath(key);
    return fs.existsSync(filePath);
  }

  async deleteObject(key: string): Promise<void> {
    const filePath = this.resolveSafePath(key);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key.replace(/^\/+/, "")}`;
  }
}

export interface S3StorageConfig {
  driver: "r2" | "supabase";
  endpoint?: string;
  region?: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
}

export class S3CompatibleStorageAdapter implements StorageAdapter {
  readonly driver: "r2" | "supabase";
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(config: S3StorageConfig) {
    this.driver = config.driver;
    this.bucket = config.bucket;
    this.publicBaseUrl = (config.publicBaseUrl || "").replace(/\/+$/, "");

    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region || "auto",
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.driver === "supabase",
    });
  }

  async putObject(params: {
    key: string;
    body: Buffer | NodeJS.ReadableStream;
    contentType: string;
  }): Promise<{ key: string; publicUrl: string; byteSize: number }> {
    let bodyData: Buffer | Uint8Array;
    let byteSize = 0;

    if (Buffer.isBuffer(params.body)) {
      bodyData = params.body;
      byteSize = params.body.length;
    } else {
      const chunks: Buffer[] = [];
      const readable = params.body as stream.Readable;
      for await (const chunk of readable) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      bodyData = Buffer.concat(chunks);
      byteSize = bodyData.length;
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      Body: bodyData,
      ContentType: params.contentType,
    });

    await this.client.send(command);

    return {
      key: params.key,
      publicUrl: this.getPublicUrl(params.key),
      byteSize,
    };
  }

  async getObjectStream(key: string): Promise<NodeJS.ReadableStream> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);
    if (!response.Body) {
      throw new Error(`Empty body returned for S3 object: ${key}`);
    }
    return response.Body as unknown as NodeJS.ReadableStream;
  }

  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.client.send(command);
      return true;
    } catch (err: unknown) {
      const error = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw err;
    }
  }

  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    await this.client.send(command);
  }

  getPublicUrl(key: string): string {
    const cleanKey = key.replace(/^\/+/, "");
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl}/${cleanKey}`;
    }
    return `https://${this.bucket}.s3.amazonaws.com/${cleanKey}`;
  }
}

let cachedAdapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (cachedAdapter) {
    return cachedAdapter;
  }

  const driver = (process.env.STORAGE_DRIVER || "local").toLowerCase();

  if (driver === "r2" || driver === "supabase") {
    const bucket = process.env.S3_BUCKET || "";
    const accessKeyId = process.env.S3_ACCESS_KEY_ID || "";
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || "";
    const endpoint = process.env.S3_ENDPOINT || "";
    const region = process.env.S3_REGION || "auto";
    const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL || "";

    if (!bucket || !accessKeyId || !secretAccessKey) {
      console.warn(
        `[StorageAdapter] STORAGE_DRIVER=${driver} requested but S3 credentials missing. Falling back to local disk storage.`
      );
      cachedAdapter = new LocalDiskStorageAdapter();
      return cachedAdapter;
    }

    cachedAdapter = new S3CompatibleStorageAdapter({
      driver,
      endpoint,
      region,
      bucket,
      accessKeyId,
      secretAccessKey,
      publicBaseUrl,
    });
    return cachedAdapter;
  }

  cachedAdapter = new LocalDiskStorageAdapter();
  return cachedAdapter;
}
