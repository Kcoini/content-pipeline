# Phase 3-21: "테마 → 출처 → 플랫폼별 글 생성" 흐름 재정의

## 배경

초기 제품 구상은 "테마 선택 → 출처 입력 → 출처를 바탕으로 각 플랫폼에
맞는 글 생성 → 검토 → 승인 → WordPress Draft 반영 또는 수동 export/
handoff"였다. 개발 과정에서 article/blog/social/approval/export/
handoff/dry-run이 각각 별도 화면·서비스로 분리되면서, 사용자 입장에서
"내가 지금 무엇을 하고 있는지" 파악하기 어려워졌다. 이번 작업은 **내부
구조(article, social_posts, 각종 status 컬럼)는 그대로 두고**, 사용자가
보는 흐름만 원래 구상대로 명확하게 되살리는 것이 목표다.

## 1. 글 생성 흐름 재정의

사용자가 이해해야 하는 흐름을 아래처럼 압축했다:

```
테마 → 출처 → 플랫폼별 글 생성 → 검토/승인 → 게시 준비
```

`/articles/[id]` 개요 페이지에 새 "플랫폼별 글 생성" 섹션을 추가해,
이 화면 하나에서 플랫폼을 고르고 바로 생성을 시작할 수 있게 했다(기존
`/blog`, `/social` 하위 페이지는 개별 플랫폼 관리·재생성·품질검사·
승인·export/handoff 화면으로 계속 사용한다 — 없애지 않았다).

## 2. article context의 역할

article 자체의 내부 구조(article_mode: general_news/
source_based_explainer/monetized_blog, status: draft/reviewed/
published)는 그대로 유지했다(DB schema 변경 없음). 다만 사용자 화면에서는
article을 "최종 게시물"이 아니라 **"출처 기반 원고 context"**로
안내한다 — `/articles/[id]`의 새 섹션 설명 문구에 "이 article은 각
플랫폼 글을 만들기 위한 출처 기반 원고 context로 사용됩니다"라고
명시했다. article_mode 선택 자체는 기존 "계약 검사 & 기사 초안 생성"
섹션에 그대로 남아 있으며(변경하지 않음), 이번 섹션에서는 mode를 새로
강조하지 않는다.

## 3. 플랫폼별 글 생성 UI

`app/articles/[id]/page.tsx`에 새 섹션과 신규 파일들을 추가했다:

- `lib/social/platform-generation-recommendations.ts`(신규, 순수 함수):
  - `PLATFORM_LABELS`/`PLATFORM_SHORT_DESCRIPTIONS`: 플랫폼명/짧은 설명.
  - `PLATFORM_COST_LEVELS`: 예상 비용 수준(wordpress_blog=high,
    naver_blog/instagram=medium, naver_cafe/x/threads=low).
  - `getRecommendedPlatforms(topicType?)`: topicType이 없으면 항상
    `["wordpress_blog", "naver_blog", "naver_cafe"]`(Instagram/X/Threads
    제외)를 반환한다. topicType을 나중에 알 수 있게 되면(예: 이미 생성된
    wordpress_blog social post의 `platformMetadata.topicType`) 경제/생활
    정보·정책/지원금·빠른 이슈·시각적 정보 유형에 따라 조정할 수
    있도록 분기를 준비해 뒀다(economic_daily_life/policy_support/
    breaking_news/visual_checklist_tip).
  - `getRecommendedToneForPlatform(platform)`: 플랫폼별 추천 tone_style.
    새 enum 값을 추가하지 않고 기존 8종(`ToneStyle`) 중에서만 고른다 —
    naver_cafe/threads처럼 "공감형"/"대화형"으로 실제로는 다르게
    해석돼야 하는 경우, 그 해석은 해당 플랫폼 프롬프트
    (`prompts/social/naver-cafe.md` 등)가 담당한다.
- `components/articles/platform-selection-checkboxes.tsx`(신규, client
  component): 플랫폼 체크박스 + "추천 플랫폼 선택"/"전체 선택"/
  "선택 해제" 버튼. 페이지 새로고침 없이 체크 상태만 바꾸며, 실제 제출은
  감싸는 `<form>`이 처리한다.
- `lib/social/multi-platform-generation-service.ts`(신규):
  `generateSelectedPlatformPosts()`/`generateAllPlatformPosts()` —
  기존 개별 생성 함수(`generateSocialDraft`, Phase 3-2/3-3)를 순서대로
  호출하는 오케스트레이션일 뿐, 새로운 AI 호출 로직을 만들지 않았다.

## 4. 개별 생성 / 선택 생성 / 전체 생성의 차이

- **개별 생성**: 기존 `/blog`, `/social` 하위 페이지의 플랫폼별 생성
  버튼(`generateSocialDraftAction` 등, 변경 없음).
- **선택한 플랫폼 글 생성**(신규, 메인 버튼): 체크박스로 고른 플랫폼만
  대상으로 한다. `generateSelectedPlatformPostsAction` →
  `generateSelectedPlatformPosts()`.
- **전체 플랫폼 글 생성**(신규, 고급 옵션 — `<details>` 안의 secondary
  버튼): 6개 플랫폼 전체를 대상으로 한다. `generateAllPlatformPostsAction`
  → `generateAllPlatformPosts()`. 메인 버튼으로 두지 않았다.

두 경로 모두 **이미 생성된(archived되지 않은) 플랫폼 글이 있으면
기본적으로 건너뛴다** — `listSocialPostsByArticle()`로 기존 글 유무를
먼저 확인하고, 있으면 `skipped_existing`으로 표시할 뿐 조용히 덮어쓰지
않는다. 재생성이 필요하면 `/blog`, `/social` 하위 페이지의 개별 재생성
버튼을 사용해야 한다(기존 흐름, 변경 없음). 한 플랫폼이 실패해도 나머지
플랫폼 처리는 중단하지 않는다.

## 5. 전체 생성 비용 경고 처리

"전체 플랫폼 글 생성" 버튼은 기존 `ConfirmSubmitButton`
컴포넌트(`window.confirm`)를 재사용해, 클릭 즉시 아래 문구의 확인
대화상자를 띄운다:

> 전체 플랫폼 글을 생성하면 WordPress 블로그, 네이버 블로그, 네이버
> 카페, X, Threads, Instagram 글을 한 번에 생성합니다. 긴 블로그 글과
> 카드형 글이 포함될 경우 API 사용량이 증가할 수 있습니다. 필요한
> 플랫폼만 선택해서 생성하는 것을 권장합니다. 그래도 전체
> 생성하시겠습니까?

사용자가 취소하면 폼 제출 자체가 일어나지 않는다(클라이언트 단에서
막힘). 서버 액션에도 `confirmed=true` 검사를 추가해 방어적으로
이중 확인한다(JS가 비활성화된 경우 등 — 확인 없이는 절대 실행하지
않는다).

## 6. 추천 플랫폼 선택 기준

기본 추천: WordPress 블로그, 네이버 블로그, 네이버 카페.
기본 제외: X, Threads, Instagram(비용/성격상 필요할 때만 선택).

## 7. 문체/톤 선택 구조

플랫폼(어디에 올릴 글인가)과 문체/톤(어떤 방식으로 말할 것인가)을 서로
다른 축으로 분리했다. 기존 `tone_style` enum(explanatory/informational/
persuasive/warning/loss_aversion/curiosity/comparison/story)을 그대로
쓰며 새 값을 추가하지 않았다. `ToneSelectionMode`("auto_recommended" |
"same_for_all" | "manual_per_platform")로 3가지 모드를 제공하며,
기본값은 `auto_recommended`("추천 문체 자동 적용")다. 현재 UI(개요
페이지)는 auto_recommended로 고정 제출하며, "전체 동일"/"플랫폼별
수동 선택"은 서비스 레이어(`multi-platform-generation-service.ts`)와
액션 레이어에서 이미 지원한다(hidden input `toneMode`/
`uniformToneStyle`/`toneStyle_{platform}`) — 이후 UI에서 라디오
선택지를 노출하기만 하면 된다.

## 8. 플랫폼별 추천 문체

`RECOMMENDED_TONE_STYLES_BY_PLATFORM`에 플랫폼별 권장 문체 목록을
정의했다. naver_cafe는 `persuasive`/`loss_aversion`을 기본 추천에서
제외한다(`NAVER_CAFE_DISCOURAGED_TONE_STYLES`) — 광고글처럼 보이지
않게 하기 위해서다. 사용자가 수동으로 이런 tone_style을 선택해도, 실제
생성은 `prompts/social/naver-cafe.md`의 금지 표현/구조 원칙이 광고성
문구를 걸러낸다(강제 차단이 아니라 순화된 해석으로 유도).

## 9. naver_cafe plain text 처리 (변경 없음, Phase 3-20 완료)

`sanitizeNaverCafePlainText()`, quality gate 강화, 게시용 본문/관리
정보 분리는 Phase 3-20에서 이미 완료했다 — 이번 작업은 그 결과를
그대로 재사용한다(`docs/phase-3-20-naver-cafe-plain-text-cleanup.md`
참고).

## 10. wordpress_blog HTML 처리 (변경 없음, Phase 2-21/2-24 완료)

Markdown→HTML 변환, 필수 구조(요약 박스/표/체크리스트/FAQ/출처/기준일/
AD_SLOT), sanitize는 Phase 2-21/2-24에서 이미 완료했다 — 이번 작업은
건드리지 않았다.

## 11. 생성과 게시 분리 (기존 원칙 재확인)

`generatePlatformPosts()`(및 그 위의 selected/all 함수)는 `lib/publish/
wordpress-public-publish-service.ts`나 `publishWordPressPost` 같은 실제
공개 게시 함수를 **전혀 import하지 않는다**(정적 검사로 확인). 생성은
`generateSocialDraft()`만 호출하며, 이 함수는 애초에 draft 저장까지만
수행하고 실제 게시 API를 호출하지 않는다(Phase 3-2/3-3 기존 설계).
WordPress Draft 반영/공개 게시, 수동 export/handoff는 기존
`/blog`, `/social`, `/social-posts/[id]` 화면의 기존 승인 → export/
Draft 반영 흐름을 그대로 사용한다(변경 없음).

## 12. 내부 관리 정보와 게시용 본문 분리 (변경 없음, Phase 3-20 완료)

`/social-posts/[id]` 상세 페이지의 "관리 정보 보기" accordion, export/
dry-run/handoff payload에서 내부 상태값을 제외하는 처리는 Phase 3-20에서
이미 완료했다.

## 13. 버튼 무반응 방지

- `generateSelectedPlatformPostsAction`: 플랫폼을 하나도 선택하지 않고
  제출하면 `{ error: "생성할 플랫폼을 1개 이상 선택하세요." }`를
  반환한다(무반응 아님).
- `generateAllPlatformPostsAction`: `confirmed=true`가 없으면 생성을
  시도하지 않고 "비용 경고 확인 후에만 실행됩니다" 안내를 반환한다.
- 두 action 모두 항상 플랫폼별 결과 요약("wordpress_blog: 생성 완료 /
  naver_blog: 이미 생성됨 — 건너뜀 / x: 생성 실패 — 사유 ...")을
  `TransientNotice`(기존 메시지 query param 메커니즘)로 표시한다.

## 로그

`lib/repositories/log-repository.ts`에 다음 이벤트를 추가했다:
`platform_generation_single_requested`(예약 — 개별 생성 action에는
아직 연결하지 않음, 필요 시 향후 연결), `platform_generation_selected_requested`,
`platform_generation_all_requested`, `platform_generation_cost_warning_shown`,
`platform_generation_article_context_created`(예약 — article context
자동 생성 기능은 이번 범위에 포함하지 않음), `platform_generation_started`,
`platform_generation_completed`, `platform_generation_skipped_existing`,
`platform_generation_failed`, `platform_generation_tone_auto_selected`,
`platform_generation_tone_manual_selected`,
`platform_generation_public_publish_blocked`(예약 — 이 흐름은 애초에
공개 게시를 호출하지 않으므로 실제로 발생하지 않는다). `naver_cafe_plain_text_sanitized`/
`naver_cafe_quality_blocked_markdown`은 추가하지 않았다 — 표시/export
시점마다 호출되는 순수 변환 함수에 로그를 붙이면 노이즈만 커지고,
이미 `naver_cafe_no_markdown_escape` quality gate 체크리스트 항목이
같은 정보를 더 유용한 형태로 노출하기 때문이다. 로그에는 article id/
theme id/platform/tone style/status/reason/개수만 남기며, 본문 전체·
API key·raw AI 응답은 저장하지 않는다(기존 원칙 그대로).

## 영향 범위 확인

- **DB schema**: 변경 없음.
- **naver_blog/x/threads/instagram 기존 흐름**: 변경 없음(개별 생성
  action, quality gate, export 로직 모두 그대로) — 새 오케스트레이션은
  기존 함수를 그대로 호출할 뿐이다.
- **wordpress_blog 기존 Draft 반영 흐름**: 변경 없음.
- **자동 public publish**: 새 코드 경로 어디에서도 호출하지 않는다(정적
  검사로 확인).

## 테스트

- `lib/social/platform-generation-recommendations.test.ts`: 추천
  플랫폼/추천 문체/비용 수준.
- `lib/social/multi-platform-generation-service.test.ts`: 기존 글
  건너뛰기, 실패해도 나머지 진행, tone 모드 3종, 플랫폼 미선택 오류,
  전체 생성 로그.
- `lib/social/tone-selection-mode.test.ts`: 유효성 검사.
- `app/articles/[id]/page.test.ts`, `app/articles/[id]/actions.test.ts`:
  새 섹션/액션 정적 소스 검사(메인/고급 버튼 스타일 구분, 확인 모달,
  건너뛰기 안내, 공개 게시 함수 미호출).
- 전체 `npm run lint`(0 errors), `npm run test`(2525/2525 통과),
  `npx tsc --noEmit -p .`(기존 baseline 37건 유지, 신규 0건),
  `npm run build`(성공) 확인.

## 관련 문서

- `docs/phase-3-1-multi-platform-writing-foundation.md`
- `docs/phase-3-20-naver-cafe-plain-text-cleanup.md`
- `docs/phase-2-24-monetized-blog-structure-enhancement.md`
- `docs/phase-3-operation-manual.md`
- `docs/ui-ux-governance-rules.md`
