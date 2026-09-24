// PRODUCT-01H 섹션 25: 개별 fixture 검증에 더해, 하나의 연속된 제품
// 사용자 journey(welcome → source → generation-ready → generated →
// review/승인 준비 → publish-prep)를 순서대로 확인한다. 새 fixture를
// 굽지 않고 이미 존재하는 fixture(PRODUCT-01D~G에서 만든 것)만
// 순서대로 방문한다 — 실제 server mutation 없이 대표 상태만 본다.
import { test, expect } from "@playwright/test";
import path from "node:path";
import { GENERATED_DIR } from "./support/render-fixture";
import { FIXTURE_NAMES } from "./support/fixture-names";

function fixtureUrl(name: string): string {
  return "file://" + path.join(GENERATED_DIR, `${name}.html`).replace(/\\/g, "/");
}

test.describe("Product User Journey: welcome → source → generation-ready → generated → publish-prep", () => {
  test("1) welcome: 서비스 설명 + 단일 CTA", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.dashboardWelcomeEmptyState));
    await expect(page.getByText("환영합니다.")).toBeVisible();
    await expect(page.getByRole("link", { name: "첫 콘텐츠 만들기" })).toBeVisible();
  });

  test("2) source: 참고자료 필요 상태(테마/출처 같은 내부 용어 없음)", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.creationStepSources));
    await expect(page.getByText("아직 참고자료가 없습니다.")).toBeVisible();
    await expect(page.getByText("참고자료 추가하기")).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("테마");
    expect(bodyText).not.toMatch(/\bsource\b/i);
  });

  test("3) generation-ready: 참고자료 준비 완료 → 마스터 원고 만들기", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.creationStepSourcesReady));
    await expect(page.getByText("참고자료가 준비되었습니다", { exact: false })).toBeVisible();
    await expect(page.getByText("마스터 원고 만들기")).toBeVisible();
  });

  test("4) generating: 실제 상태 기반 라벨만(fake progress 없음)", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.creationStepGenerating));
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/\d{1,3}%/);
    await expect(page.getByText("콘텐츠를 만들고 있습니다.")).toBeVisible();
  });

  test("5) generated: 결과 확인 → 검토할 글 보기", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.creationStepGenerated));
    await expect(page.getByText("생성된 글이 있습니다", { exact: false })).toBeVisible();
    await expect(page.getByText("검토할 글 보기")).toBeVisible();
  });

  test("6) publish-prep(WordPress): 초안 저장이며 공개 게시가 아니다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.publishWordpressReady));
    await expect(page.getByText("게시 방식: 초안으로 저장", { exact: false })).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("공개 게시");
  });

  test("6) publish-prep(WordPress) 완료: 초안 저장 완료, 공개 게시로 오인되지 않는다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.publishWordpressDraftComplete));
    await expect(page.getByText("WordPress 초안이 저장되었습니다.")).toBeVisible();
    await expect(page.getByText("공개 게시는 하지 않았습니다", { exact: false })).toBeVisible();
  });

  test("전체 journey에서 용어가 흔들리지 않는다(주제/참고자료/콘텐츠 만들기로 통일)", async ({ page }) => {
    const pages = [
      FIXTURE_NAMES.dashboardWelcomeEmptyState,
      FIXTURE_NAMES.creationStepSources,
      FIXTURE_NAMES.creationStepSourcesReady,
      FIXTURE_NAMES.creationStepGenerated,
    ];
    for (const name of pages) {
      await page.goto(fixtureUrl(name));
      const bodyText = await page.locator("body").innerText();
      // "테마"/"출처"라는 옛 용어가 이 journey 화면들에 섞여 있지 않은지 확인.
      expect(bodyText).not.toContain("테마");
      expect(bodyText).not.toContain("출처");
    }
  });
});

test.describe("Product User Journey — narrow(390x844)에서도 각 단계 overflow가 없다", () => {
  const steps = [
    FIXTURE_NAMES.dashboardWelcomeEmptyState,
    FIXTURE_NAMES.creationStepSources,
    FIXTURE_NAMES.creationStepSourcesReady,
    FIXTURE_NAMES.creationStepGenerating,
    FIXTURE_NAMES.creationStepGenerated,
    FIXTURE_NAMES.publishWordpressReady,
    FIXTURE_NAMES.publishWordpressDraftComplete,
  ];
  for (const name of steps) {
    test(`${name}: overflow 없음`, async ({ page }) => {
      await page.goto(fixtureUrl(name));
      const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(hasOverflow).toBe(false);
    });
  }
});
