# Phase 4-4: "마스터 원고 중심" 구조 전환 4차 — 비용 최적화·전체 페이지 반영

## 배경과 범위

[Phase 4-1](./phase-4-1-master-manuscript-terminology.md)(용어 정리) →
[Phase 4-2](./phase-4-2-platform-brief-structuring.md)(platformBrief
구조화) → [Phase 4-3](./phase-4-3-news-article-platform.md)(news_article
플랫폼 추가)로 이어진 "마스터 원고 중심" 구조 전환의 마지막 단계다.
원 요청 "19. 작업 범위 조절"이 4차로 명시한 범위는 다음 셋이다.

- 비용 최적화
- 테스트 보강
- 기존 페이지 전체 반영

## 1. 비용 최적화

### 1-1. 방어적 상한선 추가(있던 상한을 두 겹으로)

Phase 4-2까지는 `master-manuscript-builder.ts`가 `platformBriefs`의
각 배열(예: `supportingMessages.slice(0, 3)`, `tableCandidates.slice(0, 5)`)
만 잘랐고, **원본 재료인 `sourceSummaries`/`verifiedFacts` 자체에는
상한이 없었다** — 출처가 아주 많은 article이면 이 두 배열이 계속
커질 수 있었다(각 platformBrief는 잘려도, 마스터 원고 자체와
`/articles/[id]`에 보여줄 요약 개수는 무한정 커질 수 있었다는 뜻이다).

```ts
// lib/articles/master-manuscript-builder.ts
const MAX_SOURCE_SUMMARIES_IN_MASTER_MANUSCRIPT = 10;
const MAX_VERIFIED_FACTS_IN_MASTER_MANUSCRIPT = 20;
```

두 상수로 상한을 명시했다 — 이 상한을 넘는 나머지 출처/사실은
마스터 원고 계산에서 제외될 뿐, `sources` 테이블 자체는 전혀
건드리지 않는다(출처가 지워지는 게 아니라 "요약 재료로 다 쓰이지는
않는다"는 뜻이다).

### 1-2. platform_brief 프롬프트 블록에도 길이 상한 추가

`social-prompt-assembler.ts`가 `context.platformBrief`를 JSON으로
그대로 prompt에 넣는데(Phase 4-2), 이번에 상한을 추가했다.

```ts
const MAX_PLATFORM_BRIEF_JSON_LENGTH = 4000; // 문자
```

이미 1-1의 상한 덕분에 정상적인 마스터 원고에서 이 길이를 넘을 일은
거의 없지만, "마스터 원고 계산 로직이 나중에 바뀌어도 prompt 크기가
갑자기 커지지 않는다"는 방어선을 하나 더 두었다 — 이중 안전장치다.

### 1-3. 기존에 이미 있던 비용 최적화(재확인)

Phase 4-2 문서에서 이미 설명했듯, 이 프로젝트는 애초에 다음을
지키고 있었다 — 4차는 여기에 상한 두 개를 추가한 것뿐이다.

- `SocialWritingContext`는 article 본문 전체나 출처 원문(raw HTML)을
  절대 포함하지 않는다(`excerpt` 최대 600자, `keyPoints` 최대 8개,
  `sourceSummaries` 최대 5개).
- `platformBrief`는 마스터 원고 전체가 아니라 **그 플랫폼에 해당하는
  부분만** 프롬프트에 들어간다.
- 마스터 원고 자체는 AI를 다시 호출하지 않고 이미 생성된 article/
  source로부터 결정적으로 계산된다(추가 AI 비용 0).

## 2. 테스트 보강

- `lib/articles/master-manuscript-builder.test.ts`: 출처 30건으로
  마스터 원고를 계산해도 `sourceSummaries`/`verifiedFacts`가 각각
  10/20건 이하인지 검증하는 테스트 추가.
- `lib/social/social-prompt-assembler.test.ts`: 비정상적으로 큰
  platformBrief(긴 문자열 500개)가 들어와도 `platform_brief` 블록이
  4200자를 넘지 않고 "길이 제한으로 생략됨" 안내가 붙는지 검증하는
  테스트 추가.
- `app/articles/[id]/page.test.ts`: 새로 추가한 "마스터 원고 정보"
  섹션이 `readArticleMasterManuscript`로 조회되는지, 마스터 원고가
  없으면 섹션 자체가 렌더링되지 않는지, raw JSON을 노출하지 않는지
  검증하는 테스트 3개 추가.
- `app/articles/[id]/blog/page.test.ts`: news_article 카드에도
  올바른 안내 배지가 붙는지, "수동 Export" 버튼 라벨이 더 이상 영어
  플랫폼명("Naver Blog Export")을 하드코딩하지 않는지 검증하는 테스트
  갱신(Phase 4-3에서 발견한 버그 수정과 짝을 이룬다, 아래 3-2 참고).

## 3. 기존 페이지 전체 반영

### 3-1. `/articles/[id]`에 "마스터 원고 정보" 섹션 신설

Phase 4-2가 만든 구조화 데이터(`sourceSummaries`/`verifiedFacts`/
`verificationNeeded`/`platformBriefs`)는 지금까지 프롬프트 조립에만
쓰였을 뿐, **어떤 화면에도 보이지 않았다.** 이번에 처음으로
`/articles/[id]`(기사 상세 화면)에 "마스터 원고 정보" 섹션을
추가해, 사람이 이 데이터를 직접 확인할 수 있게 했다.

- 위치: "수익형 블로그 지표" 섹션과 "기사 본문" 섹션 사이.
- 표시 내용: 출처 요약 건수, 확인된 사실 건수, 확인 필요 사항
  건수, "7개 플랫폼 준비 완료" — raw JSON은 노출하지 않고 개수
  요약만 보여준다. 확인 필요 사항은 `<details>`로 펼쳐야 원문
  문장이 보인다.
- 안내 문구: "그대로 게시되는 내용이 아닙니다" — 마스터 원고가
  최종 게시글이 아니라는 원칙(Phase 4-1)을 이 화면에서도 반복한다.
- 마스터 원고가 없는 article(Phase 4-2 이전에 생성됐거나 계산이
  실패한 경우)에는 이 섹션 자체가 렌더링되지 않는다 — 없는 상태를
  지어내지 않는다.

### 3-2. Phase 4-3에서 발견한 버그 수정 — `/articles/[id]/blog`

news_article을 추가하고 나서(Phase 4-3), `/articles/[id]/blog`의
"수동 Export" 버튼 라벨이 `post.platform === "wordpress_blog" ?
"수동 게시용 Draft 내보내기" : "Naver Blog Export"`라는 3항 연산자로
되어 있어서, news_article 카드에도 (naver_blog가 아닌데도) 영어로
"Naver Blog Export"라고 잘못 표시되는 문제를 발견했다. 라벨을
"수동 export 만들기"로 일반화해 wordpress_blog 외 모든 blog 그룹
플랫폼(naver_blog, news_article)에 공통으로 쓰이게 고쳤다. 동시에
news_article 카드에도 "이 글은 언론 기사형(스트레이트 기사) 수동
게시용 글입니다." 안내 배지를 추가했다(wordpress_blog/naver_blog와
같은 패턴).

### 3-3. 반영을 보류한 것(이유와 함께)

- **`/articles/[id]` 화면 전체의 "기사" 표현을 "마스터 원고"로
  전면 교체**: 하지 않았다. 이 페이지는 `Article`(articles 테이블)
  자체를 조회/수정/승인하는 전용 화면이고, "기사 본문"/"기사 상태"
  같은 표현은 그 엔티티를 직접 가리키는 정확한 표현이다. Phase 4-1이
  바꾼 것은 "대시보드의 3종류 선택 + 생성 버튼" 흐름의 사용자 표현
  이었지, 이 상세 페이지의 모든 문구가 아니다 — 무리하게 전면
  교체하면(2000줄 이상의 파일) 회귀 위험만 커지고 실익이 낮다고
  판단했다.
- **`/articles/[id]/social`, `/articles/[id]/rewrite`,
  `/social-posts/[id]`에 마스터 원고 정보 노출**: news_article은
  `getPlatformGroup()` 기준 "blog" 그룹이라 이 페이지들에는 애초에
  나타나지 않는다(social/community 그룹만 다룬다). 마스터 원고
  정보 자체는 article 단위 데이터라 `/articles/[id]` 하나에만
  두는 것으로 충분하다고 판단했다 — 같은 정보를 여러 화면에
  중복해서 유지보수 부담을 늘리지 않는다.
- **뉴스 기사 전용 콘텐츠 안전 점검**(naver_blog의
  `checkNaverBlogContentSafety`에 대응하는 news_article 전용
  모듈): 만들지 않았다. quality gate의 `news_article_no_unsourced_claim`
  (Phase 4-3)이 최소한의 규칙 기반 검사를 이미 제공하고, 더 정교한
  검사가 필요한지는 실제 사용 후 판단하는 것이 안전하다고 봤다.

## 영향받지 않는 것

- Phase 4-1/4-2/4-3에서 만든 데이터 구조, 저장 위치(`format_metadata.
  master_manuscript`), DB schema는 전혀 바꾸지 않았다 — 상한선만
  추가했다.
- 기존 6개 플랫폼 + news_article의 실제 생성/검토/승인/export 흐름은
  전혀 건드리지 않았다.
- 자동 public publish는 추가하지 않았다.

## 테스트

- 전체 `npx vitest run`: 221 files / 2803 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만 존재.
- `npm run lint`: 0 오류.
- `npm run build`: 성공.

## 관련 문서

- [`phase-4-1-master-manuscript-terminology.md`](./phase-4-1-master-manuscript-terminology.md) — 1차
- [`phase-4-2-platform-brief-structuring.md`](./phase-4-2-platform-brief-structuring.md) — 2차
- [`phase-4-3-news-article-platform.md`](./phase-4-3-news-article-platform.md) — 3차
