# Phase 3 Operation Manual

이 문서는 운영자가 기사 한 편을 만들어 여러 플랫폼에 수동으로
게시하기까지, 실제로 클릭하는 순서를 기준으로 정리한다. 모든 단계는
사람이 화면에서 버튼을 눌러 진행하며, 어떤 단계도 외부 플랫폼에
자동으로 게시하지 않는다.

## 운영 흐름 (전체 순서)

1. **article 생성 또는 선택** — `/dashboard` 또는 `/articles`에서
   테마 입력 → 출처 등록 → 계약 검사 → 기사 초안 생성, 또는 기존
   기사를 선택한다. 기본 생성 모드(`source_based_explainer`)는
   "출처 기반 해설 기사" 모드이며, 종합할 수 있는 출처(usable
   source)가 3개 미만이면 자동으로 mock 생성으로 전환된다 — 자세한
   내용은 [`article-generation-source-based-explainer.md`](./article-generation-source-based-explainer.md)
   참고. 수익형 콘텐츠가 필요하면 `monetized_blog` 모드(E-E-A-T/
   SEO/AEO/GEO 기준을 반영한 "문제 해결형 수익 블로그")를 선택할
   수 있다 — 자세한 내용은
   [`article-generation-monetized-blog.md`](./article-generation-monetized-blog.md)
   참고.
2. **`/articles/[id]`에서 기사 개요 확인** — 기사 본문, 상태, 하위
   워크플로우(블로그/소셜/rewrite/성과/AB테스트) 진입점을 확인한다.
3. **`/articles/[id]/blog`에서 블로그 글 관리** — WordPress/Naver
   Blog 등 블로그형 플랫폼용 글을 생성/검수한다.
4. **`/articles/[id]/social`에서 SNS/커뮤니티 글 관리** — X/Threads/
   Instagram/Naver Cafe 등 SNS·커뮤니티형 글을 생성/검수한다.
5. **quality check 실행** — 각 social post 카드의 "품질검사" 버튼.
   `quality_status`가 `ready`가 되어야 다음 단계로 진행할 수 있다.
6. **approval 요청 및 승인** — "승인 요청" 버튼으로 검토를 요청하고,
   승인권자가 승인하면 `approval_status = approved`가 된다.
7. **manual export 생성** — "Manual Export" 버튼으로 복사해서
   붙여넣을 수 있는 payload를 만든다.
8. **publishing guard 실행** — "Publishing Guard 실행" 버튼으로
   금지 표현/플랫폼별 규칙을 다시 확인한다. `platform_publish_ready`가
   true가 되어야 다음 단계로 진행할 수 있다.
9. **dry-run 생성** — "Dry-run 생성" 버튼으로 실제 게시 없이 최종
   payload 형태를 미리 확인한다.
10. **handoff 완료** — "Handoff 완료" 버튼으로 "이 글은 실제 게시
    담당자에게 넘길 준비가 됐다"는 상태로 전환한다.
11. **사람이 실제 플랫폼에 수동 게시** — export payload/dry-run
    결과를 참고해 운영자가 직접 각 플랫폼(WordPress 관리자 화면,
    X/Threads/Instagram 앱, Naver Blog/Cafe 등)에 게시한다.
12. **manual posting result 기록** — "게시 결과 기록" 버튼으로 실제
    게시 URL과 결과를 남긴다(`manual_post_status = posted`).
13. **metrics 수동 입력** — "Metrics 입력" 버튼으로 조회수/좋아요/
    댓글/공유 등을 직접 입력한다(자동 수집 없음).
14. **performance 확인** — `/articles/[id]/performance`에서 입력한
    metrics 기반 성과 점수를 확인한다.
15. **rewrite suggestion 생성** — 성과가 낮은 글에 대해
    `/articles/[id]/rewrite`에서 rewrite 제안을 생성한다.
16. **rewrite version 적용** — 제안을 적용하면 원본을 덮어쓰지 않고
    새 버전 row(`social_post_versions`)가 생성된다.
17. **version comparison 실행** — 새 버전과 원본/이전 버전의 품질을
    비교한다.
18. **reapproval/reexport 실행** — rewrite version은 재승인을 거쳐야
    재export할 수 있다(원래 승인과 별도 트랙).
19. **rewrite performance comparison 확인** — 원본과 rewrite의 실제
    성과(둘 다 수동 입력된 metrics 기준)를 비교한다.
20. **A/B test draft 생성** — `/articles/[id]/ab-tests`에서 variant를
    묶어 A/B 테스트 draft를 만든다(자동 실행 아님, 수동 게시 결과를
    각각 기록해야 비교가 의미 있다).
21. **API publish readiness 확인** — `/dashboard/platform-api`에서
    플랫폼별 API 게시 "준비 상태"만 확인한다(실제 게시 아님).
22. **automation safety review 실행** — `/dashboard/automation-safety`
    에서 feature flag/승인·가드 정합성/로깅 보안/콘텐츠 안전 규칙을
    점검한다. 실제 게시나 자동 수정 기능은 없다.

## 화면별 설명

### `/articles/[id]`
**원본 article 관리 화면.** 기사 본문, 메타데이터, 상태를 확인하고
blog/social/rewrite/performance/ab-tests 하위 페이지로 이동하는
진입점이다. WordPress Metadata/SEO Plugin/Featured Image/Connection
Test/WordPress Draft/Public Publish 등 Phase 2의 WordPress 관련
기능은 "고급 기능: 원본 article WordPress 전송"이라는 접이식
섹션에 모여 있다 — 이 경로는 article 본문을 **그대로** WordPress로
보내는 보조 기능이다.

이 섹션 맨 위에는 `/articles/[id]/blog`와 **같은 구조의 공통 UI**
(`WordPressPublishingPanel`, "대상: 원본 article" + "보조 기능"/
"고급 기능" 배지)로 품질/승인/Draft/SEO/대표 이미지/Publish Guard
상태를 한눈에 요약해 보여준다. 그 아래에는 기존 개별 기능(WordPress
Metadata/SEO Plugin/Featured Image/Connection Test/Draft/Public
Publish) 섹션이 그대로 남아 있다 — 삭제하거나 통합하지 않았다.
버튼 이름도 "원본 article Draft 생성"/"원본 article SEO Metadata
업데이트"/"원본 article 대표 이미지 연결"처럼 항상 "원본 article"
접두어를 붙여, wordpress_blog 카드의 동일 기능 버튼과 헷갈리지
않게 했다. SEO 필드가 비어 있으면 "설정되지 않음"으로 표시하며,
wordpress_blog의 추천값으로 자동 대체되지 않는다.

이 섹션 안에는 **"대표 이미지 없이 진행"** 버튼이 있다. 대표
이미지가 없어도 사유(내부 검토용 Draft/나중에 WordPress에서 수동
추가 예정/텍스트 중심 기사/적절한 이미지 없음/기타)를 선택하고
확인 문구("검색 결과 클릭률이나 공유 미리보기에 영향을 줄 수
있습니다. 계속 진행하시겠습니까?")를 확인하면, Publish Quality
Gate의 featured image 판정이 monetized_blog에서도 hard fail이
아니라 warning으로 처리된다. media ID를 입력하거나 이미지를
업로드하면 이 선택은 자동으로 해제된다. **이 waive는 원본 article
전송 전용이며, `/articles/[id]/blog`의 wordpress_blog 카드에 있는
같은 이름의 기능과는 완전히 독립적이다** — 한쪽에서 waive해도
다른 쪽에는 전혀 반영되지 않는다. 두 기능 모두 warning 처리일
뿐이며 실제 공개(publish) 게시를 의미하지 않는다.

### `/articles/[id]/blog`
**플랫폼별 블로그 게시용 글 관리 화면.** 블로그형 플랫폼
(wordpress_blog, naver_blog)의 social post를 생성/검수/승인/export/
가드/dry-run/handoff/게시결과/metrics까지 관리한다.

**WordPress 게시의 기본(메인) 경로는 이 페이지에서 `wordpress_blog`로
생성한 글이다** — article 페이지의 "고급 기능"이 아니다.
`wordpress_blog` 카드에는 article 페이지와 **같은 공통 UI**
(`WordPressPublishingPanel`, "대상: wordpress_blog" + "기본 게시
흐름" 배지)로 **"WordPress 게시 준비" 섹션**이 표시되며, 여기서
draft 생성/업데이트부터 SEO metadata 업데이트, 대표 이미지 연결까지
**article 페이지로 이동하지 않고 전부 끝낼 수 있다**:

- 상태 표시: WordPress Draft 상태/post ID/URL, SEO metadata 상태/
  seoTitle/metaDescription/targetKeyword/secondaryKeywords, featured
  image 상태/media ID/URL/attach status/waived 여부(사유 포함), publish
  guard 상태, `quality_status`/`approval_status`/`policyRiskScore`.
  seoTitle 등이 비어 있으면 "WordPress 블로그 metadata 재생성이
  필요합니다"로 표시하며, article의 SEO metadata로 자동 대체되지
  않는다. 버튼 이름은 "WordPress Draft 생성"/"SEO Metadata 업데이트"
  처럼 접두어 없이 표기해 article 쪽("원본 article ...")과 구분한다.
- **SEO/게시용 metadata 섹션**: article에는 없을 수 있는 WordPress
  게시용 정보(seoTitle/metaDescription/targetKeyword/secondaryKeywords/
  searchIntent/answerSummary/eeatNotes/geoSummary/
  structuredDataSuggestions/adSlots/monetizationScore/policyRiskScore)를
  wordpress_blog 글 생성 시 자신이 직접 만들어 표시한다 — article
  값으로 대체하지 않는다. "SEO Metadata 재생성" 버튼으로 본문은
  그대로 두고 metadata만 다시 만들 수 있다.
- **단계형 workflow UI**: 버튼을 단순 나열하지 않고 "단계별 상태
  요약"(품질검사/승인/Draft/SEO/대표 이미지/게시 준비/체크리스트
  badge) → "다음 추천 작업"(다음에 뭘 눌러야 하는지 한 줄 안내) →
  **게시 준비 자동 실행**(상단 강조 버튼, 예전 "WordPress 게시 준비
  일괄 실행") → Step 1(품질검사)~Step 7(체크리스트/Handoff)로
  구성한다. Step 1/2/7의 품질검사·승인·체크리스트 버튼은 카드
  상단의 공통 버튼(naver_blog와 공유)을 그대로 쓰고 중복 배치하지
  않는다.
- 버튼 이름 일부 변경(표시 label만, action 함수명은 그대로): "게시
  가능 상태 확인"(예전 WordPress 게시 준비 확인), "게시 전 미리보기
  생성"(예전 Dry-run 생성), "수동 게시 완료 표시"(예전 Handoff
  완료), "수동 게시용 Draft 내보내기"(예전 WordPress Draft Export,
  wordpress_blog에서만 — naver_blog는 그대로 "Naver Blog Export").
- 모든 버튼은 `quality_status='ready'` + `approval_status='approved'`일
  때만 활성화되며, disabled 상태에는 이유가 함께 표시된다(예: "SEO
  metadata가 없습니다. metadata 재생성이 필요합니다.", "승인 후
  Draft를 생성할 수 있습니다.").
- SEO Metadata 업데이트는 wordpress_blog 자신의 metadata가 없으면
  article 추천값으로 대체하지 않고 차단하며, "SEO Metadata 재생성"
  사용을 안내한다. WordPress Draft에 실제로 전송되는 title/content도
  wordpress_blog 자신의 post_title/post_body다(article 원문 아님).
- "대표 이미지 준비" 안에 실제로 동작하는 "AI 대표 이미지 생성"
  섹션이 있다 — article 이미지 생성과 같은 provider client를
  재사용하지만, 결과는 article 컬럼이 아니라 wordpress_blog
  자신의 `platformMetadata.imageGeneration`에만 저장한다(두
  targetType의 이미지 상태가 섞이지 않는다). 알려진 한계: 생성된
  이미지를 WordPress Media Library에 자동 업로드하는 연결은 아직
  없다.
- "SEO Plugin Metadata" 섹션에서 Rank Math/Yoast/AIOSEO/Custom
  Endpoint/사용 안 함 provider를 선택하고 실제 반영을 실행할 수
  있다. article과 같은 WordPress post를 대상으로 하지만(이 프로젝트는
  article 1개당 WordPress post 1개만 만드는 구조), wordpress_blog
  자신의 seoTitle/metaDescription/targetKeyword만 사용하고 결과도
  `social_posts.platformMetadata.seoPluginWrite`에만 저장해 article
  페이지의 SEO Plugin 표시와 서로 덮어쓰지 않는다.
- **실제 WordPress에 전송되는 title/content는 wordpress_blog 글
  자체의 post_title/post_body다** — article 원문이 아니다
  (`publishArticleToWordPressDraft()`의 `contentOverride` 옵션으로
  전달한다. article 페이지 "고급 기능"은 이 옵션을 넘기지 않아
  기존 그대로 article 본문을 전송한다).
- **대표 이미지 준비**: 같은 카드 안에 별도 하위 섹션으로, media ID를
  준비하는 두 가지 방법을 모두 제공한다 — (A) 이미 WordPress에
  올라간 이미지의 media ID를 직접 입력, (B) 내 컴퓨터의 이미지
  파일(JPEG/PNG/WEBP, 최대 5MB)을 선택해 WordPress Media Library에
  업로드(성공 시 media ID 자동 저장). "대표 이미지 연결" 버튼은
  WordPress Draft와 media ID가 모두 준비되고 quality/approval
  조건도 만족해야 활성화되며, 아니면 구체적인 이유(예: "대표 이미지
  media ID를 먼저 입력하세요.")를 보여준다. media ID가 없어도 "대표
  이미지 없이 진행"을 선택하면(사유 선택 필수) 게시 준비를 계속할
  수 있다 — media ID 미준비는 blocker가 아니라 warning으로
  바뀐다(다만 "대표 이미지 연결" 버튼 자체는 여전히 media ID를
  요구한다). 이후 media ID를 저장/업로드하면 이 선택은 자동으로
  해제된다.
- **이미지 파일 선택 시 업로드 전 미리보기(카드 이탈 없음)**: 파일
  선택 input은 `components/social/wordpress-featured-image-file-picker.tsx`
  (`"use client"`)가 담당한다. 파일을 고르면 다른 페이지로 이동하지
  않고 같은 카드 안에서 파일명/파일 크기/파일 형식과(허용 형식이면)
  썸네일을 바로 보여준다. 허용되지 않는 형식이거나 5MB를 넘으면
  "WordPress Media로 업로드" 버튼이 비활성화되고 이유가 표시된다.
  업로드 action 자체는 기존 그대로 `returnTo`(하이라이트 파라미터
  포함)를 유지하므로, 업로드 후에도 같은 wordpress_blog 카드
  위치로 돌아온다.
- **"게시 준비 자동 실행"의 대표 이미지 단계**: media ID가 있으면
  연결을 시도하고, media ID가 없고 "이미지 없이 진행"이 선택돼
  있으면 skipped로, 둘 다 아니면 warning으로 표시한다(중단하지
  않음). 실제 공개 publish는 이 버튼으로도 수행하지 않는다.
- **Step 7 체크리스트 상태는 저장된 pending을 그대로 보여주지
  않고, 화면에 그릴 때마다 지금 social_post 상태 기준으로 다시
  계산한다**(`lib/social/manual-posting-checklist-status.ts`). 상태는
  완료/확인 필요/대기중/차단됨/실패/생략 6가지다. Quality
  Gate/Approval/Manual Export/Publishing Guard/Dry-run/Handoff
  completed 확인 항목은 DB 상태로 자동 계산되고, "게시 후 URL 기록
  필요"류 항목은 `manual_post_url`/`post_url` 존재 여부로 계산된다.
  최종 내용 확인/이미지·링크 확인/SEO 확인처럼 사람이 직접 봐야
  하는 항목은 handoff가 완료됐어도 자동으로 완료 처리하지 않고
  기본은 "확인 필요"로 남는다. handoff가 완료됐는데 확인 필요/대기중
  항목이 남아 있으면 "일부 체크리스트 항목은 확인 필요 상태입니다."
  안내 문구가 배지 아래에 함께 표시되어, 상단 "handoff 완료"와
  아래 체크리스트 상태가 서로 모순돼 보이지 않게 한다. 체크리스트
  아코디언 요약줄에는 완료/확인 필요/대기중/실패 개수가 항상
  표시된다.
- **"확인 필요" 항목은 오류가 아니라 수동 검토임을 안내하고, 사용자가
  바로 처리할 수 있게 한다**: 체크리스트가 있으면 항상 "확인 필요
  항목은 오류가 아닙니다..." 안내 박스를 보여주고, needs_review
  항목만 먼저 카드로 모아("지금 확인이 필요한 항목") 각각 설명/할
  일 안내와 함께 보여준다(완료/대기중 항목은 "전체 체크리스트
  보기"에 접혀 있다). 사람이 직접 확인해야 하는 7개 항목(최종 내용/
  이미지·링크/정책 위반/WordPress workflow 중복/제목·본문·대표
  이미지/SEO/공개 상태 확인)에는 "확인 완료 표시" 버튼이 있다 —
  누르면 `social_posts.platformMetadata.manualChecklistConfirmations`
  (기존 JSON 필드, **DB schema 변경 없음**)에 confirmed 기록을
  남긴다(`markManualChecklistItemConfirmedAction`). Quality Gate 등
  시스템 자동 항목에는 이 버튼이 없다 — 실제 상태를 사람이 임의로
  덮어쓸 수 없다. "게시 후 URL 기록 필요" 항목에는 URL 입력 필드 +
  "게시 URL 저장" 버튼이 있는데, **새 action 없이 기존
  `recordManualPostingResultAction`(Phase 3-8)을 재사용**한다(http(s)만
  허용, 기존 검증 그대로 적용). URL이 기록되면 "게시 URL 복사"
  버튼(클라이언트 전용, 서버 저장 없음)이 나타난다. 다음 추천 작업도
  체크리스트 상태를 반영해 "확인 필요 항목 검토" → "게시 URL 기록"
  → "완료됨" 순으로 좁혀진다.

`naver_blog` 카드에는 WordPress 관련 버튼이 전혀 표시되지 않고,
기존과 동일하게 Manual Export/복사/수동 게시 결과 기록 흐름만
사용한다. 두 흐름의 차이와 알려진 한계는
[`article-blog-wordpress-workflow.md`](./article-blog-wordpress-workflow.md)에
자세히 정리했다.

### `/articles/[id]/social`
SNS/커뮤니티형 플랫폼(naver_cafe, x, threads, instagram)의 social
post를 동일한 워크플로우로 관리한다.

### `/articles/[id]/rewrite`
성과 기반 rewrite 제안 생성, 버전 적용, 버전 비교, 재승인/재export,
rewrite-vs-원본 성과 비교를 한 곳에서 처리한다.

### `/articles/[id]/performance`
기사에 속한 social post들의 수동 입력 metrics와 성과 점수를
모아 보여준다.

### `/articles/[id]/ab-tests`
원본 vs rewrite 등 variant를 묶은 A/B 테스트 draft를 만들고 상태를
관리한다(초안 구조일 뿐, 자동 게시/자동 승자 판정 실행 없음).

### `/social-posts/[id]`
social post 하나의 상세 화면. 다른 목록/대시보드에서 딥링크로
진입하는 용도로 쓰인다.

### `/dashboard/content`
article 단위로 전체 콘텐츠 상태를 모아보는 대시보드.

### `/dashboard/blog`
블로그형 social post 전체를 모아보는 대시보드.

### `/dashboard/rewrite`
rewrite 워크플로우(제안/적용/비교/재승인) 상태를 모아보는 대시보드.

### `/dashboard/social-performance`
플랫폼/문체별 성과, 차트, rewrite 비교를 모아보는 성과 대시보드.

### `/dashboard/platform-api`
플랫폼별 API 게시 "준비 상태"만 보여준다. capability matrix,
readiness, 설정 누락 여부를 확인할 수 있으며, 토큰/키 값은
표시하지 않는다. 실제 게시 버튼은 없다.

### `/dashboard/automation-safety`
전체 워크플로우에 대한 자동화 안전 점검 결과(feature flag, 승인/
가드 정합성, 로깅 보안, 콘텐츠 안전 규칙)를 보여준다. 점검 전용
화면이며 데이터를 수정하지 않는다.

## 관련 문서

- 전체 개요: [`phase-3-final-overview.md`](./phase-3-final-overview.md)
- 아키텍처: [`phase-3-architecture.md`](./phase-3-architecture.md)
- 라우트 맵: [`phase-3-route-map.md`](./phase-3-route-map.md)
- 안전 체크리스트: [`phase-3-safety-checklist.md`](./phase-3-safety-checklist.md)
- Article ↔ Blog ↔ WordPress 워크플로우: [`article-blog-wordpress-workflow.md`](./article-blog-wordpress-workflow.md)
