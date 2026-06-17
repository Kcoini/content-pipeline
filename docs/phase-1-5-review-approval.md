# Phase 1-5: 기사 검토·수정·승인 흐름

> Phase 1-4에서 생성된 기사 초안(`status='draft'`)을 사용자가 목록/상세
> 화면에서 확인하고, 필요하면 수정한 뒤, 명시적으로 승인(`status='reviewed'`)
> 하는 흐름을 추가한다 (FR-9, Human Approval).

## 추가된 페이지

- `/articles`: 전체 기사 목록. 제목, 상태(draft/reviewed/published), 최신
  AI 평가 점수(`eval_runs.aggregate_score`), 테마 제목, 생성일을 보여주며
  최신 생성순으로 정렬한다.
- `/articles/[id]`: 기사 상세. 다음 정보를 보여준다.
  - 제목/본문/상태, 생성일·수정일·승인일·승인자
  - 연결된 테마(대시보드로 링크)
  - 인용된 출처 목록(제목/출판사/URL)
  - 최신 AI 평가 결과(`eval_runs`)와 기준별 점수
  - 해당 기사와 관련된 `pipeline_logs` 최근 10건

`/dashboard`에는 `/articles`로 이동하는 링크와, 선택된 테마에 기사 초안이
있을 때 해당 기사 상세 페이지(`/articles/[id]`)로 이동하는 "기사
검토/승인하기" 링크를 추가했다.

## draft vs reviewed

| 항목 | draft | reviewed |
| --- | --- | --- |
| 제목/본문 수정 | 가능 (수정 폼 표시) | **불가** (읽기 전용으로 표시) |
| 승인 버튼 | 표시됨 | 표시되지 않음 |
| `reviewed_at` / `reviewed_by` | `null` | 승인 시각 / 승인자 |

reviewed 상태의 기사를 다시 수정 가능하게 하는 것은 이번 Phase의 범위가
아니다 (사용자 정책 결정). `published` 상태로의 전환과 WordPress 게시
기능은 아직 구현하지 않았다 (구조만 `db/schema.sql`에 정의됨).

## 수정 흐름 (`updateDraftArticle`)

`app/articles/[id]/actions.ts`의 `updateArticleAction`(서버 액션)이
`lib/repositories/article-repository.ts`의 `updateDraftArticle()`을 호출한다.

1. `getArticleById()`로 기사를 조회한다. 없으면 `ArticleNotFoundError`.
2. `assertArticleEditable()`로 `status === 'draft'`인지 검사한다.
   draft가 아니면 `ArticleNotEditableError`.
3. `articles.title`, `articles.content`만 갱신한다. `updated_at`은
   `trg_articles_updated_at` 트리거가 자동으로 갱신하므로 코드에서 직접
   쓰지 않는다. `status`는 `draft`로 유지된다.
4. 성공/실패를 `pipeline_logs(event_name='article_updated')`에 기록한다.

## 승인 흐름 (`approveArticle`)

`app/articles/[id]/actions.ts`의 `approveArticleAction`(서버 액션)이
`lib/repositories/article-repository.ts`의 `approveArticle()`을 호출한다.
**이 전환 로직은 서버 액션에서만 실행되며, 클라이언트가 Supabase를 직접
호출하는 경로는 없다.**

1. `getArticleById()`로 기사를 조회한다. 없으면 `ArticleNotFoundError`
   (사용자에게 "기사를 찾을 수 없습니다" 메시지로 표시).
2. `assertArticleApprovable()`로 본문이 비어 있지 않은지 검사한다.
   `content.trim()`이 빈 문자열이면 `EmptyContentError` — 승인이
   거부된다.
3. 이미 `status === 'reviewed'`이면 **아무 작업도 하지 않고** 기존 기사를
   그대로 반환한다 (중복 승인/중복 `approval_logs` 기록 방지).
4. `lib/harness/approval-gate.ts`의 `assertApproved()`를 호출해
   `draft -> reviewed` 전환에 사용자 승인이 있었는지 확인한다
   (`approved: true`, `approvedBy` 필수).
5. `articles` row를 갱신한다.
   - `status = 'reviewed'`
   - `reviewed_at = now()` (서버에서 `new Date().toISOString()`로 계산)
   - `reviewed_by = 'local-user'` (Phase 1-5에는 사용자 인증이 없으므로
     임시 식별자를 사용한다)
6. `lib/repositories/approval-repository.ts`의 `saveApprovalLog()`로
   `approval_logs`에 다음 내용을 기록한다.
   - `article_id`, `theme_id`
   - `target_type = 'article'` (NOT NULL 컬럼, 반드시 전달)
   - `target_id = article_id` (승인 대상 기사의 uuid)
   - `action = 'approve_article'`
   - `status = 'approved'`
   - `approved_by = 'local-user'`
   - `notes = 'Article approved from review screen'`
7. 성공/실패를 `pipeline_logs(event_name='article_approved')`에도 기록한다.

## 오류 처리

- 모든 오류는 `ArticleNotFoundError` / `ArticleNotEditableError` /
  `EmptyContentError` 중 하나(또는 일반 `Error`)로 던져지고, 서버 액션이
  이를 잡아 `/articles/[id]?error=...` 쿼리 파라미터로 리다이렉트한다.
  상세 페이지는 이 값을 읽어 빨간 배너로 표시한다. Next.js의 기본 Runtime
  Error 화면은 노출되지 않는다.

## 추가/변경된 repository 함수

- `lib/repositories/article-repository.ts`
  - `mapArticleRowToArticle`: `updatedAt`, `reviewedAt`, `reviewedBy` 추가
  - `getArticles()`, `getArticleById()`
  - `updateDraftArticle()`, `approveArticle()`
  - `assertArticleEditable()`, `assertArticleApprovable()` (순수 검증 함수)
  - `ArticleNotFoundError`, `ArticleNotEditableError`, `EmptyContentError`
- `lib/repositories/approval-repository.ts` (신규)
  - `saveApprovalLog()`, `getApprovalLogsByArticleId()`, `mapApprovalLogRow()`
- `lib/repositories/eval-repository.ts`
  - `getLatestEvalRun` → `getLatestEvalByArticleId`로 이름 변경
- `lib/repositories/source-repository.ts`
  - `getSourcesByArticleId()` 추가
- `lib/repositories/log-repository.ts` / `lib/harness/logger.ts`
  - `LogEventType`에 `article_updated`, `article_approved` 추가
  - `getLogsByArticleId()` 추가

## mock mode 기준 동작 확인

이 Phase는 `AI_GENERATION_ENABLED=false`(mock mode) 기준으로 구현/검증했다.
`ANTHROPIC_API_KEY`가 없어도 `npm run lint`, `npm run test`, `npm run build`가
모두 통과한다. AI mode(`shouldUseAnthropic()`)에서의 실제 호출 검증은 이번
Phase 범위가 아니며 별도로 진행한다.

## 다음 단계

- AI mode(`AI_GENERATION_ENABLED=true` + `ANTHROPIC_API_KEY`)에서의
  기사 생성 → 검토 → 승인 end-to-end 동작 확인
- `published` 상태 전환 및 WordPress 게시 흐름(Phase 2 이후)
- Vercel 배포 및 환경변수 설정
- `docs/known-issues.md`의 중복 URL 등록 Runtime Error 개선
