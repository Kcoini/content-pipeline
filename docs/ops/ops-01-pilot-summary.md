# OPS-01 Pilot Summary

- 작성일: 2026-09-19
- 상세 내역: [`pilot-a-wordpress.md`](./pilot-a-wordpress.md),
  [`pilot-b-information-cafe.md`](./pilot-b-information-cafe.md),
  [`pilot-c-social.md`](./pilot-c-social.md). 실행 방법론은
  [`ops-01-pilot-plan.md`](./ops-01-pilot-plan.md) 참고.

> **업데이트 (2026-09-23, OPS-02A)**: 아래에 기록된 High 3건 모두
> 처리됐다(2건 수정 완료, 1건은 재조사 결과 오판정으로 정정). "High
> 상태 Resolved/Remaining" 절 참고. 상세 내용은
> [`ops-02a-reliability-hardening.md`](./ops-02a-reliability-hardening.md).

## 지표 비교

| 지표 | Pilot A (wordpress_blog) | Pilot B (naver_cafe) | Pilot C (x/threads/instagram) |
|---|---|---|---|
| 주제 | 카페인이 우리 몸에 미치는 영향과 하루 적정 섭취량 | 한국은행 기준금리 정책 이해하기 | 전기차 배터리 수명을 늘리는 충전 습관 |
| 생성 성공 | 성공(article + wordpress_blog 1건) | 성공(article + naver_cafe 1건) | x/instagram 1차 성공, threads 2회 실패 후 tone 변경 3회째 성공 |
| quality gate 1회차 | ready(score 98) | ready(score 100) | 전부 ready(x는 needs_confirmation 2건) |
| 사람 확인 이슈 수(TP/FP/Miss) | 1건(TP 1) | 0건(TP0/FP0/Miss0 — 독립 검증으로 확인) | 3건(TP1/FP1/Miss1) |
| auto_fix 실행 | 미실행(1회차부터 ready) | 미실행(1회차부터 ready) | 미실행(전부 1회차부터 ready) |
| 사람이 직접 수정한 횟수 | 0회 | 0회 | 0회 |
| retry 횟수 | 0회(스크립트 타임아웃 재실행 1회는 파일럿 드라이버 문제, 비즈니스 로직 retry 아님) | 0회 | 2회(threads tone 변경) |
| 총 소요시간(순수 실행) | 약 6분 11초 | 약 3분 7초 | 약 3분 47초 |
| 게시 준비 | **WordPress Draft 실제 생성**(`https://foodkim.com/?p=69`), publish guard ready(score 96) | naver_cafe 승인 완료, manual posting record는 의도대로 "미완료"(export 미실행 상태 정확히 반영) | 3개 플랫폼 전부 approved(threads/instagram bulk, x 개별), 전부 `copy_body`만 next action |
| 운영 사용 가능 | **가능**(High 1건은 eval 채점 버그, journey는 완료) | **가능**(문제 없음) | **가능, 단 게시 전 사람 확인 필수**(High-3 fact-grounding Miss) |

## 플랫폼별 생성 성공/실패

- wordpress_blog: 1/1 성공
- naver_cafe: 1/1 성공
- x: 1/1 성공(1차)
- threads: 1/3 성공(story tone 2회 실패 → informational tone 성공)
- instagram: 1/1 성공(1차)

## 사람 확인 issue 정확도 종합

- 총 4건(A 1 + B 0 + C 3) 중 **True Positive 2건**(A의 excerpt 누락, C의 x thread item 개수 경계선), **False Positive 1건**(C의 x length_check — OPS-01 종료 전 수정 완료), **Miss 1건**(C의 instagram 근거 없는 비교 수치 — 미수정, backlog 최우선).
- Pilot B는 auto review가 confirmation 0건을 냈고, 소스 원문 대조로 독립 검증한 결과 실제로 놓친 것이 없어 "0건이 정확한 결과"였음을 확인했다 — 다만 소스가 우연히 매우 정갈해 TP/FP/Miss 지표를 풍부하게 관찰하지 못한 한계가 있다(OPS-02 후보: 의도적으로 상충하는 source를 섞은 파일럿).

## auto_fix 횟수와 품질

세 파일럿 6개 콘텐츠(article/social post) 전부 1회차 quality gate에서
바로 `ready`에 도달해 **auto_fix가 한 번도 발동하지 않았다**. 이는
긍정적 신호(현재 프롬프트/생성 품질이 이미 안정적)이지만, auto_fix
자체의 전/후 비교 품질은 이번 파일럿으로 검증되지 않았다 — OPS-02에서
auto_fix가 실제로 발동하는 표본을 별도로 확보할 필요가 있다.

## 사용자가 직접 수정한 횟수

0회(세 파일럿 전체). 모든 콘텐츠가 생성 직후 quality gate를 통과했다.

## retry 수

2회(Pilot C, threads AI JSON 파싱 실패로 인한 tone 변경 재시도). 나머지는 0회.

## Pilot별 총 소요시간

A 약 6분 11초, B 약 3분 7초, C 약 3분 47초(threads 재시도 포함) — 총
약 13분의 실제 파이프라인 실행 시간(3개 파일럿 순차 합산 기준, 실제로는
병렬 실행해 벽시계 기준으로는 더 짧게 끝남).

## 주요 click/판단 횟수

A: primary click 약 8 / 판단 약 3, B: primary click 8 / 판단 2, C:
primary click 10(threads 재시도 1 포함) / 판단 3. 세 파일럿 모두 UI를
직접 클릭하지 않고 동일한 service 함수를 호출했으므로 실측이 아니라
코드 흐름 기준 추정치이며, 각 문서에 그 사실을 명시했다.

## API/token/cost

`pipeline_logs`에 `inputTokens`/`outputTokens`는 실제로 기록되지만,
모델 단가·환율·누적 비용 집계 로직이 이 프로젝트 어디에도 없다.
**"현재 시스템에서 신뢰할 수 있는 비용 집계는 불가능하다"** — 값을
추측하지 않았다. OPS-02에서 단가 상수 + 집계 스크립트 추가를 권장한다.

## WordPress Draft / copy·manual 준비 결과

- WordPress: 실제 Draft 1건 생성 완료(Pilot A), 공개 게시는 호출하지
  않음. QA-01-FIX1 회귀(manual export 미실행으로 인한 잘못된 차단) **실제
  프로덕션 코드 경로에서 재확인 — 회귀 없음**.
- naver_cafe: 승인까지 완료, "게시 완료로 표시"는 실행하지 않음(정책대로
  copy/manual preparation까지만) — manual posting record가 export
  미실행 상태를 정확히 반영해 거부한 것도 확인(회귀 없음, wordpress_blog와
  달리 naver_cafe는 여전히 manual export 전제조건이 적용되는 게 맞다).
- x/threads/instagram: 전부 승인 완료, next action은 항상 `copy_body`
  (본문 복사) — "게시하기" 같은 존재하지 않는 action 없음. 실제 외부
  SNS API 호출 코드 자체가 이 프로젝트에 없음을 재확인.

## 발견한 OPS-Blocker

없음(3개 파일럿 전체).

## 발견한 High

1. **(Pilot A)** monetized_blog 모드 AI eval이 콘텐츠 품질과 무관하게
   `aggregateScore=0`을 반환 — journey를 막지는 않지만(saveDraftArticle은
   eval 통과를 요구하지 않음) 품질 신호로 신뢰할 수 없다. **미수정,
   OPS-02 조사 대상.**
2. **(Pilot C, 수정 완료)** X thread quality gate의 일반 `length_check`가
   thread 전체를 합산해 단일 280자 기준과 비교 — 다중 item thread에서
   구조적 False Positive. **원인이 명확하고 수정 범위가 안전해 OPS-01
   종료 전 즉시 수정**(`lib/social/social-quality-gate.ts`, 회귀 테스트
   추가, 전체 lint/vitest 3798/build/Playwright 40 재확인 완료).
3. **(Pilot C)** threads + `story` tone 조합에서 AI 응답 JSON 파싱이
   2회 연속 실패(재현율 100%, n=2) — `informational` tone은 즉시 성공.
   **미수정**(AI 출력 안정성 문제, 추가 재현 표본 필요 — OPS-02 조사 대상).
4. **(Pilot C)** instagram caption에 등록된 3개 출처(배터리 전기차
   관련) 어디에도 없는 수소연료전지차 비교 수치가 포함됐는데 자동
   검토가 놓침(Miss, confirmationCount=0). **미수정** — 콘텐츠 안전성에
   직접 영향을 주는 항목으로 OPS-02 진입 전 backlog 최우선 권고.

## High 상태 — Resolved / Remaining (OPS-02A 업데이트, 2026-09-23)

| # | 문제 | OPS-01 상태 | OPS-02A 상태 |
|---|---|---|---|
| 1 | monetized_blog eval aggregateScore=0 | 미수정 | **Resolved** — root cause는 `max_tokens` 초과로 인한 응답 잘림(criteria 17개인데 2048로 고정돼 있었음). `estimateEvalMaxTokens()`(criteria 수 비례) + 잘림 감지 가드 추가, 실제 Pilot A 기사로 재검증(aggregateScore ≈4.0/passed=true 확인). |
| 2 | X thread length_check False Positive | Resolved(OPS-01 종료 전 즉시 수정) | Resolved(변경 없음) |
| 3 | threads+story tone JSON 파싱 실패 | 미수정 | **Resolved(재현율 기준)** — root cause는 malformed escape(본문 안 인용부호 미이스케이프, story tone에서 대화체 유도로 빈발). 공통 system prompt에 인용부호 안내 추가(파서 수정 아님 — 예방). 수정 전 실측 재현율 40%(2/5 성공) → 수정 후 10/10 성공(2회 반복 검증). 잔여 확률적 위험은 완전히 0이라 단정하지 않음(정직하게 기록). |
| 4 | instagram fact-grounding Miss | 미수정 | **재분류(오판정 정정) + 근본 공백 Resolved** — OPS-02A 재조사 결과 해당 수치는 실제 verifiedFact(출처 있음)였다(당시 조사 오류, 정정 기록: `pilot-c-social.md` 15절). 다만 이 조사로 드러난 진짜 공백("quality gate에 fact-grounding 검사 자체가 없었다")은 실제 문제였고, `lib/social/fact-grounding-validator.ts` + quality gate `fact_grounding` 항목으로 플랫폼 공통 해결. |

상세: [`ops-02a-reliability-hardening.md`](./ops-02a-reliability-hardening.md).

## 발견한 Medium/Low

- (Pilot A, Medium) article 본문과 wordpress_blog post 본문이 같은
  "하루 400mg 카페인 권장량" 수치를 서로 다른 확신도로 서술 — 사람 최종
  검수 시 대조 필요.
- (Pilot A, Low) `wordpress_excerpt_present` 경고(excerpt 미입력, 가산
  요소).
- (Pilot B) Medium/Low 없음.
- (Pilot C) Medium/Low 없음(단, Content Tuning 2건 — 아래).

## Content Tuning 항목

- (Pilot A) 대표 이미지 생성/업로드는 이번 파일럿에서 스킵(비용/스코프
  제한, 버그 아님) — 운영 시 실제 이미지 파이프라인 별도 확인 필요.
- (Pilot B) 시의성 수치(기준금리 %, 외환보유액 등) 인용 시 "게시 시점
  기준 최신 값인지 재확인" 안내 문구를 게시 준비 단계에 추가하는 방안
  제안(버그 아님).
- (Pilot B) TP/FP/Miss 검증 표본 확보를 위한 의도적 상충 source 파일럿
  필요(방법론 개선, Content Tuning보다는 QA 방법론 항목).
- (Pilot C) X thread 9개는 권장 범위(3~7개) 상단 초과 — 내용은 자연스럽지만
  다소 김. instagram 해시태그 8개는 허용 범위 내이나 다소 많은 편.

## 파일럿 중/후 코드 수정 내용

파일럿 실행 중에는 어떤 프로덕션 코드도 수정하지 않았다(세 파일럿 모두
"먼저 실행, 문제는 기록만" 원칙을 지켰다). 세 파일럿 결과를 모두 취합한
뒤, 위 High #2(X thread length_check False Positive) 1건만 원인이
명확하고 안전한 범위라고 판단해 OPS-01 종료 전 즉시 수정했다. 상세는
[`pilot-c-social.md`](./pilot-c-social.md) 21절 참고.

## 수정 후 lint/test/build/e2e 결과

- `npm run lint`: 오류 없음
- `npx vitest run`: **287 files / 3798 tests 통과**(회귀 테스트 1건
  추가로 3797→3798)
- `npm run build`: 성공(19개 route)
- `npm run test:e2e`(build+fixture 생성+Playwright): **Playwright 40/40
  통과**, 회귀 없음
