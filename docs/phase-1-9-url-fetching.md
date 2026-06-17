# Phase 1-9: URL 본문 자동 수집

> 사용자가 URL을 등록하면 시스템이 서버에서 해당 페이지의 HTML을 가져와
> 본문 텍스트를 추출하고 `sources.raw_content`에 저장한다.
> 이후 기사 생성 품질을 높이기 위한 기반 작업이다.

---

## 1. 목적

현재 사용자가 URL과 함께 요약(summary)을 직접 입력해야 AI 기사 품질이 안정적이다.
이 단계에서는 URL만 입력하면 시스템이 본문을 수집·저장하도록 만들어,
향후 AI가 `raw_content`를 기반으로 더 풍부한 요약을 생성할 수 있게 한다.

---

## 2. sources 테이블 확장 컬럼

| 컬럼 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `fetch_status` | `text` NOT NULL | `'pending'` | 수집 상태 (`pending` / `success` / `failed`) |
| `raw_content` | `text` | NULL | 추출된 본문 텍스트 (최대 50,000자) |
| `extracted_title` | `text` | NULL | HTML `<title>` 태그에서 추출한 제목 |
| `fetched_at` | `timestamptz` | NULL | 수집 완료 시각 |
| `fetch_error` | `text` | NULL | 수집 실패 원인 메시지 |

migration: `db/migrations/007_sources_fetch_columns.sql`

---

## 3. 수집 흐름

```
사용자가 URL 포함 출처 등록 제출
  ↓
addSource() — sources 테이블에 저장 (fetch_status='pending')
  ↓
fetchUrlContent(url) — 서버에서 HTTP GET
  ↓
updateSourceFetchResult(sourceId, result)
  — fetch_status, raw_content, extracted_title, fetched_at, fetch_error 업데이트
  ↓
pipeline_log 기록 (source_added / success or failed)
```

수집이 실패해도 source 자체는 삭제되지 않는다.
URL이 비어있으면 fetch를 실행하지 않고 fetch_status='pending'으로 유지한다.

---

## 4. 보안 제한

`lib/services/url-fetcher.ts`에서 적용한다.

| 제한 | 내용 |
|------|------|
| 프로토콜 | `http://` / `https://` 전용. 그 외 scheme 차단 |
| private IP | localhost / 127.x / 10.x / 172.16-31.x / 192.168.x / 169.254.x 차단 (SSRF 방지) |
| IPv6 | `::1` / fc00::/7 private 차단 |
| 타임아웃 | 10초 초과 시 AbortError → failed |
| 크기 제한 | 응답 1 MB 이상 수신 중단, 텍스트 50,000자 저장 |
| content-type | `text/html` / `text/plain` / `application/xhtml` 이외 차단 |

---

## 5. HTML 파싱 방식

전용 HTML 파싱 라이브러리 없이 정규식 기반으로 처리한다 (MVP 범위).

1. `<script>`, `<style>`, `<nav>`, `<footer>`, `<header>`, `<aside>` 태그 블록 제거
2. 나머지 HTML 태그 제거 (`<[^>]+>` → 공백)
3. HTML 엔티티 디코딩 (`&amp;` → `&` 등)
4. 연속 공백 정규화

---

## 6. UI 표시

`/dashboard` 출처 목록에서 각 출처 오른쪽에 배지를 표시한다.

| fetch_status | 배지 |
|---|---|
| `success` | 본문 수집 완료 (초록) |
| `failed` | 수집 실패 (빨강, hover 시 오류 메시지) |
| `pending` | 수집 대기 (노랑) |

수집 실패 시 오류 메시지를 배지 아래 텍스트로 표시한다.

---

## 7. 아직 남은 한계

- 기사 생성 시 `raw_content`를 아직 활용하지 않는다 (Phase 1-10 이후 예정).
  현재는 사용자 입력 `summary`만 사용한다.
- SPA/JavaScript 렌더링 페이지는 정적 HTML fetch로 본문을 추출하지 못한다.
- 기존 등록된 출처는 `fetch_status='pending'`으로 유지되며 소급 수집하지 않는다.
- 리다이렉트 횟수 제한은 Node.js `fetch` 기본값(브라우저 동등)에 의존한다.

---

## 참고

- `lib/services/url-fetcher.ts` — 수집 서비스 (`fetchUrlContent`)
- `lib/repositories/source-repository.ts` — `updateSourceFetchResult`
- `app/dashboard/actions.ts` — `addSource` 서버 액션
- `db/migrations/007_sources_fetch_columns.sql` — Supabase 적용 migration
