# 성공 기준 (Acceptance Criteria)

> REG Engineering: docs/requirements.md에 정의된 각 기능 요구사항(FR)에 대한
> 성공 기준을 정의한다. 구현 완료 여부는 이 문서의 체크리스트 충족 여부로 판단한다.

## AC-1. 주제 입력 (FR-1)
- [ ] 사용자는 제목(필수)과 설명(선택)을 입력해 주제를 생성할 수 있다.
- [ ] 제목이 비어있으면 생성이 거부되고 오류 메시지가 표시된다.
- [ ] 생성된 주제는 `status = 'draft'`로 `topics` 테이블에 저장된다.

## AC-2. 출처 등록 및 저장 (FR-2, FR-3)
- [ ] 사용자는 주제 상세 화면에서 출처 URL과 메타데이터(제목, 작성자, 게시일, 요약)를
      입력할 수 있다.
- [ ] `url`과 `title`은 필수 입력값이다.
- [ ] `url` 형식이 `http(s)`가 아니면 등록이 거부된다.
- [ ] 동일 주제 내에서 동일한 `url`은 중복 등록할 수 없다.
- [ ] 등록된 출처는 `sources` 테이블에 `topic_id`와 함께 저장된다.

## AC-3. 최소 출처 수 검사 (FR-6, FR-7)
- [ ] 주제에 등록된 출처가 3개 미만인 상태에서 "기사 생성"을 실행하면,
      `source.contract.yaml`의 `min-source-count` 규칙에 의해 파이프라인이 중단된다.
- [ ] 중단 사유가 `pipeline_logs`에 `stage='source_validation'`,
      `status='failed'`로 기록된다.
- [ ] 사용자에게 "출처가 3개 이상 필요합니다" 형태의 안내가 표시된다.

## AC-4. 기사 초안 생성 및 Draft 저장 (FR-4, FR-5)
- [ ] 출처가 3개 이상이고 `source.contract.yaml`을 통과하면 기사 생성이 실행된다.
- [ ] 생성된 기사는 `title`, `content`, 인용된 source id 목록(최소 3개)을 포함한다.
- [ ] 생성된 기사는 `status = 'draft'`로 `articles` 테이블에 저장되며,
      `article_sources` 테이블에 인용 관계가 저장된다.
- [ ] `article.contract.yaml`의 `initial-status-draft` 규칙을 위반하는 방식으로는
      기사를 생성할 수 없다 (코드 레벨에서 강제, draft 외 상태로 직접 insert 불가).

## AC-5. 기사 계약 검사 (FR-7)
- [ ] 생성된 기사가 `article.contract.yaml`의 모든 규칙(필수 필드, 최소 본문 길이,
      최소 인용 출처 수, 초기 status=draft)을 만족하지 못하면 해당 기사는
      저장되지 않고 파이프라인이 중단된다.
- [ ] 위반 사유(`ruleId`, `message`)가 `pipeline_logs.details`에 기록된다.

## AC-6. AI Evals (FR-8)
- [ ] `article.contract.yaml`을 통과한 기사는 `evals/article-quality.eval.yaml`에
      정의된 기준별로 평가되어 `eval_runs`에 저장된다.
- [ ] 평가 결과는 기준별 점수, 가중 평균 점수(`aggregate_score`), `passed` 여부를
      포함한다.
- [ ] 평가 결과는 통과/미통과와 무관하게 항상 사용자에게 표시된다.
- [ ] 평가를 통과하지 못해도 기사는 `draft` 상태로 유지되며, 사용자가 직접
      검토할 수 있다.

## AC-7. 사용자 승인 (FR-9)
- [ ] 기사 상세 화면에서 사용자는 "승인" 액션을 통해 `status`를 `'reviewed'`로
      전환할 수 있다.
- [ ] "승인" 액션 없이는 어떤 자동화 로직도 `status`를 `'reviewed'` 또는
      `'published'`로 변경하지 않는다 (`lib/harness/approval-gate.ts`에서 강제).
- [ ] 승인 시 `reviewed_at`, `reviewed_by`가 기록된다.
- [ ] 승인 이벤트는 `pipeline_logs`에 `stage='human_review'`, `status='succeeded'`로
      기록된다.

## AC-8. 실행 로그 (FR-10)
- [ ] 다음 각 단계는 시작/성공/실패 시점에 `pipeline_logs`에 기록된다:
      `source_validation`, `article_generation`, `article_contract_check`,
      `article_eval`, `human_review`
- [ ] 각 로그 항목은 `stage`, `status`, `message`, `details(jsonb)`, `created_at`,
      `topic_id`를 포함한다.
- [ ] 한 단계가 실패하면 이후 단계는 실행되지 않는다 (파이프라인 중단).

## AC-9. CI/CD
- [ ] `main` 브랜치로의 PR 생성 시 GitHub Actions가 lint, typecheck, test를
      자동 실행한다.
- [ ] 위 검사 중 하나라도 실패하면 PR을 머지할 수 없다 (브랜치 보호 규칙 권장).
