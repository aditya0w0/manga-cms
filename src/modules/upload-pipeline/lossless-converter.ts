import path from "path";

export interface ConversionResult {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  converted: boolean;
  originalSize: number;
  finalSize: number;
}

export class LosslessImageConverter {
  private static sharpModule: any = null;
  private static sharpChecked = false;

  /**
   * Lazily checks if 'sharp' is installed and loadable.
   */
  private static getSharp(): any {
    if (!this.sharpChecked) {
      this.sharpChecked = true;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
        this.sharpModule = require("sharp");
      } catch {
        this.sharpModule = null;
      }
    }
    return this.sharpModule;
  }

  public static isSharpAvailable(): boolean {
    return this.getSharp() !== null;
  }

  /**
   * Converts PNG or uncompressed image to true mathematically lossless WebP.
   * If the converted WebP is smaller, returns the WebP buffer.
   * If sharp is not installed or conversion is larger, safely returns original buffer.
   */
  static async convertToLosslessWebP(
    buffer: Buffer,
    filename: string,
    mimeType?: string
  ): Promise<ConversionResult> {
    const ext = path.extname(filename).toLowerCase();
    const originalSize = buffer.length;

    // Only convert PNG images or large non-WebP/non-AVIF images
    const isPng = ext === ".png" || mimeType === "image/png";
    const isLargeCandidate = isPng || (originalSize > 5 * 1024 * 1024 && ext !== ".webp" && ext !== ".avif");

    if (!isLargeCandidate) {
      return {
        buffer,
        filename,
        mimeType: mimeType || "application/octet-stream",
        converted: false,
        originalSize,
        finalSize: originalSize,
      };
    }

    const sharp = this.getSharp();
    if (!sharp) {
      return {
        buffer,
        filename,
        mimeType: mimeType || (isPng ? "image/png" : "application/octet-stream"),
        converted: false,
        originalSize,
        finalSize: originalSize,
      };
    }

    try {
      // True mathematically lossless WebP conversion
      const webpBuffer = await sharp(buffer)
        .webp({
          lossless: true,
          effort: 4, // Balanced CPU effort for compression density
        })
        .toBuffer();

      // Only adopt WebP if it successfully reduced the file size
      if (webpBuffer.length < originalSize) {
        const base = path.basename(filename, ext);
        const newFilename = `${base}.webp`;

        return {
          buffer: webpBuffer,
          filename: newFilename,
          mimeType: "image/webp",
          converted: true,
          originalSize,
          finalSize: webpBuffer.length,
        };
      }
    } catch (err) {
      console.warn(`[LosslessConverter] Failed to convert ${filename} to WebP:`, err);
    }

    return {
      buffer,
      filename,
      mimeType: mimeType || (isPng ? "image/png" : "application/octet-stream"),
      converted: false,
      originalSize,
      finalSize: originalSize,
    };
  }
}
