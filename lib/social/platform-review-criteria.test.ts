import { describe, expect, it } from "vitest";
import { getPlatformReviewCriteria } from "./platform-review-criteria";
import { SOCIAL_PLATFORMS } from "./social-platform-types";

describe("getPlatformReviewCriteria", () => {
  it("모든 플랫폼에 대해 purpose/criteriaSummary를 반환한다", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      const info = getPlatformReviewCriteria(platform);
      expect(info.purpose.length).toBeGreaterThan(0);
      expect(info.criteriaSummary.length).toBeGreaterThan(0);
    }
  });

  it("news_article은 FAQ/체크리스트를 강제하지 않는다는 안내를 포함한다", () => {
    const info = getPlatformReviewCriteria("news_article");
    expect(info.notEnforced).toContain("FAQ");
  });

  it("opinion_column은 관점/사실-의견 구분/반론을 기준으로 안내한다", () => {
    const info = getPlatformReviewCriteria("opinion_column");
    expect(info.criteriaSummary).toContain("관점");
    expect(info.criteriaSummary).toContain("반론");
  });

  it("wordpress_blog는 SEO/FAQ/체크리스트를 기준으로 안내한다", () => {
    const info = getPlatformReviewCriteria("wordpress_blog");
    expect(info.criteriaSummary).toContain("FAQ");
  });
});
