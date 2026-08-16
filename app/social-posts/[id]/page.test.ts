import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");

describe("social post detail page (정적 소스 검사, Phase 3-18)", () => {
  it("returnTo searchParam을 읽고 getSafeReturnTo로 검증한다", () => {
    expect(pageSource).toContain("returnTo?: string");
    expect(pageSource).toContain("getSafeReturnTo(returnTo");
  });

  it("full export_payload/handoff_payload/dry_run_payload 원문을 직접 렌더링하지 않는다 (키 개수만 표시)", () => {
    expect(pageSource).not.toMatch(/\{p\.exportPayload\}/);
    expect(pageSource).not.toMatch(/\{p\.handoffPayload\}/);
    expect(pageSource).not.toMatch(/\{p\.platformPublishDryRunPayload\}/);
    expect(pageSource).toContain("Object.keys(p.exportPayload");
  });

  it("post_body/caption preview + 펼치기(details) 구조를 사용한다", () => {
    expect(pageSource).toContain("truncate(p.postBody");
    expect(pageSource).toContain("truncate(p.caption");
    expect(pageSource).toContain("<details");
  });

  it("SocialPostDetailNavigation을 사용한다", () => {
    expect(pageSource).toContain("SocialPostDetailNavigation");
  });

  it("spec에 명시된 상태 필드를 표시한다", () => {
    const requiredFields = [
      "quality_status",
      "approval_status",
      "publish_status",
      "export_status",
      "platform_publish_guard_status",
      "platform_publish_dry_run_status",
      "handoff_status",
      "manual_post_status",
      "performance_status",
      "latest_performance_score",
      "latest_metrics_recorded_at",
      "rewrite_suggestion_status",
      "version_comparison_status",
      "recommended_for_repost",
      "rewrite_reapproval_status",
      "rewrite_reexport_status",
      "rewrite_republish_workflow_status",
      "rewrite_performance_comparison_status",
    ];
    for (const field of requiredFields) {
      expect(pageSource).toContain(field);
    }
  });

  it("logs에 full body/caption/API key를 남기지 않는다 (상태값 요약만 기록)", () => {
    expect(pageSource).not.toMatch(/details:\s*\{[^}]*postBody/);
    expect(pageSource).not.toMatch(/details:\s*\{[^}]*caption/);
    expect(pageSource).not.toContain("apiKey");
    expect(pageSource).not.toContain("Authorization");
  });
});

describe("social post detail page — API publishing preparation (정적 소스 검사, Phase 3-21)", () => {
  it("readiness/eligibility를 표시하고 dry-run payload를 보여줄 수 있다", () => {
    expect(pageSource).toContain("checkPlatformApiReadiness");
    expect(pageSource).toContain("checkPlatformApiPublishEligibility");
    expect(pageSource).toContain("ApiReadinessSummary");
    expect(pageSource).toContain("ApiDryRunPayloadPreview");
  });

  it("API 게시 준비 상태 확인 action을 사용하고 actual publish 버튼은 없다", () => {
    expect(pageSource).toContain("preparePlatformApiPublishingAction");
    expect(pageSource).not.toContain("실제 게시 실행");
  });

  it("이번 단계가 준비 확인 단계이며 자동 게시가 비활성화되어 있다는 안내를 표시한다", () => {
    expect(pageSource).toContain("API 게시 준비 상태 확인입니다");
    expect(pageSource).toContain("비활성화되어 있습니다");
    expect(pageSource).toContain("토큰이나 API key 값은 화면에 표시하지 않습니다");
  });
});
