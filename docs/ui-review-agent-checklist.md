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
