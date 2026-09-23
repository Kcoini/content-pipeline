# OPS-01 Pilot C: SNS 다중 플랫폼(x/threads/instagram) 실제 파일럿

- 실행일: 2026-09-19
- 범위: 실제 Supabase DB + 실제 Anthropic API(모델 호출)로 Theme → Sources →
  마스터 원고 생성 → 승인 → 플랫폼별(x/threads/instagram) 글 생성 →
  품질검사/자동검토/자동수정 → MultiPlatformReviewSummary → 일괄 승인 →
  게시 준비(copy) next action까지 전 구간을 실제로 실행했다. 실제 외부
  SNS API 호출은 어디에도 존재하지 않는다(아래 12절에서 코드 확인).
- 드라이버 스크립트: `scripts/ops-01/pilot-c-social.ts`(+보조:
  `pilot-c-retry-threads.ts`, `pilot-c-continue.ts`, `pilot-c-inspect.ts`)
- 실행: `npx vitest run --config vitest.ops-01.config.ts scripts/ops-01/pilot-c-social.ts`

## 1. 입력(Snapshot)

- 주제: "전기차 배터리 수명을 늘리는 충전 습관"
- themeId: `0d44951e-f4bc-4c17-9aed-51960968a411`
- articleId: `7481495e-b8d9-4c1c-bbe4-5a439189287d`
- 대상 platform: x, threads, instagram
- source 수: 3건(전부 URL 있음, 개인정보/민감정보 없음, 공개 정보)
  1. https://ko.wikipedia.org/wiki/리튬이온_전지 (위키백과)
  2. https://ko.wikipedia.org/wiki/전기자동차 (위키백과)
  3. https://ko.wikipedia.org/wiki/배터리_관리_시스템 (위키백과)
- tone: 플랫폼별 자동 추천(auto_recommended) — x=curiosity, threads=story(1차 실패)→informational(재시도 성공), instagram=comparison
- content type: source_based_explainer(마스터 원고) → 플랫폼별 파생
- 시작 시각: 2026-09-19 01:56 UTC

## 2. 생성 결과

| 단계 | 결과 | 비고 |
|---|---|---|
| Theme 생성 | 성공 | |
| Source 3건 등록/수집/AI요약 | 성공(3/3) | 전부 fetch 성공, AI 요약 완료 |
| 출처 계약 검사 | 통과 | |
| 마스터 원고 AI 생성 | 성공 | source_based_explainer, eval 통과(아래 14절 비용 참고) |
| 마스터 원고 승인 | 성공(draft→reviewed) | |
| x 글 생성 | **1차 성공** | tone=curiosity, thread 9개 |
| threads 글 생성 | **1차 실패 → 재시도(같은 tone) 실패 → tone 변경 재시도 성공** | 아래 17절 OPS-Blocker/High 참고 |
| instagram 글 생성 | **1차 성공** | tone=comparison |

플랫폼별 생성 성공/실패: **x 성공(1회) / threads 실패(2회) 후 성공(tone 변경, 3회째) / instagram 성공(1회)**.

## 3. Review 결과 (자동 검토)

| platform | qualityStatus | review.state | confirmationCount | 비고 |
|---|---|---|---|---|
| x | ready | needs_confirmation | 2 | 아래 4절 |
| threads(informational) | ready | ready | 0 | |
| instagram | ready | ready | 0 | 단, 15절의 fact-grounding 문제는 **검토가 잡지 못함(Miss)** |

## 4. 사람 확인 issue 품질 평가 (섹션 10 — TP/FP/Miss)

x 글의 confirmationCount=2:

1. `length_check`: "분량이 플랫폼 권장 최대(280자)를 초과했습니다 (791자)." → **False Positive(확정)**. 실제로는 9개 thread item 각각 76~94자로 전부 280자 이내다. 코드 확인 결과(`lib/social/social-quality-gate.ts`의 `getContentLength`, 261-264행) 이 일반 `length_check`가 `threadItems` 전체 텍스트를 **합산**해 플랫폼 최대 길이(x=280)와 비교한다 — thread 형식은 원래 여러 개의 280자 항목으로 나누는 것이 정상 동작인데, 합산값을 단일 280자 기준과 비교하므로 **item이 3개를 넘는 거의 모든 X thread에서 항상 발생하는 구조적 오탐**이다. 같은 파일 893-910행에 있는 `x_thread_item_length`(항목별 280자 검사, 이번엔 정상 통과)와 별개로 존재하는 중복·오작동 검사다. → **High로 기록(17절)**. 파일럿 fork는 이 자리에서 코드를 수정하지 않았으나, 세 파일럿 결과를 모두 취합한 coordinator가 원인이 명확하고(root cause 확정) 수정 범위가 안전(한 줄 조건 추가, `config.supportsThreads`일 때만 일반 length_check를 건너뜀)하다고 판단해 **OPS-01 종료 전 `lib/social/social-quality-gate.ts`를 직접 수정했다** — 회귀 테스트 추가 후 lint/vitest(3798)/build/Playwright(40) 전체 재확인 완료(21절 참고).
2. `x_thread_item_count`: "thread item 9개 (권장 범위 3~7개를 벗어남)." → **True Positive**(경계선). 실제로 9개는 다소 많은 편이라 사람이 한 번 훑어볼 가치가 있다 — 차단하지 않는 warning 수준으로 적절히 처리됨.

**TP 1건 / FP 1건 / Miss 1건**(Miss는 아래 15절 instagram 사실 근거 문제 — review가 confirmationCount=0으로 잡지 못함).

## 5. auto_fix 실행 여부/품질

이번 파일럿에서는 x/threads/instagram 전부 최초 quality gate에서 바로 `qualityStatus="ready"`가 나와 `needs_revision` 상태가 한 번도 발생하지 않았다 — **auto_fix가 실행되지 않았다**(정상 경로, 문제 아님). 즉 이번 3개 포스트 표본으로는 auto_fix 전/후 비교를 할 수 없었다 — OPS-02에서 auto_fix가 실제로 발동하는 표본을 추가로 확보할 필요가 있다.

## 6. 사용자가 직접 수정한 횟수

0회(inline 수정을 실행하지 않음 — 생성 결과를 그대로 승인 가능한 상태였다. instagram의 15절 문제는 이번 파일럿에서는 "발견"만 하고 실제 수정은 하지 않았다 — 실제 운영이라면 사람이 수정하거나 재생성해야 할 항목).

## 7. retry 수

**2회**(threads 플랫폼만): 1차(story tone) 실패 → 2차 동일 tone 재시도(진단 목적) 실패 → 3차 tone을 informational로 바꿔 성공. 다른 두 플랫폼(x/instagram)은 재시도 없이 1회 성공.

## 8. 시간

| 단계 | 소요 시간 |
|---|---|
| Theme 생성 | 0.2초 |
| Source 3건 등록+수집+AI요약 | 58.5초 |
| 마스터 원고 AI 생성+계약검사+저장+평가 | 88.7초(그중 AI 생성 자체 53.0초) |
| 마스터 원고 승인 | 0.4초 |
| 플랫폼 3종 글 생성(1차, x+threads실패+instagram) | 53.7초 |
| threads 재시도 2회 | 약 23초(11.2초+11.8초) |
| 품질검사+자동검토(3플랫폼) | 약 1.5초 |
| MultiPlatformReviewSummary+bulk approval | 약 1.6초 |
| **게시 준비까지 총 소요 시간(순수 실행 시간 합)** | **약 227초(3분 47초)** |

## 9. 클릭/판단 횟수(실제 UI 흐름 기준 추정 — 방법: 이번에 실행한 각 서비스 함수 호출 1건을 실제 화면의 버튼 1회 클릭에 대응시켜 추정. 자동 실행 단계는 클릭에 포함하지 않음)

- 페이지 이동: 대시보드(테마 생성) → 테마 상세(출처 3회 등록) → 글 생성 → article 상세(플랫폼별 글 생성) → social 목록(검토/승인) = 약 4회
- primary action 클릭: 테마 생성 1 + 출처 등록 3 + 마스터 원고 생성 1 + 승인 1 + 플랫폼 글 생성 1(3개 동시 선택) + threads 재생성 1(실패로 인한 추가 클릭, 실제 버그 영향) + 일괄 승인 1 + x 개별 승인 1(bulk 대상 제외) = **10회**
- 본문 수정 횟수: 0
- 사람 판단 횟수: x의 confirmation 2건 확인 + instagram 최종 검수(놓친 사실관계, 15절) = 실질적으로 **3건의 판단 기회**(그중 2건은 자동 검토가 제시, 1건은 자동 검토가 놓쳐 사람이 스스로 찾아야 했다)
- retry: 2회(7절)

## 10. AI 자동화

- auto review 실행 수: 3건(x/threads/instagram 각 1회 quality gate 겸 자동 검토)
- auto_fix 실행 여부: 미실행(5절)
- 자동 해결 issue 수: 0
- 사람 확인 issue 수: 2건(x만; threads/instagram은 0건 — 단 instagram은 Miss 1건 존재)
- blocking issue 수: 0건(전부 quality gate "ready" 도달)

## 11. 품질(콘텐츠 운영 관점, 4단계)

| platform | 그대로 사용 가능 여부 |
|---|---|
| x | 작은 수정 필요(length_check 오탐 해제 필요 — 콘텐츠 자체는 그대로 사용 가능한 수준) |
| threads | 그대로 사용 가능 |
| instagram | **큰 수정 필요**(15절 — 출처에 없는 수소차 비교 수치 제거/검증 필요) |

## 12. 게시 준비

- 승인 성공 여부: threads/instagram 성공(bulk approval), x는 bulk 대상에서 제외되어 **개별 승인으로 별도 처리**(정상 동작 — needs_confirmation 상태는 bulk 대상이 아님).
- publish guard 결과: 이번 파일럿에서는 platform publishing guard(`runPlatformPublishingGuard`)까지는 실행하지 않았다(Pilot A의 QA-01-FIX1 회귀 검증에 집중되어 있어 중복 실행하지 않음 — 범위 밖, 필요하면 OPS-02에서 SNS 플랫폼도 guard까지 실행 권장).
- 준비 완료 여부: 3개 플랫폼 모두 approvalStatus=approved 도달(threads/instagram은 bulk, x는 개별).
- Draft/copy 결과: x/threads/instagram 전부 `getPostApprovalNextActions` 결과가 `copy_body`(본문 복사) — **"게시하기" 같은 존재하지 않는 action은 어디에도 나타나지 않음**(9절 코드 assert로 확인).
- manual completion 가능 여부: copy 이후 "게시 완료로 표시"(recordManualPostingResult)는 이번 파일럿에서 실행하지 않았다(실제 SNS에 올리는 행위를 시뮬레이션할 근거가 없어 범위에서 제외 — 정책대로 copy/manual preparation까지만 진행).
- **외부 실제 SNS API 호출 확인**: `lib/social/multi-platform-generation-service.ts`, `post-approval-next-actions.ts`, `social-post-approval-service.ts` 어디에도 x/threads/instagram에 대한 실제 게시 API 호출 코드가 없음을 재확인(grep 결과 "publish"라는 이름이 붙은 함수 중 이 3개 플랫폼을 대상으로 실제 HTTP 요청을 보내는 것은 전무 — capability는 전부 "copy").

## 13. 오류

- system error: 0건(threads 1차 실패는 "오류"가 아니라 정상적으로 처리된 실패 반환 — 예외가 아니라 `{status: "failed", message}` 형태로 안전하게 반환됨, DB에 부분 상태가 남지 않음 확인)
- retry: 2건(threads)
- wrong state transition: 0건
- dead-end: 0건(threads 실패 후에도 "재생성" 경로가 명확히 존재 — 실제 UI에서도 플랫폼 카드의 개별 생성 버튼으로 동일하게 재시도 가능)
- confusing action: 0건(게시하기 버튼 등 오해 소지 없음)
- formatting issue: 0건(markdown 잔여물 없음, hashtag 정상)

## 14. API/token/cost

- `social_ai_generation_completed` 로그에 `inputTokens`/`outputTokens`가 실제로 기록됨을 확인(예: instagram inputTokens=7166, outputTokens=1391).
- 다만 **모델별 단가 정보나 누적 비용(원화/달러) 필드는 이 프로젝트 어디에도 저장되어 있지 않다** — `pipeline_logs.details`에 토큰 수만 있고 가격표/환율 계산 로직이 없다.
- 이번 파일럿의 실제 토큰 사용량 합계(로그에서 확인 가능한 값만, article 생성 1회 + 소스요약 3회 + 플랫폼 생성 4회[threads 2회 실패 포함 — 실패도 API 호출은 발생했으므로 포함]):
  - instagram: input 7166 / output 1391
  - (x/threads/기사 생성/소스요약의 정확한 토큰 수는 이 문서 작성 시점에 개별 조회하지 않음 — pipeline_logs에서 조회 가능하나 이번 리포트에서는 대표값만 인용)
- **결론(섹션 6 지시 그대로): "현재 시스템에서 신뢰할 수 있는 비용 집계는 불가능하다."** 토큰 수는 로그에 남지만, 이를 실제 원화/달러 비용으로 환산하는 단가표나 집계 파이프라인이 없다. 값을 추측하지 않는다 — OPS-02에서 모델 단가 상수를 추가하고 pipeline_logs를 집계하는 간단한 스크립트를 만들 것을 권장(대규모 billing infra는 불필요, 단가 상수 + SUM 쿼리 수준으로 충분).

## 15. 발견한 중요 문제: instagram 출처 근거 없는 비교 수치(Fact-grounding Miss)

instagram caption(462자)에 다음 내용이 포함됨:

> "배터리식 전기차는 1회 충전 항속거리 200~300km, 수소 연료전지차는 600~700km 주행이 가능합니다. 하지만 수소 충전소 설치 비용은 30~50억 원, 차량 가격도 7~8천만 원 수준이에요."

이번 파일럿에 등록한 3개 출처(리튬이온 전지/전기자동차/배터리 관리 시스템 위키백과 문서)는 모두 **배터리 전기차**에 관한 내용이며, **수소 연료전지차의 주행거리·충전소 설치비·차량가격**에 대한 구체적 수치는 어디에도 없다. AI가 마스터 원고의 범위를 벗어나 근거 없는 비교 수치를 스스로 생성한 것으로 판단된다(사실 여부 자체를 이 파일럿에서 검증하지 않았다 — 요점은 "출처에 없는 수치가 검토 없이 통과됐다"는 것).

자동 검토(quality gate)는 이 문제를 confirmationCount=0(ready)으로 판정해 **잡아내지 못했다(Miss)**. 이는 이번 파일럿에서 발견한 가장 중요한 품질 이슈로, "AI가 처리할 수 있는 문제만 자동화하고 사람 확인이 필요한 것은 정확히 남긴다"는 프로젝트 원칙이 SNS 플랫폼의 비교/부연 설명 문장에는 아직 충분히 적용되지 않았음을 보여준다.

> **정정 (2026-09-23, OPS-02A)**: 이 절의 "근거 없는 수치"라는 판단은
> **틀렸다.** OPS-02A에서 실제 저장된 master manuscript의
> `verifiedFacts`를 직접 조회한 결과, 수소 연료전지차 비교 수치는
> `sourceIds`가 붙은 실제 verifiedFact(confidence: medium)로 이미
> 존재했다 — 3개 소스 중 하나(전기자동차 위키백과 문서)의 실제 본문에
> 포함된 내용이었다(당시 파일럿 fork가 소스 raw fetch 결과가 아니라
> 소스 "주제"만 보고 판단해 발생한 조사 오류). 즉 AI는 근거 없는
> 수치를 만들어내지 않았다 — **이번 사례는 실제 Miss가 아니었다.**
> 다만 이 조사 과정에서 드러난 더 근본적인 문제는 그대로 유효하다:
> **quality gate에는 애초에 "본문 주장이 verifiedFacts로 뒷받침되는지"
> 확인하는 검사 자체가 전혀 없었다**(news_article 전용 키워드 목록
> 하나뿐이었고, 그마저 evidence 대조가 아니었다). 이 일반적 공백은
> OPS-02A에서 `lib/social/fact-grounding-validator.ts` + quality gate의
> 신규 `fact_grounding` 체크리스트 항목으로 플랫폼 공통 해결했다 —
> 자세한 내용은
> [`docs/ops/ops-02a-reliability-hardening.md`](./ops-02a-reliability-hardening.md)
> 참고.

## 16. Content Tuning 항목(코드 문제 아님, 표현 취향)

- x thread 9개는 권장 범위(3~7개) 상단을 넘음 — 내용은 자연스럽지만 다소 길다.
- instagram 해시태그 8개는 정책상 허용 범위이나 다소 많은 편(플랫폼 관행상 흔한 수준이라 문제로 보지 않음).

## 17. OPS-Blocker / High / Medium / Low 분류

- **High-1 (재현됨, 코드 확인 완료, OPS-01 종료 전 coordinator가 수정함 — 아래 21절)**: `lib/social/social-quality-gate.ts`의 일반 `length_check`(435-449행)가 thread 기반 플랫폼(x)에서 `threadItems` 전체를 합산해 단일 최대 길이와 비교 — 사실상 모든 다중 item X thread에서 구조적으로 발생하는 **False Positive**. 이미 올바른 `x_thread_item_length`(893-902행, item별 280자 검사)가 별도로 존재하므로, thread 기반 플랫폼은 일반 `length_check`를 건너뛰도록 수정했다.
- **High-2 (재현됨)**: threads 플랫폼 + `story` tone 조합에서 AI 응답이 2회 연속(재현율 100%, n=2) JSON 파싱 실패. `informational` tone으로는 즉시 성공(같은 article/같은 platform) — tone=story의 프롬프트/응답 스타일이 유효한 JSON을 깨뜨리는 것으로 추정된다(`lib/social/social-ai-client.ts`의 JSON 추출 fallback도 복구하지 못함). **이번 파일럿에서는 수정하지 않음**(AI 출력 안정성 문제로, 재현 케이스를 늘려 원인을 더 좁혀야 안전하게 고칠 수 있음).
- **High-3 (OPS-02A에서 재분류됨 — 15절 정정 참고)**: 애초 "instagram 근거 없는 비교 수치"로 기록했으나, OPS-02A 조사 결과 그 수치 자체는 실제 verifiedFact로 근거가 있었다(오판정 정정). 다만 이 사례를 조사하며 드러난 **"quality gate에 fact-grounding 검사 자체가 전혀 없었다"는 일반적 공백은 실제 문제였고**, High로 유지한 채 OPS-02A에서 수정했다(21절).
- **Medium**: 없음(이번 파일럿 범위에서는 발견되지 않음).
- **Low**: 없음.
- **OPS-Blocker**: 없음(세 플랫폼 모두 결국 게시 준비 상태까지 도달했고, dead-end/데이터 손실/위험한 자동 게시 없음).

## 18. 최종 판정

핵심 workflow(Theme→Sources→Generate→Review→Approve→Publish Preparation)는 3개 플랫폼 모두 결국 완료했다. threads의 tone 이슈는 사용자가 다른 tone으로 재시도하면 우회 가능했고(실제로 우회에 성공), 데이터 손실이나 위험한 자동 게시는 없었다. High-1(X 오탐)은 세 파일럿 결과를 모두 취합한 뒤 OPS-01 종료 전 즉시 수정했다(21절). High-3은 애초 판정("instagram 근거 없는 수치")이 OPS-02A 조사로 정정됐지만(15절), 그 조사가 드러낸 진짜 공백("fact-grounding 검사 자체가 없었다")은 OPS-02A에서 플랫폼 공통으로 해결됐다 — 자세한 내용은 [`docs/ops/ops-02a-reliability-hardening.md`](./ops-02a-reliability-hardening.md) 참고.

## 21. OPS-01 종료 전 coordinator가 적용한 수정 (파일럿 종료 후)

세 파일럿(A/B/C) 결과를 모두 취합한 뒤, 17절 High-1(X thread `length_check` False Positive)은 원인이 명확하고 수정 범위가 좁고 안전하다고 판단해 파일럿 종료 시점에 직접 수정했다(OPS-01 phase 지시 14절 "즉시 수정 가능: 잘못된 state transition/명백한 잘못된 action"에 해당 — quality gate가 정상적인 thread를 항상 오탐으로 차단 직전까지 몰아가는 것은 명백히 잘못된 검사 로직이다).

- 수정 파일: `lib/social/social-quality-gate.ts` — thread를 지원하는 플랫폼(`config.supportsThreads`)에서는 일반 `length_check`(합산 길이 비교)를 건너뛰고, 이미 존재하는 `x_thread_item_length`(항목별 280자 검사)만 적용하도록 조건을 추가했다.
- 회귀 테스트 추가: `lib/social/social-quality-gate.test.ts`에 "item당 280자 이내인 정상 다중 item thread는 합산 길이 때문에 length_check가 잘못 걸리지 않는다" 테스트 추가.
- High-2(threads+story tone JSON 파싱 실패)와 High-3(instagram 근거 없는 비교 수치)는 원인 조사/수정 범위가 이번 파일럿의 "즉시 수정" 기준(명백한 잘못된 action/데이터 손실/안전 버그)을 벗어난다고 판단해 수정하지 않고 OPS backlog로 유지했다.
- 수정 후 전체 재검증: `npm run lint`(오류 없음) / `npx vitest run`(287 files, **3798 tests** 통과 — 회귀 테스트 1건 추가) / `npm run build`(성공) / `npm run test:e2e`(Playwright **40/40** 통과, 회귀 없음).
