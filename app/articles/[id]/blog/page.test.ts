import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");
const filePickerSource = readFileSync(
  path.join(__dirname, "../../../../components/social/wordpress-featured-image-file-picker.tsx"),
  "utf8"
);

describe("article blog page (정적 소스 검사, Phase 3-17)", () => {
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

  it("성과 페이지 cross-page link(buildMetricsDeepLink)를 포함한다", () => {
    expect(pageSource).toContain("buildMetricsDeepLink");
  });

  it("ArticleWorkflowNavigation에 returnTo를 전달한다", () => {
    expect(pageSource).toMatch(/ArticleWorkflowNavigation[^>]*returnTo=\{returnTo\}/);
  });
});

describe("article blog page pagination (정적 소스 검사, Phase 3-18)", () => {
  it("page/perPage searchParam을 읽고 parsePagination을 사용한다", () => {
    expect(pageSource).toContain("page?: string");
    expect(pageSource).toContain("perPage?: string");
    expect(pageSource).toContain("parsePagination(");
  });

  it("PaginationControls를 렌더링한다", () => {
    expect(pageSource).toContain("PaginationControls");
  });

  it("targetPage가 현재 page와 다르면 이동 링크를 보여준다", () => {
    expect(pageSource).toContain("targetOnDifferentPage");
    expect(pageSource).toContain("targetPage");
  });

  it("상세 페이지(buildSocialPostDetailUrl)로 가는 링크를 포함한다", () => {
    expect(pageSource).toContain("buildSocialPostDetailUrl");
  });
});

describe("article/blog 역할 분리 (정적 소스 검사)", () => {
  it("wordpress_blog/naver_blog 역할을 구분하는 안내 문구를 표시한다", () => {
    expect(pageSource).toContain("wordpress_blog로 생성된 블로그 글입니다");
    expect(pageSource).toContain("이 글은 WordPress 게시용 블로그 글입니다.");
    expect(pageSource).toContain("이 글은 네이버 블로그 수동 게시용 글입니다.");
  });

  it("wordpress_blog 카드에서만 WordPress 게시 관련 버튼을 조건부로 렌더링한다", () => {
    const draftButtonIndex = pageSource.lastIndexOf("WordPress Draft 생성");
    const lastWordpressBlogCheckBeforeButton = pageSource.lastIndexOf('post.platform === "wordpress_blog"', draftButtonIndex);
    expect(draftButtonIndex).toBeGreaterThan(-1);
    expect(lastWordpressBlogCheckBeforeButton).toBeGreaterThan(-1);
    expect(pageSource).toContain("createWordPressDraftFromBlogPostAction");
    expect(pageSource).toContain("buildWordPressBlogPublishPreparationSummary");
  });

  it("wordpress_blog 카드는 기존 guard/dry-run/handoff action을 재사용한다", () => {
    expect(pageSource).toContain("runPlatformPublishingGuardAction");
    expect(pageSource).toContain("createPlatformPublishDryRunAction");
    expect(pageSource).toContain("completePlatformExportHandoffAction");
  });

  it("readiness가 차단 상태면 WordPress Draft 생성 버튼을 비활성화한다", () => {
    expect(pageSource).toContain("disabled={!readiness.ready}");
  });

  it("naver_blog 카드에서는 네이버 콘텐츠 안전 점검(checkNaverBlogContentSafety)을 사용한다", () => {
    expect(pageSource).toContain("checkNaverBlogContentSafety");
  });
});

describe("WordPress 게시 준비 섹션 (blog 카드 내부, 정적 소스 검사)", () => {
  it("공통 WordPressPublishingPanel을 targetType=wordpress_blog/isPrimaryWorkflow로 사용한다", () => {
    expect(pageSource).toContain("WordPressPublishingPanel");
    expect(pageSource).toContain('targetType="wordpress_blog"');
    expect(pageSource).toContain("isPrimaryWorkflow");
  });

  it("공통 패널에 draft/SEO/featured image 요약값을 props로 전달한다", () => {
    expect(pageSource).toContain("draftStatus: draft.exists");
    expect(pageSource).toContain("seoMetadataStatus: seo.status");
    // seoTitle/metaDescription/targetKeyword는 blogMetadata(post.platformMetadata
    // 전용)에서만 읽는다 — article 값으로 fallback하지 않는다.
    expect(pageSource).toContain("seoTitle: blogMetadata.seoTitle");
    expect(pageSource).toContain("metaDescription: blogMetadata.metaDescription");
    expect(pageSource).toContain("targetKeyword: blogMetadata.targetKeyword");
    expect(pageSource).toContain("featuredImageMediaId: featuredImage.wordpressMediaId");
    expect(pageSource).toContain("publishGuardStatus: guardStatus");
  });

  it("secondaryKeywords/featured image URL/연결 상태/오류/생략 사유도 전달한다", () => {
    expect(pageSource).toContain("secondaryKeywords: blogMetadata.secondaryKeywords");
    expect(pageSource).toContain("featuredImageUrl: featuredImage.wordpressUrl");
    expect(pageSource).toContain("featuredImageAttachStatus: featuredImage.attachStatus");
    expect(pageSource).toContain("featuredImageWaiverReason: featuredImage.waivedReasonCode");
  });

  it("lastUpdatedAt에 wordpress_blog 글(post) 자신의 updatedAt을 전달한다 (article updatedAt 아님)", () => {
    expect(pageSource).toContain("lastUpdatedAt: post.updatedAt");
  });

  it("SEO metadata 업데이트/대표 이미지 연결/일괄 실행 action을 wordpress_blog 카드 안에서 사용한다", () => {
    expect(pageSource).toContain("updateWordPressSeoMetadataFromBlogPostAction");
    expect(pageSource).toContain("attachWordPressFeaturedImageFromBlogPostAction");
    expect(pageSource).toContain("updateWordPressDraftFromBlogPostAction");
    expect(pageSource).toContain("prepareWordPressBlogPostForPublishingAction");
    expect(pageSource).toContain("게시 준비 자동 실행");
  });

  it("article 페이지 고급 기능을 사용하라는 안내 문구가 더 이상 없다", () => {
    expect(pageSource).not.toContain("article 페이지의 고급 기능");
    expect(pageSource).not.toContain("대표 이미지 연결/SEO metadata 업데이트는 article 페이지의 고급 기능을 함께 사용하세요");
    expect(pageSource).not.toContain("WordPress Metadata, Featured Image는 article 페이지에서 처리하세요");
  });

  it("wordpress_blog 요약은 posts를 순회하며 미리 계산된다 (Promise.all 기반)", () => {
    expect(pageSource).toContain("wordpressBlogSummaries");
    expect(pageSource).toMatch(/Promise\.all\(/);
  });

  it("quality_status/approval_status/featuredImageWaived/policyRiskScore를 공통 패널 props(또는 addendum)로 전달한다", () => {
    expect(pageSource).toContain("qualityStatus: post.qualityStatus");
    expect(pageSource).toContain("approvalStatus: post.approvalStatus");
    expect(pageSource).toContain("featuredImageWaived: featuredImage.waived");
    expect(pageSource).toContain("policyRiskScore: {summary.policyRiskScore");
  });

  it("wordpress_blog 카드 안내 문구는 공통 컴포넌트(WordPressPublishingPanel)가 targetType별로 표시한다 — 페이지에 중복 문구가 없다", () => {
    expect(pageSource).not.toContain(
      "WordPress 게시용 metadata와 대표 이미지는 이 wordpress_blog 글 기준으로"
    );
  });
});

describe("SEO/게시용 metadata 섹션 (wordpress_blog 카드 내부, 정적 소스 검사)", () => {
  it("SEO/게시용 metadata 섹션과 표시 항목을 포함한다", () => {
    expect(pageSource).toContain("SEO/게시용 metadata");
    expect(pageSource).toContain("blogMetadata.seoTitle");
    expect(pageSource).toContain("blogMetadata.metaDescription");
    expect(pageSource).toContain("blogMetadata.targetKeyword");
    expect(pageSource).toContain("blogMetadata.secondaryKeywords");
    expect(pageSource).toContain("blogMetadata.searchIntent");
    expect(pageSource).toContain("blogMetadata.answerSummary");
    expect(pageSource).toContain("blogMetadata.monetizationScore");
    expect(pageSource).toContain("blogMetadata.policyRiskScore");
    expect(pageSource).toContain("blogMetadata.adSlots");
    expect(pageSource).toContain("blogMetadata.eeatNotes");
    expect(pageSource).toContain("blogMetadata.geoSummary");
  });

  it("article 값으로 대체하지 않는다는 안내 문구를 표시한다", () => {
    expect(pageSource).toContain("article 값으로 대체하지 않습니다");
  });

  it("SEO Metadata 재생성 버튼과 action을 포함한다", () => {
    expect(pageSource).toContain("SEO Metadata 재생성");
    expect(pageSource).toContain("regenerateWordPressBlogMetadataAction");
  });

  it("SEO/게시용 metadata 섹션은 wordpress_blog 조건부 블록 안, naver_blog 블록 밖에 있다", () => {
    const wordpressBlockStart = pageSource.lastIndexOf('post.platform === "wordpress_blog" &&');
    const naverContentSafetyBlockStart = pageSource.indexOf("네이버 블로그 콘텐츠 안전 점검");
    const sectionIndex = pageSource.indexOf("SEO/게시용 metadata");
    expect(sectionIndex).toBeGreaterThan(wordpressBlockStart);
    expect(sectionIndex).toBeLessThan(naverContentSafetyBlockStart);
  });
});

describe("대표 이미지 준비 섹션 (blog 카드 내부, 정적 소스 검사)", () => {
  it("대표 이미지 준비 섹션과 표시 항목을 포함한다", () => {
    expect(pageSource).toContain("Step 5. 대표 이미지");
    expect(pageSource).toContain("현재 대표 이미지 상태");
    expect(pageSource).toContain("WordPress media ID");
    expect(pageSource).toContain("WordPress media URL");
    expect(pageSource).toContain("연결 상태");
    expect(pageSource).toContain("오류 메시지");
  });

  it("WordPress Media ID 입력 폼과 저장 action을 포함한다", () => {
    expect(pageSource).toContain("saveWordPressFeaturedImageMediaForBlogPostAction");
    expect(pageSource).toContain('name="mediaId"');
    expect(pageSource).toContain('name="mediaUrl"');
    expect(pageSource).toContain("대표 이미지 정보 저장");
  });

  it("media ID 입력 전 안내 문구를 표시한다", () => {
    expect(pageSource).toContain("먼저 WordPress Media Library에 있는 이미지의 media ID를");
  });

  it("이미지 URL만으로는 부족하다는 안내 문구를 표시한다", () => {
    expect(pageSource).toContain("이미지 URL만 입력한 경우에는 WordPress media ID가 필요합니다.");
  });

  it("대표 이미지 연결 버튼은 checkFeaturedImageAttachEligibility로 활성화 여부를 결정한다", () => {
    expect(pageSource).toContain("checkFeaturedImageAttachEligibility");
    expect(pageSource).toContain("disabled={!attachEligibility.eligible}");
    expect(pageSource).toContain("attachEligibility.reasons");
  });

  it("naver_blog 카드에는 대표 이미지 준비 섹션이 없다 (wordpress_blog 조건부 블록 안에만 존재)", () => {
    const wordpressBlockStart = pageSource.lastIndexOf('post.platform === "wordpress_blog" &&');
    const naverContentSafetyBlockStart = pageSource.indexOf("네이버 블로그 콘텐츠 안전 점검");
    const featuredPrepIndex = pageSource.indexOf("Step 5. 대표 이미지");
    expect(featuredPrepIndex).toBeGreaterThan(wordpressBlockStart);
    expect(featuredPrepIndex).toBeLessThan(naverContentSafetyBlockStart);
  });
});

describe("내 컴퓨터에서 이미지 업로드 (blog 카드 내부, 정적 소스 검사)", () => {
  it("file input과 업로드 action, 안내 문구를 포함한다", () => {
    expect(pageSource).toContain("내 컴퓨터에서 이미지 업로드");
    expect(pageSource).toContain("uploadWordPressFeaturedImageFromBlogPostAction");
    expect(pageSource).toContain("완료되면 media ID가 자동으로 저장되고");
    expect(pageSource).toContain("WordPressFeaturedImageFilePicker");
    expect(filePickerSource).toContain('type="file"');
    expect(filePickerSource).toContain('name="file"');
    expect(filePickerSource).toContain("image/jpeg,image/png,image/webp");
    expect(filePickerSource).toContain("WordPress Media로 업로드");
  });

  it("alt text/caption 입력을 포함하되 추후 지원 예정임을 명시한다", () => {
    expect(filePickerSource).toContain('name="altText"');
    expect(filePickerSource).toContain('name="caption"');
    expect(pageSource).toContain("추후 지원 예정");
  });

  it("업로드 상태(uploadStatus/uploadError)를 표시한다", () => {
    expect(pageSource).toContain("featuredImage.uploadStatus");
    expect(pageSource).toContain("featuredImage.uploadError");
    expect(pageSource).toContain("업로드 상태");
  });

  it("파일 업로드 UI는 wordpress_blog 조건부 블록 안, naver_blog 블록 밖에 있다", () => {
    const wordpressBlockStart = pageSource.lastIndexOf('post.platform === "wordpress_blog" &&');
    const naverContentSafetyBlockStart = pageSource.indexOf("네이버 블로그 콘텐츠 안전 점검");
    const uploadSectionIndex = pageSource.indexOf("내 컴퓨터에서 이미지 업로드");
    const filePickerUsageIndex = pageSource.indexOf("<WordPressFeaturedImageFilePicker");
    expect(uploadSectionIndex).toBeGreaterThan(wordpressBlockStart);
    expect(uploadSectionIndex).toBeLessThan(naverContentSafetyBlockStart);
    expect(filePickerUsageIndex).toBeGreaterThan(wordpressBlockStart);
    expect(filePickerUsageIndex).toBeLessThan(naverContentSafetyBlockStart);
  });

  it("파일 선택기는 \"use client\" 컴포넌트이며 선택 파일명/크기/형식과 disabled 조건을 클라이언트에서 계산한다", () => {
    expect(filePickerSource).toContain('"use client"');
    expect(filePickerSource).toContain("선택된 파일:");
    expect(filePickerSource).toContain("파일 크기:");
    expect(filePickerSource).toContain("파일 형식:");
    expect(filePickerSource).toContain("업로드 전입니다. WordPress Media로 업로드 버튼을 눌러주세요.");
    expect(filePickerSource).toContain("지원하지 않는 파일 형식입니다. JPG, PNG, WebP만 사용할 수 있습니다.");
    expect(filePickerSource).toContain("disabled={!canUpload}");
    expect(filePickerSource).toContain("MAX_FILE_SIZE_BYTES");
  });

  it("naver_blog 카드에는 파일 선택 UI(WordPressFeaturedImageFilePicker)가 표시되지 않는다", () => {
    const naverContentSafetyBlockStart = pageSource.indexOf("네이버 블로그 콘텐츠 안전 점검");
    const detailsSectionStart = pageSource.indexOf("게시 결과 기록 / Metrics 입력");
    const naverBlockSource = pageSource.slice(naverContentSafetyBlockStart, detailsSectionStart);
    expect(naverBlockSource).not.toContain("WordPressFeaturedImageFilePicker");
    expect(naverBlockSource).not.toContain('type="file"');
  });
});

describe("AI 대표 이미지 생성 (blog 카드 내부, 정적 소스 검사)", () => {
  it("AI 대표 이미지 생성 섹션과 상태 표시, action을 포함한다", () => {
    expect(pageSource).toContain("AI 대표 이미지 생성");
    expect(pageSource).toContain("imageGeneration.status");
    expect(pageSource).toContain("imageGeneration.prompt");
    expect(pageSource).toContain("imageGeneration.altText");
    expect(pageSource).toContain("imageGeneration.caption");
    expect(pageSource).toContain("generateWordPressBlogFeaturedImagePromptAction");
    expect(pageSource).toContain("generateWordPressBlogFeaturedImageAction");
    expect(pageSource).toContain("이미지 프롬프트 생성");
  });

  it("prompt가 없으면 AI 이미지 생성 버튼이 disabled된다", () => {
    expect(pageSource).toContain("disabled={!imageGeneration.prompt}");
  });

  it("생성된 이미지를 WordPress Media Library에 자동 업로드하지 않는다는 한계를 안내한다", () => {
    expect(pageSource).toContain("생성된 이미지를 WordPress Media Library에 자동으로");
  });

  it("article featured image 상태(readWordPressBlogImageGenerationState는 post.platformMetadata에서만 읽음)를 사용한다 — article 컬럼 미사용", () => {
    expect(pageSource).toContain("readWordPressBlogImageGenerationState(post.platformMetadata)");
  });

  it("AI 대표 이미지 생성 섹션은 wordpress_blog 조건부 블록 안, naver_blog 블록 밖에 있다", () => {
    const wordpressBlockStart = pageSource.lastIndexOf('post.platform === "wordpress_blog" &&');
    const naverContentSafetyBlockStart = pageSource.indexOf("네이버 블로그 콘텐츠 안전 점검");
    const sectionIndex = pageSource.indexOf("AI 대표 이미지 생성");
    expect(sectionIndex).toBeGreaterThan(wordpressBlockStart);
    expect(sectionIndex).toBeLessThan(naverContentSafetyBlockStart);
  });
});

describe("SEO Plugin Metadata (blog 카드 내부, 정적 소스 검사)", () => {
  it("SEO Plugin Metadata 섹션과 provider 선택, 상태 표시를 포함한다", () => {
    expect(pageSource).toContain("SEO Plugin Metadata");
    expect(pageSource).toContain("WORDPRESS_BLOG_SEO_PLUGIN_PROVIDERS");
    expect(pageSource).toContain('name="seoPluginProvider"');
    expect(pageSource).toContain("SEO Plugin update status");
    expect(pageSource).toContain("last updated at");
    expect(pageSource).toContain("updateWordPressSeoPluginMetadataFromBlogPostAction");
  });

  it("provider/상태를 post.platformMetadata에서만 읽는다 (article fallback 없음)", () => {
    expect(pageSource).toContain("post.platformMetadata.seoPluginProvider");
    expect(pageSource).toContain("post.platformMetadata.seoPluginWrite");
  });

  it("SEO Plugin Metadata 섹션은 wordpress_blog 조건부 블록 안, naver_blog 블록 밖에 있다", () => {
    const wordpressBlockStart = pageSource.lastIndexOf('post.platform === "wordpress_blog" &&');
    const naverContentSafetyBlockStart = pageSource.indexOf("네이버 블로그 콘텐츠 안전 점검");
    const sectionIndex = pageSource.indexOf("SEO Plugin Metadata");
    expect(sectionIndex).toBeGreaterThan(wordpressBlockStart);
    expect(sectionIndex).toBeLessThan(naverContentSafetyBlockStart);
  });
});

describe("대표 이미지 없이 진행 (waive, blog 카드 내부, 정적 소스 검사)", () => {
  it("waive 섹션과 사유 선택, 안내 문구를 포함한다", () => {
    expect(pageSource).toContain("대표 이미지 없이 진행");
    expect(pageSource).toContain("waiveWordPressFeaturedImageForBlogPostAction");
    expect(pageSource).toContain('name="reasonCode"');
    expect(pageSource).toContain("검색 결과 클릭률, SNS 공유 미리보기");
  });

  it("FEATURED_IMAGE_WAIVER_REASONS를 사용해 사유 선택지를 렌더링한다", () => {
    expect(pageSource).toContain("FEATURED_IMAGE_WAIVER_REASONS");
    expect(pageSource).toContain("reason.code");
    expect(pageSource).toContain("reason.label");
  });

  it("사유가 '기타'일 때를 위한 memo 입력을 포함한다", () => {
    expect(pageSource).toContain('name="memo"');
  });

  it("waived 상태이면 상태 문구와 재추가 안내를 표시한다", () => {
    expect(pageSource).toContain("대표 이미지 없음으로 진행");
    expect(pageSource).toContain("자동으로 해제됩니다");
    expect(pageSource).toContain("featuredImage.waived");
    expect(pageSource).toContain("featuredImage.waivedReasonCode");
    expect(pageSource).toContain("featuredImage.waivedMemo");
  });

  it("waived 상태이면 '대표 이미지 없이 진행하도록 선택되었습니다'와 'warning으로 처리됩니다' 문구를 표시한다", () => {
    expect(pageSource).toContain("대표 이미지 없이 진행하도록 선택되었습니다");
    expect(pageSource).toContain("이 상태는 warning으로 처리됩니다");
  });

  it("media ID 입력/업로드 폼은 waived 여부와 무관하게 항상 렌더링된다 (연결 버튼은 media ID를 여전히 요구)", () => {
    // waive UI는 media ID 폼/업로드 폼과 별개 블록이며, 서로를 감추지 않는다.
    const mediaFormIndex = pageSource.indexOf("saveWordPressFeaturedImageMediaForBlogPostAction");
    const waiveFormIndex = pageSource.indexOf("waiveWordPressFeaturedImageForBlogPostAction");
    const attachButtonIndex = pageSource.indexOf("checkFeaturedImageAttachEligibility");
    expect(mediaFormIndex).toBeGreaterThan(-1);
    expect(waiveFormIndex).toBeGreaterThan(-1);
    expect(attachButtonIndex).toBeGreaterThan(-1);
  });

  it("waive UI는 wordpress_blog 조건부 블록 안, naver_blog 블록 밖에 있다", () => {
    const wordpressBlockStart = pageSource.lastIndexOf('post.platform === "wordpress_blog" &&');
    const naverContentSafetyBlockStart = pageSource.indexOf("네이버 블로그 콘텐츠 안전 점검");
    const waiveSectionIndex = pageSource.lastIndexOf("waiveWordPressFeaturedImageForBlogPostAction");
    expect(waiveSectionIndex).toBeGreaterThan(wordpressBlockStart);
    expect(waiveSectionIndex).toBeLessThan(naverContentSafetyBlockStart);
  });
});

describe("WordPress 게시 준비 단계형 workflow UI (blog 카드 내부, 정적 소스 검사)", () => {
  it("단계별 상태 요약과 다음 추천 작업을 표시한다", () => {
    expect(pageSource).toContain("단계별 상태 요약");
    expect(pageSource).toContain("workflowStatus.quality");
    expect(pageSource).toContain("workflowStatus.approval");
    expect(pageSource).toContain("workflowStatus.draft");
    expect(pageSource).toContain("workflowStatus.seo");
    expect(pageSource).toContain("workflowStatus.featuredImage");
    expect(pageSource).toContain("workflowStatus.publishGuard");
    expect(pageSource).toContain("workflowStatus.checklist");
    expect(pageSource).toContain("{nextAction.title}");
    expect(pageSource).toContain("{nextAction.description}");
    expect(pageSource).toContain("getWordPressBlogWorkflowStatusSummary");
    expect(pageSource).toContain("getWordPressBlogNextRecommendedAction");
  });

  it("Step 1~7이 순서대로 표시된다", () => {
    const step1 = pageSource.indexOf("Step 1. 품질검사");
    const step2 = pageSource.indexOf("Step 2. 승인");
    const step3 = pageSource.indexOf("Step 3. WordPress Draft");
    const step4 = pageSource.indexOf("Step 4. SEO Metadata");
    const step5 = pageSource.indexOf("Step 5. 대표 이미지");
    const step6 = pageSource.indexOf("Step 6. 게시 가능 상태 확인");
    const step7 = pageSource.indexOf("Step 7. 게시 체크리스트 / Handoff");
    for (const idx of [step1, step2, step3, step4, step5, step6, step7]) {
      expect(idx).toBeGreaterThan(-1);
    }
    expect(step1).toBeLessThan(step2);
    expect(step2).toBeLessThan(step3);
    expect(step3).toBeLessThan(step4);
    expect(step4).toBeLessThan(step5);
    expect(step5).toBeLessThan(step6);
    expect(step6).toBeLessThan(step7);
  });

  it("WordPress Draft 생성/업데이트 버튼은 Step 3 영역 안에 있다", () => {
    const step3 = pageSource.indexOf("Step 3. WordPress Draft");
    const step4 = pageSource.indexOf("Step 4. SEO Metadata");
    const draftCreateIdx = pageSource.lastIndexOf("createWordPressDraftFromBlogPostAction");
    const draftUpdateIdx = pageSource.lastIndexOf("updateWordPressDraftFromBlogPostAction");
    expect(draftCreateIdx).toBeGreaterThan(step3);
    expect(draftCreateIdx).toBeLessThan(step4);
    expect(draftUpdateIdx).toBeGreaterThan(step3);
    expect(draftUpdateIdx).toBeLessThan(step4);
  });

  it("SEO Metadata 업데이트 버튼은 Step 4와 Step 5 사이(Step 4 영역)에 있다", () => {
    const step4 = pageSource.indexOf("Step 4. SEO Metadata");
    const step5 = pageSource.indexOf("Step 5. 대표 이미지");
    const seoUpdateIdx = pageSource.lastIndexOf("updateWordPressSeoMetadataFromBlogPostAction");
    expect(seoUpdateIdx).toBeGreaterThan(step4);
    expect(seoUpdateIdx).toBeLessThan(step5);
  });

  it("대표 이미지 관련 버튼(Media ID 저장/업로드/AI 생성/waive/연결)은 Step 5와 Step 6 사이에 있다", () => {
    const step5 = pageSource.indexOf("Step 5. 대표 이미지");
    const step6 = pageSource.indexOf("Step 6. 게시 가능 상태 확인");
    for (const actionName of [
      "saveWordPressFeaturedImageMediaForBlogPostAction",
      "uploadWordPressFeaturedImageFromBlogPostAction",
      "generateWordPressBlogFeaturedImagePromptAction",
      "waiveWordPressFeaturedImageForBlogPostAction",
      "attachWordPressFeaturedImageFromBlogPostAction",
    ]) {
      const idx = pageSource.lastIndexOf(actionName);
      expect(idx).toBeGreaterThan(step5);
      expect(idx).toBeLessThan(step6);
    }
  });

  it("게시 가능 상태 확인 버튼은 Step 6 영역 안에 있다", () => {
    const step6 = pageSource.indexOf("Step 6. 게시 가능 상태 확인");
    const step7 = pageSource.indexOf("Step 7. 게시 체크리스트 / Handoff");
    const guardIdx = pageSource.lastIndexOf("runPlatformPublishingGuardAction");
    expect(guardIdx).toBeGreaterThan(step6);
    expect(guardIdx).toBeLessThan(step7);
    expect(pageSource).toContain("게시 가능 상태 확인");
  });

  it("게시 전 미리보기 생성 / 수동 게시 완료 표시 버튼은 Step 7 영역 안에 있다", () => {
    const step7 = pageSource.indexOf("Step 7. 게시 체크리스트 / Handoff");
    const dryRunIdx = pageSource.lastIndexOf("createPlatformPublishDryRunAction");
    const handoffIdx = pageSource.lastIndexOf("completePlatformExportHandoffAction");
    expect(dryRunIdx).toBeGreaterThan(step7);
    expect(handoffIdx).toBeGreaterThan(step7);
    expect(pageSource).toContain("게시 전 미리보기 생성");
    expect(pageSource).toContain("수동 게시 완료 표시");
  });

  it("WordPress 게시 준비 일괄 실행은 '게시 준비 자동 실행'으로 표시되고, Step 목록보다 앞(상단)에 있다", () => {
    expect(pageSource).toContain("게시 준비 자동 실행");
    const batchButtonIdx = pageSource.indexOf("게시 준비 자동 실행");
    const step1Idx = pageSource.indexOf("Step 1. 품질검사");
    expect(batchButtonIdx).toBeLessThan(step1Idx);
  });

  it("WordPress Draft Export는 wordpress_blog 카드에서 '수동 게시용 Draft 내보내기'로 표시된다 (naver_blog는 변경 없음)", () => {
    expect(pageSource).toContain('"수동 게시용 Draft 내보내기" : "Naver Blog Export"');
  });

  it("품질검사/승인/게시 체크리스트 준비 버튼(폼)은 wordpress_blog 카드 안에서 중복 배치되지 않는다 (Step 1/2/7은 상단 공통 버튼을 참조만 한다)", () => {
    const qualityGateFormCount = (pageSource.match(/action=\{runSocialPostQualityGateAction\}/g) ?? []).length;
    const approvalRequestFormCount = (pageSource.match(/action=\{requestSocialPostApprovalAction\}/g) ?? []).length;
    const approveFormCount = (pageSource.match(/action=\{approveSocialPostAction\}/g) ?? []).length;
    const checklistFormCount = (pageSource.match(/action=\{prepareManualPostingRecordAction\}/g) ?? []).length;
    expect(qualityGateFormCount).toBe(1);
    expect(approvalRequestFormCount).toBe(1);
    expect(approveFormCount).toBe(1);
    expect(checklistFormCount).toBe(1);
  });

  it("SEO Metadata 업데이트 버튼은 SEO metadata가 누락되면 disabled되고 이유를 표시한다", () => {
    expect(pageSource).toContain('disabled={!readiness.ready || workflowStatus.seo === "누락"}');
    expect(pageSource).toContain("SEO metadata가 없습니다. metadata 재생성이 필요합니다.");
  });

  it("Draft 생성이 막히면 승인 필요 또는 게시 준비 확인 안내를 보여준다", () => {
    expect(pageSource).toContain("승인 후 Draft를 생성할 수 있습니다.");
  });

  it("단계형 workflow UI는 wordpress_blog 조건부 블록 안, naver_blog 블록 밖에 있다", () => {
    const wordpressBlockStart = pageSource.lastIndexOf('post.platform === "wordpress_blog" &&');
    const naverContentSafetyBlockStart = pageSource.indexOf("네이버 블로그 콘텐츠 안전 점검");
    const summaryIdx = pageSource.indexOf("단계별 상태 요약");
    expect(summaryIdx).toBeGreaterThan(wordpressBlockStart);
    expect(summaryIdx).toBeLessThan(naverContentSafetyBlockStart);
  });

  it("Step 7에 전체 체크리스트(상세 보기)를 표시하고, 지금 상태 기준으로 다시 계산한 status를 사용한다", () => {
    expect(pageSource).toContain("전체 체크리스트 보기");
    expect(pageSource).toContain("checklistDisplay.map");
    expect(pageSource).toContain("computeManualPostingChecklistItemStatus");
    expect(pageSource).toContain("MANUAL_POSTING_CHECKLIST_ITEM_STATUS_LABELS[item.status]");
  });

  it("체크리스트 항목 목록은 checklistDisplay가 비어있지 않을 때만 렌더링된다", () => {
    expect(pageSource).toContain("checklistDisplay.length > 0 && (");
  });

  it("전체 체크리스트 보기는 Step 7 블록 안에 위치한다", () => {
    const step7Idx = pageSource.indexOf("Step 7. 게시 체크리스트 / Handoff");
    const checklistDetailIdx = pageSource.indexOf("전체 체크리스트 보기");
    const panelCloseIdx = pageSource.indexOf("</WordPressPublishingPanel>");
    expect(checklistDetailIdx).toBeGreaterThan(step7Idx);
    expect(checklistDetailIdx).toBeLessThan(panelCloseIdx);
  });

  it("상단에 완료/확인 필요/대기중/실패 개수를 요약해서 표시한다", () => {
    expect(pageSource).toContain("완료 {checklistSummary.completed}개");
    expect(pageSource).toContain("확인 필요 {checklistSummary.needsReview}개");
    expect(pageSource).toContain("대기중");
    expect(pageSource).toContain("{checklistSummary.pending}개");
    expect(pageSource).toContain("실패 {checklistSummary.failed}개");
  });

  it("handoff가 completed인데 확인 필요/대기중 항목이 남아 있으면 모순 안내 문구를 표시한다(getChecklistHandoffMismatchNotice)", () => {
    expect(pageSource).toContain("getChecklistHandoffMismatchNotice(post.handoffStatus, checklistSummary)");
    expect(pageSource).toContain("checklistMismatchNotice && (");
  });

  it("체크리스트 요약/모순 안내 로직은 wordpress_blog 조건부 블록 안, naver_blog 블록 밖에 있다", () => {
    const wordpressBlockStart = pageSource.lastIndexOf('post.platform === "wordpress_blog" &&');
    const naverContentSafetyBlockStart = pageSource.indexOf("네이버 블로그 콘텐츠 안전 점검");
    const checklistSummaryIdx = pageSource.indexOf("const checklistSummary = summarizeManualPostingChecklistStatus");
    expect(checklistSummaryIdx).toBeGreaterThan(wordpressBlockStart);
    expect(checklistSummaryIdx).toBeLessThan(naverContentSafetyBlockStart);
  });

  it("workflowInput에 featuredImageMediaIdPresent를 전달해 다음 추천 작업이 업로드/연결을 구분하게 한다", () => {
    expect(pageSource).toContain("featuredImageMediaIdPresent: Boolean(featuredImage.wordpressMediaId)");
  });

  it("업로드/게시 준비 관련 action은 returnTo(하이라이트가 포함된 selfReturnTo)를 유지해 같은 카드로 돌아온다", () => {
    expect(pageSource).toContain(
      'const selfReturnToFor = (postId: string) => buildArticleBlogUrl(id, { socialPostId: postId, highlight: postId });'
    );
    const uploadFormIdx = pageSource.lastIndexOf("uploadWordPressFeaturedImageFromBlogPostAction");
    const uploadFormBlock = pageSource.slice(uploadFormIdx, uploadFormIdx + 700);
    expect(uploadFormBlock).toContain("returnTo");
    expect(uploadFormBlock).toContain("selfReturnTo");
  });

  it("대표 이미지 연결 버튼은 media ID가 없으면 비활성화되고, 있으면 활성화 조건을 만족한다(checkFeaturedImageAttachEligibility)", () => {
    expect(pageSource).toContain("disabled={!attachEligibility.eligible}");
    expect(pageSource).toContain("checkFeaturedImageAttachEligibility");
  });
});

describe("확인 필요 항목 수동 검토 UI (Step 7, blog 카드 내부, 정적 소스 검사)", () => {
  it("확인 필요 항목은 오류가 아니라는 안내 문구를 표시한다", () => {
    expect(pageSource).toContain("확인 필요 항목은 오류가 아닙니다");
    expect(pageSource).toContain("시스템이 자동으로 판단하기 어려운");
  });

  it("확인 필요 항목마다 description/userAction 안내를 표시한다(MANUAL_POSTING_CHECKLIST_ITEM_GUIDES)", () => {
    expect(pageSource).toContain("MANUAL_POSTING_CHECKLIST_ITEM_GUIDES[item.key]");
    expect(pageSource).toContain("{guide.description}");
    expect(pageSource).toContain("해야 할 일: {guide.userAction}");
  });

  it("상태별 한 줄 설명(MANUAL_POSTING_CHECKLIST_ITEM_STATUS_DESCRIPTIONS)을 표시한다", () => {
    expect(pageSource).toContain("MANUAL_POSTING_CHECKLIST_ITEM_STATUS_DESCRIPTIONS[item.status]");
  });

  it("체크리스트 상태 요약 아래에 상황별 안내 문구(getChecklistGuidanceMessage)를 표시한다", () => {
    expect(pageSource).toContain("getChecklistGuidanceMessage(checklistSummary)");
    expect(pageSource).toContain("checklistGuidanceMessage && (");
  });

  it("사람이 직접 확인 가능한 항목에는 확인 완료 표시 버튼(markManualChecklistItemConfirmedAction)이 있다", () => {
    expect(pageSource).toContain("markManualChecklistItemConfirmedAction");
    expect(pageSource).toContain("확인 완료 표시");
    expect(pageSource).toContain('name="checklistItemKey" value={item.key}');
  });

  it("확인 완료 표시 버튼은 CONFIRMABLE_MANUAL_CHECKLIST_ITEM_KEYS에 있는 항목에서만 렌더링된다", () => {
    expect(pageSource).toContain("CONFIRMABLE_MANUAL_CHECKLIST_ITEM_KEYS.has(item.key)");
  });

  it("게시 후 URL 기록 필요 항목에는 URL 입력 필드와 저장 버튼이 있다", () => {
    expect(pageSource).toContain('item.key === "record_url_after_posting"');
    expect(pageSource).toContain('type="url"');
    expect(pageSource).toContain('name="manualPostUrl"');
    expect(pageSource).toContain("게시 URL 저장");
  });

  it("URL 저장은 기존 recordManualPostingResultAction을 재사용한다(새 action 아님, http/https만 허용하는 pattern 포함)", () => {
    const urlFormIdx = pageSource.indexOf('item.key === "record_url_after_posting"');
    const urlFormBlock = pageSource.slice(urlFormIdx, urlFormIdx + 1400);
    expect(urlFormBlock).toContain("action={recordManualPostingResultAction}");
    expect(urlFormBlock).toContain('pattern="https?://.*"');
  });

  it("게시 URL이 있으면 게시 URL 복사 버튼(CopyUrlButton)을 표시한다", () => {
    expect(pageSource).toContain("post.manualPostUrl || post.postUrl");
    expect(pageSource).toContain("<CopyUrlButton");
  });

  it("다음 추천 작업은 확인 필요 항목이 남아 있으면 checklistNeedsReviewCount를 반영한다", () => {
    expect(pageSource).toContain("checklistNeedsReviewCount: checklistSummary.needsReview");
    expect(pageSource).toContain("checklistUrlMissing,");
  });

  it("확인 필요 항목 수동 검토 UI는 wordpress_blog 조건부 블록 안, naver_blog 블록 밖에 있다", () => {
    const wordpressBlockStart = pageSource.lastIndexOf('post.platform === "wordpress_blog" &&');
    const naverContentSafetyBlockStart = pageSource.indexOf("네이버 블로그 콘텐츠 안전 점검");
    const guideBlockIdx = pageSource.indexOf("지금 확인이 필요한 항목");
    expect(guideBlockIdx).toBeGreaterThan(wordpressBlockStart);
    expect(guideBlockIdx).toBeLessThan(naverContentSafetyBlockStart);
  });
});
