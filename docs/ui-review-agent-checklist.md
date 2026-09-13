# UI Review Agent 체크리스트

이 문서는 Claude Code가 UI를 수정한 뒤 반드시 점검해야 하는 체크리스트다.
[`docs/ui-ux-governance-rules.md`](./ui-ux-governance-rules.md)의 규칙을
실제 화면 하나하나에 적용했는지 확인하는 용도다. UI를 수정하는 작업(새
버튼 추가, 상태 표시 변경, workflow 재구성 등)을 마쳤으면, 배포/커밋 전에
아래 항목을 하나씩 스스로 점검한다.

## 체크 항목

- [ ] 사용자가 **현재 상태**를 알 수 있는가?
- [ ] **다음 추천 작업**이 보이는가?
- [ ] **최종 실행 버튼**이 명확한가(primary button이 하나로 식별되는가)?
- [ ] 버튼이 **workflow 순서대로** 배치되어 있는가?
- [ ] 같은 기능 버튼이 **중복 표시**되지 않는가?
- [ ] 검사(quality gate 등) **이유**가 설명되어 있는가?
- [ ] **업데이트 성공 여부**가 보이는가?
- [ ] **실패 시 사유**가 보이는가?
- [ ] disabled 버튼에 **이유**가 있는가?
- [ ] 외부 시스템(WordPress 등)에 **반영될 데이터가 미리** 보이는가?
- [ ] **Draft와 공개 게시**가 구분되는가(같은 버튼처럼 보이지 않는가)?
- [ ] **article과 wordpress_blog 대상**이 구분되는가(원문 전송 vs
      wordpress_blog 전송을 혼동시키지 않는가)?
- [ ] "확인 필요" 항목에 **설명과 action**이 있는가?
- [ ] 영어/한국어 혼용 버튼명이 정리되었는가?
- [ ] **naver_blog에 WordPress 전용 UI**가 잘못 표시되지 않는가?
- [ ] **raw enum**(platform/tone_style 등)이 select option이나 배지에
      그대로 노출되지 않는가(`PLATFORM_LABELS`/`TONE_STYLE_CONFIGS` 사용)?
- [ ] **raw DB column name**(`is_rewrite_version`, `parent_social_post_id`
      등)이 화면 라벨로 그대로 쓰이지 않는가(`describeStatusField` 사용)?
- [ ] 내부 상태값(quality_status 등)이 `describeStatusValue`로 변환되어
      표시되는가(Phase 3-24: `lib/social/status-labels.ts`)?
- [ ] 페이지 제목(`<h1>`)과 섹션 제목(`<h2>`)이 영어가 아니라 한국어인가
      (`Content Dashboard`, `A/B Test`, `Chart Overview` 같은 표현 금지)?
- [ ] `placeholder`/`dry-run`/`handoff`/`readiness` 같은 개발자 용어가
      사용자 친화적 한국어로 바뀌었는가?
- [ ] **글 유형별 검토 기준이 표시**되는가(자동 검토 리포트에 "글 유형:
      OO · 검토 기준: ..."이 먼저 보이는가, `getPlatformReviewCriteria`
      사용, Phase 4-5)?
- [ ] **기사 본문에 블로그 기준(FAQ/체크리스트/표)을 강제하지 않는가**,
      반대로 **블로그 글에 기사 기준(리드문/육하원칙)만으로 통과 처리하지
      않는가**?
- [ ] 글 유형과 본문 형태가 어긋나 보이면 "글 유형 확인 필요"로 표시하고
      수정 탭 등 다음 행동을 제공하는가(무반응으로 끝나지 않는가,
      `detectContentTypeMismatch`, Phase 4-5)?
- [ ] **개발자·운영자용 정보**(raw env 이름, provider enum, endpoint
      path, internal id, raw DB status/payload)가 기본 글쓰기 화면에
      그대로 노출되지 않고 `<details>`(기본 접힘) 안에만 있는가
      (Phase 4-6, `docs/phase-4-6-developer-info-hiding.md`)?
- [ ] "SEO Plugin Actual Write"/"Custom Endpoint" 같은 개발자용 기능
      이름 대신 "SEO 정보 반영 상태" 같은 사용자 친화적 라벨을
      기본 화면에 쓰는가?
- [ ] "WordPress Media Upload"/"WordPress Connection Test"도 같은
      기준으로 숨겼는가 — 기본 화면에는 "대표 이미지 업로드 상태"/
      "WordPress 연결 상태" 요약만 있고, base URL/`WORDPRESS_*` env
      값/개발자용 버튼("업로드 테스트"/"연결 테스트")은 접힘 안에만
      있는가(Phase 4-7)?
- [ ] Application Password, Authorization header, API key가 기본
      화면은 물론 접힘 영역 안에서도 표시되지 않는가?

## 사용 방법

1. UI를 수정한 코드(예: `app/articles/[id]/blog/page.tsx`)를 커밋하기 전에
   위 체크리스트를 하나씩 확인한다.
2. 체크리스트 중 "아니오"인 항목이 있으면, 이번 작업 범위에서 고칠 수 있는지
   판단한다. 범위 밖이면 왜 범위 밖인지(예: naver_blog는 이번 작업 대상이
   아님)를 커밋 메시지나 문서에 남긴다.
3. 정적 소스 검사 테스트(`app/**/page.test.ts`의 `readFileSync` 기반 테스트,
   `docs/article-blog-wordpress-workflow.md` 패턴 참고)로 체크리스트 항목
   중 기계적으로 검증 가능한 것(중복 버튼 없음, disabled 이유 텍스트 존재,
   naver_blog 블록에 특정 UI 없음 등)은 테스트로도 고정한다 — 리뷰만으로
   끝내지 않는다.
4. 새로운 화면을 설계할 때도 이 체크리스트를 설계 단계에서 먼저 훑어보면,
   나중에 "버튼이 많아서 다시 정리해야 하는" 상황을 줄일 수 있다.

## 관련 문서

- [`docs/ui-ux-governance-rules.md`](./ui-ux-governance-rules.md) — 이 체크리스트의 근거가 되는 전체 규칙
- [`docs/wordpress-blog-card-ui-rules.md`](./wordpress-blog-card-ui-rules.md) — wordpress_blog 카드에 이 체크리스트를 적용한 구체적인 구조
- [`docs/ui-audit-wordpress-blog-card.md`](./ui-audit-wordpress-blog-card.md) — 이 체크리스트로 wordpress_blog 카드를 점검한 결과 예시
- [`docs/phase-3-26-social-post-review-workspace.md`](./phase-3-26-social-post-review-workspace.md) — 이 체크리스트를 `/social-posts/[id]`(단일 글 최종 검토·수정·승인 화면)에 적용한 사례
- [`docs/phase-4-6-developer-info-hiding.md`](./phase-4-6-developer-info-hiding.md) — `/articles/[id]`의 SEO Plugin Actual Write/Custom Endpoint를 이 체크리스트 기준으로 점검·정리한 사례, 다른 글쓰기 페이지(`/articles/[id]/social`, `/rewrite`, `/social-posts/[id]`)는 이미 이 원칙을 따르고 있었다는 점검 결과 포함
- [`docs/phase-4-7-wordpress-media-connection-test-hiding.md`](./phase-4-7-wordpress-media-connection-test-hiding.md) — 같은 페이지의 WordPress Media Upload/Connection Test를 정리하고 "WordPress 게시 준비" 요약 카드를 추가한 사례
