import { beforeEach, describe, expect, it, vi } from "vitest";

const listSocialPostsForPublishSafetyAudit = vi.fn();

vi.mock("@/lib/repositories/automation-safety-review-repository", () => ({
  listSocialPostsForPublishSafetyAudit: (...args: unknown[]) => listSocialPostsForPublishSafetyAudit(...args),
}));

const { auditContentSafetyRules } = await import("./content-safety-auditor");

function makeSocialPost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    postTitle: "제목",
    postBody: "평범한 본문입니다.",
    caption: null,
    excerpt: null,
    threadItems: [],
    cardItems: [],
    ...overrides,
  };
}

beforeEach(() => {
  listSocialPostsForPublishSafetyAudit.mockReset();
});

describe("auditContentSafetyRules", () => {
  it("금지 표현 검사기 존재 여부를 확인한다", async () => {
    listSocialPostsForPublishSafetyAudit.mockResolvedValue([]);
    const result = await auditContentSafetyRules();
    const check = result.ruleChecks.find((r) => r.id === "forbidden_pattern_checker_exists");
    expect(check?.exists).toBe(true);
  });

  it("위협/공포조장/광고클릭유도 패턴이 있는 social_post를 탐지한다", async () => {
    listSocialPostsForPublishSafetyAudit.mockResolvedValue([
      makeSocialPost({ id: "risky-1", postBody: "지금 안 하면 큰일 납니다. 지금 클릭하세요." }),
      makeSocialPost({ id: "safe-1", postBody: "평범한 안내문입니다." }),
    ]);
    const result = await auditContentSafetyRules();
    expect(result.sampleFindings.some((f) => f.socialPostId === "risky-1")).toBe(true);
    expect(result.sampleFindings.some((f) => f.socialPostId === "safe-1")).toBe(false);
  });

  it("전체 콘텐츠 원문은 결과에 포함되지 않는다", async () => {
    const riskyText = "지금 안 하면 큰일 납니다 - 이 특정 문구는 로그에 남으면 안 됨";
    listSocialPostsForPublishSafetyAudit.mockResolvedValue([makeSocialPost({ id: "risky-2", postBody: riskyText })]);
    const result = await auditContentSafetyRules();
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(riskyText);
  });
});
