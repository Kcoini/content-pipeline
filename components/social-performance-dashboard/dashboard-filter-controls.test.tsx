import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardFilterControls } from "./dashboard-filter-controls";
import { DEFAULT_DASHBOARD_FILTER, DEFAULT_DASHBOARD_SORT } from "@/lib/social/social-performance-dashboard-types";

// Phase UX-03C: 이 필터 폼은 라벨/옵션이 raw 영문 필드명·enum을 그대로
// 노출하고 있었다(content group/platform/tone_style/performance_status/
// manual_post_status label, platform·tone_style select option 값이
// {p}/{t} 그대로). 다른 대시보드 화면(/dashboard/blog, /dashboard/rewrite)은
// 이미 UX-02B에서 번역돼 있었는데 이 화면만 남아 있던 것을 이번 Phase에서
// 맞춘다.
describe("DashboardFilterControls (Phase UX-03C: raw 필드명/enum 노출 제거)", () => {
  const html = renderToStaticMarkup(
    <DashboardFilterControls filter={DEFAULT_DASHBOARD_FILTER} sort={DEFAULT_DASHBOARD_SORT} onlyPublished={false} onlyMeasured={false} />
  );

  it("라벨을 한국어로 표시한다(content group/platform/tone_style/performance_status/manual_post_status 그대로 노출 금지)", () => {
    expect(html).toContain("콘텐츠 그룹");
    expect(html).toContain(">플랫폼<");
    expect(html).toContain(">문체<");
    expect(html).not.toContain(">content group<");
    expect(html).not.toContain(">platform<");
    expect(html).not.toContain(">tone_style<");
    expect(html).not.toContain(">performance_status<");
    expect(html).not.toContain(">manual_post_status<");
  });

  it("platform/tone_style select option은 raw key가 아니라 공용 label helper로 번역한 텍스트를 보여준다", () => {
    expect(html).toContain("WordPress 블로그");
    expect(html).not.toContain(">wordpress_blog<");
  });

  it("performance_status/manual_post_status option도 raw enum이 아니라 describeStatusValue로 번역한다", () => {
    expect(html).not.toMatch(/<option value="not_measured">not_measured</);
    expect(html).not.toMatch(/<option value="ready_to_record">ready_to_record</);
  });

  it("정렬 옵션 라벨(화면에 보이는 텍스트)에 raw 컬럼명을 그대로 쓰지 않는다(select value 속성의 정렬 키 자체는 내부 값이라 허용)", () => {
    expect(html).not.toContain(">performance score");
    expect(html).not.toContain(">engagement_rate");
    expect(html).toContain("성과 점수 높은 순");
    expect(html).toContain("참여율 높은 순");
  });
});
