import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");
const actionsSource = readFileSync(path.join(__dirname, "actions.ts"), "utf8");
// Phase 3-23-2: "현재 상태 / 다음 작업" 카드의 문구는 page.tsx에 직접
// 하드코딩되어 있지 않고 lib/dashboard/dashboard-workflow-presentation.ts로
// 옮겨졌다(단일 출처화). 그 파일 자체의 동작은
// lib/dashboard/dashboard-workflow-presentation.test.ts에서 이미 검증하므로,
// 여기서는 page.tsx가 그 함수들을 실제로 사용해서 렌더링하는지만 정적으로
// 확인한다.
const workflowPresentationSource = readFileSync(
  path.join(__dirname, "..", "..", "lib", "dashboard", "dashboard-workflow-presentation.ts"),
  "utf8"
);
// Phase 1-23: 테마 목록/검색/삭제 UI는 좌측 사이드바 컴포넌트로 옮겨졌다.
const themeSearchListSource = readFileSync(
  path.join(__dirname, "..", "..", "components", "dashboard", "theme-search-list.tsx"),
  "utf8"
);

describe("dashboard 테마 목록 삭제(보관 처리) 버튼 (정적 소스 검사)", () => {
  it("테마 목록에 삭제 버튼(archiveThemeAction)이 있다", () => {
    expect(pageSource).toContain("archiveThemeAction");
    expect(themeSearchListSource).toContain("ConfirmSubmitButton");
    expect(themeSearchListSource).toContain("삭제");
  });

  it("삭제 확인 모달 문구에 연결된 기사/출처 개수와 WordPress 안내가 포함된다", () => {
    expect(themeSearchListSource).toContain("이 테마를 삭제하시겠습니까?");
    expect(themeSearchListSource).toMatch(/연결된 기사 \$\{articleCount\}개, 출처 \$\{sourceCount\}개/);
    expect(themeSearchListSource).toContain("이미 생성된 WordPress 글은 자동 삭제되지 않습니다.");
  });

  it("삭제/에러 메시지를 TransientNotice로 표시한다", () => {
    expect(pageSource).toContain("TransientNotice");
    expect(pageSource).toContain("deleteMessage");
    expect(pageSource).toContain("deleteError");
  });

  it("actions.ts는 hard delete가 아니라 archiveTheme(soft delete)만 호출한다", () => {
    expect(actionsSource).toContain("archiveTheme(themeId)");
    expect(actionsSource).not.toMatch(/\.delete\(\)/);
  });

  it("이미 보관된 테마는 theme_delete_blocked로 기록하고, 성공 시 theme_archived로 기록한다", () => {
    expect(actionsSource).toContain("theme_delete_blocked");
    expect(actionsSource).toContain("theme_archived");
  });

  it("삭제 전 연관 데이터(getThemeRelatedCounts)를 조회한다", () => {
    expect(actionsSource).toContain("getThemeRelatedCounts(themeId)");
  });
});

describe("dashboard 상단 내비게이션 단순화 (정적 소스 검사, Phase 1-22)", () => {
  it("헤더는 DashboardTopNav 컴포넌트로 대체되고, 예전처럼 버튼 8개를 나열하지 않는다", () => {
    expect(pageSource).toContain('import { DashboardTopNav } from "@/components/navigation/dashboard-top-nav"');
    expect(pageSource).toContain("<DashboardTopNav active={null} />");
  });

  it("예전 영문 버튼명(Content/Blog/Rewrite/Social Performance/Platform API Readiness/Automation Safety Dashboard)이 페이지에 직접 나열되지 않는다", () => {
    expect(pageSource).not.toContain("Content Dashboard");
    expect(pageSource).not.toContain("Blog Dashboard");
    expect(pageSource).not.toContain("Rewrite Dashboard");
    expect(pageSource).not.toContain("Social Performance Dashboard");
    expect(pageSource).not.toContain("Platform API Readiness");
    expect(pageSource).not.toContain("Automation Safety");
  });

  it("자동 테마 찾기 라우트(/trends)는 여전히 존재한다(라우팅 기능 유지)", () => {
    expect(pageSource).toContain("자동 테마 찾기");
  });
});

describe("dashboard 선택한 테마 중심 작업형 대시보드 개편 (정적 소스 검사, Phase 1-23)", () => {
  it("새 테마 입력 폼은 <details>로 기본 접힘 상태다", () => {
    const match = pageSource.match(/<details className="group rounded-lg[\s\S]*?<\/summary>[\s\S]*?<form action=\{createTheme\}/);
    expect(match).not.toBeNull();
    expect(pageSource).not.toMatch(/<details[^>]*open[^>]*>[\s\S]{0,50}<summary[^>]*>[\s\S]{0,80}\+ 새 테마/);
  });

  it("테마 검색은 ThemeSearchList 컴포넌트로 분리되어 있다", () => {
    expect(pageSource).toContain('import { ThemeSearchList } from "@/components/dashboard/theme-search-list"');
    expect(pageSource).toContain("<ThemeSearchList");
    expect(themeSearchListSource).toContain('type="search"');
  });

  it("현재 선택된 테마는 ThemeSearchList에서 aria-current와 강조 스타일로 표시된다", () => {
    expect(themeSearchListSource).toContain('aria-current={isSelected ? "page" : undefined}');
    expect(themeSearchListSource).toContain("bg-zinc-900 text-white");
    expect(themeSearchListSource).toContain("font-medium text-white");
  });

  it("선택된 테마 요약 카드에는 출처 개수/조건 충족 여부만 표시하고, 다른 판단(기사 작성 가능 여부 등)은 중복 표시하지 않는다 (Phase 3-23-2)", () => {
    expect(pageSource).toMatch(/출처 \{sources\.length\}개 등록됨/);
    expect(pageSource).toContain('{sourceStatus.isReady ? "조건 충족" : "출처 부족"}');
    // "기사 작성 가능/불가"는 workflowState 기반 상태 카드와 중복/모순될 수
    // 있어 제거했다 — 실제 JSX 출력에는 이 문구가 없어야 한다(설명용
    // 주석에는 남아있을 수 있으므로, 렌더링되는 실제 <p> 줄만 좁혀서 검사).
    const summaryLineMatch = pageSource.match(/출처 \{sources\.length\}개 등록됨[\s\S]{0,150}<\/p>/);
    expect(summaryLineMatch).not.toBeNull();
    expect(summaryLineMatch![0]).not.toContain("기사 작성 가능");
    expect(summaryLineMatch![0]).not.toContain("기사 작성 불가");
  });

  it("현재 상태/다음 작업 카드는 workflowState 하나만으로 문구·색상·CTA를 계산하는 단일 helper(getDashboardStatusSummary/getWorkflowStateTone)를 사용한다 (Phase 3-23-2)", () => {
    // page.tsx 자체에는 상태별 문구를 하드코딩하지 않는다 — 두 상태 체계가
    // 공존해 모순된 안내를 내던 문제(Phase 3-23-2에서 발견)를 막기 위해
    // 문구 계산을 lib/dashboard/dashboard-workflow-presentation.ts로
    // 단일화했다. 예전에 있던 resolveNextActionState/nextActionState는
    // 완전히 제거되어 더 이상 페이지에 존재하지 않는다.
    // 코드 주석에는 "예전에 nextActionState가 있었다"는 설명이 남아있을 수
    // 있으므로, 실제로 변수를 선언/참조하는 살아있는 코드가 없는지만 본다.
    expect(pageSource).not.toMatch(/const nextActionState/);
    expect(pageSource).not.toMatch(/nextActionState\s*(===|!==|\?)/);
    expect(pageSource).not.toContain("resolveNextActionState");
    expect(pageSource).toContain("getDashboardStatusSummary(workflowState");
    expect(pageSource).toContain("getWorkflowStateTone(workflowState)");
    expect(pageSource).toContain("statusSummary.primaryActionHref");
    expect(pageSource).toContain("statusSummary.primaryActionLabel");

    // 문구 자체(각 상태의 정확한 안내/버튼 라벨)는 helper 쪽에서 보장한다.
    expect(workflowPresentationSource).toContain("아직 출처가 없습니다.");
    expect(workflowPresentationSource).toContain("출처 추가하기");
    expect(workflowPresentationSource).toContain("출처가 준비되었습니다");
    expect(workflowPresentationSource).toContain("WordPress 블로그, 네이버 블로그, 네이버 카페 글을 생성하세요.");
    expect(workflowPresentationSource).toContain("선택한 플랫폼 글 생성");
    expect(workflowPresentationSource).toContain("글 내용을 검토하세요.");
    expect(workflowPresentationSource).toContain("검토할 글 보기");
    expect(workflowPresentationSource).toContain("WordPress Draft 반영 또는 수동 export를 진행하세요.");
    expect(workflowPresentationSource).toContain("게시 준비하기");
  });

  it("현재 상태/다음 작업 카드는 workflowState별 색상 톤(getWorkflowStateTone)을 적용한다 — 모든 상태가 파란색으로 고정되어 있지 않다 (Phase 3-23-2)", () => {
    expect(pageSource).toContain("workflowTone.containerClassName");
    expect(pageSource).toContain("workflowTone.headingClassName");
    expect(pageSource).toContain("workflowTone.bodyClassName");
    expect(pageSource).toContain("workflowTone.badgeClassName");
  });

  it("대시보드에 '플랫폼별 글 생성' 섹션이 핵심 영역으로 존재한다 (Phase 3-23)", () => {
    expect(pageSource).toContain('id="platform-generation"');
    expect(pageSource).toContain("플랫폼별 글 생성");
    expect(pageSource).toContain("PlatformSelectionCheckboxes");
    expect(pageSource).toContain("generateSelectedPlatformPostsAction");
    expect(pageSource).toContain("generateAllPlatformPostsAction");
  });

  it("계약 검사 결과/기사 본문 미리보기/파이프라인 로그는 '상세 관리' 접힘 영역에 있다 (Phase 3-23)", () => {
    const detailsIndex = pageSource.indexOf("상세 관리 (계약 검사 결과");
    expect(detailsIndex).toBeGreaterThan(0);
    const contractIndex = pageSource.indexOf("ContractCheckResult", detailsIndex);
    const logIndex = pageSource.indexOf("파이프라인 로그 (실행 이력)", detailsIndex);
    expect(contractIndex).toBeGreaterThan(detailsIndex);
    expect(logIndex).toBeGreaterThan(detailsIndex);
  });

  it("출처 상태 요약이 출처 등록 폼보다 먼저 표시된다", () => {
    const statusIndex = pageSource.indexOf("출처 {sourceStatus.total}개 등록됨");
    const formIndex = pageSource.indexOf("+ 출처 추가");
    expect(statusIndex).toBeGreaterThanOrEqual(0);
    expect(formIndex).toBeGreaterThan(statusIndex);
  });

  it("출처 등록 폼은 <details>로 기본 접힘이고(단 출처가 부족한 현재 단계이거나 오류가 있으면 펼쳐진다), URL 외 필드는 중첩된 접기 영역(추가 정보 입력) 안에 있다 (Phase 3-23-2)", () => {
    expect(pageSource).toMatch(
      /<details className="group mt-3" open=\{Boolean\(sourceError\) \|\| sectionExpansion\.sourceAddExpanded\}>/
    );
    expect(pageSource).toContain("추가 정보 입력 (선택)");
    const detailMatch = pageSource.match(/추가 정보 입력 \(선택\)[\s\S]*?<\/details>/);
    expect(detailMatch).not.toBeNull();
    expect(detailMatch![0]).toContain('name="publisher"');
    expect(detailMatch![0]).toContain('name="summary"');
  });

  it("출처 목록에서 URL 전체 대신 도메인(extractDomain)을 표시한다", () => {
    expect(pageSource).toContain("extractDomain(source.url)");
    expect(pageSource).not.toMatch(/\{source\.url \|\| "\(URL 없음\)"\}/); // 예전처럼 URL 전체를 그대로 노출하지 않는다
  });

  it("출처 요약은 line-clamp-2로 제한되고, 전체 보기/본문 보기는 <details>로 분리된다", () => {
    expect(pageSource).toMatch(/line-clamp-2 break-keep text-xs leading-relaxed text-zinc-600/);
    expect(pageSource).toContain("요약 전체 보기");
    expect(pageSource).toContain("본문 보기");
  });

  it("원문 열기 링크가 새 탭으로 열린다", () => {
    expect(pageSource).toMatch(/href=\{source\.url\}[\s\S]{0,60}target="_blank"/);
  });

  it("출처 삭제 버튼은 이번 작업에 포함하지 않았다는 설명이 남아 있다(DB schema 변경 금지 원칙과의 충돌 문서화)", () => {
    expect(pageSource).toContain("삭제 기능은 이번 작업에서 추가하지 않았다");
  });

  it("테마 생성/출처 추가/기사 생성 서버 액션은 그대로 유지된다(기능 로직 변경 금지)", () => {
    expect(pageSource).toContain("action={createTheme}");
    expect(pageSource).toContain("action={addSource}");
    expect(pageSource).toContain("action={generateArticleDraft}");
  });

  it("모바일에서는 flex-col-reverse로 선택된 테마 작업 영역이 먼저, 테마 목록 사이드바가 나중에 표시된다", () => {
    expect(pageSource).toContain("flex flex-col-reverse gap-6 lg:grid lg:grid-cols-[280px_1fr]");
  });

  it("주요 텍스트(테마 제목/설명, 출처 제목)에 break-keep을 적용한다", () => {
    expect(pageSource).toMatch(/<h2 className="break-keep text-lg font-semibold">\{selectedTheme\.title\}<\/h2>/);
    expect(pageSource).toMatch(/break-keep text-sm text-zinc-600">\{selectedTheme\.description\}/);
    expect(pageSource).toMatch(/min-w-0 flex-1 break-keep font-medium/);
  });
});

describe("기사초안 생성 무반응 방지 (정적 소스 검사, Phase 2-22)", () => {
  it("mode 값이 없으면 조용히 기본값으로 대체하지 않고 오류를 표시한다", () => {
    expect(actionsSource).toContain("isArticleMode(rawArticleMode)");
    expect(actionsSource).toContain("기사 유형을 선택해 주세요.");
  });

  it("이미 이 테마로 생성된 기사가 있으면 confirmed=true가 아닌 한 재생성을 진행하지 않는다", () => {
    expect(actionsSource).toContain('formData.get("confirmed") === "true"');
    expect(actionsSource).toContain("existingArticle && !confirmed");
    expect(actionsSource).toContain("regenerateConfirm=1");
  });

  it("mode 변경 여부를 감지해서 별도로 기록한다", () => {
    expect(actionsSource).toContain("article_generation_mode_change_detected");
    expect(actionsSource).toContain("existingArticle.articleMode !== articleMode");
  });

  it("출처 계약 검사 실패 시 더 이상 메시지 없이 조용히 redirect하지 않는다", () => {
    const fnBody = actionsSource.slice(
      actionsSource.indexOf("export async function generateArticleDraft"),
      actionsSource.indexOf("export async function", actionsSource.indexOf("export async function generateArticleDraft") + 1)
    );
    expect(fnBody).toContain("article_generation_blocked_insufficient_sources");
    expect(fnBody.match(/error=\$\{encodeURIComponent/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("기사 계약 검사(min-linked-sources 등) 실패 시에도 메시지 없이 조용히 redirect하지 않는다 (확인된 무반응 버그의 실제 원인)", () => {
    expect(actionsSource).toContain("article_generation_blocked_contract_failed");
    expect(actionsSource).not.toMatch(/if \(!articleResult\.passed\) \{\s*revalidatePath\("\/dashboard"\);\s*redirect\(`\/dashboard\?themeId=\$\{themeId\}`\);\s*\}/);
  });

  it("계약 검사 실패 시 citedSourceIds를 임의로 채워 넣어 억지로 통과시키지 않는다 (컨텐츠 정합성)", () => {
    expect(actionsSource).not.toMatch(/citedSourceIds\.push/);
    expect(actionsSource).not.toMatch(/citedSourceIds\s*=\s*\[.*sources\.map/);
  });

  it("성공 시 generated=1과 생성된 mode를 query param으로 전달해 화면에 안내한다", () => {
    expect(actionsSource).toContain("generated=1&generatedMode=${articleMode}");
    expect(actionsSource).toContain("article_generation_completed");
  });

  it("article_generation_clicked를 액션 시작 시 항상 기록한다", () => {
    expect(actionsSource).toContain("article_generation_clicked");
  });

  it("페이지는 재생성 확인 배너(취소/새 원고로 생성)를 표시한다 (Phase 4-1)", () => {
    expect(pageSource).toContain("showRegenerateConfirm");
    expect(pageSource).toContain("새 원고로 생성");
    expect(pageSource).toContain("이미 이 테마로 생성된 마스터 원고가 있습니다.");
  });

  it("disabled 버튼에는 이유를 표시한다(출처 부족)", () => {
    const start = pageSource.indexOf('disabled={sources.length < MIN_SOURCE_COUNT}');
    const end = pageSource.indexOf("</form>", start);
    const block = pageSource.slice(start, end);
    expect(block).toContain("출처가 부족합니다");
  });

  it("이미 마스터 원고가 있으면 라디오 폼 대신 '생성 완료' 요약과 재생성 옵션 토글을 보여준다 (Phase 3-23-4, Phase 4-1)", () => {
    expect(pageSource).toContain("생성 완료");
    expect(pageSource).toContain("재생성 옵션");
    expect(pageSource).toContain("마스터 원고 다시 만들기");
  });

  it("생성 성공/실패 메시지를 TransientNotice로 표시한다", () => {
    expect(pageSource).toContain("generationSuccessMessage");
    expect(pageSource).toContain("generationError");
  });

  it("wordpress_blog 생성 흐름과 article mode monetized_blog를 혼동하지 않는다 (actions.ts는 article 생성 전용)", () => {
    expect(actionsSource).not.toContain("wordpress_blog");
    expect(actionsSource).not.toContain("createWordPressDraftFromBlogPostAction");
  });

  it("화면 상단에 진행 단계 표시(ContentProgressSteps)가 있다 (Phase 3-22)", () => {
    expect(pageSource).toContain("ContentProgressSteps");
  });
});

describe("마스터 원고 중심 구조 전환 — 1차 (정적 소스 검사, Phase 4-1)", () => {
  it("기본 화면에서 3종류(글쓰기 모드) 라디오가 강제로 보이지 않고 '고급 옵션' 접힘 안에 있다", () => {
    expect(pageSource).toContain("고급 옵션: 원고 생성 방향 선택 (기본값: 자동 추천)");
    expect(pageSource).toMatch(/<details className="group rounded border border-zinc-200 px-3 py-2">/);
  });

  it("기본 버튼은 '마스터 원고 만들기'다", () => {
    expect(pageSource).toContain("마스터 원고 만들기");
  });

  it("'자동 추천'이 기본 선택값이다", () => {
    expect(pageSource).toMatch(/defaultChecked=\{direction === AUTO_MASTER_MANUSCRIPT_DIRECTION\}/);
  });

  it("기존 3종류(general_news/source_based_explainer/monetized_blog)는 삭제되지 않고 방향 선택지로 남아 있다", () => {
    expect(pageSource).toContain("MASTER_MANUSCRIPT_DIRECTION_LIST");
    expect(pageSource).toContain("ARTICLE_MODE_CONFIGS[direction].description");
  });

  it("actions.ts는 '자동 추천'(auto)을 DB에 저장하기 전에 실제 ArticleMode로 바꾼다(DB의 article_mode CHECK 제약과 호환)", () => {
    expect(actionsSource).toContain("resolveMasterManuscriptDirection");
    expect(actionsSource).toContain("AUTO_MASTER_MANUSCRIPT_DIRECTION");
    expect(actionsSource).toContain("isArticleMode(rawArticleMode)");
  });

  it("생성 성공 메시지가 '마스터 원고'라는 표현을 사용한다(article이라는 raw 용어 대신)", () => {
    expect(pageSource).toContain("방향으로 마스터 원고가 생성되었습니다.");
  });
});

describe("마스터 원고 중심 구조 전환 — 2차 platformBrief 구조화 (정적 소스 검사, Phase 4-2)", () => {
  it("기사초안 저장 직후 마스터 원고(platformBrief 재료)를 계산해 저장한다", () => {
    expect(actionsSource).toContain('import { buildMasterManuscript } from "@/lib/articles/master-manuscript-builder"');
    expect(actionsSource).toContain("buildMasterManuscript(article, citedSources)");
    expect(actionsSource).toContain("saveArticleMasterManuscript(article.id, masterManuscript)");
  });

  it("마스터 원고 계산/저장에 실패해도 기사초안 저장 자체는 막지 않는다(try/catch로 감싼다)", () => {
    const start = actionsSource.indexOf("const masterManuscript = buildMasterManuscript");
    const tryStart = actionsSource.lastIndexOf("try {", start);
    const catchIndex = actionsSource.indexOf("} catch (error) {", start);
    expect(tryStart).toBeGreaterThan(0);
    expect(catchIndex).toBeGreaterThan(start);
  });

  it("AI를 다시 호출하지 않는다(마스터 원고는 이미 생성된 article/source로부터 결정적으로 계산된다)", () => {
    const start = actionsSource.indexOf("4.5) Phase 4-2");
    const end = actionsSource.indexOf("// 5) AI Evals");
    const block = actionsSource.slice(start, end);
    expect(block).not.toMatch(/generateAiArticleDraft|getAnthropicClient|shouldUseAnthropic\(\)/);
  });
});

describe("dashboard 상태 판단 통합 및 섹션 접힘 (정적 소스 검사, Phase 3-23-2)", () => {
  it("출처 추가/플랫폼 생성 폼은 getDashboardSectionExpansion 결과로 펼침/접힘이 결정되고, 현재 단계가 아닌 관리 영역은 별도 접힘 영역으로 옮겨진다 (Phase 3-23-4)", () => {
    expect(pageSource).toContain("getDashboardSectionExpansion(workflowState)");
    expect(pageSource).toContain("getDashboardCurrentStepArea(workflowState)");
    expect(pageSource).toMatch(
      /<details className="group mt-3" open=\{Boolean\(sourceError\) \|\| sectionExpansion\.sourceAddExpanded\}>/
    );
    expect(pageSource).toMatch(/<details className="mt-3" open=\{sectionExpansion\.platformGenerationExpanded\}>/);
    // 출처 목록은 이제 상태와 무관하게 항상 "전체 출처 보기" 토글 뒤로 접힌다.
    expect(pageSource).toContain("전체 출처 보기");
    // 현재 단계가 아닌 세 관리 영역(출처/원고/플랫폼)은 "다른 단계 관리 보기" 접힘 영역에 모인다.
    expect(pageSource).toContain("다른 단계 관리 보기");
    expect(pageSource).toContain('currentStepArea !== "source" && sourceManagementBlock');
    expect(pageSource).toContain('currentStepArea !== "draft" && draftManagementBlock');
    expect(pageSource).toContain('currentStepArea !== "platform" && platformManagementBlock');
  });

  it("workflowState가 ready_for_publish_prep이면 '게시 준비' 섹션이 다른 관리 영역보다 먼저 표시된다 (Phase 3-23-4)", () => {
    const publishPrepIndex = pageSource.indexOf('workflowState === "ready_for_publish_prep" && article');
    const renderIndex = pageSource.indexOf("{publishPrepSection}");
    const sourceBlockRenderIndex = pageSource.indexOf('{currentStepArea === "source" && sourceManagementBlock}');
    expect(publishPrepIndex).toBeGreaterThan(0);
    expect(renderIndex).toBeGreaterThan(0);
    expect(renderIndex).toBeLessThan(sourceBlockRenderIndex);
    expect(pageSource).toContain("WordPress Draft 반영");
    expect(pageSource).toContain("수동 export 보기");
  });

  it("'관련 기사 URL 수집' CTA가 테마 요약 카드와 상태 카드에 중복 렌더링되지 않는다(하드코딩된 Link는 상태 카드 쪽 helper에만 있다)", () => {
    const literalLinkCount = (pageSource.match(/href=\{`\/themes\/\$\{selectedTheme\.id\}`\}/g) ?? []).length;
    expect(literalLinkCount).toBe(0); // 페이지에는 테마 URL 하드코딩 링크가 없다 — statusSummary.secondaryActionHref로만 렌더링된다.
    expect(pageSource).toContain("statusSummary.secondaryActionHref");
  });

  it("모바일 전용 방향 표현('왼쪽에서')이 사용자에게 보이는 문구에는 없다", () => {
    // 코드 주석 설명에는 남아 있을 수 있으나, 실제 안내 문구로는 쓰지 않는다.
    expect(pageSource).not.toMatch(/왼쪽에서 테마를 먼저 생성하세요/);
  });

  it("article! non-null assertion을 사용하지 않는다 — article이 없을 때도 안전하게 렌더링된다", () => {
    expect(pageSource).not.toMatch(/article!\./);
    expect(pageSource).not.toMatch(/article!\[/);
  });

  it("마스터 원고 섹션은 heading(<h2>)을 가진 섹션이다(한 줄 텍스트로 축소되지 않는다) (Phase 3-23-4, Phase 4-1)", () => {
    const match = pageSource.match(/<h2 className="text-sm font-semibold text-zinc-700">마스터 원고<\/h2>/);
    expect(match).not.toBeNull();
    expect(pageSource).toContain("마스터 원고 보기");
  });

  it("#generate-draft, #platform-generation, #theme-list 앵커 대상은 tabIndex={-1}로 포커스 가능하다(접근성)", () => {
    expect(pageSource).toMatch(/id="generate-draft"\s+tabIndex=\{-1\}/);
    expect(pageSource).toMatch(/id="platform-generation"\s+tabIndex=\{-1\}/);
    expect(pageSource).toMatch(/id="theme-list"\s+tabIndex=\{-1\}/);
  });

  it("대시보드에서 플랫폼별 글 생성을 실행해도 결과 확인을 위해 /articles/[id]로 강제 이동하지 않는다 — returnTo가 대시보드 자기 자신이다", () => {
    expect(pageSource).not.toContain("buildArticleOverviewUrl");
    expect(pageSource).toContain("dashboardPlatformGenerationReturnTo");
    expect(pageSource).toMatch(/name="returnTo" value=\{dashboardPlatformGenerationReturnTo\}/);
  });

  it("대시보드에서 실행한 플랫폼 글 생성 결과 메시지(publishMessage)를 대시보드 안에서 표시한다", () => {
    expect(pageSource).toContain("publishMessage");
    expect(pageSource).toContain("platformGenerationMessage");
    expect(pageSource).toContain("플랫폼 글 생성 결과");
  });
});

describe("dashboard 플랫폼 카드 / 출처 목록 축소 / 새 테마 축소 (정적 소스 검사, Phase 3-23-4)", () => {
  it("플랫폼별 글 생성 영역은 각 플랫폼마다 상태/다음 작업/예상 비용/주요 버튼 1개를 보여주는 카드로 구성된다", () => {
    expect(pageSource).toContain("platformCards");
    expect(pageSource).toMatch(/상태: \{card\.statusLabel\}/);
    expect(pageSource).toMatch(/다음 작업: \{card\.nextActionLabel\}/);
    expect(pageSource).toMatch(/예상 비용: \{COST_LEVEL_LABELS\[card\.costLevel\]\}/);
    expect(pageSource).toContain("글 생성하기");
    expect(pageSource).toContain("글 검토하기");
  });

  it("전체 플랫폼 글 생성은 여전히 고급 옵션(접힘) 안에 있고, 비용 경고 확인 모달(ConfirmSubmitButton)이 유지된다", () => {
    expect(pageSource).toContain("고급 옵션: 전체 플랫폼 글 생성");
    expect(pageSource).toContain("ConfirmSubmitButton");
    expect(pageSource).toContain("confirmMessage");
    expect(pageSource).toContain("그래도 전체 생성하시겠습니까?");
  });

  it("출처 목록은 기본적으로 전체를 펼치지 않고, 최근 출처 미리보기 + '전체 출처 보기' 토글로 구성된다", () => {
    expect(pageSource).toContain("recentSources");
    expect(pageSource).toContain("전체 출처 보기 ({sources.length}개)");
  });

  it("새 테마 입력은 기본적으로 '+ 새 테마' 버튼만 보이도록 축소되어 있다(이미 만족됨)", () => {
    expect(pageSource).toMatch(/<span className="group-open:hidden">\+ 새 테마<\/span>/);
  });
});

describe("dashboard 마스터 원고 갱신 권장 배너 (정적 소스 검사, Phase 1-24)", () => {
  it("needsMasterManuscriptRefresh 플래그가 있으면 갱신 권장 배너를 표시한다", () => {
    expect(pageSource).toContain("needsMasterManuscriptRefresh");
    expect(pageSource).toContain("새 출처가 추가되었습니다.");
  });

  it("갱신/유지 선택지를 모두 제공하고 자동으로 원고를 덮어쓰지 않는다", () => {
    expect(pageSource).toContain("마스터 원고 갱신");
    expect(pageSource).toContain("dismissMasterManuscriptRefreshNotice");
    expect(pageSource).toContain("기존 원고 유지");
  });
});
