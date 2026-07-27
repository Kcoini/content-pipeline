import { describe, expect, it, afterAll } from "vitest";
import { rm } from "node:fs/promises";
import path from "node:path";
import { saveLocalUploadFile } from "./featured-image-local-storage";

const UPLOAD_DIR = path.join(process.cwd(), ".uploads", "featured-images");

afterAll(async () => {
  await rm(UPLOAD_DIR, { recursive: true, force: true });
});

function makeFile(name: string, type: string, sizeBytes = 1024): File {
  const buffer = new Uint8Array(sizeBytes);
  return new File([buffer], name, { type });
}

describe("saveLocalUploadFile", () => {
  it("허용된 MIME type(jpeg/png/webp)이면 파일을 저장하고 경로를 반환한다", async () => {
    const file = makeFile("photo.jpg", "image/jpeg");

    const result = await saveLocalUploadFile("article-1", file);

    expect(result.success).toBe(true);
    expect(result.localPath).toBeTruthy();
    expect(result.mimeType).toBe("image/jpeg");
  });

  it("허용되지 않는 MIME type이면 거부하고 디스크에 쓰지 않는다", async () => {
    const file = makeFile("photo.gif", "image/gif");

    const result = await saveLocalUploadFile("article-1", file);

    expect(result.success).toBe(false);
    expect(result.localPath).toBeUndefined();
  });

  it("최대 크기를 초과하면 거부한다", async () => {
    const file = makeFile("photo.jpg", "image/jpeg", 6 * 1024 * 1024);

    const result = await saveLocalUploadFile("article-1", file);

    expect(result.success).toBe(false);
    expect(result.error).toContain("크기");
  });

  it("반환값에 image binary가 포함되지 않는다 (경로 문자열만 반환)", async () => {
    const file = makeFile("photo.webp", "image/webp");

    const result = await saveLocalUploadFile("article-1", file);

    const serialized = JSON.stringify(result);
    expect(serialized.length).toBeLessThan(500);
    expect(result).not.toHaveProperty("buffer");
    expect(result).not.toHaveProperty("binary");
  });
});
