# Phase 1-13: 선택된 테마 기반 관련 기사 URL 후보 수집

## 목적

Phase 1-12에서 만들어진 테마(수동 또는 자동 추출)를 기반으로  
관련 기사 URL 후보를 자동 수집하고, 사용자가 확인 후 sources로 등록할 수 있게 한다.  
등록된 source는 기존 URL fetch → source summary → article generation 흐름을 그대로 사용한다.

---

## Phase 1-12와의 관계

```
Phase 1-12:
  수동 테마 입력(/dashboard) ─┐
  자동 테마 추출(/trends)    ─┤→ themes 테이블
                               │
Phase 1-13 (신규):             │
  themes → /themes/[id] → URL 후보 수집 → 사용자 선택 → sources 등록
                                                              │
                               기존 pipeline 그대로: URL fetch → summary → article generation
```

---

## 추가된 DB 테이블 (migration 010)

### `article_url_candidates`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| theme_id | uuid | 연결된 테마 (themes.id) |
| theme_cluster_id | uuid | 클러스터 기반 수집 시 cluster id |
| platform | text | naver / daum / mock |
| query | text | 수집에 사용된 검색 쿼리 |
| title | text | 기사 제목 |
| snippet | text | 기사 요약 |
| url | text | 기사 URL (NOT NULL) |
| publisher | text | 언론사명 |
| published_at | timestamptz | 발행일 |
| rank_position | integer | 검색 결과 순위 |
| status | text | candidate / selected / dismissed / imported |
| metadata | jsonb | 추가 정보 (source, keyword 등) |
| collected_at | timestamptz | 수집 시각 |

**제약조건**: (theme_id, url) UNIQUE — 같은 테마에 같은 URL이 중복 저장되지 않음.

---

## mock mode

`ARTICLE_SEARCH_ENABLED=false` (기본값) → 실제 외부 API 호출 없이 mock 후보 생성.

mock 생성 방식:
1. `buildSearchQueries(theme)` → 최대 5개 검색 쿼리 생성 (제목, 키워드 2개 조합)
2. 쿼리 2개 × 플랫폼 2개(naver/daum) × 4건 = 최대 16건 후보 생성
3. theme.title과 keywords가 제목/snippet에 반영됨
4. 서로 다른 URL, 다양한 언론사명

`ARTICLE_SEARCH_ENABLED=true` → 실제 네이버/카카오 API 연결 (Phase 1-13 이후 구현 예정).

---

## 검색 쿼리 생성 방식 (`search-query-builder.ts`)

| 입력 | 생성 쿼리 예시 |
|---|---|
| title: "AI 에이전트 동향" | "AI 에이전트 동향" |
| keywords: ["AI", "에이전트", "LLM"] | "AI 에이전트", "에이전트 LLM" |
| title + 첫 번째 keyword | "AI AI 에이전트 동향" (중복이면 제외) |

중복 제거 후 최대 5개 반환.

---

## sources로 import되는 흐름

```
사용자가 체크박스 선택 → "선택한 후보 출처 등록" 버튼

  for each 선택된 candidateId:
    1. 중복 URL 확인 (theme_id + url)
    2. sources.addSource(url, title, publisher, metadata.collection_method="article_url_candidate")
    3. URL fetch → raw_content 저장
    4. source summary (mock 또는 AI)
    5. article_url_candidates.status = "imported"
    6. pipeline_logs 기록
```

sources.metadata에 저장되는 정보:
```json
{
  "collection_method": "article_url_candidate",
  "article_url_candidate_id": "<candidate-uuid>",
  "platform": "naver"
}
```

---

## 중복 URL 처리

- `article_url_candidates`: (theme_id, url) UNIQUE INDEX → 같은 URL이 두 번 수집되어도 무시됨 (upsert ignoreDuplicates)
- `sources`: 기존 PostgreSQL 23505 constraint → `DuplicateSourceError` 처리, 사용자에게 "이미 등록된 출처" 표시

---

## 공식 API 우선 원칙

- 네이버/다음 랭킹 페이지 무단 스크래핑 없음
- `ARTICLE_SEARCH_ENABLED=false`가 기본값 → API key 없이도 전체 흐름 테스트 가능
- API key는 `.env.local`에만 저장, 코드/문서에 직접 기재 금지
- `.env.local`은 `.gitignore`로 커밋 제외

---

## 자동 게시 금지 원칙

- URL 후보 수집은 sources 등록까지만 자동화
- 기사 생성(draft)은 사용자가 대시보드에서 직접 실행
- reviewed, published 전환은 기존 human approval 게이트(`assertApproved`) 사용

---

## 로깅 이벤트 (pipeline_logs)

| 이벤트 | 시점 |
|---|---|
| article_url_collection_started | URL 후보 수집 시작 |
| article_url_collection_completed | URL 후보 수집 완료 |
| article_url_collection_failed | URL 후보 수집 실패 |
| article_url_candidate_selected | 사용자가 후보 선택 |
| article_url_candidate_imported | 후보 → sources 등록 완료 |
| article_url_candidate_dismissed | 후보 제외 |
| source_created_from_candidate | sources에 출처 생성 완료 |

---

## 추가된 파일

| 파일 | 역할 |
|---|---|
| `db/migrations/010_phase-1-13-article-url-candidates.sql` | DB 마이그레이션 |
| `lib/article-search/search-query-builder.ts` | 테마 → 검색 쿼리 생성 |
| `lib/article-search/mock-article-search-provider.ts` | mock 기사 후보 생성 |
| `lib/article-search/article-search-service.ts` | 수집/조회/제외 서비스 |
| `lib/repositories/article-url-candidate-repository.ts` | DB 접근 |
| `app/themes/[themeId]/page.tsx` | URL 후보 수집/선택/등록 UI |
| `app/themes/[themeId]/actions.ts` | Server Actions |

---

## 현재 한계 및 다음 단계

- 실제 네이버 검색 API / 카카오 API 연결 미구현 (`ARTICLE_SEARCH_ENABLED=true` 경로)
- 후보 import 결과(성공/실패/중복 건수) 피드백 UI 없음 (revalidate로 재렌더링만)
- 여러 테마에 걸친 중복 URL 감지 미구현 (현재는 같은 theme 안에서만 중복 체크)
- 향후: 실제 API 연결, 검색 결과 품질 필터링, 언론사 신뢰도 필터
