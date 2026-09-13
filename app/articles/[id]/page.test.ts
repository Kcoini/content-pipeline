import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");

describe("article overview page (정적 소스 검사)", () => {
  it("full export_payload/handoff_payload/post_body를 직접 렌더링하지 않는다", () => {
    expect(pageSource).not.toContain("exportPayload");
    expect(pageSource).not.toContain("handoffPayload");
    expect(pageSource).not.toContain("post.postBody");
    expect(pageSource).not.toContain("post.caption");
  });

  it("social_posts 개별 글의 상세 내용(본문/제목 등)을 직접 렌더링하지 않는다 (하위 페이지로 이동)", () => {
    // Phase 3-21: listSocialPostsByArticle 자체는 "플랫폼별 글 생성" 섹션에서
    // 플랫폼별 기존 생성 여부만 확인하는 용도로 다시 쓰인다 — 개별 글의
    // 제목/본문을 여기서 렌더링하지 않는 한 기존 원칙(하위 페이지로 상세
    // 이동)과 충돌하지 않는다.
    expect(pageSource).not.toContain("Multi-platform Writing");
    expect(pageSource).not.toContain("post.postTitle");
  });

  it("하위 페이지(blog/social/rewrite/performance)로 이동하는 링크를 포함한다", () => {
    expect(pageSource).toContain("/blog`");
    expect(pageSource).toContain("/social`");
    expect(pageSource).toContain("/rewrite`");
    expect(pageSource).toContain("/performance`");
  });

  it("ArticleWorkflowNavigation을 사용한다", () => {
    expect(pageSource).toContain("ArticleWorkflowNavigation");
  });
});

describe("article/blog 역할 분리 (정적 소스 검사)", () => {
  it("원본 article과 WordPress 블로그형 글이 다르다는 안내 문구를 표시한다", () => {
    expect(pageSource).toContain("현재 페이지의 본문은 원본 article입니다");
    expect(pageSource).toContain("wordpress_blog 글을 생성한 뒤 WordPress");
  });

  it("article 직접 WordPress 전송 기능은 접이식 '고급 기능' 섹션으로 표시된다", () => {
    expect(pageSource).toContain("고급 기능: 원본 article WordPress 전송");
    expect(pageSource).toContain("<details>");
    expect(pageSource).toContain("원본 article을 그대로 WordPress Draft로 전송할 때");
    expect(pageSource).toContain("WordPress 게시");
  });

  it("article 직접 WordPress 전송 버튼은 '보조 기능'임을 알 수 있는 이름으로 바뀌었다", () => {
    expect(pageSource).toContain("원본 article Draft 생성");
    expect(pageSource).not.toContain(">WordPress 초안 생성<");
  });

  it("publishToWordPressDraftAction(기존 동작)은 그대로 유지된다", () => {
    expect(pageSource).toContain("publishToWordPressDraftAction");
  });
});

describe("공통 WordPressPublishingPanel 사용 (article targetType, 정적 소스 검사)", () => {
  it("고급 기능 섹션 안에서 targetType=article/isPrimaryWorkflow=false로 공통 패널을 사용한다", () => {
    expect(pageSource).toContain("WordPressPublishingPanel");
    expect(pageSource).toContain('targetType="article"');
    expect(pageSource).toContain("isPrimaryWorkflow={false}");
  });

  it("공통 패널이 고급 기능(<details>) 안, 개별 sub-section들보다 먼저 나온다", () => {
    const detailsIndex = pageSource.indexOf("고급 기능: 원본 article WordPress 전송");
    const panelIndex = pageSource.indexOf("<WordPressPublishingPanel");
    const wpMetadataSectionIndex = pageSource.indexOf("WordPress Metadata</h2>");
    expect(panelIndex).toBeGreaterThan(detailsIndex);
    expect(panelIndex).toBeLessThan(wpMetadataSectionIndex);
  });

  it("article 자체 상태(publishQualityGateStatus/wpMetadataStatus/featuredImage 등)를 패널 props로 전달한다", () => {
    expect(pageSource).toContain("qualityStatus: article.publishQualityGateStatus");
    expect(pageSource).toContain("approvalStatus: article.publicPublishApprovalStatus");
    expect(pageSource).toContain("seoTitle: article.seoTitle");
    expect(pageSource).toContain("featuredImageMediaId: article.featuredImageWordpressMediaId");
    expect(pageSource).toContain("featuredImageWaived: articleFeaturedImageWaiver.waived");
  });

  it("wordpress_blog 데이터(post/social_post)를 article 패널에 사용하지 않는다", () => {
    const start = pageSource.indexOf("<WordPressPublishingPanel");
    const end = pageSource.indexOf("/>", start);
    const block = pageSource.slice(start, end);
    expect(block).not.toMatch(/post\.postTitle|post\.postBody|socialPostId/);
  });

  it("대표 이미지 URL/연결 상태/오류 메시지/생략 사유도 패널 props로 전달한다", () => {
    expect(pageSource).toContain("featuredImageUrl: article.featuredImageWordpressUrl");
    expect(pageSource).toContain("featuredImageAttachStatus: article.wordpressFeaturedMediaAttachStatus");
    expect(pageSource).toContain("featuredImageWaiverReason: articleFeaturedImageWaiver.reasonCode");
  });

  it("article 버튼명이 '원본 article ...' 형식으로 통일되어 있다 (spec 명명 규칙)", () => {
    expect(pageSource).toContain("원본 article Draft 생성");
    expect(pageSource).toContain("원본 article SEO Metadata 업데이트");
    expect(pageSource).toContain("원본 article 대표 이미지 연결");
    expect(pageSource).toContain("대표 이미지 없이 원본 article 전송");
  });
});

describe("고급 기능: 대표 이미지 없이 원본 article 전송 (waive, 정적 소스 검사)", () => {
  it("waive 섹션과 action, 사유 선택을 포함한다", () => {
    expect(pageSource).toContain("대표 이미지 없이 진행");
    expect(pageSource).toContain("waiveArticleWordPressFeaturedImageAction");
    expect(pageSource).toContain('name="reasonCode"');
    expect(pageSource).toContain("ARTICLE_FEATURED_IMAGE_WAIVER_REASONS");
  });

  it("wordpress_blog 설정과는 다른 것임을 안내하는 문구를 표시한다", () => {
    expect(pageSource).toContain("이 설정은 원본 article을 그대로 WordPress Draft로 전송할 때만 적용됩니다");
    expect(pageSource).toContain("Blog 탭의 wordpress_blog 글");
  });

  it("ConfirmSubmitButton으로 확인 문구를 표시한 뒤에만 제출된다", () => {
    const start = pageSource.lastIndexOf("waiveArticleWordPressFeaturedImageAction");
    const end = pageSource.indexOf("</form>", start);
    const block = pageSource.slice(start, end);
    expect(block).toContain("ConfirmSubmitButton");
    expect(block).toContain("검색 결과 클릭률이나 공유 미리보기에 영향을 줄 수 있습니다");
    expect(block).toContain("계속 진행하시겠습니까?");
  });

  it("사유 없이는 제출할 수 없도록 select에 required가 있다", () => {
    const start = pageSource.indexOf('name="reasonCode"');
    const end = pageSource.indexOf("</select>", start);
    const block = pageSource.slice(start, end);
    expect(block).toContain("required");
  });

  it("waived 상태이면 상태 문구와 자동 해제 안내를 표시한다", () => {
    expect(pageSource).toContain("이미지 없음으로 전송 진행");
    expect(pageSource).toContain("자동으로 해제됩니다");
    expect(pageSource).toContain("articleFeaturedImageWaiver.waived");
  });

  it("article 전용 서비스(lib/publish)를 사용하며 wordpress_blog 서비스(lib/social)와는 분리되어 있다", () => {
    expect(pageSource).toContain("@/lib/publish/article-wordpress-featured-image-waiver-service");
  });
});

describe("고급 기능: WordPress 게시 준비 자동 실행 (정적 소스 검사, Phase 2-20)", () => {
  it("prepareArticleWordPressPublishingAction을 호출하는 자동 실행 버튼이 있다", () => {
    expect(pageSource).toContain("prepareArticleWordPressPublishingAction,");
    expect(pageSource).toContain("<form action={prepareArticleWordPressPublishingAction}");
    expect(pageSource).toContain("WordPress 게시 준비 자동 실행");
  });

  it("덮어쓰기(재생성) 옵션은 secondary 체크박스로 제공된다", () => {
    const start = pageSource.indexOf("prepareArticleWordPressPublishingAction}");
    const end = pageSource.indexOf("</form>", start);
    const block = pageSource.slice(start, end);
    expect(block).toContain('name="overwrite"');
    expect(block).toContain('type="checkbox"');
  });

  it("자동 실행 안내 문구에 공개 게시를 하지 않는다는 내용이 포함된다", () => {
    expect(pageSource).toContain("공개 게시는 하지 않습니다");
  });

  it("상태 요약에 WordPress Metadata/SEO Plugin Metadata/대표 이미지/Quality Gate/승인/Draft 상태를 모두 표시한다", () => {
    const start = pageSource.indexOf("WordPress 게시 준비</h2>");
    const end = pageSource.indexOf("</form>", start);
    const block = pageSource.slice(start, end);
    expect(block).toContain("WordPress Metadata:");
    expect(block).toContain("SEO Plugin Metadata:");
    expect(block).toContain("대표 이미지:");
    expect(block).toContain("Quality Gate:");
    expect(block).toContain("승인 상태:");
    expect(block).toContain("WordPress Draft:");
  });

  it("자동 실행 버튼은 개별 기능 섹션들보다 먼저(위에) 위치한다", () => {
    const autoRunIndex = pageSource.indexOf("WordPress 게시 준비</h2>");
    const individualSectionsIndex = pageSource.indexOf("WordPress Metadata</h2>");
    expect(autoRunIndex).toBeGreaterThanOrEqual(0);
    expect(individualSectionsIndex).toBeGreaterThan(autoRunIndex);
  });
});

describe("원본 article WordPress 전송: Markdown→HTML 안내/재변환 (정적 소스 검사, Phase 2-21)", () => {
  it("updateArticleWordPressDraftContentAction을 import한다", () => {
    expect(pageSource).toContain("updateArticleWordPressDraftContentAction");
  });

  it("WordPress 전송 시 Markdown이 HTML로 변환된다는 안내 문구를 표시한다", () => {
    expect(pageSource).toContain("WordPress 전송 시 Markdown은 HTML로 변환됩니다.");
  });

  it("이미 Draft가 생성된 경우 새 post를 만들지 않고 기존 post의 content만 갱신하는 버튼을 제공한다", () => {
    expect(pageSource).toContain("Draft 내용 업데이트");
    expect(pageSource).toContain("<form action={updateArticleWordPressDraftContentAction}");
  });

  it("Draft 내용 업데이트 버튼은 공개 상태를 바꾸지 않는다는 안내를 포함한다", () => {
    const start = pageSource.indexOf("<form action={updateArticleWordPressDraftContentAction}");
    const end = pageSource.indexOf("</form>", start);
    const block = pageSource.slice(start, end);
    expect(block).toContain("공개");
    expect(block).toContain("WordPress 관리자 화면");
  });
});

describe("플랫폼별 글 생성 섹션 (정적 소스 검사, Phase 3-21)", () => {
  it("선택한 플랫폼 글 생성/전체 플랫폼 글 생성 action을 사용한다", () => {
    expect(pageSource).toContain("generateSelectedPlatformPostsAction");
    expect(pageSource).toContain("generateAllPlatformPostsAction");
  });

  it("전체 플랫폼 글 생성은 고급 옵션(<details>)이며 확인 모달(ConfirmSubmitButton)을 거친다", () => {
    const start = pageSource.indexOf("고급 옵션: 전체 플랫폼 글 생성");
    expect(start).toBeGreaterThan(-1);
    const block = pageSource.slice(start, start + 800);
    expect(block).toContain("ConfirmSubmitButton");
    expect(block).toContain("confirmMessage");
    expect(block).toContain("API 사용량이 증가할 수 있습니다");
  });

  it("선택한 플랫폼 글 생성이 메인(primary) 버튼이고, 전체 생성은 secondary/outline 스타일이다", () => {
    const selectedButtonStart = pageSource.indexOf("선택한 플랫폼 글 생성");
    const selectedButtonBlock = pageSource.slice(Math.max(0, selectedButtonStart - 300), selectedButtonStart);
    expect(selectedButtonBlock).toContain("bg-indigo-600");

    const advancedSectionStart = pageSource.indexOf("고급 옵션: 전체 플랫폼 글 생성");
    const confirmBlockStart = pageSource.indexOf("<ConfirmSubmitButton", advancedSectionStart);
    const confirmBlockEnd = pageSource.indexOf("</ConfirmSubmitButton>", confirmBlockStart);
    const confirmBlock = pageSource.slice(confirmBlockStart, confirmBlockEnd);
    expect(confirmBlock).toContain("전체 플랫폼 글 생성");
    expect(confirmBlock).not.toContain("bg-indigo-600");
  });

  it("이미 생성된 플랫폼이 있어도 건너뛴다는 안내가 있다(조용히 덮어쓰지 않는다)", () => {
    expect(pageSource).toContain("이미 생성된 플랫폼은 자동으로 건너뜁니다(조용히 덮어쓰지 않습니다)");
  });

  it("PlatformSelectionCheckboxes에 비용 수준/추천 여부/기존 생성 상태를 전달한다", () => {
    expect(pageSource).toContain("PlatformSelectionCheckboxes");
    expect(pageSource).toContain("costLevel: PLATFORM_COST_LEVELS[platform]");
    expect(pageSource).toContain("recommended: recommendedPlatforms.has(platform)");
    expect(pageSource).toContain("existingPlatforms.has(platform)");
  });

  it("article은 플랫폼 글 생성을 위한 원고 context로 안내되고, article mode를 과하게 강조하지 않는다", () => {
    const start = pageSource.indexOf("플랫폼별 글 생성</h2>");
    const block = pageSource.slice(start, start + 600);
    expect(block).toContain("출처 기반 원고 context");
  });
});

describe("진행 단계 표시 (정적 소스 검사, Phase 3-22)", () => {
  it("ContentProgressSteps를 사용하고, draft/reviewed 상태에 따라 current를 계산한다", () => {
    expect(pageSource).toContain("ContentProgressSteps");
    expect(pageSource).toContain("isDraft");
    expect(pageSource).toMatch(/existingSocialPosts\.some\(\(post\) => post\.approvalStatus === "approved"\)/);
  });
});

describe("마스터 원고 정보 섹션 (정적 소스 검사, Phase 4-4)", () => {
  it("readArticleMasterManuscript로 조회하고, 없으면 섹션을 렌더링하지 않는다", () => {
    expect(pageSource).toContain(
      'import { getArticleById, readArticleMasterManuscript } from "@/lib/repositories/article-repository"'
    );
    expect(pageSource).toContain("const masterManuscript = readArticleMasterManuscript(article)");
    expect(pageSource).toContain("{masterManuscript && (");
  });

  it("출처 요약/확인된 사실/확인 필요 사항 개수를 보여주고 raw JSON을 노출하지 않는다", () => {
    const start = pageSource.indexOf("마스터 원고 정보</h2>");
    const end = pageSource.indexOf("기사 본문</h2>");
    const block = pageSource.slice(start, end);
    expect(block).toContain("출처 요약");
    expect(block).toContain("확인된 사실");
    expect(block).toContain("확인 필요 사항");
    expect(block).not.toContain("JSON.stringify");
  });

  it("그대로 게시되는 내용이 아니라는 안내 문구가 있다", () => {
    expect(pageSource).toContain("그대로 게시되는 내용이 아닙니다");
  });

  it("Phase 4-8: 마스터 원고 자동 검토 상태 배지와 근거 연결(evidenceMap)/쟁점 개수를 보여준다", () => {
    expect(pageSource).toContain("reviewMasterManuscript");
    expect(pageSource).toContain("masterManuscriptReview.statusLabel");
    const start = pageSource.indexOf("마스터 원고 정보</h2>");
    const end = pageSource.indexOf("기사 본문</h2>");
    const block = pageSource.slice(start, end);
    expect(block).toContain("근거 연결(evidenceMap)");
    expect(block).toContain("masterManuscript.issues.length");
  });
});

describe("SEO 정보 반영 상태 요약 카드 + 개발자용 상세 정보 접힘 처리 (정적 소스 검사, Phase 4-6)", () => {
  function getSeoWriteStatusSectionSource(): string {
    const start = pageSource.indexOf("SEO 정보 반영 상태</h2>");
    const end = pageSource.indexOf("Phase 2-14: WordPress Final Draft Payload Review");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    return pageSource.slice(start, end);
  }

  it("summarizeSeoPluginWriteStatus로 계산한 사용자 친화적 요약을 사용한다", () => {
    expect(pageSource).toContain("summarizeSeoPluginWriteStatus");
    expect(pageSource).toContain("seoWriteSummary");
  });

  it("기본 화면(요약 카드)에는 raw env 이름/provider/endpoint path가 노출되지 않는다", () => {
    const section = getSeoWriteStatusSectionSource();
    const beforeDetails = section.slice(0, section.indexOf("<details"));
    expect(beforeDetails).not.toContain("SEO_PLUGIN_PROVIDER");
    expect(beforeDetails).not.toContain("SEO_PLUGIN_WRITE_ENABLED");
    expect(beforeDetails).not.toContain("WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED");
    expect(beforeDetails).not.toContain("custom endpoint path");
    expect(beforeDetails).not.toContain("Custom Endpoint");
    expect(beforeDetails).not.toContain("SEO Plugin Actual Write");
  });

  it("요약 카드에는 SEO 제목/메타 설명/Focus Keyword/WordPress Draft 준비 여부가 표시된다", () => {
    const section = getSeoWriteStatusSectionSource();
    const beforeDetails = section.slice(0, section.indexOf("<details"));
    expect(beforeDetails).toContain("seoWriteSummary.seoTitleReady");
    expect(beforeDetails).toContain("seoWriteSummary.metaDescriptionReady");
    expect(beforeDetails).toContain("seoWriteSummary.focusKeywordReady");
    expect(beforeDetails).toContain("seoWriteSummary.wordpressDraftConnected");
    expect(beforeDetails).toContain("다음 작업");
  });

  it("상태별 primary action(SEO 정보 생성/반영하기/확인/Draft 보기/다시 시도)이 모두 있다", () => {
    const section = getSeoWriteStatusSectionSource();
    expect(section).toContain("SEO 정보 생성");
    expect(section).toContain('"write_seo"');
    expect(section).toContain('"check_status"');
    expect(section).toContain('"view_draft"');
    expect(section).toContain('"retry"');
  });

  it("개발자용 상세 정보는 기본 접힘(<details>) 영역 안에서만 노출되고 기능은 삭제되지 않는다", () => {
    const section = getSeoWriteStatusSectionSource();
    expect(section).toContain("<details");
    expect(section).toContain("SEO 반영 상세 보기");
    const detailsStart = section.indexOf("<details");
    const detailsContent = section.slice(detailsStart);
    expect(detailsContent).toContain("SEO_PLUGIN_PROVIDER");
    expect(detailsContent).toContain("SEO_PLUGIN_WRITE_ENABLED");
    expect(detailsContent).toContain("WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED");
    expect(detailsContent).toContain("custom endpoint path");
    expect(detailsContent).toContain("Custom Endpoint (Rank Math 전용)");
    // 기존 액션(실제 반영 테스트/custom endpoint write)은 삭제되지 않고 접힘 안에 남아 있다.
    expect(detailsContent).toContain("writeSeoPluginMetadataToWordPressAction");
    expect(detailsContent).toContain("writeRankMathSeoViaCustomEndpointAction");
  });

  it("반영 버튼을 누를 수 없을 때 이유를 함께 보여준다(무반응 disabled 금지)", () => {
    const section = getSeoWriteStatusSectionSource();
    expect(section).toContain("primaryActionDisabledReason");
    expect(section).toContain("title={seoWriteSummary.primaryActionDisabledReason");
  });
});

describe("WordPress 게시 준비 요약 카드 + 개발자용 테스트 정보 접힘 처리 (정적 소스 검사, Phase 4-7)", () => {
  it("summarizeWordPressPublishingReadiness로 계산한 요약 카드가 있다", () => {
    expect(pageSource).toContain("summarizeWordPressPublishingReadiness");
    expect(pageSource).toContain("wordpressReadiness");
    expect(pageSource).toContain("WordPress 게시 준비</h2>");
  });

  it("요약 카드에 WordPress 연결/Draft 생성/SEO 정보/대표 이미지/공개 게시 상태와 다음 작업이 표시된다", () => {
    const start = pageSource.indexOf("WordPress 게시 준비</h2>");
    const end = pageSource.indexOf("Featured Image Workflow Step 1");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const section = pageSource.slice(start, end);
    expect(section).toContain("wordpressReadiness.connectionLabel");
    expect(section).toContain("wordpressReadiness.draftReadyLabel");
    expect(section).toContain("wordpressReadiness.seoLabel");
    expect(section).toContain("wordpressReadiness.imageLabel");
    expect(section).toContain("wordpressReadiness.publishLabel");
    expect(section).toContain("다음 작업");
  });

  function getMediaUploadSectionSource(): string {
    const start = pageSource.indexOf("대표 이미지 업로드 상태</h2>");
    const end = pageSource.indexOf("WordPress 연결 상태</h2>");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    return pageSource.slice(start, end);
  }

  it("기본 화면에는 'Step 2. WordPress Media Upload' 제목과 raw env flag가 노출되지 않는다", () => {
    const section = getMediaUploadSectionSource();
    const beforeDetails = section.slice(0, section.indexOf("<details"));
    expect(beforeDetails).not.toContain("Step 2. WordPress Media Upload");
    expect(beforeDetails).not.toContain("WORDPRESS_MEDIA_UPLOAD_ENABLED");
    expect(beforeDetails).not.toContain("WordPress 이미지 업로드 테스트");
    expect(beforeDetails).not.toContain("업로드 상태 확인");
  });

  it("이미지 업로드 상세 보기 접힘 안에는 기존 raw 값/버튼이 그대로 남아 있다(기능 유지)", () => {
    const section = getMediaUploadSectionSource();
    expect(section).toContain("이미지 업로드 상세 보기");
    const detailsStart = section.indexOf("<details");
    const detailsContent = section.slice(detailsStart);
    expect(detailsContent).toContain("WORDPRESS_MEDIA_UPLOAD_ENABLED");
    expect(detailsContent).toContain("prepareWordPressMediaUploadAction");
    expect(detailsContent).toContain("uploadFeaturedImageToWordPressAction");
    expect(detailsContent).toContain("checkWordPressMediaUploadStatusAction");
    expect(detailsContent).toContain("WordPress 이미지 업로드 테스트");
    expect(detailsContent).toContain("업로드 상태 확인");
  });

  function getConnectionTestSectionSource(): string {
    const start = pageSource.indexOf("WordPress 연결 상태</h2>");
    const end = pageSource.indexOf("Phase 2-2 / 2-9: WordPress 초안 생성");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    return pageSource.slice(start, end);
  }

  it("기본 화면에는 'WordPress Connection Test' 제목과 base URL/raw enabled flag가 노출되지 않는다", () => {
    const section = getConnectionTestSectionSource();
    const beforeDetails = section.slice(0, section.indexOf("<details"));
    expect(beforeDetails).not.toContain("WordPress Connection Test");
    expect(beforeDetails).not.toContain("process.env.WORDPRESS_BASE_URL");
    expect(beforeDetails).not.toContain("publish enabled");
    expect(beforeDetails).not.toContain("media upload enabled");
    expect(beforeDetails).toContain("연결 상태 확인");
  });

  it("WordPress 연결 상세 보기 접힘 안에는 base URL/raw flag가 있고 Application Password/Authorization header는 어디에도 없다", () => {
    const section = getConnectionTestSectionSource();
    expect(section).toContain("WordPress 연결 상세 보기");
    const detailsStart = section.indexOf("<details");
    const detailsContent = section.slice(detailsStart);
    expect(detailsContent).toContain("process.env.WORDPRESS_BASE_URL");
    expect(detailsContent).toContain("publish enabled");
    expect(detailsContent).toContain("media upload enabled");
    expect(section).not.toContain("Application Password:");
    expect(section).not.toContain("Authorization:");
    expect(pageSource).not.toContain("Authorization header:");
  });

  it("연결 테스트/업로드 테스트 기능은 삭제되지 않고 그대로 동작한다(testWordPressConnectionAction)", () => {
    expect(pageSource).toContain("testWordPressConnectionAction");
  });
});
