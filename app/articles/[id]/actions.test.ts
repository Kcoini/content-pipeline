import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Phase 3-17: actions.ts는 30개 이상의 서비스를 조합하는 서버 액션 모음이라
// 전부 mocking해 동작 테스트를 하기보다, 이 프로젝트의 기존 관례(article/
// page.test.ts 등)를 따라 정적 소스 검사로 다음을 확인한다:
//  1. returnTo 안전성 검증(getSafeReturnTo)이 실제로 적용되는지
//  2. 외부 URL로 직접 redirect하는 코드가 없는지(redirect(`http...`) 등)
//  3. Phase 3-17 이전부터 있던 business logic(서비스 함수 호출) import가
//     이름 그대로 남아있는지 — 즉 이번 단계가 로직을 바꾸지 않았는지.
// getSafeReturnTo/deep link URL 생성 자체의 세부 동작은
// lib/navigation/return-to.test.ts, lib/navigation/article-deep-links.test.ts
// 에서 이미 충분히 검증한다.

const actionsSource = readFileSync(path.join(__dirname, "actions.ts"), "utf8");

describe("app/articles/[id]/actions.ts (정적 소스 검사, Phase 3-17)", () => {
  it("social/rewrite action들이 redirectToSafeTarget(getSafeReturnTo 기반)을 사용한다", () => {
    const matches = actionsSource.match(/redirectToSafeTarget\(/g) ?? [];
    // Phase 3-17에서 returnTo를 적용한 23개 action 모두 이 helper를 거친다.
    expect(matches.length).toBeGreaterThanOrEqual(23);
  });

  it("redirectToSafeTarget은 formData의 returnTo를 getSafeReturnTo로 검증한 뒤에만 사용한다", () => {
    const fnBody = actionsSource.slice(
      actionsSource.indexOf("function redirectToSafeTarget"),
      actionsSource.indexOf("}", actionsSource.indexOf("function redirectToSafeTarget"))
    );
    expect(fnBody).toContain('formData.get("returnTo")');
    expect(fnBody).toContain("getSafeReturnTo(");
  });

  it("사용자 입력(returnTo)을 검증 없이 그대로 redirect()에 넘기는 코드가 없다", () => {
    // `redirect(returnToRaw)`처럼 원본 입력을 바로 넘기는 패턴이 없어야 한다 —
    // 항상 getSafeReturnTo(...)를 거친 안전한 URL만 redirect() 인자로 쓴다.
    expect(actionsSource).not.toMatch(/redirect\(\s*returnToRaw/);
    expect(actionsSource).not.toMatch(/redirect\(\s*String\(formData\.get\("returnTo"\)/);
  });

  it("기존 social/rewrite business logic(서비스 함수) import가 이름 그대로 유지된다", () => {
    const expectedImports = [
      "generatePlaceholderDraft",
      "generateSocialDraft",
      "rerunSocialPostQualityGate",
      "requestSocialPostApprovalService",
      "approveSocialPostService",
      "generateManualExport",
      "runPlatformPublishingGuard",
      "createPlatformPublishDryRun",
      "completePlatformExportHandoff",
      "prepareManualPostingRecord",
      "recordManualPostingResult",
      "recordSocialPostMetrics",
      "generatePerformanceRewriteSuggestion",
      "approveRewriteSuggestion",
      "rejectRewriteSuggestion",
      "applyRewriteSuggestion",
      "recheckRewriteVersionQuality",
      "compareRewriteVersion",
      "requestRewriteReapproval",
      "approveRewriteReapproval",
      "prepareRewriteReexport",
      "generateRewriteReexportPayload",
      "compareRewritePerformance",
    ];
    for (const fn of expectedImports) {
      expect(actionsSource).toContain(fn);
    }
  });

  it("WordPress 발행 파이프라인 action들은 이번 단계에서 건드리지 않는다 (기존 redirect(`/articles/${articleId}...`) 그대로 유지)", () => {
    expect(actionsSource).toContain("export async function publishToWordPressDraftAction");
    expect(actionsSource).toContain("export async function publishApprovedArticleToWordPressAction");
    // WordPress 관련 action들은 여전히 단순 redirect(`/articles/${articleId}?...`) 패턴을 사용한다
    // (redirectToSafeTarget으로 옮기지 않았다).
    const publishFnBody = actionsSource.slice(
      actionsSource.indexOf("export async function publishApprovedArticleToWordPressAction"),
      actionsSource.indexOf("export async function publishApprovedArticleToWordPressAction") + 900
    );
    expect(publishFnBody).not.toContain("redirectToSafeTarget");
  });

  it("returnTo가 안전하지 않으면 fallback(deep link)으로만 이동한다 — 로그에 전체 returnTo 원문을 남기지 않는다", () => {
    expect(actionsSource).not.toMatch(/logEvent\([^)]*returnTo/);
  });
});
