# Phase 1-6: Vercel 배포 준비

> Phase 1-5까지 완료된 mock mode 기준 MVP를 Vercel에 배포한다.
> 이 단계에서는 `AI_GENERATION_ENABLED=false`(mock mode)로 배포하며,
> Anthropic API key는 아직 등록하지 않는다.

## 배포 목적

- mock mode 기준 전체 흐름(테마 생성 → 출처 등록 → 기사 초안 생성 → 기사 검토 → 승인)이
  Vercel 환경에서도 정상 동작함을 확인한다.
- 실제 Supabase DB와 연결하여 데이터 영속성을 검증한다.

---

## 1. GitHub import 방법

1. `vercel.com` 로그인 후 **Add New → Project** 클릭
2. **Import Git Repository**에서 `content-pipeline` 저장소 선택
3. **Framework Preset**이 `Next.js`로 자동 감지되는지 확인
4. **Root Directory**는 비워둔다 (저장소 루트가 Next.js 프로젝트임)
5. 아래 "환경변수 등록" 섹션의 값을 입력한 뒤 **Deploy** 클릭

---

## 2. 필요한 환경변수 (Vercel > Settings > Environment Variables)

| 변수명 | 설명 | 필수 여부 |
|--------|------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | **필수** |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key | **필수** |
| `SUPABASE_SECRET_KEY` | Supabase service_role key (서버 전용) | **필수** |
| `AI_GENERATION_ENABLED` | `false` (mock mode 배포) | **필수** |
| `AI_PROVIDER` | `anthropic` | 선택 (없으면 기본값 anthropic) |
| `ANTHROPIC_API_KEY` | Anthropic API key | 선택 (AI mode 사용 시만 필요) |

> `SUPABASE_SECRET_KEY`는 서버 전용이므로 `NEXT_PUBLIC_` 접두사를 붙이지 않는다.
> Vercel이 자동으로 서버 번들에만 포함한다.

### Supabase 키 확인 위치

Supabase 대시보드 → Project Settings → API:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / public** → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- **service_role** → `SUPABASE_SECRET_KEY`

---

## 3. mock mode 설정

`AI_GENERATION_ENABLED=false`로 설정하면:
- `shouldUseAnthropic()`이 `false`를 반환한다
- `getAnthropicClient()`가 호출되지 않으므로 `ANTHROPIC_API_KEY` 없이도 동작한다
- 기사 생성은 `generateMockArticleDraft()`, 평가는 `evaluateArticleMock()`을 사용한다

`ANTHROPIC_API_KEY`를 등록하지 않아도 `/dashboard`, `/articles`, `/articles/[id]` 모두
정상 동작한다.

---

## 4. 정적 파일 번들 포함 확인

`evals/`, `contracts/`, `prompts/` 디렉터리의 YAML/MD 파일은 서버 런타임에
`readFileSync`로 읽힌다. Vercel 서버리스 번들에 자동으로 포함되지 않을 수 있으므로
`next.config.ts`에 다음 설정이 추가되어 있다:

```ts
outputFileTracingIncludes: {
  "**": ["./evals/**", "./contracts/**", "./prompts/**"],
}
```

이 설정이 없으면 배포 후 기사 초안 생성 시 `ENOENT` 오류가 발생할 수 있다.

---

## 5. Supabase 연결 확인

배포 전에 Supabase 프로젝트에 최신 migration이 적용되어 있어야 한다.

`db/migrations/` 디렉터리의 SQL 파일을 순서대로 Supabase SQL Editor에서 실행한다:

1. `001_align_dashboard_schema.sql` — 기본 테이블 구조 정렬
2. `002_articles_content_column.sql` — `articles.content` 컬럼 보장
3. `003_eval_runs_score_column.sql` — `eval_runs.score` 컬럼 default 보장
4. `004_approval_logs_target_columns.sql` — `approval_logs.target_type/target_id` 추가

또는 `db/schema.sql` 전체를 신규 Supabase 프로젝트에 적용한다.

---

## 6. 배포 후 확인할 페이지와 순서

| 단계 | URL | 확인 내용 |
|------|-----|-----------|
| 1 | `/dashboard` | 페이지 로드, 테마 목록 표시 |
| 2 | `/dashboard` | 새 테마 생성 → URL에 `?themeId=...` 반영 |
| 3 | `/dashboard` | 출처 3개 등록 → "조건 충족" 뱃지 표시 |
| 4 | `/dashboard` | "기사 초안 생성" 클릭 → 계약 검사 통과, 기사 초안 생성 |
| 5 | `/articles` | 목록에 새 기사 표시, 평가 점수 확인 |
| 6 | `/articles/[id]` | 상세 페이지: 본문, 출처, 평가 결과, 로그 확인 |
| 7 | `/articles/[id]` | 제목/본문 수정 후 저장 → 수정 반영 확인 |
| 8 | `/articles/[id]` | "승인하기" 클릭 → status가 `reviewed`로 변경 확인 |
| 9 | `/articles/[id]` | 승인 후 수정 폼 미표시, 승인일/승인자 표시 확인 |

---

## 7. 자주 발생하는 오류와 해결 방법

### `ENOENT: no such file or directory, open '.../evals/...'`

**원인**: `evals/`, `contracts/`, `prompts/` 파일이 서버리스 번들에 포함되지 않았다.

**해결**: `next.config.ts`에 `outputFileTracingIncludes` 설정이 있는지 확인한다.
현재 프로젝트에는 이미 추가되어 있다.

---

### `Supabase 서버 클라이언트를 생성하려면 ... 환경 변수가 필요합니다`

**원인**: Vercel 환경변수에 `NEXT_PUBLIC_SUPABASE_URL` 또는 `SUPABASE_SECRET_KEY`가
등록되지 않았다.

**해결**: Vercel 대시보드 → Settings → Environment Variables에서 두 값을 등록한다.
등록 후 **Redeploy** 해야 새 환경변수가 적용된다.

---

### `승인 로그 저장에 실패했습니다: null value in column "target_type"`

**원인**: Supabase DB에 `db/migrations/004_approval_logs_target_columns.sql`이
적용되지 않았다.

**해결**: Supabase SQL Editor에서 해당 migration 파일을 실행한다.

---

### `null value in column "score" of relation "eval_runs"`

**원인**: Supabase DB에 `db/migrations/003_eval_runs_score_column.sql`이
적용되지 않았다.

**해결**: Supabase SQL Editor에서 해당 migration 파일을 실행한다.

---

### Build 실패: TypeScript 오류

**원인**: Vercel의 Node.js 버전 또는 패키지 버전 불일치.

**해결**: Vercel 프로젝트 Settings → General → Node.js Version을 `20.x`로 설정한다.

---

## 8. 현재 배포 범위 외 항목 (MVP 이후)

- `published` 상태 전환 및 WordPress 게시
- 이미지 생성, 영상 생성, Hermes Agent
- 사용자 인증/권한 관리 (현재 `reviewed_by='local-user'` 고정)
- AI mode 활성화(`AI_GENERATION_ENABLED=true` + `ANTHROPIC_API_KEY` 등록)는
  Vercel 배포 안정성 확인 후 별도로 진행한다

---

## 참고

- `docs/phase-1-5-review-approval.md` — 기사 검토·수정·승인 흐름 상세
- `docs/known-issues.md` — 중복 URL 등록 Runtime Error 등 알려진 문제
- `db/schema.sql` — 전체 DB 스키마 (신규 Supabase 프로젝트용)
- `db/migrations/` — 기존 DB 마이그레이션 파일 (순서대로 적용)
