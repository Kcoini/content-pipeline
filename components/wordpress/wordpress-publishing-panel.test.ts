import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const componentSource = readFileSync(path.join(__dirname, "wordpress-publishing-panel.tsx"), "utf8");

describe("WordPressPublishingPanel (정적 소스 검사)", () => {
  it("targetType별 대상 라벨(원본 article / wordpress_blog)을 표시한다", () => {
    expect(componentSource).toContain("원본 article");
    expect(componentSource).toContain("대상: {TARGET_LABEL[targetType]}");
  });

  it("isPrimaryWorkflow=false면 보조 기능/고급 기능 배지, true면 기본 게시 흐름/WordPress 블로그 글 기준 배지를 표시한다", () => {
    expect(componentSource).toContain("보조 기능");
    expect(componentSource).toContain("고급 기능");
    expect(componentSource).toContain("기본 게시 흐름");
    expect(componentSource).toContain("WordPress 블로그 글 기준");
    expect(componentSource).toContain("isPrimaryWorkflow ?");
  });

  it("lastUpdatedAt이 있으면 마지막 업데이트 시각을 표시한다", () => {
    expect(componentSource).toContain("마지막 업데이트 시각");
    expect(componentSource).toContain("summary.lastUpdatedAt");
  });

  it("article/wordpress_blog 설명 문구를 targetType별로 다르게 표시한다", () => {
    expect(componentSource).toContain("원본 article을 그대로 WordPress Draft로 전송할 때 사용합니다");
    expect(componentSource).toContain("이 기능은 WordPress 블로그 글로 생성된 wordpress_blog 콘텐츠를 WordPress Draft로 전송하거나 업데이트할 때 사용합니다");
    expect(componentSource).toContain("기사초안 원문이 아니라");
  });

  it("공통 표시 항목(품질/승인/Draft/SEO/대표 이미지/guard/마지막 실행 결과)을 모두 포함한다", () => {
    expect(componentSource).toContain("품질검사:");
    expect(componentSource).toContain("승인:");
    expect(componentSource).toContain("WordPress Draft:");
    expect(componentSource).toContain("WordPress Post/Draft ID");
    expect(componentSource).toContain("SEO 정보:");
    expect(componentSource).toContain("seoTitle");
    expect(componentSource).toContain("metaDescription");
    expect(componentSource).toContain("targetKeyword");
    expect(componentSource).toContain("대표 이미지:");
    expect(componentSource).toContain("WordPress media ID");
    expect(componentSource).toContain("대표 이미지 생략 여부");
    expect(componentSource).toContain("게시 준비 상태");
    expect(componentSource).toContain("마지막 실행 결과");
  });

  it("Phase UX-02B (C4): raw enum 값은 기본 화면에서 describeStatusValue로 번역해서 보여준다", () => {
    expect(componentSource).toContain('import { describeStatusValue } from "@/lib/social/status-labels"');
    expect(componentSource).toContain("describeStatusValue(summary.qualityStatus)");
    expect(componentSource).toContain("describeStatusValue(summary.approvalStatus)");
    expect(componentSource).toContain("describeStatusValue(summary.seoMetadataStatus)");
    expect(componentSource).toContain("describeStatusValue(summary.featuredImageStatus)");
    expect(componentSource).toContain("describeStatusValue(summary.publishGuardStatus)");
  });

  it("Phase UX-02B (C4): WordPress Post/Media ID, Media URL, raw publish guard/연결 상태, 마지막 업데이트 시각은 '상세 상태 보기' 접힘 안에만 있다", () => {
    const detailsIdx = componentSource.indexOf('<details className="mt-2">');
    expect(detailsIdx).toBeGreaterThan(-1);
    const beforeDetails = componentSource.slice(0, detailsIdx);
    const afterDetails = componentSource.slice(detailsIdx);

    expect(beforeDetails).not.toContain("WordPress Post/Draft ID");
    expect(beforeDetails).not.toContain("WordPress media ID");
    expect(beforeDetails).not.toContain("Media URL");
    expect(beforeDetails).not.toContain("마지막 업데이트 시각");
    expect(beforeDetails).not.toContain("게시 준비 상태");

    expect(afterDetails).toContain("WordPress Post/Draft ID");
    expect(afterDetails).toContain("WordPress media ID");
    expect(afterDetails).toContain("Media URL");
    expect(afterDetails).toContain("마지막 업데이트 시각");
    expect(afterDetails).toContain("게시 준비 상태");
    expect(afterDetails).toContain("상세 상태 보기");
  });

  it("Phase UX-02B (섹션 K): isPrimaryWorkflow=true(wordpress_blog)일 때는 children이 쓰는 'WordPress 게시 준비' 제목과 겹치지 않는 다른 제목을 쓴다", () => {
    expect(componentSource).toContain('const headingText = isPrimaryWorkflow ? "게시 상태 요약" : "WordPress 게시 준비"');
    expect(componentSource).toContain("{headingText}</p>");
  });

  it("기본 화면 요약(현재 상태)은 5줄 이내이고 children(다음 작업 버튼)보다 먼저 나온다", () => {
    const summaryListIdx = componentSource.indexOf("<ul className=");
    const childrenIdx = componentSource.indexOf("{children}");
    expect(summaryListIdx).toBeGreaterThan(-1);
    expect(childrenIdx).toBeGreaterThan(summaryListIdx);
  });

  it("실제 action을 직접 호출하지 않는다 (children으로만 전달받는 순수 표시 컴포넌트)", () => {
    expect(componentSource).not.toMatch(/formAction=|action={/);
    expect(componentSource).toContain("children");
  });

  it("article/wordpress_blog 데이터를 컴포넌트 내부에서 서로 섞지 않는다 (props로만 받음)", () => {
    expect(componentSource).not.toMatch(/getArticleById|getSocialPostById/);
  });

  it("SEO 필드가 없을 때 targetType별로 다른 안내 문구를 표시한다 (fallback 대체 아님)", () => {
    expect(componentSource).toContain("설정되지 않음");
    expect(componentSource).toContain("`${fieldLabel} 없음`");
    expect(componentSource).toContain('seoFieldMissingLabel(targetType, "SEO Title")');
    expect(componentSource).toContain('seoFieldMissingLabel(targetType, "Meta Description")');
    expect(componentSource).toContain('seoFieldMissingLabel(targetType, "Target Keyword")');
  });

  it("wordpress_blog에서 SEO 필드가 하나라도 없으면 metadata 재생성 안내를 표시한다 (article fallback 아님)", () => {
    expect(componentSource).toContain("metadata 재생성이 필요합니다");
    expect(componentSource).toContain("article의 SEO metadata로 자동 대체되지 않습니다");
  });

  it("대표 이미지 Media URL/연결 상태/오류 메시지/생략 사유를 표시할 수 있다", () => {
    expect(componentSource).toContain("Media URL");
    expect(componentSource).toContain("featuredImageAttachStatus");
    expect(componentSource).toContain("featuredImageErrorMessage");
    expect(componentSource).toContain("featuredImageWaiverReason");
  });

  it("secondaryKeywords를 표시할 수 있다", () => {
    expect(componentSource).toContain("secondaryKeywords");
  });
});
