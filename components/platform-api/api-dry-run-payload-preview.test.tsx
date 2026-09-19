import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ApiDryRunPayloadPreview } from "./api-dry-run-payload-preview";

describe("ApiDryRunPayloadPreview (Phase UX-04B: H2 dry-run 용어 정리)", () => {
  it("'Dry-run'/영문 필드명 대신 한국어 문구를 쓴다", () => {
    const html = renderToStaticMarkup(
      <ApiDryRunPayloadPreview
        payload={{
          platform: "x",
          title: "제목",
          hashtags: ["ai"],
          textPreview: "본문",
          captionPreview: null,
          payloadShape: {},
          validation: { valid: true, errors: [] },
        }}
      />
    );
    expect(html).toContain("API 게시 전 미리보기");
    expect(html).toContain("제목");
    expect(html).toContain("해시태그");
    expect(html).toContain("본문 미리보기");
    expect(html).not.toContain("Dry-run");
    expect(html).not.toContain(">title<");
    expect(html).not.toContain(">hashtags<");
    expect(html).not.toContain(">text preview<");
  });
});
