# UX-02A: Critical Safety + Main Article UX Cleanup

- 작성일: 2026-09-18
- 범위: `app/articles/[id]/page.tsx`에 집중된 Critical 안전 문제(C1)와
  기술 정보 노출(C2, C7), 중복 섹션(C5)만 처리한다. `docs/ux/full-ux-audit.md`,
  `docs/ux/user-journey-audit.md`, `docs/ux/ui-information-levels.md`,
  `docs/ux/ux-refactor-roadmap.md`(UX-01 산출물)를 근거로 작업했다.
- 이번 Phase에서 하지 않은 것: `WordPressPublishingPanel` 전체 공통화,
  `AutoReviewSummaryCard`/`InlinePostBodyEditor` 통합, `HumanReviewPanel`/
  `WorkflowStatusCard` 신설, 전체 dashboard 필터 raw status 정리, rewrite
  승인 용어 정리, X inline edit 문제, 전 route status helper 전면 적용,
  Job Progress 리팩터링 — 모두 UX-02B/UX-03 이후로 남긴다.

## 1. C1 — "테스트/실제 공개 게시" 문제 처리

- `publishApprovedArticleToWordPressAction`을 호출하는 버튼 라벨을
  `"WordPress 공개 게시 테스트 실행 (실제 공개 게시)"` →
  `"WordPress 실제 공개 게시 실행"`으로 바꿔 "테스트"라는 단어를
  완전히 제거했다. 실제 동작(외부 공개 게시)은 전혀 바꾸지 않았다.
- 이 버튼이 속한 섹션 전체("Human Approval Before Public Publish" 이후
  게시 실행 부분)를 "고급 기능: 원본 article WordPress 전송"이라는
  기존 접힘 하나만으로 두지 않고, 그 **안에서 한 번 더** 별도의
  `⚠ 관리자 전용: WordPress 실제 공개 게시` 접힘(`<details>`, 빨간
  테두리)으로 격리했다. 이 접힘을 열면 버튼보다 먼저 "일반 사용자는
  사용하지 않아야 하며, 공개 이후 되돌릴 수 없습니다"라는 경고 문구가
  보인다.
- 기존 확인 절차(`ConfirmSubmitButton`의 `confirmMessage="이 작업은
  WordPress 글을 실제 공개 상태로 변경합니다. 계속할까요?"`)와
  service 레이어의 guard(`checkPublicPublishGuard` — 품질검사 통과 +
  최종 승인 + WordPress draft 존재 + 미공개 상태를 모두 만족해야만
  WordPress API를 호출)는 그대로 유지했다. 즉 **이번 변경은 라벨과
  노출 위치만 바꿨고, 실행 가능 조건(guard)은 손대지 않았다.**
- "Human Approval Before Public Publish" 섹션 제목은 "공개 게시 최종
  승인 (관리자 전용 기능의 사전 단계)"로 한국어화했다. 이 섹션 자체는
  외부 시스템을 바꾸지 않는 승인 플래그 저장일 뿐이라 별도 관리자
  전용 접힘으로 옮기지 않았다(승인 취소 버튼도 함께 있어 안전하게
  되돌릴 수 있다).

## 2. 실제 public publish 기능이 현재 어디에 남아 있는지

- `lib/publish/wordpress-public-publish-service.ts`의
  `publishApprovedArticleToWordPress` (service 레이어, 변경 없음)
- `app/articles/[id]/actions.ts`의 `publishApprovedArticleToWordPressAction`
  (server action, 변경 없음)
- UI 진입점은 `app/articles/[id]/page.tsx` 단 한 곳이며, 위 1번처럼
  "고급 기능" 접힘 → "⚠ 관리자 전용" 접힘, 두 단계를 모두 열어야만
  버튼이 보인다. `/articles/[id]/blog`(wordpress_blog 카드) 쪽에는
  애초에 이 action이 연결되어 있지 않다(WordPress Draft 생성까지만
  제공) — 확인 결과 새로 격리할 대상이 아니었다.

## 3. 일반 사용자 화면에서 public publish가 완전히 제거되었는지

**완전히 제거하지는 않았다.** 코드 주석과 기존 테스트(`page.test.ts`)를
보면 이 "원본 article WordPress 전송" 경로 자체가 기존에도 유지되어야
하는 보조 기능(Phase 2 때 만들어진 개별 기능)으로 명시되어 있어, 이번
Phase 지시(N. "route를 삭제하지 않는다", "기능이 관리자용으로 반드시
필요하다면 명확히 별도 관리자 기능으로 격리")에 따라 **격리 쪽을
선택**했다. 일반 사용자가 `/articles/[id]`를 열었을 때 기본 화면에서는
이 버튼이 전혀 보이지 않으며, 우연히 "고급 기능"을 열어도 바로 보이지
않고 한 번 더 열어야 한다.

## 4. 제거/숨긴 env 변수 노출 목록

기존에 이미 `<details>`(예: "이미지 업로드 상세 보기", "WordPress 연결
상세 보기", "SEO 반영 상세 보기", "고급 설정 보기")로 감싸져 있던
다음 env 변수들은 **위치는 그대로 유지**했다(이미 Phase 4-7에서
접힘 처리가 되어 있었음을 확인했다) — 별도 이동이 필요하지 않았다:

- `WORDPRESS_MEDIA_UPLOAD_ENABLED`
- `WORDPRESS_BASE_URL` (`process.env.WORDPRESS_BASE_URL`)
- `WORDPRESS_PUBLISH_ENABLED`
- `SEO_PLUGIN_PROVIDER` / `SEO_PLUGIN_WRITE_ENABLED`
- `WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED`

이번 Phase에서 새로 숨긴 것은 SEO plugin **provider select**다(5번
참고) — 이전에는 접힘 없이 폼에 바로 노출되어 있었다.

## 5. SEO provider select 처리 방식

- "SEO Plugin Metadata" 섹션에 `현재 SEO 연동: {provider 라벨}"`
  한 줄을 먼저 보여준다(예: "Rank Math", "없음 (none)").
- 실제 provider를 바꾸는 `<select name="provider">`는 `"SEO plugin
  직접 선택 (고급)"` 이라는 `<details>` 안으로 옮겼다. 기본값
  (`defaultValue={article.seoPluginProvider}`)은 그대로 유지되므로,
  사용자가 이 접힘을 열지 않고 바로 "SEO plugin metadata 생성"을
  눌러도 기존과 동일하게 동작한다(폼 값 제출은 `<details>`가 닫혀
  있어도 정상적으로 이루어진다).
- provider 옵션 목록(`SEO_PLUGIN_PROVIDER_OPTIONS`)과 action
  (`generateSeoPluginMetadataAction`)은 삭제하지 않았다.

## 6. 중복 "WordPress 게시 준비" 섹션 처리 방식

- 두 섹션의 역할이 서로 다르다는 것을 확인했다: 하나는 "자동 실행"
  트리거(metadata/SEO/이미지/quality gate를 한 번에 실행), 다른 하나는
  "상태 요약 + 다음 작업 안내" 카드(`summarizeWordPressPublishingReadiness`
  기반, 이미 사용자 친화적으로 잘 구현되어 있었음)다. 두 섹션을 완전히
  합치면 큰 리팩터링(코드 이동 범위가 넓어짐)이 필요해 이번 Phase
  범위(N. "이번 Phase가 커지지 않게 한다")를 벗어난다고 판단했다.
- 대신 **이름 중복만 제거**했다: 자동 실행 섹션의 제목을 "WordPress
  게시 준비" → "WordPress 게시 준비 자동 실행"으로 바꿨다(이미 버튼
  라벨과 동일한 문구였다). 상태 요약 카드는 원래 이름 "WordPress
  게시 준비"를 그대로 유지했다 — 이제 정확히 일치하는 "WordPress
  게시 준비" 제목은 페이지에 하나뿐이다(`page.test.ts`에 이를 강제하는
  테스트를 추가했다).
- 두 섹션을 완전히 하나로 합치는 것은 UX-02B/UX-03의 공통 컴포넌트
  통합(`NextActionPanel`) 작업과 함께 다시 검토하는 것을 권장한다
  (`docs/ux/ux-refactor-roadmap.md`의 UX-03 참고).

## 7. raw status 번역/숨김 적용 내용

기존 status label 상수(`PUBLISH_QUALITY_GATE_STATUS_LABEL`,
`PUBLIC_PUBLISH_APPROVAL_STATUS_LABEL` 등, 새로 만들지 않고 페이지에
이미 있던 것을 재사용)를 적용해 다음 raw 값들을 화면(주로 "공개 게시
최종 승인"과 "WordPress 실제 공개 게시" 섹션)에서 제거했다:

- dt 라벨 `publish_quality_gate_status`/`publish_ready`/
  `public_publish_approval_status`/`public_publish_approved`/
  `public_published` → "품질검사 상태"/"공개 게시 준비 완료"/
  "최종 승인 상태"/"최종 승인 완료"/"공개 게시 완료"
- dd 값 `{article.publishQualityGateStatus}`(raw enum 그대로 출력)
  → `PUBLISH_QUALITY_GATE_STATUS_LABEL[...]`
- dd 값 `{article.publicPublishApprovalStatus}` → 동일하게
  `PUBLIC_PUBLISH_APPROVAL_STATUS_LABEL[...]`
- 경고 문구 `"publish_ready=true, publish_quality_gate_status=
  ready_to_publish, ..."` 형태의 raw 필드명 나열 2곳을 "품질검사 통과,
  공개 게시 준비 완료 상태, WordPress draft 존재 조건을 모두
  만족해야 합니다." 같은 자연어 문장으로 교체했다.
- "Publish Quality Gate" 섹션의 dt `score`/`publish_ready`도 "품질
  점수"/"공개 게시 준비 완료"로 바꿨다.

`quality_status` 같은 필드명이 안내 문구에 섞여 있던 문제
(`app/articles/[id]/blog/page.tsx:997`)는 이번 Phase 대상 파일
(`page.tsx`)이 아니어서 손대지 않았다 — UX-02B에서 처리한다.

## 8. app/articles/[id]의 최종 역할

코드를 확인한 결과, 이 페이지는 이미 **보조 route**로 명확히
포지셔닝되어 있었다(변경 전부터):

- 페이지 상단에 "현재 페이지의 본문은 원본 article입니다. WordPress
  블로그형 글로 게시하려면 Blog 탭에서 wordpress_blog 글을 생성한 뒤
  WordPress Draft를 생성하세요."라는 안내가 이미 있다.
- 메인 사용자 흐름은 `/articles/[id]/blog`, `/articles/[id]/social`로
  완전히 이동한 상태이며, `/articles/[id]`는 (a) 기사 원본/출처/
  마스터 원고 확인, (b) 생성된 콘텐츠 요약 + 하위 페이지 이동,
  (c) "고급 기능"으로 격리된 원본 article 직접 WordPress 전송(레거시
  보조 경로) 세 가지 역할을 한다.
- 이번 Phase에서는 이 역할 구분 자체를 바꾸지 않았고(route 삭제 없음,
  deep link 없음), "고급 기능" 안의 위험한 부분(공개 게시)만 한 단계
  더 격리했다. 향후 이 페이지의 "고급 기능" 전체를 별도 관리자
  route로 분리할지는 UX-03 이후 별도 논의가 필요하다(트래픽/사용
  빈도를 먼저 확인 권장).

## 9. 수정한 파일 목록

- `app/articles/[id]/page.tsx` — C1/C5/C7 및 관련 raw status 번역 수정
- `app/articles/[id]/page.test.ts` — 이름 변경에 따른 기존 테스트 수정
  2건 + 새 테스트 3개 describe 블록 추가
- `docs/ui-ux-governance-rules.md` — env 변수/"테스트" 라벨/public
  publish/provider 노출 금지 원칙 섹션 추가
- `docs/ux/full-ux-audit.md`, `docs/ux/ux-refactor-roadmap.md` — UX-02A
  진행 결과 반영
- `docs/ux/ux-02a-critical-safety-cleanup.md` — 이 문서(신규)

## 10. 추가/수정한 테스트

`app/articles/[id]/page.test.ts`에 추가:

- `Phase UX-02A (C1): '테스트' 라벨의 실제 공개 게시 UI 제거 + 관리자
  전용 격리` — "테스트" 문구 부재, 새 라벨 존재, 관리자 전용 접힘이
  "고급 기능" 접힘보다 뒤에(안에) 있고 실제 publish action form이 그
  관리자 전용 접힘 뒤에만 있는지, 경고 문구 존재, ConfirmSubmitButton
  유지, raw dt 필드명 부재, Draft 관련 action은 그대로 유지되는지 검사
- `Phase UX-02A (C7): SEO plugin provider select는 기본 화면에 노출되지
  않는다` — "현재 SEO 연동" 문구 존재, provider select가 `<details>`
  안에만 있는지, 옵션/action이 삭제되지 않았는지 검사
- `Phase UX-02A: 자동 실행 섹션과 아래 게시 준비 상태 요약 카드가 서로
  다른 이름을 쓴다(중복 섹션명 제거)` — 정확히 일치하는 "WordPress
  게시 준비" 제목이 페이지에 하나만 남았는지 검사

기존 테스트 중 이름 변경으로 문자열이 달라진 2건(`"WordPress 게시
준비</h2>"` → `"WordPress 게시 준비 자동 실행</h2>"`)을 함께 수정했다.

## 11. lint 결과

`npm run lint` — 오류 없음(출력 없음).

## 12. test 결과

- `app/articles/[id]/page.test.ts`: 68 passed
- `app/articles/[id]/` 디렉터리 전체(7개 파일): 426 passed
- 전체 스위트: **255 files / 3316 tests passed**, 실패 없음

## 13. build 결과

`npm run build` 성공 (`next build`, Turbopack, TypeScript 통과, 19개
route 모두 정상 생성). 새로 발생한 오류 없음.

## 14. tsc 관련 참고 (기존 vs 신규 구분)

`npx tsc --noEmit -p .` 실행 시 148줄 분량의 사전 존재 오류가 있으나,
전부 이번 변경과 무관한 `lib/social/*.test.ts`, `lib/repositories/*.test.ts`
계열 테스트 픽스처의 `SocialPostRow`/`SocialPost` 타입 불일치
(`archived_at`/`manualPostStatus`/`apiPublishPreparationStatus` 등 필드가
`undefined`를 허용하지 않는 타입에 `undefined`를 전달)다.
`app/articles/[id]/page.tsx`, `actions.ts`, `page.test.ts`를 포함한
이번 Phase 대상 파일에서 발생한 새 오류는 없다(`grep`으로 확인).
이 기존 오류들은 이번 Phase 범위(WordPress/SEO/공개 게시 UI) 밖이라
손대지 않았다 — UX-02B 이후 별도로 다룰 필요가 있다.

## 15. 아직 남은 Critical 문제

- `app/articles/[id]/blog/page.tsx:997` — 버튼 비활성 사유에
  `quality_status=ready` 같은 raw 필드명이 안내 문구에 그대로 섞여
  있음 (UX-01 감사 C3에 해당, 이번 Phase 대상 파일 아님)
- `app/articles/[id]/blog/page.tsx:389,1186` — `article.status` raw
  enum이 번역 없이 노출됨 (UX-01 감사 C6)
- `WordPressPublishingPanel`(`components/wordpress/wordpress-publishing-panel.tsx`)
  이 여전히 기본 노출 상태(접힘 없음)로 raw status/WordPress Post·
  Media ID/SEO 필드명을 다수 표시함 — 이번 Phase에서는 공통
  컴포넌트를 건드리지 않기로 했으므로(N 항목) 그대로 둠 (UX-01 감사 C4)
- "WordPress 게시 준비 자동 실행"과 "WordPress 게시 준비" 요약 카드는
  이름 중복은 해소했지만 완전히 하나로 합쳐지지는 않았음 — 완전
  통합은 UX-03 대상

## 16. UX-02B에서 다음으로 고쳐야 할 항목

1. `app/articles/[id]/blog/page.tsx`의 `article.status` raw 노출,
   `quality_status=ready` 안내 문구 raw 필드명 제거 (C3, C6)
2. `WordPressPublishingPanel`을 기본 접힘으로 전환하거나 raw 필드를
   라벨 헬퍼로 감싸기 (C4) — 단, 컴포넌트 자체의 공통화(UX-03)는
   별도
3. `/dashboard/blog`, `/dashboard/rewrite`의 필터 옵션 raw enum 노출
   정리
4. `PlatformBadge`류 컴포넌트 중복 구현 통합(`/trends`,
   `/themes/[themeId]`)
5. "WordPress 게시 준비 자동 실행" 섹션과 요약 카드의 완전한 통합
   여부를 UX-03(공통 컴포넌트 통합) 논의에서 다시 검토

---

**UX-02A에서는 안전 문제와 app/articles/[id]의 핵심 기술정보 노출만
수정했으며, 공통 컴포넌트 대규모 리팩터링은 수행하지 않았습니다.**
