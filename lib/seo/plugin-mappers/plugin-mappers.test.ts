import { describe, expect, it } from "vitest";
import { mapSeoPluginPayload } from "./index";
import { mapNonePayload } from "./none-mapper";
import { mapYoastPayload } from "./yoast-mapper";
import { mapRankMathPayload } from "./rank-math-mapper";
import { mapAioseoPayload } from "./aioseo-mapper";
import type { SeoPluginMapperInput } from "../seo-plugin-types";

function makeInput(overrides: Partial<SeoPluginMapperInput> = {}): SeoPluginMapperInput {
  return {
    articleId: "article-1",
    articleMode: "monetized_blog",
    title: "요양원과 요양병원 차이",
    seoTitle: "요양원 vs 요양병원 완벽 비교",
    metaDescription: "요양원과 요양병원의 차이를 정리했습니다.",
    slug: "care-facility-guide",
    targetKeyword: "요양원 요양병원 차이",
    secondaryKeywords: ["장기요양보험", "부모님 돌봄"],
    formatMetadata: {},
    wpCategoryNames: ["복지"],
    wpTagNames: ["장기요양보험", "요양원"],
    canonicalUrl: "https://example-blog.test/care-facility-guide",
    schemaType: "BlogPosting",
    ...overrides,
  };
}

describe("mapNonePayload", () => {
  it("provider=none이고 rawPluginMeta는 비어있다 (write 대상 없음)", () => {
    const payload = mapNonePayload(makeInput());

    expect(payload.provider).toBe("none");
    expect(payload.seoTitle).toBe("요양원 vs 요양병원 완벽 비교");
    expect(payload.metaDescription).toBe("요양원과 요양병원의 차이를 정리했습니다.");
    expect(payload.rawPluginMeta).toEqual({});
    expect(payload.writeMode).toBeUndefined();
  });
});

describe("mapYoastPayload", () => {
  it("Yoast용 rawPluginMeta 후보를 만든다", () => {
    const payload = mapYoastPayload(makeInput());

    expect(payload.provider).toBe("yoast");
    expect(payload.rawPluginMeta).toEqual({
      _yoast_wpseo_title: "요양원 vs 요양병원 완벽 비교",
      _yoast_wpseo_metadesc: "요양원과 요양병원의 차이를 정리했습니다.",
      _yoast_wpseo_focuskw: "요양원 요양병원 차이",
    });
    expect(payload.writeMode).toBe("prepared_only");
  });
});

describe("mapRankMathPayload", () => {
  it("Rank Math용 rawPluginMeta 후보를 만든다", () => {
    const payload = mapRankMathPayload(makeInput());

    expect(payload.provider).toBe("rank_math");
    expect(payload.rawPluginMeta).toEqual({
      rank_math_title: "요양원 vs 요양병원 완벽 비교",
      rank_math_description: "요양원과 요양병원의 차이를 정리했습니다.",
      rank_math_focus_keyword: "요양원 요양병원 차이",
    });
    expect(payload.writeMode).toBe("prepared_only");
  });
});

describe("mapAioseoPayload", () => {
  it("AIOSEO용 rawPluginMeta 후보를 만든다", () => {
    const payload = mapAioseoPayload(makeInput());

    expect(payload.provider).toBe("aioseo");
    expect(payload.rawPluginMeta?._aioseo_title).toBe("요양원 vs 요양병원 완벽 비교");
    expect(payload.rawPluginMeta?._aioseo_description).toBe("요양원과 요양병원의 차이를 정리했습니다.");
    expect(payload.rawPluginMeta?._aioseo_keywords).toContain("장기요양보험");
    expect(payload.writeMode).toBe("prepared_only");
  });
});

describe("mapSeoPluginPayload — provider 선택", () => {
  it("none을 전달하면 mapNonePayload와 동일한 결과를 반환한다", () => {
    expect(mapSeoPluginPayload("none", makeInput())).toEqual(mapNonePayload(makeInput()));
  });

  it("yoast를 전달하면 mapYoastPayload와 동일한 결과를 반환한다", () => {
    expect(mapSeoPluginPayload("yoast", makeInput())).toEqual(mapYoastPayload(makeInput()));
  });

  it("모든 provider의 payload에 공통 필드(OG/Twitter/canonical/schemaType)가 포함된다", () => {
    for (const provider of ["none", "yoast", "rank_math", "aioseo"] as const) {
      const payload = mapSeoPluginPayload(provider, makeInput());
      expect(payload.ogTitle).toBe("요양원 vs 요양병원 완벽 비교");
      expect(payload.ogDescription).toBe("요양원과 요양병원의 차이를 정리했습니다.");
      expect(payload.twitterTitle).toBe("요양원 vs 요양병원 완벽 비교");
      expect(payload.canonicalUrl).toBe("https://example-blog.test/care-facility-guide");
      expect(payload.schemaType).toBe("BlogPosting");
    }
  });
});
