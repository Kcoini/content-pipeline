# OPS-03 운영 기준선 Summary

- 작성일: 2026-09-23
- **표본: 실제 콘텐츠 2건(article), 플랫폼 5개(social post) 처리.**
  최대 10건 한도 내에서, "운영 판단에 충분한 표본이 모이면 종료
  가능하다"(Phase 지시서 섹션 1)에 따라 초기 기준선 확보 목적으로
  2건에서 종료했다. **표본이 매우 작으므로 아래 비율을 통계적 성능
  보장으로 해석하지 않는다** — 목적은 명백한 실패 패턴 발견과 운영
  기준선 확보다.
- 상세 event/metric: `docs/ops/ops-03-operation-log.md`.

| 지표 | 값 | 계산 |
|---|---|---|
| 콘텐츠 처리 건수 | article 2건, social post 5건 | Piece 1(wordpress_blog) + Piece 2(naver_cafe/x/threads/instagram) |
| 플랫폼별 성공 | wordpress_blog 1/1, naver_cafe 1/1, x 1/1, threads 1/1, instagram 1/1 | 전부 성공 |
| Generation success rate | **100%**(5/5) | 5개 플랫폼 생성 전부 1회 시도로 성공 |
| First-pass quality-ready rate | **100%**(5/5) | 전부 1차 quality gate에서 ready 도달, auto-fix 불필요 |
| Human-confirmation rate | **80%**(4/5) | wordpress_blog/naver_cafe/threads/instagram은 fact_grounding warning으로 확인 필요, x만 완전 clean |
| Manual-edit rate | **0%**(0/5) | 사람이 본문을 직접 수정한 사례 없음 |
| Retry rate | **0%**(0/5) | AI/구조화 출력/품질/WordPress 어느 단계에서도 retry 없음 |
| Publish-preparation success rate | **100%**(1/1, wordpress_blog만 해당) | naver_cafe/x/threads/instagram은 copy/manual capability라 별도 "게시 준비" 단계가 approval과 분리되어 있지 않음(N/A 처리) |
| WordPress Draft success rate | **100%**(1/1) | `https://foodkim.com/?p=71` 실제 생성 |
| Structured-output failure rate | **0%**(0/5) | JSON parse 실패/retry 없음(threads+story 포함) |
| Auto-fix occurrence | **0건** | 전부 1차 ready라 발동 조건 자체가 없었음(문제 아님) |
| Fact-grounding issue count | **19건**(claim 단위, checklist 항목 기준으로는 4건) | wordpress_blog 10 + naver_cafe 6 + threads 1 + instagram 2 |
| Fact-grounding TP(운영자 직접 확인) | **2건**(전부 wordpress_blog) | 기관명+구체적 통계/연도를 포함한 미확인 주장 — validator가 정확히 잡아냄 |
| Fact-grounding Miss(운영자 직접 확인) | **0건** | 최종 콘텐츠 직접 검토 결과 놓친 명백한 미확인 주장 없음 |
| Input tokens | **50,484** | wordpress_blog 21,031 + (naver_cafe 9,339+x 6,811+threads 6,575+instagram 6,728) |
| Output tokens | **13,761** | wordpress_blog 9,447 + (naver_cafe 1,434+x 1,069+threads 417+instagram 1,394) |
| 가격 계산 | **불가**(`costUnavailable`) | `lib/ops/model-pricing.ts`의 `PRICING_TABLE`이 비어 있음(OPS-02B의 의도적 설계) — 0원으로 대체하지 않았다 |
| Stalled job | 0건 | job 기반 비동기 실행이 아니라 동기 스크립트 실행이라 개념 자체가 적용되지 않음 |
| Operational failure | 0건 | 예외/실행 실패 없음 |

## 해석 주의

표본이 article 2건/social post 5건 수준이므로, 위 비율(100%/80%/0%
등)을 "이 시스템은 항상 이 정도 성공률을 낸다"는 통계적 보장으로
읽지 않는다. 이번 결과가 보여주는 것은:

1. 명백한 실패 패턴(반복 실패/데이터 손실/위험한 자동 게시)은
   **발견되지 않았다.**
2. fact-grounding validator가 실제 운영 콘텐츠에서 **실제로 위험한
   미확인 주장(기관명+통계) 2건을 정확히 잡아냈다** — OPS-02A에서
   구축한 안전장치가 실제 운영 조건에서 작동함을 실증했다.
3. 5개 플랫폼 생성/품질검사/승인/WordPress Draft 전부 재시도 없이
   1회 성공 — 구조화 출력 안정성(OPS-02A의 malformed-escape 완화
   포함)이 이번 표본에서는 문제를 일으키지 않았다.

새로운 OPS-Blocker/High는 발견되지 않았다(상세는 완료 보고 참고).
