# 요구사항 정의 (Requirements)

> REG Engineering: 이 문서는 content-pipeline MVP의 기능 요구사항과 범위를 정의한다.
> 새 기능을 추가하거나 변경할 때는 이 문서와 docs/acceptance-criteria.md를 먼저 갱신한 뒤 구현한다.

## 1. 개요
content-pipeline은 사용자가 입력한 주제와 출처(source)를 근거로 블로그/홈페이지용
기사 초안을 자동 생성하고, 계약 검사(Reins)와 AI 평가(Evals)를 거쳐 사용자가
최종 승인하는 콘텐츠 파이프라인이다.

## 2. 범위

### 2.1 포함 (In Scope - MVP)
- 주제 입력
- 출처 URL/메타데이터 등록 및 DB 저장
- 출처 기반 기사 초안 생성 (draft)
- 계약 검사 (`contracts/source.contract.yaml`, `contracts/article.contract.yaml`)
- AI Evals를 통한 기사 품질 평가
- 사용자 승인을 통한 reviewed 상태 전환
- 파이프라인 실행 로그 기록

### 2.2 제외 (Out of Scope - 이번 MVP)
- 이미지 생성
- 영상 생성
- Hermes Agent 연동
- 복잡한 자동화 (예약 발행, 자동 게시, 다단계 멀티 에이전트 등)
- published 상태로의 게시 흐름 (DB/타입 구조만 마련하고 동작은 구현하지 않음)

## 3. 용어 정의

| 용어 | 정의 |
|---|---|
| Topic(주제) | 사용자가 입력한 기사 주제. 출처와 기사 초안의 상위 단위 |
| Source(출처) | 기사 작성의 근거가 되는 외부 자료 (URL + 메타데이터) |
| Article(기사) | 출처를 근거로 생성된 기사 본문. draft → reviewed 상태를 가짐 |
| Contract(계약) | 각 파이프라인 단계가 만족해야 하는 조건 집합 (YAML로 정의) |
| Eval(평가) | AI를 이용한 기사 품질 평가 |
| Approval Gate(승인 게이트) | 사람의 명시적 승인 없이는 상태 전환을 막는 장치 |
| Pipeline Log | 파이프라인 각 단계의 실행 결과를 기록한 로그 (`pipeline_logs`) |
| Agent Run(에이전트 실행) | AI/에이전트(LLM) 호출 자체의 입력/출력 실행 기록 (`agent_runs`) |

## 4. 기능 요구사항 (Functional Requirements)

### FR-1. 주제 입력
사용자는 기사 주제(제목, 설명)를 입력할 수 있다.

### FR-2. 출처 등록
사용자는 주제에 대해 하나 이상의 출처(URL, 제목, 작성자, 게시일, 요약 등 메타데이터)를
등록할 수 있다.

### FR-3. 출처 저장
등록된 출처는 `sources` 테이블에 주제(topic)와 연결되어 저장된다.

### FR-4. 기사 초안 생성
시스템은 등록된 출처를 근거로 기사 초안(제목, 본문, 인용 출처 목록)을 생성한다.

### FR-5. Draft 저장
생성된 기사 초안은 반드시 `status = 'draft'`로 저장된다. 다른 상태로 직접
생성하는 것은 허용되지 않는다.

### FR-6. 최소 출처 수 검사
주제에 등록된 출처가 3개 미만이면 기사 생성을 시작하지 않고 파이프라인을 중단한다.

### FR-7. 계약 검사
- 출처 등록 이후, 기사 생성을 시작하기 전에 `source.contract.yaml`을 통과해야 한다.
- 기사 초안 생성 직후, 저장 및 AI 평가로 진행하기 전에 `article.contract.yaml`을
  통과해야 한다.
- 계약 검사를 통과하지 못하면 파이프라인은 즉시 중단되고, 위반 사유가 로그로 남는다.

### FR-8. AI Evals
`article.contract.yaml`을 통과한 기사 초안은 `evals/article-quality.eval.yaml`에
정의된 기준에 따라 AI로 품질 평가를 받는다. 평가 결과(기준별 점수, 종합 점수,
통과 여부, 코멘트)는 저장되고 사용자에게 표시된다.

### FR-9. 사용자 승인 (Human Approval)
AI 평가 결과와 무관하게, 기사 초안의 `status`를 `reviewed`(또는 향후 `published`)로
전환하는 작업은 사용자의 명시적 승인이 있어야만 수행된다. 어떤 자동화 로직도
승인 없이 상태를 전환할 수 없다.

### FR-10. 실행 로그
주제 생성, 출처 등록, 계약 검사, 기사 생성, AI 평가, 사용자 승인 등 주요
파이프라인 단계의 실행 결과는 `pipeline_logs`에 기록된다 (단계, 상태, 메시지,
상세 정보, 시각). 각 로그/실행 기록 테이블의 역할 구분은 7장을 참고한다.

## 5. 비기능 요구사항 (Non-Functional Requirements)

### NFR-1. 타입 안정성
모든 TypeScript 코드는 strict 모드를 사용하며 `any` 타입을 사용하지 않는다.

### NFR-2. 계약 우회 금지
계약 검사를 통과하지 못한 데이터는 다음 단계로 전달되지 않는다
(DB 저장, 상태 전환이 코드 레벨에서 차단되어야 한다).

### NFR-3. 일관된 API 응답 형식
API 응답은 `{ success: true, data }` 또는 `{ success: false, error }` 형식을 따른다.

### NFR-4. 추적 가능성
모든 파이프라인 실행은 `pipeline_logs`를 통해 사후 추적이 가능해야 한다.

### NFR-5. CI 검증
모든 PR은 GitHub Actions에서 lint, typecheck, test를 통과해야 한다.

## 6. 상태 모델

### Topic 상태
```
draft → sources_ready → generating → drafted → reviewed
                                          ↘ failed (계약/평가 실패 시)
```

### Article 상태
```
draft → reviewed → published (published은 MVP 이후, 구조만 정의)
```

## 7. DB 테이블 역할 정리

`db/schema.sql`에 정의된 실제 테이블과 역할은 다음과 같다. 코드(`lib/repositories/*`)가
사용하는 테이블명/컬럼명을 기준으로 작성되었으며, 스키마 변경 시 이 표도 함께
갱신한다.

### 7.1 핵심 도메인 테이블

| 테이블 | 역할 | 사용 코드 |
|---|---|---|
| `themes` | 사용자가 입력한 기사 주제 (제목, 설명, 키워드, 언어, 상태) | `lib/repositories/theme-repository.ts` |
| `sources` | 주제별 출처 (URL, 제목, 작성자, 게시일, 요약) | `lib/repositories/source-repository.ts` |
| `articles` | 출처를 근거로 생성된 기사 초안/본문 | `lib/repositories/article-repository.ts` |
| `article_sources` | 기사가 인용한 출처의 다대다 연결 | `lib/repositories/article-repository.ts` |

### 7.2 로그/실행 기록 테이블

파이프라인 실행과 관련된 기록은 역할에 따라 다음 테이블로 분리하여 저장한다.

| 테이블 | 역할 | 사용 코드 |
|---|---|---|
| `pipeline_logs` | 대시보드 및 파이프라인 이벤트 로그 (FR-10). 상세 정보는 `details_json`(jsonb) 컬럼에 저장한다. `event`/`status`는 `LogEventType`/`LogStatus` 값을 저장하는 현재 사용 컬럼이고, `stage`/`target_type`/`target_id`는 Phase 2 오케스트레이터(`lib/harness/pipeline.ts`)를 위한 자리만 마련해 둔 컬럼이다 (현재 값 없음). `details`(jsonb)는 과거 데이터 보존을 위해 남겨둔 컬럼으로 더 이상 사용하지 않는다 | `lib/repositories/log-repository.ts` (`logEvent`/`getLogs`) |
| `contract_runs` | 계약 검사(Reins Engineering) 실행 결과 이력. `theme_id`, `target_type`, `target_id`, `contract_name`, `passed`, `violations`은 기존 사용 컬럼이고, `status`(passed로부터 산출), `source_count`(검사 시점 출처 개수), `failed_conditions`(실패한 규칙 ID 목록)는 새로 추가되어 `recordContractCheck`가 채운다. `article_id`/`stage`/`details_json`/`details`는 Phase 2를 위한 자리만 마련해 둔 컬럼이다 | `lib/repositories/log-repository.ts` (`recordContractCheck`/`getLatestContractCheck`) |
| `agent_runs` | AI/에이전트(LLM) 호출 자체의 실행 기록 (입력/출력, 성공·실패) | 스키마/타입만 정의 (Phase 2: `lib/ai/generate-article.ts`, `lib/ai/eval-article.ts`) |
| `eval_runs` | AI Evals 평가 결과 기록 (FR-8) | 스키마/타입만 정의 (Phase 2: `lib/ai/eval-article.ts`, `evals/article-quality.eval.yaml` 기준) |
| `approval_logs` | 사용자 승인(Human Approval) 이벤트 기록 (FR-9) | 스키마/타입만 정의 (MVP 이후 `lib/harness/approval-gate.ts`와 연결 예정) |
| `publish_logs` | 기사 게시(publish) 이벤트 기록 | 스키마/타입만 정의 (MVP 이후, `article.status = 'published'` 흐름과 함께 구현) |

### 7.3 DB 스키마 적용

- 신규 프로젝트: `db/schema.sql` 전체를 Supabase SQL Editor에서 실행한다.
- 기존 DB와 코드 간 schema 불일치가 발생한 경우: `db/migrations/001_align_dashboard_schema.sql`을
  실행한다. `create table if not exists` / `alter table ... add column if not exists` 형식만
  사용하므로 기존 데이터를 삭제하지 않고 여러 번 실행해도 안전하다 (idempotent).
  `sources.publisher`/`reliability_score`/`collected_at`은 Phase 2 placeholder 컬럼이며
  현재 코드는 값을 쓰지 않는다.

## 8. 관련 문서
- `docs/acceptance-criteria.md` - 기능별 성공 기준
- `docs/phase-1-plan.md` - Phase 1 구현 계획
- `contracts/*.yaml` - 단계별 계약 정의
- `evals/*.yaml` - AI 평가 기준
