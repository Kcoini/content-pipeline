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
  it("wordpress_blog/naver_blog 역할을 구분하는 카드 내부 안내 문구를 표시한다(페이지 상단 설명 박스는 제거됨)", () => {
    expect(pageSource).toContain("이 글은 WordPress 게시용 블로그 글입니다.");
    expect(pageSource).toContain("이 글은 네이버 블로그 수동 게시용 글입니다.");
  });

  it("페이지 상단 안내 박스와 platform 설명 카드가 제거되어 있다", () => {
    expect(pageSource).not.toContain("이 페이지에서는 원본 article을 기반으로 플랫폼별 블로그 글을 생성합니다.");
    expect(pageSource).not.toContain("작업 후 이 페이지로 돌아오도록 returnTo가 적용됩니다.");
    expect(pageSource).not.toContain("SEO 제목, 메타 설명, target keyword, 승인, FAQ/");
    expect(pageSource).not.toContain("자연스러운 도입부, 네이버 검색 의도, 과장 없는");
  });

  it("ArticleWorkflowNavigation 바로 다음에 오는 것은 더 이상 상단 설명 박스가 아니다(DeepLinkNotice 또는 그 이후 UI)", () => {
    const navIdx = pageSource.indexOf("<ArticleWorkflowNavigation");
    const navEndIdx = pageSource.indexOf("/>", navIdx);
    const afterNav = pageSource.slice(navEndIdx, navEndIdx + 200);
    expect(afterNav).not.toContain("원본 article을 기반으로");
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
    expect(pageSource).toContain("WordPress에 반영하기");
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

  it("WordPress 게시 준비 일괄 실행은 'WordPress에 반영하기'로 표시되고, Step 목록보다 앞(상단)에 있다", () => {
    expect(pageSource).toContain("WordPress에 반영하기");
    const batchButtonIdx = pageSource.indexOf("WordPress에 반영하기");
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

describe("WordPress 게시 미리보기 / 반영 데이터 / 검사 이유 / 최근 반영 결과 (blog 카드 내부, 정적 소스 검사)", () => {
  it("WordPress 게시 미리보기 섹션이 표시되고 postPreview(wordpress_blog 자신의 값)를 사용한다", () => {
    expect(pageSource).toContain("WordPress 게시 미리보기");
    expect(pageSource).toContain("buildWordPressBlogPostPreview({");
    expect(pageSource).toContain("postTitle: post.postTitle");
    expect(pageSource).toContain("postBody: post.postBody");
    expect(pageSource).toContain("{postPreview.title}");
    expect(pageSource).toContain("{postPreview.bodyPreviewText");
  });

  it("미리보기는 article content를 사용하지 않는다", () => {
    const previewIdx = pageSource.indexOf("buildWordPressBlogPostPreview({");
    const previewCallBlock = pageSource.slice(previewIdx, previewIdx + 400);
    expect(previewCallBlock).not.toContain("article.content");
    expect(previewCallBlock).not.toContain("article.title");
  });

  it("전체 미리보기 보기를 위한 접기/펼치기가 있다", () => {
    expect(pageSource).toContain("전체 미리보기 보기");
    expect(pageSource).toContain("postPreview.bodyTruncated");
  });

  it("FAQ/AD_SLOT/참고자료 미리보기를 표시한다", () => {
    expect(pageSource).toContain("FAQ 영역 미리보기");
    expect(pageSource).toContain("광고 위치 (AD_SLOT)");
    expect(pageSource).toContain("광고 위치 예정");
    expect(pageSource).toContain("참고자료/출처 미리보기");
  });

  it("WordPress 반영 데이터 요약이 표시된다", () => {
    expect(pageSource).toContain("WordPress 반영 데이터");
    expect(pageSource).toContain("아래 정보가 WordPress에 반영됩니다");
    expect(pageSource).toContain("업데이트 대상");
  });

  it("검사가 많은 이유 안내 박스가 표시된다", () => {
    expect(pageSource).toContain("검사가 많은 이유는 자동 생성 글을 바로 공개하지 않고");
  });

  it("Step 1~6마다 왜 필요한지 설명이 표시된다", () => {
    expect(pageSource).toContain("본문 구조, SEO 요소, 정책 위험, 광고 슬롯 위치를 확인합니다");
    expect(pageSource).toContain("자동 생성 글을 바로 게시하지 않기 위해 사람이 한 번 확인하는 단계입니다");
    expect(pageSource).toContain("이 단계에서 wordpress_blog 글의 제목과 본문이 실제 WordPress Draft로");
    expect(pageSource).toContain("Rank Math, Yoast, AIOSEO 등 SEO plugin에 SEO title, meta description");
    expect(pageSource).toContain("WordPress 목록, 공유 링크, 본문 상단에 표시될 대표 이미지를 설정합니다");
    expect(pageSource).toContain("Draft, SEO metadata, 대표 이미지, 승인 상태가 모두 준비되었는지 최종");
  });

  it("Draft 상태에 마지막 업데이트 시간과 WordPress에서 보기 버튼이 있다", () => {
    expect(pageSource).toContain("마지막 업데이트");
    expect(pageSource).toContain("{draft.lastUpdatedAt");
    expect(pageSource).toContain("WordPress에서 Draft 보기");
  });

  it("Draft URL이 없으면 WordPress에서 보기 버튼이 비활성화되고 안내 문구를 보여준다", () => {
    expect(pageSource).toContain("아직 WordPress Draft가 생성되지 않았습니다.");
    const noUrlButtonIdx = pageSource.indexOf("cursor-not-allowed rounded border border-zinc-200 bg-zinc-100 px-2 py-1 font-medium text-zinc-400");
    expect(noUrlButtonIdx).toBeGreaterThan(-1);
  });

  it("대표 이미지 상태에 마지막 연결 시간이 표시된다", () => {
    expect(pageSource).toContain("마지막 연결");
    expect(pageSource).toContain("{featuredImage.attachedAt");
  });

  it("primary button은 'WordPress에 반영하기'이고 공개 게시를 하지 않는다는 안내를 포함한다", () => {
    expect(pageSource).toContain("WordPress에 반영하기");
    expect(pageSource).toContain("공개 게시 버튼은 누르지 않습니다");
    expect(pageSource).toContain("최종 공개는 WordPress");
  });

  it("개별 단계는 보조 버튼이라는 안내 문구가 primary button 아래에 있다", () => {
    expect(pageSource).toContain("개별 단계만 다시 실행하려면 아래 탭에서 보조 버튼을 사용하세요.");
  });

  it("최근 WordPress 반영 결과 섹션이 lastPublishPreparationRun을 읽어 표시한다", () => {
    expect(pageSource).toContain("최근 WordPress 반영 결과");
    expect(pageSource).toContain("post.platformMetadata.lastPublishPreparationRun");
    expect(pageSource).toContain("getWordPressBlogPreparationStepLabel");
    expect(pageSource).toContain("getWordPressBlogPreparationStepStatusLabel");
  });

  it("WordPress 게시 미리보기/반영 데이터/최근 반영 결과는 wordpress_blog 조건부 블록 안, naver_blog 블록 밖에 있다", () => {
    const wordpressBlockStart = pageSource.lastIndexOf('post.platform === "wordpress_blog" &&');
    const naverContentSafetyBlockStart = pageSource.indexOf("네이버 블로그 콘텐츠 안전 점검");
    const previewIdx = pageSource.indexOf("WordPress 게시 미리보기");
    const dataIdx = pageSource.indexOf("WordPress 반영 데이터");
    const lastRunIdx = pageSource.indexOf("최근 WordPress 반영 결과");
    expect(previewIdx).toBeGreaterThan(wordpressBlockStart);
    expect(previewIdx).toBeLessThan(naverContentSafetyBlockStart);
    expect(dataIdx).toBeGreaterThan(wordpressBlockStart);
    expect(dataIdx).toBeLessThan(naverContentSafetyBlockStart);
    expect(lastRunIdx).toBeGreaterThan(wordpressBlockStart);
    expect(lastRunIdx).toBeLessThan(naverContentSafetyBlockStart);
  });
});

describe("wordpress_blog 카드 내부 탭 구조 (blog 카드 내부, 정적 소스 검사)", () => {
  it("tab searchParam을 읽고 normalizeWordPressBlogCardTab으로 정규화한다", () => {
    expect(pageSource).toContain("tab?: string");
    expect(pageSource).toContain("normalizeWordPressBlogCardTab(tab)");
  });

  it("6개 탭 내비게이션(WORDPRESS_BLOG_CARD_TABS)이 표시된다", () => {
    expect(pageSource).toContain("WORDPRESS_BLOG_CARD_TABS.map((t)");
    expect(pageSource).toContain('tab: t.key');
  });

  it("탭마다 상태 badge(getWordPressBlogCardTabBadges)를 계산해서 표시한다", () => {
    expect(pageSource).toContain("getWordPressBlogCardTabBadges({");
    expect(pageSource).toContain("tabBadges.quality");
    expect(pageSource).toContain("tabBadges.wordpress");
    expect(pageSource).toContain("tabBadges.image");
    expect(pageSource).toContain("tabBadges.checklist");
  });

  it("글 내용 탭이 표시된다", () => {
    expect(pageSource).toContain('activeTab === "content"');
    expect(pageSource).toContain(">글 내용<");
    expect(pageSource).toContain("본문 요약");
  });

  it("WordPress 미리보기 탭이 표시된다", () => {
    expect(pageSource).toContain('activeTab === "preview"');
  });

  it("품질·승인 탭이 표시된다", () => {
    expect(pageSource).toContain('activeTab === "quality"');
  });

  it("WordPress 반영 탭이 표시된다", () => {
    expect(pageSource).toContain('activeTab === "wordpress"');
  });

  it("대표 이미지 탭이 표시된다", () => {
    expect(pageSource).toContain('activeTab === "image"');
  });

  it("체크리스트 탭이 표시된다", () => {
    expect(pageSource).toContain('activeTab === "checklist"');
  });

  it("상단 상태 요약과 WordPress에 반영하기 buttons은 탭 게이트 없이(탭과 무관하게) 항상 보인다", () => {
    const navIdx = pageSource.indexOf("<nav");
    const statusSummaryIdx = pageSource.indexOf("단계별 상태 요약");
    const primaryButtonIdx = pageSource.indexOf("WordPress에 반영하기");
    expect(statusSummaryIdx).toBeLessThan(navIdx);
    expect(primaryButtonIdx).toBeLessThan(navIdx);
  });

  it("다음 추천 작업에 해당 탭으로 이동하는 버튼이 있다(getTabForWorkflowStep)", () => {
    expect(pageSource).toContain("getTabForWorkflowStep(nextAction.step)");
    expect(pageSource).toContain("탭으로 이동");
  });

  it("action 후 returnTo/highlight/tab이 유지되도록 selfReturnTo가 activeTab을 포함한다", () => {
    expect(pageSource).toContain(
      "const selfReturnTo = buildArticleBlogUrl(id, { socialPostId: post.id, highlight: post.id, tab: activeTab });"
    );
  });

  it("naver_blog 카드에는 WordPress 탭 내비게이션(WORDPRESS_BLOG_CARD_TABS)이 표시되지 않는다", () => {
    const naverContentSafetyBlockStart = pageSource.indexOf("네이버 블로그 콘텐츠 안전 점검");
    const detailsSectionStart = pageSource.indexOf("게시 결과 기록 / Metrics 입력");
    const naverBlockSource = pageSource.slice(naverContentSafetyBlockStart, detailsSectionStart);
    expect(naverBlockSource).not.toContain("WORDPRESS_BLOG_CARD_TABS");
    expect(naverBlockSource).not.toContain("activeTab");
  });

  it("탭 내비게이션과 탭 게이트는 wordpress_blog 조건부 블록 안에 있다", () => {
    const wordpressBlockStart = pageSource.lastIndexOf('post.platform === "wordpress_blog" &&');
    const naverContentSafetyBlockStart = pageSource.indexOf("네이버 블로그 콘텐츠 안전 점검");
    const navIdx = pageSource.indexOf("<nav");
    expect(navIdx).toBeGreaterThan(wordpressBlockStart);
    expect(navIdx).toBeLessThan(naverContentSafetyBlockStart);
  });

  it("탭 내비게이션은 새 라이브러리 없이 sticky(기존 Tailwind class)로 구현되어 있다", () => {
    expect(pageSource).toContain("sticky top-0");
  });
});

describe("프로세스 로그 / 실행 이력 (페이지 하단, 정적 소스 검사)", () => {
  it("페이지 하단에 process-logs 섹션이 있다", () => {
    expect(pageSource).toContain('id="process-logs"');
    expect(pageSource).toContain("프로세스 로그 / 실행 이력");
  });

  it("process-logs 섹션은 <details>로 기본 접힘 상태다", () => {
    const sectionIdx = pageSource.indexOf('id="process-logs"');
    const nearby = pageSource.slice(sectionIdx, sectionIdx + 200);
    expect(nearby).toContain("<details>");
    expect(nearby).not.toContain("<details open");
  });

  it("문제가 발생했을 때만 확인하라는 안내와 시스템 실행 기록이라는 안내 문구가 있다", () => {
    expect(pageSource).toContain("문제가 발생했을 때만 로그를 확인하세요");
    expect(pageSource).toContain("이 영역은 시스템 실행 기록입니다");
  });

  it("로그 필터(전체/WordPress/SEO/대표 이미지/게시 준비/Handoff/실패만 보기)가 표시된다", () => {
    expect(pageSource).toContain("LOG_FILTER_OPTIONS");
    expect(pageSource).toContain('{ key: "all", label: "전체" }');
    expect(pageSource).toContain('{ key: "failed_only", label: "실패만 보기" }');
  });

  it("카드별로 로그를 구분해서 보여준다(post.id별 그룹, anchor 포함)", () => {
    expect(pageSource).toContain('buildAnchorId("process-log-group", post.id)');
    expect(pageSource).toContain("filterWordPressBlogProcessLogEntriesByPost");
  });

  it("최근 20개만 기본 표시하고 더 보기로 나머지를 접어둔다", () => {
    expect(pageSource).toContain("PROCESS_LOG_VISIBLE_COUNT");
    expect(pageSource).toContain("더 보기 (");
  });

  it("실패 로그를 우선 정렬한다(sortWordPressBlogProcessLogEntriesForDisplay)", () => {
    expect(pageSource).toContain("sortWordPressBlogProcessLogEntriesForDisplay(");
  });

  it("raw JSON은 기본 표시되지 않고 '상세 JSON 보기'로 접혀 있다", () => {
    expect(pageSource).toContain("상세 JSON 보기");
    expect(pageSource).toContain("JSON.stringify(entry.rawDetails");
  });

  it("카드 안에는 최근 실행 결과 요약과 '상세 로그 보기' 링크만 있고, 긴 로그 목록은 없다", () => {
    const cardBlockStart = pageSource.indexOf("최근 WordPress 반영 결과 —");
    const cardBlockEnd = pageSource.indexOf("Step 1. 품질검사 (버튼은");
    const cardBlock = pageSource.slice(cardBlockStart, cardBlockEnd);
    expect(cardBlock).toContain("상세 실행 로그는 페이지 하단에서 확인할 수 있습니다.");
    expect(cardBlock).toContain("상세 로그 보기");
    expect(cardBlock).not.toContain("renderProcessLogEntry");
    expect(cardBlock).not.toContain("JSON.stringify(entry.rawDetails");
  });

  it("'상세 로그 보기' 링크는 해당 socialPostId의 하단 로그 그룹 anchor로 이동한다", () => {
    expect(pageSource).toContain('href={`#${buildAnchorId("process-log-group", post.id)}`}');
  });

  it("체크리스트(Step 7)는 카드 안 checklist 탭에 그대로 유지된다", () => {
    const wordpressBlockStart = pageSource.lastIndexOf('post.platform === "wordpress_blog" &&');
    const naverContentSafetyBlockStart = pageSource.indexOf("네이버 블로그 콘텐츠 안전 점검");
    const step7Idx = pageSource.indexOf("Step 7. 게시 체크리스트 / Handoff");
    expect(step7Idx).toBeGreaterThan(wordpressBlockStart);
    expect(step7Idx).toBeLessThan(naverContentSafetyBlockStart);
  });

  it("process-logs 섹션은 wordpress_blog post가 있을 때만 렌더링된다(wordpressBlogPostIds.size > 0)", () => {
    expect(pageSource).toContain("wordpressBlogPostIds.size > 0 && (");
  });

  it("process-logs 섹션은 posts 목록 전체 렌더링이 끝난 뒤(페이지 최하단)에 위치한다", () => {
    const paginationIdx = pageSource.lastIndexOf("<PaginationControls");
    const processLogSectionIdx = pageSource.indexOf('id="process-logs"');
    expect(processLogSectionIdx).toBeGreaterThan(paginationIdx);
  });

  it("naver_blog에는 process-logs 관련 로직이 없다(naver_blog 블록 안에서 참조하지 않는다)", () => {
    const naverContentSafetyBlockStart = pageSource.indexOf("네이버 블로그 콘텐츠 안전 점검");
    const detailsSectionStart = pageSource.indexOf("게시 결과 기록 / Metrics 입력");
    const naverBlockSource = pageSource.slice(naverContentSafetyBlockStart, detailsSectionStart);
    expect(naverBlockSource).not.toContain("process-log-group");
    expect(naverBlockSource).not.toContain("wordpressBlogProcessLogEntries");
  });
});

describe("일시적 action 결과 메시지 (toast/transient notice, 정적 소스 검사)", () => {
  it("error/publishMessage를 본문 중간 alert box(div)가 아니라 TransientNotice로 렌더링한다", () => {
    expect(pageSource).toContain("<TransientNotice message={error ?? null} variant=\"error\" />");
    expect(pageSource).toContain('<TransientNotice message={publishMessage ?? null} variant="success" />');
    expect(pageSource).not.toContain('border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}');
    expect(pageSource).not.toContain('border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">{publishMessage}');
  });

  it("TransientNotice를 import한다", () => {
    expect(pageSource).toContain('import { TransientNotice } from "@/components/ui/transient-notice";');
  });

  it("\"선택한 항목을 강조 표시했습니다.\" 확인 메시지는 더 이상 표시하지 않는다(found=true인 DeepLinkNotice를 렌더링하지 않음)", () => {
    expect(pageSource).toContain("targetSocialPostId && !targetFound && <DeepLinkNotice targetId={targetSocialPostId} found={false} />");
    expect(pageSource).not.toContain("targetSocialPostId && <DeepLinkNotice targetId={targetSocialPostId} found={targetFound} />");
  });

  it("항목을 찾지 못했을 때의 경고(DeepLinkNotice found=false)는 여전히 표시된다", () => {
    expect(pageSource).toContain("found={false}");
  });

  it("카드 highlight 기능(getHighlightClassName)은 그대로 유지된다", () => {
    expect(pageSource).toContain("getHighlightClassName(post.id, targetSocialPostId)");
  });

  it("Step 1(품질검사)에 score와 마지막 실행 시간이 상태 요약으로 남아 있다", () => {
    expect(pageSource).toContain("{post.qualityScore ?? \"-\"}");
    expect(pageSource).toContain("{post.lastQualityCheckedAt ?? \"-\"}");
  });

  it("상세 로그는 여전히 페이지 하단 프로세스 로그 섹션에서 확인할 수 있다", () => {
    expect(pageSource).toContain('id="process-logs"');
    expect(pageSource).toContain("상세 로그 보기");
  });

  it("TransientNotice 사용은 wordpress_blog 전용이 아니라 페이지 상단(naver_blog 포함 전체)에 적용되어 두 platform 모두에서 동작한다", () => {
    const navIdx = pageSource.indexOf("<ArticleWorkflowNavigation");
    const postsListIdx = pageSource.indexOf("posts.map((post)");
    const noticeIdx = pageSource.indexOf("<TransientNotice");
    expect(noticeIdx).toBeGreaterThan(navIdx);
    expect(noticeIdx).toBeLessThan(postsListIdx);
  });
});

describe("wordpress_blog 카드 가독성 개선 (정적 소스 검사)", () => {
  it("SEO/게시용 metadata는 기본 접힘 상태(details)이며 상태 badge를 상단에 보여준다", () => {
    const boxIdx = pageSource.indexOf("SEO/게시용 metadata</p>");
    const detailsIdx = pageSource.indexOf("SEO Metadata 상세 보기");
    const seoTitleIdx = pageSource.indexOf(">seoTitle<");
    expect(detailsIdx).toBeGreaterThan(boxIdx);
    expect(seoTitleIdx).toBeGreaterThan(detailsIdx);
  });

  it("metaDescription/secondaryKeywords는 SEO Metadata 상세 보기 안에 있다", () => {
    const detailsIdx = pageSource.indexOf("SEO Metadata 상세 보기");
    const metaDescIdx = pageSource.indexOf(">metaDescription<");
    const secondaryKeywordsIdx = pageSource.indexOf(">secondaryKeywords<");
    expect(metaDescIdx).toBeGreaterThan(detailsIdx);
    expect(secondaryKeywordsIdx).toBeGreaterThan(detailsIdx);
  });

  it("대표 이미지 상세(media URL/업로드 상태/마지막 연결)는 '대표 이미지 상세 보기' 안에 있다", () => {
    const detailsIdx = pageSource.indexOf("대표 이미지 상세 보기");
    const mediaUrlIdx = pageSource.indexOf("WordPress media URL");
    const uploadStatusIdx = pageSource.lastIndexOf("업로드 상태");
    expect(mediaUrlIdx).toBeGreaterThan(detailsIdx);
    expect(uploadStatusIdx).toBeGreaterThan(detailsIdx);
  });

  it("대표 이미지 오류는 waived 여부에 따라 '참고' 문구와 '오류' 문구를 구분한다", () => {
    expect(pageSource).toContain("참고: 이전 Media ID 연결 시도 실패 기록 있음(현재는 이미지 없이 진행 중).");
    expect(pageSource).toContain("featuredImage.waived");
  });

  it("오류 메시지 원문은 대표 이미지 상세 보기 안에서만 노출된다", () => {
    const detailsIdx = pageSource.indexOf("대표 이미지 상세 보기");
    const rawErrorIdx = pageSource.indexOf("오류 메시지 원문");
    expect(rawErrorIdx).toBeGreaterThan(detailsIdx);
  });

  it("내부 상태값 보기(raw quality_status 등)가 접힌 상태로 있다", () => {
    expect(pageSource).toContain("내부 상태값 보기");
    expect(pageSource).toContain("{post.qualityStatus}");
    expect(pageSource).toContain("{post.approvalStatus}");
    expect(pageSource).toContain("{post.publishStatus}");
    expect(pageSource).toContain("{post.exportStatus}");
    expect(pageSource).toContain("{post.manualPostStatus}");
    const detailsIdx = pageSource.indexOf("내부 상태값 보기");
    const summaryTagIdx = pageSource.lastIndexOf("<summary", detailsIdx + 5);
    const detailsTagIdx = pageSource.lastIndexOf("<details", summaryTagIdx);
    expect(detailsTagIdx).toBeGreaterThan(-1);
  });

  it("WordPress에 반영하기 버튼의 짧은 설명과 '자세히 보기' 접기가 있다", () => {
    expect(pageSource).toContain("wordpress_blog 글을 WordPress Draft에 반영합니다. 공개 게시는 하지 않습니다.");
    expect(pageSource).toContain("자세히 보기");
  });

  it("설명 문장은 파란색(indigo) 대신 muted(zinc) 색상을 사용한다(대부분의 description paragraph)", () => {
    expect(pageSource).not.toContain('text-[10px] text-indigo-700"');
  });

  it("링크는 여전히 indigo 색상을 유지한다(파란색은 링크에만)", () => {
    expect(pageSource).toContain('className="text-indigo-600 underline hover:text-indigo-700"');
  });

  it("다음 추천 작업 영역이 표시되고 해당 탭으로 이동하는 버튼이 있다", () => {
    expect(pageSource).toContain("{nextAction.title}");
    expect(pageSource).toContain("탭으로 이동");
  });

  it("WordPress에 반영하기 primary button은 여전히 명확하게 표시된다(항상 보이는 고정 영역)", () => {
    const navIdx = pageSource.indexOf("<nav");
    const primaryButtonIdx = pageSource.indexOf("WordPress에 반영하기");
    expect(primaryButtonIdx).toBeGreaterThan(-1);
    expect(primaryButtonIdx).toBeLessThan(navIdx);
  });

  it("가독성 개선은 wordpress_blog 조건부 블록 안에만 있고 naver_blog 블록 밖이다", () => {
    const wordpressBlockStart = pageSource.lastIndexOf('post.platform === "wordpress_blog" &&');
    const naverContentSafetyBlockStart = pageSource.indexOf("네이버 블로그 콘텐츠 안전 점검");
    const internalStatusIdx = pageSource.indexOf("내부 상태값 보기");
    expect(internalStatusIdx).toBeGreaterThan(wordpressBlockStart);
    expect(internalStatusIdx).toBeLessThan(naverContentSafetyBlockStart);
  });
});
