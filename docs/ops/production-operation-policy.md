# 운영 기준 문서(Production Operation Policy)

- 작성일: 2026-09-23(GO-LIVE GATE)
- 목적: OPS-01~04R1에서 검증한 운영 신뢰 구조를 하나의 문서로 고정한다.
  이 문서 확정 이후에는 콘텐츠 1건마다 개발 Phase를 새로 열지 않는다
  — 섹션 10/11의 월간 리뷰/개발 재개 기준을 따른다.
- 검증된 기준선 commit: `4e8a735`("Add upstream source evidence
  integrity validation") — `git rev-parse HEAD`로 확인한 실제 값.

## 1. 접근 제어(Access Control)

- 배포 환경(Vercel)은 **Vercel Authentication**(Protection Scope =
  All Deployments)으로 보호된다. anonymous 요청은 항상 Vercel SSO
  로그인 페이지로 redirect되며 앱 콘텐츠를 노출하지 않는다.
- 재확인 방법(반드시 credential/bypass token/protection bypass secret
  **미사용**): production URL에 anonymous `curl` 요청 → `302` +
  `Location: https://vercel.com/sso-api?...` 확인.
- 이 앱 자체에는 애플리케이션 레벨 인증이 없다(`middleware.ts` 없음,
  세션 검사 없음 — 코드 확인 완료, standing High였으나 hosting-level
  접근 제어로 완화됨). **호스팅 레벨 보호가 해제되면 이 앱은 즉시
  누구나 접근 가능해진다** — Protection Scope 설정을 임의로 변경하지
  않는다.

## 2. Production version verification

- 새 배포가 있었는지 의심될 때마다: `git rev-parse HEAD`로 로컬
  검증된 commit을 확인하고, `git log origin/main..HEAD`로 push
  여부를 확인한다.
- Vercel 대시보드/CLI 접근이 없는 환경에서는 **"실제 production이
  그 commit을 서빙 중"이라고 확정할 수 없다** — 이 경우
  `PRODUCTION VERSION: NOT VERIFIED`로 기록하고, 추측하지 않는다.
- `NOT VERIFIED`는 `OUTDATED`와 다르다 — 오래됐다는 근거가 없는 한
  임의로 재배포를 트리거하지 않는다.

## 3. Preflight

- 실제 side effect를 수반하는 운영(콘텐츠 생성, WordPress Draft 등)을
  시작하기 전에 항상 `npm run ops:preflight`를 실행한다.
- PASS 6개 항목: Supabase / Anthropic / WordPress Draft / Search
  providers / Public publish / Mock mode·dangerous flags.
- **FAIL이면 정식 운영을 시작하지 않는다.** WARNING은 의미를 기록하고
  운영자가 계속 여부를 판단한다(자동으로 무시하지 않는다).

## 4. Platform capability(실제 기능 — 약속하지 않는 것 포함)

| 플랫폼 | capability | 실제로 가능한 일 |
|---|---|---|
| wordpress_blog | `draft` | 실제 WordPress REST API로 **Draft** 생성/업데이트만. 공개 게시는 별도 관리자 전용 경로(아래 참고) |
| naver_blog | `manual` | 수동 게시 준비 자료(체크리스트/export) 생성만 |
| news_article | `manual` | 수동 게시 준비 자료 생성만 |
| opinion_column | `manual` | 수동 게시 준비 자료 생성만 |
| naver_cafe | `copy` | 게시용 본문 복사(clipboard)만 |
| x | `copy` | 게시용 스레드 복사만 |
| threads | `copy` | 게시용 본문 복사만 |
| instagram | `copy` | 게시용 캡션 복사만 |

**이 코드베이스는 어떤 플랫폼에도 실제 외부 공개 게시 API를 자동
호출하지 않는다**(`lib/social/platform-adapters/*.ts` 8개 전부
`disabledPublishResult()` 반환 — `docs/ops/platform-capability-matrix.md`
에서 코드 직접 검증). 유일한 예외는 WordPress **Draft**와, 사람이
직접 클릭해야 하는 관리자 전용 WordPress 공개 게시 경로다.

**운영 문서/UI는 위 표에 없는 direct publish 기능을 약속하지
않는다** — 새 플랫폼 직접 게시 기능을 추가하려면 이 표부터 갱신하고
명시적 승인을 받는다.

## 5. Approval policy

- article `status`가 `reviewed`/`published`로 전환되는 작업은
  사용자의 명시적 승인 없이 자동 실행되지 않는다
  (`lib/harness/approval-gate.ts`의 `assertApproved`).
- social post 승인은 `bulkApprove`(자동 승인 가능한 것만 —
  `needsConfirmation=0`)와 개별 승인(사람이 fact_grounding 등 확인
  필요 항목을 직접 읽고 판단)으로 나뉜다. 확인 필요 항목이 있는
  post를 근거 없이 자동 일괄 승인하지 않는다.

## 6. Public publish policy

- WordPress 공개 게시는 `checkPublicPublishGuard()`
  (`lib/publish/public-publish-guards.ts`, fail-closed 서버사이드
  guard)를 통과해야만 가능하다 — UI에서 숨겼다는 것만으로 안전하다고
  판단하지 않는다(코드로 직접 재확인 완료, OPS-02B/GO-LIVE 기준
  유지).
- 이 Phase(또는 이후 어떤 운영 리뷰에서도) 공개 게시를 실제로
  트리거하지 않는다 — WordPress Draft 생성까지만 실제 side effect로
  허용한다.

## 7. Source integrity(신뢰 구조 — Layer 1 + Layer 2)

```
Layer 1 (upstream) — lib/sources/source-evidence-integrity-validator.ts
  Raw Source → Source Evidence Integrity → Verified Facts
  (source.keyPoints/candidate fact가 raw source content로 실제
   뒷받침되는지 결정적으로 대조. supported만 verifiedFacts로 승격.
   needs_review/unsupported는 verificationNeeded로만 안내.)

Layer 2 (downstream) — lib/social/fact-grounding-validator.ts
  Verified Facts → Master Manuscript / Platform Post → Final Fact Grounding
  (플랫폼 글 생성 단계에서 새로 추가된 주장이 verifiedFacts/evidenceMap
   으로 뒷받침되는지 검사. 게시용 본문이 근거를 벗어나면 확인 필요로
   flag.)
```

**핵심 원칙(고정)**: **AI summary 자체는 evidence가 아니다. raw
source가 evidence source of truth다.** 어느 레이어도 "AI가 그렇게
말했으니 검증됐다"고 판단하지 않는다 — 항상 원문(raw source content
또는 verifiedFacts)과 다시 대조한다.

- Layer 1 상태: OPS-04-FIX1에서 구현, OPS-04R1에서 실제 운영 재검증
  완료(unsupported→supported 오판정 0건, verifiedFacts starvation
  없음). `npm run ops:audit-source-evidence`로 과거 article을
  read-only 재감사할 수 있다.
- Layer 2 상태: OPS-01/02A부터 유지, OPS-03/04/04R1에서 반복적으로
  실제 TP(AASM, CBT)를 정확히 재확인함.

## 8. Retry policy

- **자동 무한 retry 로직은 이 코드베이스에 없고, 추가하지 않는다.**
- 생성/구조화 출력 실패는 사용자가 버튼을 다시 눌러 재시도한다
  (시스템이 임의로 재시도 횟수를 늘리지 않는다).
- WordPress Draft처럼 실제 외부 side effect가 있는 단계는, 재시도
  전에 **외부 상태(WordPress 관리자 화면)를 직접 확인**해 중복 생성
  위험이 없는지 먼저 판단한다.

## 9. Stalled job 대응

- `job_runs`의 heartbeat가 오래 갱신되지 않으면(`detectStalledJobRun`):
  1. 실제 외부 side effect(WordPress Draft/AI 호출)가 이미 완료됐는지
     DB 상태만으로 판단하지 않고 먼저 확인한다.
  2. **같은 job을 무조건 재실행하지 않는다.**
  3. `job_run_steps`의 마지막 완료 step으로 안전한 재개 지점을
     판단한다.
  4. 불확실하면(특히 WordPress Draft) 외부에서 직접 확인 후에만
     retry한다.

## 10. 비용(unknown) 처리

- `lib/ops/model-pricing.ts`의 `PRICING_TABLE`은 의도적으로 비어
  있다 — 가격을 확인하지 못한 request는 **0원으로 합산하지 않고**
  `costUnavailable`로 별도 집계한다.
- `npm run ops:report-usage`로 정기 확인한다. 현재 `pipeline_logs`는
  `social_ai_generation_completed`/`social_draft_generation_completed`
  이벤트에만 token 정보를 남긴다 — article 생성/평가/출처 요약 AI
  호출은 아직 미계측(알려진 한계, OPS-02A/B부터 유지).

## 11. 운영 중단 조건(Immediate stop)

다음 중 하나라도 발생하면 실제 운영(콘텐츠 생성/외부 side effect)을
즉시 중단하고 원인을 규명한다:

- 접근 제어 해제 또는 anonymous 앱 접근 노출
- 승인되지 않은 외부 side effect(예상치 못한 공개 게시, 중복 게시)
- public-publish-guard 우회
- 데이터 손실
- 심각한 fact-grounding Miss(위험한 미확인 주장이 그대로 승인/노출)
- 반복되는 상태 손상(status corruption)
- 중복 외부 side effect(같은 콘텐츠가 두 번 게시되는 등)

## 12. 기존 pilot/test 데이터

OPS-01~04R1에서 생성된 실제 WordPress Draft/social post/pilot
article은 **자동으로 삭제하지 않는다.** 목록은 각 Phase의 운영
로그 문서(`docs/ops/ops-0*-operation-log.md`,
`docs/ops/pilot-*.md`)에 이미 기록되어 있다 — 필요 없어졌다고
판단되면 **사용자가 명시적으로 삭제를 요청한 뒤에만** 정리한다.

## 13. 월간(또는 일정 콘텐츠 건수마다) 운영 리뷰

콘텐츠 1건마다 새 개발 Phase를 열지 않는다. 대신 아래 지표만 정기
리뷰한다:

- generation success / first-pass ready / user confirmation
- manual edit / retry / auto-fix
- fact-grounding TP / FP / Miss
- structured-output failures
- WordPress Draft failures
- token usage(`npm run ops:report-usage`)
- operational failures

**Blocker/High가 없으면 코드 수정 없이 계속 운영한다.**

## 14. 새 개선 Phase를 여는 조건

다음 경우에만 새 Phase를 연다:

- 새로운 fact-grounding Miss
- 반복되는 structured-output failure
- 반복되는 generation failure
- WordPress Draft 반복 실패
- 데이터 손실
- 접근 제어 문제
- 승인/게시 안전성 문제
- 반복되는 FP가 운영 부담을 실제로 초래

단순 문구 취향이나 일회성 콘텐츠 선호는 즉시 개발하지 않는다 —
월간 리뷰에서 패턴으로 반복 확인된 뒤에만 검토한다.
