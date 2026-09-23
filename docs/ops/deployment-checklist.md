# 배포 체크리스트

- 작성일: 2026-09-23 (OPS-02B)
- 이 문서는 실제 배포 직전에 순서대로 확인하는 체크리스트다. 자동화된
  CI가 아니라 사람이 직접 확인하는 절차다.

## Before deploy

- [ ] `git status`가 clean하다(의도하지 않은 변경 없음).
- [ ] **환경 preflight**: `npm run ops:preflight` 실행, `Overall: PASS`
      또는 명확한 사유가 있는 `PASS WITH WARNINGS`만 허용. `FAIL`이면
      배포하지 않는다.
- [ ] `npm run lint` — 오류 없음.
- [ ] `npm run test` — 전체 통과.
- [ ] `npm run build` — 성공.
- [ ] `npm run test:e2e` — Playwright 전체 통과.
- [ ] **DB migration 여부 확인**: `db/migrations/`에 아직 적용 안 된
      새 migration이 있는지 확인한다. 있으면 배포 전에 적용
      순서(migration 먼저 vs 코드 먼저)를 결정한다 — 기본은 "migration
      먼저, 그 다음 코드 배포"(하위 호환 깨지는 컬럼 삭제/이름 변경이
      없다는 전제).
- [ ] **위험한 flag 확인**: `WORDPRESS_PUBLISH_ENABLED`,
      `WORDPRESS_MEDIA_UPLOAD_ENABLED`, `SEO_PLUGIN_WRITE_ENABLED`,
      `AI_GENERATION_ENABLED` 값이 의도한 환경(운영/스테이징)에 맞는지
      직접 확인한다(값 자체를 로그로 남기지 않는다 — `ops:preflight`
      출력으로 confirmed/pass 여부만 확인).
- [ ] **접근 제어 확인(필수)**: 이 앱은 애플리케이션 레벨 인증이
      없다(`docs/ops/platform-capability-matrix.md`의 "발견한 실제 gap"
      절 참고). 배포 대상이 공개 인터넷이라면 반드시 호스팅/인프라
      레벨 접근 제어(Vercel Deployment Protection/reverse proxy basic
      auth/IP allowlist/VPN 등)가 구성되어 있는지 확인한다. 이 항목을
      건너뛰고 배포하지 않는다.
- [ ] **백업 확인**: Supabase 프로젝트의 최근 백업/PITR 상태를
      확인한다(`docs/ops/recovery-runbook.md` 참고). 직접 destructive
      테스트는 하지 않는다 — 백업이 "존재하고 최신인지"만 확인한다.

## Deploy

- [ ] production 배포 실행.
- [ ] 배포 직후 health check(앱이 정상적으로 뜨는지, 500 에러 없는지).

## After deploy

- [ ] **Dashboard smoke**: `/dashboard` 접속, 현재 상태/다음 작업
      카드가 정상 렌더링되는지 확인.
- [ ] **Generation smoke**: 실제 새 콘텐츠를 생성하지 않는다(비용
      발생) — 기존 테마/기사 목록이 정상 조회되는지만 확인한다.
- [ ] **Review smoke**: 기존 social post 상세 화면(`/social-posts/[id]`)이
      정상 렌더링되는지 확인.
- [ ] **Publish preparation smoke**: WordPress 게시 준비 화면이
      정상 렌더링되는지 확인(버튼 클릭은 하지 않는다).
- [ ] **WordPress Draft는 배포 스모크 테스트 대상에서 제외한다** —
      실제로 Draft를 생성하면 실제 WordPress 사이트에 흔적이 남는다.
      필요하면 별도로 통제된 시간에, 운영자가 명시적으로 승인한 뒤에만
      실행한다.
- [ ] 위 스모크에서 이상이 발견되면 아래 "Rollback" 절차로 이동한다.

## Rollback

- [ ] **코드 rollback**: 이전 배포 버전으로 되돌린다(호스팅 플랫폼의
      "이전 배포로 롤백" 기능 사용 — 강제 push/force 작업 지양).
- [ ] **migration rollback 가능 여부 확인**: 이번 배포에 새 migration이
      포함됐다면, 그 migration이 안전하게 되돌릴 수 있는지(down
      migration이 있는지, 또는 컬럼 추가처럼 비파괴적이라 코드만
      롤백해도 안전한지) 먼저 판단한다. 컬럼 삭제/타입 변경처럼
      되돌리기 어려운 migration은 애초에 "코드 배포 후 며칠 뒤" 같은
      지연 적용을 고려한다.
- [ ] **feature flag disable**: 문제가 특정 기능(WordPress publish,
      AI generation 등)에 국한되면 코드 rollback 대신 해당
      `.env` flag를 끄는 것으로 먼저 대응할 수 있는지 검토한다(더
      빠르고 안전한 경우가 많다).
