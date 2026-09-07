# `monetized_blog` 모드 — 문제 해결형 수익 블로그

이 문서는 기사 생성 모드 3종 중 `monetized_blog`의 개선된 설계를
설명한다. 구현은 `lib/ai/article-writer.ts`
(`MONETIZED_BLOG_SYSTEM_PROMPT`, `MONETIZED_BLOG_TOOL`,
`generateMonetizedBlogAiDraft`, `ensureAdSlotMarkers`)에 있고, 평가
기준은 `evals/monetized-blog.eval.yaml`에 있다.

## 정의

`monetized_blog`는 "광고 수익만 노리는 글"이 아니라, **독자의 문제를
해결하고, 검색엔진이 이해하기 쉽고, 생성형 AI 검색에서도 요약하기
쉬우며, 광고 정책과 신뢰성 기준을 지키는 문제 해결형 수익 블로그**
콘텐츠 모드다. 최우선 목표는 독자의 문제 해결과 신뢰성이며, SEO는
그 콘텐츠를 더 잘 발견되게 하는 보조 수단일 뿐이다.

## `wordpress_blog`(플랫폼)과의 관계 — 헷갈리지 말 것

`monetized_blog`는 article을 쓰는 **모드**(Phase 1/2, `articles`
테이블)이고, `wordpress_blog`는 소셜 글쓰기의 **플랫폼**(Phase 3,
`social_posts` 테이블, `/articles/[id]/blog`)이다. 이름이 비슷해서
헷갈리기 쉽지만 완전히 다른 스키마다.

**실제로 WordPress에 게시하는 기본(메인) 대상은 article이 아니라
`wordpress_blog` 플랫폼으로 생성한 블로그 글이다.** `monetized_blog`
모드로 article을 만들면 SEO 메타데이터(seoTitle/targetKeyword/
metaDescription)가 항상 채워지므로, 이후 `wordpress_blog` 글을 생성할
때 그 재료가 프롬프트에 함께 딸려간다는 이점이 있지만, `monetized_blog`
article 자체가 WordPress에 올라가는 것은 아니다(article 본문을
직접 WordPress로 보내는 경로는 `/articles/[id]`의 "고급 기능"으로
분리된 보조 기능이다). article 고급 기능과 wordpress_blog 게시
준비는 **같은 UI 컴포넌트**(`WordPressPublishingPanel`)를 쓰지만
`targetType`이 다르다 — article은 "대상: 원본 article" + "보조
기능"/"고급 기능" 배지, wordpress_blog는 "대상: wordpress_blog" +
"기본 게시 흐름" 배지로 명확히 구분된다. 자세한 내용은
[`article-blog-wordpress-workflow.md`](./article-blog-wordpress-workflow.md)
참고.

article 고급 기능의 WordPress 게시 준비(WordPress Metadata/SEO Plugin
Metadata/대표 이미지)는 "WordPress 게시 준비 자동 실행" 버튼 한 번으로
자동 생성된다 — 사용자는 검토/승인 중심으로 작업하면 된다. SEO Plugin
Metadata는 기본 Rank Math 기준으로 생성되고, 대표 이미지는 자동 생성을
시도하되 비활성화되어 있거나 실패하면 자동으로 "이미지 없음으로 진행"
상태(waiver)가 적용되어 WordPress Draft 반영을 막지 않는다. 실제 공개
게시는 자동 실행되지 않는다. 자세한 내용은
[`phase-2-20-article-wordpress-publish-preparation-automation.md`](./phase-2-20-article-wordpress-publish-preparation-automation.md)
참고.

`answerSummary`/`eeatNotes`/`geoSummary`/`structuredDataSuggestions`는
**`monetized_blog` article 모드에서도 별도 구조화 필드로 저장되지
않는다** — AI 생성 시점에만 존재했다가 article.content 본문 텍스트
안에 자연어로 녹아들 뿐이다(`lib/ai/article-writer.ts`의
`GeneratedArticle` 참고, `app/dashboard/actions.ts`가 article을
저장할 때도 이 필드들은 `modeFields`에 전달하지 않는다). 즉
article_mode와 무관하게 article에는 이 정보가 전혀 남지 않는다.

그래서 **`wordpress_blog` 글 자신이 이 정보를 새로 만든다**
(`lib/social/wordpress-blog-metadata-generator.ts`). `wordpress_blog`
글 생성 시(mock 또는 실제 AI) 자신의 title/body/excerpt로부터
`seoTitle`/`metaDescription`/`targetKeyword`/`secondaryKeywords`/
`searchIntent`/`readerPersona`/`answerSummary`/`eeatNotes`/
`geoSummary`/`structuredDataSuggestions`/`adSlots`/`monetizationScore`/
`policyRiskScore`를 만들어 `social_posts.platformMetadata`(기존 JSON
필드, 새 컬럼 없음)에 저장한다. article에 이미 `seoTitle`/
`metaDescription`/`targetKeyword`/`secondaryKeywords`/`monetizationScore`/
`policyRiskScore` 값이 있으면(주로 monetized_blog 모드) 생성 시점에
참고용으로 재사용하지만, `answerSummary`/`eeatNotes`/`geoSummary`/
`structuredDataSuggestions`는 article에 원천적으로 없으므로 항상
wordpress_blog 자신이 새로 만든다.

**SEO metadata 업데이트 단계에서는 article 값으로 대체하지 않는다.**
wordpress_blog 자신의 `platformMetadata`에 seoTitle/metaDescription/
targetKeyword가 없으면 업데이트를 차단하고 "SEO Metadata 재생성"
사용을 안내한다(`updateWordPressSeoMetadataFromBlogPost`). `policyRiskScore`는
wordpress_blog 자신의 값을 우선 사용하고, 없으면 원본 article의
값으로 대체하며, 임계값(70)을 넘으면 readiness에 warning을 추가한다.

## `wordpress_blog`(플랫폼) 글쓰기 원칙 — SEO/AEO/GEO/E-E-A-T 문제 해결형 블로그

`wordpress_blog` 글의 AI 생성 프롬프트(`prompts/social/wordpress-blog.md`)는
단순히 "긴 SEO형 글"이 아니라 **SEO(검색 유입) + AEO(직접 답변) +
GEO(생성형 AI 검색 이해성) + E-E-A-T(신뢰성)를 함께 고려한 문제
해결형 블로그 글**을 목표로 한다. `monetized_blog` article 모드의
정의(이 문서 상단 "정의" 참고 — 독자 문제 해결이 최우선, SEO는 보조
수단)와 같은 철학을 wordpress_blog 플랫폼 프롬프트에도 반영했다.

- **SEO**: 검색 의도에 맞는 제목/소제목/구조, keyword stuffing 없는
  자연스러운 targetKeyword 반영.
- **AEO**: 도입부 바로 뒤에 "먼저 결론부터 보면"/"핵심만 정리하면"
  섹션으로 직접 답변, 본문과 연결된 FAQ.
- **GEO**: `geoSummary`(directAnswer/keyFacts/caveats)를 metadata뿐
  아니라 본문 구조(결론 섹션/핵심 사실/주의점 섹션)에도 반영. AI 검색
  노출을 보장하는 표현은 절대 쓰지 않는다.
- **E-E-A-T**: Experience(독자 상황 이해, 허위 경험담 금지)/
  Expertise(조건·절차·예외의 구조적 설명)/Authoritativeness(공식
  출처 중심, 근거 없는 권위 표현 금지)/Trustworthiness(사실과 해석
  구분, 확인 필요 사항 명시)를 각각 구분해서 반영한다.

본문 작성 전에 **contentBrief**(핵심 질문/검색 의도/topicType/
SEO·AEO·GEO·E-E-A-T 반영 전략 등)를 먼저 정리하고, article 내용을
보고 `topicType`(policy_support/how_to/comparison/explainer/
checklist/update_news)을 판단해 그에 맞는 섹션 구조를 고른다. 출처에
없는 신청 기간/금액/기관명/조건 등은 추측해서 채우지 않고 "공식
안내에서 확인해야 합니다"로 분리한다. `platform_metadata`에는 기존
필드에 더해 `topicType`/`titleCandidates`/`contentBriefSummary`/
`missingInformationWarnings`를 추가로 생성할 수 있고, `eeatNotes`는
experience/expertise/authoritativeness/trustworthiness 4개 하위
항목으로 구분해서 채운다 — 모두 기존 `platform_metadata`(JSON) 안에
저장하므로 **DB schema 변경이 없다**.

이 원칙을 어겼는지(상투적 도입부, 초반 결론 부재, 근거 없는 권위
표현, AI 검색 노출 보장 표현, 공포 조장 표현, FAQ 부재)는
`lib/social/social-quality-gate.ts`의 `runSocialPostQualityGate()`가
wordpress_blog 전용 rule-based 검사 항목(`wordpress_blog_non_generic_opening`
등 7개)으로 자동 확인한다 — 상투적 도입부/근거 없는 권위/AI 노출
보장/공포 조장 표현이 있으면 `needs_revision`으로 처리된다.

### source-grounded blog reconstruction — article rewrite가 아니다

**`wordpress_blog`는 article을 단순 변형(rewrite)하는 글이 아니라,
`article_sources`/source summaries를 근거로 독자 문제 해결 순서에
맞게 새로 재구성한 블로그 글이다.** article은 topic context(주제/
맥락/기존 관점 파악용)이고, sources가 factual basis(조건/절차/
수치/기간/기관명/예외/주의점/FAQ의 실제 근거)다 — 이 구분은
`prompts/social/wordpress-blog.md`에 명시적인 원칙 문장으로
들어가 있다.

- **source 충분성에 따라 처리 방식이 달라진다(3단계 모드,
  `lib/social/wordpress-blog-source-mode.ts`)**: usable source가
  0개(`no_source`)면 생성 자체를 차단하고(`NO_SOURCE_BLOCKED_MESSAGE`),
  1개(`single_source`)면 **생성을 허용**하되 `single_source_mode`로
  작성하며, 2개 이상(`multi_source`)이면 목표 길이(2,500~4,000자)로
  온전히 재구성한다. 신청 기간/금액/조건/기관명/절차는 출처 없이
  추측해서 채우지 않는다.
  - **single_source_mode(usable source 1개)**: 예전에는 usable
    source가 1개뿐이면 경고만 남기고 진행했지만, 별도의 명시적 모드로
    분리했다 — article은 topic context로만 쓰고, 단일 출처의 summary/
    key points만 factual basis로 쓴다. 비교할 대상이 출처에 없으면
    비교표 대신 체크리스트를 쓰고, 부족한 정보는 본문에 "확인 필요
    사항" 섹션으로 반드시 분리한다. FAQ는 출처에 근거한 질문만
    포함한다. 저장되는 `platform_metadata`에는 `sourceMode:
    "single_source"`, `usableSourceCount: 1`, `singleSourceMode: true`,
    `sourceLimitWarning`(고정 안내 문구)이 서버에서 직접 계산되어
    저장된다(AI 응답을 신뢰하지 않고 덮어쓴다).
- **본문 길이/깊이 기준(모드별로 다르다)**:
  - **multi_source(usable source 2개 이상)**: `post_body`의 목표
    길이는 **2,500~4,000자(metadata 제외, 본문만 기준)**다. 시스템이
    허용하는 절대 최소 안전선은 1,800자
    (`lib/social/social-quality-gate.ts`의
    `WORDPRESS_BLOG_MIN_ACCEPTABLE_BODY_LENGTH`)이며, 1,200자 미만은
    "article 개요만 우려낸 얕은 글"일 위험이 커서 quality gate가
    별도로 `wordpress_blog_body_depth` 항목으로 `fail` 처리한다.
  - **single_source(usable source 1개)**: 출처가 하나뿐인 한계를
    감안해 목표 길이를 **1,800~3,000자**, 최소 허용 기준을
    **1,500자**로 완화한다
    (`WORDPRESS_BLOG_SINGLE_SOURCE_MIN_ACCEPTABLE_BODY_LENGTH`). 또한
    "확인 필요 사항" 섹션이 없으면 `wordpress_blog_single_source_verification_needed_section`
    항목이 `fail` 처리되고, usable source가 1건이라는 사실 자체는
    항상 `wordpress_blog_single_source_notice`(warning)로만 남는다 —
    **single source 하나만으로는 절대 `blocked`가 되지 않는다.**
  - 어느 모드든 길이를 늘리기 위해 출처에 없는 사실을 지어내지
    않는다.
- **`SOCIAL_AI_MAX_TOKENS` 기본값을 3000 → 6000 → 12000으로 올렸다**
  (`lib/social/social-ai-generation-config.ts`) — wordpress_blog는
  post_body(목표 2,500~4,000자)에 더해 seoTitle/metaDescription/
  answerSummary/eeatNotes/geoSummary/titleCandidates 등 metadata까지
  같은 JSON 응답에 담아야 한다. 6000/8000으로도 실제 재생성 검증에서
  응답이 중간에 잘려(`stop_reason: "max_tokens"`) JSON 파싱에
  실패하는 사례가 나와(실측: post_body 4,603자 기준 outputTokens
  7,961) 12000으로 상향했다. `lib/social/social-ai-client.ts`는 이제
  이 경우를 "AI 응답이 max_tokens 제한에 도달해 중간에 잘렸습니다"로
  명확히 구분해 알려준다. 다른 플랫폼은 이 값을 상한으로만 쓰고
  실제 출력 길이는 각자의 프롬프트가 스스로 짧게 유지하므로 영향이
  없다.
- **개인정보 노출 검사(PII_PATTERN)가 기관 대표번호를 오탐하던 문제를
  고쳤다** — 실제 검증 중 "제주도청 주택토지과: 064-710-4252" 같은
  **공개된 기관 문의처**가 `\d{3}-\d{3,4}-\d{4}` 패턴에 걸려 "개인정보
  노출 의심"으로 전체 글이 `blocked`(quality gate) 및 계약 위반(contract
  validator) 처리되는 문제를 발견했다. 이제 휴대전화 형식은 `010-`로
  시작하는 번호만 의심하고(`lib/social/social-output-contract-validator.ts`,
  `lib/social/social-quality-gate.ts`), 주민등록번호 형식(`\d{6}-\d{7}`)
  검사는 그대로 유지한다 — 정책/지원사업 안내 글에 흔한 기관 대표번호는
  E-E-A-T 관점에서 오히려 남겨야 할 정보다.
- `platform_metadata`에는 `sourceUsageSummary`(사용한 sources와
  목적 요약)/`sourceCoverageScore`(본문 근거의 sources 뒷받침
  비율)/`articleRewriteRisk`(article 재작성처럼 보일 위험)/
  `sourceGroundedDepth`(sources 기반 재구성 깊이)도 추가로 생성할
  수 있다.

**이 원칙은 `wordpress_blog` 플랫폼 프롬프트에만 적용된다** —
`naver_blog` 프롬프트, `source_based_explainer`/`general_news` article
생성 로직, 실제 WordPress publish 로직은 이번 개선에서 변경하지
않았다.

### SEO Metadata 반영 차단과 개인정보 false positive override

SEO Plugin Metadata 반영(`writeWordPressBlogSeoPluginMetadata`)은
`quality_status=ready` + `approval_status=approved` + 금지 표현
없음을 요구한다. 개인정보(주민등록번호/전화번호 형식) 의심 표현이
있으면 기본적으로 차단하는데, 실제로는 "제주도청 주택토지과:
064-710-4252" 같은 **공공기관 대표번호**가 오탐되는 경우가 있다.

- **차단 사유는 wordpress_blog 카드의 "WordPress 반영" 탭에서 상세히
  확인할 수 있다**(차단 사유 목록/의심 위치 목록을 `<details>`로
  펼쳐 본다).
- **의심 항목이 실제 개인정보가 아니면** 사람이 사유를 입력하고
  "개인정보 아님으로 확인"할 수 있다. 확인 기록은
  `social_posts.platformMetadata.manualSafetyReview.
  prohibitedExpressionOverride`(status="confirmed_false_positive",
  reason, confirmedAt, confirmedBy, items, contentFingerprint)에
  저장된다 — **DB schema 변경 없이 기존 JSON 컬럼만 사용한다.**
- **override 허용 조건**: approval_status가 approved이고, 개인정보
  의심 이외의 다른 차단 사유가 없고, 확인 당시 감지된 항목의 지문이
  현재 내용과 일치해야 한다(본문이 바뀌면 재확인 필요).
- **override 불가 조건(절대 예외 없음)**: 주민등록번호 형식
  (`\d{6}-\d{7}`) 또는 010 휴대전화 형식(`010-XXXX-XXXX`)으로 보이는
  값이 하나라도 남아 있으면 — 이런 값은 애초에 "개인정보 아님"으로
  확인 자체가 불가능하다. 광고 클릭 유도/공포 조장 등 다른 금지 사유가
  있어도 override 불가.
- **원문은 절대 로그/metadata에 남기지 않는다** — 항상 마스킹된 값만
  저장한다(예: `010-1234-5678` → `010-****-****`, `064-710-4252` →
  `064-***-****`, 주민등록번호는 전부 마스킹).
- 이 override는 **WordPress Draft의 SEO metadata 반영 + Draft 생성/
  업데이트에만** 적용된다 — public publish 로직은 전혀 건드리지 않는다.
  `checkWordPressBlogPublishReadiness()`의 `ready` 값 자체는 바꾸지
  않고, 호출하는 쪽(`writeWordPressBlogSeoPluginMetadata`,
  `createWordPressDraftFromBlogPostAction`/
  `updateWordPressDraftFromBlogPostAction`의 공통 헬퍼
  `resolveWordPressBlogDraftReadiness`)이 override 자격을 추가로
  판단한다. Step 6(게시 가능 상태 확인)의 판정 텍스트도 같은 자격을
  반영해 "준비됨"으로 바뀔 수 있지만, **그 위의 공용 Publish Guard
  배지(다른 플랫폼과 공유하는 `platform-publishing-guard-service.ts`
  기준)는 override와 무관하게 그대로 동작**한다 — "게시 가능 상태
  확인" 버튼을 다시 눌러야 그 배지가 갱신된다.
- `naver_blog` 등 다른 플랫폼이 공유하는
  `lib/social/platform-publishing-rules.ts`의 개인정보 판정 로직은
  전혀 수정하지 않았다 — 이 override는
  `lib/social/wordpress-blog-personal-info-review.ts`(wordpress_blog
  전용 파일)에서만 동작한다.
- 관련 로그 이벤트: `wordpress_blog_safety_review_opened`,
  `wordpress_blog_personal_info_false_positive_confirmed`,
  `wordpress_blog_safety_override_requested`,
  `wordpress_blog_safety_override_applied`,
  `wordpress_blog_seo_metadata_update_blocked`,
  `wordpress_blog_seo_metadata_update_allowed_with_override`.

실제 WordPress로 전송되는 title/content도 `wordpress_blog` 글
자체의 `post_title`/`post_body`다 — article 원문(`article.title`/
`article.content`)을 사용하지 않는다.

### post_body(markdown) → WordPress 전송용 HTML 변환

wordpress_blog는 내부적으로 markdown으로 생성될 수 있다(prompt가
h2/h3/표/목록/FAQ 구조를 markdown 문법으로 작성하도록 지시한다).
내부 저장/검토 단계(카드 화면의 markdown 미리보기, quality gate 등)
에서는 이 markdown을 그대로 유지해도 되지만, **WordPress에 전송할
때는 반드시 HTML로 변환한다** — 그렇지 않으면 WordPress 공개
화면에 `## 먼저 결론부터 보면`, `| 구분 | 대상 |` 같은 markdown
문법이 그대로 노출되어 글 완성도가 떨어진다.

- 변환 유틸: `convertMarkdownToWordPressHtml()`
  (`lib/wordpress/markdown-to-wordpress-html.ts`, `markdown-it` +
  `sanitize-html` 사용). h2/h3/h4/p/ul/ol/li/table/colgroup/col/
  thead/tbody/tr/th/td/strong/em/a/blockquote/code/pre/br/hr만
  허용하고, `script`/`iframe`/`on*` 이벤트 속성은 모두 제거한다.
  `style` 속성은 원칙적으로 금지하되, 표 관련 요소(`th`/`td`의
  `text-align`, `col`의 `width`)에 한해 **제한된 값만** 예외적으로
  허용한다(AI가 만든 임의의 style은 여기 없는 속성이라 전부
  제거된다). 모든 링크에는 `rel="nofollow noopener noreferrer"`를
  강제한다.
- **표(table) 가독성 개선(WordPress 공개 화면 대응)**: 렌더링된
  모든 `<table>`에 자동으로 다음을 적용한다 — width:100%/
  border-collapse:collapse/table-layout:fixed, th·td border(1px)/
  padding(12px)/vertical-align:top/word-break:keep-all/
  overflow-wrap:break-word, thead 배경색, tbody 짝수 행 zebra
  배경, 가로 스크롤 가능한 반응형 래퍼(`overflow-x:auto`, 모바일
  대응). 열 너비는 `<colgroup>`으로 지정한다 — 4열 표(지원정책
  비교표의 전형적 형태: 구분/대상/지원 내용/신청 기한)는 **16%/
  28%/34%/22%** 권장 폭을, 그 외 열 개수는 균등 폭을 적용한다.
  이 스타일은 WordPress 테마 CSS에 의존하지 않고 인라인으로 직접
  채워 넣으므로 테마가 무엇이든 항상 같은 모양으로 보인다.
- **표 셀 안의 `<br>`은 예외적으로 보존된다**(짧은 2~3개 항목을
  한 셀에 나열할 때만 사용 권장). 그 외 raw HTML은 여전히
  `html:false`로 escape된다 — 표 셀에 목록(`<ul><li>`) 같은
  블록 요소를 넣는 것은 지원하지 않는다(보안 트레이드오프로
  의도적으로 제외했다 — 필요하면 `<br>` 구분 나열을 사용한다).
- **표는 "핵심 비교 요약" 용도로만 사용한다** — 각 셀은 1~2문장 또는
  `<br>` 구분 2~3개 항목 이내로 제한하고, 긴 설명/예외/주의사항은
  표 아래 별도 본문 섹션으로 분리한다(prompt에 명시).
- post_title이 이미 별도 필드로 전송되므로, 본문 안의 최상위
  h1(`# 제목`)은 h2로 낮춘다(중복 제목 방지). `## `/`### `는 그대로
  유지된다.
- AD_SLOT marker(`<!-- AD_SLOT: ... -->`)는 변환 전에 고유
  placeholder로 분리했다가 sanitize 이후 그대로 복원한다 — 렌더링/
  sanitize 과정에서 사라지거나 사용자에게 보이는 문장으로 바뀌지
  않는다.
- 호출 지점: `buildWordPressBlogContentOverride()`
  (`lib/social/wordpress-blog-content-override-builder.ts`)가
  `createWordPressDraftFromBlogPostAction`/
  `updateWordPressDraftFromBlogPostAction`(app/articles/[id]/actions.ts)
  과 오케스트레이터(`prepareWordPressBlogPostForPublishing`, "WordPress에
  반영하기") 양쪽에서 공통으로 사용된다 — 한쪽만 변환을 잊는 일이
  없도록 로직을 한 곳으로 합쳤다.
- **SEO Metadata만 업데이트하는 action(`updateWordPressSeoMetadataFromBlogPost`)은
  이 변환을 거치지 않는다** — 본문 content 자체를 건드리지 않기
  때문이다.
- 이미 markdown 원문으로 Draft가 생성/공개된 글은, 같은
  wordpress_blog post를 다시 "WordPress Draft 업데이트"하면 HTML로
  변환된 본문으로 교체할 수 있다(public publish는 하지 않는다 —
  draft 내용만 갱신된다). 카드 화면에 이 사실을 안내하는 문구를
  추가했다.
- `naver_blog`(markdown_copy export)나 article 고급 기능
  (article.content를 그대로 전송하는 기존 경로)에는 이 변환을
  적용하지 않았다.

SEO metadata 업데이트/대표 이미지 준비·연결/WordPress Draft 생성·
업데이트는 모두 `/articles/[id]/blog`의 wordpress_blog 카드 안
("WordPress 게시 준비"/"대표 이미지 준비" 섹션)에서 처리한다 —
article 페이지로 이동할 필요가 없다. 대표 이미지 연결은 WordPress
Draft(post ID)와 WordPress media ID가 모두 준비돼야 가능하며, media
ID는 이 카드 안에서 (A) 직접 입력하거나 (B) 내 컴퓨터의 이미지
파일을 선택해 WordPress Media Library에 업로드해 준비한다(article
원본 기준 featured image 준비 흐름과는 구분된다). media ID를 준비하지
못했다면 사유를 선택해 "대표 이미지 없이 진행"할 수도 있다 — 이
경우 media ID 미준비는 blocker가 아니라 warning으로 취급된다.
naver_blog 카드에는 이 WordPress Media 업로드/waive 기능이 없다.

## `source_based_explainer`와의 차이

| | `monetized_blog` | `source_based_explainer` |
| --- | --- | --- |
| 목적 | 독자의 문제를 해결하는 실용 콘텐츠 (SEO/AEO/GEO로 발견성 보강) | 여러 출처를 종합한 해설 기사 |
| 핵심 산출물 | answerSummary/eeatNotes/geoSummary + AD_SLOT 구조 | thesis 중심 7기능 구조 + sourceUsage |
| 수익 요소 | AD_SLOT marker(실제 코드 아님), monetizationScore | 없음 |
| 신뢰성 프레임 | E-E-A-T(경험/전문성/권위성/신뢰성) 명시적 자가 점검 | 출처 기반 사실/해석 구분 |
| 검색 발견성 | SEO + AEO(직접 답변) + GEO(생성형 AI 검색 이해성) | 해당 없음 |

## E-E-A-T 기준

- 이 글은 수익화 목적이 있더라도 독자의 문제 해결과 신뢰성을
  최우선으로 한다.
- **존재하지 않는 경험, 후기, 전문가 자격, 조사 결과를 만들어내지
  않는다.** "직접 사용해봤다", "전문가가 검증했다", "조사 결과
  밝혀졌다" 같은 표현은 실제 근거가 있을 때만 쓴다.
- 출처에서 확인 가능한 사실과 작성자의 해석을 구분한다.
- 의료/금융/법률/안전/공공정책(YMYL) 주제에서는 단정적 조언을
  피하고, 확인이 필요한 사항과 일반적 판단 기준을 제시한다.
- 독자가 스스로 판단할 수 있도록 비교 기준, 주의점, 한계, 확인
  방법을 제공한다.

`eeatNotes`(`experience`/`expertise`/`authoritativeness`/
`trustworthiness`)는 이 기준에 대한 모델의 자가 점검 메모다. 각
항목은 **실제 근거가 있을 때만 채우고, 없으면 비워둔다** —
`parseEeatNotes()`가 빈 문자열/공백만 있는 값을 걸러내 지어낸
근거처럼 보이지 않도록 한다. DB에는 저장하지 않는다(결과 객체에만
포함).

## SEO 기준 (보조 수단)

- targetKeyword는 seoTitle/도입부/주요 heading 일부에 자연스럽게
  포함하되, secondaryKeywords와 함께 반복(keyword stuffing)하지
  않는다.
- metaDescription은 120~160자 내외.
- heading은 검색엔진보다 독자가 이해하기 쉬운 방향으로 구성한다.
- 제목은 클릭 유도력은 있되 과장·낚시·허위 기대를 만들지 않는다.

코드 레벨 보강: `assessMonetizedBlogQuality()`가 targetKeyword가
본문 1000자당 8회 넘게 등장하면 `keyword_stuffing_suspected` 경고를
남긴다(자동 삭제/수정하지 않음 — 검토 신호일 뿐).

## AEO(Answer Engine Optimization) — answerSummary와 독자 친화성의 하이브리드 구조

- `answerSummary`(2~4문장)로 독자의 핵심 질문에 직접 답한다. 결론을
  먼저 제시하고 조건/예외가 있으면 함께 표시한다.
- `answerSummary`는 title/content와 마찬가지로 **필수 필드**다 —
  없으면 `generateMonetizedBlogAiDraft()`가 즉시 오류를 던진다
  (title/content 누락 시와 동일한 검증 수준). **AEO/GEO 평가와
  내부 검증에는 이 필드를 계속 사용한다.**
- **다만 content(본문)를 answerSummary로 바로 시작하지 않는다.**
  일반 블로그 독자에게 도입부 없이 결론부터 나오는 글은 보고서식·
  AI 답변식으로 느껴질 수 있어, **본문에서는 도입부를 먼저
  배치하고, 그 직후에 answerSummary 내용을 "짧은 핵심 답변"
  섹션으로 자연스럽게 풀어서 제시**한다. 이는 독자 친화성과
  AEO/GEO 이점(직접 답변, 결론 우선 제시)을 동시에 살리는 하이브리드
  구조다.
- 도입부는 독자의 상황/문제의식에서 시작해 왜 이 주제가 중요한지
  설명하고, 이 글이 무엇을 정리할지 안내한다. 과장·클릭베이트·
  광고성 표현은 쓰지 않으며, targetKeyword는 자연스럽게 포함하되
  반복하지 않는다.
- 짧은 핵심 답변 섹션의 heading은 "## 먼저 결론부터 보면", "## 핵심만
  정리하면", "## 이 글의 핵심", "## 짧게 정리하면", "## 결론부터
  말하면"처럼 자연스러운 표현 중에서 고르며, "## 무조건 이것만
  보세요"처럼 클릭베이트가 섞인 heading은 프롬프트에서 명시적으로
  금지한다.
- 코드 레벨 안전망: `ensureCoreAnswerInContent()`가 본문에 이미
  허용된 핵심 답변류 heading(`CORE_ANSWER_HEADING_PATTERN`)이 있으면
  모델이 자연스럽게 반영한 것으로 보고 그대로 둔다. 없으면 도입부
  섹션이 끝나는 지점(도입부 heading을 못 찾으면 본문 초반 대략적인
  위치)에 기본 heading("## 핵심만 정리하면")과 answerSummary 원문으로
  fallback 섹션을 삽입한다 — **본문 전체를 answerSummary로 시작하게
  만들지 않는다.**
- answerSummary가 400자를 넘으면 `answer_summary_too_long` 경고를
  남긴다(직접 답변은 간결해야 한다는 신호).
- FAQ는 본문 내용을 보완하는 실제 질문/답변만 담고, 본문에 없는
  내용을 새로 지어 답하지 않는다.

## GEO(생성형 AI 검색 이해성) — geoSummary

- 각 섹션은 독립적으로 읽어도 의미가 통하도록 작성한다.
- 결론을 먼저 제시하고 근거·예외를 뒤에 설명한다.
- `geoSummary.keyFacts`(3~5개)는 출처에 있는 사실만, `geoSummary.
  caveats`(2~4개)는 주의점/한계/예외를 담는다.
- **"AI Overview에 노출", "검색 1위 보장", "AI가 반드시 인용" 같은
  검색/AI 노출 보장 표현은 절대 사용하지 않는다** — 프롬프트의
  절대 금지 목록에 명시되어 있다.
- `geoSummary`가 응답에 없거나 형식이 어긋나면 `{ directAnswer: "",
  keyFacts: [], caveats: [] }`로 안전하게 처리한다(생성 자체를
  막지 않음). DB에는 저장하지 않는다.

## structuredDataSuggestions — 후보 제안일 뿐

`Article`/`BlogPosting`/`FAQPage`/`HowTo` 중 하나만 허용하며, 그 외
값은 `parseStructuredDataSuggestions()`가 걸러낸다. **실제 schema
markup(JSON-LD)을 생성하지 않는다** — 이후 사람이 검토해 실제
적용 여부를 판단할 수 있는 "제안"일 뿐이다. DB에는 저장하지 않는다.

## AD_SLOT marker 삽입 방식 개선

기존에는 빠진 marker를 항상 본문 끝에 이어붙였다. 이제
`ensureAdSlotMarkers()`가 heading을 단서로 삼아 의미 있는 위치에
삽입한다.

| marker | anchor 키워드(heading) | 삽입 위치 |
| --- | --- | --- |
| `after_summary` | 핵심 요약/요약 박스/summary | 해당 섹션 끝 |
| `after_intro` | 도입부/들어가/서론/intro | 해당 섹션 끝 |
| `mid_content_1` | 핵심 정보/본문 내용/정보 | 해당 섹션 끝 |
| `mid_content_2` | 비교 | 해당 섹션 끝 |
| `before_faq` | FAQ/자주 묻는 | 해당 heading 직전 |
| `before_conclusion` | 결론/마무리/정리하며 | 해당 heading 직전 |

**하이브리드 구조(도입부 → 짧은 핵심 답변 → 핵심 요약 박스) 반영**:
`after_summary`의 anchor는 "핵심 답변"이 아니라 **"핵심 요약/요약
박스"**로 좁혔다 — 짧은 핵심 답변 섹션이 도입부 뒤에 먼저 오고,
핵심 요약 박스는 그 다음에 오므로, `after_summary`가 짧은 핵심 답변
바로 뒤가 아니라 핵심 요약 박스 뒤에 배치되도록 한 것이다.
`after_intro`는 도입부 섹션이 끝나는 지점(= 짧은 핵심 답변 섹션
시작 직전)에 배치되어 "도입부와 짧은 핵심 답변 사이"에 자연스럽게
들어간다.

anchor heading을 찾지 못하면 본문 내 대략적인 위치 비율(marker마다
다름, `after_intro`는 15%로 가장 이르게 잡아 도입부 직후에 가깝게
배치)에서 가장 가까운 문단 경계(빈 줄)에 삽입한다 — 6개 marker를
본문 끝에 몰아넣지 않는다. 이미 marker가 정확히 1회 존재하면 그대로
두고, 2회 이상 중복되어 있으면 첫 번째만 남기고 나머지는
제거한다(`dedupeMarkerOccurrences()`) — **각 marker는 항상 최대
1회만 등장**한다.

## 실제 광고 코드 방지 (2중 방어)

1. **프롬프트**: "실제 AdSense 스크립트나 광고 코드를 절대 작성하지
   마세요", "광고 위치는 반드시 HTML 주석 marker만 사용하세요"를
   명시.
2. **코드**: `stripDisallowedAdCode()`가 `<script>...</script>`,
   `<iframe>...</iframe>`, `adsbygoogle`, `googlesyndication`,
   `data-ad-client`, `data-ad-slot` 패턴을 생성 직후 제거한다 —
   프롬프트만으로 100% 보장되지 않는 부분에 대한 마지막 방어선이다.

## monetizationScore / policyRiskScore

- `monetizationScore`(0~100)는 기존과 동일하게 검색 수요, 문제
  해결성, 비교/구매 의도, 콘텐츠 확장성, 광고 적합성, 장기 검색
  가능성, 경쟁 강도, 정책 위험도를 종합한다. **높은 점수가 과장
  표현이나 허위 수익 약속을 써도 된다는 의미가 아니라는 문구를
  프롬프트에 명시**했다.
- `policyRiskScore`(0~100, 높을수록 위험)에 위험 요소를 추가했다:
  허위 E-E-A-T 표현, YMYL 단정 조언, AI 검색 노출 보장 표현, 본문과
  불일치하는 FAQ, 키워드 반복, 실제 광고 코드.
- 코드가 `policyRiskScore >= 70`이면 `qualityWarnings`에
  `policy_risk_high`를 남긴다. **자동으로 차단/수정하지 않으며,
  최종 게시 여부는 항상 사람이 판단한다.**

## qualityWarnings — 검토 신호(차단 아님)

`assessMonetizedBlogQuality()`가 생성 직후 계산하는 경량 후처리
점검이다. 어떤 항목도 자동으로 콘텐츠를 수정하거나 생성 자체를
막지 않는다.

| code | 의미 |
| --- | --- |
| `answer_summary_too_long` | answerSummary가 400자 초과 |
| `policy_risk_high` | policyRiskScore가 70 이상 |
| `keyword_stuffing_suspected` | targetKeyword가 본문 1000자당 8회 초과 등장 |
| `ad_slot_marker_count_invalid` | 특정 AD_SLOT marker가 1회가 아니게 등장(정상 흐름에서는 발생하지 않아야 함) |

## eval 기준 — `evals/monetized-blog.eval.yaml`

기존 10개 기준(검색 의도 적합성, 클릭 가능성, 과장/허위 여부,
체류시간 구조, 요약 박스, 비교표/체크리스트, FAQ 품질, 내부 링크,
광고 슬롯 위치, AdSense 정책 위험도)은 그대로 유지했다. 아래 5개를
추가했다:

| 기준 | 가중치 | 성격 |
| --- | --- | --- |
| `eeat-trustworthiness` | 0.12 | 가중 평균 + gate (3점 미만이면 `passed=false`) |
| `answer-summary-quality` | 0.06 | 가중 평균만 |
| `geo-clarity` | 0.05 | 가중 평균만 |
| `keyword-naturalness` | 0.05 | 가중 평균만 |
| `ymyl-risk` | 0.10 | 가중 평균 + gate (4점 이상이면 `passed=false`, adsense-policy-risk와 같은 패턴) |

`lib/ai/eval-article.ts`의 `EvalConfig.scoring`에
`eeat_trustworthiness_min_threshold`(미만이면 실패, 기존 risk-gate와
방향이 반대)와 `ymyl_risk_fail_threshold`(이상이면 실패, 기존
`policy_risk_fail_threshold`와 같은 방향)를 추가하고,
`applyGateConditions()`가 이 두 값을 함께 확인한다. 이 evaluator는
`monetized_blog` 전용이 아니라 **모든 모드가 공유하는 generic
evaluator**이므로, `general_news`/`source_based_explainer`의 yaml에는
이 필드가 없어 영향받지 않는다.

## 이번 개선에서 하지 않은 것

- `source_based_explainer`, `general_news` 모드와 그 프롬프트는
  변경하지 않았다.
- social-writing 프롬프트(`prompts/social/*.md`)는 변경하지 않았다.
- DB 스키마는 변경하지 않았다 — `answerSummary`, `eeatNotes`,
  `readerQuestions`, `geoSummary`, `structuredDataSuggestions`,
  `qualityWarnings`는 모두 `GeneratedArticle` 결과 객체에만
  존재하며, 저장 로직(`saveDraftArticle`)은 그대로다.
- 실제 AdSense 코드/스크립트는 생성하지 않으며, 생성돼도 코드가
  제거한다.
- `article.contract.yaml`에 새 규칙을 추가하지 않았다 — sourceUsage/
  structuredDataSuggestions처럼 형식 유효성은 이미 코드 레벨
  파싱에서 보장되고, keyword stuffing/FAQ 일치성처럼 의미적인
  판단이 필요한 항목은 eval 기준(`keyword-naturalness` 등)과
  qualityWarnings로 다뤘다(중복 방지).

## WordPress 전송 시 본문 형식 (Phase 2-21)

`monetized_blog`도 `content`가 Markdown으로 생성되므로, WordPress
Draft 생성/업데이트 시 다른 article mode와 동일하게 HTML로 변환되어
전송된다(mode별 분기 없이 공통 처리). 상세는
[`phase-2-21-article-wordpress-markdown-to-html.md`](./phase-2-21-article-wordpress-markdown-to-html.md)
참고.

## 이미 기사초안이 있을 때 재생성 (Phase 2-22)

`monetized_blog`는 AI가 스스로 `citedSourceIds`를 결정하며, 인용 출처가
`article.contract.yaml`의 `min-linked-sources`(최소 3개)를 만족하지
못하면 기사초안이 저장되지 않는다 — 이 경우 화면에 오류 메시지가
표시된다(과거에는 무반응이었다). 또한 이미 이 테마로 생성된 기사가
있는 상태에서 다른 mode로 다시 생성하려 하면, 조용히 덮어쓰지 않고
확인 배너("취소"/"새 초안으로 생성")를 먼저 보여준다. 상세는
[`phase-2-22-article-generation-regeneration-confirmation.md`](./phase-2-22-article-generation-regeneration-confirmation.md)
참고.

## WordPress Draft 반영 승인 조건 (Phase 2-23)

`monetized_blog`(및 다른 모든 article mode)를 WordPress Draft로
반영하려면 `article.status`가 `reviewed`여야 한다 — `/articles/[id]`
개요 페이지에서 "승인하기"를 눌러야 한다. 이 프로젝트에는 별도의
`approved` 상태가 없다: "검토 완료"와 "승인"은 "승인하기" 버튼 하나로
동시에 처리되는 단일 게이트다. 자동 게시 준비 흐름(WordPress
Metadata/SEO/이미지/Quality Gate 자동 준비)은 이 승인 상태를 절대
자동으로 바꾸지 않는다 — 사람이 직접 승인해야 한다. 상세는
[`phase-2-23-wordpress-draft-approval-status-clarity.md`](./phase-2-23-wordpress-draft-approval-status-clarity.md)
참고.

## 수익형 블로그 구조 강화 (Phase 2-24)

`monetized_blog`는 뉴스 요약이 아니라 독자 상황별 판단 기준을 제공하는
글이어야 한다. WordPress 전송본은 반드시 HTML이어야 하며(Phase 2-21),
본문은 독자 문제 중심 도입부 → 먼저 결론 → 핵심 요약 박스
(`<div class="summary-box">`) → 표(최소 1개) → 독자 상황별 영향 →
확인 체크리스트 → 주의점/예외 → FAQ(최소 4개) → 최종 요약 → 참고한
자료 → 기준일 안내를 기본 구조로 한다. 금융·경제·정책·제도 글은
수치의 기준일과 출처를 반드시 표시한다. 상세는
[`phase-2-24-monetized-blog-structure-enhancement.md`](./phase-2-24-monetized-blog-structure-enhancement.md)
참고 — 이 개선은 `monetized_blog`(article mode)와 `wordpress_blog`
(social post platform) 양쪽 프롬프트에 모두 적용됐다.

## article context로서의 역할 (Phase 3-21)

사용자 화면에서는 `monetized_blog`를 포함한 모든 article mode를
"최종 게시물"이 아니라 **출처 기반 원고 context**로 안내한다 — article
은 WordPress 블로그/네이버 블로그/네이버 카페/X/Threads/Instagram 글을
만들기 위한 기반 자료로 쓰인다. `monetized_blog`는 그중 "수익형
블로그에 적합한 article context"로 정리된다. 내부 구조(article_mode
컬럼, 상태 모델)는 변경하지 않았다. 상세는
[`phase-3-21-platform-generation-flow.md`](./phase-3-21-platform-generation-flow.md)
참고.

## 관련 문서

- 운영 매뉴얼: [`phase-3-operation-manual.md`](./phase-3-operation-manual.md)
- `source_based_explainer` 개선: [`article-generation-source-based-explainer.md`](./article-generation-source-based-explainer.md)
- WordPress 전송 Markdown→HTML 변환: [`phase-2-21-article-wordpress-markdown-to-html.md`](./phase-2-21-article-wordpress-markdown-to-html.md)
- 기사초안 재생성 무반응 방지: [`phase-2-22-article-generation-regeneration-confirmation.md`](./phase-2-22-article-generation-regeneration-confirmation.md)
- WordPress Draft 반영 승인 조건 명확화: [`phase-2-23-wordpress-draft-approval-status-clarity.md`](./phase-2-23-wordpress-draft-approval-status-clarity.md)
- 수익형 블로그 구조 강화(요약 박스/표/체크리스트/FAQ/기준일): [`phase-2-24-monetized-blog-structure-enhancement.md`](./phase-2-24-monetized-blog-structure-enhancement.md)
- "테마 → 출처 → 플랫폼별 글 생성" 흐름 재정의: [`phase-3-21-platform-generation-flow.md`](./phase-3-21-platform-generation-flow.md)
- 사용자 플랫폼 UI "행동 중심" 정리(진행 단계/상태 문구 번역): [`phase-3-22-user-facing-status-simplification.md`](./phase-3-22-user-facing-status-simplification.md)
- 대시보드 "작업 흐름 중심 화면" 재구성(플랫폼별 글 생성 섹션 신설): [`phase-3-23-dashboard-workflow-ui.md`](./phase-3-23-dashboard-workflow-ui.md)
- 프롬프트 요약: [`../prompts/articles/monetized-blog.md`](../prompts/articles/monetized-blog.md)
