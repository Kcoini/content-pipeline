# wordpress_blog 카드 UI 규칙

[`docs/ui-ux-governance-rules.md`](./ui-ux-governance-rules.md)를 `/articles/[id]/blog`의
`platform === "wordpress_blog"` 카드에 적용한 구체적인 화면 구조 규칙이다.
이 문서는 규칙만 정의한다 — 실제 구현 상세는
[`docs/article-blog-wordpress-workflow.md`](./article-blog-wordpress-workflow.md)를,
현재 구현이 이 규칙을 얼마나 만족하는지는
[`docs/ui-audit-wordpress-blog-card.md`](./ui-audit-wordpress-blog-card.md)를 참고한다.

**적용 범위**: `platform === "wordpress_blog"` social post 카드에만 적용한다.
`naver_blog`/`naver_cafe`/`x`/`threads`/`instagram` 카드나 `/articles/[id]`의
article 고급 기능에는 적용하지 않는다(각자 다른 규칙을 따를 수 있다).
article 고급 기능의 WordPress 게시 준비 자동화(별도 "WordPress 게시
준비 자동 실행" 버튼)는
[`phase-2-20-article-wordpress-publish-preparation-automation.md`](./phase-2-20-article-wordpress-publish-preparation-automation.md)를
참고한다 — 이 문서의 카드 구조 규칙과는 독립적으로 적용된 것이며,
wordpress_blog 카드 흐름과 충돌하지 않도록 설계되었다.

> 이 문서는 **화면 UI 구조**만 다룬다. wordpress_blog로 생성되는 글
> **콘텐츠 자체의 작성 원칙**(SEO/AEO/GEO/E-E-A-T 문제 해결형 블로그
> 기준이자, article rewrite가 아니라 article_sources/source
> summaries에 근거한 source-grounded blog reconstruction — 목표
> 길이 2,500~4,000자)은 `prompts/social/wordpress-blog.md`와
> `docs/article-generation-monetized-blog.md`("wordpress_blog 글쓰기
> 원칙" 절)에 정의되어 있다 — 이 UI 규칙 문서와는 별개이며, 이번
> 개선에서도 카드 UI 구조 자체는 변경하지 않았다.

## 필수 구조 — 고정 영역 + 탭

카드 하나가 너무 길어져 스크롤 부담이 커지는 문제(글 내용/미리보기/
품질검사/승인/WordPress 반영/대표 이미지/체크리스트가 전부 세로로 쌓여
있던 문제)를 해결하기 위해, **고정 영역(탭과 무관하게 항상 보임) + 탭
6개**로 나눈다(`lib/social/wordpress-blog-card-tabs.ts`).

### 고정 영역 (탭 위에 위치, 항상 보임)

1. **단계별 상태 요약** — 품질검사/승인/Draft/SEO Metadata/대표 이미지/
   게시 준비/체크리스트 7개 항목을 badge로 보여준다.
2. **다음 추천 작업** — 지금 상태 기준 다음 할 일 한 문장 + 해당 작업이
   있는 탭으로 바로 이동하는 "○○ 탭으로 이동" 버튼
   (`getTabForWorkflowStep()`이 다음 추천 작업의 step을 탭으로 변환한다).
3. **"WordPress에 반영하기" primary button** — 화면에서 가장 눈에 띄는
   단일 버튼(`prepareWordPressBlogPostForPublishingAction` 재사용).
   Draft 생성/업데이트, SEO Metadata 업데이트, 대표 이미지 연결, 게시
   가능 상태 확인을 순서대로 실행한다. **public publish는 하지 않는다**
   — 버튼 바로 아래에 "공개 게시 버튼은 누르지 않습니다"를 항상 표시한다.

### 탭 내비게이션 (고정 영역 아래, sticky)

`WORDPRESS_BLOG_CARD_TABS` 6개, 새 라이브러리 없이 기존 Tailwind
`sticky top-0`로 카드 안에서 상단에 고정된 것처럼 보이게 한다. 좁은
화면에서는 `overflow-x-auto`로 가로 스크롤된다. 각 탭 이름 옆에는
`getWordPressBlogCardTabBadges()`가 계산한 상태 badge(완료/필요/확인
필요)를 붙인다("글 내용"/"WordPress 미리보기" 탭은 정보 제공용이라
badge를 붙이지 않는다).

| 탭 | key | 내용 |
| --- | --- | --- |
| 글 내용 | `content` | wordpress_blog 제목, 본문 요약(500~800자, 전체 본문은 접어둠), 이 글 자신이 생성한 SEO/게시용 metadata(seoTitle/metaDescription/targetKeyword/secondaryKeywords/answerSummary/policyRiskScore/monetizationScore 등) |
| WordPress 미리보기 | `preview` | WordPress 게시 미리보기(제목/대표 이미지/본문/AD_SLOT/FAQ/참고자료) + WordPress 반영 데이터 요약 |
| 품질·승인 | `quality` | 검사가 많은 이유 안내 + Step 1(품질검사) + Step 2(승인) |
| WordPress 반영 | `wordpress` | 최근 WordPress 반영 결과 + Step 3(WordPress Draft) + Step 4(SEO Metadata, SEO Plugin Metadata 포함) + SEO Metadata 반영 차단/개인정보 false positive 확인 패널(차단됐거나 의심 항목이 있을 때만 표시) |
| 대표 이미지 | `image` | Step 5(대표 이미지) 전체 — 파일 선택/업로드/Media ID/연결/이미지 없이 진행 |
| 체크리스트 | `checklist` | Step 6(게시 가능 상태 확인) + Step 7(체크리스트/Handoff, 확인 필요 항목, 게시 URL 입력) |

## 추가 규칙

- **WordPress 미리보기(`preview`) 탭의 본문은 저장된 markdown 원문
  그대로 보여준다**(`##`, `| 표 |` 등 markdown 문법이 그대로 보일 수
  있다) — 실제 WordPress 전송 시에는 이 markdown이 HTML로 자동
  변환되므로 공개 화면에는 markdown 문법이 노출되지 않는다는 안내
  문구를 이 탭에 표시한다(전체 렌더링 미리보기로 UI를 바꾸는 대신,
  최소 변경으로 "전송 시 HTML로 변환됨"을 명시하는 방식을 택했다).
- **WordPress 반영(`wordpress`) 탭, Step 3(WordPress Draft)에** 기존
  Draft가 있을 때 "기존 WordPress 본문에 markdown이 그대로 표시된
  경우, Draft 업데이트를 실행하면 HTML 형식으로 교체됩니다" 안내를
  표시한다.
- primary button의 이름은 **"WordPress에 반영하기"**로 통일한다(기존
  "게시 준비 자동 실행"/"WordPress 게시 준비 일괄 실행"에서 전환).
- 이 버튼은 **public publish를 하지 않는다** — 어떤 상황에서도 WordPress에
  공개 게시 API를 호출하지 않고 draft 상태로만 반영한다.
- 개별 단계 버튼(탭 안의 버튼)은 primary button과 구분되는 보조 버튼
  스타일로 둔다. primary button은 탭과 무관하게 고정 영역에 한 번만
  둔다(탭 안에 다시 중복 배치하지 않는다).
- 사용자는 **wordpress_blog 카드 안에서** WordPress 게시 준비 작업을 끝낼
  수 있어야 한다 — 다른 페이지로 이동해서 처리해야 하는 작업(대표 이미지
  업로드, media ID 저장, 대표 이미지 연결, 이미지 없이 진행, 게시 URL
  기록)이 있어서는 안 된다.
- **대표 이미지 업로드 / Media ID 저장 / 연결 / 이미지 없음 진행**은 모두
  대표 이미지 탭(`image`) 안에서 처리한다.
- **게시 URL 기록**도 체크리스트 탭(`checklist`) 안에서 처리한다.
- **SEO Metadata 반영 차단/개인정보 false positive 확인 패널**(`wordpress`
  탭, SEO Plugin Metadata 섹션 바로 아래)은 "SEO Metadata 반영을
  진행하려면 먼저 확인이 필요합니다" 같은 짧은 안내만 기본 노출하고, 긴
  차단 사유 목록/의심 위치 목록은 `<details>`(접기/펼치기) 안에 둔다.
  "품질검사 다시 실행"/"승인 요청" 버튼은 이 패널 안에 새로 만들지
  않는다 — 품질·승인 탭(`quality`)의 기존 Step 1/Step 2 버튼으로
  이동하는 링크만 둔다(중복 배치 금지 규칙을 그대로 따른다).
- **개인정보 false positive override의 표시 범위**: `effectiveReady`
  (`readiness.ready || personalInfoOverrideEligibility.eligible`)는
  Step 3(WordPress Draft 생성/업데이트 버튼)와 Step 6(게시 가능 상태
  확인의 "게시 준비 상태" 문구)에서만 `readiness.ready` 대신 사용한다.
  "WordPress에 반영하기" primary button과 Step 6 상단의 Publish Guard
  배지(`workflowStatus.publishGuard`, 다른 플랫폼과 공유하는 검사)는
  override와 무관하게 그대로 `readiness.ready`/기존 로직을 따른다 —
  이 둘은 결국 공용 Publish Guard(`runPlatformPublishingGuard`)를
  다시 통과해야 하므로, 미리 풀어주면 오히려 혼동을 준다.
- **탭 이동 시 상태를 유지한다**: `articleId`/`socialPostId`/`returnTo`/
  `highlight`에 더해 `tab` query param(`?tab=image` 등)을 사용한다.
  action form들의 `returnTo`는 지금 보고 있는 탭을 포함한
  `selfReturnTo`(`buildArticleBlogUrl(id, { socialPostId, highlight,
  tab: activeTab })`)를 사용해, action 실행 후에도 같은 카드·같은 탭으로
  돌아온다.
- naver_blog 카드에는 이 문서의 어떤 UI(탭 구조 포함)도 표시하지 않는다.
  naver_blog는 기존 manual export 중심 UI를 그대로 유지한다.

## 카드 안 정보와 시스템 로그를 분리한다

카드 안에는 **사용자가 실제로 해야 하는 작업**만 남기고, 프로세스
로그/실행 이력/raw JSON details 같은 **디버그성 정보는 카드에 두지
않는다** — 페이지 최하단 "프로세스 로그 / 실행 이력" 섹션(`#process-logs`,
`docs/article-blog-wordpress-workflow.md` 참고)으로 모은다.

- **카드 안에 남기는 것**: Draft 상태, SEO Metadata 상태, 대표 이미지
  상태, 게시 준비 상태, 마지막 실행 성공/실패 **요약**(한 줄 ~ 짧은
  목록), 다음 추천 작업, WordPress에 반영하기 버튼, "상세 로그
  보기" 링크(하단 로그 섹션으로 이동).
- **페이지 하단으로 옮기는 것**: pipeline_logs 원본, 각 이벤트의
  raw JSON details, dry-run/handoff 상세 로그, 체크리스트 생성/실행
  이력 등 시스템 실행 기록 전반.
- **체크리스트는 로그가 아니다**: Step 7의 체크리스트 항목(needs_review
  확인, 확인 완료 표시, 게시 URL 입력)은 **사용자가 지금 처리해야 하는
  작업**이므로 체크리스트 탭(`checklist`)에 그대로 둔다. 반대로
  "이 action이 언제 실행됐고 성공/실패했는지"는 시스템 기록이므로
  하단 로그 섹션에 둔다.

## action 실행 결과는 toast로, persistent alert는 두지 않는다

`/articles/[id]/blog` 페이지는 action 실행 후 `?publishMessage=...`/
`?error=...` query param으로 결과 메시지를 돌려받는다. 이 메시지를
본문 중간의 큰 alert box로 계속 보여주지 않는다 — `components/ui/transient-notice.tsx`
(`TransientNotice`)로 화면 오른쪽 위에 잠깐(기본 4초) 띄웠다 자동으로
사라지게 한다(닫기 버튼도 제공, `position: fixed`라서 레이아웃을 밀지
않는다). "선택한 항목을 강조 표시했습니다." 같은, 카드 하이라이트로
이미 알 수 있는 확인 메시지는 아예 표시하지 않는다(`DeepLinkNotice`를
`found=true`일 때는 렌더링하지 않고, `found=false`—실제 경고—일 때만
사용한다). 이 규칙은 wordpress_blog 카드뿐 아니라 페이지 전체(naver_blog
포함)에 적용된다 — action 결과 전달 방식(query param) 자체는 여러
페이지가 공유하는 인프라라 이 페이지의 렌더링 방식만 바꿨다.

## 카드 안 정보는 핵심 요약 → 상세(접기) 순으로 배치한다

카드 하나 안에 제목/본문/상태/metadata/오류/버튼이 한꺼번에 노출되면
읽기 어렵다. 각 박스는 "지금 바로 봐야 하는 요약"과 "필요할 때만 보는
상세"를 분리한다.

- **기본으로 보이는 것**: 상태 badge(완료/필요/확인 필요/차단됨/실패),
  Draft/SEO/대표 이미지/게시 준비 상태, 다음 추천 작업, WordPress에
  반영하기 버튼, 현재 상태에 실제로 영향을 주는 오류(짧은 한 줄).
- **`<details>`로 접어두는 것**: seoTitle/metaDescription/targetKeyword/
  secondaryKeywords 같은 SEO metadata 전체("SEO Metadata 상세 보기"),
  media URL/업로드 상태/마지막 연결 시각 같은 대표 이미지 부가 정보
  ("대표 이미지 상세 보기"), quality_status/approval_status/
  publish_status/export_status/manual_post_status 같은 raw 내부
  상태값("내부 상태값 보기"), primary button의 긴 설명("자세히 보기").
  전부 새 라이브러리 없이 네이티브 `<details>`만 사용한다.
- **오류는 "현재 상태"와 "이전 이력"을 구분한다**: 예를 들어 대표
  이미지가 waived(이미지 없이 진행)로 처리된 상태에서 예전에 Media
  ID 연결이 실패했던 기록이 남아 있다면, 그 오류를 지금도 문제인 것
  처럼 크게 보여주지 않는다 — "참고: 이전 Media ID 연결 시도 실패
  기록 있음(현재는 이미지 없이 진행 중)."처럼 참고용으로만 짧게
  보여주고, 원문 오류 메시지는 "대표 이미지 상세 보기" 안에 둔다.
  반대로 지금 실제로 상태에 영향을 주는 오류는 짧은 빨강 경고 한 줄로
  바로 보여준다.
- **색상은 의미별로만 쓴다**: 일반 설명 문장은 muted(zinc) 색상을
  쓰고, 파란색(indigo)은 링크에만 쓴다. 성공은 초록, 확인 필요는
  노랑, 실패/오류는 빨강 badge를 쓰고, primary action 버튼에만 강한
  색상(indigo-800 배경)을 준다. 설명 문장 전체를 파란색으로 칠하지
  않는다.
- **raw internal status는 사용자에게 직접 노출하지 않는다**: `ready`/
  `approved`/`exported`/`ready_to_record` 같은 DB 원본 문자열은 상단에
  그대로 보여주지 않고, 한국어 상태(완료/승인됨/내보내기 완료/기록
  필요 등)로 변환해서 보여준다. 원본 문자열이 필요한 사람(개발자/
  관리자)을 위해서만 "내부 상태값 보기"에 그대로 남겨둔다.
- **SEO Plugin Actual Write / Custom Endpoint도 같은 원칙을 따른다
  (Phase 4-6)**: `SEO_PLUGIN_PROVIDER`/`SEO_PLUGIN_WRITE_ENABLED`/
  `WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED`/custom endpoint path 같은 env
  이름과 raw provider 값은 기본 화면에 두지 않는다. 기본 화면에는
  "SEO 정보 반영 상태" 요약(SEO 제목/메타 설명/Focus Keyword 준비
  여부, WordPress Draft 연결 여부, 반영 여부, 다음 작업, primary
  action 1개)만 두고, provider/env flag/endpoint path/마지막 시도
  raw 값과 "SEO plugin metadata 실제 반영 테스트"/"Rank Math custom
  endpoint로 SEO 반영" 같은 개발자용 버튼은 "SEO 반영 상세 보기"
  안으로 옮긴다. 기능 자체(actual write/custom endpoint)는 삭제하지
  않는다 — `lib/seo/seo-plugin-status-summary.ts`의
  `summarizeSeoPluginWriteStatus()`가 순수 함수로 상태만 재계산한다.
- **WordPress Media Upload / Connection Test도 같은 원칙을 따른다
  (Phase 4-7)**: `WORDPRESS_MEDIA_UPLOAD_ENABLED`/
  `WORDPRESS_PUBLISH_ENABLED`/base URL/`publish enabled`/`media
  upload enabled` raw 값은 기본 화면에 두지 않는다. 기본 화면에는
  "대표 이미지 업로드 상태"/"WordPress 연결 상태" 요약(현재 상태 한
  문장, Draft 생성/이미지 업로드 가능 여부, [연결 상태 확인] 버튼)만
  두고, raw env 값과 "WordPress 이미지 업로드 테스트"/"업로드 dry-run
  확인"/"업로드 상태 확인" 같은 개발자용 버튼, source type/media
  id/upload payload 같은 raw dl은 "이미지 업로드 상세 보기"/
  "WordPress 연결 상세 보기"로 옮긴다. Application Password/
  Authorization header는 접힘 안에서도 표시하지 않는다.
  `lib/wordpress/wordpress-publishing-readiness-summary.ts`의
  `summarizeWordPressPublishingReadiness()`가 연결/승인/이미지/SEO
  상태를 하나의 "WordPress 게시 준비" 요약으로 재계산한다.

## 본문 구조(post_body) 품질 기준 (Phase 2-24)

wordpress_blog 카드의 quality gate는 아래 항목을 "가산"(warning,
통과를 막지는 않음) 수준으로 확인한다 — 카드 화면에서 부족한 항목을
바로 확인할 수 있다: 핵심 요약 박스(`<div class="summary-box">`),
표(markdown table), 확인 체크리스트, FAQ 최소 4개, 자료 기준일 안내.
`post_body`는 뉴스 요약이 아니라 독자 상황별 판단 기준을 제공해야
하며, WordPress 전송본은 항상 HTML로 변환된다(Markdown 문법이 공개
화면에 그대로 노출되지 않는다). 상세는
[`phase-2-24-monetized-blog-structure-enhancement.md`](./phase-2-24-monetized-blog-structure-enhancement.md)
참고.

## 플랫폼별 글 생성 흐름과의 관계 (Phase 3-21)

wordpress_blog 카드는 여전히 `/articles/[id]/blog`에서 개별로
생성/재생성/검수한다(이 문서의 구조 규칙 그대로 적용). 다만
`/articles/[id]` 개요 페이지의 새 "플랫폼별 글 생성" 섹션에서 여러
플랫폼과 함께 처음 생성을 시작할 수도 있다 — 내부적으로는 동일한
`generateSocialDraft()`를 호출하므로 카드 구조/UI 규칙은 그대로다.
상세는
[`phase-3-21-platform-generation-flow.md`](./phase-3-21-platform-generation-flow.md)
참고.

## 카드 상태 요약과 진행 단계 표시 (Phase 3-22)

wordpress_blog 카드 상단의 원문 상태값 나열(`quality: ... · approval: ...`)은
`getUserFacingStatus`/`getNextRecommendedAction`(`lib/social/
social-post-user-facing-status.ts`) 기반의 한 줄 요약으로 바뀌었다.
원문 상태값은 삭제하지 않고 "상세 상태 보기" 접힘 안으로 옮겼다. 화면
상단에는 `ContentProgressSteps`(테마 선택 → 출처 입력 → 글 생성 →
검토/승인 → 게시 준비) 공통 진행 표시가 추가됐다. 상세는
[`phase-3-22-user-facing-status-simplification.md`](./phase-3-22-user-facing-status-simplification.md)
참고.

## "현재 상태 + 남은 작업 + 다음 버튼 1개" 원칙 (Phase 4-13)

wordpress_blog 카드 기본 화면은 여러 버튼을 나열하지 않는다. 대신
"WordPress 게시 준비" 요약 카드 하나가 현재 상태 한 줄 요약, 완료된
작업 배지, 남은 작업 목록, primary action 버튼 1개, secondary
action 0~3개를 보여준다(`getWordPressPublishPrepState`,
`lib/social/wordpress-blog-publish-prep-state.ts`). 규칙:

- 완료된 작업(품질검사/승인/Draft/SEO/대표 이미지/체크리스트)은
  버튼이 아니라 상태 배지("완료됨: ...")로만 표시한다. 특히
  `approval_status === "approved"`면 "승인" 버튼을 기본 화면에
  다시 보여주지 않는다.
- `publish_guard_status`가 `blocked`/`failed`이면 "WordPress에
  반영하기" 계열 버튼을 primary로 보여주지 않는다 — 남은 작업을
  해결하는 버튼을 primary로 둔다.
- 품질검사/승인 요청/승인/수동 내보내기/체크리스트 준비 같은
  고급·재실행용 버튼은 삭제하지 않고 "고급 작업 보기" 접힘
  영역으로 옮긴다.
- raw status(quality_status 원문 등)는 기본 화면에 나열하지 않고
  "단계별 상태 자세히 보기"/"상세 상태 보기" 접힘 안에만 둔다.
- 상단 버튼과 중간 primary 버튼의 의미가 겹치면 하나로 합친다(예:
  "승인하고 WordPress Draft 만들기"는 별도 버튼이 아니라 이 카드의
  "승인" primary action이 재사용한다).
- 상세는 [`phase-4-13-wordpress-publish-prep-simplification.md`](./phase-4-13-wordpress-publish-prep-simplification.md) 참고.

## 승인 + Draft 생성 통합 버튼 (Phase 4-10)

"승인하고 WordPress Draft 만들기" 버튼은 승인(approval_status →
approved)과 WordPress 게시 준비(Draft/SEO/대표 이미지 반영)를 한
클릭으로 처리한다. `post.approvalStatus !== "approved"`일 때만
보이고(승인 후에는 기존 "WordPress에 반영하기" 버튼만 남는다),
quality gate를 통과하지 못했거나 원본 기사가 아직 승인되지
않았으면 비활성화된다. SEO plugin 반영이나 대표 이미지 연결처럼
부가적인 단계가 실패해도 이 버튼은 실패로 표시하지 않고 "확인
필요" 상태(부분 성공)로 안내한다. 상세는
[`phase-4-10-wordpress-auto-publishing-preparation.md`](./phase-4-10-wordpress-auto-publishing-preparation.md)
참고.

## 관련 문서

- [`docs/ui-ux-governance-rules.md`](./ui-ux-governance-rules.md) — 이 문서의 근거가 되는 프로젝트 전체 규칙
- [`docs/ui-review-agent-checklist.md`](./ui-review-agent-checklist.md) — 이 구조를 실제로 만족하는지 점검하는 체크리스트
- [`docs/ui-audit-wordpress-blog-card.md`](./ui-audit-wordpress-blog-card.md) — 현재 구현이 이 규칙을 얼마나 만족하는지 점검한 결과
- [`docs/article-blog-wordpress-workflow.md`](./article-blog-wordpress-workflow.md) — Step 1~7/체크리스트 구현 상세
- [`docs/phase-2-24-monetized-blog-structure-enhancement.md`](./phase-2-24-monetized-blog-structure-enhancement.md) — 수익형 블로그 구조 강화(요약 박스/표/체크리스트/FAQ/기준일)
- [`docs/phase-3-21-platform-generation-flow.md`](./phase-3-21-platform-generation-flow.md) — "테마 → 출처 → 플랫폼별 글 생성" 흐름 재정의
- [`docs/phase-3-22-user-facing-status-simplification.md`](./phase-3-22-user-facing-status-simplification.md) — 사용자 플랫폼 UI "행동 중심" 정리
- [`docs/phase-3-23-dashboard-workflow-ui.md`](./phase-3-23-dashboard-workflow-ui.md) — 대시보드 "작업 흐름 중심 화면" 재구성
