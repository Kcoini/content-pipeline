# Phase 1-24: 기존 테마 업데이트 flow + 마스터 원고 갱신 권장

`existing_theme_update`/`needs_review`로 분류된 자동테마 후보(
[`docs/theme-candidate-deduplication.md`](./theme-candidate-deduplication.md)
참고)는 새 테마를 만드는 대신, 기존 테마에 오늘 발견된 새 출처를 추가할
수 있다.

## 실행 흐름

1. `/trends`에서 [기존 테마에 추가] 클릭
   → `app/trends/actions.ts`의 `addClusterToExistingTheme(clusterId,
   existingThemeId)`
2. → `lib/trends/trend-service.ts`의
   `addClusterEvidenceToExistingTheme(clusterId, existingThemeId)`:
   - 공통 테마 후보의 근거(evidence) URL 중 URL이 있는 것만, 중복 제거
     후 하나씩 `addSource()`(`lib/repositories/source-repository.ts`)로
     기존 테마에 등록한다.
   - 이미 등록된 URL은 `sources` 테이블의 `(theme_id, url)` unique
     제약을 이용해 자동으로 걸러진다(`DuplicateSourceError` catch →
     "중복 제외" 카운트).
   - 새 출처가 1건이라도 추가되면 `theme.metadata`에
     `needsMasterManuscriptRefresh: true`, `lastCrossDayUpdateAt`,
     `lastCrossDayAddedSourceCount`를 남긴다
     (`updateThemeMetadata`, `lib/repositories/theme-repository.ts`) —
     **DB schema는 바꾸지 않는다**(`themes.metadata`는 이미 jsonb).
   - 마스터 원고나 플랫폼 글은 이 단계에서 **절대 자동으로 재생성하지
     않는다** — 플래그만 남긴다.
3. 결과(추가 개수/중복 제외 개수/실패 개수)를 query string으로 담아
   `/trends`로 redirect한다 — 추가 후에도 "조용히 새로고침"으로 끝나지
   않고 결과 요약 카드 + 다음 행동([마스터 원고 갱신 확인] [기존 테마
   보기] [대시보드로 이동])을 보여준다.

## 다음번 재수집 시 자동으로 "중복"으로 재분류된다

새로 추가한 URL은 이제 기존 테마의 출처 목록에 들어있으므로, 다음
cross-day 분류 실행 때 같은 후보의 `newUrlCount`가 0이 되어 자동으로
`duplicate_theme`으로 재분류된다. 이를 위해 별도의 "처리 완료" 플래그를
추가하지 않았다 — 기존 필드(사실상 `sources` 테이블)만으로 자연스럽게
수렴한다.

## 마스터 원고 갱신 권장 (대시보드)

`/dashboard?themeId=...`의 "마스터 원고" 섹션(`app/dashboard/page.tsx`)은
`selectedTheme.metadata.needsMasterManuscriptRefresh`가 켜져 있으면 안내
배너를 보여준다:

> 새 출처가 추가되었습니다.
> 기존 마스터 원고에 새 자료를 반영할지 확인하세요.

버튼:

- **마스터 원고 갱신**: 같은 섹션의 "마스터 원고 다시 만들기" 폼으로
  스크롤 이동(`#generate-draft` 앵커) — 실제 재생성은 기존
  `generateArticleDraft` 흐름(재생성 확인 배너 포함)을 그대로 탄다.
  이 배너 자체는 원고를 재생성하지 않는다.
- **기존 원고 유지**: `dismissMasterManuscriptRefreshNotice`
  (`app/dashboard/actions.ts`) 호출 →
  `needsMasterManuscriptRefresh`만 `false`로 되돌린다. 원고/출처는
  그대로 둔다.
- **변경 내용 보기**: 추가된 출처 개수를 보여주고, "등록된 출처" 목록
  에서 최근 출처를 직접 확인하도록 안내한다.

기존 원고와 플랫폼 글은 이 흐름 전체에서 **자동으로 덮어써지지
않는다** — 사용자가 "마스터 원고 다시 만들기"를 직접 눌러야만 재생성
확인 배너(이미 있던 기능, Phase 2-22)를 거쳐 새로 생성된다.

## 테스트

- `lib/trends/trend-service.test.ts`, `lib/repositories/source-repository.test.ts` 등
  기존 출처 등록/중복 처리 테스트를 그대로 재사용(신규 회귀 없음 확인).
- `app/trends/page.test.ts`: "기존 테마 업데이트 완료" 결과 카드 +
  [마스터 원고 갱신 확인]/[대시보드로 이동] 링크 정적 검사.
- `app/dashboard/page.test.ts`: `needsMasterManuscriptRefresh` 배너 +
  [마스터 원고 갱신]/[기존 원고 유지] 버튼 정적 검사.

## 관련 문서

- [`docs/theme-candidate-deduplication.md`](./theme-candidate-deduplication.md)
- [`docs/phase-4-1-master-manuscript-terminology.md`](./phase-4-1-master-manuscript-terminology.md)
