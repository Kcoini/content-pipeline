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
- [ ] **이미 완료된 작업**(승인 완료, 품질검사 통과 등)이 버튼이
      아니라 상태 배지로만 표시되는가(예: `approval_status ===
      "approved"`면 "승인" 버튼이 기본 화면에 다시 보이지 않는가,
      Phase 4-13)?
- [ ] **차단 상태(guard blocked 등)**일 때 "반영/게시" primary
      버튼이 비활성화되거나 숨겨지고, 그 대신 차단 이유를 해결하는
      버튼이 primary로 보이는가(Phase 4-13)?
- [ ] **짧은 콘텐츠(SNS/커뮤니티 글 등)의 본문**이 목록 카드에서
      과도하게 잘려 보이지 않는가(1,200자 이하는 전체 표시, 초과분만
      카드 안 접기/펼치기로 처리, 상세 페이지 강제 이동 없음,
      Phase 4-14)?
- [ ] 본문이 **자동 검토 결과/상태 배지보다 먼저** 표시되는가(사용자가
      내용을 먼저 읽고 판단할 수 있는가, Phase 4-14)?
- [ ] **본문 수정**이 다른 페이지로 강제 이동시키지 않고 같은 카드/
      화면 안에서 편집 가능한가(단일 텍스트 필드로 안전하게 수정할
      수 없는 구조라 예외적으로 이동시킨다면 그 이유가 코드에
      남아 있는가, Phase 4-15)?
- [ ] **저장 후 승인처럼 여러 단계를 묶는 버튼**이 검토를 건너뛰고
      곧바로 승인하지 않는가(저장 → 자동 검토 → 통과 시 승인
      순서를 지키는가, Phase 4-15)?
- [ ] **복사 버튼**이 화면에 보이는 축약문이 아니라 전체 콘텐츠를
      복사하는가(Phase 4-15)?
- [ ] **같은 종류의 상세 패널이 여러 카드에 반복**되지 않는가 —
      비교가 필요한 목록은 compact 카드로, 상세 패널은 사용자가
      선택한 항목 1개에만 표시되는가(Phase 4-16)?
- [ ] **기본 미리보기가 렌더링된 결과**를 보여주는가(markdown `##`/
      `**`나 HTML 태그가 raw 그대로 노출되지 않는가, 원문은 별도
      탭/접힘으로 분리되어 있는가, Phase 4-16)?
- [ ] **본문 표시/inline 수정/복사 규칙(위 두 항목, Phase 4-14/4-15)**이
      SNS/커뮤니티 글 카드뿐 아니라 블로그·기사형 글 카드(WordPress
      블로그/네이버 블로그/언론 기사/칼럼)에도 같은 공통 컴포넌트로
      동일하게 적용되어 있는가 — raw slice로 직접 미리보기를 다시
      만들고 있지 않은가(Phase 4-18)?
- [ ] **본문 확인 영역이 카드 하나당 한 곳만 있는가** — "게시용
      본문"(또는 "게시용 미리보기")과 "본문 미리보기"(또는 "편집용
      원문")가 같은 카드 안에 동시에 펼쳐져 있지 않은가? 탭이 있는
      카드(wordpress_blog 등)라면 탭 밖에 같은 본문을 또 표시하고
      있지 않은가(Phase 4-23)?
- [ ] **게시용 본문에 "리드문"/"본문"/"배경 설명"/"쟁점"/"향후 확인할
      점"/"출처" 같은 마스터 원고 내부 구성 항목 이름이 소제목으로
      그대로 남아 있지 않은가**(있다면 자동 검토가 "수정 필요"로
      표시하는가, Phase 4-21)?
- [ ] **자동 검토 "수정 필요" 상태에서, AI가 안전하게 고칠 수 있는
      문제(내부 소제목 등)를 사용자에게 직접 고치라고 요구하기 전에
      자동으로 정리하고 재검토하는가**(출처/수치 확인이 필요한
      문제는 자동으로 채우지 않고 사용자 확인으로 남기는가, 자동
      수정이 승인 상태를 자동으로 바꾸지 않는가, Phase 4-22)?
- [ ] **남은 문제가 전부 자동 수정 가능하면 [자동 수정 후 재검토]가
      기본(primary) 버튼인가**(원래 primary였던 "문제 확인하기"가
      같이 강조되어 primary 버튼이 두 개로 보이지 않는가), **사용자
      확인이나 차단 문제가 하나라도 섞여 있으면 기존처럼 "문제
      확인하기"가 기본으로 남아 있는가**(Phase 4-28)?
- [ ] **글 생성 직후, 남은 문제가 전부 자동 수정 가능한 경우 사용자가
      보기 전에 자동 정리·재검토가 이미 실행되어 있는가**(사용자
      확인/차단 문제가 하나라도 있으면 자동 실행하지 않고 그대로
      보여주는가, 무한 반복 없이 1회만 실행하는가, Phase 4-28)?

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
