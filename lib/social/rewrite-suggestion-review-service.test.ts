import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPostRewriteSuggestion } from "./social-rewrite-types";

const getRewriteSuggestionById = vi.fn();
const updateRewriteSuggestionStatus = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-rewrite-suggestions-repository", () => ({
  getRewriteSuggestionById: (...args: unknown[]) => getRewriteSuggestionById(...args),
  updateRewriteSuggestionStatus: (...args: unknown[]) => updateRewriteSuggestionStatus(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { approveRewriteSuggestion, rejectRewriteSuggestion } = await import("./rewrite-suggestion-review-service");

function makeSuggestion(overrides: Partial<SocialPostRewriteSuggestion> = {}): SocialPostRewriteSuggestion {
  return {
    id: "suggestion-1",
    socialPostId: "social-post-1",
    articleId: "article-1",
    platform: "naver_blog",
    toneStyle: "informational",
    originalPerformanceStatus: "low",
    originalPerformanceScore: 15,
    suggestionStatus: "ready",
    diagnosis: {},
    suggestedChanges: {},
    suggestedTitle: "제목",
    suggestedHook: null,
    suggestedBodyOutline: [],
    suggestedCta: null,
    suggestedHashtags: [],
    suggestedThreadItems: [],
    suggestedCardItems: [],
    suggestedToneStyle: null,
    riskNotes: [],
    qualityNotes: [],
    expectedImprovementReason: null,
    generatedBy: "mock",
    generatedAt: "2026-01-11T00:00:00.000Z",
    reviewedBy: null,
    reviewedAt: null,
    appliedAt: null,
    rejectedReason: null,
    createdAt: "2026-01-11T00:00:00.000Z",
    updatedAt: "2026-01-11T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  getRewriteSuggestionById.mockReset();
  updateRewriteSuggestionStatus.mockReset();
  logEvent.mockReset();
  logEvent.mockResolvedValue({});
});

describe("approveRewriteSuggestion", () => {
  it("ready 상태의 제안은 승인할 수 있다", async () => {
    getRewriteSuggestionById.mockResolvedValue(makeSuggestion({ suggestionStatus: "ready" }));
    updateRewriteSuggestionStatus.mockResolvedValue(makeSuggestion({ suggestionStatus: "approved" }));

    const result = await approveRewriteSuggestion("suggestion-1", "editor");

    expect(result.success).toBe(true);
    expect(updateRewriteSuggestionStatus).toHaveBeenCalledWith("suggestion-1", "approved", expect.objectContaining({ reviewedBy: "editor" }));
  });

  it("needs_review 상태의 제안도 승인할 수 있다", async () => {
    getRewriteSuggestionById.mockResolvedValue(makeSuggestion({ suggestionStatus: "needs_review" }));
    updateRewriteSuggestionStatus.mockResolvedValue(makeSuggestion({ suggestionStatus: "approved" }));

    const result = await approveRewriteSuggestion("suggestion-1", "editor");

    expect(result.success).toBe(true);
  });

  it("blocked 상태의 제안은 승인할 수 없다", async () => {
    getRewriteSuggestionById.mockResolvedValue(makeSuggestion({ suggestionStatus: "blocked" }));

    const result = await approveRewriteSuggestion("suggestion-1", "editor");

    expect(result.success).toBe(false);
    expect(updateRewriteSuggestionStatus).not.toHaveBeenCalled();
  });
});

describe("rejectRewriteSuggestion", () => {
  it("제안을 반려할 수 있다", async () => {
    getRewriteSuggestionById.mockResolvedValue(makeSuggestion());
    updateRewriteSuggestionStatus.mockResolvedValue(makeSuggestion({ suggestionStatus: "rejected", rejectedReason: "부적절" }));

    const result = await rejectRewriteSuggestion("suggestion-1", "editor", "부적절");

    expect(result.success).toBe(true);
    expect(result.suggestion?.suggestionStatus).toBe("rejected");
  });
});
