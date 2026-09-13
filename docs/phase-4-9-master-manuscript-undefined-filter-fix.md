# Phase 4-9: "Cannot read properties of undefined (reading 'filter')" 수정

## 오류 위치와 정확한 원인

`Cannot read properties of undefined (reading 'filter')`가 기사
상세/SNS 글 생성 화면(네이버 카페, 설명형, `reviewed` 상태, "선택한
플랫폼 글 생성" 버튼 근처)에서 발생했다.

**원인**: Phase 4-8에서 `MasterManuscript`에 최상위 `evidenceMap`/
`issues`/`readerMeaning`을 새로 추가했다. 이 필드들은
`articles.format_metadata.master_manuscript`(jsonb)에 저장되는데, 이미
Phase 4-8 **이전에 생성되어 저장된 마스터 원고**에는 이 필드가 아예
없다. 그런데 `readArticleMasterManuscript()`(`lib/repositories/article-repository.ts`)는
저장된 raw JSON을 검증 없이 그대로 `MasterManuscript` 타입으로
캐스팅하고 있었다:

```ts
// 이전 코드 — shape을 전혀 검증하지 않는다
export function readArticleMasterManuscript(article): MasterManuscript | null {
  const raw = article.formatMetadata?.master_manuscript;
  return raw ? (raw as MasterManuscript) : null;
}
```

그 결과 오래된 마스터 원고를 읽으면 TypeScript 타입은 `evidenceMap:
MasterManuscriptEvidenceEntry[]`라고 믿고 있지만, 실제 런타임 값은
`undefined`였다. 이 값을 그대로 쓰는 두 곳이 실제로 터졌다:

- `lib/social/social-writing-context-builder.ts`(`buildSocialWritingContext`) —
  `masterManuscript.evidenceMap.filter(...)`. "선택한 플랫폼 글 생성"이
  이 함수를 호출해 프롬프트 재료를 만드는데, 여기서 예외가 나면서
  사용자가 본 정확히 그 메시지가 발생했다.
- `lib/articles/master-manuscript-review.ts`(`reviewMasterManuscript`) —
  `master.evidenceMap.length`, `master.issues`/`readerMeaning` 관련
  계산.
- `app/articles/[id]/page.tsx`의 "마스터 원고 정보" 섹션 —
  `masterManuscript.evidenceMap.length`/`.map(...)`.

## 수정 1: 마스터 원고 정규화 함수 (근본 원인 수정)

`lib/articles/master-manuscript-normalize.ts`(신규)의
`normalizeMasterManuscript(input)`이 저장된 값이 무엇이든(구버전 JSON,
일부 필드 누락, 잘못된 타입) 항상 완전한 `MasterManuscript` 모양으로
만든다 — 배열 필드는 없으면 `[]`, object 필드는 없으면 `{}`, 문자열
필드는 없으면 `""`로 채운다. 입력이 객체가 아니면(null/undefined/배열/
원시값) `null`을 반환한다.

`readArticleMasterManuscript()`가 이제 이 정규화를 항상 거친다 — 이
한 곳만 고치면 이 함수를 호출하는 모든 소비자(페이지, 검토, 플랫폼
글 생성)가 자동으로 안전해진다.

```ts
export function readArticleMasterManuscript(article): MasterManuscript | null {
  const raw = article.formatMetadata?.master_manuscript;
  if (!raw) return null;
  return normalizeMasterManuscript(raw);
}
```

## 수정 2: 공용 `asArray` helper + 방어 계층 추가

`lib/utils/safe-array.ts`의 `asArray<T>(value)`가 `Array.isArray`로
실제 배열인지 확인하고, 아니면(undefined/null/객체/문자열 등) 빈
배열을 반환한다. `value || []`만으로는 falsy가 아닌 잘못된 값(객체,
문자열)이 들어왔을 때 여전히 안전하지 않아 `Array.isArray`를 쓴다.

정규화가 근본 원인을 막지만, 다음 두 곳에는 추가로 `asArray`를
적용해 방어를 이중화했다(마스터 원고 구조가 앞으로 또 바뀌거나, 이
함수들이 정규화를 거치지 않은 값으로 직접 호출되는 경우까지 대비):

- `lib/articles/master-manuscript-review.ts`
- `lib/social/social-writing-context-builder.ts`

## 수정 3: raw runtime 에러 메시지가 화면에 그대로 노출되지 않게

`generateSocialDraft()`(`lib/social/social-draft-generation-service.ts`)는
이미 예외를 throw하지 않고 `{ success: false, message }`로 반환하고
있었다(페이지 전체가 깨지지는 않았다) — 하지만 그 `message`가
`error.message`를 그대로 옮긴 것이라, "Cannot read properties of
undefined (reading 'filter')" 같은 raw 텍스트가 사용자에게 그대로
보이는 문제가 있었다.

`lib/errors/describe-unexpected-error.ts`(신규)의
`describeUnexpectedError(message, fallback)`이 메시지가 raw runtime
에러처럼 보이는 패턴(`cannot read propert`, `is not a function`,
`is not defined` 등)이면 fallback 문구로 바꾸고, 사람이 쓴 한국어
도메인 에러 메시지("기사를 찾을 수 없습니다" 등)는 그대로 둔다. raw
메시지는 버리지 않고 로그(`social_draft_generation_failed`)에는
그대로 남긴다 — 디버깅에 필요하기 때문이다.

같은 처리를 `app/articles/[id]/actions.ts`의
`generateSelectedPlatformPostsAction`/`generateAllPlatformPostsAction`
catch 블록에도 적용했다(개별 플랫폼 생성 루프 밖에서 나는 예상 밖
오류에 대한 두 번째 방어선).

사용자 메시지 예:

> 글 생성 중 필요한 데이터 일부를 읽지 못했습니다. 마스터 원고 또는
> 플랫폼 정보가 부족할 수 있습니다. 마스터 원고를 다시 생성한 뒤
> 다시 시도해 주세요.

## 확인: 네이버 카페 post_body 우선 저장 — 이미 정상이었다

`lib/social/social-draft-generation-service.ts`의 저장 로직과
`lib/social/social-post-display.ts`의 `getSocialPostDisplayBody()`를
확인한 결과, naver_cafe는 이미:

- 생성 시 `postBody`를 `sanitizeNaverCafePlainText()`로 정리해 저장하고
  (`caption`은 별도로 둔다, 섞지 않는다).
- 표시 시 `postBody`를 `caption`보다 항상 우선한다
  (`if (post.platform === "naver_cafe") return sanitizeNaverCafePlainText(post.postBody) || post.caption?.trim() || ""`).

"caption만 있고 post_body가 비어 있는" 문제는 이미 이전 phase(Phase
3-20 주석 참고)에서 고쳐져 있었다 — 이번 phase에서 다시 만들지
않았다.

## 안전 원칙 재확인

- 자동 public publish는 이 phase에서도 추가하지 않았다.
- WordPress Draft/export 승인 guard는 변경하지 않았다.
- 기존 social post 생성 흐름(성공 경로)은 전혀 바뀌지 않았다 —
  실패 시 메시지만 사용자 친화적으로 바뀌었다.
- DB schema는 변경하지 않았다.

## 테스트

- `lib/articles/master-manuscript-normalize.test.ts`(신규): null/배열/
  원시값 입력, 구버전 원고(evidenceMap/issues/readerMeaning 없음)
  정규화, platformBriefs의 특정 플랫폼이 null이어도 빈 객체로 채워짐,
  verifiedFacts 항목이 잘못된 모양이어도 안전한 기본값, 완전한 원고는
  값을 보존.
- `lib/utils/safe-array.test.ts`(신규): 배열/undefined/null/객체/문자열
  입력 처리.
- `lib/repositories/article-repository.test.ts`: `readArticleMasterManuscript`가
  구버전 원고를 정규화해 반환하는지(실제 버그 재현 시나리오).
- `lib/errors/describe-unexpected-error.test.ts`(신규): raw 런타임
  에러 패턴 감지, 도메인 에러 메시지 보존.
- `lib/social/social-draft-generation-service.test.ts`: raw 에러가
  사용자 메시지로는 안 보이고 로그에는 원문이 남는지 검사.
- 전체 `npx vitest run`: 231 files / 2933 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만 존재.
- `npm run lint`: 0 오류. `npm run build`: 성공.

## 관련 문서

- [`phase-4-8-master-manuscript-evidence-quality.md`](./phase-4-8-master-manuscript-evidence-quality.md) — 이번에 정규화 대상이 된 evidenceMap/issues/readerMeaning을 처음 추가한 phase
- [`ui-ux-governance-rules.md`](./ui-ux-governance-rules.md) — "AI 응답/마스터 원고의 배열 필드는 항상 누락될 수 있다" 원칙
