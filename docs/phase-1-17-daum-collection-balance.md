# Phase 1-17: Naver/Daum 수집 결과 균형 개선

## 증상

`/trends`에서 자동 공통 테마 추출 후 네이버는 46건, 다음(카카오)은
4건만 보이는 문제가 있었다.

## 진단 결과 — 실제 원인은 "수집"이 아니라 "조회(화면 표시)" 단계였다

`SUPABASE_SECRET_KEY`로 실제 `pipeline_logs`/`trend_candidates`를 직접
조회해 확인한 결과:

- 최근 수집 로그(`trend_collection_completed`)는 **"네이버 46건, 다음
  47건"** — 즉 실제로는 두 플랫폼이 거의 balanced하게 수집·저장되고
  있었다.
- 그런데 `/trends`가 쓰는 `getRecentTrendCandidates(50)` 쿼리(`order
  collected_at desc, limit 50`)로 상위 50건만 다시 조회해보면 **네이버
  46건, 다음 4건**이 나왔다 — 사용자가 본 화면과 정확히 일치했다.

원인: 한 번의 수집(`collectTrendCandidates()`)에서 네이버와 다음 결과가
모두 **같은 `collected_at` 타임스탬프**로 한 번에 insert된다. `order by
collected_at desc`만으로는 이 동일 타임스탬프 행들의 순서(tie-break)가
보장되지 않고, PostgreSQL이 반환하는 물리적 순서는 흔히 insert 순서와
연관된다 — insert 배열이 `[...naverResult.inputs, ...daumResult.inputs]`
순서(네이버가 먼저)였기 때문에, `limit(50)`으로 자르면 네이버 행이 거의
다 차지하고 다음 행은 몇 개만 우연히 포함되는 결과가 나왔다.

**즉, Daum/Kakao API 호출 자체(엔드포인트, 인증 헤더, response 파싱)는
문제가 없었다** — 실제로 라이브 호출 테스트에서도 `/v2/search/web`이
seed query당 최대 50건까지 정상 응답했고, 서로 다른 query 10개를 모두
호출하면 raw 문서 45~50건(중복 URL 제외)이 나왔다.

## 조치

### 1) 근본 원인 수정 — `getRecentTrendCandidates()` (스키마 변경 없음)

`lib/repositories/trend-repository.ts`에 `balanceCandidatesByPlatform()`
함수를 추가했다 — 넉넉한 창(`Math.max(limit*4, 200)`)으로 먼저 가져온
뒤, 각 플랫폼 내부의 최신순은 유지하면서 플랫폼을 라운드로빈으로
번갈아 뽑아 최종 `limit`을 채운다. 그 결과 한쪽 플랫폼이 우연히
앞쪽에 몰려 있어도 다른 플랫폼이 화면에서 거의 사라지는 일이 없다.
이 함수는 `/trends` 표시(`getTrendPageData`)와 클러스터링
(`clusterCommonThemes`)이 공유해서 사용한다.

### 2) 수집량/저장률 개선 (부가 개선 — 근본 원인은 아니었지만 함께 반영)

- **query expansion** (`lib/trends/daum-query-expansion.ts`): naver와
  같은 포괄적인 seed 키워드("AI", "경제" 등)를 다음에도 그대로 쓰면
  겹치는 결과가 많다 — seed마다 확장 검색어 2개를 추가로 검색해 raw 후보
  pool을 넓힌다(과도한 호출을 막기 위해 seed당 최대 3개 검색어로
  제한).
- **page 반복** (`lib/trends/daum-client.ts`의 `searchDaumNewsMultiPage`):
  `DAUM_SEARCH_PAGE_SIZE`/`DAUM_SEARCH_MAX_PAGES` 환경변수로 페이지당
  크기/최대 페이지 수를 조정할 수 있다. 기본값은 보수적으로
  유지한다(`pageSize=10`, `maxPages=1` — 근본 원인이 수집량 문제가
  아니었으므로 기본 호출량을 3배 이상 늘리지 않았다). 마지막 페이지로
  판단되면(요청한 size보다 적게 오면) 즉시 멈춰 불필요한 호출을 하지
  않는다.
- **완화된 필터** (`lib/trends/daum-result-filter.ts`): publisher/게시일
  (datetime)을 필수로 요구하지 않는다 — 애초에 이 프로젝트의
  `InsertTrendCandidateInput`/Kakao 웹 검색 결과에는 publisher 필드
  자체가 없다. url이 없는(활용 불가능한) 항목만 제외한다.
- **진단 로깅** (`lib/trends/trend-service.ts`의 `collectFromDaum`):
  `daum_trend_collection_completed` 로그에 `rawDocumentsCount`/
  `mappedDocumentsCount`/`filteredOutCount`/`dedupedOutCount`/
  `savedCount`/`skippedReasonsSummary`/`perQueryCounts`(query별 결과
  수)를 구조화된 `details_json`으로 남긴다. `trend_collection_completed`
  로그에는 최종 결합 단계에서 제거된 중복 건수(`duplicateRemovedCount`)를
  추가했다. **raw API response 전체나 API key는 절대 로그에 남기지
  않는다** — url/title 샘플은 최대 3개까지만 남긴다.

### 3) common theme 추출 반영

`lib/trends/theme-cluster-display.ts`에 `daumEvidenceStrength`
(`none`/`weak`/`strong`)를 추가했다 — daum 근거 0건이면 "네이버 중심
테마", 1~2건이면 "다음 근거 약함" 배지를 `/trends` 화면에 표시한다.
**daum 결과가 적다는 이유만으로 테마 자체를 버리지 않는다** —
`clusterTrendItems()`은 원래부터 naver/daum 중 하나만 있어도 후보를
만든다(둘 다 0건일 때만 제외).

## 환경변수 (선택, 기본값으로도 정상 동작)

```env
# 다음(카카오) 수집 페이지당 결과 수 (기본 10, Kakao API 상한 50)
DAUM_SEARCH_PAGE_SIZE=10
# 다음(카카오) 수집 최대 페이지 수 (기본 1, 최대 5로 제한)
DAUM_SEARCH_MAX_PAGES=1
```

## 보안 원칙 (그대로 유지)

- API key는 어떤 로그에도 남기지 않는다(`skippedReasonsSummary`/
  `perQueryCounts`/`sampleResults`는 개수·제목·URL만 담는다).
- raw API response 전체는 저장하지 않는다.
- naver 수집 로직(`collectFromNaver`, `searchNaverNews`)은 이번
  개선에서 전혀 변경하지 않았다.

## 테스트

- `lib/repositories/trend-repository.test.ts`: `balanceCandidatesByPlatform`
  라운드로빈 동작, `getRecentTrendCandidates`가 넉넉한 창으로 조회 후
  균형을 맞추는지 검사.
- `lib/trends/daum-query-expansion.test.ts`: seed query 확장, 중복 제거.
- `lib/trends/daum-collection-config.test.ts`: 환경변수 파싱/기본값/상한.
- `lib/trends/daum-result-filter.test.ts`: publisher 없이도 유지되는지,
  url 없는 항목만 제외되는지.
- `lib/trends/daum-client.test.ts`: page 파라미터 반영, 여러 페이지
  반복 호출(`searchDaumNewsMultiPage`), 빈 페이지에서 즉시 중단.
- `lib/trends/trend-service.test.ts`: 확장된 검색어로 다음을 호출하는지,
  naver 로직이 그대로인지, 중복 URL이 제거되는지, raw/saved count가
  로그에 남는지, API key가 로그에 남지 않는지, daum이 전부 실패해도
  naver는 정상 저장되는지.
- `lib/trends/theme-cluster-display.test.ts`: `daumEvidenceStrength`
  분류, daum 근거가 적어도 그룹이 사라지지 않는지.
- `app/trends/page.test.ts`: daum 근거 강도 배지 표시 정적 검사.

`npm run lint`, `npx vitest run`(전체), `npx tsc --noEmit -p .`(baseline
37 유지), `npm run build` 모두 통과 확인.
