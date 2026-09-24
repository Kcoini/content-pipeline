import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import NotFound from "./not-found";

describe("PRODUCT-01G: app/not-found.tsx (전역 404)", () => {
  it("행동 중심 안내와 돌아가기 링크를 보여준다(raw framework 404 아님)", () => {
    const html = renderToStaticMarkup(<NotFound />);
    expect(html).toContain("콘텐츠를 찾을 수 없습니다.");
    expect(html).toContain("내 콘텐츠로 돌아가기");
    expect(html).toContain('href="/dashboard"');
  });

  it("raw database/not found exception 문구를 노출하지 않는다", () => {
    const html = renderToStaticMarkup(<NotFound />);
    expect(html).not.toMatch(/404|not found|NotFoundError/i);
  });
});
