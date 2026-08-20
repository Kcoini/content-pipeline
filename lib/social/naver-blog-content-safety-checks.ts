// Article/Blog 페이지 역할 분리 리팩터링: naver_blog 글에서 발견된
// "가짜 서명"/"markdown heading anchor 문법 오류" 아티팩트를 점검하는
// 순수 함수. naver_blog 프롬프트가 "자연스러운 개인적인 어투"를
// 요청하기 때문에, 모델이 실존하지 않는 작성자 이름을 지어내고
// "{#이름}" 같은 kramdown 스타일 anchor 문법을 서명 줄에 잘못
// 붙이는 경우가 있다 — 이 함수는 그 두 가지를 감지만 하고, 콘텐츠를
// 자동으로 수정하지 않는다.

export interface NaverBlogContentSafetyResult {
  hasAnchorArtifact: boolean;
  hasSignatureArtifact: boolean;
  findings: string[];
}

/** kramdown/Pandoc 스타일 heading anchor 문법: `{#custom-id}`. */
const ANCHOR_ARTIFACT_PATTERN = /\{#[^}]*\}/;

/**
 * "홍길동 드림"/"홍길동 올림" 같은, 실존하지 않는 필자가 서명하는 형태.
 * 한글은 JS 정규식의 \w(word character)에 포함되지 않아 \b(word boundary)가
 * 기대대로 동작하지 않으므로 사용하지 않는다.
 */
const SIGNATURE_ARTIFACT_PATTERN = /[가-힣]{2,4}\s*(드림|올림)(?![가-힣])/;

/**
 * naver_blog 본문에서 markdown anchor 아티팩트와 가상 작성자 서명 아티팩트를
 * 점검한다. 콘텐츠 원문은 findings에 포함하지 않는다(어떤 종류가
 * 발견됐는지만 반환).
 */
export function checkNaverBlogContentSafety(text: string): NaverBlogContentSafetyResult {
  const hasAnchorArtifact = ANCHOR_ARTIFACT_PATTERN.test(text);
  const hasSignatureArtifact = SIGNATURE_ARTIFACT_PATTERN.test(text);

  const findings: string[] = [];
  if (hasAnchorArtifact) {
    findings.push("markdown heading anchor 문법({#...})이 본문에 남아 있습니다.");
  }
  if (hasSignatureArtifact) {
    findings.push("실존하지 않는 작성자 서명(OOO 드림/올림)으로 보이는 표현이 발견되었습니다.");
  }

  return { hasAnchorArtifact, hasSignatureArtifact, findings };
}
