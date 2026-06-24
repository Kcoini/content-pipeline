# Phase 1-12: 수동 테마 입력과 자동 공통 테마 추출 병행 구조

## 목적

사용자가 직접 테마를 입력하는 기존 방식을 유지하면서,
포털(네이버·다음) 트렌드에서 공통 테마를 자동 추출하는 방식을 추가한다.
두 방식 모두 `themes` 테이블로 합류하고, 이후 pipeline(출처 등록 → 기사 생성 → 평가 → 승인)을 공유한다.

---

## 두 가지 테마 생성 경로

### 경로 A: 수동 입력 (기존 방식 유지)
```
/dashboard → 새 테마 입력 폼 → themes 저장(metadata.creation_method = "manual")
→ 출처 등록 → 기사 생성 → 평가 → 승인
```

### 경로 B: 자동 테마 추출 (신규)
```
/trends → 트렌드 수집 버튼 → trend_candidates 저장
→ 키워드 클러스터링 → theme_clusters 저장
→ 사용자가 클러스터 선택 → themes 저장(metadata.creation_method = "trend_cluster")
→ /dashboard로 이동 → 출처 등록 → 기사 생성 → 평가 → 승인
```

---

## 추가된 DB 테이블 (migration 009)

### `trend_candidates`
포털에서 수집된 트렌드 후보를 저장한다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| platform | text | naver / daum / mock |
| keyword | text | 키워드 |
| title | text | 기사/트렌드 제목 |
| snippet | text | 요약 |
| url | text | 링크 |
| rank_position | integer | 순위 |
| collected_at | timestamptz | 수집 시각 |
| metadata | jsonb | 추가 정보 |

### `theme_clusters`
키워드 클러스터링 결과를 저장한다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| title | text | 클러스터 제목 |
| description | text | 설명 |
| keywords | jsonb | 매칭된 키워드 목록 |
| naver_count | integer | 네이버에서 감지된 횟수 |
| daum_count | integer | 다음에서 감지된 횟수 |
| score | numeric | 점수 = naver+daum+(3 if both>0) |
| status | text | candidate / selected / dismissed |

### `themes.metadata` (기존 테이블 컬럼 추가)
```json
// 수동 생성
{ "creation_method": "manual" }

// 트렌드 클러스터에서 생성
{ "creation_method": "trend_cluster", "theme_cluster_id": "<uuid>" }
```

---

## 추가된 파일

### `lib/trends/mock-trend-provider.ts`
`TREND_COLLECTION_ENABLED=false`일 때 사용하는 mock 트렌드 데이터.
네이버 10건 + 다음 10건, AI/반도체/전기차/부동산/금융/빅테크 주제.

### `lib/trends/theme-clusterer.ts`
`RawTrendItem[]` → `ClusterCandidate[]` 키워드 빈도 기반 클러스터링.
- 6개 키워드 그룹 정의 (AI, 반도체, 전기차, 부동산, 금융경제, 빅테크)
- 양쪽 플랫폼 동시 등장 시 crossBonus +3
- 점수 내림차순 정렬

### `lib/trends/trend-service.ts`
- `collectTrendCandidates()`: mock 또는 실제 API로 수집 → `trend_candidates` 저장
- `clusterCommonThemes()`: 최근 후보 조회 → 클러스터링 → `theme_clusters` 저장
- `createThemeFromCluster(clusterId)`: 클러스터 → `themes` 저장 + 상태 `selected` 전환
- `getTrendPageData()`: /trends 페이지용 후보+클러스터 조회

### `lib/repositories/trend-repository.ts`
- `insertTrendCandidates()`, `getRecentTrendCandidates()`
- `insertThemeClusters()`, `getThemeClusters()`, `getThemeClusterById()`, `updateThemeClusterStatus()`

### `app/trends/page.tsx`
- Mock 모드 배너
- 트렌드 수집 + 공통 테마 추출 버튼 (form action)
- 수집된 후보 목록 (플랫폼 배지 + 제목 + 스니펫)
- 공통 테마 후보 카드 (점수 순, 테마로 저장 버튼)

### `app/trends/actions.ts`
- `runTrendCollection()`: 수집 + 클러스터링 실행
- `selectClusterAsTheme(clusterId)`: 클러스터 → themes 저장 + dashboard redirect

---

## 환경변수

```env
# mock mode (기본값, API key 없이 전체 흐름 테스트)
TREND_COLLECTION_ENABLED=false

# 실제 API 연결 시 (Phase 1-12 이후)
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
KAKAO_REST_API_KEY=
```

---

## 로깅 이벤트 (pipeline_logs)

| 이벤트 | 시점 |
|---|---|
| trend_collection_started | 수집 시작 |
| trend_collection_completed | 수집 완료 |
| trend_collection_failed | 수집 실패 |
| theme_clustering_started | 클러스터링 시작 |
| theme_clustering_completed | 클러스터링 완료 |
| theme_selected | 사용자가 클러스터 선택 |
| theme_created_from_cluster | 클러스터에서 테마 생성 완료 |

---

## 보안 원칙

- 네이버/다음 랭킹 페이지 무단 대량 스크래핑 없음
- `TREND_COLLECTION_ENABLED=false` 기본값 → API key 없이도 동작
- API key는 `.env.local`에만 저장, 코드/문서에 직접 기재 금지
- `.env.local`은 `.gitignore`로 커밋 제외

---

## 현재 한계 및 다음 단계

- 실제 네이버 검색 API / 카카오 API 연결은 미구현 (`TREND_COLLECTION_ENABLED=true` 경로)
- 클러스터 dismissed 처리 UI 미구현
- /trends 페이지에 수집 결과 피드백(성공/실패 메시지) 미표시 (revalidate로 재렌더링만)
- 향후: 실제 API 연결, 스케줄링(cron), 복수 클러스터 동시 선택 지원
