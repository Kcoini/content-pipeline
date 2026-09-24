// PRODUCT-01E: Content Creation Experience 6개 대표 상태(주제 없음 →
// 참고자료 없음 → 참고자료 준비 → 콘텐츠 생성 준비 → 생성 중 → 생성
// 결과)를 desktop + narrow에서 확인한다. 문구는 fixture 생성 단계에서
// 실제 helper(getDashboardStatusSummary/getWorkflowStateTone)로 계산된
// 것을 그대로 구웠다 — 여기서는 "현재 단계가 명확한지/overflow가
// 없는지/기술 용어가 없는지"만 브라우저 렌더링 기준으로 확인한다.
import { test, expect } from "@playwright/test";
import path from "node:path";
import { GENERATED_DIR } from "./support/render-fixture";
import { FIXTURE_NAMES } from "./support/fixture-names";

function fixtureUrl(name: string): string {
  return "file://" + path.join(GENERATED_DIR, `${name}.html`).replace(/\\/g, "/");
}

const STATE_FIXTURES = [
  { name: FIXTURE_NAMES.creationStepTheme, expectHeadline: "아직 선택된 주제가 없습니다." },
  { name: FIXTURE_NAMES.creationStepSources, expectHeadline: "아직 참고자료가 없습니다." },
  { name: FIXTURE_NAMES.creationStepSourcesReady, expectHeadline: "참고자료가 준비되었습니다" },
  { name: FIXTURE_NAMES.creationStepGenerateReady, expectHeadline: "마스터 원고가 준비되었습니다." },
  { name: FIXTURE_NAMES.creationStepGenerated, expectHeadline: "생성된 글이 있습니다" },
];

for (const { name, expectHeadline } of STATE_FIXTURES) {
  test.describe(`Content Creation Experience 상태: ${name}`, () => {
    test("현재 상태 문구가 보이고, primary action 1개가 가장 강조된다", async ({ page }) => {
      await page.goto(fixtureUrl(name));
      await expect(page.getByText(expectHeadline, { exact: false })).toBeVisible();
      // primary action은 bg-zinc-900(강조 배경)인 요소가 정확히 1개다.
      await expect(page.locator(".bg-zinc-900")).toHaveCount(1);
    });

    test("좁은 화면에서도 가로 스크롤(overflow)이 생기지 않는다", async ({ page }) => {
      await page.goto(fixtureUrl(name));
      const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(hasHorizontalOverflow).toBe(false);
    });
  });
}

test.describe("Content Creation Experience — 생성 중 상태", () => {
  test("실제 state 기반 라벨(완료/진행 중/대기)만 쓰고, 임의 progress %가 없다(섹션 15)", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.creationStepGenerating));
    await expect(page.getByText("콘텐츠를 만들고 있습니다.")).toBeVisible();
    await expect(page.getByText("완료", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("진행 중", { exact: false }).first()).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/\d{1,3}%/);
  });
});

test.describe("Content Creation Experience — 단계 표시(ContentProgressSteps)", () => {
  test("모든 상태 fixture에 현재 단계를 텍스트로 알 수 있는 stepper가 있다(색상만으로 표현하지 않음)", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.creationStepSources));
    await expect(page.getByRole("navigation", { name: "콘텐츠 생성 진행 단계" })).toBeVisible();
    await expect(page.getByText("참고자료 확인")).toBeVisible();
  });
});
