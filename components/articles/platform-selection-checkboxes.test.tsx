import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformSelectionCheckboxes, type PlatformCheckboxOption, type ToneSelectionConfig } from "./platform-selection-checkboxes";

function makeOptions(): PlatformCheckboxOption[] {
  return [
    {
      value: "wordpress_blog",
      label: "WordPress 블로그",
      description: "설명",
      costLevel: "high",
      statusLabel: "아직 생성되지 않음",
      recommended: true,
    },
    {
      value: "naver_cafe",
      label: "네이버 카페",
      description: "설명",
      costLevel: "low",
      statusLabel: "아직 생성되지 않음",
      recommended: false,
    },
  ];
}

function makeToneSelection(): ToneSelectionConfig {
  return {
    toneStyleOptions: [
      { value: "explanatory", label: "설명형" },
      { value: "story", label: "스토리형" },
    ],
    recommendedToneByPlatform: { wordpress_blog: "explanatory", naver_cafe: "story" },
  };
}

describe("PlatformSelectionCheckboxes: toneSelection prop 없음(기존 동작)", () => {
  it("toneSelection을 넘기지 않으면 문체 설정 UI를 렌더링하지 않는다(대시보드 등 기존 호출부 호환)", () => {
    const html = renderToStaticMarkup(<PlatformSelectionCheckboxes options={makeOptions()} />);
    expect(html).not.toContain("문체 설정");
    expect(html).not.toContain('name="toneMode"');
  });

  it("플랫폼 체크박스는 그대로 렌더링된다", () => {
    const html = renderToStaticMarkup(<PlatformSelectionCheckboxes options={makeOptions()} />);
    expect(html).toContain("WordPress 블로그");
    expect(html).toContain("네이버 카페");
    expect(html).toContain('name="platforms"');
  });
});

describe("PlatformSelectionCheckboxes: toneSelection prop 있음 (Phase 4-23)", () => {
  it("기본값은 '추천 문체 자동 적용'이고 toneMode hidden input이 auto_recommended다", () => {
    const html = renderToStaticMarkup(<PlatformSelectionCheckboxes options={makeOptions()} toneSelection={makeToneSelection()} />);
    expect(html).toContain("문체 설정");
    expect(html).toContain("추천 문체 자동 적용");
    expect(html).toContain('name="toneMode" value="auto_recommended"');
  });

  it("기본(추천 문체 자동 적용) 화면에는 raw tone_style enum이 노출되지 않는다", () => {
    const html = renderToStaticMarkup(<PlatformSelectionCheckboxes options={makeOptions()} toneSelection={makeToneSelection()} />);
    expect(html).not.toContain(">explanatory<");
    expect(html).not.toContain(">story<");
  });

  it("기본 상태에서는 same_for_all/manual_per_platform 드롭다운을 보여주지 않는다(선택 시에만 펼침)", () => {
    const html = renderToStaticMarkup(<PlatformSelectionCheckboxes options={makeOptions()} toneSelection={makeToneSelection()} />);
    expect(html).not.toContain('name="uniformToneStyle"');
    expect(html).not.toMatch(/name="toneStyle_/);
  });

  it("플랫폼별 특성에 맞게 문체가 완화된다는 안내 문구를 포함한다", () => {
    const html = renderToStaticMarkup(<PlatformSelectionCheckboxes options={makeOptions()} toneSelection={makeToneSelection()} />);
    expect(html).toContain("자동으로 완화됩니다");
  });

  it("추천 문체 자동 적용(기본) 상태에서는 체크된 플랫폼의 적용 예정 문체를 미리 보여준다", () => {
    const html = renderToStaticMarkup(<PlatformSelectionCheckboxes options={makeOptions()} toneSelection={makeToneSelection()} />);
    // makeOptions()의 wordpress_blog만 recommended:true라 기본 체크됨 → 추천 문체(explanatory="설명형")가 보여야 한다.
    expect(html).toContain("WordPress 블로그: 설명형");
  });
});
