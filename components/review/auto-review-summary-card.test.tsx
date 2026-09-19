import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AutoReviewSummaryCard } from "./auto-review-summary-card";
import { summarizeAutoReview, summarizeUserFacingReview, type AutoReviewSummary } from "@/lib/social/social-post-auto-review";

function checklist(overrides: Array<{ key: string; status: "pass" | "fail" | "warning" | "blocked"; message: string }>) {
  return overrides;
}

describe("AutoReviewSummaryCard", () => {
  it("통과만 있으면 통과/확인 필요/수정 필요/차단 개수를 모두 0/N으로 보여준다", () => {
    const review = summarizeAutoReview(checklist([{ key: "content_present", status: "pass", message: "본문이 있습니다." }]));
    const html = renderToStaticMarkup(<AutoReviewSummaryCard review={review} contextNote={<p>글 유형: 테스트</p>} />);
    expect(html).toContain("통과 1개");
    expect(html).toContain("확인 필요 0개");
    expect(html).toContain("수정 필요 0개");
    expect(html).toContain("차단 0개");
    expect(html).toContain(review.overallLabel);
  });

  it("확인 필요/수정 필요/차단 개수를 각각 정확히 보여준다", () => {
    const review = summarizeAutoReview(
      checklist([
        { key: "a", status: "warning", message: "확인이 필요합니다." },
        { key: "b", status: "fail", message: "수정이 필요합니다." },
        { key: "content_present", status: "blocked", message: "차단되었습니다." },
      ])
    );
    const html = renderToStaticMarkup(<AutoReviewSummaryCard review={review} contextNote={<p>글 유형: 테스트</p>} />);
    expect(html).toContain("확인 필요 1개");
    expect(html).toContain("수정 필요 1개");
    expect(html).toContain("차단 1개");
  });

  it("labelPrefix를 붙이면 overallLabel 앞에 접두어가 붙는다(목록 카드용)", () => {
    const review = summarizeAutoReview(checklist([{ key: "content_present", status: "pass", message: "통과" }]));
    const html = renderToStaticMarkup(
      <AutoReviewSummaryCard review={review} contextNote={<p>글 유형</p>} labelPrefix="자동 검토 결과: " />
    );
    expect(html).toContain(`자동 검토 결과: ${review.overallLabel}`);
  });

  it("maxIssues를 넘으면 '그 외 N건'으로 줄인다", () => {
    const review = summarizeAutoReview(
      checklist([
        { key: "a", status: "warning", message: "이슈 A" },
        { key: "b", status: "warning", message: "이슈 B" },
        { key: "c", status: "warning", message: "이슈 C" },
      ])
    );
    const html = renderToStaticMarkup(<AutoReviewSummaryCard review={review} contextNote={<p>글 유형</p>} maxIssues={2} />);
    expect(html).toContain("이슈 A");
    expect(html).toContain("이슈 B");
    expect(html).not.toContain("이슈 C");
    expect(html).toContain("그 외 1건");
  });

  it("renderIssueActions로 issue별 액션(예: 수정하기 링크)을 붙일 수 있다", () => {
    const review = summarizeAutoReview(checklist([{ key: "a", status: "warning", message: "이슈 A" }]));
    const html = renderToStaticMarkup(
      <AutoReviewSummaryCard
        review={review}
        contextNote={<p>글 유형</p>}
        renderIssueActions={(issue) => <a href={`/edit#${issue.key}`}>수정하기</a>}
      />
    );
    expect(html).toContain("수정하기");
    expect(html).toContain('href="/edit#a"');
  });

  it("extraBanner를 카운트 아래, issue 목록 위에 보여준다", () => {
    const review = summarizeAutoReview(checklist([{ key: "a", status: "warning", message: "이슈 A" }]));
    const html = renderToStaticMarkup(
      <AutoReviewSummaryCard review={review} contextNote={<p>글 유형</p>} extraBanner={<p>자동으로 정리할 수 있는 항목이 있습니다.</p>} />
    );
    const bannerIdx = html.indexOf("자동으로 정리할 수 있는 항목이 있습니다.");
    const issueIdx = html.indexOf("이슈 A");
    expect(bannerIdx).toBeGreaterThan(-1);
    expect(bannerIdx).toBeLessThan(issueIdx);
  });

  it("footer를 issue 목록 아래, 톤 색상 박스 안에 보여준다", () => {
    const review = summarizeAutoReview(checklist([{ key: "a", status: "warning", message: "이슈 A" }]));
    const html = renderToStaticMarkup(
      <AutoReviewSummaryCard review={review} contextNote={<p>글 유형</p>} footer={<button>자동 재검토 실행</button>} />
    );
    const issueIdx = html.indexOf("이슈 A");
    const footerIdx = html.indexOf("자동 재검토 실행");
    expect(footerIdx).toBeGreaterThan(issueIdx);
  });

  it("hideIssueList=true면 issue 목록을 직접 렌더링하지 않는다(호출 측이 별도로 보여줄 때)", () => {
    const review = summarizeAutoReview(checklist([{ key: "a", status: "warning", message: "숨겨야 하는 이슈" }]));
    const html = renderToStaticMarkup(
      <AutoReviewSummaryCard review={review} contextNote={<p>글 유형</p>} hideIssueList />
    );
    expect(html).not.toContain("숨겨야 하는 이슈");
  });

  it("내부 fixability enum(auto_fixable/user_confirmation_required/blocking)을 화면에 그대로 노출하지 않는다", () => {
    const review = summarizeAutoReview(checklist([{ key: "a", status: "warning", message: "이슈" }]));
    const html = renderToStaticMarkup(<AutoReviewSummaryCard review={review} contextNote={<p>글 유형</p>} />);
    expect(html).not.toContain("auto_fixable");
    expect(html).not.toContain("user_confirmation_required");
    expect(html).not.toContain("blocking");
  });

  it("overallStatus별로 다른 톤 클래스(테두리/배경 색)를 적용한다", () => {
    const passed: AutoReviewSummary = summarizeAutoReview(checklist([{ key: "content_present", status: "pass", message: "통과" }]));
    const blocked: AutoReviewSummary = summarizeAutoReview(
      checklist([{ key: "content_present", status: "blocked", message: "차단" }])
    );
    const passedHtml = renderToStaticMarkup(<AutoReviewSummaryCard review={passed} contextNote={<p>유형</p>} />);
    const blockedHtml = renderToStaticMarkup(<AutoReviewSummaryCard review={blocked} contextNote={<p>유형</p>} />);
    expect(passedHtml).toContain("border-green-200");
    expect(blockedHtml).toContain("border-red-200");
  });
});

describe("AutoReviewSummaryCard userFacingSummary (Phase UX-04A: 기본 화면 단순화)", () => {
  it("userFacingSummary가 없으면 기존처럼 4개 카운트 줄을 그대로 보여준다(하위 호환)", () => {
    const review = summarizeAutoReview([{ key: "content_present", status: "pass", message: "통과" }]);
    const html = renderToStaticMarkup(<AutoReviewSummaryCard review={review} contextNote={<p>유형</p>} />);
    expect(html).toContain("통과 1개");
    expect(html).not.toContain("확인할 사항");
  });

  it("userFacingSummary가 있으면 기본 화면에 4개 카운트 대신 '확인할 사항 N건'을 보여준다", () => {
    const checklist = [
      { key: "wordpress_blog_body_depth", status: "fail" as const, message: "본문이 짧습니다." },
      { key: "news_article_no_unsourced_claim", status: "warning" as const, message: "출처를 확인하세요." },
    ];
    const review = summarizeAutoReview(checklist);
    const userFacingSummary = summarizeUserFacingReview("needs_revision", review, checklist);
    const html = renderToStaticMarkup(
      <AutoReviewSummaryCard review={review} contextNote={<p>유형</p>} userFacingSummary={userFacingSummary} />
    );
    expect(html).toContain("확인할 사항 1건");
    const defaultAreaHtml = html.slice(0, html.indexOf("자동 검토 상세"));
    expect(defaultAreaHtml).not.toMatch(/확인 필요 \d+개 · 수정 필요/);
  });

  it("auto_fixable 문제만 있으면 기본 화면 issue 목록에 노출하지 않는다", () => {
    const checklist = [{ key: "wordpress_blog_body_depth", status: "fail" as const, message: "본문이 짧습니다." }];
    const review = summarizeAutoReview(checklist);
    const userFacingSummary = summarizeUserFacingReview("needs_revision", review, checklist);
    const html = renderToStaticMarkup(
      <AutoReviewSummaryCard review={review} contextNote={<p>유형</p>} userFacingSummary={userFacingSummary} />
    );
    expect(html).toContain("확인할 사항 없음");
    // 자동 검토 상세(AdvancedDetails) 안에는 여전히 남아 있어야 한다(삭제 금지).
    expect(html).toContain("본문이 짧습니다.");
    expect(html).toContain("자동 검토 상세");
  });

  it("사람이 확인해야 하는 issue만 기본 화면에 보여주고, 전체 목록(auto_fixable 포함)은 자동 검토 상세 안에 둔다", () => {
    const checklist = [
      { key: "wordpress_blog_body_depth", status: "fail" as const, message: "auto-fixable 이슈 문구" },
      { key: "news_article_no_unsourced_claim", status: "warning" as const, message: "사람 확인 이슈 문구" },
    ];
    const review = summarizeAutoReview(checklist);
    const userFacingSummary = summarizeUserFacingReview("needs_revision", review, checklist);
    const html = renderToStaticMarkup(
      <AutoReviewSummaryCard review={review} contextNote={<p>유형</p>} userFacingSummary={userFacingSummary} />
    );
    const defaultAreaHtml = html.slice(0, html.indexOf("자동 검토 상세"));
    expect(defaultAreaHtml).toContain("사람 확인 이슈 문구");
    expect(defaultAreaHtml).not.toContain("auto-fixable 이슈 문구");
    expect(html).toContain("auto-fixable 이슈 문구"); // 상세 안에는 남아 있음
  });
});
