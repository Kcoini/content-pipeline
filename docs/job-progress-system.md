# Job Progress System (Phase 4-17)

## 문제

버튼을 누른 뒤 내부적으로 여러 단계(트렌드 수집, 마스터 원고 생성,
블로그/SNS 글 생성, 자동 검토, WordPress Draft 반영, SEO 반영, 대표
이미지 업로드 등)가 실행되지만, 화면에서 진행 상황을 알기 어려웠다.
사용자는 작업이 멈춘 것인지, 진행 중인지, 완료된 것인지 판단할 수
없었고, 버튼 클릭 후 화면 변화가 없으면 다시 눌러야 할지 기다려야
할지 알 수 없었다.

## 해결 개요

여러 단계로 이루어진 내부 작업 하나하나에 `job_runs`/`job_run_steps`
row(run id)를 부여하고, 현재 상태·현재 단계·완료 단계 수·마지막 진행
시각을 저장한다. 화면은 이 값을 1차로는 polling(2.5초 간격)으로
읽어와 `JobProgressCard`로 보여준다. Supabase Realtime 연동은 2차
개선으로 남겨 둔다.

## DB 구조

`db/migrations/046_phase-4-17-job-progress-system.sql`에서
`job_runs`/`job_run_steps` 테이블을 새로 만든다(기존 `pipeline_logs`는
건드리지 않는다).

- `job_runs`: 작업 실행 1건. `job_type`/`status`/`current_step_*`/
  `total_steps`/`completed_steps`/`progress_percent`/`user_message`/
  `error_message`/`error_category`/`retryable`/`next_action_*`/
  `started_at`/`last_heartbeat_at`/`finished_at` 등을 가진다.
  `article_id`/`social_post_id`/`theme_id`/`target_type`+`target_id`로
  대상과 연결한다.
- `job_run_steps`: `job_run_id` 하나에 속한 단계들. `step_order`/
  `step_key`/`step_label`/`status`/`message`/`error_message`를 가진다.

status는 다음 값을 공유한다(`lib/job-progress/job-progress-types.ts`):
`not_started`/`queued`/`running`/`waiting_user`/`retrying`/
`partial_success`/`completed`/`failed`/`blocked`/`cancelled`/`stalled`
(`job_run_steps`는 여기에 `skipped`가 추가된다). **raw status는 기본
화면에 노출하지 않는다** — `lib/job-progress/job-progress-labels.ts`의
`getJobStatusLabel()`/`getJobStatusTone()`으로 변환한 한국어 문구/색을
먼저 보여주고, raw 값은 배지의 `title` 속성과 "상세 단계 보기" 접힘
영역에서만 확인할 수 있다.

저장 금지: API key/auth token/Authorization header/Application
Password/full article body/full social post body/full prompt/full AI
response/image binary/raw full external API response. `error_message`는
항상 짧고 안전한 요약 문자열만 저장한다.

## 코드 구조

- `lib/job-progress/job-progress-types.ts` — 공통 타입(JobStatus 등)과
  `detectStalledJobRun()`(순수 함수, supabase 등 서버 전용 의존성 없음
  — client component에서 직접 import해도 안전하다).
- `lib/job-progress/job-progress-labels.ts` — raw job_type/status →
  한국어 라벨/색(tone) 변환. 알 수 없는 값은 예외 없이 원본을 그대로
  반환한다.
- `lib/job-progress/job-progress-repository.ts` — `job_runs`/
  `job_run_steps` row ↔ 도메인 타입 매핑 및 supabase 접근.
- `lib/job-progress/job-progress-service.ts` — `createJobRun`/
  `createJobSteps`/`startJobRun`/`startJobStep`/`completeJobStep`/
  `skipJobStep`/`failJobStep`/`completeJobRun`/`partialSuccessJobRun`/
  `failJobRun`/`blockJobRun`/`markJobRunWaitingUser`/`heartbeatJobRun`/
  `getJobRunWithSteps`/`getLatestJobRunForTarget`/`markJobRunStalled`
  등 공용 helper. 각 생명주기 전환마다 `pipeline_logs`에도
  `job_run_created`/`job_run_started`/`job_step_started`/
  `job_step_completed`/`job_step_failed`/`job_run_completed`/
  `job_run_partial_success`/`job_run_failed`/`job_run_blocked`/
  `job_run_stalled_detected` 이벤트를 남긴다(컬럼은 `event_name`만
  쓴다 — `event` 컬럼은 쓰지 않는다). 로그 실패는 항상 삼킨다.
  - **`createJobProgressTracker(input, steps)`** — 기존 오케스트레이터에
    최소 침습으로 붙이기 위한 래퍼. job_run 생성이 어떤 이유로든(DB
    오류, 마이그레이션 미적용 등) 실패해도 NOOP tracker를 반환해
    이후 모든 호출이 조용히 무시된다 — **이 tracker가 실패해도 원래
    작업의 성공/실패 결과는 절대 달라지지 않는다.**
- `app/api/job-runs/[id]/route.ts` — `JobProgressPolling`이 읽는
  polling 대상 route(GET). job_run+steps를 그대로 JSON으로 반환한다.
- `components/job-progress/` — `JobStatusBadge`(상태 배지),
  `JobStepList`(단계 목록, 기본 접힘), `JobProgressCard`(카드 전체,
  서버/클라이언트 겸용 순수 컴포넌트), `JobProgressPolling`
  (`"use client"`, 2.5초 간격으로 route를 polling하고 터미널
  상태(`completed`/`failed`/`blocked`/`partial_success`/`cancelled`/
  `waiting_user`)가 되면 멈춘다).

## stalled(멈춤 가능성) 판정

`status`가 `running`/`retrying`인데 `last_heartbeat_at`이 2분
(`STALLED_THRESHOLD_MS`) 이상 지나면 UI가 "멈춤 가능성 있음"으로
표시한다(`detectStalledJobRun()`). **즉시 실패로 단정하지 않는다** —
DB `status`를 자동으로 `stalled`로 바꾸지 않고, 표시만 한다. 별도
cleanup/check action에서만 `markJobRunStalled()`로 실제 DB status를
바꾼다.

## 1차 적용 대상

WordPress 게시 준비 자동 실행
(`lib/social/wordpress-blog-publish-preparation-orchestrator.ts`의
`prepareWordPressBlogPostForPublishing()`)에 우선 연결했다:

- 기존 8단계(`quality`/`approval`/`draft`/`seo_auto_generate`/
  `seo_metadata`/`seo_plugin`/`featured_image`/`publish_guard`)를
  그대로 job_run_steps로 등록한다(새 단계를 만들지 않고 기존
  `STEP_LABELS`를 재사용).
- 모든 반환 경로가 공통으로 거치는 `finishAndPersist()`에서 단계별
  기록과 `finishCompleted`/`finishPartialSuccess`/`finishFailed`를
  한 번에 동기화한다 — 각 단계 분기마다 별도로 계측 코드를 넣지 않아
  실수로 빠뜨릴 여지를 줄였다.
- 결과 타입(`PrepareWordPressBlogPostForPublishingResult`)에
  `jobRunId`를 추가했다. `app/articles/[id]/actions.ts`의
  `prepareWordPressBlogPostForPublishingAction`/
  `approveAndPrepareWordPressBlogPostForPublishingAction`이 이 값을
  `redirectToSafeTarget(..., jobRunId)`로 전달하면, 돌아간
  `/articles/[id]/blog?jobRunId=...`가 `JobProgressPolling`을
  렌더링해 방금 실행한 결과를 보여준다.

마스터 원고 생성/SNS 글 생성/트렌드 수집/관련 URL 수집 등 나머지
작업은 이번 1차 범위에 포함하지 않았다(2차/3차로 남겨 둔다) — 공용
`lib/job-progress/*` helper와 `createJobProgressTracker()`가 이미
있으므로, 각 오케스트레이터의 공통 반환 지점에서 같은 패턴으로
붙이면 된다.

## 알려진 제약 (1차 범위)

- WordPress 게시 준비 자동 실행은 현재 하나의 서버 action 요청 안에서
  동기적으로 전체 단계를 실행한다(백그라운드 job 큐가 아니다). 따라서
  실행 "도중"에 폴링 화면이 실시간으로 단계가 하나씩 올라가는 모습을
  보여주지는 못하고, redirect 이후 **최종 결과**(성공/부분성공/실패와
  단계별 breakdown)를 보여준다. 진짜 장시간 백그라운드 작업(예: 여러
  기사에 걸친 일괄 처리)에 적용하려면 실행 자체를 비동기 큐/작업으로
  분리하는 후속 작업이 필요하다.
- Supabase Realtime 연동(2차)은 아직 하지 않았다 — 현재는 polling만
  지원한다.

## 안전 원칙

- 자동 public publish는 어디에도 추가하지 않았다.
- WordPress에는 여전히 Draft 생성/업데이트까지만 반영한다(변경 없음).
- API key/auth token/Application Password/full body/full prompt/full
  AI response/image binary는 `job_runs`/`job_run_steps`/
  `pipeline_logs` 어디에도 저장하지 않는다.
