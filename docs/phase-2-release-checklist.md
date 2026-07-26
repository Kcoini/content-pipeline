# Phase 2 Release 체크리스트

WordPress 발행 파이프라인 MVP(Phase 2)를 release tag로 확정하기 전에
확인해야 할 체크리스트다.

## 코드/빌드 검증

- [ ] `npm run lint` 통과
- [ ] `npm run test` 통과
- [ ] `npm run build` 통과

## Supabase 상태

- [ ] Supabase migrations(`db/migrations/011` ~ `025`) 적용 완료
      (`docs/supabase-migrations-checklist.md`의 컬럼 목록 확인 SQL로 검증)
- [ ] schema cache reload 완료 (`notify pgrst, 'reload schema';`)

## WordPress 연동 동작 확인 (테스트/스테이징 WordPress 사이트 기준)

- [ ] WordPress connection test 성공 (Phase 2-8)
- [ ] WordPress draft publish 성공 (`publish_logs.target='wordpress'`, `status='success'`)
- [ ] media upload 성공 또는 skipped 사유 확인 (환경변수 비활성화 시
      skipped가 정상임을 확인)
- [ ] featured media attach 성공 (`wordpress_featured_media_attach_status='attached'`)
- [ ] Rank Math custom endpoint 성공 (`seo_plugin_custom_endpoint_status='success'`, `verified=true`)
- [ ] final draft review passed 또는 warning (실패 항목 없음, 경고는 허용)
- [ ] publish quality gate `ready_to_publish` (`publish_ready=true`)
- [ ] human approval `approved` (`public_publish_approval_status='approved'`, `public_publish_approved=true`)
- [ ] public publish test 성공 (`public_publish_status='published'`, 테스트/스테이징 사이트에서만 확인 권장)

## 보안 확인

- [ ] logs(`pipeline_logs`/`publish_logs`/`approval_logs`)에 secrets(Authorization
      header, Application Password, API key) 없음을 샘플 조회로 확인
- [ ] `.env.local`이 git에 없음 (`git ls-files | grep -i env.local`이
      비어 있어야 한다)

## 문서

- [ ] README 업데이트 완료 (Phase 2 MVP 상태, 문서 링크 반영)
- [ ] `docs/phase-2-final-summary.md`, `docs/wordpress-publishing-operation-guide.md`,
      `docs/environment-variables.md`, `docs/security-checklist.md`,
      `docs/phase-2-verification-sql.md`가 최신 상태인지 확인

## Release tag (실행 전 확인만, 실제 태그 생성은 사용자가 직접 실행)

아래 명령어는 순서대로 안내를 위한 것이며, **Claude Code가 임의로
실행하지 않는다.** 사용자가 위 체크리스트를 모두 확인한 뒤 직접
실행한다.

```bash
git status
npm run lint
npm run test
npm run build
git add .
git commit -m "Finalize Phase 2 WordPress publishing MVP"
git push
git tag phase-2-wordpress-publishing-mvp
git push origin phase-2-wordpress-publishing-mvp
```
