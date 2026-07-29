import { beforeEach, describe, expect, it, vi } from "vitest";

const createBucket = vi.fn();
const upload = vi.fn();
const getPublicUrl = vi.fn();
const createServerSupabaseClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: (...args: unknown[]) => createServerSupabaseClient(...args),
}));

const { saveLocalUploadFile } = await import("./featured-image-local-storage");

function makeFile(name: string, type: string, sizeBytes = 1024): File {
  const buffer = new Uint8Array(sizeBytes);
  return new File([buffer], name, { type });
}

beforeEach(() => {
  createBucket.mockReset();
  upload.mockReset();
  getPublicUrl.mockReset();
  createServerSupabaseClient.mockReset();

  createBucket.mockResolvedValue({ error: null });
  upload.mockResolvedValue({ error: null });
  getPublicUrl.mockReturnValue({ data: { publicUrl: "https://example-project.supabase.co/storage/v1/object/public/featured-images/article-1/photo.jpg" } });

  createServerSupabaseClient.mockReturnValue({
    storage: {
      createBucket,
      from: () => ({ upload, getPublicUrl }),
    },
  });
});

describe("saveLocalUploadFile", () => {
  it("허용된 MIME type(jpeg/png/webp)이면 Supabase Storage에 업로드하고 공개 URL을 반환한다", async () => {
    const file = makeFile("photo.jpg", "image/jpeg");

    const result = await saveLocalUploadFile("article-1", file);

    expect(result.success).toBe(true);
    expect(result.url).toBeTruthy();
    expect(result.mimeType).toBe("image/jpeg");
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("허용되지 않는 MIME type이면 거부하고 업로드를 시도하지 않는다", async () => {
    const file = makeFile("photo.gif", "image/gif");

    const result = await saveLocalUploadFile("article-1", file);

    expect(result.success).toBe(false);
    expect(result.url).toBeUndefined();
    expect(upload).not.toHaveBeenCalled();
  });

  it("최대 크기를 초과하면 거부한다", async () => {
    const file = makeFile("photo.jpg", "image/jpeg", 6 * 1024 * 1024);

    const result = await saveLocalUploadFile("article-1", file);

    expect(result.success).toBe(false);
    expect(result.error).toContain("크기");
    expect(upload).not.toHaveBeenCalled();
  });

  it("bucket이 이미 존재하면(already exists 오류) 무시하고 업로드를 계속한다", async () => {
    createBucket.mockResolvedValue({ error: { message: "The resource already exists" } });
    const file = makeFile("photo.png", "image/png");

    const result = await saveLocalUploadFile("article-1", file);

    expect(result.success).toBe(true);
  });

  it("업로드가 실패하면 안전한 오류를 반환한다", async () => {
    upload.mockResolvedValue({ error: { message: "network error" } });
    const file = makeFile("photo.jpg", "image/jpeg");

    const result = await saveLocalUploadFile("article-1", file);

    expect(result.success).toBe(false);
    expect(result.error).toContain("network error");
  });

  it("반환값에 image binary가 포함되지 않는다 (URL 문자열만 반환)", async () => {
    const file = makeFile("photo.webp", "image/webp");

    const result = await saveLocalUploadFile("article-1", file);

    const serialized = JSON.stringify(result);
    expect(serialized.length).toBeLessThan(500);
    expect(result).not.toHaveProperty("buffer");
    expect(result).not.toHaveProperty("binary");
  });
});
