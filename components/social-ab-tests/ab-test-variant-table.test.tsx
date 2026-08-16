import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AbTestVariantTable } from "./ab-test-variant-table";
import type { SocialAbTestVariant } from "@/lib/social/social-ab-testing-types";

function makeVariant(overrides: Partial<SocialAbTestVariant> = {}): SocialAbTestVariant {
  return {
    id: "variant-1",
    abTestId: "test-1",
    articleId: "article-1",
    socialPostId: "post-1",
    variantLabel: "원본 (control)",
    variantRole: "control" as const,
    variantDescription: null,
    variantHypothesis: null,
    platform: "wordpress_blog",
    toneStyle: "informational",
    versionNumber: 1,
    isControl: true,
    isRewriteVersion: false,
    manualPostStatus: "posted",
    postUrl: null,
    latestMetricsId: null,
    latestPerformanceScore: 72.5,
    latestMetricsRecordedAt: "2026-01-01T00:00:00.000Z",
    variantStatus: "measured",
    resultRank: 1,
    resultNotes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("AbTestVariantTable", () => {
  it("variant가 없으면 안내 문구를 렌더링한다", () => {
    const html = renderToStaticMarkup(<AbTestVariantTable variants={[]} />);
    expect(html).toContain("아직 추가된 variant가 없습니다");
  });

  it("variant 목록을 표로 렌더링한다", () => {
    const html = renderToStaticMarkup(<AbTestVariantTable variants={[makeVariant()]} />);
    expect(html).toContain("원본 (control)");
    expect(html).toContain("control");
    expect(html).toContain("72.5");
    expect(html).toContain("measured");
  });
});
