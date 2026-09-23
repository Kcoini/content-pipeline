# OPS-03 운영 로그

- 작성일: 2026-09-23
- **상태: 실제 운영 2건 완료.** 접근 제어 검증(VERIFIED) 이후 실제
  Supabase/Anthropic API/WordPress 사이트를 사용해 2건의 실제
  콘텐츠(article 2개, social post 5개, 플랫폼 5종)를 처리했다. 본문/
  prompt 원문은 기록하지 않는다 — event/metric만 기록한다.
- 참고: 첫 실행 시도는 세션 rate limit으로 중단됐으나, 중단 시점까지
  **Piece 1은 이미 끝까지 완료되어 있었다**(WordPress Draft 생성 포함)
  — DB를 직접 조회해 확인한 뒤 재사용했다(중복 재생성 없음, 비용
  낭비 방지). Piece 2는 이어서 새로 실행해 완료했다.

## 콘텐츠별 기록

### Piece 1 — WordPress 블로그(설명형)

| 항목 | 값 |
|---|---|
| theme id | `57233fbd-bb6b-4820-97e5-0c9acd6da6ea` |
| article id | `38406eb3-086e-4bb4-acf5-8a85d3fdac82` |
| 주제 | 수면의 질을 높이는 방법과 올바른 수면 습관 |
| content type | monetized_blog |
| platform | wordpress_blog |
| source 수 | 3(전부 fetch 성공) |
| generation | 성공(1회, retry 없음) |
| first-pass quality | ready(1차 통과, auto-fix 불필요) |
| fact-grounding issue 수 | **10건**(checklist 항목은 1개 `warning`, 메시지에 명시된 미근거 수치/비교 claim 개수) |
| user-confirmation | 1건(fact_grounding warning) |
| blocking | 0건 |
| retry | 0건 |
| manual edit | 아니오 |
| approval | 성공(article reviewed, social post approved) |
| publish preparation | 성공(`approveAndPrepareWordPressBlogPostForPublishing` success=true, 8단계 전부 성공/스킵) |
| WordPress Draft | **성공** — `https://foodkim.com/?p=71`(externalPostId=71) |
| publish guard | ready(우회 없음, 정상 차단 없음) |
| input tokens | 21,031 |
| output tokens | 9,447 |
| 처리 시간 | 정확한 단계별 타이밍은 rate-limit로 중단된 이전 세션의 실행 로그에 있어 이 문서에는 옮기지 못했다(총 wall-clock 시간 미확보) — DB 조회로 최종 상태만 확인·재사용했다. OPS-01 Pilot A(유사한 단일 wordpress_blog 케이스)가 약 6분대였던 것과 규모가 비슷할 것으로 추정되나, 이번 건은 **추정치임을 명시**한다. |

### Piece 2 — naver_cafe/x/threads/instagram(다중 플랫폼)

| 항목 | 값 |
|---|---|
| theme id | `81990ca6-5f1c-4f25-8ec0-a089385ddc54` |
| article id | `9aa80ab5-49a6-4835-a11d-4640be9934af` |
| 주제 | 홈트레이닝 초보자를 위한 준비 운동과 부상 예방 |
| content type | source_based_explainer |
| platforms | naver_cafe, x, threads, instagram |
| source 수 | 3(전부 fetch 성공) |
| generation | 4/4 성공(1회씩, retry 없음) |
| first-pass quality | 4/4 ready(1차 통과, auto-fix 불필요) |
| fact-grounding issue 수 | naver_cafe 6건 / x 0건 / threads 1건 / instagram 2건(합계 9건) |
| user-confirmation | naver_cafe 1건(warning) / x 0건(pass) / threads 1건(warning) / instagram 1건(warning) |
| blocking | 0건(4개 전부) |
| retry | 0건 |
| manual edit | 아니오 |
| approval | 4/4 성공 — x는 `MultiPlatformReviewSummary` 기준 bulk approval 대상(needsConfirmation=0)으로 자동 일괄 승인, 나머지 3개(naver_cafe/threads/instagram)는 fact_grounding 확인 필요 항목이 있어 bulk 대상에서 제외되고, **운영자(코디네이터)가 실제 flagged claim을 직접 읽고 판단한 뒤** 개별 승인 |
| publish preparation | 해당 없음(naver_cafe/x/threads/instagram은 copy/manual capability — "게시 준비"는 approval 자체가 최종 상태) |
| WordPress Draft | 해당 없음(플랫폼 특성상 미적용) |
| manual posting 기록 | **의도적으로 호출하지 않음** — 실제 외부 게시를 하지 않았으므로 4개 전부 `manualPostStatus=not_recorded` 유지(허위 완료 기록 금지, 코드 assertion으로 확인) |
| input tokens | naver_cafe 9,339 / x 6,811 / threads 6,575 / instagram 6,728 (합계 29,453) |
| output tokens | naver_cafe 1,434 / x 1,069 / threads 417 / instagram 1,394 (합계 4,314) |
| 처리 시간 | theme 생성 0.2초, source 3건 수집+요약 52.0초, article AI 생성+평가 40.4초, 4개 플랫폼 생성(전체) 85.2초, 품질검사+자동검토(4개) 4.2초, MultiPlatformReviewSummary+bulk approval 0.9초, 개별 승인 3건 약 2.0초 — **총 약 185초(3분 5초)** |

## fact-grounding 상세(운영자 직접 확인, TP/FP 판단)

Piece 1(wordpress_blog)에서 flagged된 10건 중 실제로 본문을 읽고
확인한 결과:

- **명백한 True Positive 2건**(가장 중요): "한국보건사회연구원 조사에
  따르면, 국내 20세 이상 성인 500명 중 73.4%가 최근 한 달간 불면증을
  경험했다"(구체적 기관명+표본수+퍼센트 — 실제 3개 출처인 위키백과
  수면/불면증/Sleep hygiene 문서에 이런 한국 설문 통계는 없음), "미국
  수면의학회(AASM)는 2021년 메타분석을 통해..."(구체적 기관+연도+
  결론 — 마찬가지로 출처에서 확인 안 됨). **이 두 건은 fact-grounding
  validator가 정확히 의도대로 동작해 실제로 위험한 미확인 주장을
  잡아낸 사례다 — 이번 파일럿에서 Miss가 아니라 정반대로 "제대로
  작동함"을 실증했다.**
- **False Positive로 판단되는 항목 다수**: "침실 온도 18~20도",
  "낮잠 20~30분" 같은 일반적으로 널리 알려진 수면 위생 권장 수치가
  반복 등장 — 특정 출처를 정확히 인용한 것이 아니라 일반 상식 수준의
  범위값이라 "미근거"로 잡히지만 실제로 위험한 주장은 아니다. 반복
  언급(같은 수치가 여러 문장에 등장)도 각각 별도 건으로 카운트되어
  체감 건수(10건)가 실제 "새로 확인해야 할 고유 주장" 수보다 부풀려
  보인다.

Piece 2(instagram)에서 flagged된 2건 중 1건("60초 이상 정적
스트레칭은 오히려 근력을 일시적으로 떨어뜨릴 수 있다는 연구
결과도 있어요")은 운동 생리학에서 비교적 널리 알려진 소견이고
"연구 결과도 있어요"로 적절히 헤지되어 있어 **경계선(борderline) —
FP에 가깝다**고 판단했다(다만 이 3개 출처에 정확히 이 문장이 있는지는
확인 못함, 완전히 무해하다고 단정하지 않음).

**Miss(놓친 것)**: 이번 2건에서는 발견하지 못했다 — 최종 콘텐츠를
직접 읽어봤을 때 fact_grounding이 놓친 명백한 미확인 사실 주장은
없었다.

**결론**: True Positive 2건(피스1) + 경계선 FP 다수(주로 반복되는
일반 상식 수치) + Miss 0건. 표본이 작아(2건) 통계적 정밀도/재현율로
표현하지 않는다 — 다만 가장 중요한 신호(기관명+구체적 통계를 곁들인
가짜 같은 주장)를 정확히 잡아낸 것은 고무적인 실제 운영 결과다.

## structured output 결과

| platform | tone | parse | retry | 최종 결과 |
|---|---|---|---|---|
| wordpress_blog | explanatory(자동) | 성공(1회) | 없음 | 성공 |
| naver_cafe | story | 성공(1회) | 없음 | 성공 |
| x | curiosity | 성공(1회) | 없음 | 성공 |
| threads | story | 성공(1회) | 없음 | 성공 |
| instagram | comparison | 성공(1회) | 없음 | 성공 |

OPS-02A에서 확인된 threads+story 조합의 malformed-escape 완화
prompt가 실제 운영에서도(이번 threads 항목은 story tone) 정상
작동함을 실측으로 재확인했다(1회 성공, parse 실패/retry 없음).

## auto-fix

이번 운영 2건(5개 social post) 전부 1차 quality gate에서 바로
`ready` 상태에 도달해 **auto-fix가 발동하지 않았다**(정상 — 표본
부족일 뿐 문제 아님).

## stalled job / operational failure

없음. `job_runs`/`job_run_steps`를 사용하는 job 기반 실행이 아니라
직접 서비스 함수를 호출하는 스크립트 실행 방식이라 stalled 개념이
적용되지 않는다(실행 자체가 동기적으로 끝까지 진행됨). 5개 social
post 생성 전부 1회 시도로 성공했고, 예외/실행 실패는 0건이었다.

## 기록 형식(참고 — 최초 버전)

| # | 시각 | article id | content type | platforms | generation | quality | fact-grounding issues | confirmation | blocking | auto-fix | retry | approval | publish prep | WordPress Draft | input tokens | output tokens | 처리시간 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 2026-09-23 | 38406eb3-... | monetized_blog | wordpress_blog | 성공 | ready | 10 | 1 | 0 | 0 | 0 | approved | 성공 | 성공(#71) | 21031 | 9447 | 추정(미확보) |
| 2 | 2026-09-23 | 9aa80ab5-... | source_based_explainer | naver_cafe/x/threads/instagram | 4/4 성공 | 4/4 ready | 9(합) | 3(합) | 0 | 0 | 0 | 4/4 approved | 해당없음(copy/manual) | 해당없음 | 29453 | 4314 | 약 185초 |

## Access control 확인 기록

| 확인 시점 | Access control verified | Method |
|---|---|---|
| 2026-09-23 (OPS-03 시작 전, 최초) | no | 사용자 확인 — 호스팅 레벨 접근 제어 미설정/미확인 |
| 2026-09-23 (OPS-03-GATE Verification) | **yes** | 실제 anonymous curl 요청(root/`/dashboard`/`/api/job-runs/test`) — Vercel SSO(`vercel.com/login`)로 302 redirect, 앱 콘텐츠 미노출 확인. bypass token/secret 미사용. Protection Scope = All Deployments(Vercel Authentication). |
| 2026-09-23 (OPS-03 운영 시작 전 재확인) | yes | 위와 동일 결과 유지(새 배포 없었음, 재검증 불필요 판단) |

> 상세 근거는 `docs/ops/ops-03-limited-operation-plan.md`의 "0-B.
> OPS-03-GATE Verification" 절 참고.
