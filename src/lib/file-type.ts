export type ImageType = "jpeg" | "png" | "webp";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

function isAscii(bytes: Uint8Array, text: string, offset: number): boolean {
  return startsWith(
    bytes,
    [...text].map((char) => char.charCodeAt(0)),
    offset,
  );
}

/**
 * Identifies an image by its actual bytes. A client-supplied MIME type is a
 * claim, not evidence — trusting it is how this exact upload pattern gets
 * turned into arbitrary file hosting.
 */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length < 12) return null;

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, PNG_SIGNATURE)) return "png";
  if (isAscii(bytes, "RIFF", 0) && isAscii(bytes, "WEBP", 8)) return "webp";

  return null;
}

export function extensionFor(type: ImageType): string {
  return type === "jpeg" ? "jpg" : type;
}
