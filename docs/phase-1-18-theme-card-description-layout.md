# Phase 1-18: 공통 테마 후보 카드 제목/설명 레이아웃 개선

## 증상

`/trends`의 "공통 테마 후보" 카드에서 제목/설명 영역이 카드 폭을 충분히
쓰지 못하고, 설명문이 좁은 column 안에서 단어 중간에 잘려 보였다.

예: "인공지능 기술, 서비스, 규제, 스타트업 등 AI 분야 전반의 최신
동향"이 "인공지능 기술, 서 / 비스, 규제, 스타트 / 업..."처럼 세로로
잘려 보였다.

## 원인

`ClusterCard`(`app/trends/page.tsx`)의 헤더가 `flex items-start
justify-between` row 안에 **제목과 설명문을 함께** 넣고, 그 옆에 점수
column(`shrink-0`)을 두는 구조였다:

```tsx
<div className="flex items-start justify-between gap-2">
  <div className="min-w-0 flex-1">
    <h3>{representative.title}</h3>
    <p>{representative.description}</p>  {/* 설명문이 제목과 같은 좁은 column 안에 있었다 */}
  </div>
  <div className="shrink-0 text-right">{representative.score}</div>
</div>
```

`min-w-0 flex-1` 자체는 올바르게 남은 폭을 차지하지만, 그 안에 제목과
설명문이 함께 들어 있어 점수 column 폭만큼 항상 좁아진 상태로
설명문까지 렌더링됐다 — 게다가 `break-keep`(word-break: keep-all)이
적용되어 있지 않아 한국어 단어가 중간에서 끊겼다.

## 조치

`ClusterCard`를 다음과 같이 재구성했다(`app/trends/page.tsx`):

1. **헤더 row에는 제목 + 점수만** 남긴다(`min-w-0 flex-1` 제목 /
   `shrink-0` 점수). 설명문은 헤더 밖으로 뺐다.
2. **설명문은 헤더 바로 아래, 별도 `<p>`로 이동**하고
   `w-full max-w-none break-keep leading-relaxed`를 적용해 카드 전체
   폭을 자연스럽게 사용하게 했다.
3. **한국어 텍스트에 `break-keep`을 적용**했다 — 대표 후보 제목, 설명문,
   하위 주제 태그, 병합된 후보(`MergedCandidateRow`)의 제목/하위 주제
   텍스트까지 모두 포함한다. Tailwind 4 내장 유틸리티라 별도 CSS를
   추가하지 않았다.
4. **카드 내부 섹션 순서를 정리**했다: 헤더(제목+점수) → 설명문(전체
   폭) → 상태 배지(대표 후보/기사 작성 가능/유사 후보 병합됨/daum 근거
   강도) → 태그(keywords) → 하위 주제 → 부가 지표(네이버/다음 건수,
   반복 발견, 마지막 발견 시각) → 병합된 후보 보기/근거 보기(접기) →
   기사 작성 시작 버튼. 배지/태그는 각각 `flex-wrap`인 별도 줄에 있어
   설명문 폭에 영향을 주지 않는다.

## 모바일 대응

헤더 row(`flex items-start justify-between gap-4`)는 모바일에서도
제목과 점수가 같은 줄을 유지하되, 제목이 길면 `min-w-0`이 있어 자연스럽게
줄바꿈(2줄 이상)된다. 설명문은 항상 `w-full`이라 화면 폭이 좁아져도
카드 내부 전체 폭을 그대로 쓴다. 별도 breakpoint 분기(예: 모바일에서
점수를 아래로 내리는 구조)는 필요하지 않았다 — `min-w-0 flex-1` +
`shrink-0` 조합과 `break-keep`만으로 좁은 화면에서도 잘림 없이 자연스럽게
줄바꿈된다.

## 지키지 않은 것 / 변경하지 않은 것

- 테마 생성/병합 로직(`groupThemeClustersForDisplay`,
  `upsertThemeClusters`)은 전혀 건드리지 않았다.
- "이 테마로 기사 작성 시작" action(`selectClusterAsTheme`)은 그대로다.
- DB schema/데이터 구조 변경 없음 — 순수 UI(JSX/className) 수정만
  했다.
- `/trends`의 "수집된 트렌드 후보"(raw, `CandidateRow`) 카드는 이번
  작업 대상이 아니므로 건드리지 않았다.

## 테스트

`app/trends/page.test.ts`에 정적 소스 검사를 추가했다:
- 헤더 row 안에 `representative.description`이 없는지(설명문 분리
  확인).
- 설명문이 `w-full max-w-none break-keep`으로 헤더 아래 별도 `<p>`에
  있는지.
- 제목/하위 주제 태그에 `break-keep`이 적용됐는지.
- 점수 영역이 `shrink-0`, 제목 영역이 `min-w-0 flex-1`인지.
- 카드 내부 섹션 순서(헤더 → 설명 → 배지 → 태그 → 하위 주제)가
  올바른지.
- `MergedCandidateRow`의 제목에도 `min-w-0 flex-1 break-keep`이
  적용됐는지.

`npm run lint`, `npx vitest run`(전체), `npx tsc --noEmit -p .`(기존
baseline 37개 유지), `npm run build` 모두 통과 확인.

## 후속 수정: 헤더 row의 부가 정보 분리 (Phase 1-19)

1차 수정 이후에도 "금리·경제 성장률"처럼 제목이 불필요하게 2줄로
쪼개지는 문제가 남아 있었다 — 원인은 헤더 row에 "대표 점수 · 병합 후보
7개"라는 부가 정보가 점수 라벨 자리에 함께 표시되면서, 시각적으로는
제목 폭에 영향이 없어 보여도 점수 column의 세로 높이가 늘어나고 전체
헤더가 답답해 보였기 때문이다. 추가로 손봤다:

- **헤더 row에는 제목 + 점수(숫자, "점수" 라벨)만** 남긴다. "대표 점수
  · 병합 후보 N개"는 헤더 아래 별도 `<p className="mt-1 text-xs
  text-zinc-500">`(meta line)으로 이동했다.
- 점수 영역은 `shrink-0 text-right sm:w-16`으로 폭을 작게 고정한다.
- 제목 `<h3>`에는 `min-w-0 flex-1 break-keep leading-snug`을 적용하고
  `max-w`/`truncate`/`line-clamp` 계열 클래스는 쓰지 않는다.
- **모바일 대응**: 헤더 컨테이너를 `flex flex-col gap-1 sm:flex-row
  sm:items-start sm:justify-between sm:gap-4`로 바꿔, 좁은 화면에서는
  제목 → 점수가 세로로 쌓이고(제목이 점수 폭만큼 좁아지지 않음), `sm`
  이상에서만 가로 배치로 전환된다.
- 카드 내부 순서: 헤더(제목+점수) → meta line(병합 정보) → 설명문 →
  상태 배지 → 태그 → 하위 주제 → 부가 지표 → 상세(접기) → 액션 버튼.

`app/trends/page.test.ts`에 헤더 row에 병합 문구가 없는지, meta line이
별도로 존재하는지, 점수 영역에 "점수" 라벨만 있는지, 제목 클래스에
금지 클래스가 없는지, 헤더가 `flex-col`/`sm:flex-row`인지, 섹션 순서가
올바른지 검사하는 테스트를 추가했다. `npm run lint`, `npx vitest
run`(전체), `npx tsc --noEmit -p .`(baseline 37 유지), `npm run build`
모두 통과 확인.
