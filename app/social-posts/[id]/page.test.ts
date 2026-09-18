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

  it("naver_cafe는 게시용 미리보기 탭에서 getSocialPostDisplayBody로 정리된 본문을 보여준다(Phase 3-20, Phase 4-26에서 raw 탭의 중복 표시 제거)", () => {
    // Phase 4-26: raw 탭 안에 있던 "본문 미리보기"(sanitizeNaverCafePlainText를
    // 직접 다시 호출하는 중복 블록)를 제거했다 — sanitize 자체는
    // getSocialPostDisplayBody(social-post-display.ts) 안에서 이미
    // 일어나고, "게시용 미리보기" 탭이 그 결과를 보여준다. 그 로직은
    // lib/social/social-post-display.test.ts에서 검증한다.
    expect(pageSource).toContain("getSocialPostDisplayBody(p)");
    expect(pageSource).not.toContain("sanitizeNaverCafePlainText");
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

describe("사용자 친화적 라벨 (정적 소스 검사, Phase 3-24)", () => {
  it("DB 컬럼명(is_rewrite_version/version_number/parent_social_post_id/root_social_post_id)이 기본 화면의 라벨로 그대로 나오지 않는다", () => {
    expect(pageSource).not.toMatch(/<dt className="font-medium text-zinc-600">is_rewrite_version<\/dt>/);
    expect(pageSource).not.toMatch(/<dt className="font-medium text-zinc-600">version_number<\/dt>/);
    expect(pageSource).not.toMatch(/<dt className="font-medium text-zinc-600">parent_social_post_id<\/dt>/);
    expect(pageSource).not.toMatch(/<dt className="font-medium text-zinc-600">root_social_post_id<\/dt>/);
    // 대신 describeStatusField로 한국어 라벨을 계산해서 쓴다.
    expect(pageSource).toContain('describeStatusField("is_rewrite_version")');
    expect(pageSource).toContain('describeStatusField("version_number")');
    expect(pageSource).toContain('describeStatusField("parent_social_post_id")');
    expect(pageSource).toContain('describeStatusField("root_social_post_id")');
  });

  it("버전 정보 카드는 raw id 문자열 대신 사용자 행동 링크('이전 버전 글 보기'/'원본 글 보기')를 기본으로 보여준다", () => {
    expect(pageSource).toContain("이전 버전 글 보기 →");
    expect(pageSource).toContain("원본 글 보기 →");
    expect(pageSource).toContain("재작성 버전입니다");
  });

  it("헤더에 social_post id/article_id가 raw 텍스트로 노출되지 않는다(내부 원문 보기 탭 안으로 이동)", () => {
    expect(pageSource).not.toContain("social_post id:");
    expect(pageSource).not.toContain("(article_id:");
    expect(pageSource).toContain("글 ID");
    expect(pageSource).toContain("기사 ID");
  });

  it("플랫폼/문체를 raw enum이 아니라 PLATFORM_LABELS/TONE_STYLE_CONFIGS 라벨로 표시한다", () => {
    expect(pageSource).toContain('import { PLATFORM_LABELS } from "@/lib/social/platform-generation-recommendations"');
    expect(pageSource).toContain('import { TONE_STYLE_CONFIGS } from "@/lib/social/tone-style-config"');
    expect(pageSource).toContain("PLATFORM_LABELS[p.platform]");
    expect(pageSource).toContain("TONE_STYLE_CONFIGS[p.toneStyle].label");
  });

  it("영어 섹션 제목(API Publishing (준비 단계)/A/B Test)이 한국어로 바뀐다", () => {
    expect(pageSource).not.toContain("API Publishing (준비 단계)");
    expect(pageSource).toContain("API 게시 준비 상태");
    expect(pageSource).not.toContain('<h2 className="text-sm font-semibold text-zinc-700">A/B Test</h2>');
    expect(pageSource).toContain("글 반응 비교(A/B Test)");
  });

  it("상태값(quality_status 등)은 describeStatusValue로 변환되어 raw enum이 그대로 보이지 않는다", () => {
    expect(pageSource).toContain('import { describeStatusValue, describeStatusField } from "@/lib/social/status-labels"');
    expect(pageSource).toContain("describeStatusValue(p.qualityStatus)");
    expect(pageSource).toContain("describeStatusValue(p.approvalStatus)");
  });
});

describe("자동 검토 결과 섹션 (정적 소스 검사, Phase 3-25/3-26)", () => {
  it("summarizeAutoReview로 통과/확인 필요/수정 필요/차단 리포트를 계산한다(DB에 새로 쓰지 않는다)", () => {
    expect(pageSource).toContain('from "@/lib/social/social-post-auto-review"');
    expect(pageSource).toContain("summarizeAutoReview(checklist");
    expect(pageSource).toContain("describeApprovalReadiness(review)");
  });

  it("아직 자동 검토를 실행하지 않았으면 raw quality_status 대신 안내 문구를 보여준다", () => {
    expect(pageSource).toContain("describeAutoReviewNotRunYet(p.qualityStatus)");
  });
});

describe("Phase 3-26: 단일 글 상세 검토·수정·승인 화면", () => {
  it("페이지 안내 문구가 더 이상 '읽기 전용'을 강조하지 않고 검토·수정·승인 화면임을 안내한다", () => {
    expect(pageSource).not.toContain("읽기 전용으로 보여줍니다");
    expect(pageSource).toContain("최종 검토·수정·승인하는 화면");
  });

  it("상단 요약 카드가 플랫폼/문체/상태/자동 검토 요약/다음 작업을 보여주고 주요 버튼 1개를 계산한다", () => {
    expect(pageSource).toContain("지금 상태 요약");
    expect(pageSource).toContain("getSocialPostWorkspacePrimaryAction(p.qualityStatus, p.approvalStatus, review)");
    expect(pageSource).toContain("다음 작업");
  });

  it("탭 3개(게시용 미리보기/수정하기/내부 원문 보기)를 button 역할(role=tab)과 aria-selected로 구현한다", () => {
    expect(pageSource).toContain('role="tablist"');
    expect(pageSource).toContain('role="tab"');
    expect(pageSource).toContain("aria-selected={tab === value}");
    expect(pageSource).toContain("게시용 미리보기");
    expect(pageSource).toContain('"수정하기"');
    expect(pageSource).toContain("내부 원문 보기");
  });

  it("기본 탭은 게시용 미리보기이고 내부 원문은 기본으로 노출되지 않는다(raw 탭을 선택해야 보인다)", () => {
    expect(pageSource).toContain('tabRaw === "edit" ? "edit" : tabRaw === "raw" ? "raw" : "preview"');
    expect(pageSource).toContain('tab === "raw" &&');
  });

  it("플랫폼별 게시용 미리보기 헬퍼(getPlatformPreviewMode/getPlatformBodyLabel/getPlatformBodyWarnings)를 사용한다", () => {
    expect(pageSource).toContain('from "@/lib/social/social-post-platform-preview"');
    expect(pageSource).toContain("getPlatformPreviewMode(p.platform)");
    expect(pageSource).toContain("getPlatformBodyLabel(p.platform)");
    expect(pageSource).toContain("getPlatformBodyWarnings(p)");
  });

  it("wordpress_blog는 HTML로 렌더링하고(ensureWordPressHtmlContent), raw markdown(##, **)을 그대로 노출하지 않는다", () => {
    expect(pageSource).toContain("ensureWordPressHtmlContent");
    expect(pageSource).toContain('previewMode === "wordpress_html"');
    expect(pageSource).toContain("dangerouslySetInnerHTML");
  });

  it("naver_cafe는 plain text 미리보기이고 질문형 문장 경고를 getPlatformBodyWarnings가 계산한다", () => {
    expect(pageSource).toContain('previewMode === "plain_text"');
  });

  it("x는 스레드 항목별 번호와 글자 수를 보여준다", () => {
    expect(pageSource).toContain('p.platform === "x" && p.threadItems.length > 0');
    expect(pageSource).toContain("번째 ·");
    expect(pageSource).toContain("item.text.length");
  });

  it("instagram은 caption/hashtags/card text를 구분해서 보여준다", () => {
    expect(pageSource).toContain("캡션");
    expect(pageSource).toContain("해시태그");
    expect(pageSource).toContain("카드 문구");
  });

  it("자동 검토 이슈마다 [수정하기]/[본문 위치 보기] 링크가 있고 각각 edit/preview 탭으로 이동한다", () => {
    expect(pageSource).toContain('buildTabHref(p.id, "edit", returnTo)}#edit-panel`');
    expect(pageSource).toContain('buildTabHref(p.id, "preview", returnTo)}#publish-preview`');
  });

  it("수정하기 탭은 editSocialPostAction을 재사용하고 플랫폼별 writingConfig로 필요한 필드만 보여준다", () => {
    expect(pageSource).toContain("editSocialPostAction");
    expect(pageSource).toContain("runSocialPostQualityGateAction");
    expect(pageSource).toContain("approveSocialPostAction");
    expect(pageSource).toContain('from "@/app/articles/[id]/actions"');
    expect(pageSource).toContain("<form action={editSocialPostAction}");
    expect(pageSource).toContain("writingConfig.supportsTitle");
    expect(pageSource).toContain("writingConfig.supportsBody");
    expect(pageSource).toContain("writingConfig.supportsCaption");
  });

  it("수정하기 탭에 returnTo hidden input이 있어 저장 후 이 페이지로 돌아온다", () => {
    expect(pageSource).toContain('name="returnTo" value={selfReturnTo("edit")}');
  });

  it("자동 재검토 실행 버튼이 있고 기존 runSocialPostQualityGateAction을 재사용한다(새 검사 엔진을 만들지 않는다)", () => {
    expect(pageSource).toContain("<form action={runSocialPostQualityGateAction}");
    expect(pageSource).toContain("자동 재검토 실행");
  });

  it("최종 승인 패널은 disabled 이유를 표시하고 approveSocialPostAction을 재사용한다(사람이 직접 눌러야 한다)", () => {
    expect(pageSource).toContain('id="final-approval-panel"');
    expect(pageSource).toContain("getApprovalGateStatus(");
    expect(pageSource).toContain("disabled={!gate.canApprove}");
    expect(pageSource).toContain("gate.reason");
    expect(pageSource).toContain("<form action={approveSocialPostAction}");
    expect(pageSource).toContain("자동 공개 게시는 실행하지 않습니다");
  });

  it("자동 검토 통과만으로 자동 승인되지 않는다(승인 버튼은 항상 사람의 클릭이 필요하다)", () => {
    expect(pageSource).not.toMatch(/approveSocialPostAction\(/);
    expect(pageSource).not.toContain("자동으로 승인");
  });

  it("Phase 4-29: 승인 완료 후 플랫폼별 다음 작업은 getPostApprovalNextActions로 계산한다(구 버전 고정 링크 대신)", () => {
    expect(pageSource).toContain('from "@/lib/social/post-approval-next-actions"');
    expect(pageSource).toContain("getPostApprovalNextActions({");
    expect(pageSource).not.toContain("WordPress Draft 반영하기");
    expect(pageSource).not.toContain("게시 전 미리보기 →");
  });

  it("raw enum/quality_status 원문이 상단 요약이나 최종 승인 패널의 기본 라벨로 그대로 노출되지 않는다(describeStatusValue/describeAutoReviewNotRunYet을 거친다)", () => {
    expect(pageSource).not.toMatch(/다음 작업<\/dt>\s*<dd[^>]*>\{p\.qualityStatus\}/);
  });
});

describe("social post detail page — 글 유형별 검토 기준 표시 + 불일치 감지 (정적 소스 검사, Phase 4-5)", () => {
  it("자동 검토 결과에 글 유형과 적용된 검토 기준을 항상 먼저 보여준다", () => {
    expect(pageSource).toContain("getPlatformReviewCriteria");
    expect(pageSource).toContain("글 유형: {PLATFORM_LABELS[p.platform]}");
    expect(pageSource).toContain("reviewCriteria.criteriaSummary");
  });

  it("글 유형과 본문 형태가 어긋나면 '글 유형 확인 필요'로 표시하고 수정 탭으로 연결한다", () => {
    expect(pageSource).toContain("detectContentTypeMismatch");
    expect(pageSource).toContain("글 유형 확인 필요");
    expect(pageSource).toContain("contentTypeMismatch.mismatched");
    expect(pageSource).toMatch(/buildTabHref\(p\.id, "edit", returnTo\)#edit-panel|buildTabHref\(p\.id, "edit", returnTo\)\}#edit-panel/);
  });
});

describe("Phase 4-26: 상세 페이지 raw 탭에서 본문 중복 표시를 제거한다 (정적 소스 검사)", () => {
  it("raw 탭 안에서 post_body/caption을 두 번(내부 원문 raw + 콘텐츠 미리보기의 본문/캡션 미리보기) 보여주지 않는다", () => {
    // "내부 원문 (raw)" 섹션 한 곳에서만 p.postBody/p.caption 원문을 보여준다.
    expect(pageSource).toContain("내부 원문 (raw)");
    expect(pageSource).not.toContain("본문 미리보기");
    expect(pageSource).not.toContain("캡션 미리보기");
  });

  it("postTitle/excerpt/hashtags/post_url 같은 다른 필드는 그대로 남아 있다(기능 삭제가 아니라 중복 제거)", () => {
    expect(pageSource).toContain("콘텐츠 미리보기 (기존 필드)");
    expect(pageSource).toContain('describeStatusField("post_title")');
    expect(pageSource).toContain('describeStatusField("excerpt")');
    expect(pageSource).toContain('describeStatusField("hashtags")');
    expect(pageSource).toContain('describeStatusField("post_url")');
  });
});

describe("Phase 4-28: 상세 페이지에도 [자동 수정 후 재검토]를 추가한다 (정적 소스 검사)", () => {
  it("runPostAutoFixAndRecheckAction을 재사용해 자동 재검토 실행 버튼 옆에 배치한다", () => {
    expect(pageSource).toContain("runPostAutoFixAndRecheckAction");
    expect(pageSource).toContain("자동 수정 후 재검토");
    expect(pageSource).toContain('name="socialPostId" value={p.id}');
  });

  it("남은 문제가 전부 자동 수정 가능하면(autoFixIsPrimary) primary 스타일로 강조한다", () => {
    expect(pageSource).toContain("hasOnlyImplementedAutoFixableIssues(checklist ?? [])");
    expect(pageSource).toContain("autoFixIsPrimary");
    expect(pageSource).toContain("bg-indigo-600");
  });

  it("qualityStatus가 needs_revision일 때만 이 버튼을 보여준다", () => {
    expect(pageSource).toContain('{p.qualityStatus === "needs_revision" && (');
  });
});

describe("Phase 4-29: 승인 완료 카드 — 문구/다음 작업 버튼 정리 (정적 소스 검사)", () => {
  it('"이미 승인된 글입니다. 아래에서 다음 작업을 진행하세요." 문구는 더 이상 쓰지 않는다', () => {
    expect(pageSource).not.toContain("이미 승인된 글입니다. 아래에서 다음 작업을 진행하세요.");
  });

  it("approved면 approvalNextActions.message를 보여주고, primary/secondary 버튼을 카드 안에 바로 렌더링한다", () => {
    expect(pageSource).toContain('p.approvalStatus === "approved" && approvalNextActions');
    expect(pageSource).toContain("{approvalNextActions.message}");
    expect(pageSource).toContain("renderNextAction(approvalNextActions.primaryAction, primaryClass)");
    expect(pageSource).toContain("approvalNextActions.secondaryActions.map");
  });

  it("wordpress_blog는 Draft 존재 여부/게시 준비 상태를 실제로 조회해서(buildWordPressBlogPublishPreparationSummary) 다음 작업을 계산한다", () => {
    expect(pageSource).toContain('from "@/lib/social/wordpress-blog-publish-preparation-summary"');
    expect(pageSource).toContain("wordpressDraftExists: wordpressBlogSummary?.draft.exists");
    expect(pageSource).toContain('wordpressPublishGuardReady: wordpressBlogSummary?.guardStatus === "ready"');
  });

  it("naver_cafe/x/threads/instagram은 checkPlatformApiReadiness(apiReadiness.configured)를 재사용한다(새 API 준비 판단 로직을 만들지 않는다)", () => {
    expect(pageSource).toContain("apiConfigured: apiReadiness.configured");
  });

  it("승인 완료 카드는 [본문 복사]를 CopyPostBodyButton으로 렌더링한다(항상 전체 본문을 복사)", () => {
    expect(pageSource).toContain('case "copy_body":');
    expect(pageSource).toContain("<CopyPostBodyButton articleId={p.articleId} socialPostId={p.id} text={displayBody}");
  });

  it("approved 상태에서는 [최종 승인] 버튼(primary form)을 다시 보여주지 않는다(승인 form은 else 분기에만 있다)", () => {
    const approvedBranchStart = pageSource.indexOf('p.approvalStatus === "approved" && approvalNextActions');
    const elseBranchStart = pageSource.indexOf(") : (", approvedBranchStart);
    const approvedBranch = pageSource.slice(approvedBranchStart, elseBranchStart);
    expect(approvedBranch).not.toContain("action={approveSocialPostAction}");
  });
});
