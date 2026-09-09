# Phase 3-27: "관련 기사 URL 수집" 결과 요약 + 다음 행동 UI

## 배경

`/themes/[themeId]`의 "관련 기사 URL 후보 수집" 버튼은 실행 결과를
전혀 보여주지 않았다. `app/themes/[themeId]/actions.ts`의
`collectCandidates(themeId)`는 `{success, message, data}` 결과 객체를
반환했지만, 실제로 버튼을 누르는 `page.tsx`의 form action은 이렇게
되어 있었다.

```tsx
<form action={async () => {
  "use server";
  await collectCandidates(themeId); // 반환값을 그냥 버린다
}}>
```

`revalidatePath`만 실행되고 결과는 어디에도 표시되지 않으니, 버튼을
눌러도 페이지가 조용히 다시 그려질 뿐이었다 — 몇 건을 찾았는지, 실패
했는지조차 알 수 없는 "무반응" 상태였다.

## 핵심 설계 결정

### 1. 결과를 버리지 않는다 — redirect + query string

이 프로젝트는 이미 `app/articles/[id]/actions.ts`의 여러 action이
"처리 → `revalidatePath` → 결과를 query string에 담아 redirect"
패턴을 쓰고 있다. `collectCandidates`를 여기 맞춰 다시 썼다.

- 반환형을 `Promise<ThemeActionResult>`에서 `Promise<void>`로 바꾸고,
  top-level form action이 직접 받을 수 있도록 `FormData`를 인자로
  받는다(`themeId`/`trigger` hidden input).
- 처리 후 `redirect(`/themes/${themeId}?collectStatus=...&collectNew=...&collectDup=...#collection-result`)`로
  끝난다. `page.tsx`는 이 query를 읽어 결과 카드를 그린다.

### 2. 새 저장소를 만들지 않는다

수집 결과는 DB에 저장하지 않는다. redirect query가 "방금 실행한
결과"를 전달하는 유일한 통로이고, 페이지를 새로고침하면(또는 결과
없이 직접 URL로 들어오면) 결과 카드 자체가 사라진다 — 이건 의도된
동작이다(과거 실행 결과를 잘못된 최신 상태로 오인시키지 않는다).
DB schema는 전혀 바꾸지 않았다.

### 3. 성공/부분 성공/결과 없음/실패를 정확히 구분한다

기존 `collectArticleUrlCandidates()`는 저장된 후보 배열만 반환했고,
"검색은 됐는데 새로 저장할 게 없는 경우"와 "검색 자체가 실패한
경우"를 구분할 방법이 없었다(둘 다 결과가 0건일 수 있다). 반환 타입을
`ArticleUrlCollectionResult`로 넓혔다.

```ts
interface ArticleUrlCollectionResult {
  saved: ArticleUrlCandidate[];       // 이번에 새로 저장된 후보
  totalFound: number;                 // 이번 검색으로 찾은 전체(중복 포함 이전) 후보 수
  duplicateCount: number;             // 찾았지만 이미 있어서 저장 안 한 수
  attemptedTaskCount: number;         // 실제 API 검색 시도 횟수(mock/키 미설정이면 0)
  failedTaskCount: number;            // 그중 실패 횟수
}
```

- `attemptedTaskCount === 0`(키 미설정) 또는 `failedTaskCount >= attemptedTaskCount`
  (시도한 검색이 전부 실패)면 여전히 예외를 던진다 → **실패**.
- 그 외에 결과가 0건이면 예외를 던지지 않고 빈 결과를 반환한다 → 호출자가 **결과 없음**으로 판단.
- `failedTaskCount > 0`이지만 일부는 성공해서 새로 저장된 게 있으면 → **부분 성공**.
- 실패 없이 새로 저장된 게 있으면 → **성공**.

이 판단은 `app/themes/[themeId]/actions.ts`의 `collectCandidates`가
한다(서비스는 숫자만 돌려주고, "성공/부분성공/결과없음/실패" 라벨은
action이 결정한다 — 화면 문구를 만드는 책임을 분리했다).

### 4. 공통 컴포넌트로 분리 — `RelatedUrlCollectionResultCard`

`components/sources/related-url-collection-result-card.tsx`(신규,
서버 컴포넌트)가 결과 요약 + 다음 행동 버튼을 전담한다. 지금은
`/themes/[themeId]` 한 곳에서만 쓰지만, "관련 기사 URL 수집" 버튼은
이 페이지에만 있으므로(`app/dashboard/page.tsx`에는 이미 Phase 3-23-2
에서 중복 버튼을 제거하고 `/themes/[themeId]`로의 링크만 남겨뒀다)
다른 화면에 이 버튼을 추가할 때 그대로 재사용할 수 있게 만들었다.

버튼 클릭이 서버 로그(`related_url_collection_add_more_clicked` 등)를
남겨야 하므로, "추가로 기사 URL 수집"/"이 정도로 충분합니다"/"글 생성
단계로 진행"/"대시보드로 돌아가기" 버튼은 순수 `<Link>`가 아니라 각각
전용 server action에 연결된 `<form>`이다. "수집한 URL 확인"/"직접 URL
추가"는 로그가 필요 없는 단순 이동이라 `<Link>`(페이지 내 앵커 또는
대시보드 딥링크)로 남겼다.

### 5. 제출 중 상태 — `PendingSubmitButton`

서버 액션은 응답이 올 때까지 버튼이 그대로 눌린 채로 남을 수 있다.
`components/ui/pending-submit-button.tsx`(신규, `"use client"`)가
`useFormStatus()`로 감싸는 `<form>`의 pending 상태를 읽어 버튼을
disabled로 바꾸고 "관련 기사 URL을 수집하고 있습니다..." 같은 문구로
바꾼다. 페이지/폼 자체는 서버 컴포넌트로 남고, 이 버튼 하나만
클라이언트 컴포넌트다 — 이 프로젝트가 이미 `ConfirmSubmitButton`
(`app/articles/[id]/confirm-submit-button.tsx`)에서 쓰던 "최소
클라이언트 래퍼" 패턴을 그대로 따랐다.

## 사용자 흐름

```
[관련 기사 URL 후보 수집] 클릭
        │  버튼이 "관련 기사 URL을 수집하고 있습니다..."로 바뀌고 disabled된다
        ▼
collectCandidates(formData)  — related_url_collection_started 로그
        │
        ├─ 성공(신규 저장 > 0, 실패 검색 없음)
        ├─ 부분 성공(신규 저장 > 0, 일부 검색 실패) — related_url_collection_partial_success 로그
        ├─ 결과 없음(신규 저장 0) — related_url_collection_no_results 로그
        └─ 실패(예외) — related_url_collection_failed 로그
        │
        ▼
redirect(`/themes/${themeId}?collectStatus=...#collection-result`)
        ▼
RelatedUrlCollectionResultCard 렌더링
  - 상태별 문구 + 새로 찾은/중복/누적 등록/누적 제외 건수
  - 현재 출처 상태(등록 수/본문 수집 완료/요약 완료, summarizeSourceStatus 재사용)
  - "더 많은 관련 기사를 찾아볼까요?" → [추가로 기사 URL 수집] [이 정도로 충분합니다]
  - 다음 작업: 출처 충분 → [글 생성 단계로 진행]이 primary
             출처 부족 → [추가로 기사 URL 수집]이 primary
             결과 없음+신규 0 → [직접 URL 추가]가 primary
```

"이 정도로 충분합니다"를 누르면 `finishUrlCollection`이
`related_url_collection_finished_by_user`를 기록하고
`collectStatus=finished`로 돌아온다 — 이 상태에서는 숫자 요약 대신
"이제 글 생성을 진행할 수 있습니다." 안내와 [글 생성 단계로 진행]/
[대시보드로 돌아가기]만 보여준다.

## 대시보드 복귀 / 글 생성 단계 이동

- **대시보드로 돌아가기**: `goDashboardFromUrlCollection`이 로그를
  남기고 `/dashboard?themeId=${themeId}`로 이동한다 — 항상 내부
  경로만 사용한다(외부 URL redirect 없음).
- **글 생성 단계로 진행**: `goGenerateFromUrlCollection`이 로그를
  남기고 `/dashboard?themeId=${themeId}#generate-draft`로 이동한다.
  `#generate-draft` 섹션은 대시보드에 이미 `tabIndex={-1}` +
  `focus:outline` 스타일로 존재하는 영역이라(Phase 3-23-4), article이
  있든 없든 같은 섹션으로 이동해서 그 상태에 맞는 내용(생성 폼 또는
  이미 생성된 원고 요약)을 보여준다 — 별도 분기를 새로 만들지 않았다.
- **직접 URL 추가**: `/dashboard?themeId=${themeId}#source-url-input`로
  이동한다. 이 필드는 대시보드의 기존 "+ 출처 추가" 폼(Phase 1-23)
  안에 있다 — 이 페이지에 새 입력 폼을 만들지 않고 기존 폼을
  재사용한다.

## 로그 이벤트

`lib/repositories/log-repository.ts`의 `LogEventType`에 9개를
추가했다: `related_url_collection_started`/`completed`/`failed`/
`no_results`/`partial_success`/`add_more_clicked`/`finished_by_user`/
`go_dashboard_clicked`/`go_generate_clicked`. 모두 `themeId`와 요약
숫자(found/saved/duplicate/attempted/failed task count)만 `details`에
남기고, API key/토큰/raw API 응답/기사 본문 전체는 남기지 않는다.

기존 서비스 계층 이벤트(`article_url_collection_started`/`completed`/
`failed`, Phase 1-13)는 그대로 유지했다 — 이름도 의미도 다르다
(서비스가 "무엇을 했는지" vs 이 phase의 이벤트는 "사용자가 화면에서
무엇을 눌렀는지").

## raw 데이터 미노출

`RelatedUrlCollectionResultCard`는 후보 배열이나 API 응답을 그대로
렌더링하지 않는다 — `newCount`/`duplicateCount`/`candidateCounts`
같은 숫자와, 상태별로 미리 정의된 한국어 문구(`STATUS_HEADLINE`/
`STATUS_DESCRIPTION`)만 사용한다. 기존 후보 목록(`CandidateCard`)도
그대로 유지했다 — 개별 후보의 제목/플랫폼/상태 배지만 보여주고 raw
JSON은 없다.

## 영향받지 않는 것

- `importCandidatesToSources`(후보 선택 → sources 등록)와
  `dismissCandidate`(후보 제외)는 전혀 건드리지 않았다.
- mock 모드(`ARTICLE_SEARCH_ENABLED` 미설정)의 후보 생성 로직은
  그대로다 — `attemptedTaskCount`/`failedTaskCount`가 항상 0이라
  "성공" 또는 "결과 없음"으로만 분류된다(mock은 API 실패 개념이 없다).
- 자동 public publish, 외부 URL로의 redirect는 추가하지 않았다.
- DB schema는 전혀 바꾸지 않았다.

## 테스트

- `lib/article-search/article-search-service.test.ts`(신규, 6개):
  mock 모드 신규/중복 계산, 실제 API 모드에서 전체 실패 시 예외,
  키 미설정 시 예외, 일부 실패(부분 성공) 시 예외 없이 카운트만
  반영, 전체 성공 시 `failedTaskCount === 0`.
- `app/themes/[themeId]/actions.test.ts`(신규, 10개, 정적 소스
  검사): `collectCandidates`가 FormData를 받는 top-level action인지,
  4가지 상태를 모두 계산하는지, 필요한 로그 이벤트를 남기는지, 모든
  redirect가 내부 경로만 쓰는지.
- `app/themes/[themeId]/page.test.ts`(신규, 9개): PendingSubmitButton
  사용, 결과 카드 렌더링과 props 전달, `collectStatus` 값 검증,
  `hasCollectedCandidates` 전달, raw JSON 미노출.
- `components/sources/related-url-collection-result-card.test.ts`
  (신규, 10개, 정적 소스 검사): 상태별 문구, 결과 숫자, 다음 행동
  버튼 전부 존재, primary action 분기 로직, raw 데이터 미노출.
- 전체 `npx vitest run`: 220 files / 2756 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만 존재.
- `npm run lint`: 0 오류.
- `npm run build`: 성공.

## 관련 문서

- [`phase-1-13-article-url-candidates.md`](./phase-1-13-article-url-candidates.md) — 이 기능이 원래 만들어진 phase, "현재 한계" 항목을 이번에 갱신했다
- [`phase-3-operation-manual.md`](./phase-3-operation-manual.md) — `/themes/[themeId]` 섹션 신설
- [`ui-ux-governance-rules.md`](./ui-ux-governance-rules.md)
