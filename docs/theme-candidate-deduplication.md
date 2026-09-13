# Phase 1-24: 자동테마 후보 cross-day 중복/업데이트 분류

## 문제

[`docs/phase-1-16-theme-candidate-deduplication.md`](./phase-1-16-theme-candidate-deduplication.md)에서
"오늘 후보끼리"의 병합(같은 실행 안에서의 중복 제거)은 처리했지만, 이미
`themes` 테이블에 채택된(과거 실행에서 사람이 선택한) 테마와는 전혀
비교하지 않았다. 그 결과:

- 어제 "AI 동행" 테마를 만들었는데, 오늘 재수집하면 "AI 동행" 공통 테마
  후보가 새 후보처럼 다시 나타난다.
- 같은 테마가 반복되는 것 자체는 자연스럽지만(뉴스가 계속 나오므로),
  시스템이 이것이 신규 테마인지 / 기존 테마의 업데이트인지 / 완전
  중복인지 구분하지 못했다.
- 병합된(merged) 후보나 중복 후보가 화면에 보이는데 클릭해도 선택되지
  않고, 이유도 안내되지 않았다.

## 4가지 상태

`lib/trends/theme-candidate-classifier.ts`의 `classifyThemeCandidate()`가
오늘 병합된 대표 공통 테마 후보(`ThemeCluster`) 하나를 기존 활성 테마
목록과 비교해 다음 중 하나로 분류한다.

| 내부 값 | 화면 라벨 | 의미 | 사용자 행동 |
|---|---|---|---|
| `new_theme` | 신규 테마 | 기존 테마와 의미상 겹치지 않음 | [새 테마로 만들기](=이 테마로 기사 작성 시작) |
| `existing_theme_update` | 기존 테마 업데이트 | 같은 주제, 오늘 새 자료가 있음 | [기존 테마에 추가] [기존 테마 보기] [새 하위 주제로 분리] |
| `duplicate_theme` | 중복 테마 | 기존 테마와 거의 동일, 새 자료 거의 없음 | [기존 테마 보기] [다시 표시하지 않기] |
| `needs_review` | 확인 필요 | 이름은 비슷한데 같은 주제인지 자동 판단 어려움 | [기존 테마에 추가] [새 테마로 만들기] [기존 테마 보기] |

내부 enum 값(`new_theme` 등)은 화면에 직접 노출하지 않는다 —
`THEME_CANDIDATE_CLASSIFICATION_LABEL`로 한국어 라벨만 보여준다.

## 판단 로직

1. **매칭 대상 찾기** (`findBestMatch`): normalizedThemeKey가 정확히
   같은 기존 테마를 우선 찾고, 없으면 제목 유사도
   (`themeTitleSimilarity`, `lib/trends/theme-normalization.ts`)가
   임계값(0.25) 이상인 기존 테마 중 가장 유사한 것을 찾는다. 매칭되는
   기존 테마가 하나도 없으면 `new_theme`이다.
2. **내용(content) 유사도 확인** (`contentSimilarity`): 제목만으로는
   "AI 동행" = 고령자 돌봄 vs "AI 동행" = 업무 자동화처럼 이름이 같아도
   의미가 다른 경우를 구분할 수 없다. 기존 테마와 후보의 키워드 집합 +
   설명 토큰 집합의 Jaccard 유사도를 계산해, 비교 가능한 데이터가
   있는데도 뚜렷이 낮으면(< 0.15) 제목이 같거나 비슷해도 자동 병합하지
   않고 `needs_review`로 사람에게 넘긴다.
3. **제목 신뢰도 확인**: normalizedKey가 정확히 같거나 제목 유사도가
   `THEME_SIMILARITY_MERGE_THRESHOLD`(0.55) 이상이면 "확신 있는 매칭"으로
   보고, 그 사이(0.25~0.55)면 `needs_review`로 넘긴다(제목만 비슷하고
   확신할 수 없는 경우).
4. **새 URL 개수로 최종 구분**: 확신 있는 매칭이고 내용도 비슷하면,
   후보의 근거(evidence) URL 중 기존 테마에 이미 등록된 출처 URL과
   겹치지 않는 것(`newUrls`)을 센다.
   - 새 URL이 0개 → `duplicate_theme`
   - 새 URL이 1개 이상 → `existing_theme_update`

정규화 키(`normalizeThemeKey`)와 제목 유사도(`themeTitleSimilarity`)는
기존 [`docs/phase-1-16-theme-candidate-deduplication.md`](./phase-1-16-theme-candidate-deduplication.md)에
설명된 것을 그대로 재사용한다 — 이번 작업에서 새로 만든 helper는
`classifyThemeCandidate`/`findBestMatch`/`contentSimilarity`
(`lib/trends/theme-candidate-classifier.ts`)뿐이다.

## 기존 테마 컨텍스트 (`getExistingThemeContextsForCrossDayCheck`)

`themes` 테이블 자체에는 normalizedKey/evidence 필드가 없으므로,
`lib/trends/trend-service.ts`의 `getExistingThemeContextsForCrossDayCheck()`가
활성 테마마다 다음을 모아 `ExistingThemeContext`로 넘긴다:

- 등록된 출처 URL 목록(`getSourcesByThemeId`) — 새 URL/중복 URL 판정용
- 마스터 원고 존재 여부(`getArticleByThemeId`)
- 플랫폼 글 존재 여부(`listSocialPostsByArticle`)
- 최근 갱신 시각(가장 최근 출처 등록 시각, 없으면 테마 생성 시각)

DB schema는 바꾸지 않았다 — 기존 조회 함수만 조합한다.

## merged/duplicate 후보가 "선택 불가"로 끝나지 않게 하는 방법

`app/trends/page.tsx`:

- **merged candidate**(`MergedCandidateRow`): 이 후보만 따로 선택할 수
  없는 이유를 문장으로 보여주고, [대표 테마 선택](대표 후보 id로
  `selectClusterAsTheme` 호출) 버튼을 항상 제공한다. 대표 후보가 이미
  기존 테마와 매칭됐다면(`matchedExistingThemeId`) [기존 테마 보기]
  링크도 함께 보여준다.
- **duplicate_theme**: [기존 테마 보기](`/dashboard?themeId=...`)와
  [다시 표시하지 않기](`dismissClusterCandidate` → `theme_clusters.status
  = 'dismissed'`, soft 처리)를 제공한다.
- **needs_review**: 기존 테마/오늘 후보의 설명, 공통 키워드, 차이
  키워드, 새 URL/중복 URL 개수를 나란히 보여주고 [기존 테마에
  추가]/[새 테마로 만들기]/[기존 테마 보기] 중 사용자가 직접 고르게
  한다.

## Phase 1-25: existing_theme_update가 "✓ 테마로 저장됨"으로만 끝나던 버그

기존 문제: 어제 어떤 공통 테마 후보를 선택해 테마를 만들면 그
`theme_clusters` 행의 `status`가 `selected`로 바뀐다(`createThemeFromCluster`).
오늘 같은 주제가 다시 수집되면 `upsertThemeClusters()`가 **status와
무관하게** 같은 행에 병합하므로(정확히 같은 `normalizedKey`), 그 행은
`status="selected"`를 유지한 채로 새 evidence/URL만 누적된다. 이 상태를
오늘 다시 cross-day 분류하면 `existing_theme_update`(자기 자신이 만든
그 테마와 매칭)로 정확히 분류되는데도, `app/trends/page.tsx`의
`ClusterCard`가 `existing_theme_update`/`duplicate_theme`/`needs_review`
패널을 **`!isSelected`** 조건으로 감싸고 있어 아무 패널도 렌더링되지
않고, 화면 맨 아래 `{isSelected && <p>✓ 테마로 저장됨</p>}`만 남아
있었다 — 분류 결과(신규 URL 개수, 다음 행동)가 있는데도 사용자가 그걸
전혀 볼 수 없는 상태였다.

수정: 세 패널의 조건에서 `!isSelected`를 제거했다(`!isDismissed`만
유지) — "이 대표 후보에서 이미 테마가 만들어졌다"는 사실과 "오늘 그
기존 테마에 추가할 새 자료가 있다"는 사실은 서로 배타적이지 않기
때문이다. 대신:

- 배지 줄에 "✓ 새 테마로 저장됨" 배지를 별도로 추가해 "이미 저장됨"
  정보 자체는 잃지 않는다.
- 화면 맨 아래의 무조건적 `{isSelected && ...}` fallback은 **매칭되는
  기존 테마가 없는 진짜 예외 상황**(`classification === "new_theme"`
  이면서 `isSelected`인 경우 — 예: 생성됐던 테마가 이후 보관 처리된
  경우)에만 남기고, 그 경우에도 대시보드로 이동하는 링크를 함께
  준다(무반응 금지).
- `MergedCandidateRow`(대표 후보에 병합된 후보)에도 대표 후보가 이미
  기존 테마와 매칭돼 있으면 [기존 테마에 새 출처 추가] 버튼을
  추가했다 — 병합된 후보 자신의 evidence를 기존 테마에 반영할 수
  있다.
- "새 하위 주제로 분리" 버튼에 확인 대화상자(`ConfirmSubmitButton`)를
  추가해 실수로 중복 테마를 만들지 않게 했다.
- "기존 테마에 추가" 실행 결과 중 **새 URL이 0개인 경우**(이미 기존
  테마에 다 포함된 자료)를 별도 문구("추가할 새 출처가 없습니다")와
  [기존 테마 보기]/[다시 표시하지 않기]로 구분해 보여준다 — 이전에는
  0개를 추가했어도 "N개를 추가했습니다"(N=0) + "마스터 원고 갱신을
  확인하세요"라는 오해의 소지가 있는 문구를 보여주고 있었다.

## 로그

`theme_candidate_*` 접두사의 로그 이벤트(`lib/repositories/log-repository.ts`)로
cross-day 검사 시작/완료, 분류 결과, 후보 선택 결과(대표 테마로
연결/기존 테마로 연결/새 테마로 분리)를 남긴다. API key/원문 본문은
남기지 않고 candidate id/existing theme id/분류 결과/URL 개수 정도만
남긴다. Phase 1-25에서 기존 테마 업데이트 action의 시작
(`theme_candidate_existing_theme_update_started`)/실패
(`..._failed`)/새 URL 없음(`..._no_new_urls`)을 추가로 남긴다.

## 테스트

- `lib/trends/theme-candidate-classifier.test.ts`: 4가지 분류 기준
  (정확 key + 중복, 정확 key + 새 URL, 같은 이름 다른 내용, 유사하지
  않음) 단위 테스트.
- `app/trends/page.test.ts`: 상태별 배지/필터/버튼, merged candidate의
  대표 테마 선택 버튼, duplicate/needs_review 카드의 다음 행동 버튼을
  정적으로 검사. Phase 1-25 추가분: existing_theme_update/
  duplicate_theme/needs_review 패널이 `isSelected` 여부와 무관하게
  렌더링되는지, "✓ 테마로 저장됨" 단독 fallback이 더 이상 없는지,
  isSelected + new_theme 예외 상황에도 대시보드 링크가 있는지, 병합된
  후보에서도 기존 테마에 출처를 추가할 수 있는지 검사.
- `lib/trends/trend-service-existing-theme-update.test.ts`(신규,
  Phase 1-25): 새 URL만 추가/중복 제외, 추가할 새 URL이 없을 때
  `no_new_urls` 로그, 클러스터를 찾지 못하면 `failed` 로그 후 에러,
  새 URL 추가 시 마스터 원고 갱신 권장 플래그, `DuplicateSourceError`도
  중복 제외로 처리.

## 관련 문서

- [`docs/phase-1-16-theme-candidate-deduplication.md`](./phase-1-16-theme-candidate-deduplication.md) — 같은 날 후보끼리의 병합/정규화 키.
- [`docs/automatic-theme-update-workflow.md`](./automatic-theme-update-workflow.md) — "기존 테마에 추가" 실행 흐름과 마스터 원고 갱신 권장.
