import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDraftPost,
  isWordPressConfigured,
  findOrCreateCategory,
  findOrCreateTag,
  uploadMediaToWordPress,
  testWordPressConnection,
  updateDraftFeaturedMedia,
  getMediaItem,
} from "./wordpress-client";

const ENV_KEYS = ["WORDPRESS_BASE_URL", "WORDPRESS_USERNAME", "WORDPRESS_APP_PASSWORD"] as const;

function clearWordPressEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

function setWordPressEnv() {
  process.env.WORDPRESS_BASE_URL = "https://example-blog.test";
  process.env.WORDPRESS_USERNAME = "test-user";
  // 테스트용 더미 값이며 실제 application password가 아니다.
  process.env.WORDPRESS_APP_PASSWORD = "dummy-app-password-for-tests";
}

describe("isWordPressConfigured", () => {
  afterEach(() => {
    clearWordPressEnv();
  });

  it("환경변수 3종이 모두 있으면 true를 반환한다", () => {
    setWordPressEnv();
    expect(isWordPressConfigured()).toBe(true);
  });

  it("하나라도 없으면 false를 반환한다", () => {
    clearWordPressEnv();
    process.env.WORDPRESS_BASE_URL = "https://example-blog.test";
    expect(isWordPressConfigured()).toBe(false);
  });
});

describe("createDraftPost", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearWordPressEnv();
  });

  it("환경변수가 없으면 실제 fetch 호출 없이 실패를 반환한다", async () => {
    clearWordPressEnv();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await createDraftPost({ title: "제목", content: "본문" });

    expect(result.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("status='draft'로 요청을 보낸다 (자동 공개 금지)", async () => {
    setWordPressEnv();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 42, link: "https://example-blog.test/?p=42", status: "draft", slug: "slug-1" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createDraftPost({ title: "제목", content: "본문" });

    expect(result.success).toBe(true);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.status).toBe("draft");
  });

  it("Authorization header에 Basic auth를 사용하고 password를 평문으로 보내지 않는다", async () => {
    setWordPressEnv();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 1, link: "https://example-blog.test/?p=1" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await createDraftPost({ title: "제목", content: "본문" });

    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^Basic /);
    expect(headers.Authorization).not.toContain("dummy-app-password-for-tests");
  });

  it("성공 시 externalPostId/postUrl을 반환한다", async () => {
    setWordPressEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ id: 123, link: "https://example-blog.test/?p=123", status: "draft", slug: "hello" }),
          { status: 201, headers: { "content-type": "application/json" } }
        )
      )
    );

    const result = await createDraftPost({ title: "제목", content: "본문" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.externalPostId).toBe(123);
      expect(result.postUrl).toBe("https://example-blog.test/?p=123");
    }
  });

  it("HTTP 오류 응답이면 statusCode/errorMessage를 포함한 실패를 반환한다", async () => {
    setWordPressEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("invalid credentials", { status: 401, statusText: "Unauthorized" })
      )
    );

    const result = await createDraftPost({ title: "제목", content: "본문" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.statusCode).toBe(401);
      expect(result.errorMessage).toContain("401");
    }
  });

  it("네트워크 오류 시 예외를 던지지 않고 실패를 반환한다", async () => {
    setWordPressEnv();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await createDraftPost({ title: "제목", content: "본문" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorMessage).toContain("network down");
    }
  });
});

describe("findOrCreateCategory / findOrCreateTag", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearWordPressEnv();
  });

  it("환경변수가 없으면 실제 fetch 호출 없이 실패를 반환한다", async () => {
    clearWordPressEnv();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await findOrCreateCategory("복지");

    expect(result.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("이름이 이미 있으면 검색만 하고 생성 요청은 보내지 않는다", async () => {
    setWordPressEnv();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: 5, name: "복지" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await findOrCreateCategory("복지");

    expect(result).toEqual({ success: true, id: 5, name: "복지" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0][0] as string)).toContain("/wp-json/wp/v2/categories");
  });

  it("이름이 없으면 생성 요청을 보내고 결과를 반환한다", async () => {
    setWordPressEnv();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 9, name: "장기요양보험" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await findOrCreateTag("장기요양보험");

    expect(result).toEqual({ success: true, id: 9, name: "장기요양보험" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, createInit] = fetchMock.mock.calls[1];
    expect(JSON.parse(createInit.body as string)).toEqual({ name: "장기요양보험" });
  });
});

describe("uploadMediaToWordPress", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    clearWordPressEnv();
  });

  const input = {
    filename: "care-guide-featured.webp",
    mimeType: "image/webp",
    altText: "alt text",
    caption: "caption",
    title: "title",
    description: "description",
  };

  it("WORDPRESS_MEDIA_UPLOAD_ENABLED=false(기본값)이면 실제 fetch 호출 없이 skipped를 반환한다", async () => {
    vi.stubEnv("WORDPRESS_MEDIA_UPLOAD_ENABLED", "false");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadMediaToWordPress(input);

    expect(result.status).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("WORDPRESS_MEDIA_UPLOAD_ENABLED=true이지만 WORDPRESS_PUBLISH_ENABLED=false이면 실제 fetch 호출 없이 dry_run을 반환한다", async () => {
    vi.stubEnv("WORDPRESS_MEDIA_UPLOAD_ENABLED", "true");
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "false");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadMediaToWordPress(input);

    expect(result.status).toBe("dry_run");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("두 플래그가 모두 true이고 env가 없으면 실제 fetch 호출 없이 failed를 반환한다", async () => {
    vi.stubEnv("WORDPRESS_MEDIA_UPLOAD_ENABLED", "true");
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");
    clearWordPressEnv();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadMediaToWordPress(input);

    expect(result.status).toBe("failed");
    expect(result.error).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sourceType이 없으면(source 미지정) 실제 fetch 호출 없이 failed를 반환한다", async () => {
    vi.stubEnv("WORDPRESS_MEDIA_UPLOAD_ENABLED", "true");
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");
    setWordPressEnv();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadMediaToWordPress(input);

    expect(result.status).toBe("failed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("허용되지 않는 mime type이면 실제 fetch 호출 없이 failed를 반환한다", async () => {
    vi.stubEnv("WORDPRESS_MEDIA_UPLOAD_ENABLED", "true");
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");
    setWordPressEnv();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadMediaToWordPress({
      ...input,
      mimeType: "image/gif",
      sourceType: "external_url",
      sourceUrl: "https://images.example.com/photo.gif",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("허용되지 않는 이미지 형식");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mock/상대경로 이미지 URL은 실제 업로드를 차단한다 (fetch 호출 없음)", async () => {
    vi.stubEnv("WORDPRESS_MEDIA_UPLOAD_ENABLED", "true");
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");
    setWordPressEnv();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadMediaToWordPress({
      ...input,
      sourceType: "generated_url",
      sourceUrl: "/mock/generated-images/article-1.webp",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("mock 또는 상대경로");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("external_url(http/https)이면 이미지를 다운로드해 media endpoint로 업로드한다", async () => {
    vi.stubEnv("WORDPRESS_MEDIA_UPLOAD_ENABLED", "true");
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");
    setWordPressEnv();

    const imageBytes = new Uint8Array([1, 2, 3, 4]);
    const fetchMock = vi
      .fn()
      // 1) 이미지 다운로드
      .mockResolvedValueOnce(new Response(imageBytes, { status: 200 }))
      // 2) media endpoint 업로드
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 55,
            source_url: "https://example-blog.test/wp-content/uploads/photo.webp",
            link: "https://example-blog.test/photo",
            mime_type: "image/webp",
            media_type: "image",
            title: { rendered: "title" },
          }),
          { status: 201, headers: { "content-type": "application/json" } }
        )
      )
      // 3) metadata 업데이트
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadMediaToWordPress({
      ...input,
      sourceType: "external_url",
      sourceUrl: "https://images.example.com/photo.webp",
    });

    expect(result.status).toBe("uploaded");
    expect(result.wordpressMediaId).toBe(55);
    expect(result.wordpressUrl).toBe("https://example-blog.test/wp-content/uploads/photo.webp");
    expect(result.metadataUpdateStatus).toBe("success");
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const [uploadUrl, uploadInit] = fetchMock.mock.calls[1];
    expect(String(uploadUrl)).toContain("/wp-json/wp/v2/media");
    const uploadHeaders = uploadInit.headers as Record<string, string>;
    expect(uploadHeaders.Authorization).toMatch(/^Basic /);
    expect(uploadHeaders.Authorization).not.toContain("dummy-app-password-for-tests");
  });

  it("media metadata 업데이트가 실패해도 업로드 성공은 유지된다 (warning)", async () => {
    vi.stubEnv("WORDPRESS_MEDIA_UPLOAD_ENABLED", "true");
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");
    setWordPressEnv();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 7, source_url: "https://example-blog.test/x.webp" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(new Response("forbidden", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadMediaToWordPress({
      ...input,
      sourceType: "external_url",
      sourceUrl: "https://images.example.com/photo.webp",
    });

    expect(result.status).toBe("uploaded");
    expect(result.wordpressMediaId).toBe(7);
    expect(result.metadataUpdateStatus).toBe("failed");
  });

  it("media endpoint HTTP 오류 응답이면 statusCode/reasonCandidate를 포함한 실패를 반환한다", async () => {
    vi.stubEnv("WORDPRESS_MEDIA_UPLOAD_ENABLED", "true");
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");
    setWordPressEnv();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401, statusText: "Unauthorized" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadMediaToWordPress({
      ...input,
      sourceType: "external_url",
      sourceUrl: "https://images.example.com/photo.webp",
    });

    expect(result.status).toBe("failed");
    expect(result.statusCode).toBe(401);
    expect(result.reasonCandidate).toBeTruthy();
    expect(result.reasonCandidate!.length).toBeGreaterThan(0);
  });

  it("Authorization header/password/이미지 binary가 반환값에 포함되지 않는다", async () => {
    vi.stubEnv("WORDPRESS_MEDIA_UPLOAD_ENABLED", "true");
    vi.stubEnv("WORDPRESS_PUBLISH_ENABLED", "true");
    setWordPressEnv();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(new Uint8Array([9, 9, 9]), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 3, source_url: "https://example-blog.test/y.webp" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadMediaToWordPress({
      ...input,
      sourceType: "external_url",
      sourceUrl: "https://images.example.com/photo.webp",
    });

    const serialized = JSON.stringify(result).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("dummy-app-password-for-tests");
    expect(serialized).not.toContain("basic ");
  });
});

describe("testWordPressConnection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearWordPressEnv();
  });

  it("환경변수가 없으면 실제 fetch 호출 없이 connected:false를 반환한다", async () => {
    clearWordPressEnv();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await testWordPressConnection();

    expect(result.connected).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("GET /wp-json/wp/v2/users/me를 호출하고 성공 시 connected:true와 displayName을 반환한다", async () => {
    setWordPressEnv();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ name: "관리자" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await testWordPressConnection();

    expect(result.connected).toBe(true);
    expect(result.displayName).toBe("관리자");
    expect(result.username).toBe("test-user");
    const [endpoint] = fetchMock.mock.calls[0];
    expect(String(endpoint)).toContain("/wp-json/wp/v2/users/me");
  });

  it("Authorization header를 사용하고 password를 평문으로 노출하지 않는다", async () => {
    setWordPressEnv();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ name: "관리자" }), { status: 200, headers: { "content-type": "application/json" } })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await testWordPressConnection();

    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^Basic /);
    expect(headers.Authorization).not.toContain("dummy-app-password-for-tests");
    expect(JSON.stringify(result)).not.toContain("dummy-app-password-for-tests");
  });

  it("401이면 원인 후보를 함께 반환한다", async () => {
    setWordPressEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401, statusText: "Unauthorized" }))
    );

    const result = await testWordPressConnection();

    expect(result.connected).toBe(false);
    expect(result.statusCode).toBe(401);
    expect(result.likelyCauses).toBeDefined();
    expect(result.likelyCauses!.length).toBeGreaterThan(0);
  });

  it("404이면 원인 후보를 함께 반환한다", async () => {
    setWordPressEnv();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not found", { status: 404, statusText: "Not Found" })));

    const result = await testWordPressConnection();

    expect(result.connected).toBe(false);
    expect(result.statusCode).toBe(404);
    expect(result.likelyCauses!.some((c) => c.includes("WORDPRESS_BASE_URL"))).toBe(true);
  });

  it("http(비-https) base URL이면 경고를 포함한다", async () => {
    process.env.WORDPRESS_BASE_URL = "http://example-blog.test";
    process.env.WORDPRESS_USERNAME = "test-user";
    process.env.WORDPRESS_APP_PASSWORD = "dummy-app-password-for-tests";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ name: "관리자" }), { status: 200, headers: { "content-type": "application/json" } })
      )
    );

    const result = await testWordPressConnection();

    expect(result.warnings).toBeDefined();
    expect(result.warnings!.some((w) => w.includes("https"))).toBe(true);
  });

  it("네트워크 오류 시 예외를 던지지 않고 connected:false를 반환한다", async () => {
    setWordPressEnv();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await testWordPressConnection();

    expect(result.connected).toBe(false);
    expect(result.errorMessage).toContain("network down");
  });
});

describe("updateDraftFeaturedMedia", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearWordPressEnv();
  });

  it("환경변수가 없으면 실제 fetch 호출 없이 실패를 반환한다", async () => {
    clearWordPressEnv();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await updateDraftFeaturedMedia(42, 7);

    expect(result.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("status='draft'와 featured_media만 전송한다 (공개 게시 금지)", async () => {
    setWordPressEnv();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ id: 42, link: "https://example-blog.test/?p=42", status: "draft", featured_media: 7 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await updateDraftFeaturedMedia(42, 7);

    expect(result.success).toBe(true);
    const [endpoint, init] = fetchMock.mock.calls[0];
    expect(String(endpoint)).toContain("/wp-json/wp/v2/posts/42");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ status: "draft", featured_media: 7 });
  });

  it("Authorization header를 사용하고 password를 평문으로 보내지 않는다", async () => {
    setWordPressEnv();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 1, link: "https://example-blog.test/?p=1", status: "draft" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await updateDraftFeaturedMedia(1, 5);

    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^Basic /);
    expect(headers.Authorization).not.toContain("dummy-app-password-for-tests");
  });

  it("성공 시 postId/link/status/featuredMedia를 반환한다", async () => {
    setWordPressEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ id: 99, link: "https://example-blog.test/?p=99", status: "draft", featured_media: 12 }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );

    const result = await updateDraftFeaturedMedia(99, 12);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.postId).toBe(99);
      expect(result.link).toBe("https://example-blog.test/?p=99");
      expect(result.status).toBe("draft");
      expect(result.featuredMedia).toBe(12);
    }
  });

  it("HTTP 오류 응답이면 statusCode/reasonCandidate를 포함한 실패를 반환한다", async () => {
    setWordPressEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("forbidden", { status: 403, statusText: "Forbidden" }))
    );

    const result = await updateDraftFeaturedMedia(1, 1);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.statusCode).toBe(403);
      expect(result.reasonCandidate.length).toBeGreaterThan(0);
    }
  });

  it("네트워크 오류 시 예외를 던지지 않고 안전한 실패를 반환한다", async () => {
    setWordPressEnv();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await updateDraftFeaturedMedia(1, 1);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorMessage).toContain("network down");
    }
  });

  it("반환값에 Authorization header/password가 포함되지 않는다", async () => {
    setWordPressEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: 1, link: "https://example-blog.test/?p=1", status: "draft" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    );

    const result = await updateDraftFeaturedMedia(1, 1);

    const serialized = JSON.stringify(result).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("dummy-app-password-for-tests");
    expect(serialized).not.toContain("basic ");
  });
});

describe("getMediaItem", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearWordPressEnv();
  });

  it("환경변수가 없으면 실제 fetch 호출 없이 exists:false를 반환한다", async () => {
    clearWordPressEnv();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await getMediaItem(7);

    expect(result.exists).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("media item이 존재하면 exists:true를 반환한다", async () => {
    setWordPressEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 7 }), { status: 200, headers: { "content-type": "application/json" } }))
    );

    const result = await getMediaItem(7);

    expect(result.exists).toBe(true);
  });

  it("404이면 exists:false와 statusCode 404를 반환한다", async () => {
    setWordPressEnv();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not found", { status: 404 })));

    const result = await getMediaItem(999);

    expect(result.exists).toBe(false);
    expect(result.statusCode).toBe(404);
  });

  it("네트워크 오류 시 예외를 던지지 않고 exists:false를 반환한다", async () => {
    setWordPressEnv();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await getMediaItem(1);

    expect(result.exists).toBe(false);
    expect(result.errorMessage).toContain("network down");
  });
});
