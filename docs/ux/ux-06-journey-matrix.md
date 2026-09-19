# UX-06 Journey Matrix

한눈에 보는 핵심 사용자 여정 검증 결과. 상세 내용은
[`docs/ux/ux-06-user-journey-validation.md`](./ux-06-user-journey-validation.md) 참고.

| Journey | 대표 route/service | Status | Dead-end | Raw info 노출 | Primary action 충돌 | Completion 계약 |
|---|---|---|---|---|---|---|
| 1. WordPress | `wordpress-blog-publish-prep-state.ts`, `app/articles/[id]/blog/page.tsx` | ✅ 통과 (9 tests) | 0 | 0 | 0 | Draft `ready`(공개 게시 아님) |
| 2. Naver Cafe / copy | `social-quality-gate.ts`, `naver-cafe-plain-text-sanitizer.ts`, `platform-manual-posting-result-service.ts` | ✅ 통과 (6 tests) | 0 | 0 | 0 | 복사≠완료, 명시적 기록만 `posted` |
| 3. X thread | `social-post-inline-edit-service.ts` | ✅ 통과 (6 tests) | 0 | 0 | 0 | 재수정 시 승인 무효화/게시 완료 후 차단 확인 |
| 4. Multi-platform | `multi-platform-review-summary.ts`, `social-post-approval-service.ts`(bulk) | ✅ 통과 (5 tests) | 0 | 0 | 0 | 부분 승인 성공, 외부 게시 없음 |
| 5. Rewrite | `rewrite-version-user-facing-status.ts` | ✅ 통과 (7 tests) | 0 | 0 | 0 | 최종 승인 도달 시 `최종 승인` label 반복 없음 |
| 6. Dashboard 진입 | `app/dashboard/page.tsx` | ✅ 재확인(기존 검증 재사용, 신규 코드 변경 없음) | 0(기존 확인) | 0(기존 확인) | 0(기존 확인) | 목표 작업 화면 링크 존재 확인 |
| 7. Trends/Theme | `app/trends/page.tsx`, `app/themes/[themeId]/page.tsx` | ✅ 재확인(기존 검증 재사용, 신규 코드 변경 없음) | 0(기존 확인) | 0(기존 확인) | 0(기존 확인) | 다음 단계(테마 선택) 링크 존재 확인 |

프로젝트 전체 UX invariant(A-K 중 자동화된 항목)와 raw 기술 정보 노출은
`lib/ui/ux-invariants.test.ts`(26 tests)·`lib/ui/raw-technical-info.test.ts`(76 tests)로
영구 회귀 테스트화했다 — 11개 핵심 route + 8개 공유 컴포넌트를 스캔한다.

**예외로 문서화된 항목(신규 위반 아님)**: `app/articles/[id]/page.tsx`의
"⚠ 관리자 전용" 이중 접힘 내부에 남아 있는 env 변수 이름/dry-run 안내
문구는 H5(부분 해결)로 이미 감사 문서에 기록되어 있으며, raw-string
스캐너도 이 파일에 한해 그 접힘 영역만 검사 범위에서 제외하도록
명시적으로 설계했다(정당한 예외 — 회귀를 놓치는 게 아니라 이미 알고
있는 보류 항목을 스캐너가 다시 알람 내지 않게 한 것).
