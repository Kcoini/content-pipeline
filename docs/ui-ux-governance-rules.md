# UI/UX Governance Rules

프로젝트 UI가 기능 중심으로 계속 늘어나면서(버튼/상태/action이 많아지면서)
사용자 친화성이 떨어지는 것을 막기 위한 프로젝트 전반의 UI/UX 규칙이다.
새 화면을 만들거나 기존 화면에 기능을 추가할 때는 이 문서를 먼저 확인한다.

이 문서는 **규칙 정리 문서**다 — 이 문서 자체는 어떤 코드도 변경하지 않는다.
실제 UI를 수정/검토할 때는 이 문서 + [`docs/ui-review-agent-checklist.md`](./ui-review-agent-checklist.md)를
함께 사용한다. wordpress_blog 카드처럼 화면별 세부 규칙이 필요하면
[`docs/wordpress-blog-card-ui-rules.md`](./wordpress-blog-card-ui-rules.md)처럼 별도 문서를 둔다.

## 섹션 1. 기본 원칙

- 사용자는 항상 **현재 상태**를 알 수 있어야 한다.
- 사용자는 **다음에 해야 할 작업**을 알 수 있어야 한다.
- **최종 실행 버튼은 하나만** 명확하게 보여야 한다(primary button).
- 보조 버튼은 관련된 단계 안에 배치한다 — 화면 상단에 흩어 놓지 않는다.
- 같은 의미의 버튼을 여러 위치에 중복 배치하지 않는다.
- 검사(quality gate, guard 등) 단계에는 **왜 필요한지** 설명을 붙인다.
- 업데이트 action에는 성공/실패/마지막 실행 시간을 표시한다.
- 외부 시스템(WordPress 등)에 반영될 내용을 실행 전에 미리 보여준다(미리보기).
- Draft 생성, Metadata 업데이트, 대표 이미지 연결, 공개 게시처럼 **결과가 다른
  action은 명확히 구분**한다 — 버튼 문구/위치/색상으로 헷갈리지 않게 한다.
- "확인 필요" 상태에는 반드시 설명과 다음 행동을 표시한다 — badge 텍스트만
  보여주고 끝내지 않는다.
- UI 상태 표현은 완료/필요/확인 필요/차단됨/실패/생략 중심으로 단순화한다
  (자세한 기준은 섹션 3).
- 내부 DB 상태명(`ready`, `approved`, `not_checked` 등)을 그대로 사용자에게
  노출하지 않는다 — 반드시 한국어 사용자 상태로 변환해서 보여준다.
- **공개 게시(public publish)와 Draft 업데이트는 절대 같은 버튼처럼 보이면
  안 된다** — 되돌리기 어려운 action과 안전한 action은 시각적으로도 명확히
  구분한다.

## 섹션 2. 버튼 규칙

- 버튼은 workflow 순서대로 배치한다(먼저 해야 할 일이 위/왼쪽).
- 한 줄에 많은 버튼을 나열하지 않는다 — 관련 있는 버튼끼리 묶는다.
- primary button은 한 화면 또는 한 section에 하나만 둔다.
- destructive 또는 irreversible action(예: 공개 게시, 승인 철회)은 명확한
  확인이 필요하다.
- disabled 버튼에는 반드시 이유를 표시한다(예: "승인 후 Draft를 생성할 수
  있습니다.").
- 영어와 한국어가 섞인 버튼명을 줄인다.
- 사용자 친화적인 버튼명으로 바꾼다 — 내부 함수명/기술 용어를 그대로 쓰지
  않는다.

버튼명 변환 예(실제 이번 프로젝트에 적용된 사례 — `docs/article-blog-wordpress-workflow.md` 참고):

| 이전 | 이후 |
| --- | --- |
| WordPress Draft Export | 수동 게시용 Draft 내보내기 |
| Dry-run 생성 | 게시 전 미리보기 생성 |
| Handoff 완료 | 수동 게시 완료 표시 |
| 게시 체크리스트 준비 | 게시 체크리스트 만들기 |
| WordPress 게시 준비 일괄 실행 | WordPress에 반영하기 |
| WordPress 게시 준비 확인 | 게시 가능 상태 확인 |

> 주의: 버튼 **label**을 바꾸는 것과 실제 **action 함수를 삭제/교체**하는
> 것은 다르다. 이 표는 화면에 보이는 문구 기준이며, 기존 action은 삭제하지
> 않는다(액션 재사용/재명명 원칙은 `CLAUDE.md` UI/UX Governance Rules 섹션
> 참고).

## 섹션 3. 상태 표시 규칙

UI 상태는 다음 6가지로 통일한다:

| 상태 | 의미 |
| --- | --- |
| 완료 | 확인/실행이 끝났다. |
| 필요 | 아직 실행하지 않았다(실행하면 된다). |
| 확인 필요 | 시스템이 자동으로 판단할 수 없어 사람이 직접 봐야 한다. 오류가 아니다. |
| 차단됨 | 필수 조건을 충족하지 못해 진행할 수 없다. |
| 실패 | 실행을 시도했지만 오류가 발생했다. |
| 생략 | 해당 없음으로 건너뛴다(예: 이미지 없이 진행). |

내부 상태가 `ready`/`approved`/`exported`/`completed`/`pending`/`blocked`/`failed`
등으로 테이블마다 다르게 저장되어 있더라도, **화면에는 항상 위 6가지 중
하나로 변환해서** 보여준다. 변환 로직은 화면별 헬퍼(예:
`lib/social/manual-posting-checklist-status.ts`, `wordpress-blog-workflow-steps.ts`의
`stepBadgeClass`)에 모아두고, JSX 안에 산발적으로 매핑하지 않는다.

## 섹션 4. WordPress 게시 준비 UI 규칙

wordpress_blog 카드의 WordPress 게시 준비 UI는 반드시 **단계형 workflow**로
표시한다(버튼 단순 나열 금지). 자세한 단계 구성과 카드 전용 규칙은
[`docs/wordpress-blog-card-ui-rules.md`](./wordpress-blog-card-ui-rules.md)에 정리했다. 요약:

1. 품질검사
2. 승인
3. WordPress Draft
4. SEO Metadata
5. 대표 이미지
6. 게시 가능 상태 확인
7. 게시 체크리스트 / Handoff

각 단계에는 다음을 표시한다: 상태, 왜 필요한지, 현재 값, 실행 버튼, disabled
이유, 마지막 실행 결과.

**카드가 길어지면 탭으로 분리한다**: 한 카드 안에 기능이 계속 늘어나
세로 스크롤 부담이 커지면, 내용을 탭으로 나누고 카드 상단에는 항상
보이는 고정 상태 요약(핵심 상태 + 다음 추천 작업 + 최종 실행 버튼)만
남긴다. wordpress_blog 카드가 이 패턴의 실제 적용 사례다(6개 탭 —
글 내용/WordPress 미리보기/품질·승인/WordPress 반영/대표 이미지/
체크리스트, `docs/wordpress-blog-card-ui-rules.md` 참고). 탭 이동은
새 라이브러리 없이 query param(`tab=...`)과 기존 Tailwind만 사용하고,
action 실행 후에도 같은 카드·같은 탭으로 돌아온다.

**사용자가 자주 보는 작업 UI와 시스템 로그는 분리한다**: 카드 안에는
사용자가 실제로 해야 하는 작업(상태 요약, 다음 추천 작업, 실행 버튼,
짧은 결과 요약)만 두고, pipeline_logs/실행 이력/raw JSON details 같은
디버그성 정보는 페이지 하단의 별도 섹션으로 모은다. 하단 로그 섹션은
기본 접힘 상태로 두고, "문제가 발생했을 때만 확인하면 된다"는 것을
문구로 알려준다. 체크리스트(사용자가 지금 확인/처리해야 하는 항목)와
로그(이미 실행된 작업의 기록)는 서로 다른 개념이므로 같은 곳에 두지
않는다 — 체크리스트는 카드 안에, 로그는 페이지 하단에 둔다.
wordpress_blog 카드가 이 패턴의 실제 적용 사례다(`docs/article-blog-wordpress-workflow.md`
참고).

## 섹션 5. 외부 시스템 반영 미리보기 규칙

외부 시스템(WordPress 등)에 반영하기 전에 반드시 다음을 보여준다:

- 제목(WordPress 제목)
- 본문 미리보기
- SEO title
- meta description
- target keyword
- 대표 이미지
- AD_SLOT 위치
- 참고자료/출처

## 섹션 6. 업데이트 결과 표시 규칙

업데이트 action 실행 후 반드시 결과 요약을 보여준다:

- Draft 생성/업데이트 결과
- SEO Metadata 업데이트 결과
- 대표 이미지 연결 결과
- 게시 준비 상태
- 실패 단계
- 실패 사유
- 마지막 실행 시간

**일시적 action 결과는 toast로, 상태 자체는 카드에 남긴다**: "선택한
항목을 강조 표시했습니다.", "quality gate 실행 완료 (status: ready,
score: 92)." 같은 **일회성 확인 메시지**는 본문 중간에 계속 남는
alert/info box로 만들지 않는다. `components/ui/transient-notice.tsx`
(`TransientNotice`)처럼 화면 한쪽에 잠깐(기본 4초) 떴다 자동으로
사라지는 toast로 보여주고, 닫기 버튼도 둔다. 대신:
- 실제 **상태**(품질검사 완료 여부, score, 마지막 실행 시간 등)는
  toast가 아니라 카드의 상태 요약에 항상 남겨서, toast를 놓쳐도 지금
  상태를 확인할 수 있게 한다.
- **상세 실행 기록**(성공/실패, 언제, 무슨 값이었는지)은 페이지 하단
  프로세스 로그에 남는다(섹션 4의 로그/작업 UI 분리 규칙 참고).
- "선택한 항목을 강조 표시했습니다." 같은, 이미 화면에 보이는 사실을
  다시 문장으로 설명하는 메시지는 아예 표시하지 않는 것을 기본으로
  한다 — 카드 자체의 강조 표시(하이라이트 CSS)만으로 충분하다. 다만
  "선택한 항목을 찾을 수 없습니다" 같은 **실제로 필요한 경고**는
  toast가 아니라 그대로 유지한다(사용자가 놓치면 안 되는 정보이기
  때문).

## 섹션 7. 확인 필요 항목 규칙

"확인 필요" 항목은 오류가 아니며, 사람이 직접 확인해야 하는 항목이다. 각
항목에는 다음을 표시한다:

- 설명(무엇을 확인해야 하는지)
- 확인 방법(어디서 어떻게 확인하는지)
- 확인 완료 버튼(가능한 경우)
- URL 입력이 필요한 경우 입력 필드

**카드/박스 안 정보는 요약 → 상세(접기) 순으로 배치한다**: 제목/본문/
상태/metadata/오류/버튼이 한 화면에 한꺼번에 노출되면 읽기 어렵다.
지금 바로 필요한 정보(상태 badge, 다음 추천 작업, 실행 버튼, 상태에
실제로 영향을 주는 짧은 오류)만 기본으로 보여주고, metadata 전체
값·부가 상세·raw 내부 상태값·긴 설명 문장은 `<details>`(새 라이브러리
없이 네이티브 접기/펼치기)로 감싸 기본 접힘 상태로 둔다.
`docs/wordpress-blog-card-ui-rules.md`의 "카드 안 정보는 핵심 요약 →
상세(접기) 순으로 배치한다" 절이 이 패턴의 실제 적용 사례다. 오류는
"지금 상태에 영향을 주는 오류"와 "예전에 실패했던 이력"을 구분해서
표시한다 — 이미 해결된 문제(예: waived로 대체된 이전 실패)를 지금도
문제인 것처럼 크게 보여주지 않는다.

## 섹션 8. 금지 UI 패턴

다음을 금지한다:

- 버튼을 의미 없이 한 줄에 나열
- primary button 여러 개 동시 표시
- 같은 action을 여러 위치에 중복 노출
- "대기중"만 표시하고 이유를 설명하지 않음
- "확인 필요"만 표시하고 무엇을 확인할지 설명하지 않음
- Draft 생성과 공개 게시를 혼동시키는 문구
- article 원문 전송과 wordpress_blog 전송을 같은 것으로 보이게 하는 UI

## 관련 문서

- [`docs/ui-review-agent-checklist.md`](./ui-review-agent-checklist.md) — UI 수정 후 자체 점검 체크리스트
- [`docs/wordpress-blog-card-ui-rules.md`](./wordpress-blog-card-ui-rules.md) — wordpress_blog 카드 전용 UI 구조 규칙
- [`docs/ui-audit-wordpress-blog-card.md`](./ui-audit-wordpress-blog-card.md) — 현재 wordpress_blog 카드 UI 점검 결과
- [`docs/article-blog-wordpress-workflow.md`](./article-blog-wordpress-workflow.md) — wordpress_blog 게시 준비 워크플로우 구현 상세
