# Phase 1-16: 공통 테마 후보 중복 방지

## 문제

`/trends`에서 "트렌드 수집 + 공통 테마 추출"을 실행할 때마다
`clusterCommonThemes()`가 최근 `trend_candidates`를 다시 클러스터링해
`theme_clusters`에 **항상 새로 insert**했다. 즉:

- 같은 이슈(예: "AI 산업 동향")를 재수집할 때마다 매번 새 행이 쌓였다.
- 기존 `theme_clusters`와 비교하는 로직이 전혀 없었다.
- 네이버/다음에서 공백·특수문자·연도·조사 표현만 다르게 들어온 제목은
  다른 후보로 취급될 여지가 있었다(정규화 키가 없었다).
- 하위 주제(예: "신혼부부 대출이자 지원", "청년 전세이자 지원")를 담을
  필드가 없어 상위 테마와 섞이거나 버려졌다.

## 원칙 (이번 작업에서 지킨 것)

- 네이버/다음 원본 수집 결과(`trend_candidates`)는 **그대로 보존**한다 —
  중복 제거는 최종 공통 테마 후보(`theme_clusters`)에만 적용한다.
- 기존 데이터를 삭제하지 않는다. DB migration은 컬럼 추가만 한다
  (`add column if not exists`).
- 기존 테마 선택(`createThemeFromCluster`)/기사 생성 흐름은 그대로다.

## raw 후보 vs final 공통 테마 후보

| | 테이블 | 중복 제거 | 용도 |
|---|---|---|---|
| raw 후보 | `trend_candidates` | 안 함(URL 기준만 1차 제거, 수집 단계) | evidence, "근거 보기" |
| final 공통 테마 후보 | `theme_clusters` | normalizedKey + 제목 유사도 | 사용자에게 보여줄 대표 후보 |

`/trends` 화면도 이미 이 둘을 분리해서 보여주고 있었다("수집된 트렌드
후보" 컬럼 vs "공통 테마 후보" 컬럼) — 이번 작업은 이 구조를 유지하면서
"공통 테마 후보" 쪽에 중복 방지 로직만 추가했다.

## normalizedThemeKey 생성 (`lib/trends/theme-normalization.ts`)

`normalizeThemeKey(title)`:
1. trim + lowercase
2. 가운데점(·)/슬래시(/)/하이픈(-) 등 특수문자를 공백으로 통일
3. 중복 공백 제거
4. 단독 연도 토큰(`2026`, `2026년`) 제거
5. 안전하다고 판단되는 조사 접미사만 제거(2글자 이상 조사 전부, 1글자
   조사는 토큰이 3글자 이상일 때만 — 짧은 명사가 훼손되지 않도록)
6. "지원금"/"지원"/"정리"/"방법"/"조건"/"최신"/"안내" 같은 일반어 제거
   (표시용 제목에는 영향 없음, 비교 키에서만 제거)
7. 남은 토큰을 중복 제거 후 정렬해 합침 — 토큰 순서가 달라도
   (`"신혼부부 청년"` vs `"청년 신혼부부"`) 같은 키가 나온다

완벽한 형태소 분석기가 아니므로, 표현이 아예 다른 동의어(`"주거"` vs
`"주거지원"` vs `"주거비"`)까지는 하나의 키로 합쳐지지 않을 수 있다 —
그 경우는 아래 유사도 매칭이 대신 처리한다.

## 유사 후보 클러스터링(`themeTitleSimilarity`)

두 제목의 유의미 토큰 집합 기준 Jaccard 유사도(0~1)를 계산한다.
실측 예시 —

- `"제주 신혼부부·청년 주거 지원 2026"`
- `"제주 청년 신혼부부 주거지원 조건"`
- `"제주 신혼부부 청년 주거비 지원"`

세 제목 모두 상호 유사도 **0.6**으로 계산되어, 병합 임계값
`THEME_SIMILARITY_MERGE_THRESHOLD = 0.55` 이상이면 같은 후보로 병합
대상이 된다.

## 기존 DB 후보와 비교 + upsert (`upsertThemeClusters`, `lib/repositories/trend-repository.ts`)

새 후보를 저장하기 전에 기존 `theme_clusters`를 먼저 조회하고, 아래
기준으로 매칭되면 **insert 대신 update(병합)** 한다:

1. **normalizedKey가 정확히 같다** — status와 무관하게 병합한다(같은
   실제 이슈이므로 이미 선택/기각된 후보라도 evidence/발견 횟수는
   최신화한다).
2. normalizedKey는 다르지만 **status가 `candidate`인 기존 후보와 제목
   유사도가 임계값 이상이다** — 아직 사람이 판단하지 않은 후보끼리만
   퍼지 매칭한다. 이미 `selected`(테마로 채택됨)/`dismissed`(기각됨)로
   사람이 판단을 마친 후보는 퍼지 매칭으로 임의로 건드리지 않는다
   (normalizedKey가 정확히 같을 때만 병합).

병합 시 갱신되는 값: `keywords`(합집합, 최대 8개), `subtopics`(합집합,
최대 12개), `evidence`(중복 제거 후 최대 20개), `naver_count`/
`daum_count`(누적), `score`(기존/신규 중 큰 값), `seen_count`(+1),
`last_seen_at`(현재 시각). `title`은 이번 구현에서는 자동으로 더 나은
제목으로 교체하지 않는다(주관적 판단이 필요해 범위에서 제외) — 필요하면
향후 사람이 직접 대표 제목을 편집하는 기능으로 확장할 수 있다.

같은 배치(한 번의 `clusterCommonThemes()` 호출) 안에서도 in-memory로
병합 결과를 반영하므로, 한 번의 실행에서 중복 행이 여러 개 생기지
않는다.

## 하위 주제(subtopics)와 근거(evidence) 분리 (`lib/trends/theme-clusterer.ts`)

그룹(대표 테마)에 매칭된 원본 기사 중:
- **제목이 대표 테마와 정규화 키가 다른 것**만 `subtopics`로 남긴다
  (플랫폼당 최대 8개) — 같은 표현이 반복되면 정규화 키로 걸러져
  하나만 남는다.
- **evidence**는 플랫폼별 최대 3건(title/url만, 원문 전체 아님)만
  담아 "근거 보기" UI에서 확인할 수 있게 한다.

## DB 스키마 변경 (필요한 경우에만) — `db/migrations/043_theme_cluster_dedupe.sql`

`theme_clusters`에 다음 컬럼을 추가한다(모두 `add column if not
exists`, 삭제/변경 없음):

```sql
alter table theme_clusters
  add column if not exists normalized_key text,
  add column if not exists subtopics jsonb not null default '[]'::jsonb,
  add column if not exists evidence jsonb not null default '[]'::jsonb,
  add column if not exists seen_count integer not null default 1,
  add column if not exists last_seen_at timestamptz not null default now();

create index if not exists theme_clusters_normalized_key_idx
  on theme_clusters (normalized_key);
```

**unique index는 만들지 않는다** — 이 마이그레이션 이전에 이미 쌓인
중복 행이 있을 수 있어 unique 제약을 걸면 마이그레이션 자체가 실패할
수 있다. 기존 중복을 사람이 확인해 정리한 뒤 unique index 추가를
검토할 것을 권장한다(이번 작업 범위에는 포함하지 않았다 — hard delete
금지 원칙과도 맞지 않는다).

**적용 방법**: Supabase 프로젝트 → SQL Editor에서
`db/migrations/043_theme_cluster_dedupe.sql`을 실행한다. 적용 전에는
새 컬럼이 없어 `upsertThemeClusters()`가 실패하므로(컬럼 없음 에러),
이 migration 적용이 **필수**다.

## UI 표시 변경 (`app/trends/page.tsx`)

- 대표 테마 카드 안에 **하위 주제(subtopics)** 태그를 표시한다(별도
  카드로 분리하지 않는다).
- **근거 보기**(`<details>`, 기본 접힘)를 열면 platform 배지 + 제목으로
  원본 근거를 확인할 수 있다.
- **반복 발견 N회**(`seenCount`), **마지막 발견 시각**(`lastSeenAt`)을
  표시한다.
- `seenCount > 1`이면 "유사 후보 병합됨" 배지를 표시해 병합 여부를
  알 수 있게 한다.
- "수집된 트렌드 후보" 목록(원본, `trend_candidates`)은 기존 그대로
  둔다 — 이번 작업은 "공통 테마 후보" 쪽만 변경했다.

## AI 테마 추출 프롬프트 관련 — 현재 상태

현재 `/trends`의 클러스터링(`lib/trends/theme-clusterer.ts`)은 AI
호출 없이 **고정 키워드 그룹 매칭**으로 동작한다(AI/반도체/전기차/
부동산/금리/빅테크 6개 그룹). 이 저장소에는 "AI가 자유 형식 제목을
동적으로 추출해 테마 후보를 만드는" 프롬프트/모듈이 아직 없다 — 그래서
이번 작업에서 별도 "AI 테마 추출 프롬프트"를 수정하지 않았다(존재하지
않는 것을 수정할 수 없었다). 대신, 이 정적 클러스터링 구조에서 실제로
발생하는 중복(재수집 시 같은 그룹이 반복 insert되는 문제)을
`normalizedKey` + `themeTitleSimilarity` 기반 upsert로 해결했다. 향후
AI 기반 동적 테마 추출을 도입하면, 그 프롬프트에도 "의미상 같은 이슈는
하나의 대표 테마로 묶고 하위 항목은 subtopics로 넣는다"는 지침을 넣고,
생성된 제목에도 동일한 `normalizeThemeKey`/`themeTitleSimilarity` 기반
`upsertThemeClusters()`를 그대로 재사용하면 된다(이미 이 함수는 제목
형식에 의존하지 않는 범용 로직이다).

## 재수집 시 중복 방지 흐름 요약

1. `clusterCommonThemes()`가 최근 `trend_candidates`를 클러스터링해
   `ClusterCandidate[]`를 만든다(각각 normalizedThemeKey/subtopics/
   evidence 포함).
2. `upsertThemeClusters()`가 각 후보에 대해 기존 `theme_clusters`를
   조회해 정확/유사 매칭을 시도한다.
3. 매칭되면 update(병합), 안 되면 insert.
4. 같은 키워드 그룹을 여러 번 재수집해도 `theme_clusters` 행 수는
   늘어나지 않고, `seen_count`/`evidence`/`subtopics`만 누적된다.

## 후속: 화면 표시 단계에서도 대표 후보만 보여준다

`upsertThemeClusters()`는 **이 개선이 적용된 시점 이후의 재수집**부터
중복 insert를 막지만, 그 이전에 이미 쌓인 `theme_clusters` 행(예:
`normalized_key`가 비어 있던 시절 생성된 행)은 DB에 여전히 서로 다른
행으로 남아 있을 수 있다. 그 결과 `/trends` 화면에 같은 테마가 여러
카드로 보이는 문제가 있었다("AI 산업 동향" 점수 49/43/41이 각각 별도
카드로 표시).

이를 위해 `lib/trends/theme-cluster-display.ts`의
`groupThemeClustersForDisplay()`가 **화면에 보여줄 때만** 후보를
그룹으로 묶는다 — DB는 전혀 수정하지 않는다(hard delete 금지, DB
schema 변경 없음, 기존 `normalizedKey`/`subtopics`/`evidence`/
`seenCount`/`lastSeenAt` 필드를 그대로 재사용).

### 대표 후보 선정 기준
같은 그룹 안에서 아래 순서로 대표 후보를 고른다(이 저장소에는
`canonical`/`mergedInto` 같은 명시적 필드가 없으므로 기존 필드만
사용한다):
1. `score`가 가장 높은 후보
2. score가 같으면 `evidence` 개수가 많은 후보
3. 그래도 같으면 `lastSeenAt`이 가장 최신인 후보

### 그룹핑 기준
1. `normalizedKey`가 정확히 같다(비어 있으면 제목으로 즉석 계산한 키를
   사용해, migration 이전에 생성된 행도 그룹핑 대상이 되게 한다).
2. `normalizedKey`는 다르지만 둘 중 하나 이상이 `candidate` 상태이고
   제목 유사도(`themeTitleSimilarity`)가 임계값 이상이다. 이미
   `selected`/`dismissed`로 확정된 후보끼리는(둘 다 candidate가
   아니면) 유사도만으로 묶지 않는다.

### 목록/카드 표시
- `/trends`의 "공통 테마 후보" 목록에는 **그룹당 대표 후보 카드 1개만**
  표시한다. 병합된 후보는 대표 후보 카드 안의 `<details>` 접기 영역
  ("▶ 병합된 후보 보기 (N개)")에서만 볼 수 있다 — 제목/점수/네이버·다음
  건수/반복 발견 수/마지막 발견 시각/keywords/subtopics를 보여주되,
  "이 테마로 기사 작성 시작" 버튼은 표시하지 않는다.
- 대표 후보 카드에는 **대표 후보** / **기사 작성 가능**(아직 선택/기각
  전일 때) / **유사 후보 N개 병합됨** 배지를 표시한다.
- 네이버/다음 건수, 반복 발견 횟수, subtopics, evidence는 **그룹 전체
  (대표 + 병합된 후보)를 합산**해 표시한다 — evidence는 URL(없으면
  platform+title) 기준으로 중복 제거하고, subtopics는 정규화 키 기준으로
  중복 제거한 뒤 상위 6개만 보여주고 나머지는 "더 보기"로 접는다.
- "이 테마로 기사 작성 시작" 버튼은 **대표 후보의 id로만** 동작한다
  (`selectClusterAsTheme(representative.id)`) — 병합된 후보의 id로는
  절대 호출되지 않는다.
- 원본 근거("근거 보기")도 대표 + 병합된 후보의 evidence를 합쳐서
  보여준다 — raw evidence 자체는 삭제되지 않고 각 원본 행에 그대로
  남아 있다.

## 테스트

- `lib/trends/theme-normalization.test.ts`: 정규화/유사도 계산 단위
  테스트(사용자 제시 예시 3개 포함).
- `lib/trends/theme-clusterer.test.ts`: normalizedThemeKey/subtopics/
  evidence 생성, 중복 제목 병합 확인.
- `lib/repositories/trend-repository.test.ts`: `upsertThemeClusters()`
  — 정확 매칭 병합, 유사도 매칭 병합, 낮은 유사도 신규 insert,
  selected/dismissed 상태는 퍼지 매칭 제외.
- `app/trends/page.test.ts`: 하위 주제/근거 보기/반복 발견/유사 후보
  병합 배지 UI 정적 검사, 대표 후보에서만 기사 작성 버튼이 동작하는지,
  병합된 후보 행에는 그 버튼이 없는지 검사.
- `lib/trends/theme-cluster-display.test.ts`: 같은 normalizedKey/제목
  유사도를 가진 후보 그룹핑, 대표 후보 선정 우선순위(score → evidence
  개수 → lastSeenAt), naver/daum/seenCount 합산, subtopics/evidence
  중복 제거 병합, raw 객체 불변성, selected/dismissed 후보는 퍼지
  매칭에서 제외되는지 검사.

`npm run lint`, `npx vitest run`(전체), `npx tsc --noEmit -p .`(기존
baseline 37개 유지), `npm run build` 모두 통과 확인.

## 관련 문서

- [`docs/phase-1-17-daum-collection-balance.md`](./phase-1-17-daum-collection-balance.md)
  — naver 대비 daum 수집 결과가 적어 보이던 문제의 진단/개선(evidence
  균형과 직접 관련).
- [`docs/phase-1-21-theme-selection-focused-ui.md`](./phase-1-21-theme-selection-focused-ui.md)
  — `/trends` 화면을 "대표 테마 선택 중심 UI"로 재구성(레이아웃 우선순위,
  카드 단순화, 원자료 compact화). 이 문서의 그룹핑/병합 로직은 그대로
  재사용하고 화면 레이아웃만 바꿨다.
