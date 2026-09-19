import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");

describe("article social page (정적 소스 검사, Phase 3-17)", () => {
  it("socialPostId/section/returnTo searchParam을 읽는다", () => {
    expect(pageSource).toContain("socialPostId?: string");
    expect(pageSource).toContain("section?: string");
    expect(pageSource).toContain("returnTo?: string");
  });

  it("강조 표시(getHighlightClassName)와 anchor id(buildAnchorId)를 사용한다", () => {
    expect(pageSource).toContain("getHighlightClassName");
    expect(pageSource).toContain("buildAnchorId");
  });

  it("찾을 수 없는 target에 대한 안내(DeepLinkNotice)를 사용한다", () => {
    expect(pageSource).toContain("DeepLinkNotice");
  });

  it("각 action form에 returnTo hidden input을 포함한다", () => {
    expect(pageSource).toContain('name="returnTo"');
  });

  it("ArticleWorkflowNavigation에 returnTo를 전달한다", () => {
    expect(pageSource).toMatch(/ArticleWorkflowNavigation[^>]*returnTo=\{returnTo\}/);
  });
});

describe("article social page pagination (정적 소스 검사, Phase 3-18)", () => {
  it("page/perPage searchParam을 읽고 parsePagination을 사용한다", () => {
    expect(pageSource).toContain("page?: string");
    expect(pageSource).toContain("perPage?: string");
    expect(pageSource).toContain("parsePagination(");
  });

  it("PaginationControls를 렌더링한다", () => {
    expect(pageSource).toContain("PaginationControls");
  });

  it("상세 페이지(buildSocialPostDetailUrl)로 가는 링크를 포함한다", () => {
    expect(pageSource).toContain("buildSocialPostDetailUrl");
  });

  it("SNS/커뮤니티 글 목록의 각 항목에 삭제 버튼(archiveSocialPostAction)과 확인 모달이 있다", () => {
    expect(pageSource).toContain("archiveSocialPostAction");
    expect(pageSource).toContain("이 글을 삭제하시겠습니까?");
    expect(pageSource).toContain("ConfirmSubmitButton");
  });
});

describe("카드 상태 요약/주요 버튼 강조 (정적 소스 검사, Phase 3-22)", () => {
  it("Phase 4-14/UX-03B1: raw 상태값을 그대로 나열하지 않고 getUserFacingStatus/getSocialPostCardActionState + 공통 WorkflowStatusCard를 사용한다", () => {
    expect(pageSource).toContain("getUserFacingStatus(post)");
    expect(pageSource).toContain("getSocialPostCardActionState(post)");
    expect(pageSource).toContain("fromSocialPostCardActionStateToWorkflowStatus(cardState)");
    expect(pageSource).toContain("<WorkflowStatusCard");
  });

  it("raw 상태값(quality/approval/export 등)은 '상세 상태 보기' 접힘 안에만 있다", () => {
    const detailsStart = pageSource.indexOf("상세 상태 보기 / 보조 작업");
    expect(detailsStart).toBeGreaterThan(-1);
    const beforeDetails = pageSource.slice(0, detailsStart);
    // 카드 상단 요약 영역에는 "quality: {post.qualityStatus}" 같은 raw 나열이 없어야 한다.
    expect(beforeDetails).not.toMatch(/quality: \{post\.qualityStatus\}/);
  });

  it("승인(approveSocialPostAction) 버튼이 SNS/커뮤니티 카드에도 있다(이전에는 blog 카드에만 있었음)", () => {
    expect(pageSource).toContain("approveSocialPostAction");
  });

  it("Phase 4-14/UX-03B1: 현재 상태에 맞는 primaryAction 버튼 하나만 primary 스타일(bg-indigo-600)로 강조하고, secondaryActions는 secondary 스타일이다(NextActionPanel + renderActionForPanel)", () => {
    expect(pageSource).toContain('const primaryClass = "rounded bg-indigo-600');
    expect(pageSource).toContain("renderActionForPanel = (action: NextActionViewModelAction, kind:");
    expect(pageSource).toContain('kind === "primary" ? primaryClass : secondaryClass');
    expect(pageSource).toContain("renderAction={renderActionForPanel}");
  });

  it("게시 준비 확인/게시 전 미리보기/수동 게시 준비/체크리스트 등 보조 작업은 접힘 영역 안으로 옮겨졌다 (Phase 3-24: 영어 버튼명도 한국어로 변경)", () => {
    const detailsStart = pageSource.indexOf("상세 상태 보기 / 보조 작업");
    const detailsEnd = pageSource.indexOf("게시 결과 기록 / Metrics 입력", detailsStart);
    const detailsBlock = pageSource.slice(detailsStart, detailsEnd);
    expect(detailsBlock).toContain("게시 준비 확인");
    expect(detailsBlock).toContain("게시 전 미리보기 만들기");
    expect(detailsBlock).toContain("수동 게시 준비 완료");
    expect(detailsBlock).toContain("게시 체크리스트 준비");
    // 버튼 라벨(사용자에게 보이는 텍스트)에만 영어가 없어야 한다 — action
    // 함수명(completePlatformExportHandoffAction 등)은 내부 식별자이므로 대상이 아니다.
    expect(detailsBlock).not.toContain(">Publishing Guard 실행<");
    expect(detailsBlock).not.toContain(">Dry-run 생성<");
    expect(detailsBlock).not.toContain(">Handoff 완료<");
  });
});

describe("사용자 친화적 라벨/표현 (정적 소스 검사, Phase 3-24)", () => {
  it("플랫폼/문체 select는 raw enum이 아니라 한국어 라벨을 표시한다", () => {
    expect(pageSource).toContain('import { PLATFORM_LABELS } from "@/lib/social/platform-generation-recommendations"');
    expect(pageSource).toContain('import { TONE_STYLE_CONFIGS } from "@/lib/social/tone-style-config"');
    expect(pageSource).toContain("{PLATFORM_LABELS[platform]}");
    expect(pageSource).toContain("{TONE_STYLE_CONFIGS[toneStyle].label}");
    expect(pageSource).not.toMatch(/<option key=\{platform\} value=\{platform\}>\s*\{platform\}/);
  });

  it("'placeholder 초안 생성'은 이름이 바뀌고 고급 옵션(기본 접힘)으로 옮겨졌다", () => {
    expect(pageSource).not.toContain("placeholder 초안 생성");
    expect(pageSource).toContain("고급 옵션: 테스트용 임시 초안 만들기");
    expect(pageSource).toContain("임시 초안 만들기");
  });

  it("기본 생성 버튼은 명확한 이름과 설명 문구를 가진다", () => {
    expect(pageSource).toContain("선택한 플랫폼 글 생성");
    expect(pageSource).toContain("선택한 플랫폼과 문체에 맞춰 글을 생성합니다. 공개 게시는 하지 않습니다.");
  });

  it("post.platform/post.toneStyle 배지도 raw enum이 아니라 라벨을 표시한다", () => {
    expect(pageSource).toContain("{PLATFORM_LABELS[post.platform]}");
    expect(pageSource).toContain("{TONE_STYLE_CONFIGS[post.toneStyle].label}");
  });

  it("article.status/내부 상태 필드값을 describeStatusValue/describeStatusField로 변환해서 보여준다", () => {
    expect(pageSource).toContain('import { describeStatusValue, describeStatusField } from "@/lib/social/status-labels"');
    expect(pageSource).toContain("describeStatusValue(article.status)");
    expect(pageSource).toContain('describeStatusField("quality_status")');
  });

  it("InfoBadge 라벨이 영어(Metrics 필요/Low Performance)가 아니라 한국어다", () => {
    expect(pageSource).not.toContain('label="Metrics 필요"');
    expect(pageSource).not.toContain('label="Low Performance"');
    expect(pageSource).toContain('label="성과 입력 필요"');
    expect(pageSource).toContain('label="반응 저조"');
  });
});

describe("naver_cafe 등 본문형 플랫폼 미리보기 (정적 소스 검사, Phase 3-19)", () => {
  it("목록 카드 본문 미리보기는 getSocialPostDisplayBody를 사용한다(caption만 보지 않는다)", () => {
    expect(pageSource).toContain("getSocialPostDisplayBody");
    expect(pageSource).toContain('from "@/lib/social/social-post-display"');
  });

  it("caption만 확인하고 postBody를 무시하는 예전 방식으로 되돌아가지 않는다", () => {
    expect(pageSource).not.toMatch(
      /\(post\.caption \|\| post\.threadItems\.map\(\(t\) => t\.text\)\.join\(" "\) \|\| post\.cardItems/
    );
  });
});

describe("자동 검토 리포트 (정적 소스 검사, Phase 3-25)", () => {
  it("summarizeAutoReview로 quality gate checklist를 계산하고, 공통 AutoReviewSummaryCard로 통과/확인 필요/수정 필요/차단 리포트를 보여준다(Phase UX-03A)", () => {
    expect(pageSource).toContain('from "@/lib/social/social-post-auto-review"');
    expect(pageSource).toContain("summarizeAutoReview");
    expect(pageSource).toContain("summarizeAutoReview(checklist");
    expect(pageSource).toContain('from "@/components/review/auto-review-summary-card"');
    expect(pageSource).toContain("<AutoReviewSummaryCard");
    expect(pageSource).toContain('labelPrefix="자동 검토 결과: "');
    expect(pageSource).toContain("review={review}");
    // 카운트/위험도/승인 가능 안내 문구 자체의 상세 검사는
    // auto-review-summary-card.test.tsx가 담당한다.
  });

  it("아직 자동 검토를 실행하지 않은 글에는 raw quality_status 대신 안내 문구를 보여준다", () => {
    expect(pageSource).toContain("describeAutoReviewNotRunYet(post.qualityStatus)");
    expect(pageSource).toContain('post.qualityStatus === "not_checked"');
  });

  it("리포트는 DB에 새로 쓰지 않고 항상 저장된 checklist로부터 다시 계산한다(quality gate 재실행 action을 그대로 재사용)", () => {
    expect(pageSource).toContain("runSocialPostQualityGateAction");
    expect(pageSource).toContain("post.qualitySummary");
  });
});

describe("Phase 4-14: SNS/커뮤니티 글 목록 카드 본문 확장/버튼 정리 (정적 소스 검사)", () => {
  it("Phase 4-15: SocialPostBodyPanel(ExpandableText 재사용)로 게시용 본문을 카드 안에서 보여주고 inline 편집도 지원한다", () => {
    expect(pageSource).toContain('from "@/components/social/social-post-body-panel"');
    expect(pageSource).toContain("<SocialPostBodyPanel");
    expect(pageSource).toContain("getSocialPostDisplayBody(post)");
    expect(pageSource).toContain("getSocialPostEditableField(post.platform)");
  });

  it("게시용 본문은 자동 검토 결과보다 먼저(소스 상으로도 앞에) 표시된다", () => {
    const bodyLabelIdx = pageSource.indexOf("게시용 본문");
    const reviewResultIdx = pageSource.indexOf("자동 검토 결과:");
    expect(bodyLabelIdx).toBeGreaterThan(-1);
    expect(bodyLabelIdx).toBeLessThan(reviewResultIdx);
  });

  it("본문이 없으면 '(본문 없음)'만 보여주지 않고 이유와 다음 작업을 안내한다", () => {
    expect(pageSource).toContain("게시용 본문이 아직 없습니다");
    expect(pageSource).not.toContain('|| "(본문 없음)"');
  });

  it("getSocialPostCardActionState를 사용해 상태 배지 + primary action 1개 + secondary action을 계산하고, 공통 NextActionPanel로 렌더링한다", () => {
    expect(pageSource).toContain('from "@/lib/social/social-post-card-action-state"');
    expect(pageSource).toContain("getSocialPostCardActionState(post)");
    expect(pageSource).toContain("visibleSecondaryActions");
    expect(pageSource).toContain("fromSocialPostCardActionState(cardState)");
    expect(pageSource).toContain("<NextActionPanel");
  });

  it("Phase 4-15: 카드 안 inline 편집을 지원하는 플랫폼은 secondary 목록에서 edit_body(상세 페이지 링크)를 중복 표시하지 않는다", () => {
    expect(pageSource).toContain("const inlineEditable = getSocialPostEditableField(post.platform) !== null;");
    expect(pageSource).toContain('!(action.actionType === "edit_body" && inlineEditable)');
  });

  it("품질검사/승인 요청/승인/복사export 4개 버튼을 동시에 같은 수준으로 나열하지 않는다(기본 흐름에는 primary 1개만)", () => {
    const cardActionBlockStart = pageSource.indexOf("getSocialPostCardActionState(post)");
    const detailsStart = pageSource.indexOf("상세 상태 보기 / 보조 작업");
    const mainFlowBlock = pageSource.slice(cardActionBlockStart, detailsStart);
    // 기본 흐름 블록 안에는 4개 action을 무조건 나열하는 이전 패턴
    // (nextAction.kind === "quality_check" 같은 4중 분기)이 없어야 한다.
    expect(mainFlowBlock).not.toContain("nextAction.kind");
  });

  it("승인 요청/품질검사 재실행은 '상세 상태 보기 / 보조 작업' 접힘 영역으로 이동했다(기능 삭제 없음)", () => {
    const detailsStart = pageSource.indexOf("상세 상태 보기 / 보조 작업");
    const detailsEnd = pageSource.indexOf("게시 결과 기록 / Metrics 입력", detailsStart);
    const detailsBlock = pageSource.slice(detailsStart, detailsEnd);
    expect(detailsBlock).toContain("action={requestSocialPostApprovalAction}");
    expect(detailsBlock).toContain("품질검사 다시 실행");
  });

  it("approved 상태에서는 승인 버튼이 기본 흐름에서 사라지고 '복사/export 준비'가 대신 primary가 된다(getSocialPostCardActionState의 approve 분기 재사용)", () => {
    expect(pageSource).toContain('case "approve":');
    expect(pageSource).toContain('case "prepare_export":');
  });

  it("전체 본문 보기를 위해 상세 페이지 이동을 강제하지 않는다 — ExpandableText가 카드 안에서 처리한다", () => {
    expect(pageSource).not.toMatch(/getSocialPostDisplayBody\(post\)\.slice\(0,\s*140\)/);
  });
});

describe("Phase 4-20: '성과 보기 → 기사 개요 →' 화살표 링크 정리 (정적 소스 검사)", () => {
  it("primary/secondary action과 나란히 있던 '기사 개요 →'를 제거하고 RelatedPostLinks로 뺐다", () => {
    expect(pageSource).toContain("<RelatedPostLinks");
    expect(pageSource).not.toContain("기사 개요 →");
    expect(pageSource).not.toContain("성과 보기 →");
    expect(pageSource).not.toContain("재작성 관리에서 보기 →");
  });

  it("primary/secondary action을 렌더링하는 NextActionPanel 안에는 관련 화면 링크가 없다(강조되지 않아야 한다)", () => {
    const panelStart = pageSource.indexOf("<NextActionPanel");
    const panelEnd = pageSource.indexOf("/>", panelStart);
    const panelBlock = pageSource.slice(panelStart, panelEnd);
    expect(panelStart).toBeGreaterThan(-1);
    expect(panelBlock).not.toContain("RelatedPostLinks");
    expect(panelBlock).not.toContain("buildArticleOverviewUrl");
  });

  it("성과 확인 링크는 shouldShowPerformanceLink(post)일 때만 포함된다", () => {
    expect(pageSource).toContain("shouldShowPerformanceLink(post)");
    expect(pageSource).toContain('label: "성과 확인"');
  });
});

describe("Phase 4-22: 자동 검토 '수정 필요' 상태에서 [자동 수정 후 재검토] 버튼 제공 (정적 소스 검사)", () => {
  it("qualityStatus가 needs_revision일 때만 자동 수정 후 재검토 버튼을 보여준다", () => {
    expect(pageSource).toContain('post.qualityStatus === "needs_revision"');
    expect(pageSource).toContain("action={runPostAutoFixAndRecheckAction}");
    expect(pageSource).toContain("자동 수정 후 재검토");
  });

  it("이 버튼은 approval_status를 직접 바꾸지 않는다(승인은 별도 버튼)", () => {
    const btnIdx = pageSource.indexOf("action={runPostAutoFixAndRecheckAction}");
    const formStart = pageSource.lastIndexOf("<form", btnIdx);
    const formEnd = pageSource.indexOf("</form>", btnIdx);
    const formBlock = pageSource.slice(formStart, formEnd);
    expect(formBlock).not.toContain("approveSocialPostAction");
  });
});

describe("Phase 4-24: 플랫폼별 기본 viewMode를 SocialPostBodyPanel에 전달한다 (정적 소스 검사)", () => {
  it("SocialPostBodyPanel 호출에 platform={post.platform}을 넘긴다(naver_cafe/x/threads/instagram은 복사용 텍스트 기본으로 전환)", () => {
    expect(pageSource).toContain("<SocialPostBodyPanel");
    expect(pageSource).toContain("platform={post.platform}");
  });
});

describe("Phase 4-28: 자동 수정 가능한 문제만 남았을 때 [자동 수정 후 재검토]를 primary로 승격한다 (정적 소스 검사)", () => {
  it("hasOnlyImplementedAutoFixableIssues로 autoFixIsPrimary를 계산하고, 공통 NextActionViewModel에 반영한다(primaryClass/secondaryClass는 renderActionForPanel이 배정)", () => {
    expect(pageSource).toContain('from "@/lib/social/review-issue-fixability"');
    expect(pageSource).toContain("hasOnlyImplementedAutoFixableIssues(postChecklist)");
    expect(pageSource).toContain('kind === "primary" ? primaryClass : secondaryClass');
    expect(pageSource).toContain("autoFixIsPrimary && autoFixAction");
  });

  it("autoFixIsPrimary일 때 원래 primary였던 action(문제 확인하기)은 secondary로 내려간다(primary 버튼은 하나만 강조 — NextActionViewModel 조합에서 처리)", () => {
    const start = pageSource.indexOf("const viewModel: NextActionViewModel =");
    const end = pageSource.indexOf("const renderActionForPanel");
    const block = pageSource.slice(start, end);
    expect(block).toContain("primaryAction: autoFixAction");
    expect(block).toContain("...visibleSecondaryActions, baseViewModel.primaryAction!");
  });

  it("자동으로 정리할 수 있는 항목이 있으면 새 사실/수치를 추가하지 않는다는 안내를 함께 보여준다", () => {
    expect(pageSource).toContain("자동으로 정리할 수 있는 항목");
    expect(pageSource).toContain("새로운 사실이나 수치는 추가하지 않습니다");
  });
});

describe("Phase UX-03B2: X 카드도 [본문 수정]이 상세 페이지 이동 없이 같은 카드 안에서 열린다", () => {
  it("saveSocialPostThreadInlineEditAction을 import하고 SocialPostBodyPanel에 연결한다", () => {
    expect(pageSource).toContain("saveSocialPostThreadInlineEditAction");
    expect(pageSource).toContain("saveThreadAction={isThreadPlatform && !isPublished ? saveSocialPostThreadInlineEditAction : undefined}");
  });

  it("isThreadPlatform은 PLATFORM_WRITING_CONFIGS의 supportsThreads를 그대로 쓴다(새 platform 목록을 하드코딩하지 않는다)", () => {
    expect(pageSource).toContain('from "@/lib/social/platform-writing-config"');
    expect(pageSource).toContain("const isThreadPlatform = PLATFORM_WRITING_CONFIGS[post.platform].supportsThreads;");
  });

  it("threadItems={isThreadPlatform && !isPublished ? post.threadItems : undefined}로 X가 아닌 플랫폼에는 thread props를 넘기지 않는다(Phase UX-05B: 이미 게시 완료로 표시된 글도 제외)", () => {
    expect(pageSource).toContain("threadItems={isThreadPlatform && !isPublished ? post.threadItems : undefined}");
  });
});

describe("Phase UX-04A: AI가 처리할 수 있는 검토 정보는 기본 화면에서 숨긴다 (정적 소스 검사)", () => {
  it("summarizeUserFacingReview를 계산해서 AutoReviewSummaryCard에 userFacingSummary로 넘긴다(auto_fixable issue를 기본 화면 목록에서 제외)", () => {
    expect(pageSource).toContain("summarizeUserFacingReview");
    expect(pageSource).toContain('from "@/lib/social/social-post-auto-review"');
    expect(pageSource).toContain("summarizeUserFacingReview(post.qualityStatus, review, checklist as never)");
    expect(pageSource).toContain("userFacingSummary={userFacingSummary}");
  });

  it("카드 하나에 primary action 판단 로직은 getSocialPostCardActionState(+autoFixAction 조합) 하나뿐이다 — 검토 상태 어댑터(fromUserFacingReviewToNextAction 등)로 별도 NextActionPanel/WorkflowStatusCard를 만들지 않는다", () => {
    expect(pageSource).not.toContain("fromUserFacingReviewToNextAction");
    expect(pageSource).not.toContain("fromUserFacingReviewToWorkflowStatus");
    // WorkflowStatusCard/NextActionPanel은 카드당 한 번만 렌더링된다(getSocialPostCardActionState 기반 하나).
    expect(pageSource.match(/<WorkflowStatusCard/g)?.length).toBe(1);
    expect(pageSource.match(/<NextActionPanel/g)?.length).toBe(1);
  });

  it("품질검사(run_quality_gate)는 qualityStatus가 not_checked일 때만 primary가 되도록 이미 계산되어 있다 — 생성 직후 자동 검토가 이미 실행되므로 정상 흐름에서 반복 노출되지 않는다(getSocialPostCardActionState 재구현 없음)", () => {
    expect(pageSource).toContain('from "@/lib/social/social-post-card-action-state"');
    expect(pageSource).not.toContain("qualityStatus === \"not_checked\" ? { label: \"품질검사\"");
  });

  it("승인은 approveSocialPostAction 폼을 사용자가 직접 눌러야만 호출된다 — 자동 검토/자동 수정 통과만으로 승인 action이 자동 호출되지 않는다", () => {
    expect(pageSource).not.toMatch(/approveSocialPostAction\(/);
    expect(pageSource).toContain("case \"approve\":");
  });
});

describe("Phase UX-04B: 여러 플랫폼 글 검토 workspace (정적 소스 검사)", () => {
  it("allPosts 기준으로 MultiPlatformReviewSummary를 계산해서 상단에 요약 카드를 보여준다", () => {
    expect(pageSource).toContain('from "@/lib/ui/multi-platform-review-summary"');
    expect(pageSource).toContain("summarizeMultiPlatformReview(multiPlatformInputs)");
    expect(pageSource).toContain("allPosts.map((post) =>");
    expect(pageSource).toContain("<MultiPlatformReviewSummaryCard");
    expect(pageSource).toContain("summary={multiPlatformSummary}");
  });

  it("기존 summarizeUserFacingReview 계산을 재사용한다(새 review 판단 로직을 따로 만들지 않는다)", () => {
    expect(pageSource).toContain("summarizeUserFacingReview(post.qualityStatus, review, checklist)");
  });

  it("문제(차단/확인 필요/검토 실패/검토 중) 있는 글이 먼저 오도록 getMultiPlatformReviewSortKey로 정렬한 뒤 렌더링한다", () => {
    expect(pageSource).toContain("getMultiPlatformReviewSortKey");
    expect(pageSource).toContain("const sortedPosts = [...posts].sort(");
    expect(pageSource).toContain("{sortedPosts.map((post) => {");
    expect(pageSource).not.toContain("{posts.map((post) => {");
  });

  it("일괄 승인 폼은 eligiblePostIds(state===ready && 미승인)만 hidden input으로 넣는다", () => {
    expect(pageSource).toContain("renderBulkApprovalAction={(eligiblePostIds) =>");
    expect(pageSource).toContain('action={bulkApproveSocialPostsAction}');
    expect(pageSource).toContain('{eligiblePostIds.map((postId) =>');
    expect(pageSource).toContain('name="socialPostId" value={postId}');
  });

  it("일괄 승인 버튼은 ConfirmSubmitButton(사용자 명시적 확인)을 거쳐야만 제출된다 — 자동 실행되지 않는다", () => {
    const bulkFormSource = pageSource.slice(
      pageSource.indexOf("renderBulkApprovalAction"),
      pageSource.indexOf("renderBulkApprovalAction") + 1500
    );
    expect(bulkFormSource).toContain("<ConfirmSubmitButton");
    expect(bulkFormSource).toContain("confirmMessage=");
  });

  it("일괄 승인 후 외부 게시를 자동 실행하지 않는다(bulkApproveSocialPostsAction만 호출)", () => {
    expect(pageSource).not.toMatch(/bulkApproveSocialPostsAction\(/);
  });

  it("제외된 글이 있으면 이유를 자연어로 안내한다", () => {
    expect(pageSource).toContain("확인이 필요해 제외됩니다");
  });

  it("raw review state(ready/needs_confirmation/blocked/checking/failed)를 워크스페이스 요약 영역에 직접 노출하지 않는다", () => {
    const summarySource = pageSource.slice(
      pageSource.indexOf("MultiPlatformReviewSummaryCard"),
      pageSource.indexOf("renderBulkApprovalAction") + 200
    );
    expect(summarySource).not.toMatch(/>needs_confirmation</);
    expect(summarySource).not.toMatch(/>blocked</);
  });
});

describe("Phase UX-05A: 승인 이후 게시 준비 섹션 (정적 소스 검사)", () => {
  it("승인 여부와 무관하게 allPosts 전체를 PublishPreparationViewModel로 계산해서 집계한다(새 판단 로직 없이 기존 getPostApprovalNextActions 재사용)", () => {
    expect(pageSource).toContain('from "@/lib/ui/publish-preparation-view-model"');
    expect(pageSource).toContain('from "@/lib/ui/multi-platform-publish-preparation-summary"');
    expect(pageSource).toContain("notApprovedPublishPreparation(post.platform)");
    expect(pageSource).toContain("getPostApprovalNextActions({");
    expect(pageSource).toContain("fromPostApprovalNextActionsToPublishPreparation(");
    expect(pageSource).toContain("summarizeMultiPlatformPublishPreparation(publishPreparationInputs)");
  });

  it("게시 준비 섹션은 검토/승인 섹션과 별도 <section>으로 분리되어 있다", () => {
    expect(pageSource).toContain("<PublishPreparationSummaryCard");
    const publishSectionIdx = pageSource.indexOf("<PublishPreparationSummaryCard");
    const reviewSectionIdx = pageSource.indexOf("<MultiPlatformReviewSummaryCard");
    expect(publishSectionIdx).toBeGreaterThan(reviewSectionIdx);
  });

  it("개별 카드 목록은 이미 승인된 글만 보여준다(미승인 글은 위 검토 섹션과 중복 표시하지 않는다)", () => {
    expect(pageSource).toContain('.filter((post) => post.approvalStatus === "approved")');
    expect(pageSource).toContain("approvedPublishPreparationPosts");
  });

  it("PlatformPublishPreparationCard는 getPublishPreparationSortKey로 문제 우선 정렬된다", () => {
    expect(pageSource).toContain("getPublishPreparationSortKey(a.entry) - getPublishPreparationSortKey(b.entry)");
  });

  it("copy 계열 플랫폼(naver_cafe/x/threads/instagram)에는 실제 구현되지 않은 '게시하기' 버튼을 만들지 않는다 — copy_body만 primary로 연결한다", () => {
    expect(pageSource).not.toContain('"게시하기"');
    expect(pageSource).toContain('case "copy_body":');
    expect(pageSource).toContain("<CopyPostBodyButton");
  });

  it("일괄 승인 직후에도 dead-end가 없다 — 같은 page에서 방금 승인된 글이 게시 준비 섹션에 실제 action과 함께 나타난다", () => {
    expect(pageSource).toContain("일괄 승인 직후 이");
    expect(pageSource).toContain("실제 다음 작업(본문 복사 등)과 함께 나타난다");
  });

  it("게시 준비 섹션에서도 외부 게시를 자동 실행하지 않는다 — copy_body/view_detail/check_api_readiness만 렌더링한다", () => {
    const renderActionSource = pageSource.slice(
      pageSource.indexOf("renderPublishAction = "),
      pageSource.indexOf("renderPublishAction = ") + 1500
    );
    expect(renderActionSource).not.toMatch(/publishSocialPostAction|directPublishAction/);
  });

  it("raw PublishPreparationState(not_approved/needs_attention/needs_setup 등)를 페이지 텍스트에 직접 노출하지 않는다", () => {
    const publishSectionSource = pageSource.slice(pageSource.indexOf("Phase UX-05A"), pageSource.indexOf("<section className=\"rounded-lg border border-zinc-200 bg-white p-4 shadow-sm\">\n          <h1"));
    expect(publishSectionSource).not.toMatch(/>not_approved</);
    expect(publishSectionSource).not.toMatch(/>needs_setup</);
  });
});

describe("Phase UX-05B: 게시 실행/완료 UX (정적 소스 검사)", () => {
  it("게시 준비 섹션에 안정적인 anchor(id=\"publish-preparation\")가 있다", () => {
    expect(pageSource).toContain('id="publish-preparation"');
  });

  it("일괄 승인 성공 메시지 아래 [게시 준비 보기] 링크가 #publish-preparation으로 이동한다", () => {
    expect(pageSource).toContain('publishMessage.includes("승인 완료")');
    expect(pageSource).toContain('href="#publish-preparation"');
    expect(pageSource).toContain("게시 준비 보기");
  });

  it("ready 상태(copy_body가 primary)인 post에는 '게시 완료로 표시' 보조 action을 추가한다 — 기존 recordManualPostingResultAction 폼(guard 그대로)으로 안내만 한다", () => {
    expect(pageSource).toContain('{ type: "record_manual_result", label: "게시 완료로 표시" }');
    expect(pageSource).toContain('case "record_manual_result":');
    expect(pageSource).not.toContain("bulkApproveSocialPostsService(publishPreparationInputs");
  });

  it("'게시 완료로 표시' action은 기존 게시 결과 기록 섹션의 anchor로만 이동한다(새 endpoint 없음)", () => {
    const recordActionSource = pageSource.slice(pageSource.indexOf('case "record_manual_result":'), pageSource.indexOf('case "record_manual_result":') + 300);
    expect(recordActionSource).toContain('buildAnchorId("social-post-manual-result", post.id)');
  });

  it("복사 버튼에 manualResultAnchorId를 넘겨 복사 후 '게시 완료로 표시' 안내를 이어준다(복사 자체가 완료 처리는 아님)", () => {
    expect(pageSource).toContain("manualResultAnchorId={buildAnchorId(\"social-post-manual-result\", post.id)}");
  });

  it("이미 게시 완료로 표시된 글(publishStatus===published)은 [본문 수정]을 감추고 안내 문구를 보여준다 — repository guard는 건드리지 않는다", () => {
    expect(pageSource).toContain('const isPublished = post.publishStatus === "published";');
    expect(pageSource).toContain("editable={!isPublished && getSocialPostEditableField(post.platform) !== null}");
    expect(pageSource).toContain("이미 게시 완료로 표시된 글입니다. 본문 수정은 외부 게시물에 자동 반영되지 않습니다.");
  });

  it("'네이버에 게시하기'/'X에 게시하기' 같은, 실제로 존재하지 않는 직접 게시 버튼을 만들지 않는다", () => {
    expect(pageSource).not.toContain("에 게시하기");
    expect(pageSource).not.toContain("게시하기</button>");
    expect(pageSource).not.toContain("게시하기</a>");
  });
});
