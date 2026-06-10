# content-pipeline

Next.js + TypeScript + Supabase 기반의 블로그/홈페이지용 기사 자동 생성 MVP.

"주제 입력 → 출처 등록/저장 → 계약 검사(Reins) → 기사 초안 생성(draft) →
AI Evals → 사용자 승인(reviewed)" 순서로 동작하는 콘텐츠 파이프라인이다.

## 기술 스택
- Next.js 16 (App Router) / React 19 / TypeScript (strict)
- Tailwind CSS, shadcn/ui
- Supabase (PostgreSQL)
- Zustand, React Hook Form + Zod
- GitHub Actions (CI)

## 폴더 구조

```
content-pipeline/
├── app/                    # Next.js App Router (UI + API Route Handlers)
├── lib/
│   ├── harness/            # contract-runner, approval-gate, logger
│   ├── ai/                 # 기사 생성/평가 (Phase 1 이후)
│   ├── supabase/           # Supabase 클라이언트 (Phase 1 이후)
│   └── types/              # 도메인 타입
├── contracts/              # 단계별 계약 정의 (YAML)
│   ├── source.contract.yaml
│   └── article.contract.yaml
├── evals/                  # AI 평가 기준 정의 (YAML)
│   └── article-quality.eval.yaml
├── prompts/                # LLM 프롬프트 템플릿
│   ├── generate-article.prompt.md
│   └── eval-article.prompt.md
├── db/
│   └── schema.sql          # Supabase DB 스키마
├── docs/
│   ├── requirements.md
│   ├── acceptance-criteria.md
│   └── phase-1-plan.md
├── AGENTS.md / CLAUDE.md    # 에이전트/개발 가이드
└── README.md
```

## 개발 환경 설정

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수
프로젝트 루트에 `.env.local`을 생성한다 (`.env*`는 `.gitignore`에 의해 git에
커밋되지 않는다).

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
# AI 모델 호출용 API Key (evals/article-quality.eval.yaml의 model 설정 참고)
ANTHROPIC_API_KEY=...
```

### 3. DB 스키마 적용
Supabase 프로젝트의 SQL Editor에서 `db/schema.sql`을 실행한다.

### 4. 개발 서버 실행
```bash
npm run dev
```
http://localhost:3000 에서 확인한다.

## 파이프라인 단계와 계약

| 단계 | 설명 | 관련 계약/평가 |
|---|---|---|
| 1. 주제 입력 | 사용자가 기사 주제(제목/설명) 입력 | - |
| 2. 출처 등록 | URL + 메타데이터 등록, DB 저장 | `contracts/source.contract.yaml` |
| 3. source_validation | 출처 3개 이상 등 최소 조건 검사 | `contracts/source.contract.yaml` |
| 4. article_generation | 출처 기반 기사 초안 생성 (status=draft) | `prompts/generate-article.prompt.md` |
| 5. article_contract_check | 기사 초안 계약 검사 | `contracts/article.contract.yaml` |
| 6. article_eval | AI Evals로 품질 평가 | `evals/article-quality.eval.yaml` |
| 7. human_review | 사용자 승인 → status=reviewed | `lib/harness/approval-gate.ts` |

각 단계의 시작/성공/실패는 `lib/harness/logger.ts`를 통해 `pipeline_logs`에
기록된다 (FR-10). 계약 검사를 통과하지 못하면 해당 단계에서 파이프라인이
즉시 중단된다.

## GitHub 운영 방법

### 브랜치 전략
- `main`: 항상 배포 가능한 상태를 유지한다.
- 기능 개발은 `feature/*` (또는 `fix/*`) 브랜치에서 진행한 뒤 PR로 `main`에 병합한다.

### 커밋 메시지
- 한국어로 작성한다.
- 예: `출처 등록 API 추가`, `article.contract 위반 시 파이프라인 중단 처리`

### PR 규칙
- PR 설명에 관련 요구사항 번호(`docs/requirements.md`의 FR-N)를 명시한다.
- `docs/acceptance-criteria.md`의 해당 체크리스트를 충족했는지 확인한다.
- 계약(`contracts/*.yaml`)이나 스키마(`db/schema.sql`)를 변경할 때는
  관련 문서(`docs/`)도 함께 업데이트한다.
- CI(lint, typecheck, test)를 통과해야 머지할 수 있다.

### CI/CD
GitHub Actions에서 `lint`, `typecheck`(`tsc --noEmit`), `test`를 실행한다
(`.github/workflows/ci.yml`, Phase 1에서 추가 예정 — `docs/phase-1-plan.md` 참고).

## 관련 문서
- `docs/requirements.md` - 요구사항 정의
- `docs/acceptance-criteria.md` - 기능별 성공 기준
- `docs/phase-1-plan.md` - Phase 1 구현 계획
- `AGENTS.md` / `CLAUDE.md` - 에이전트 작업 가이드
