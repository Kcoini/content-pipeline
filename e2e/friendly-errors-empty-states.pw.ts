// PRODUCT-01G: Friendly Errors & Empty States 대표 상태를 desktop +
// narrow에서 확인한다. 문구는 fixture 생성 단계에서 실제 helper
// (describeUnexpectedError/JobProgressCard/app/not-found.tsx)로 계산·
// 렌더링한 것을 그대로 구웠다 — 여기서는 raw 기술 용어 부재/행동
// 명확성/overflow만 확인한다.
import { test, expect } from "@playwright/test";
import path from "node:path";
import { GENERATED_DIR } from "./support/render-fixture";
import { FIXTURE_NAMES } from "./support/fixture-names";

function fixtureUrl(name: string): string {
  return "file://" + path.join(GENERATED_DIR, `${name}.html`).replace(/\\/g, "/");
}

const ALL_ERROR_EMPTY_FIXTURES = [
  FIXTURE_NAMES.errorSourceFetchPartialFailure,
  FIXTURE_NAMES.errorGenerationFailure,
  FIXTURE_NAMES.errorStructuredOutputFailure,
  FIXTURE_NAMES.errorWordpressDraftFailure,
  FIXTURE_NAMES.errorJobStalled,
  FIXTURE_NAMES.errorNotFound,
  FIXTURE_NAMES.dashboardWelcomeEmptyState, // F. no-content-empty-state (PRODUCT-01D fixture 재사용)
];

for (const name of ALL_ERROR_EMPTY_FIXTURES) {
  test(`${name}: 좁은 화면에서도 overflow가 없다`, async ({ page }) => {
    await page.goto(fixtureUrl(name));
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalOverflow).toBe(false);
  });

  test(`${name}: raw 기술 용어(JSON/stack/env var/Anthropic/Supabase)가 화면에 없다`, async ({ page }) => {
    await page.goto(fixtureUrl(name));
    const bodyText = await page.locator("body").innerText();
    for (const forbidden of [/\bjson\b/i, /anthropic/i, /supabase/i, /process\.env/i, /at \S+ \(.*:\d+:\d+\)/]) {
      expect(bodyText).not.toMatch(forbidden);
    }
  });
}

test.describe("A. 참고자료 일부 수집 실패", () => {
  test("성공/실패 건수를 구분하고, raw fetch 에러 텍스트를 감춘다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.errorSourceFetchPartialFailure));
    await expect(page.getByText("본문 수집 완료 1개 · 실패 1개")).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("TypeError");
    expect(bodyText).not.toContain("Failed to fetch");
  });
});

test.describe("B. AI 콘텐츠 생성 실패", () => {
  test("행동 중심 메시지로 바뀌고 raw runtime 에러가 없다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.errorGenerationFailure));
    await expect(page.getByText("콘텐츠를 만드는 중 문제가 발생했습니다.", { exact: false })).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("Cannot read properties");
  });
});

test.describe("C. Structured output 실패", () => {
  test("JSON/schema 같은 기술 용어 없이 안내한다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.errorStructuredOutputFailure));
    await expect(page.getByText("콘텐츠 생성 결과를 정상적으로 처리하지 못했습니다.")).toBeVisible();
  });
});

test.describe("D. WordPress Draft 실패", () => {
  test("공개 여부/데이터 보존을 안내하고, primary action이 하나로 명확하다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.errorWordpressDraftFailure));
    await expect(page.getByText("WordPress에 초안을 저장하지 못했습니다.")).toBeVisible();
    await expect(page.getByText("앱에 그대로 저장되어 있습니다", { exact: false })).toBeVisible();
    await expect(page.getByText("공개되지 않았습니다", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "다시 시도" })).toBeVisible();
  });
});

test.describe("E. Job stalled", () => {
  test("실패(failed)로 단정하지 않는다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.errorJobStalled));
    await expect(page.getByText("멈춤 가능성 있음")).toBeVisible();
    await expect(page.getByText("실패로 확정된 것은 아니니", { exact: false })).toBeVisible();
  });
});

test.describe("F. no-content-empty-state", () => {
  test("빈 상태가 행동 중심 안내(첫 콘텐츠 만들기)로 보인다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.dashboardWelcomeEmptyState));
    await expect(page.getByRole("link", { name: "첫 콘텐츠 만들기" })).toBeVisible();
  });
});

test.describe("H. Not found", () => {
  test("raw framework 404 대신 행동 중심 안내를 보여준다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.errorNotFound));
    await expect(page.getByText("콘텐츠를 찾을 수 없습니다.")).toBeVisible();
    await expect(page.getByRole("link", { name: "내 콘텐츠로 돌아가기" })).toBeVisible();
  });
});
