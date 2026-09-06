# Phase 2-22: 기사초안 재생성 무반응 방지 + article mode 전환 확인

## 문제

출처를 입력하고 기사초안을 작성한 뒤, 다시 다른 article mode(예:
`수익형 블로그형` = `monetized_blog`)를 선택하고 "기사초안생성"을 누르면
화면상 아무 반응이 없는 문제가 있었다.

## 원인 확인

`app/dashboard/actions.ts`의 `generateArticleDraft`(`/dashboard`의
"계약 검사 & 기사 초안 생성" 폼이 호출하는 Server Action)를 확인한 결과:

- 이 프로젝트에는 `app/themes/[themeId]/page.tsx`, `app/articles/actions.ts`,
  `lib/articles/article-generation-service.ts`, `lib/repositories/articles.ts`
  같은 파일이 존재하지 않는다. 실제로는 `/dashboard`
  (`app/dashboard/page.tsx` + `app/dashboard/actions.ts`)가 테마 선택 →
  출처 입력 → 기사초안 생성을 모두 담당한다.
- `saveDraftArticle()`(`lib/repositories/article-repository.ts`)은
  `theme_id`가 유일 제약이 아니라서, 같은 테마에 여러 article이 존재할 수
  있는 구조다. 기존 `status='draft'` row만 삭제하고 새로 insert하므로,
  이미 검토/승인(`reviewed`/`published`)된 기사는 남아있고, 아직 검토
  전인 draft만 교체 대상이 된다.
- **실제 원인**: `generateArticleDraft` 안에 사용자에게 아무 메시지도
  주지 않고 조용히 같은 화면으로 `redirect`하는 지점이 2곳 있었다.
  1. `source.contract.yaml`(출처 최소 3개 등) 검사 실패 시
  2. `article.contract.yaml`의 `min-linked-sources`(생성된 기사가 인용한
     출처 최소 3개) 검사 실패 시 — **이번 버그의 실제 원인**.
     `source_based_explainer`의 mock 생성기는 항상
     `sources.map((s) => s.id)`로 등록된 출처 전체를 인용 처리해 이 조건을
     항상 만족하지만, AI 모드에서는 각 mode(`general_news`/
     `source_based_explainer`/`monetized_blog`)가 자체적으로
     `citedSourceIds`를 결정한다. `monetized_blog`는
     `source_based_explainer`처럼 출처 재료 부족을 감지해 mock으로
     전환하는 안전장치(`checkSourceBasedExplainerReadiness`/
     `InsufficientSourceMaterialError`)가 없어서, AI가 실제로 인용한
     출처가 3개 미만이면 `article.contract.yaml`을 통과하지 못하고, 저장
     직전에 **아무 안내 없이** 같은 화면으로 돌아갔다. 이것이 "버튼을
     눌러도 반응이 없다"로 보인 이유다.

## 목표와 원칙 반영

- source_based_explainer/general_news/monetized_blog 전환을 모두 동일한
  로직으로 명확히 처리한다(mode별 분기 없이 공통 처리).
- article mode(`monetized_blog`)와 wordpress_blog 게시 흐름을 혼동하지
  않는다 — `generateArticleDraft`는 `lib/social/*`(wordpress_blog/
  naver_blog)를 전혀 import하지 않는다(변경 없음, 정적 검사로 확인).
- 기존 article을 조용히 덮어쓰지 않는다 — 사용자가 확인(`confirmed=true`)한
  경우에만 재생성한다.
- DB schema 변경 없음.
- 기존 출처 데이터는 변경하지 않는다(`getSourcesByThemeId` 결과 그대로 사용).
- 버튼 클릭 후 무반응 상태를 만들지 않는다.

## 조치

### 1) 무반응 지점 제거

`generateArticleDraft`의 두 silent redirect 모두 `error` 쿼리 파라미터와
함께 사용자에게 보이는 메시지를 전달하도록 고쳤다:

- 출처 계약 실패 → "출처 조건을 만족하지 못해 기사초안을 생성하지
  못했습니다 (N건). 아래 출처 계약 검사 결과를 확인하세요."
- 기사 계약(`min-linked-sources` 등) 실패 → "생성된 기사초안이 계약
  검사를 통과하지 못해 저장되지 않았습니다 (인용 출처 N개 · M건 위반).
  아래 기사 계약 검사 결과를 확인하세요."

**citedSourceIds를 임의로 채워 넣어 계약을 억지로 통과시키지 않는다** —
AI가 실제로 인용하지 않은 출처를 인용한 것처럼 조작하면 컨텐츠 정합성
문제가 생기기 때문이다. 대신 실패 사유를 명확히 보여주고, 기존
`ContractCheckResult` 박스(계약 검사 결과)에서 상세를 확인할 수 있게
한다.

### 2) 기존 article 존재 시 확인 절차 추가

`generateArticleDraft`에 `getArticleByThemeId(themeId)`로 기존 article
존재 여부를 확인하는 단계를 추가했다:

- 기존 article이 있고 `confirmed !== "true"`이면, **생성을 진행하지
  않고** `regenerateConfirm=1&pendingMode=...&existingMode=...` 쿼리와
  함께 즉시 redirect한다(계약 검사/AI 호출 전, 아무 부작용 없음).
- `/dashboard` 페이지는 이 쿼리를 보고 확인 배너를 표시한다:
  "이미 이 테마로 생성된 기사초안이 있습니다. 현재 초안: {기존 모드} ·
  선택한 유형: {선택한 모드}" + "취소"/"새 초안으로 생성" 버튼.
- "새 초안으로 생성"은 `themeId`/`articleMode`(pendingMode 그대로)/
  `confirmed=true`를 담아 같은 action을 다시 호출한다.
- **오버라이트가 위험한 초기 구현이므로 "새 초안으로 생성"만 제공한다**
  (기존 draft 덮어쓰기 버튼은 별도로 만들지 않았다) — 다만
  `saveDraftArticle()`의 기존 동작(같은 테마의 `status='draft'` row
  교체)은 그대로이므로, 확인 배너 문구에 "기존 미승인 초안(draft)은 새
  초안으로 교체됩니다(이미 검토·승인된 기사는 유지됩니다)"라고 정확히
  안내한다 — 실제로 일어나는 일과 다르게 말하지 않는다.
- mode가 기존과 같든 다르든 항상 확인을 거치되, 문구는 mode가 다를 때만
  "새로 생성하시겠습니까?" 형태로, 같을 때는 "같은 유형으로 다시 생성하면
  교체됩니다"로 구분해서 보여준다(mode 변경 감지, 요청 3).
- 첫 생성(기존 article 없음)은 확인 없이 그대로 즉시 진행된다(동작
  변경 없음).

### 3) mode 선택값 검증

`articleMode`를 더 이상 `resolveArticleMode()`로 조용히 기본값
대체하지 않는다. `isArticleMode()`로 검증해서 값이 없거나 잘못되면
"기사 유형을 선택해 주세요."라는 오류와 함께 즉시 redirect한다(요청 6).
라디오 버튼은 항상 `name="articleMode"`로 폼에 포함되므로 실제로는
거의 발생하지 않지만, 방어적으로 처리한다.

### 4) 버튼 disabled 이유 표시

"기사 초안 생성" 버튼에 `title`(hover 시 표시)과 항상 보이는 텍스트
둘 다로 이유를 표시한다:

- 출처 부족: "출처가 부족합니다 (N/3개 등록됨) — 출처를 더 등록해야
  기사초안을 생성할 수 있습니다."
- 이미 초안 존재(버튼 자체는 비활성화하지 않음 — 클릭하면 확인 배너로
  이어져야 하므로): "이미 생성된 초안이 있습니다. 다시 누르면 재생성
  여부를 먼저 확인합니다(조용히 덮어쓰지 않습니다)."

라디오 버튼의 기본 선택값도 이제 `article?.articleMode ?? DEFAULT_ARTICLE_MODE`로,
기존 초안이 있으면 그 mode를 기본으로 보여준다(사용자가 지금 뭘 보고
있는지와 폼 기본값이 어긋나지 않도록).

### 5) 출처 1개 허용(single_source_mode)이 monetized_blog에도 적용되는지 확인

**결론: 아니오, 미적용이다.** `single_source_mode`/출처 재료 부족
감지(`checkSourceBasedExplainerReadiness`, `InsufficientSourceMaterialError`)는
`lib/ai/article-writer.ts`의 `generateSourceBasedExplainerAiDraft()`
전용이며, `generateMonetizedBlogAiDraft()`/`generateGeneralNewsAiDraft()`에는
동등한 게이트가 없다. 이번 작업 범위에서는 새 게이트를 추가하지
않았다(모드별 readiness 정책을 새로 설계하는 것은 이번 "무반응" 버그
수정보다 범위가 크고, 검증 없이 성급하게 추가하면 다른 회귀를 일으킬
수 있다). 대신 위 1)번 조치로, 출처가 부족해 계약을 통과하지 못하는
모든 경우(mode 무관)에 대해 최소한 **명확한 오류 메시지**는 항상
보장한다. `contracts/source.contract.yaml`의 `min-source-count`(등록된
출처 최소 3개)는 mode와 무관하게 항상 적용되며 이번 작업에서 값을
바꾸지 않았다.

### 6) article mode와 wordpress_blog 구분

- `monetized_blog`: `article.articleMode` 값 — `generateArticleDraft`가
  생성하는 article의 글쓰기 형식이다.
- `wordpress_blog`: `social_posts.platform` 값 — 생성된 article을
  기반으로 `/articles/[id]/blog`에서 별도로 만드는 WordPress 게시용
  platform post다.

`generateArticleDraft`(`app/dashboard/actions.ts`)는 `lib/social/*`를
전혀 import하지 않으며, wordpress_blog/naver_blog 생성 로직을 호출하지
않는다(정적 소스 검사로 확인, 변경 없음).

## 로그 기록

`lib/repositories/log-repository.ts`의 `LogEventType`에 다음을 추가했다
(Phase 2-22 그룹):

- `article_generation_clicked`
- `article_generation_blocked_no_mode_selected`
- `article_generation_blocked_insufficient_sources`
- `article_generation_blocked_contract_failed`
- `article_generation_blocked_existing_article`
- `article_generation_mode_change_detected`
- `article_generation_regeneration_requested`
- `article_generation_regeneration_started`
- `article_generation_failed`

기존 `article_generation_completed`(AI 생성 직후)와 `article_draft_created`
(저장 직후) 이벤트는 그대로 두고, 전체 파이프라인이 끝났을 때도
`article_generation_completed`를 한 번 더 기록해 "최종적으로 끝났다"를
구분할 수 있게 했다. 본문 전체, API key, 출처 원문(raw response)은
로그에 저장하지 않는다(articleId/themeId/selectedMode/existingMode/
citedSourceCount/violations 개수 정도만 저장).

## UI 메시지

기존 `TransientNotice` 컴포넌트(삭제 성공/실패 메시지에 이미 사용 중)를
재사용해 성공/실패 메시지를 toast로 표시한다:

- 성공: "{mode 라벨} 기사초안이 생성되었습니다."
- 실패: 위 1)번의 구체적인 오류 메시지.

재생성 확인은 4초 후 사라지는 toast가 아니라, 사용자가 직접 선택해야
하는 영구적인 배너(취소/새 초안으로 생성 버튼 포함)로 표시한다.

## 영향 범위 확인

- **wordpress_blog**: 영향 없음(별도 파일/서비스, `generateArticleDraft`가
  참조하지 않음).
- **naver_blog**: 영향 없음(동일한 이유).
- **DB schema**: 변경 없음.
- **출처 데이터**: 변경 없음(`getSourcesByThemeId` 결과를 그대로 사용,
  삭제/수정하지 않음).

## 테스트

`app/dashboard/page.test.ts`에 정적 소스 검사를 추가했다(이 프로젝트는
Server Action이 많은 서비스를 조합하므로 전체를 mocking하기보다 기존
관례를 따라 정적 소스 검사로 확인):

- mode 미선택 시 오류 표시, 조용한 기본값 대체 금지
- 기존 article 존재 + `confirmed`가 아니면 재생성 차단(무반응 아님)
- mode 변경 감지 로그
- 출처/기사 계약 검사 실패 시 더 이상 무메시지 redirect가 없음
- citedSourceIds를 임의로 채워 넣지 않음(컨텐츠 정합성)
- 성공 시 `generated=1`/`generatedMode` 쿼리 전달
- `article_generation_clicked` 항상 기록
- 확인 배너 UI 존재
- disabled 버튼 이유 텍스트 존재
- TransientNotice로 성공/실패 메시지 표시
- wordpress_blog/monetized_blog 혼동 없음

전체 `npm run lint`(0 errors), `npm run test`(2409/2409 통과),
`npx tsc --noEmit -p .`(기존 baseline 37건 유지, 신규 0건),
`npm run build`(성공) 확인.

## 관련 문서

- `docs/article-generation-monetized-blog.md`
- `docs/phase-3-operation-manual.md`
- `docs/ui-ux-governance-rules.md`
