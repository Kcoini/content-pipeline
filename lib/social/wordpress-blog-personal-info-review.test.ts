import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostById: (...args: unknown[]) => mockGetSocialPostById(...args),
  updateSocialPostContent: (...args: unknown[]) => mockUpdateSocialPostContent(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
}));

const mockGetSocialPostById = vi.fn();
const mockUpdateSocialPostContent = vi.fn();
const mockLogEvent = vi.fn();

const {
  findWordPressBlogPersonalInfoSuspects,
  isRealPersonalInfoRisk,
  checkWordPressBlogPersonalInfoOverrideEligibility,
  confirmWordPressBlogPersonalInfoFalsePositive,
  openWordPressBlogSafetyReview,
  getManualSafetyReview,
} = await import("./wordpress-blog-personal-info-review");

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    articleId: "article-1",
    platform: "wordpress_blog",
    postTitle: "제목입니다",
    postBody: "본문입니다.",
    approvalStatus: "approved",
    platformMetadata: {},
    ...overrides,
  };
}

beforeEach(() => {
  mockGetSocialPostById.mockReset();
  mockUpdateSocialPostContent.mockReset();
  mockLogEvent.mockReset();
});

describe("findWordPressBlogPersonalInfoSuspects", () => {
  it("기관 대표번호(064-710-4252)는 phone_like_pattern으로 분류하고 첫 자리만 남기고 마스킹한다", () => {
    const post = makePost({ postBody: "문의처: 064-710-4252 로 연락하세요." });
    const suspects = findWordPressBlogPersonalInfoSuspects(post as never);

    expect(suspects).toHaveLength(1);
    expect(suspects[0].type).toBe("phone_like_pattern");
    expect(suspects[0].location).toBe("post_body");
    expect(suspects[0].maskedValue).toBe("064-***-****");
    expect(suspects[0].context).not.toContain("710-4252");
  });

  it("010으로 시작하는 번호는 mobile_phone_like(실제 위험)로 분류한다", () => {
    const post = makePost({ postBody: "연락처: 010-1234-5678" });
    const suspects = findWordPressBlogPersonalInfoSuspects(post as never);

    expect(suspects).toHaveLength(1);
    expect(suspects[0].type).toBe("mobile_phone_like");
    expect(suspects[0].maskedValue).toBe("010-****-****");
    expect(isRealPersonalInfoRisk(suspects[0].type)).toBe(true);
  });

  it("주민등록번호 형식은 resident_registration_number_like(실제 위험)로 분류하고 전부 마스킹한다", () => {
    const post = makePost({ postBody: "주민번호: 900101-1234567" });
    const suspects = findWordPressBlogPersonalInfoSuspects(post as never);

    expect(suspects).toHaveLength(1);
    expect(suspects[0].type).toBe("resident_registration_number_like");
    expect(suspects[0].maskedValue).toBe("******-*******");
    expect(isRealPersonalInfoRisk(suspects[0].type)).toBe(true);
  });

  it("post_title/seoTitle/metaDescription도 위치를 구분해서 스캔한다", () => {
    const post = makePost({
      postTitle: "문의: 070-1234-5678",
      postBody: "본문에는 없습니다.",
      platformMetadata: { seoTitle: "SEO: 031-123-4567", metaDescription: "설명: 053-987-6543" },
    });
    const suspects = findWordPressBlogPersonalInfoSuspects(post as never);
    const locations = suspects.map((s) => s.location).sort();
    expect(locations).toEqual(["meta_description", "post_title", "seo_title"]);
  });

  it("의심 패턴이 없으면 빈 배열을 반환한다", () => {
    const post = makePost({ postBody: "완전히 평범한 본문입니다." });
    expect(findWordPressBlogPersonalInfoSuspects(post as never)).toEqual([]);
  });
});

describe("checkWordPressBlogPersonalInfoOverrideEligibility", () => {
  it("개인정보 의심 이외의 다른 blocker가 있으면 eligible=false다", () => {
    const post = makePost({ postBody: "064-710-4252 그리고 지금 클릭하면 수익 보장" });
    const result = checkWordPressBlogPersonalInfoOverrideEligibility(post as never, {
      blockers: ["금지 표현이 발견되었습니다: 개인정보(주민등록번호/전화번호 형식) 의심, 광고 클릭"],
    });
    expect(result.eligible).toBe(false);
  });

  it("approval_status가 approved가 아니면 eligible=false다", () => {
    const post = makePost({ approvalStatus: "not_requested", postBody: "064-710-4252" });
    const result = checkWordPressBlogPersonalInfoOverrideEligibility(post as never, {
      blockers: ["금지 표현이 발견되었습니다: 개인정보(주민등록번호/전화번호 형식) 의심"],
    });
    expect(result.eligible).toBe(false);
  });

  it("실제 위험(010 휴대전화) 항목이 남아 있으면 eligible=false다", () => {
    const post = makePost({ postBody: "010-1234-5678" });
    const result = checkWordPressBlogPersonalInfoOverrideEligibility(post as never, {
      blockers: ["금지 표현이 발견되었습니다: 개인정보(주민등록번호/전화번호 형식) 의심"],
    });
    expect(result.eligible).toBe(false);
  });

  it("false positive 확인 기록이 없으면 eligible=false다", () => {
    const post = makePost({ postBody: "064-710-4252" });
    const result = checkWordPressBlogPersonalInfoOverrideEligibility(post as never, {
      blockers: ["금지 표현이 발견되었습니다: 개인정보(주민등록번호/전화번호 형식) 의심"],
    });
    expect(result.eligible).toBe(false);
  });

  it("false positive 확인 후 지문이 일치하고 다른 사유가 없으면 eligible=true다", async () => {
    const postBefore = makePost({ postBody: "064-710-4252" });
    mockGetSocialPostById.mockResolvedValue(postBefore);
    mockUpdateSocialPostContent.mockImplementation(async (_id: string, patch: Record<string, unknown>) => ({
      ...postBefore,
      ...patch,
    }));

    const confirmResult = await confirmWordPressBlogPersonalInfoFalsePositive("post-1", {
      reason: "공공기관 대표번호입니다.",
      confirmedBy: "tester",
    });
    expect(confirmResult.success).toBe(true);

    const savedPatch = mockUpdateSocialPostContent.mock.calls.at(-1)?.[1] as { platformMetadata: Record<string, unknown> };
    const postAfter = { ...postBefore, platformMetadata: savedPatch.platformMetadata };

    const result = checkWordPressBlogPersonalInfoOverrideEligibility(postAfter as never, {
      blockers: ["금지 표현이 발견되었습니다: 개인정보(주민등록번호/전화번호 형식) 의심"],
    });
    expect(result.eligible).toBe(true);
  });

  it("확인 이후 본문이 바뀌어 지문이 달라지면 다시 eligible=false다", async () => {
    const postBefore = makePost({ postBody: "064-710-4252" });
    mockGetSocialPostById.mockResolvedValue(postBefore);
    mockUpdateSocialPostContent.mockImplementation(async (_id: string, patch: Record<string, unknown>) => ({
      ...postBefore,
      ...patch,
    }));
    await confirmWordPressBlogPersonalInfoFalsePositive("post-1", { reason: "기관 번호", confirmedBy: "tester" });
    const savedPatch = mockUpdateSocialPostContent.mock.calls.at(-1)?.[1] as { platformMetadata: Record<string, unknown> };

    // 확인 이후 새로운 번호가 추가된 상황(내용 변경)을 흉내낸다.
    const postChanged = {
      ...postBefore,
      postBody: "064-710-4252 그리고 063-999-8888도 추가되었습니다.",
      platformMetadata: savedPatch.platformMetadata,
    };

    const result = checkWordPressBlogPersonalInfoOverrideEligibility(postChanged as never, {
      blockers: ["금지 표현이 발견되었습니다: 개인정보(주민등록번호/전화번호 형식) 의심"],
    });
    expect(result.eligible).toBe(false);
  });
});

describe("confirmWordPressBlogPersonalInfoFalsePositive", () => {
  it("wordpress_blog가 아니면 차단한다", async () => {
    mockGetSocialPostById.mockResolvedValue(makePost({ platform: "naver_blog" }));
    const result = await confirmWordPressBlogPersonalInfoFalsePositive("post-1", { reason: "사유", confirmedBy: "u" });
    expect(result.success).toBe(false);
  });

  it("사유(reason)가 없으면 차단한다", async () => {
    mockGetSocialPostById.mockResolvedValue(makePost({ postBody: "064-710-4252" }));
    const result = await confirmWordPressBlogPersonalInfoFalsePositive("post-1", { reason: "  ", confirmedBy: "u" });
    expect(result.success).toBe(false);
  });

  it("의심 항목이 없으면 차단한다", async () => {
    mockGetSocialPostById.mockResolvedValue(makePost({ postBody: "평범한 본문" }));
    const result = await confirmWordPressBlogPersonalInfoFalsePositive("post-1", { reason: "사유", confirmedBy: "u" });
    expect(result.success).toBe(false);
  });

  it("실제 개인정보(010 휴대전화)가 포함되어 있으면 확인을 거부한다", async () => {
    mockGetSocialPostById.mockResolvedValue(makePost({ postBody: "010-1234-5678" }));
    const result = await confirmWordPressBlogPersonalInfoFalsePositive("post-1", { reason: "사유", confirmedBy: "u" });
    expect(result.success).toBe(false);
  });

  it("실제 개인정보(주민등록번호)가 포함되어 있으면 확인을 거부한다", async () => {
    mockGetSocialPostById.mockResolvedValue(makePost({ postBody: "900101-1234567" }));
    const result = await confirmWordPressBlogPersonalInfoFalsePositive("post-1", { reason: "사유", confirmedBy: "u" });
    expect(result.success).toBe(false);
  });

  it("성공 시 platformMetadata.manualSafetyReview.prohibitedExpressionOverride를 저장하고 원문을 남기지 않는다", async () => {
    const post = makePost({ postBody: "문의처: 064-710-4252" });
    mockGetSocialPostById.mockResolvedValue(post);
    const result = await confirmWordPressBlogPersonalInfoFalsePositive("post-1", {
      reason: "제주도청 공식 대표번호입니다.",
      confirmedBy: "tester",
    });

    expect(result.success).toBe(true);
    const patch = mockUpdateSocialPostContent.mock.calls[0][1] as { platformMetadata: Record<string, unknown> };
    const override = (patch.platformMetadata.manualSafetyReview as Record<string, unknown>)
      .prohibitedExpressionOverride as Record<string, unknown>;
    expect(override.status).toBe("confirmed_false_positive");
    expect(override.reason).toBe("제주도청 공식 대표번호입니다.");
    expect(override.confirmedBy).toBe("tester");
    expect(JSON.stringify(patch)).not.toContain("710-4252");
    expect(JSON.stringify(patch)).toContain("064-***-****");
  });

  it("로그에도 원문(710-4252)이 남지 않고 마스킹된 값만 남는다", async () => {
    mockGetSocialPostById.mockResolvedValue(makePost({ postBody: "문의처: 064-710-4252" }));
    await confirmWordPressBlogPersonalInfoFalsePositive("post-1", { reason: "사유", confirmedBy: "tester" });

    const serialized = JSON.stringify(mockLogEvent.mock.calls);
    expect(serialized).not.toContain("710-4252");
    expect(serialized).toContain("064-***-****");
  });
});

describe("openWordPressBlogSafetyReview", () => {
  it("wordpress_blog 글의 현재 의심 항목을 반환하고 opened 이벤트를 로그로 남긴다", async () => {
    mockGetSocialPostById.mockResolvedValue(makePost({ postBody: "064-710-4252" }));
    const result = await openWordPressBlogSafetyReview("post-1");

    expect(result.success).toBe(true);
    expect(result.suspects).toHaveLength(1);
    expect(mockLogEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "wordpress_blog_safety_review_opened" }));
  });

  it("wordpress_blog가 아니면 차단한다", async () => {
    mockGetSocialPostById.mockResolvedValue(makePost({ platform: "naver_blog" }));
    const result = await openWordPressBlogSafetyReview("post-1");
    expect(result.success).toBe(false);
  });
});

describe("getManualSafetyReview", () => {
  it("manualSafetyReview가 없으면 null을 반환한다", () => {
    expect(getManualSafetyReview(makePost() as never)).toBeNull();
  });

  it("manualSafetyReview가 있으면 그대로 반환한다", () => {
    const record = { prohibitedExpressionOverride: { status: "confirmed_false_positive" } };
    const post = makePost({ platformMetadata: { manualSafetyReview: record } });
    expect(getManualSafetyReview(post as never)).toEqual(record);
  });
});
