import { beforeEach, describe, expect, it, vi } from "vitest";

const getArticleById = vi.fn();
const saveArticleWordPressFeaturedImageWaiver = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
  saveArticleWordPressFeaturedImageWaiver: (...args: unknown[]) => saveArticleWordPressFeaturedImageWaiver(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const {
  waiveArticleWordPressFeaturedImage,
  clearArticleWordPressFeaturedImageWaiver,
  getArticleWordPressFeaturedImageWaiverState,
} = await import("./article-wordpress-featured-image-waiver-service");

function makeArticle(overrides: Record<string, unknown> = {}) {
  return {
    id: "article-1",
    themeId: "theme-1",
    formatMetadata: {},
    ...overrides,
  };
}

beforeEach(() => {
  getArticleById.mockReset();
  saveArticleWordPressFeaturedImageWaiver.mockReset();
  logEvent.mockReset();

  getArticleById.mockResolvedValue(makeArticle());
  saveArticleWordPressFeaturedImageWaiver.mockResolvedValue(makeArticle());
});

describe("waiveArticleWordPressFeaturedImage", () => {
  it("사유 없이 호출하면 차단한다", async () => {
    const result = await waiveArticleWordPressFeaturedImage("article-1", undefined);

    expect(result.success).toBe(false);
    expect(saveArticleWordPressFeaturedImageWaiver).not.toHaveBeenCalled();
  });

  it("허용되지 않은 사유 코드는 차단한다", async () => {
    const result = await waiveArticleWordPressFeaturedImage("article-1", "invalid_reason");

    expect(result.success).toBe(false);
    expect(saveArticleWordPressFeaturedImageWaiver).not.toHaveBeenCalled();
  });

  it("존재하지 않는 기사면 차단한다", async () => {
    getArticleById.mockResolvedValue(undefined);

    const result = await waiveArticleWordPressFeaturedImage("missing", "text_focused");

    expect(result.success).toBe(false);
    expect(saveArticleWordPressFeaturedImageWaiver).not.toHaveBeenCalled();
  });

  it("유효한 사유면 targetType='article'로 waived=true 저장한다", async () => {
    const result = await waiveArticleWordPressFeaturedImage("article-1", "no_suitable_image");

    expect(result.success).toBe(true);
    expect(saveArticleWordPressFeaturedImageWaiver).toHaveBeenCalledWith("article-1", {
      waived: true,
      reasonCode: "no_suitable_image",
      memoPresent: false,
    });
  });

  it("사유가 'other'가 아니면 memo가 있어도 memoPresent는 false다", async () => {
    await waiveArticleWordPressFeaturedImage("article-1", "text_focused", "이 메모는 무시되어야 함");

    const call = saveArticleWordPressFeaturedImageWaiver.mock.calls[0][1];
    expect(call.memoPresent).toBe(false);
  });

  it("사유가 'other'이고 memo가 있으면 memoPresent=true다 (memo 원문은 저장하지 않음)", async () => {
    await waiveArticleWordPressFeaturedImage("article-1", "other", "상세 사유");

    const call = saveArticleWordPressFeaturedImageWaiver.mock.calls[0][1];
    expect(call.memoPresent).toBe(true);
    expect(JSON.stringify(call)).not.toContain("상세 사유");
  });

  it("로그에는 targetType/reasonCode/memoPresent/status만 남기고 memo 원문은 남기지 않는다", async () => {
    await waiveArticleWordPressFeaturedImage("article-1", "other", "민감할 수 있는 상세 메모");

    const call = logEvent.mock.calls[0][0];
    const serialized = JSON.stringify(call.details);
    expect(serialized).not.toContain("민감할 수 있는 상세 메모");
    expect(call.details.targetType).toBe("article");
    expect(call.details.reasonCode).toBe("other");
    expect(call.details.memoPresent).toBe(true);
    expect(call.targetType).toBe("article");
  });
});

describe("clearArticleWordPressFeaturedImageWaiver", () => {
  it("waived 상태가 아니면 아무 것도 저장하지 않는다", async () => {
    getArticleById.mockResolvedValue(makeArticle({ formatMetadata: {} }));

    await clearArticleWordPressFeaturedImageWaiver("article-1");

    expect(saveArticleWordPressFeaturedImageWaiver).not.toHaveBeenCalled();
  });

  it("waived 상태이면 waived=false/reasonCode=null로 초기화한다", async () => {
    getArticleById.mockResolvedValue(
      makeArticle({
        formatMetadata: {
          article_wordpress_featured_image_waiver: {
            targetType: "article",
            featuredImageWaived: true,
            featuredImageWaiverReason: "text_focused",
            featuredImageWaiverMemoPresent: false,
          },
        },
      })
    );

    await clearArticleWordPressFeaturedImageWaiver("article-1");

    expect(saveArticleWordPressFeaturedImageWaiver).toHaveBeenCalledWith("article-1", {
      waived: false,
      reasonCode: null,
      memoPresent: false,
    });
  });

  it("존재하지 않는 기사면 아무 것도 하지 않는다", async () => {
    getArticleById.mockResolvedValue(undefined);

    await clearArticleWordPressFeaturedImageWaiver("missing");

    expect(saveArticleWordPressFeaturedImageWaiver).not.toHaveBeenCalled();
  });
});

describe("getArticleWordPressFeaturedImageWaiverState", () => {
  it("formatMetadata가 비어 있으면 기본값(waived=false)을 반환한다", () => {
    const state = getArticleWordPressFeaturedImageWaiverState(makeArticle({ formatMetadata: {} }) as never);
    expect(state).toEqual({ waived: false, reasonCode: null, memoPresent: false });
  });

  it("article_wordpress_featured_image_waiver를 읽어 반환한다", () => {
    const state = getArticleWordPressFeaturedImageWaiverState(
      makeArticle({
        formatMetadata: {
          article_wordpress_featured_image_waiver: {
            featuredImageWaived: true,
            featuredImageWaiverReason: "manual_later",
            featuredImageWaiverMemoPresent: false,
          },
        },
      }) as never
    );
    expect(state).toEqual({ waived: true, reasonCode: "manual_later", memoPresent: false });
  });

  it("wordpress_blog(social_posts.platformMetadata) 쪽 waived 키와는 무관하다", () => {
    // article.formatMetadata에 blog 쪽에서 쓰는 featuredImage.waived 형태가 실수로
    // 들어와도 무시해야 한다 (읽는 키 자체가 다르다: article_wordpress_featured_image_waiver).
    const state = getArticleWordPressFeaturedImageWaiverState(
      makeArticle({ formatMetadata: { featuredImage: { waived: true } } }) as never
    );
    expect(state.waived).toBe(false);
  });
});
