/**
 * Lightweight, zero-dependency client-side ZIP directory header parser.
 * Reads central directory headers from File.slice() without decompressing image blobs.
 */

export interface ZipEntryMeta {
  path: string;
  size: number;
  compressedSize: number;
  isFolder: boolean;
  localOffset: number;
  compressionMethod: number;
}

export class ClientZipInspector {
  /**
   * Fast client-side inspection of a ZIP file without loading uncompressed images into browser RAM.
   */
  static async inspectZipFile(file: File): Promise<{
    entries: ZipEntryMeta[];
    schematicJson?: string;
  }> {
    const fileSize = file.size;
    if (fileSize < 22) {
      throw new Error("File is too small to be a valid ZIP archive.");
    }

    // Read the tail of the file to find the End of Central Directory (EOCD) record
    const tailSize = Math.min(fileSize, 65536);
    const tailBuffer = await file.slice(fileSize - tailSize, fileSize).arrayBuffer();
    const tailView = new DataView(tailBuffer);

    let eocdOffsetInTail = -1;
    // Scan backwards for EOCD signature: 0x06054b50
    for (let i = tailBuffer.byteLength - 22; i >= 0; i--) {
      if (tailView.getUint32(i, true) === 0x06054b50) {
        eocdOffsetInTail = i;
        break;
      }
    }

    if (eocdOffsetInTail === -1) {
      throw new Error("Invalid ZIP archive: End of Central Directory signature not found.");
    }

    const totalEntries = tailView.getUint16(eocdOffsetInTail + 10, true);
    const cdSize = tailView.getUint32(eocdOffsetInTail + 12, true);
    const cdOffset = tailView.getUint32(eocdOffsetInTail + 16, true);

    // Read only the Central Directory block
    const cdBuffer = await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer();
    const cdView = new DataView(cdBuffer);
    const textDecoder = new TextDecoder("utf-8");

    const entries: ZipEntryMeta[] = [];
    let ptr = 0;
    let schematicEntry: ZipEntryMeta | null = null;

    while (ptr < cdBuffer.byteLength && entries.length < totalEntries) {
      const sig = cdView.getUint32(ptr, true);
      if (sig !== 0x02014b50) {
        break;
      }

      const method = cdView.getUint16(ptr + 10, true);
      const compressedSize = cdView.getUint32(ptr + 20, true);
      const uncompressedSize = cdView.getUint32(ptr + 24, true);
      const fileNameLen = cdView.getUint16(ptr + 28, true);
      const extraLen = cdView.getUint16(ptr + 30, true);
      const commentLen = cdView.getUint16(ptr + 32, true);
      const localOffset = cdView.getUint32(ptr + 42, true);

      const nameBytes = new Uint8Array(cdBuffer, ptr + 46, fileNameLen);
      const entryPath = textDecoder.decode(nameBytes);
      const isFolder = entryPath.endsWith("/");

      const meta: ZipEntryMeta = {
        path: entryPath,
        size: uncompressedSize,
        compressedSize,
        isFolder,
        localOffset,
        compressionMethod: method,
      };

      entries.push(meta);

      if (!isFolder && entryPath.toLowerCase().endsWith("schematic.json")) {
        schematicEntry = meta;
      }

      ptr += 46 + fileNameLen + extraLen + commentLen;
    }

    // If schematic.json was found in the archive, extract and read just that one small file
    let schematicJson: string | undefined;
    if (schematicEntry && schematicEntry.size < 512 * 1024) {
      try {
        schematicJson = await this.readSmallTextEntry(file, schematicEntry);
      } catch (err) {
        console.warn("Failed to extract schematic.json from zip client-side:", err);
      }
    }

    return { entries, schematicJson };
  }

  /**
   * Reads a single small text file from the ZIP using local file slice and DecompressionStream.
   */
  private static async readSmallTextEntry(file: File, entry: ZipEntryMeta): Promise<string> {
    // Read local header (30 bytes + nameLen + extraLen)
    const headerBuffer = await file.slice(entry.localOffset, entry.localOffset + 30).arrayBuffer();
    const headerView = new DataView(headerBuffer);
    if (headerView.getUint32(0, true) !== 0x04034b50) {
      throw new Error("Invalid local file header signature");
    }

    const nameLen = headerView.getUint16(26, true);
    const extraLen = headerView.getUint16(28, true);
    const dataStart = entry.localOffset + 30 + nameLen + extraLen;
    const compressedData = await file.slice(dataStart, dataStart + entry.compressedSize).arrayBuffer();

    if (entry.compressionMethod === 0) {
      // Stored (no compression)
      return new TextDecoder().decode(compressedData);
    } else if (entry.compressionMethod === 8) {
      // Deflate
      if (typeof DecompressionStream !== "undefined") {
        const stream = new Response(compressedData).body!.pipeThrough(new DecompressionStream("deflate-raw"));
        return await new Response(stream).text();
      }
    }

    throw new Error(`Unsupported compression method ${entry.compressionMethod}`);
  }
}
