# Phase 3 Release Checklist

Phase 3(3-1~3-23) 전체를 릴리즈하기 전에 확인해야 할 항목이다.

## 코드 품질

- [ ] `npm run lint` 통과
- [ ] `npm run test` 통과 (`npx vitest run`)
- [ ] `npm run build` 통과

## 보안

- [ ] `git status`에 `.env.local`이 없는지 확인
- [ ] `git diff --stat`에 secrets(API key/토큰/비밀번호 값)가
      포함되지 않았는지 확인
- [ ] `docs/`, `.env.example` 어디에도 실제 환경변수 값이 없는지
      확인(이름만 존재해야 함)

## 문서

- [ ] `docs/phase-3-final-overview.md` 최신 상태 확인
- [ ] `docs/phase-3-operation-manual.md` 최신 상태 확인
- [ ] `docs/phase-3-architecture.md` 최신 상태 확인
- [ ] `docs/phase-3-route-map.md`가 실제 `app/` 라우트와 일치하는지
      확인
- [ ] `docs/phase-3-database-migrations.md`가 실제
      `db/migrations/`와 일치하는지 확인
- [ ] `docs/phase-3-environment-variables.md`가 실제
      `.env.example`과 일치하는지 확인
- [ ] `docs/phase-3-safety-checklist.md` 최신 상태 확인
- [ ] `docs/releases/phase-3-release-notes.md` 작성 완료
- [ ] `docs/README.md`(또는 최상위 `README.md`)에 위 문서로 가는
      링크가 모두 있는지 확인

## 기능 확인

- [ ] `/dashboard`, `/articles`, `/articles/[id]` 등 article
      라우트가 정상 렌더링되는지 확인
- [ ] `/articles/[id]/blog`, `/articles/[id]/social`,
      `/articles/[id]/rewrite`, `/articles/[id]/performance`,
      `/articles/[id]/ab-tests`가 정상 렌더링되는지 확인
- [ ] `/social-posts/[id]` 상세 라우트가 정상 렌더링되는지 확인
- [ ] `/dashboard/content`, `/dashboard/blog`, `/dashboard/rewrite`,
      `/dashboard/social-performance`, `/dashboard/platform-api`,
      `/dashboard/automation-safety`가 정상 렌더링되는지 확인

## 안전 확인

- [ ] `/dashboard/automation-safety`에서 Safety Review 실행 →
      `blocked`/`failed` 상태가 아닌지 확인
- [ ] `select * from social_posts where
      api_publish_eligible_for_actual_publish = true`가 비어
      있는지 확인(API actual publish disabled 확인)
- [ ] 실제 게시(actual publish) 버튼이 어느 화면에도 없는지 확인
- [ ] feature flag(`PLATFORM_API_PUBLISHING_ENABLED`,
      `*_API_PUBLISH_ENABLED`, `SOCIAL_PUBLISH_ENABLED`)가 배포
      환경에서 모두 false인지 확인

## Release 준비

- [ ] release tag 생성 준비(예: `phase-3-final` 또는 버전
      태그) — 이 문서와 release notes가 모두 커밋된 뒤 태깅한다.

## 관련 문서

- 전체 개요: [`phase-3-final-overview.md`](./phase-3-final-overview.md)
- 릴리즈 노트: [`releases/phase-3-release-notes.md`](./releases/phase-3-release-notes.md)
- 안전 체크리스트: [`phase-3-safety-checklist.md`](./phase-3-safety-checklist.md)
