# Product Readiness Summary

- 작성일: 2026-09-24
- 목표 정의(명확히): 이 프로젝트는 **판매 가능한 SaaS가 아니다.** 목표는
  **consumer-style internal service** — 내부 직원이 프로그램 구조를
  몰라도 별도 교육 없이 콘텐츠 생성·검토·승인·게시 준비를 수행할 수
  있는 내부 도구 수준의 제품형 UX다.

## 제품 목표

"주제 입력 → 참고자료 확인 → 콘텐츠 생성 → 검토/승인 → 게시 준비"를
한 명의 비개발자 내부 직원이 설명 없이 끝까지 수행할 수 있게 하는 것.
백엔드 생성/검증/승인/게시 안전 로직은 PRODUCT-01A 이전부터 이미
완성되어 있었고, PRODUCT-01A~H는 그 위에 **표현/내비게이션/용어/오류
문구**만 다뤘다.

## 완료한 PRODUCT-01A~H

| Phase | 범위 | 상태 |
|---|---|---|
| 01A | Customer/Admin boundary 조사(감사만) | 완료 |
| 01B | User Shell 구현(navigation 분리, 기술 용어 정리) | 완료 |
| 01C | Review 언어/navigation trigger 정리 | 완료 |
| 01D | First-use welcome + Settings 신설 | 완료 |
| 01E | Content Creation Experience(주제→참고자료→콘텐츠 만들기) | 완료 |
| 01F | Publish & Connection UX(Draft/Copy/Manual 구분) | 완료 |
| 01G | Friendly Errors & Empty States | 완료 |
| 01H | Consumer-style Usability QA(이 문서) | 완료 |

## 현재 User Journey

```
첫 접속(welcome, 신규 사용자만)
  → 주제 선택(생성/기존 목록에서 선택)
  → 참고자료 확인(URL 추가, 자동 본문/요약 수집)
  → 콘텐츠 만들기(마스터 원고 → 플랫폼별 글 생성, 카드/선택/전체 3단계 계층)
  → 결과 확인(생성된 글 목록)
  → 검토(출처 확인 + 사람 확인 필요 항목 분리)
  → 최종 승인(승인 ≠ 게시)
  → 게시 준비(플랫폼별: WordPress=초안 저장 / Copy=본문 복사 / Manual=외부 직접 게시)
  → (선택) 게시 완료 기록(앱이 게시한 게 아니라 사용자가 결과를 기록)
```

## Safety Model(변경 없음, 전체 Phase에서 유지)

- 승인 완료 ≠ 게시 완료.
- 게시 준비 완료 ≠ 실제 게시 완료.
- WordPress 초안 저장 ≠ 공개 게시(서버 측에서 draft API만 호출, 이번
  Phase까지 direct publish 기능 추가 없음).
- 본문 복사 ≠ 플랫폼 게시.
- "게시 완료 기록" = 사용자가 외부 게시 결과를 기록한 것 — 앱이
  직접 게시했다는 뜻이 아님.
- Source Evidence Integrity/fact-grounding/승인 gate/publish guard는
  PRODUCT-01A~H 어디에서도 로직을 변경하지 않았다(전부 표현만 조정).

## User/Admin Boundary

RBAC 없음(의도적) — `DashboardMenuGroup.audience: "user" | "admin"`로
navigation 정보구조만 분리. 관리자/고급 그룹은 상단에 항상 노출되지
않고, 드롭다운 안에서 구분선 + 안내 문구 + 옅은 색으로만 구분된다.
Admin 화면(`/dashboard/platform-api`, `/dashboard/automation-safety`)은
삭제되지 않고 그대로 존재한다.

## Platform Capability(변경 없음)

| platform | capability |
|---|---|
| wordpress_blog | draft |
| naver_blog / news_article / opinion_column | manual |
| naver_cafe / x / threads / instagram | copy |

"direct_publish"는 어떤 플랫폼에도 구현되어 있지 않다(PRODUCT-01F에서
확인, 이번 Phase에서도 추가하지 않음).

## Known Limitations

- ContentProgressSteps의 "콘텐츠 만들기" 단계가 마스터 원고 생성과
  플랫폼별 글 생성 두 실제 작업을 하나의 stepper key로 묶는다(P2,
  실제 사용자 혼란 증거 없음 — PRODUCT-01H에서 재확인, 수정하지 않음).
- `fromWordPressPublishPrepStateToPublishPreparation()`과 실제
  WordPress 페이지가 쓰는 `fromWordPressPublishPrepState`가 별도
  어댑터로 공존(P2, 기술부채 — 사용자에게 보이는 영향 없음).
- "마스터 원고"라는 용어가 stepper의 "콘텐츠 만들기"와 다른 단어로
  등장(P3, 전체 페이지 맥락에서는 설명이 함께 있어 이해 가능).
- "테마"/"출처" 용어 통일이 `/themes/[themeId]` 페이지, 상단 nav의
  "자동 테마 찾기"(별도 기능명), 내부 log 메시지에는 적용되지 않음
  (P3, 범위 밖으로 유지).
- "publish preparation 없음" 상태에 전용 empty-state UI가 없다(의도적
  — 섹션이 아예 렌더링되지 않아 오류처럼 보이지 않음, P3).
- 전사급 observability/notification center/새 retry engine은 이번
  Phase까지 의도적으로 구축하지 않았다(과설계 금지 원칙).

## P0/P1/P2/P3 최종 집계

- **P0**: 0.
- **P1**: 0.
- **P2**: 2개(PRODUCT-01E stepper 통합 미룸, PRODUCT-01F adapter 이중화) — 둘 다 사용자에게 보이는 영향 없음, 기술부채로 분류.
- **P3**: 2개("마스터 원고" 용어, "테마/출처" 범위 밖 잔존) — 관찰만.

## Internal Consumer-style Readiness

PRODUCT-01H QA(`docs/product/product-01h-consumer-usability-qa.md`)
결과: Journey A~H 전부 PASS(부분 항목 N/A 제외), blind-task mismatch
0건, primary action collision 0건, dangerous publish misunderstanding
0건, raw technical term 노출 0건(발견 즉시 수정 1건 포함). Safety
Understanding Test 4문항/Error Understanding Test 전부 화면만으로
정답 도출 가능.

## 운영 후 관찰 항목

- "마스터 원고" 용어가 실제 신규 사용자에게 혼란을 주는지(현재는
  전체 페이지 맥락에서 설명이 있어 문제없다고 판단했으나, 상태
  카드만 보는 경우가 실제로 많다면 재검토).
- "publish preparation 없음" 상태(섹션 미노출)가 사용자에게 "이
  기능이 있는지도 몰랐다"는 피드백으로 이어지는지.
- Settings의 readiness 배너(`getContentServiceReadiness`)가 실제
  운영 중 env 변경 시나리오에서 정확히 반영되는지.
- `app/error.tsx`(전역 boundary)가 실제 운영 환경에서 발생하는
  예외 유형을 얼마나 커버하는지(현재는 정적 fixture로만 검증).

## 다음 개발 Phase 필요 여부

즉시 필요한 후속 기능 개발 Phase는 없다(P0/P1 0건). 위 "운영 후
관찰 항목"에서 실제 사용자 피드백이 쌓이면 그때 P2/P3 항목을
재평가해 후속 Phase 여부를 결정한다.
