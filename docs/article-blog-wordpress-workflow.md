# Article ↔ Blog ↔ WordPress 워크플로우

이 문서는 "원본 article"과 "플랫폼별 블로그 글(특히 `wordpress_blog`)"의
역할을 명확히 구분하고, 실제로 어떤 경로를 통해 WordPress에 글이
올라가는지 정리한다.

## 핵심 원칙

| 개념 | 정의 |
| --- | --- |
| **Article** | 원본 콘텐츠. `/articles/[id]`에서 관리한다. `source_based_explainer`/`general_news`/`monetized_blog` 3개 article_mode 중 하나로 생성된다. |
| **Blog Post** | 플랫폼별 게시용 콘텐츠. `/articles/[id]/blog`에서 관리한다. article을 원재료로 `wordpress_blog`/`naver_blog` 플랫폼 프롬프트로 다시 쓴 결과다(`social_posts` 테이블). |
| **WordPress Draft** | `wordpress_blog` 글을 실제 WordPress에 저장한 결과. |

**article 초안은 WordPress 블로그형 글이 아니다.** article이 아무리
`monetized_blog` 모드로 생성됐어도, 그 자체는 여전히 "원본"일 뿐이다.
WordPress 게시의 기본 대상은 **`/articles/[id]/blog`에서
`platform=wordpress_blog`로 생성한 블로그 글**이다.

## 공통 "WordPress 게시 준비" UI (WordPressPublishingPanel)

`/articles/[id]`(고급 기능)과 `/articles/[id]/blog`(wordpress_blog
카드)의 WordPress 관련 UI는 서로 달라서 사용자가 "같은 기능인가?"
혼동하기 쉬웠다. 이를 해결하기 위해 **같은 표시 구조를 쓰는 공통
컴포넌트** `components/wordpress/wordpress-publishing-panel.tsx`
(`WordPressPublishingPanel`)를 만들어 두 화면에서 함께 사용한다.

- **컴포넌트는 순수 표시 전용이다.** 어떤 action도 직접 호출하지
  않으며, 실제 버튼/폼(action)은 각 페이지가 `children`으로 넘긴다 —
  article은 article 전용 action을, wordpress_blog는 social_post
  전용 action을 각자 구성한다. 이 덕분에 **article title/content가
  wordpress_blog 게시에 쓰이거나 그 반대로 쓰이는 일이 없다** — 두
  targetType의 데이터는 항상 각 페이지가 자신의 소스(article 테이블
  vs social_posts 테이블)에서만 읽어 props로 넘긴다.
- **`targetType` prop**(`"article"` | `"wordpress_blog"`)에 따라
  대상 배지("대상: 원본 article" / "대상: wordpress_blog")와 설명
  문구가 자동으로 바뀐다.
- **`isPrimaryWorkflow` prop**에 따라 역할 배지가 바뀐다 — article은
  `false`로 넘겨 "보조 기능"/"고급 기능" 배지가, wordpress_blog는
  `true`로 넘겨 "기본 게시 흐름" 배지가 표시된다.
- **공통 표시 순서**(양쪽 모두 동일): 대상 콘텐츠 배지 → 흐름 구분
  배지 → 품질/승인 상태 → WordPress Draft 상태/ID → SEO Metadata
  상태/seoTitle/metaDescription/targetKeyword/secondaryKeywords →
  대표 이미지 상태/media ID/URL/연결 상태/생략 여부(사유 포함)/오류
  메시지 → Publish Guard 상태 → 마지막 실행 결과 → (children으로)
  실행 버튼들.
- **SEO 필드가 비어 있을 때의 안내 문구도 targetType별로 다르다** —
  둘 다 "값이 없으면 상대방 값으로 자동 대체"하지 않는다는 원칙을
  문구로도 드러낸다:
  - article: "설정되지 않음" (원본 article에는 애초에 SEO metadata가
    없을 수 있다 — 억지로 만들지 않는다)
  - wordpress_blog: 필드별로 "SEO Title 없음"/"Meta Description
    없음"/"Target Keyword 없음"처럼 어떤 필드가 비었는지 짚어주고,
    하나라도 없으면 "metadata 재생성이 필요합니다. article의 SEO
    metadata로 자동 대체되지 않습니다"라는 안내를 추가로 표시한다
    ("SEO Metadata 재생성" 버튼으로 채울 수 있다).
- **wordpress_blog 패널 설명 문구**: "이 기능은 WordPress 블로그
  글로 생성된 wordpress_blog 콘텐츠를 WordPress Draft로 전송하거나
  업데이트할 때 사용합니다. 기사초안 원문이 아니라, 이 블로그
  카드의 제목·본문·SEO metadata·대표 이미지 정보를 기준으로
  WordPress에 반영합니다." — article 원문을 쓰지 않는다는 점을
  설명 문구 자체에도 명시한다.
- **"대표 이미지 없이 진행" 상태 문구**: wordpress_blog 카드에서
  waive를 선택하면 "대표 이미지 없이 진행하도록 선택되었습니다. 이
  상태는 warning으로 처리됩니다."를 표시한다 — hard fail이 아니라
  경고로만 처리된다는 점을 문구로도 알린다.
- **역할 배지 3종**: wordpress_blog는 "기본 게시 흐름" + "WordPress
  블로그 글 기준" 두 배지를 함께 표시하고, article은 "보조 기능" +
  "고급 기능" 두 배지를 표시한다.
- **마지막 업데이트 시각**: article은 `latestWordPressLog.createdAt`
  (publish_logs 기준), wordpress_blog는 `post.updatedAt`(social_post
  자신의 수정 시각)을 사용한다 — 서로 다른 소스에서 읽지만 같은
  위치에 같은 라벨("마지막 업데이트 시각")로 표시한다.
- **AI 대표 이미지 생성**(`lib/social/wordpress-blog-image-generation-service.ts`):
  wordpress_blog 카드의 "대표 이미지 준비" 안에 실제로 동작하는
  "AI 대표 이미지 생성" 섹션이 있다. "이미지 프롬프트 생성" 버튼은
  wordpress_blog 자신의 post_title/targetKeyword/answerSummary에서
  결정론적으로 prompt/altText/caption을 만들고(새 AI 호출 없음),
  "AI 이미지 생성" 버튼은 article의 실제 이미지 생성 파이프라인
  (Phase 2-7)이 쓰는 것과 **같은 provider client**
  (`lib/images/providers`, `IMAGE_GENERATION_ENABLED` 등 config)를
  그대로 재사용해 이미지를 생성한다. `IMAGE_GENERATION_ENABLED=false`면
  기존 provider client의 안전한 mock/dry-run 동작 그대로 처리된다.
  **article과 다른 점**: article은 결과를 `articles` 테이블 컬럼
  (`generatedImageStatus` 등)에 저장하지만, 이 기능은 article 컬럼을
  전혀 건드리지 않고 `social_posts.platformMetadata.imageGeneration`
  에만 저장한다 — 두 targetType의 이미지 상태가 섞이지 않는다.
  **알려진 한계**: 생성된 이미지를 WordPress Media Library에 자동
  업로드하는 연결은 아직 없다 — 이미지 URL을 확인한 뒤 필요하면
  사용자가 직접 다운로드해 기존 "내 컴퓨터에서 이미지 업로드"를
  사용해야 한다(다음 단계 후보).
- **SEO Plugin Metadata**(`lib/social/wordpress-blog-seo-plugin-service.ts`):
  wordpress_blog 카드에 Rank Math/Yoast/AIOSEO/Custom Endpoint/사용
  안 함 provider 선택과 실제 반영 버튼이 있다. article의 SEO Plugin
  Actual Write(Phase 2-12/2-13)가 쓰는 **저수준(article 비의존)
  WordPress 호출 함수**(`updateSeoPluginMetadata`/`verifySeoPluginMetadata`
  in `lib/publish/wordpress-client.ts`, `updateRankMathSeoViaCustomEndpoint`
  in `lib/seo/wordpress-seo-custom-endpoint-client.ts`)를 직접
  호출한다 — `writeSeoPluginMetadataToWordPress()`처럼 article 컬럼을
  읽고 쓰는 상위 오케스트레이션 함수는 호출하지 않는다. **중요한
  구조적 사실**: 이 프로젝트는 article 1개당 WordPress post 1개만
  만드는 구조(Phase 2, `publish_logs`가 articleId 기준 dedup)라서,
  wordpress_blog도 article과 **같은** WordPress post를 대상으로
  SEO metadata를 반영한다(WordPress Draft 생성이 이미 wordpress_blog
  content로 그 post를 덮어쓰는 것과 같은 전제). 다만 "어떤 값을
  보낼지"(wordpress_blog 자신의 seoTitle/metaDescription/targetKeyword,
  article fallback 없음)와 "결과를 어디에 기록할지"(article 컬럼이
  아니라 `social_posts.platformMetadata.seoPluginWrite`)는 완전히
  분리했다 — article 페이지의 SEO Plugin 표시와 wordpress_blog
  카드의 표시가 서로 덮어쓰지 않는다.
- **article 쪽 값 매핑**: 품질 상태 ↔ `article.publishQualityGateStatus`,
  승인 상태 ↔ `article.publicPublishApprovalStatus`, Publish Guard
  상태도 같은 `publishQualityGateStatus`를 재사용한다(article에는
  wordpress_blog의 `platformPublishGuardStatus`에 대응하는 별도
  guard 필드가 없다 — 새 필드/컬럼을 추가하지 않기 위한 절충이다).
  대표 이미지 URL/연결 상태/오류는 `article.featuredImageWordpressUrl`/
  `wordpressFeaturedMediaAttachStatus`/`wordpressFeaturedMediaAttachError`를
  그대로 사용한다.
- **wordpress_blog 쪽 값 매핑**: `post.qualityStatus`/
  `post.approvalStatus`/`post.platformPublishGuardStatus`와
  `buildWordPressBlogPublishPreparationSummary()`가 계산한 draft/
  featuredImage 요약을 사용한다. **SEO 필드(seoTitle/metaDescription/
  targetKeyword/secondaryKeywords)는 `blogMetadata`(post.platformMetadata
  전용, article 값 절대 미포함)에서만 읽는다** — article의 SEO
  추천값으로 대체하지 않는다는 원칙을 UI 데이터 흐름에서도 지킨다.
- **버튼명도 targetType별로 통일된 명명 규칙을 따른다**: article은
  "원본 article Draft 생성"/"원본 article SEO Metadata 업데이트"/
  "원본 article 대표 이미지 연결"/"대표 이미지 없이 원본 article
  전송"처럼 항상 "원본 article"을 접두어로 붙이고, wordpress_blog는
  "WordPress Draft 생성"/"SEO Metadata 업데이트"/"대표 이미지 연결"/
  "대표 이미지 없이 진행"처럼 접두어 없이 표기한다 — 버튼 이름만
  보고도 두 targetType을 구분할 수 있게 한다.
- 컴포넌트 자체는 새 API를 호출하지 않고, 어떤 데이터도 변경하지
  않는다(read-only). 기존 WordPress action은 하나도 삭제하지
  않았다 — 각 페이지의 버튼/폼은 그대로 `children`으로 살아있다.

## 두 개의 서로 다른 "WordPress 관련" 개념 — 자주 헷갈리는 지점

이 프로젝트에는 이름이 비슷해서 헷갈리기 쉬운 두 가지가 있다:

1. **`monetized_blog`** — article을 쓰는 **모드**(Phase 1/2,
   `articles` 테이블). "SEO/E-E-A-T/AEO/GEO를 반영한 문제 해결형
   수익 블로그" 스타일로 원본 article을 쓰게 한다.
2. **`wordpress_blog`** — 소셜 글쓰기의 **플랫폼**(Phase 3,
   `social_posts` 테이블). article(어떤 모드로 만들어졌든)을 원재료로
   WordPress 게시용 글을 다시 쓴다.

이 둘은 완전히 다른 스키마를 쓴다. `monetized_blog` 모드가 만드는
`answerSummary`/`eeatNotes`/`geoSummary`/`policyRiskScore`/
`structuredDataSuggestions` 같은 필드는 **articles 테이블에만
존재**하며, `wordpress_blog` 플랫폼의 `social_posts` row에는 존재하지
않는다. `social_posts.platformMetadata`는 타입이 정해지지 않은 JSON이라
`seoTitle`/`metaDescription`이 있으면(prompt가 채워 넣었다면) 그 안에서만
확인할 수 있다.

**따라서 이번 리팩터링에서 `wordpress_blog` 글에 적용한 검증은
"실제로 존재하는 필드"(quality_status/approval_status/post_title/
post_body/platformMetadata.seoTitle·metaDescription/금지 표현/실제
광고 코드 여부)만 대상으로 한다.** `monetized_blog` article 모드가
제공하는 E-E-A-T/AEO/GEO 전체 검증을 `wordpress_blog` social post에
그대로 적용하는 것은 스키마가 다르기 때문에 이번 단계의 범위 밖이다
— 필요하다면 별도 단계에서 `wordpress_blog` 출력 스키마 확장을
검토해야 한다(DB 변경이 필요할 수 있다).

## article 직접 WordPress 전송은 보조 기능이다

`/articles/[id]`의 "고급 기능: 원본 article WordPress 전송" 섹션
(접이식)에는 Phase 2에서 만든 WordPress Metadata/SEO Plugin/Featured
Image/Connection Test/WordPress Draft/Public Publish 기능이 그대로
들어 있다. **동작은 전혀 바뀌지 않았다** — 이름과 안내 문구만
명확히 했고, 접이식 섹션으로 묶어 기본 화면에서 눈에 띄지 않게
했다. **이 고급 기능은 원본 article을 그대로 WordPress Draft로
전송할 때만 사용한다.**

WordPress 블로그형 글(SEO metadata/featured image 포함)을 게시하고
싶다면 article 페이지로 이동할 필요가 없다 — 아래 메인 흐름처럼
**`/articles/[id]/blog`의 wordpress_blog 카드 안에서 전부 처리한다.**

### article 원본 전송용 "대표 이미지 없이 진행"과 wordpress_blog용 waive는 서로 다르다

두 화면 모두 "대표 이미지 없이 진행" 기능이 있지만, **완전히
독립된 상태이며 서로 자동 반영되지 않는다.**

| | `/articles/[id]` 고급 기능 | `/articles/[id]/blog`의 wordpress_blog 카드 |
| --- | --- | --- |
| 대상 | 원본 article을 그대로 WordPress Draft로 전송하는 경로 | wordpress_blog social_post의 "WordPress 게시 준비" 경로 |
| action | `waiveArticleWordPressFeaturedImageAction` | `waiveWordPressFeaturedImageForBlogPostAction` |
| 서비스 | `lib/publish/article-wordpress-featured-image-waiver-service.ts` | `lib/social/wordpress-blog-featured-image-waiver-service.ts` |
| 저장 위치 | `articles.format_metadata.article_wordpress_featured_image_waiver`(`targetType: "article"`) | `social_posts.platform_metadata.featuredImage`(`waived`) |
| 영향받는 readiness/guard | Publish Quality Gate(`checkFeaturedImagePresent`)의 featured image 판정 | `checkWordPressBlogPublishReadiness()`의 featured image warning |
| 사유 목록 | 내부 검토용 Draft/나중에 WordPress에서 수동 추가 예정/텍스트 중심 기사/적절한 이미지 없음/기타 | 적절한 이미지가 없음/텍스트 중심 글이라 이미지 없이 진행/나중에 WordPress에서 수동 추가 예정/기타 |

article 쪽에서 waive해도 wordpress_blog 카드의 waived 상태는
전혀 바뀌지 않고, 반대도 마찬가지다. 두 waiver 모두 **hard fail이
아니라 warning으로 처리될 뿐**이며, 실제 공개(publish) 게시를
자동으로 허용하지 않는다.

## 메인 WordPress 게시 흐름 (모두 `/articles/[id]/blog` 안에서 완결)

```
article 생성 (아무 모드나 무방, monetized_blog 권장)
   ↓
/articles/[id]/blog 에서 platform=wordpress_blog로 블로그 글 생성
   ↓
품질검사 (quality_status → ready)
   ↓
승인 요청 → 승인 (approval_status → approved)
   ↓
wordpress_blog 카드의 "WordPress 게시 준비" 섹션에서 아래를 순서대로 (또는 일괄) 실행:
   - WordPress 게시 준비 확인 / Publishing Guard 실행 / Dry-run 생성 / Handoff 완료
   - WordPress Draft 생성 또는 업데이트
   - SEO Metadata 업데이트 (wordpress_blog 글 자체의 seoTitle/metaDescription 사용)
   - 대표 이미지 연결 (media id가 준비된 경우)
   ↓
(선택) "WordPress 게시 준비 일괄 실행" 버튼으로 위 단계를 한 번에 실행
```

**article 페이지로 이동할 필요가 없다.** 이전 버전에서는 SEO
metadata 업데이트와 featured image 연결을 위해 article 페이지의
고급 기능으로 이동하라고 안내했지만, 이제는 wordpress_blog 카드
안에서 전부 처리된다.

### "WordPress 게시 준비"는 단계형 workflow UI다 (버튼 단순 나열 아님)

wordpress_blog 카드의 WordPress 관련 버튼이 순서 없이 나열돼 있어
사용자가 다음에 뭘 눌러야 하는지 알기 어려웠다. 이를 해결하기 위해
`lib/social/wordpress-blog-workflow-steps.ts`의 순수 함수
(`getWordPressBlogWorkflowStatusSummary`, `getWordPressBlogNextRecommendedAction`)
로 상태를 계산하고, 화면을 다음 구조로 재구성했다:

1. **단계별 상태 요약**(맨 위) — 품질검사/승인/Draft/SEO Metadata/
   대표 이미지/게시 준비/체크리스트 7개 항목을 badge로 한눈에 보여준다.
2. **다음 추천 작업** — 지금 상태 기준으로 "다음 단계: OOO"를 하나만
   추천한다(workflow 순서상 가장 앞선 미완료 단계).
3. **게시 준비 자동 실행** 버튼 — 예전에는 다른 버튼들과 나란히
   있었지만, 지금은 상단에 단독으로 강조 배치한다(`prepareWordPressBlogPostForPublishingAction`
   재사용 — 새 action 없음).
4. **Step 1~7** — 품질검사 → 승인 → WordPress Draft → SEO Metadata →
   대표 이미지 → 게시 가능 상태 확인 → 게시 체크리스트/Handoff 순서로
   각 단계를 카드로 나눠 상태 badge와 함께 보여준다. Step 1(품질검사)/
   Step 2(승인)/Step 7의 체크리스트 만들기는 카드 상단에 이미 있는
   공통 버튼(`runSocialPostQualityGateAction`/`requestSocialPostApprovalAction`/
   `approveSocialPostAction`/`prepareManualPostingRecordAction`, naver_blog와
   공유)을 그대로 사용하도록 안내만 하고, 버튼을 중복 배치하지 않는다.

**버튼 이름 변경**(UI label만 변경, action 함수 이름은 그대로):

| 이전 | 이후 | 비고 |
| --- | --- | --- |
| WordPress Draft Export | 수동 게시용 Draft 내보내기 | wordpress_blog 카드에서만(naver_blog는 "Naver Blog Export" 그대로) |
| Dry-run 생성 | 게시 전 미리보기 생성 | |
| Handoff 완료 | 수동 게시 완료 표시 | |
| WordPress 게시 준비 확인 | 게시 가능 상태 확인 | |
| WordPress 게시 준비 일괄 실행 | 게시 준비 자동 실행 | 위치도 상단으로 이동 |

**disabled 버튼에는 이유를 표시한다**: 예를 들어 SEO Metadata
업데이트 버튼은 `readiness.ready`가 아니거나 SEO metadata가
누락됐으면 disabled되고 "SEO metadata가 없습니다. metadata
재생성이 필요합니다."를 보여준다. Draft 생성이 막히면 승인 여부에
따라 다른 이유를 보여준다.

**"게시 준비 자동 실행"도 실제 공개 publish는 하지 않는다** —
`prepareWordPressBlogPostForPublishingAction`은 Draft 생성/업데이트,
SEO metadata 업데이트, 대표 이미지 연결, 게시 가능 상태 확인까지만
순서대로 실행하고, 실패 단계가 있으면 그 단계에서 멈춘다(기존 동작
그대로 — 이번 작업은 UI 배치만 바꿨다).

### Step 5(대표 이미지) 안에서 이미지 업로드까지 끝낼 수 있다 (다른 위치로 이동 불필요)

wordpress_blog 카드 안에서 WordPress 게시 준비를 하다가 대표 이미지만
다른 위치로 이동해서 처리해야 하는 불편함이 있었다. Step 5(대표
이미지) 카드 하나 안에서 다음을 모두 끝낼 수 있다:

- **파일 선택 → 업로드 전 미리보기**: `components/social/wordpress-featured-image-file-picker.tsx`
  (`"use client"` 컴포넌트)가 파일을 선택하는 즉시 같은 카드 안에서
  파일명/파일 크기/파일 형식과 (JPEG/PNG/WEBP인 경우) 썸네일
  미리보기를 보여준다. 허용되지 않는 형식이거나 5MB를 초과하면
  "WordPress Media로 업로드" 버튼이 비활성화되고 이유가 표시된다.
  실제 업로드 요청은 이 컴포넌트를 감싸는 부모
  `<form action={uploadWordPressFeaturedImageFromBlogPostAction}>`가
  그대로 처리한다(서버 로직 변경 없음).
- **WordPress Media 업로드 → 같은 카드에서 결과 확인**: 업로드가
  끝나면 페이지 이동 없이 Step 5 상단의 `<dl>`에 WordPress media
  ID/URL/업로드 상태/연결 상태/오류 메시지가 그대로 갱신되어 보인다.
  모든 업로드/저장/연결/waive form은 `returnTo`에 `highlight=socialPostId`가
  포함된 `selfReturnTo`를 hidden input으로 유지하므로, action 실행
  후에도 같은 wordpress_blog 카드 위치로 돌아오고 카드가 강조
  표시된다(`getHighlightClassName`/`buildAnchorId`).
- **Media ID 직접 입력**: WordPress 관리자에서 이미 업로드한 이미지의
  media ID를 알고 있으면 "대표 이미지 정보 저장" 버튼으로 같은 카드
  안에서 바로 저장할 수 있다. 저장하면 waived 상태가 있었더라도
  자동으로 해제된다(`wordpress-blog-featured-image-service.ts`).
- **대표 이미지 연결**: media ID가 저장되어 있고 Draft가 있고
  quality_status=ready + approval_status=approved면 "대표 이미지
  연결" 버튼이 활성화된다(`checkFeaturedImageAttachEligibility`).
  media ID가 없으면 비활성화되고 이유가 표시된다.
- **대표 이미지 없이 진행**: 사유(적절한 이미지 없음/텍스트 중심/
  나중에 수동 추가 예정/기타)를 선택해야만 waived 처리되며, 이후
  게시 가능 상태 확인(publish guard)에서 warning으로 표시된다. media
  ID를 새로 저장하거나 업로드하면 이 선택은 자동 해제된다.
- **"게시 준비 자동 실행"도 대표 이미지 상태를 반영한다**:
  `prepareWordPressBlogPostForPublishing()`의 featured_image 단계는
  media ID가 있으면 연결을 시도하고(성공/실패), media ID가 없고
  "이미지 없이 진행"이 선택되어 있으면 `skipped`로, media ID도 없고
  waived도 아니면 `warning`으로 표시한다(중단하지 않고 계속 진행하되
  경고를 남긴다). 실제 공개 publish는 어떤 경우에도 하지 않는다.
- **naver_blog 제외**: 위 파일 업로드/Media ID 저장/대표 이미지
  연결/이미지 없이 진행 UI는 `platform === "wordpress_blog"` 블록
  안에만 있다. naver_blog 카드에는 이 UI가 전혀 표시되지 않고
  기존 manual export UI만 유지된다.
- **이미지 binary/Authorization header/Application Password/전체 API
  응답은 로그에 저장하지 않는다** — 기존 WordPress 업로드 로그 정책을
  그대로 따른다(변경 없음).

### Step 7 체크리스트 상태는 "지금 상태 기준"으로 다시 계산한다 (저장된 pending 그대로 보여주지 않음)

`prepareManualPostingRecord()`가 체크리스트를 처음 만들 때는 모든
항목을 `status="pending"`으로 저장한다(`buildManualPostingChecklist()`).
문제는 이후 quality_status/approval_status/handoff_status 등이 바뀌어도
저장된 checklist item의 status는 갱신되지 않아서, 상단 handoff 배지는
"handoff 완료"인데 아래 15개 항목은 전부 "대기중"으로 보이는 모순이
있었다. `lib/social/manual-posting-checklist-status.ts`가 이를
해결한다 — 저장된 status를 그대로 쓰지 않고, 화면에 그릴 때마다
**지금 social_post 상태를 기준으로 각 항목의 status를 다시 계산**한다.

상태 타입(6가지, 새 UI에서만 쓰는 표시용 타입 — DB에는 없음):

| status | 표시 | 의미 |
| --- | --- | --- |
| `completed` | 완료 | 시스템이 자동으로 확인 가능하고 조건을 만족함 |
| `needs_review` | 확인 필요 | 사람이 직접 봐야 판단 가능(자동 완료로 단정하지 않음) |
| `pending` | 대기중 | 아직 조건을 만족하지 못함 |
| `blocked` | 차단됨 | quality/guard 등이 명시적으로 막혀 있음 |
| `failed` | 실패 | 이전 단계 실행이 실패함 |
| `skipped` | 생략 | 해당 없음으로 건너뜀 |

**자동 계산 항목**(quality_gate_ready/approval_approved/manual_export_ready/
platform_publishing_guard_ready/publish_dry_run_ready/handoff_completed)은
social_post의 quality_status/approval_status/export_status/
platform_publish_guard_status/platform_publish_ready/
platform_publish_dry_run_status/handoff_status/manual_post_status를 보고
completed/blocked/failed/pending을 계산한다.

**URL 기록 항목**(record_url_after_posting, `{platform}_copy_url`)은
`manual_post_url` 또는 `post_url`이 있으면 completed, 없으면
needs_review로 표시한다.

**사람이 직접 확인해야 하는 항목**(최종 내용 확인, 이미지/링크 확인,
정책 위반 가능성 확인, wordpress_seo_check 등)은 handoff가
완료됐다고 자동으로 완료라고 단정하지 않는다. 기본은 needs_review이고,
`platformMetadata.manualChecklistConfirmations[key].confirmed === true`이거나
저장된 item.status가 `'confirmed'`인 경우에만 completed로 표시한다 —
"확인 완료 표시" 버튼(아래 참고)이 이 confirmation을 저장한다.

**handoff 완료와 체크리스트 항목 상태는 다를 수 있다**: `handoff_status='completed'`여도
사람이 확인해야 하는 항목은 needs_review로 남을 수 있다. 이 경우
상단 "handoff 완료" 배지는 그대로 두되(handoff 자체는 실제로
완료됐으므로), 그 아래에 "일부 체크리스트 항목은 확인 필요
상태입니다." 안내 문구(`getChecklistHandoffMismatchNotice()`)를
추가로 보여준다. handoff가 completed가 아니면 이 안내는 표시하지
않는다(체크리스트가 대기중인 게 당연하므로 모순이 아니다).

Step 7의 "전체 체크리스트 보기" 아코디언 요약줄에 완료/확인 필요/
대기중/실패(그리고 있으면 차단됨/생략) 개수를 항상 보여준다.
`getChecklistGuidanceMessage()`가 상황별 안내 문구도 추가로 보여준다 —
시스템 자동 항목이 모두 끝나고 사람이 확인할 항목만 남았으면
"게시 준비는 완료되었습니다. 남은 항목은 사람이 직접 확인해야 하는
최종 점검입니다.", 아직 시스템 항목도 안 끝났으면 "확인 필요 항목이
남아 있습니다. WordPress 관리자 화면에서 수동 확인 후 완료 표시를
하세요."를 보여준다.

### "확인 필요" 항목은 오류가 아니라 수동 검토 단계다 — 설명/확인 완료/URL 저장

"확인 필요" badge만 보여주면 사용자가 오류인지 수동 검토인지 구분하기
어렵다. Step 7은 다음을 추가로 보여준다:

1. **오류가 아니라는 안내 박스**(체크리스트가 있으면 항상 표시): "확인
   필요 항목은 오류가 아닙니다. 시스템이 자동으로 판단하기 어려운
   부분을 사람이 직접 확인해야 한다는 뜻입니다. WordPress 관리자 화면
   또는 미리보기에서 확인한 뒤 완료 표시를 하세요."
2. **"지금 확인이 필요한 항목" 카드 목록**: needs_review 상태인 항목만
   먼저 보여준다(완료/대기중 항목은 아래 "전체 체크리스트 보기"에
   접혀 있다). 각 카드는 항목명 + status badge + 상태 한 줄 설명
   (`MANUAL_POSTING_CHECKLIST_ITEM_STATUS_DESCRIPTIONS`) + 무엇을
   확인해야 하는지 설명 + 사용자가 할 행동
   (`MANUAL_POSTING_CHECKLIST_ITEM_GUIDES`)을 보여준다. 예를 들어
   `wordpress_seo_check`는 "Rank Math, Yoast, AIOSEO 등 선택한 SEO
   plugin에 SEO title과 meta description이 제대로 반영되었는지
   확인하세요." / "WordPress SEO plugin 화면에서 metadata 반영 여부를
   확인하세요."를 보여준다.
3. **확인 완료 표시 버튼**(`markManualChecklistItemConfirmedAction`,
   `lib/social/manual-posting-checklist-confirmation-service.ts`):
   사람이 직접 확인해야 하는 항목(`CONFIRMABLE_MANUAL_CHECKLIST_ITEM_KEYS`
   — final_content_check/image_link_check/policy_violation_check/
   wordpress_workflow_duplicate_check/wordpress_title_body_image_check/
   wordpress_seo_check/wordpress_visibility_check, 7개)에만 표시된다.
   누르면 `social_posts.platformMetadata.manualChecklistConfirmations`
   (JSON, **DB schema 변경 없음**)에 `{confirmed: true, confirmedAt,
   confirmedBy}`를 기록한다. **시스템 자동 항목(quality_gate_ready
   등)이나 URL 기록 항목에는 이 버튼이 없다** — 실제 상태(quality_status
   등)를 사람이 임의로 덮어쓸 수 없도록 `computeManualPostingChecklistItemStatus()`가
   AUTO_COMPUTED_KEYS/URL_RECORDED_CHECKLIST_ITEM_KEYS를 먼저 확인하고
   confirmations는 그 다음에만 본다.
4. **게시 URL 저장**(`record_url_after_posting` 항목에만 URL 입력
   필드 + "게시 URL 저장" 버튼을 표시): 새 action을 만들지 않고 기존
   `recordManualPostingResultAction`(Phase 3-8)을 그대로 재사용한다.
   `pattern="https?://.*"` + `type="url"`로 http(s)만 허용하고, 이
   action의 기존 검증(`checkRecordable`/`validateManualPostUrl`)이
   그대로 적용된다(quality/approval/guard/dry-run/handoff가 끝나지
   않았으면 저장이 차단된다). 저장에 성공하면 `manual_post_url`이
   채워지므로 `record_url_after_posting`과 `wordpress_copy_url` 둘 다
   자동으로 completed로 계산된다.
5. **게시 URL 복사**(`components/social/copy-url-button.tsx`,
   `"use client"`): `manual_post_url` 또는 `post_url`이 있을 때만
   표시되고, `navigator.clipboard.writeText()`로 복사한다. 서버에는
   아무것도 저장하지 않는다 — URL 존재 여부만으로 이미 completed로
   계산되므로 별도 저장이 필요 없다. 복사 실패 시 "복사에 실패했습니다.
   URL을 직접 선택해 복사하세요." 안내를 보여준다.

**다음 추천 작업도 체크리스트 상태를 반영한다**: `getWordPressBlogNextRecommendedAction()`이
체크리스트가 준비된 뒤에는 `checklistNeedsReviewCount`(남은 확인
필요 항목 수)와 `checklistUrlMissing`(게시 URL 미기록 여부)을 보고
"다음 단계: 확인 필요 항목 검토" → "다음 단계: 게시 URL 기록" →
"다음 단계: 완료됨" 순으로 추천을 좁혀 간다.

### `WordPress 게시 준비` 섹션 — 무엇을 보여주는가

`lib/social/wordpress-blog-publish-preparation-summary.ts`의
`buildWordPressBlogPublishPreparationSummary()`가 계산한다(읽기
전용, API 호출 없음):

- **readiness**(blocker/warning): `checkWordPressBlogPublishReadiness()`
  결과 그대로. blocker는 `platform === "wordpress_blog"`,
  `quality_status === "ready"`, `approval_status === "approved"`,
  `post_title`/`post_body` 존재, 금지 표현 없음, 실제 광고 스크립트
  없음. warning은 SEO 필드 누락, AD_SLOT marker 중복.
- **WordPress Draft 상태/post ID/URL**: 가장 최근 성공한 WordPress
  게시 기록(`publish_logs`, article 기준 — 아래 "알려진 한계" 참고).
- **SEO metadata 상태/seoTitle/metaDescription/targetKeyword**: article의
  WordPress metadata 컬럼 기준(없으면 wordpress_blog의
  `platformMetadata` 값으로 대체 표시).
- **featured image 상태/WordPress media ID**: article의 featured
  image 컬럼 기준.
- **publish guard 상태**: social_post 자체의
  `platform_publish_guard_status`(플랫폼별로 실제 분리된 필드).

### 버튼별 동작

| 버튼 | action | 설명 |
| --- | --- | --- |
| WordPress 게시 준비 확인 | `runPlatformPublishingGuardAction` | 기존 platform guard 재사용(social_post 기준). |
| Dry-run 생성 / Handoff 완료 | `createPlatformPublishDryRunAction` / `completePlatformExportHandoffAction` | 기존 platform 공통 action 재사용. |
| WordPress Draft 생성 | `createWordPressDraftFromBlogPostAction` | readiness 통과 시에만 기존 `publishArticleToWordPressDraft(articleId)` 호출. |
| WordPress Draft 업데이트 | `updateWordPressDraftFromBlogPostAction` | 기존 draft가 있을 때만 활성화. `publishArticleToWordPressDraft(articleId, { force: true })`를 재사용한다 — **진짜 PATCH 업데이트가 아니라 재생성**이다(아래 한계 참고). |
| SEO Metadata 업데이트 | `updateWordPressSeoMetadataFromBlogPostAction` | `lib/social/wordpress-blog-seo-metadata-service.ts` — wordpress_blog 글의 `platformMetadata.seoTitle`/`metaDescription`(없으면 `post_title`)을 우선 사용해 article의 WordPress metadata 컬럼에 저장한다. article 원문 title/content는 사용하지 않는다. |
| 대표 이미지 정보 저장 | `saveWordPressFeaturedImageMediaForBlogPostAction` | `lib/social/wordpress-blog-featured-image-service.ts` — 이미 WordPress Media Library에 있는 이미지의 media ID(+선택적으로 URL)를 입력받아 저장한다. 실제 업로드/AI 생성은 하지 않는다. |
| 대표 이미지 연결 | `attachWordPressFeaturedImageFromBlogPostAction` | 기존 `attachFeaturedMediaToDraft(articleId)` 재사용. **`checkFeaturedImageAttachEligibility()`가 draft 존재/media ID 존재/quality/approval을 모두 확인한 뒤에만 버튼이 활성화**된다 — 조건이 안 맞으면 이유를 화면에 표시하고 버튼 자체를 비활성화한다. |
| WordPress 게시 준비 일괄 실행 | `prepareWordPressBlogPostForPublishingAction` | `lib/social/wordpress-blog-publish-preparation-orchestrator.ts` — quality/approval 확인 → draft 생성/업데이트 → SEO metadata → featured image(있으면) → publish guard 순서로 실행하고, 실패한 단계에서 멈춘다. **실제 공개 게시는 어떤 단계에서도 수행하지 않는다.** |

### `대표 이미지 준비` 섹션 — media ID를 준비하는 두 가지 방식

기존에는 "대표 이미지 연결" 버튼만 있고 media ID를 준비할 방법이
없어서, 사용자가 어떤 이미지를 연결하는지 알 수 없는 문제가 있었다.
이제 wordpress_blog 카드 안에 **"대표 이미지 준비"** 섹션이 추가돼,
media ID를 준비하는 **두 가지 방식**을 모두 지원한다:

- **A. 이미 WordPress에 올라간 이미지 사용** — WordPress Media ID를
  직접 입력한다("대표 이미지 정보 저장" 버튼).
- **B. 내 컴퓨터 이미지 업로드** — 로컬 파일을 선택하면 WordPress
  Media Library에 실제로 업로드하고, 성공 시 media ID를 자동으로
  저장한다("WordPress Media로 업로드" 버튼).

두 방식 모두 최종적으로 같은 곳(article의 WordPress media 컬럼 +
wordpress_blog 글의 `platformMetadata`)에 media ID/URL을 저장하므로,
둘 중 어느 쪽을 쓰든 이후 "대표 이미지 연결" 버튼이 동일하게
동작한다.

공통 표시 항목: 현재 대표 이미지 상태, WordPress media ID, WordPress
media URL, 연결 상태(`wordpressFeaturedMediaAttachStatus`), 업로드
상태(`featuredImageUploadStatus`), 오류 메시지(있는 경우).

- **"대표 이미지 연결" 버튼**은 아래 조건을 **모두** 만족해야
  활성화된다(`checkFeaturedImageAttachEligibility`):
  1. WordPress Draft(post id)가 이미 생성되어 있어야 한다.
  2. WordPress media ID가 저장되어 있어야 한다(A 또는 B 방식 중 어느
     것으로 준비했든 상관없다).
  3. `quality_status === 'ready'`
  4. `approval_status === 'approved'`

  조건을 만족하지 못하면 버튼 아래에 "WordPress Draft가 먼저
  필요합니다.", "대표 이미지 media ID를 먼저 입력하세요.", "품질검사를
  통과해야 합니다.", "승인 후 연결할 수 있습니다." 중 해당하는
  이유를 그대로 보여준다.

#### B. 내 컴퓨터 이미지 업로드 — 상세

`uploadWordPressFeaturedImageFromBlogPostAction` →
`lib/social/wordpress-blog-local-image-upload-service.ts`가 **기존
2단계 파이프라인을 그대로 이어 붙인다**(새 실제 API 호출 코드
없음):

1. `saveLocalImageUpload(articleId, file)`(Phase 2-5/2-19) — 로컬
   파일을 Supabase Storage에 저장.
2. `uploadFeaturedImageToWordPress(articleId)`(Phase 2-10) — 그 URL을
   읽어 실제 WordPress Media Library(`POST /wp-json/wp/v2/media`)에
   업로드. `WORDPRESS_MEDIA_UPLOAD_ENABLED=false`면 실제 호출 없이
   안전하게 skip 처리된다(기존 동작 그대로).

**파일 검증**(업로드 전): 허용 타입 `image/jpeg`/`image/png`/
`image/webp`만, 최대 5MB, 파일 미선택 시 차단. 각각 "이미지 파일만
업로드할 수 있습니다.", "파일 크기는 5MB 이하만 업로드할 수
있습니다.", "파일을 먼저 선택하세요." 메시지를 반환한다.

**alt text/caption**: UI에 입력란은 있지만 **이번 단계에서는
저장하지 않는다**(추후 지원 예정) — 이 두 값을 저장하려면 Phase
2-5의 무거운 이미지 준비 메타데이터 구조(`prompt`/`style`/
`aspectRatio` 등 다수의 관련 없는 필드까지 요구)를 재사용하거나
새 경량 저장 경로를 설계해야 해서, 이번 리팩터링 범위에서는
의도적으로 보류했다.

### media ID/URL은 어디에 저장되는가 (DB 스키마 변경 없음)

두 방식 모두 아래 두 곳에 나눠 기록한다:

1. **`articles.featured_image_wordpress_media_id`/`featured_image_wordpress_url`** —
   A 방식은 기존 Phase 2-19 함수 `saveExistingWordPressMedia(articleId, ...)`를,
   B 방식은 기존 Phase 2-10 함수
   `uploadFeaturedImageToWordPress(articleId)`가 내부적으로 호출하는
   `saveFeaturedImageUploadResult(articleId, ...)`를 그대로 재사용해
   저장한다. 실제 "대표 이미지 연결"(`attachFeaturedMediaToDraft`)이
   읽는 값도 이 컬럼이므로, 여기 저장해야 연결이 실제로 동작한다.
2. **`social_posts.platformMetadata.featuredImage`** — wordpress_blog
   글 카드에 "이 글 기준으로 무엇을 준비했는지" 보여주기 위해, 기존
   `platform_metadata`(JSON) 필드 안에 `{ wordpressMediaId,
   wordpressUrl, savedAt, source }`(`source`는 `"local_upload"` 또는
   직접 입력 시 생략)를 추가로 저장한다. **social_posts에 새 컬럼을
   추가하지 않았다** — 이미 있던 JSON 필드를 사용했다.

pipeline_logs(`blog_post_featured_image_media_saved`,
`blog_post_featured_image_uploaded`)에는 media ID와 URL 존재 여부
(boolean)만 기록하며, 이미지 URL 원문·파일 binary·Authorization
header·Application Password는 로그에 절대 남기지 않는다.

### 대표 이미지 없이 진행 (waive)

media ID를 준비하지 못한 상태에서도, 사용자가 **명시적으로** "대표
이미지 없이 진행"을 선택하면 게시 준비를 계속 진행할 수 있다.

- **버튼/action**: "대표 이미지 없이 진행" 버튼 →
  `waiveWordPressFeaturedImageForBlogPostAction` →
  `lib/social/wordpress-blog-featured-image-waiver-service.ts`의
  `waiveWordPressFeaturedImageForBlogPost()`.
- **사유 선택 필수**: 아래 4가지 중 하나를 반드시 선택해야 한다(선택
  안 하면 차단). `기타`를 선택하면 메모를 추가로 입력할 수 있다.
  1. 적절한 이미지가 없음(`no_suitable_image`)
  2. 텍스트 중심 글이라 이미지 없이 진행(`text_focused`)
  3. 나중에 WordPress에서 수동 추가 예정(`manual_later`)
  4. 기타(`other`, 메모 입력 가능)
- **게시 준비 가드에 미치는 영향**: media ID가 없어도 **더 이상
  blocker가 아니다.** `checkWordPressBlogPublishReadiness()`는
  media ID도 없고 waive도 선택하지 않은 경우에만 "대표 이미지가
  준비되지 않았습니다" 안내를 warning으로 보여주고, waive를
  선택하면 "사용자가 이미지 없이 진행하도록 선택했습니다"로 문구가
  바뀐다 — 둘 다 **warning일 뿐 blocker가 아니므로** WordPress
  Draft 생성/SEO metadata 업데이트는 대표 이미지 유무와 무관하게
  그대로 동작한다.
- **저장 위치 (DB schema 변경 없음)**: `articles.featured_image_upload_status`
  컬럼에는 `check (... in ('not_ready', 'prepared', 'dry_run',
  'uploaded', 'failed', 'skipped'))` CHECK 제약이 있어(`db/migrations/016`)
  `'waived'`라는 새 값을 저장할 수 없다. 이 제약을 완화하는 migration을
  추가하는 대신, waive 상태는 `social_posts.platformMetadata.featuredImage`
  (이미 있는 JSON 필드) 안에 `{ waived: true, waivedReasonCode,
  waivedMemo, waivedAt }`로만 저장한다. article 쪽 media id/url
  컬럼은 이미 허용된 값인 `'skipped'`로 정리해(`saveFeaturedImageUploadResult`)
  article/social_post 상태가 어긋나지 않게 한다.
- **"대표 이미지 연결" 버튼 조건은 그대로**: waive를 선택해도
  `checkFeaturedImageAttachEligibility()`의 media ID 요구 조건은
  바뀌지 않는다 — waive는 "이미지 없이 게시 준비를 진행하겠다"는
  뜻이지 media ID 요구사항을 우회하는 것이 아니다.
- **다시 이미지 추가 시 자동 해제**: media ID를 직접 저장하거나
  (`saveWordPressFeaturedImageMediaForBlogPost`) 로컬 업로드가
  성공하면(`uploadWordPressFeaturedImageFromBlogPost`) waive 상태는
  자동으로 `waived: false`로 초기화된다.
- **naver_blog에는 없음**: 이 기능은 wordpress_blog 카드에만 있다.
- **주의(캐치): SEO/공유 영향**: 대표 이미지 없이 진행하면 검색
  결과 클릭률, SNS 공유 미리보기, 블로그 가독성에 영향을 줄 수
  있다는 안내 문구를 UI에 항상 표시한다.

### WordPress 게시 준비 강화 — 표시 항목/readiness 검증 확대

`WordPress 게시 준비` 섹션에 다음 항목을 추가로 표시한다: `quality_status`,
`approval_status`, `policyRiskScore`, featured image waived 여부.

`checkWordPressBlogPublishReadiness()`에도 warning(비차단) 검사를
추가했다 — 모두 기존 blocker는 그대로 두고 새 항목만 warning으로만
동작하므로 기존에 통과하던 글이 갑자기 막히지 않는다:

- `platform_metadata.targetKeyword`가 없으면 warning.
- title에 clickbait 패턴(과다한 느낌표/물음표, "충격"/"경악" 등)이
  있으면 warning.
- targetKeyword가 본문 단어 수 대비 6%를 초과해 반복되면 keyword
  stuffing warning.
- policyRiskScore가 70을 초과하면 warning. wordpress_blog 자신의
  `platformMetadata.policyRiskScore`를 우선 사용하고, 없으면
  article.policyRiskScore(monetized_blog 원본 article 기준)로
  대체한다 — 둘 다 없으면 이 검사를 건너뛴다.

### article에 없는 WordPress 게시용 정보는 wordpress_blog 생성 시 만든다

article은 원본 콘텐츠일 뿐이다. `source_based_explainer`/`general_news`
모드로 생성된 article에는 `seoTitle`/`metaDescription`/`targetKeyword`가
아예 없을 수 있고, `answerSummary`/`eeatNotes`/`geoSummary`/
`structuredDataSuggestions`는 article_mode와 무관하게 **article
테이블에 애초에 저장되지 않는다**(monetized_blog 모드에서도 AI
생성 시점에만 존재했다가 본문 텍스트 안에 녹아들 뿐, 별도 구조화
필드로 남지 않는다 — `lib/ai/article-writer.ts`의 `GeneratedArticle`
참고). 그래서 wordpress_blog 글을 생성할 때 이 정보를 wordpress_blog
글 자신이 새로 만든다:

- **생성 시점**(`generateSocialDraftAction` → mock 또는 실제 AI):
  `lib/social/wordpress-blog-metadata-generator.ts`의
  `generateWordPressBlogMetadata()`가 wordpress_blog 글 자신의
  title/body/excerpt로부터 `seoTitle`/`metaDescription`/`targetKeyword`/
  `secondaryKeywords`/`searchIntent`/`readerPersona`/`answerSummary`/
  `eeatNotes`/`geoSummary`/`structuredDataSuggestions`/`adSlots`/
  `monetizationScore`/`policyRiskScore`를 만들어
  `social_posts.platformMetadata`(기존 JSON 필드, 새 컬럼 없음)에
  저장한다. article에 이미 값이 있으면(주로 monetized_blog 모드)
  생성 시점에는 참고용으로 재사용한다. 실제 AI 경로에서는
  `prompts/social/wordpress-blog.md`가 이 필드들을 `platform_metadata`
  안에 직접 생성하도록 지시한다 — article 값을 그대로 베끼지 않는다.
- **버그 수정**: 이전에는 AI/mock이 만든 `platform_metadata`를
  파싱은 했지만 저장 시 버려서(`{ purpose, mock }`만 저장) 실제로는
  생성돼도 저장/표시가 안 됐다 — 이번에 저장 매핑을 고쳤다.
- **표시**: `/articles/[id]/blog`의 wordpress_blog 카드 "SEO/게시용
  metadata" 섹션에서 위 필드를 모두 보여준다.
- **업데이트 시점**(`updateWordPressSeoMetadataFromBlogPost`, "SEO
  Metadata 업데이트" 버튼): wordpress_blog 자신의 `platformMetadata`
  값만 사용하고, **article의 추천값으로 대체하지 않는다.**
  seoTitle/metaDescription/targetKeyword 중 하나라도 없으면
  차단하고 "SEO Metadata 재생성" 사용을 안내한다. slug/category/
  tag/internalLinkSuggestions는 taxonomy 정보이므로 계속 article
  기준 추천(`generateWordPressMetadata`)을 재사용한다.
- **재생성**(`regenerateWordPressBlogMetadataAction`, "SEO Metadata
  재생성" 버튼): post_title/post_body는 다시 쓰지 않고 metadata만
  다시 만든다. 실제 AI를 다시 호출하지 않고(새 외부 API 호출 추가
  금지), 이미 있는 title/body/excerpt에서 결정론적으로 도출한다.
- **WordPress Draft 생성/업데이트**: 실제 전송 title/content는
  wordpress_blog 자신의 post_title/post_body다(article 원문 아님) —
  이미 이전 단계에서 `contentOverride` 옵션으로 구현했다.

### 알려진 한계 (다음 단계 후보)

- **WordPress Draft/SEO metadata/featured image 상태는 article 단위로
  저장된다.** `social_posts`에는 이 상태를 담을 전용 컬럼이 없어(DB
  스키마 변경 없이 처리하기 위한 절충), 실제 WordPress 문서/게시
  상태는 여전히 `articles` 테이블과 `publish_logs`에 저장된다. 화면
  표시와 액션 트리거만 wordpress_blog 카드로 옮겨왔다.
- **"WordPress Draft 업데이트"는 실제 PATCH API가 아니다.** 이
  프로젝트의 `wordpress-client.ts`에는 draft 생성(`createDraftPost`)만
  있고 update 함수가 없다 — 외부 API 로직을 새로 추가하지 않기 위해,
  기존 `force` 옵션을 재사용해 새 draft를 다시 생성하는 방식으로
  "업데이트"를 흉내낸다.
- ~~실제 전송 payload는 여전히 article 본문이다~~ **(해결됨).**
  `publishArticleToWordPressDraft()`에 `contentOverride?: { title,
  content, excerpt }` 옵션을 추가했다(기본값 `undefined` — 넘기지
  않으면 기존과 동일하게 article.title/article.content를 사용하므로
  article 페이지 "고급 기능"의 동작은 전혀 바뀌지 않는다).
  wordpress_blog 카드에서 호출하는 draft 생성/업데이트/일괄 실행
  action들은 모두 `post.postTitle`/`post.postBody`/`post.excerpt`로
  이 옵션을 채워서 넘긴다 — 실제 WordPress에 전송되는 title/content가
  이제 article 원문이 아니라 wordpress_blog 글 자체다. 이 변경은
  기존 `createDraftPost()` 호출 자체(실제 API 호출 코드)는 전혀
  건드리지 않았다 — 어떤 title/content 문자열을 넘길지 결정하는
  분기만 추가했다.

## naver_blog는 manual export 중심 그대로 유지

`platform=naver_blog`인 글에는 WordPress 관련 버튼(Draft 생성/업데이트/
SEO metadata/featured image/publish guard)이 **표시되지 않는다.**
naver_blog는 이번 리팩터링 이전과 동일하게 품질검사 → 승인 →
Manual Export → 복사 → 수동 게시 결과 기록 흐름만 사용한다.

추가로 `lib/social/naver-blog-content-safety-checks.ts`의
`checkNaverBlogContentSafety()`가 다음을 점검해 카드에 표시한다(자동
수정하지 않음):

- markdown heading anchor 문법(`{#...}`)이 서명 등에 잘못 섞여
  들어간 경우
- 실존하지 않는 작성자 서명("OOO 드림/올림")으로 보이는 표현

## 관련 문서

- 운영 매뉴얼: [`phase-3-operation-manual.md`](./phase-3-operation-manual.md)
- 라우트 맵: [`phase-3-route-map.md`](./phase-3-route-map.md)
- `monetized_blog` article 모드: [`article-generation-monetized-blog.md`](./article-generation-monetized-blog.md)
