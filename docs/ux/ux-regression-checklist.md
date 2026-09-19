# UX Regression Checklist

새 기능/화면을 추가하거나 기존 화면을 수정하기 **전**과 **후**에 이 체크리스트를
확인한다. `docs/ui-ux-governance-rules.md`가 규칙 전체를 담고 있고, 이
문서는 Claude Code가 커밋 전에 스스로 빠르게 점검할 수 있는 체크리스트
요약본이다.

## 새 UI를 추가하거나 기존 화면을 고치기 전에

- [ ] 이미 있는 공통 컴포넌트/헬퍼로 만들 수 있는가? (`components/review/*`,
      `components/publish/*`, `components/workflow/*`,
      `components/social/post-body-action-row.tsx`,
      `components/social/inline-post-body-editor.tsx`,
      `lib/social/status-labels.ts`, `lib/ui/platform-badge.ts` 등) — 새로
      만들기 전에 먼저 검색한다.
- [ ] 이 화면의 핵심 작업이 "여러 항목 중 선택 후 진행"이면 워크스페이스
      구조(목록 + 작업 영역)를 따르는가?

## 만들거나 고친 후 (커밋 전)

- [ ] **primary action이 화면/섹션당 2개 이상 동시에 강조되는가?** (하나만
      허용)
- [ ] **raw 상태값(quality_status/approval_status/publish_status/
      export_status/manual_post_status/suggestion_status/
      rewrite_reapproval_status 등)이 사용자 화면에 그대로 보이는가?**
      (한국어 라벨 헬퍼를 거쳐야 한다 — `lib/ui/raw-technical-info.test.ts`가
      핵심 페이지를 자동 스캔한다)
- [ ] **env 변수 이름/dry-run/handoff 같은 개발자 용어가 사용자 문구에
      그대로 보이는가?**
- [ ] **사용자가 "다음 작업"을 알 수 있는가?** — 문구만 있고 실제 버튼/링크가
      없는 dead-end를 만들지 않는다.
- [ ] **AI가 자동으로 처리할 수 있는 문제를 사람에게 판단하라고 시키는가?**
      (auto_fixable 문제는 auto-fix 흐름을 우선 제공한다)
- [ ] **완료된 상태에서 같은 action(승인/게시 완료로 표시 등)이 다시
      primary로 남는가?** (반복 action 금지)
- [ ] **"본문 수정"과 "상세 편집"/"상세 보기"가 같은 의미로 섞여 쓰이는가?**
      (본문 수정 = inline editor, 상세 편집 = 본문 외 필드 편집, 상세
      보기 = navigation — 반드시 구분한다)
- [ ] **모바일 폭(400px)에서 버튼/테이블이 넘칠 가능성이 있는가?**
      (버튼 그룹은 `flex-wrap`, 넓은 표는 `overflow-x-auto` + `min-w-[...]`)
- [ ] **명시적 클릭 없이 외부 side effect(공개 게시, 실제 API 호출 등)가
      발생하는가?** (승인/게시 준비와 실제 반영은 항상 분리된 버튼이어야
      한다)
- [ ] 새로 추가한 라벨이 이미 있는 라벨과 같은 뜻인데 다른 문구를 쓰는가?
      (동일 개념 = 동일 라벨 원칙)
- [ ] disabled 버튼에 이유가 항상 보이는 텍스트로 표시되는가?

## 관련 자동 테스트

- `lib/ui/ux-invariants.test.ts` — primary action/dead-end/inline vs
  navigation/반복 action 자동 검사
- `lib/ui/raw-technical-info.test.ts` — raw enum/DB 필드/env var/
  dry-run/handoff 노출 자동 검사
- `lib/ui/ux-07-polish.test.ts` — H5 관리자 접힘 카테고리 그룹핑/H6 용어
  구분 회귀 검사
- `lib/journeys/*.test.ts` — 핵심 사용자 여정(WordPress/Naver Cafe/X
  thread/Multi-platform/Rewrite) 성공 계약 검사

새 페이지/컴포넌트를 스캔 대상에 추가하려면 위 파일들의 `CORE_PAGES`/
`SCAN_TARGETS` 배열에 경로를 추가한다.
