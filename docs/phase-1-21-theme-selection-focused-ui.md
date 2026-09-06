# Phase 1-21: 자동 테마 추출 화면 — "대표 테마 선택 중심 UI"

## 문제

`/trends` 화면에서:
- 왼쪽 "수집된 트렌드 후보"가 너무 촘촘하게(제목+요약문이 항상 펼쳐진
  채로) 표시됐다.
- 오른쪽 "공통 테마 후보" 카드 폭이 좁았다(`lg:grid-cols-[1fr_1.5fr]`
  이지만 좌측이 원자료였다).
- 공통 테마 카드에 하위 주제/태그/병합 후보/근거/count 정보가 한꺼번에
  펼쳐져 있어 복잡했다.
- "이 테마로 기사 작성 시작" 버튼이 다른 정보에 묻혀 눈에 잘 안 띄었다.
- 원자료 리스트와 최종 테마 후보 사이의 우선순위가 화면상 드러나지
  않았다.

## 목표

이 화면의 핵심 작업은 **"공통 테마 후보를 보고 → 기사 작성 시작"**이다.
공통 테마 후보를 우선 노출하고, 원자료/근거는 필요할 때만 열어보게
한다.

## 조치 (`app/trends/page.tsx`, UI만 변경 — 테마 생성/병합 로직·DB
schema·기사 작성 action은 변경하지 않았다)

### 1) 상단 요약 배너

헤더 바로 아래에 한 줄 요약을 추가했다:

```
수집 결과: 네이버 {counts.naver}건 · 다음 {counts.daum}건 · 공통 테마 {displayGroups.length}건 · 마지막 수집 {formatCollectedAt(lastCollectedAt)}
```

`counts`는 `lib/repositories/trend-repository.ts`의
`getTrendCandidateCounts()`(신규, count-only 쿼리 3개, 스키마 변경
없음)로 얻은 **플랫폼별 전체 누적 건수**다 — 화면에 표시되는 최근 50건
슬라이스가 아니라 실제 총량을 보여준다. `lastCollectedAt`은
`getTrendPageData()`가 표시용 candidates 중 가장 최근
`collectedAt`으로 근사한다(정확한 전역 최신값을 위한 별도 쿼리는
만들지 않았다 — 표시용 근사치로 충분하다고 판단).

### 2) 좌우 레이아웃 비율 조정 + 섹션 순서 교체

- 그리드를 `lg:grid-cols-[1fr_1.5fr]` → `lg:grid-cols-[3fr_2fr]`
  (60%/40%)로 바꿨다.
- **"공통 테마 후보" section을 "수집된 트렌드 후보" section보다 앞에
  둬서**, 첫 번째(넓은) column을 공통 테마 후보가 차지하게 했다.
- 모바일(좁은 화면)에서는 컨테이너가 `flex flex-col`이라 DOM 순서
  그대로 **공통 테마 후보가 먼저** 보인다(`lg:grid`는 `lg` 이상에서만
  적용).

### 3) 공통 테마 카드 단순화 (`ClusterCard`)

기본 표시를 아래로 제한했다:
- 테마명(제목) + 점수
- 짧은 설명
- 상태 배지(대표 후보 / 기사 작성 가능 / 유사 후보 N개 병합됨 / daum
  근거 강도)
- 네이버/다음 근거 수, 반복 발견 수, 마지막 발견 시간(한 줄)
- "이 테마로 기사 작성 시작" 버튼(카드당 유일한 primary button)

기본 화면에서 숨기고 `<details>`(기본 접힘)로 옮긴 것:
- **하위 주제 보기**: 태그(keywords) + 하위 주제(subtopics, 기본
  3개만 보이고 나머지는 그 안에서 다시 "더 보기")를 하나로 묶었다.
- **병합된 후보 보기**: 기존과 동일(변경 없음, 위치만 재정렬).
- **근거 보기**: 기존과 동일(변경 없음, 위치만 재정렬) — "왜 이
  테마가 생성됐는지"는 이 안에서 확인한다.

이전(Phase 1-19)에 헤더 아래 별도 줄로 뒀던 "대표 점수 · 병합 후보
N개" 문구는 제거했다 — 같은 정보를 "유사 후보 N개 병합됨" 배지가 이미
전달하고 있어 중복이었다. 부가 지표 줄에서 `representative.status`
pill도 제거했다 — 배지들이 이미 상태를 전달한다.

접기 영역의 `<summary>`는 모두 `text-blue-600`(secondary link
스타일)로 통일해, 배경이 있는 primary button과 명확히 구분된다.

### 4) 수집된 트렌드 후보 compact화 (`CandidateRow`)

- 전체 section을 `<details>`(기본 접힘)로 감쌌다 — 원자료는 근거
  확인용 보조 정보이므로 기본적으로 닫혀 있다.
- 각 행은 배지(naver/daum) + 제목(1줄, `truncate`+`break-keep`) +
  순위만 기본 표시하고, snippet(요약)은 "요약 보기" `<details>` 안에
  넣었다(이전에는 `line-clamp-1`로 항상 펼쳐 보였다).
- raw 데이터 자체(`candidates` 배열, `trend_candidates` 테이블)는
  전혀 삭제/변경하지 않았다 — 표시만 compact하게 했다.

### 5) 필터(전체/네이버/다음/중복 제외 등)는 이번에 추가하지 않았다

사용자 요청에 "UI 변경이 부담되면 최소한 네이버/다음 count를 보여주고,
원자료 리스트는 접기 영역으로 둔다"는 대안이 명시돼 있었다 — 인터랙티브
필터(클라이언트 컴포넌트, 상태 관리)를 새로 만드는 대신 이 대안을
택했다: 상단 요약 배너로 네이버/다음 전체 건수를 보여주고, 원자료
리스트는 기본 접힘으로 뒀다.

## 지키지 않은 것 / 변경하지 않은 것

- 테마 생성/병합 로직(`clusterTrendItems`, `upsertThemeClusters`,
  `groupThemeClustersForDisplay`) 전혀 변경하지 않았다.
- DB schema 변경 없음 — `getTrendCandidateCounts()`는 기존
  `trend_candidates` 테이블에 대한 count-only 쿼리일 뿐이다.
- "이 테마로 기사 작성 시작" action(`selectClusterAsTheme`)은 그대로다.
- raw trend/evidence 데이터는 삭제하지 않았다 — 표시 방식(compact/접기)만
  바꿨다.

## 테스트

`app/trends/page.test.ts`에 정적 소스 검사를 추가했다:
- 상단 요약 배너 문구.
- 공통 테마 후보 section이 원자료 section보다 DOM 순서상 먼저인지.
- 그리드 비율(`3fr_2fr`).
- 원자료 section이 `<details>`로 감싸져 있는지.
- `CandidateRow`가 compact한지(요약이 details 안에 있는지,
  `line-clamp`를 쓰지 않는지), `break-keep`이 적용됐는지.
- raw candidates 배열 자체는 그대로 렌더링되는지(삭제되지 않았는지).
- `ClusterCard`의 새 섹션 순서, 접기 영역이 실제로 `<details>`인지,
  summary가 secondary link 스타일인지, 중복 메타 문구가 제거됐는지.

`lib/repositories/trend-repository.test.ts`에 `getTrendCandidateCounts()`
단위 테스트(정상 집계/count null 처리/에러 전파)를 추가했다.
`lib/trends/trend-service.test.ts`에 `getTrendPageData()`가
candidates/clusters/counts/lastCollectedAt을 올바르게 반환하는지
검증하는 테스트를 추가했다.

`npm run lint`, `npx vitest run`(전체), `npx tsc --noEmit -p .`(기존
baseline 37개 유지), `npm run build` 모두 통과 확인.
