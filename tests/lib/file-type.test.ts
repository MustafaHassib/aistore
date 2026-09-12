import { describe, expect, it } from "vitest";
import { extensionFor, sniffImageType } from "@/lib/file-type";

const jpeg = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);
const png = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

function webp(): Uint8Array {
  const bytes = new Uint8Array(16);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  bytes.set([0x24, 0x00, 0x00, 0x00], 4); // size
  bytes.set([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"
  return bytes;
}

describe("sniffImageType", () => {
  it("identifies JPEG, PNG, and WebP by their magic bytes", () => {
    expect(sniffImageType(jpeg)).toBe("jpeg");
    expect(sniffImageType(png)).toBe("png");
    expect(sniffImageType(webp())).toBe("webp");
  });

  it("rejects a PHP script that claims to be a JPEG", () => {
    const payload = new TextEncoder().encode("<?php system($_GET['c']); ?>");
    expect(sniffImageType(payload)).toBeNull();
  });

  it("rejects a GIF, which is not on the allowlist", () => {
    const gif = new TextEncoder().encode("GIF89a-----------");
    expect(sniffImageType(gif)).toBeNull();
  });

  it("rejects a RIFF container that is not WebP", () => {
    const wav = webp();
    wav.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"
    expect(sniffImageType(wav)).toBeNull();
  });

  it("rejects input too short to carry a signature", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });

  it("maps each accepted type to a file extension", () => {
    expect(extensionFor("jpeg")).toBe("jpg");
    expect(extensionFor("png")).toBe("png");
    expect(extensionFor("webp")).toBe("webp");
  });
});
