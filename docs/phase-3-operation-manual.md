# Phase 3 Operation Manual

이 문서는 운영자가 기사 한 편을 만들어 여러 플랫폼에 수동으로
게시하기까지, 실제로 클릭하는 순서를 기준으로 정리한다. 모든 단계는
사람이 화면에서 버튼을 눌러 진행하며, 어떤 단계도 외부 플랫폼에
자동으로 게시하지 않는다.

## 운영 흐름 (전체 순서)

1. **article 생성 또는 선택** — `/dashboard` 또는 `/articles`에서
   테마 입력 → 출처 등록 → 계약 검사 → 기사 초안 생성, 또는 기존
   기사를 선택한다.
2. **`/articles/[id]`에서 기사 개요 확인** — 기사 본문, 상태, 하위
   워크플로우(블로그/소셜/rewrite/성과/AB테스트) 진입점을 확인한다.
3. **`/articles/[id]/blog`에서 블로그 글 관리** — WordPress/Naver
   Blog 등 블로그형 플랫폼용 글을 생성/검수한다.
4. **`/articles/[id]/social`에서 SNS/커뮤니티 글 관리** — X/Threads/
   Instagram/Naver Cafe 등 SNS·커뮤니티형 글을 생성/검수한다.
5. **quality check 실행** — 각 social post 카드의 "품질검사" 버튼.
   `quality_status`가 `ready`가 되어야 다음 단계로 진행할 수 있다.
6. **approval 요청 및 승인** — "승인 요청" 버튼으로 검토를 요청하고,
   승인권자가 승인하면 `approval_status = approved`가 된다.
7. **manual export 생성** — "Manual Export" 버튼으로 복사해서
   붙여넣을 수 있는 payload를 만든다.
8. **publishing guard 실행** — "Publishing Guard 실행" 버튼으로
   금지 표현/플랫폼별 규칙을 다시 확인한다. `platform_publish_ready`가
   true가 되어야 다음 단계로 진행할 수 있다.
9. **dry-run 생성** — "Dry-run 생성" 버튼으로 실제 게시 없이 최종
   payload 형태를 미리 확인한다.
10. **handoff 완료** — "Handoff 완료" 버튼으로 "이 글은 실제 게시
    담당자에게 넘길 준비가 됐다"는 상태로 전환한다.
11. **사람이 실제 플랫폼에 수동 게시** — export payload/dry-run
    결과를 참고해 운영자가 직접 각 플랫폼(WordPress 관리자 화면,
    X/Threads/Instagram 앱, Naver Blog/Cafe 등)에 게시한다.
12. **manual posting result 기록** — "게시 결과 기록" 버튼으로 실제
    게시 URL과 결과를 남긴다(`manual_post_status = posted`).
13. **metrics 수동 입력** — "Metrics 입력" 버튼으로 조회수/좋아요/
    댓글/공유 등을 직접 입력한다(자동 수집 없음).
14. **performance 확인** — `/articles/[id]/performance`에서 입력한
    metrics 기반 성과 점수를 확인한다.
15. **rewrite suggestion 생성** — 성과가 낮은 글에 대해
    `/articles/[id]/rewrite`에서 rewrite 제안을 생성한다.
16. **rewrite version 적용** — 제안을 적용하면 원본을 덮어쓰지 않고
    새 버전 row(`social_post_versions`)가 생성된다.
17. **version comparison 실행** — 새 버전과 원본/이전 버전의 품질을
    비교한다.
18. **reapproval/reexport 실행** — rewrite version은 재승인을 거쳐야
    재export할 수 있다(원래 승인과 별도 트랙).
19. **rewrite performance comparison 확인** — 원본과 rewrite의 실제
    성과(둘 다 수동 입력된 metrics 기준)를 비교한다.
20. **A/B test draft 생성** — `/articles/[id]/ab-tests`에서 variant를
    묶어 A/B 테스트 draft를 만든다(자동 실행 아님, 수동 게시 결과를
    각각 기록해야 비교가 의미 있다).
21. **API publish readiness 확인** — `/dashboard/platform-api`에서
    플랫폼별 API 게시 "준비 상태"만 확인한다(실제 게시 아님).
22. **automation safety review 실행** — `/dashboard/automation-safety`
    에서 feature flag/승인·가드 정합성/로깅 보안/콘텐츠 안전 규칙을
    점검한다. 실제 게시나 자동 수정 기능은 없다.

## 화면별 설명

### `/articles/[id]`
기사 본문, 메타데이터, 상태를 확인하고 blog/social/rewrite/
performance/ab-tests 하위 페이지로 이동하는 진입점.

### `/articles/[id]/blog`
블로그형 플랫폼(wordpress_blog, naver_blog)의 social post를
생성/검수/승인/export/가드/dry-run/handoff/게시결과/metrics까지
관리한다.

### `/articles/[id]/social`
SNS/커뮤니티형 플랫폼(naver_cafe, x, threads, instagram)의 social
post를 동일한 워크플로우로 관리한다.

### `/articles/[id]/rewrite`
성과 기반 rewrite 제안 생성, 버전 적용, 버전 비교, 재승인/재export,
rewrite-vs-원본 성과 비교를 한 곳에서 처리한다.

### `/articles/[id]/performance`
기사에 속한 social post들의 수동 입력 metrics와 성과 점수를
모아 보여준다.

### `/articles/[id]/ab-tests`
원본 vs rewrite 등 variant를 묶은 A/B 테스트 draft를 만들고 상태를
관리한다(초안 구조일 뿐, 자동 게시/자동 승자 판정 실행 없음).

### `/social-posts/[id]`
social post 하나의 상세 화면. 다른 목록/대시보드에서 딥링크로
진입하는 용도로 쓰인다.

### `/dashboard/content`
article 단위로 전체 콘텐츠 상태를 모아보는 대시보드.

### `/dashboard/blog`
블로그형 social post 전체를 모아보는 대시보드.

### `/dashboard/rewrite`
rewrite 워크플로우(제안/적용/비교/재승인) 상태를 모아보는 대시보드.

### `/dashboard/social-performance`
플랫폼/문체별 성과, 차트, rewrite 비교를 모아보는 성과 대시보드.

### `/dashboard/platform-api`
플랫폼별 API 게시 "준비 상태"만 보여준다. capability matrix,
readiness, 설정 누락 여부를 확인할 수 있으며, 토큰/키 값은
표시하지 않는다. 실제 게시 버튼은 없다.

### `/dashboard/automation-safety`
전체 워크플로우에 대한 자동화 안전 점검 결과(feature flag, 승인/
가드 정합성, 로깅 보안, 콘텐츠 안전 규칙)를 보여준다. 점검 전용
화면이며 데이터를 수정하지 않는다.

## 관련 문서

- 전체 개요: [`phase-3-final-overview.md`](./phase-3-final-overview.md)
- 아키텍처: [`phase-3-architecture.md`](./phase-3-architecture.md)
- 라우트 맵: [`phase-3-route-map.md`](./phase-3-route-map.md)
- 안전 체크리스트: [`phase-3-safety-checklist.md`](./phase-3-safety-checklist.md)
