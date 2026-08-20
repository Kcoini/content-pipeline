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

describe("createWordPressDraftFromBlogPostAction (정적 소스 검사, article/blog 역할 분리)", () => {
  const fnBody = actionsSource.slice(
    actionsSource.indexOf("export async function createWordPressDraftFromBlogPostAction"),
    actionsSource.indexOf("export async function testWordPressConnectionAction")
  );

  it("wordpress_blog 글 기준 readiness(checkWordPressBlogPublishReadiness)를 먼저 확인한다", () => {
    expect(fnBody).toContain("checkWordPressBlogPublishReadiness");
    expect(fnBody).toContain("readiness.ready");
  });

  it("readiness가 ready가 아니면 publishArticleToWordPressDraft를 호출하지 않는다 (early throw)", () => {
    const guardIndex = fnBody.indexOf("if (!readiness.ready)");
    const publishIndex = fnBody.indexOf("await publishArticleToWordPressDraft(articleId,");
    expect(guardIndex).toBeGreaterThan(-1);
    expect(publishIndex).toBeGreaterThan(guardIndex);
  });

  it("platform이 wordpress_blog가 아니면 차단한다", () => {
    expect(fnBody).toContain('post.platform !== "wordpress_blog"');
  });

  it("기존 publishArticleToWordPressDraft(실제 WordPress API 호출 로직)를 재사용하고 새로 만들지 않는다", () => {
    expect(fnBody).toContain("publishArticleToWordPressDraft(articleId,");
  });

  it("wordpress_blog 글 자체의 title/body를 contentOverride로 넘긴다 (article 원문 title/content 사용 안 함)", () => {
    expect(fnBody).toContain("buildWordPressBlogContentOverride(post)");
    expect(fnBody).toContain("contentOverride: buildWordPressBlogContentOverride(post)");
  });

  it("차단/요청 이벤트를 pipeline_logs에 기록한다", () => {
    expect(fnBody).toContain("blog_post_wordpress_draft_blocked");
    expect(fnBody).toContain("blog_post_wordpress_draft_requested");
  });
});

describe("buildWordPressBlogContentOverride (정적 소스 검사)", () => {
  const fnBody = actionsSource.slice(
    actionsSource.indexOf("function buildWordPressBlogContentOverride"),
    actionsSource.indexOf("function buildWordPressBlogContentOverride") + 500
  );

  it("post.postTitle/postBody/excerpt만 사용하고 article 원문 필드를 읽지 않는다", () => {
    expect(fnBody).toContain("post.postTitle");
    expect(fnBody).toContain("post.postBody");
    expect(fnBody).toContain("post.excerpt");
    expect(fnBody).not.toMatch(/article\.(title|content)/);
  });
});

describe("wordpress_blog 게시 준비 action들 (정적 소스 검사)", () => {
  it("updateWordPressDraftFromBlogPostAction은 기존 publishArticleToWordPressDraft를 force:true로 재사용한다", () => {
    const fnBody = actionsSource.slice(
      actionsSource.indexOf("export async function updateWordPressDraftFromBlogPostAction"),
      actionsSource.indexOf("export async function updateWordPressSeoMetadataFromBlogPostAction")
    );
    expect(fnBody).toContain("publishArticleToWordPressDraft(articleId, { force: true, contentOverride })");
    expect(fnBody).toContain("checkWordPressBlogPublishReadiness");
    expect(fnBody).toContain("buildWordPressBlogContentOverride(post)");
  });

  it("updateWordPressSeoMetadataFromBlogPostAction은 wordpress_blog 기준 SEO 서비스를 사용한다", () => {
    const fnBody = actionsSource.slice(
      actionsSource.indexOf("export async function updateWordPressSeoMetadataFromBlogPostAction"),
      actionsSource.indexOf("export async function attachWordPressFeaturedImageFromBlogPostAction")
    );
    expect(fnBody).toContain("updateWordPressSeoMetadataFromBlogPost(articleId, socialPostId)");
  });

  it("regenerateWordPressBlogMetadataAction은 wordpress_blog 기준 metadata 재생성 서비스를 사용한다", () => {
    const fnBody = actionsSource.slice(
      actionsSource.indexOf("export async function regenerateWordPressBlogMetadataAction"),
      actionsSource.indexOf("export async function attachWordPressFeaturedImageFromBlogPostAction")
    );
    expect(fnBody).toContain("regenerateWordPressBlogMetadata(articleId, socialPostId)");
    expect(fnBody).toContain("redirectToSafeTarget(");
    expect(fnBody).toContain("buildArticleBlogUrl(articleId");
  });

  it("attachWordPressFeaturedImageFromBlogPostAction은 기존 attachFeaturedMediaToDraft를 재사용하고 readiness를 먼저 확인한다", () => {
    const fnBody = actionsSource.slice(
      actionsSource.indexOf("export async function attachWordPressFeaturedImageFromBlogPostAction"),
      actionsSource.indexOf("export async function prepareWordPressBlogPostForPublishingAction")
    );
    expect(fnBody).toContain("checkWordPressBlogPublishReadiness");
    expect(fnBody).toContain("attachFeaturedMediaToDraft(articleId)");
  });

  it("prepareWordPressBlogPostForPublishingAction은 오케스트레이터를 호출하고 실제 공개 게시 API를 새로 호출하지 않는다", () => {
    const fnBody = actionsSource.slice(
      actionsSource.indexOf("export async function prepareWordPressBlogPostForPublishingAction"),
      actionsSource.indexOf("export async function testWordPressConnectionAction")
    );
    expect(fnBody).toContain("prepareWordPressBlogPostForPublishing(articleId, socialPostId)");
    expect(fnBody).not.toMatch(/publishApprovedArticleToWordPress|approvePublicPublish/);
  });

  it("다섯 개 action 모두 wordpress_blog 카드로 돌아가는 redirectToSafeTarget을 사용한다", () => {
    for (const fnName of [
      "updateWordPressDraftFromBlogPostAction",
      "updateWordPressSeoMetadataFromBlogPostAction",
      "saveWordPressFeaturedImageMediaForBlogPostAction",
      "attachWordPressFeaturedImageFromBlogPostAction",
      "prepareWordPressBlogPostForPublishingAction",
    ]) {
      const start = actionsSource.indexOf(`export async function ${fnName}`);
      const closingMatch = /\r?\n\}\r?\n/.exec(actionsSource.slice(start));
      const end = closingMatch ? start + closingMatch.index + closingMatch[0].length : actionsSource.length;
      const fnBody = actionsSource.slice(start, end);
      expect(fnBody).toContain("redirectToSafeTarget(");
      expect(fnBody).toContain("buildArticleBlogUrl(articleId");
    }
  });
});

describe("saveWordPressFeaturedImageMediaForBlogPostAction (정적 소스 검사)", () => {
  const fnBody = actionsSource.slice(
    actionsSource.indexOf("export async function saveWordPressFeaturedImageMediaForBlogPostAction"),
    actionsSource.indexOf("export async function attachWordPressFeaturedImageFromBlogPostAction")
  );

  it("wordpress_blog 기준 featured image 서비스를 사용한다", () => {
    expect(fnBody).toContain("saveWordPressFeaturedImageMediaForBlogPost(articleId, socialPostId, mediaId, mediaUrl)");
  });

  it("mediaId를 formData에서 읽어 Number로 변환한다", () => {
    expect(fnBody).toContain('formData.get("mediaId")');
    expect(fnBody).toContain("Number(mediaIdRaw)");
  });

  it("mediaUrl은 선택 입력이다(빈 값이면 undefined)", () => {
    expect(fnBody).toContain('formData.get("mediaUrl")');
  });
});

describe("uploadWordPressFeaturedImageFromBlogPostAction (정적 소스 검사)", () => {
  const fnBody = actionsSource.slice(
    actionsSource.indexOf("export async function uploadWordPressFeaturedImageFromBlogPostAction"),
    actionsSource.indexOf("export async function saveWordPressFeaturedImageMediaForBlogPostAction")
  );

  it("wordpress_blog 기준 로컬 이미지 업로드 서비스를 사용한다", () => {
    expect(fnBody).toContain("uploadWordPressFeaturedImageFromBlogPost(articleId, socialPostId, file)");
  });

  it("file을 formData에서 읽고 File 인스턴스인지 확인한다", () => {
    expect(fnBody).toContain('formData.get("file")');
    expect(fnBody).toContain("fileRaw instanceof File");
  });

  it("wordpress_blog 카드로 돌아가는 redirectToSafeTarget을 사용한다", () => {
    expect(fnBody).toContain("redirectToSafeTarget(");
    expect(fnBody).toContain("buildArticleBlogUrl(articleId");
  });

  it("파일 binary나 Authorization을 직접 다루지 않는다 (기존 서비스에 위임)", () => {
    expect(fnBody).not.toMatch(/Authorization|Application[_-]?Password/i);
  });
});

describe("waiveArticleWordPressFeaturedImageAction (정적 소스 검사)", () => {
  const fnBody = actionsSource.slice(
    actionsSource.indexOf("export async function waiveArticleWordPressFeaturedImageAction"),
    actionsSource.indexOf("export async function createWordPressDraftFromBlogPostAction")
  );

  it("article 전용 waiver 서비스(lib/publish)를 사용한다 — wordpress_blog 서비스(lib/social)와 분리", () => {
    expect(fnBody).toContain("waiveArticleWordPressFeaturedImage(articleId, reasonCode, memo)");
    expect(actionsSource).toContain("@/lib/publish/article-wordpress-featured-image-waiver-service");
  });

  it("reasonCode/memo를 formData에서 읽는다", () => {
    expect(fnBody).toContain('formData.get("reasonCode")');
    expect(fnBody).toContain('formData.get("memo")');
  });

  it("기존 WordPress 발행 action들과 동일하게 단순 redirect(`/articles/${articleId}...`) 패턴을 사용한다 (redirectToSafeTarget 아님)", () => {
    expect(fnBody).not.toContain("redirectToSafeTarget");
    expect(fnBody).toContain("redirect(`/articles/${articleId}");
  });
});

describe("대표 이미지가 새로 준비되면 article waiver를 자동 해제한다 (정적 소스 검사)", () => {
  it("saveLocalFeaturedImageAction/saveExistingWordPressMediaSourceAction/uploadFeaturedImageToWordPressAction 성공 시 clearArticleWordPressFeaturedImageWaiver를 호출한다", () => {
    const matches = actionsSource.match(/clearArticleWordPressFeaturedImageWaiver\(articleId\)/g) ?? [];
    expect(matches.length).toBe(3);
  });

  it("wordpress_blog 쪽 waiver 서비스는 별도로 import되어 있어 두 상태가 섞이지 않는다", () => {
    expect(actionsSource).toContain("@/lib/social/wordpress-blog-featured-image-waiver-service");
    expect(actionsSource).toContain("@/lib/publish/article-wordpress-featured-image-waiver-service");
  });
});

describe("waiveWordPressFeaturedImageForBlogPostAction (정적 소스 검사)", () => {
  const fnBody = actionsSource.slice(
    actionsSource.indexOf("export async function waiveWordPressFeaturedImageForBlogPostAction"),
    actionsSource.indexOf("export async function attachWordPressFeaturedImageFromBlogPostAction")
  );

  it("wordpress_blog 기준 대표 이미지 waive 서비스를 사용한다", () => {
    expect(fnBody).toContain("waiveWordPressFeaturedImageForBlogPost(articleId, socialPostId, reasonCode, memo)");
  });

  it("reasonCode/memo를 formData에서 읽는다", () => {
    expect(fnBody).toContain('formData.get("reasonCode")');
    expect(fnBody).toContain('formData.get("memo")');
  });

  it("wordpress_blog 카드로 돌아가는 redirectToSafeTarget을 사용한다", () => {
    expect(fnBody).toContain("redirectToSafeTarget(");
    expect(fnBody).toContain("buildArticleBlogUrl(articleId");
  });
});

describe("updateWordPressSeoPluginMetadataFromBlogPostAction (정적 소스 검사)", () => {
  const fnBody = actionsSource.slice(
    actionsSource.indexOf("export async function updateWordPressSeoPluginMetadataFromBlogPostAction"),
    actionsSource.indexOf("export async function generateWordPressBlogFeaturedImagePromptAction")
  );

  it("wordpress_blog 기준 SEO Plugin 서비스를 사용한다", () => {
    expect(fnBody).toContain("writeWordPressBlogSeoPluginMetadata(articleId, socialPostId, provider)");
  });

  it("seoPluginProvider를 formData에서 읽는다", () => {
    expect(fnBody).toContain('formData.get("seoPluginProvider")');
  });

  it("skipped 결과는 오류로 표시하지 않는다", () => {
    expect(fnBody).toContain("!result.success && !result.skipped");
  });
});

describe("generateWordPressBlogFeaturedImagePromptAction / generateWordPressBlogFeaturedImageAction (정적 소스 검사)", () => {
  it("각각 wordpress_blog 이미지 생성 서비스를 사용한다", () => {
    const promptFnBody = actionsSource.slice(
      actionsSource.indexOf("export async function generateWordPressBlogFeaturedImagePromptAction"),
      actionsSource.indexOf("export async function generateWordPressBlogFeaturedImageAction")
    );
    const generateFnBody = actionsSource.slice(
      actionsSource.indexOf("export async function generateWordPressBlogFeaturedImageAction"),
      actionsSource.indexOf("export async function attachWordPressFeaturedImageFromBlogPostAction")
    );
    expect(promptFnBody).toContain("generateWordPressBlogFeaturedImagePrompt(articleId, socialPostId)");
    expect(generateFnBody).toContain("generateWordPressBlogFeaturedImage(articleId, socialPostId)");
  });

  it("article featured image 서비스(generateFeaturedImageAction 등)를 호출하지 않는다", () => {
    const start = actionsSource.indexOf("export async function generateWordPressBlogFeaturedImagePromptAction");
    const end = actionsSource.indexOf("export async function attachWordPressFeaturedImageFromBlogPostAction");
    const block = actionsSource.slice(start, end);
    expect(block).not.toContain("generateFeaturedImage(articleId)");
  });
});
