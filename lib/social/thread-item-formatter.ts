// Phase UX-03B2: X처럼 threadItems 배열로 구성된 콘텐츠를 "복사용
// 텍스트"로 바꾼다. getSocialPostDisplayBody(공백 한 칸으로 이어붙인
// 압축 미리보기, 여러 화면의 quality gate/미리보기 로직이 이미
// 의존하고 있어 바꾸지 않는다)와는 별개로, 사람이 그대로 복사해
// 트윗 하나씩 올릴 수 있도록 빈 줄로 구분한다.

import type { ThreadItem } from "./social-platform-types";

/** thread item을 order 순서대로, 빈 줄로 구분해 복사용 텍스트로 만든다. */
export function formatThreadItemsForCopy(items: readonly ThreadItem[]): string {
  return items
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((item) => item.text.trim())
    .filter((text) => text.length > 0)
    .join("\n\n");
}
