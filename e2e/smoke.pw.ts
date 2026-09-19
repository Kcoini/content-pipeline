import { test, expect } from "@playwright/test";
import path from "node:path";
import { GENERATED_DIR } from "./support/render-fixture";
import { FIXTURE_NAMES } from "./support/fixture-names";

function fixtureUrl(name: string): string {
  return "file://" + path.join(GENERATED_DIR, `${name}.html`).replace(/\\/g, "/");
}

test("smoke: 실제 컴포넌트로 구운 fixture를 Chromium이 렌더링한다", async ({ page }) => {
  await page.goto(fixtureUrl(FIXTURE_NAMES.guardBlockedNaturalLanguage));

  await expect(page.getByText("게시 전에 확인할 사항이 1개 있습니다.")).toBeVisible();
  await expect(page.getByText("아직 승인되지 않았습니다.")).toBeVisible();
});
