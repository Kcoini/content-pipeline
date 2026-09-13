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
  it("Phase 4-14: raw 상태값을 그대로 나열하지 않고 getUserFacingStatus/getSocialPostCardActionState를 사용한다", () => {
    expect(pageSource).toContain("getUserFacingStatus(post)");
    expect(pageSource).toContain("getSocialPostCardActionState(post)");
    expect(pageSource).toContain("cardState.statusBadge");
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

  it("Phase 4-14: 현재 상태에 맞는 primaryAction 버튼 하나만 primary 스타일(bg-indigo-600)로 강조하고, secondaryActions는 secondary 스타일이다", () => {
    expect(pageSource).toContain("renderAction(cardState.primaryAction, primaryClass)");
    expect(pageSource).toContain("renderAction(action, secondaryClass)");
    expect(pageSource).toContain('const primaryClass = "rounded bg-indigo-600');
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
  it("summarizeAutoReview로 quality gate checklist를 통과/확인 필요/수정 필요/차단 리포트로 보여준다", () => {
    expect(pageSource).toContain('from "@/lib/social/social-post-auto-review"');
    expect(pageSource).toContain("summarizeAutoReview");
    expect(pageSource).toContain("describeAutoReviewRiskLevel");
    expect(pageSource).toContain("describeApprovalReadiness");
    expect(pageSource).toContain("summarizeAutoReview(checklist");
    expect(pageSource).toContain("자동 검토 결과:");
    expect(pageSource).toContain("위험도 {describeAutoReviewRiskLevel(review.riskLevel)}");
    expect(pageSource).toContain(
      "통과 {review.counts.passed}개 · 확인 필요 {review.counts.needsCheck}개 · 수정 필요"
    );
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
  it("ExpandableText로 게시용 본문을 카드 안에서 보여준다(getSocialPostDisplayBody 재사용)", () => {
    expect(pageSource).toContain('from "@/components/social/expandable-text"');
    expect(pageSource).toContain("<ExpandableText");
    expect(pageSource).toContain("getSocialPostDisplayBody(post)");
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

  it("getSocialPostCardActionState를 사용해 상태 배지 + primary action 1개 + secondary action을 렌더링한다", () => {
    expect(pageSource).toContain('from "@/lib/social/social-post-card-action-state"');
    expect(pageSource).toContain("getSocialPostCardActionState(post)");
    expect(pageSource).toContain("cardState.primaryAction");
    expect(pageSource).toContain("cardState.secondaryActions.map");
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
