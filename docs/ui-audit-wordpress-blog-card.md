# UI Audit: wordpress_blog 카드 (`/articles/[id]/blog`)

[`docs/wordpress-blog-card-ui-rules.md`](./wordpress-blog-card-ui-rules.md)와
[`docs/ui-review-agent-checklist.md`](./ui-review-agent-checklist.md) 기준으로
현재(`app/articles/[id]/blog/page.tsx`) wordpress_blog 카드 UI를 점검한
결과다. 이 문서는 점검 결과 기록용이며, 이번 작업에서 코드를 수정하지는
않는다 — 개선 항목은 앞으로 별도 작업으로 진행한다.

## 이미 규칙을 만족하는 부분

지금까지의 작업(단계형 workflow UI, 대표 이미지 카드 내 처리, Step 7
체크리스트 상태 재계산 등)으로 아래는 이미 규칙을 만족한다:

- **단계형 workflow**: Step 1(품질검사)~Step 7(체크리스트/Handoff)로
  구성되어 있고, 버튼이 순서 없이 나열되지 않는다.
- **다음 추천 작업**: `getWordPressBlogNextRecommendedAction()`이 상태
  기준으로 다음에 눌러야 할 작업 하나를 추천한다.
- **상태 요약**: `getWordPressBlogWorkflowStatusSummary()`가 7개 항목을
  완료/필요/확인 필요/차단됨/실패 등으로 요약해 보여준다.
- **disabled 이유 표시**: SEO Metadata 업데이트, Draft 생성 등 여러 버튼에
  disabled 조건과 이유 문구가 붙어 있다.
- **확인 필요 항목 설명**: Step 7의 "지금 확인이 필요한 항목"이 각 항목의
  설명/할 일/확인 완료 버튼을 보여준다.
- **카드 안에서 이미지/URL 처리**: 대표 이미지 업로드·Media ID 저장·연결·
  이미지 없이 진행, 게시 URL 입력·저장·복사가 모두 wordpress_blog 카드
  안에서 끝난다(다른 페이지로 이동할 필요 없음).
- **naver_blog 분리**: 위 UI는 모두 `platform === "wordpress_blog"` 조건부
  블록 안에만 있고, naver_blog 카드에는 표시되지 않는다(정적 소스 테스트로
  고정되어 있음).

## 아직 규칙을 완전히 만족하지 못하는 부분 (개선 필요)

- **버튼이 여전히 많다**: Step 1~7 + 상단 공통 버튼(품질검사/승인/Manual
  Export/체크리스트 준비)을 합치면 한 카드 안의 action 수가 많아서,
  처음 보는 사용자는 "지금 뭘 눌러야 하는지" 파악하는 데 시간이 걸린다.
  "다음 추천 작업"이 있긴 하지만, 그 아래에 여전히 Step 1~7의 모든
  버튼이 동시에 노출되어 있어 시선이 분산된다.
- **WordPress 게시 미리보기(섹션 5 규칙)가 없다**: "게시 전 미리보기
  생성"(dry-run) 버튼은 있고 `platform_publish_dry_run_status`/`payload`가
  DB에 저장되지만, **그 결과(제목/본문/SEO/대표 이미지/AD_SLOT 위치 등)를
  카드 안에서 사람이 읽을 수 있게 렌더링하는 UI가 없다.** 현재는 상태
  badge만 보이고 실제 내용은 확인할 방법이 없다.
- **검사가 많은 이유 안내가 산발적이다**: 일부 Step에는 설명 문구가
  있지만, "왜 quality gate/guard/dry-run이 이렇게 많은 단계로 나뉘어
  있는지"를 한 번에 설명하는 안내는 없다.
- **업데이트 성공 여부/마지막 실행 시간 표시가 부분적이다**: SEO Plugin
  Metadata 섹션에는 `updatedAt`이 표시되지만, WordPress Draft 생성/업데이트,
  대표 이미지 연결, 게시 가능 상태 확인에는 "마지막 실행 시간"이 별도로
  표시되지 않는다(결과 메시지는 action 실행 직후 flash message로만
  보이고, 카드를 새로고침하면 사라진다).
- **최종 실행 버튼(primary button)이 명확하지 않다**: 현재 이름은 "게시
  준비 자동 실행"이고 상단에 강조되어 있지만, `wordpress-blog-card-ui-rules.md`가
  요구하는 "WordPress에 반영하기"라는 명확한 이름은 아니다. 또한 Step
  1~7의 개별 버튼들과 스타일 차별화가 크지 않아, 한눈에 "이게 primary
  button이다"라고 인지하기 어렵다.
- **최근 WordPress 반영 결과 요약 섹션이 없다**: 규칙(섹션 6)이 요구하는
  "Draft/SEO/대표 이미지/게시 준비 결과를 한 번에 모아 보여주는 요약"이
  카드 안에 별도로 없다 — 각 Step에 흩어져 있는 상태 값을 사용자가 직접
  조합해서 파악해야 한다.

## 개선 방향 (향후 작업 후보 — 이번 작업 범위 아님)

- Step 1~7을 기본적으로 접어두고, "다음 추천 작업"과 primary button만
  먼저 보여준 뒤 필요할 때 펼치는 구조로 전환(섹션 9의 "전체 체크리스트
  보기" 패턴을 Step 전체로 확장).
- 게시 전 미리보기(dry-run) 결과를 카드 안에 실제로 렌더링하는 "WordPress
  게시 미리보기" 섹션 추가.
- Draft/SEO/대표 이미지/게시 준비 액션에 마지막 실행 시간·결과를 일관되게
  저장/표시.
- primary button을 "WordPress에 반영하기"로 재명명하고 시각적으로 더
  강조.
- "최근 WordPress 반영 결과" 요약 섹션을 카드 상단(상태 요약 근처)에 추가.

## 참고

- 규칙: [`docs/wordpress-blog-card-ui-rules.md`](./wordpress-blog-card-ui-rules.md)
- 체크리스트: [`docs/ui-review-agent-checklist.md`](./ui-review-agent-checklist.md)
- 구현 상세: [`docs/article-blog-wordpress-workflow.md`](./article-blog-wordpress-workflow.md)
