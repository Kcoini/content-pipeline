# Phase 1-13: 네이버/다음 검색 API 실제 연결

## 목적

Phase 1-12에서 만든 트렌드 수집 구조에 네이버 뉴스 검색 API와
카카오 Daum 뉴스 검색 API를 실제로 연결한다.
`TREND_COLLECTION_ENABLED=true`로 설정하면 mock 대신 실제 API를 호출해
최신 뉴스 기사를 수집하고, 공통 테마를 추출한다.

---

## 네이버 API 준비 방법

1. [네이버 개발자 센터](https://developers.naver.com) 접속 → 애플리케이션 등록
2. 사용 API: **검색 > 뉴스** 선택
3. 발급받은 `Client ID`, `Client Secret`을 `.env.local`에 저장

```
NAVER_CLIENT_ID=발급받은_클라이언트_아이디
NAVER_CLIENT_SECRET=발급받은_클라이언트_시크릿
```

- 무료 한도: 뉴스 검색 API 25,000건/일
- 요청 URL: `https://openapi.naver.com/v1/search/news.json`
- 응답 인코딩: UTF-8, 제목/설명에 `<b>` HTML 태그 포함 → 클라이언트에서 자동 제거

---

## 카카오 Daum Search API 준비 방법

1. [카카오 개발자 사이트](https://developers.kakao.com) 접속 → 애플리케이션 추가
2. **REST API 키** 확인 (앱 키 목록에서)
3. 활성화 설정 → **Daum 검색** 동의 필요 없음 (자체 API)
4. `.env.local`에 저장

```
KAKAO_REST_API_KEY=발급받은_REST_API_키
```

- 요청 URL: `https://dapi.kakao.com/v2/search/news`
- 응답: JSON, HTML 태그 없음

---

## .env.local 설정 (절대 커밋하지 않음)

```env
# 트렌드 수집 모드 (true = 실제 API, false = mock)
TREND_COLLECTION_ENABLED=true

# 네이버 뉴스 검색 API
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...

# 카카오 Daum 뉴스 검색 API
KAKAO_REST_API_KEY=...
```

---

## .env.example 설정 (커밋 가능, 값은 비워둠)

```env
TREND_COLLECTION_ENABLED=false
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
KAKAO_REST_API_KEY=
```

---

## mock mode vs real API mode

| 항목 | mock mode | real API mode |
|---|---|---|
| `TREND_COLLECTION_ENABLED` | `false` | `true` |
| 데이터 소스 | `mock-trend-provider.ts` | 네이버/다음 API |
| API 호출 | 없음 | 있음 (seed queries × 플랫폼) |
| API key 필요 | 불필요 | 필요 |
| 결과 신선도 | 고정 mock 데이터 | 실시간 뉴스 |
| rate limit 위험 | 없음 | 있음 |

---

## 수집 흐름 (real API mode)

```
SEED_QUERIES (10개) × 네이버 API (각 5건)
  + SEED_QUERIES (10개) × 다음 API (각 5건)
= 최대 100건 수집 (병렬 실행, Promise.allSettled)

→ URL 기준 중복 제거
→ trend_candidates 저장
→ theme-clusterer로 공통 테마 추출
→ theme_clusters 저장
→ /trends 페이지에 표시
```

한쪽 API가 실패해도 나머지 결과는 저장됨 (partial success).
양쪽 모두 실패하면 명확한 오류 메시지 반환.

---

## seed 검색어

`lib/trends/seed-queries.ts`에 정의:

```
AI, 반도체, 전기차, 부동산, 경제, 의료, 돌봄, 고령화, 교육, 정치
```

향후 사용자가 관심 카테고리를 직접 선택할 수 있도록 확장 가능.

---

## API key 보안 원칙

- `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `KAKAO_REST_API_KEY`는 `NEXT_PUBLIC_` 접두사를 사용하지 않음 → 클라이언트 번들에 포함되지 않음
- API 호출은 Server Component / Server Action에서만 수행
- `/trends` 페이지에는 key 설정 여부(설정됨/미설정)만 표시하고 실제 값은 절대 노출하지 않음
- `console.log`로 key를 출력하지 않음
- 코드, 테스트, 문서, 로그에 실제 key를 기재하지 않음

---

## 랭킹 페이지 직접 스크래핑을 하지 않는 이유

- 이용약관 위반 가능성 (robots.txt, 서비스 이용약관)
- 페이지 구조 변경 시 즉시 깨짐
- IP 차단 위험
- 공식 API: 안정적, 구조화된 데이터, 합법적 사용 보장

---

## pipeline_logs 이벤트

| 이벤트 | 설명 |
|---|---|
| `trend_collection_started` | 전체 수집 시작 |
| `naver_trend_collection_started` | 네이버 수집 시작 |
| `naver_trend_collection_completed` | 네이버 수집 완료 (건수 포함) |
| `naver_trend_collection_failed` | 네이버 수집 실패 (key 없음, 인증 오류 등) |
| `daum_trend_collection_started` | 다음 수집 시작 |
| `daum_trend_collection_completed` | 다음 수집 완료 |
| `daum_trend_collection_failed` | 다음 수집 실패 |
| `trend_collection_completed` | 전체 수집 완료 |
| `trend_collection_failed` | 전체 수집 실패 |
| `theme_clustering_started` | 클러스터링 시작 |
| `theme_clustering_completed` | 클러스터링 완료 |

---

## 알려진 한계

- theme-clusterer의 키워드 그룹(AI, 반도체, 전기차 등)이 고정되어 있음 → 수집된 실제 뉴스 토픽과 그룹이 맞지 않으면 클러스터 생성 안 됨
- seed queries가 고정되어 있어 사용자가 원하는 분야만 수집하기 어려움
- trend_candidates에 중복 URL 방지 제약이 없어 여러 번 수집하면 같은 URL이 쌓임
- 네이버/다음 무료 API는 검색 결과이므로 실시간 랭킹이 아닌 검색 관련성 기반

---

## 실제 API key를 넣고 확인하는 방법

1. `.env.local`에 키 설정 후 `TREND_COLLECTION_ENABLED=true` 추가
2. 개발 서버 재시작: `npm run dev`
3. `/trends` 페이지 접속 → 상단 상태 바에 "Real API 모드", "네이버: 설정됨", "다음(카카오): 설정됨" 확인
4. "트렌드 수집 + 공통 테마 추출 실행" 버튼 클릭
5. 수집 완료 메시지와 함께 실제 기사 목록 + 공통 테마 카드 확인
6. Supabase 콘솔 → `trend_candidates` 테이블에 실제 기사 데이터 확인
7. `pipeline_logs`에서 `naver_trend_collection_completed`, `daum_trend_collection_completed` 이벤트 확인
