import { expect, test, type Page } from "@playwright/test";

const CHAIN_ANA = ["coffee", "bean", "plant", "farm"];
const CHAIN_BEN = ["rain", "cloud", "water", "river"];

async function writeChain(page: Page, words: string[]) {
  for (let i = 0; i < words.length; i++) await page.locator(`#chain-${i}`).fill(words[i]!);
  await expect(page.locator(`#chain-${words.length}`)).toHaveCount(0);
}

test("one-screen game: two players on one device", async ({ page }) => {
  await page.goto("/play");
  await page.getByRole("link", { name: /One screen/ }).click();
  await expect(page.getByRole("heading", { name: "One-screen duel" })).toBeVisible();

  await page.locator("#local-name-0").fill("Ana");
  await page.locator("#local-name-1").fill("Ben");
  await page.getByRole("radio", { name: "4 words" }).click();
  await page.getByRole("radio", { name: "No timer" }).click();
  await page.getByRole("button", { name: "Start duel" }).click();

  await expect(page.getByRole("heading", { name: "Ana goes first" })).toBeVisible();
  await page.getByRole("button", { name: /I'm Ana/ }).click();
  await writeChain(page, CHAIN_ANA);
  await page.getByRole("button", { name: /Lock in/ }).click();

  // Ana's words must be gone before Ben gets the device.
  await expect(page.getByRole("heading", { name: "Pass the device to Ben" })).toBeVisible();
  await expect(page.getByText(/coffee|bean|plant|farm/i)).toHaveCount(0);
  await page.getByRole("button", { name: /I'm Ben/ }).click();
  await writeChain(page, CHAIN_BEN);
  await page.getByRole("button", { name: /Lock in/ }).click();

  const input = page.locator("#guess-input");
  await expect(input).toBeEnabled({ timeout: 15_000 });
  await expect(page.getByRole("timer", { name: "No time limit" })).toBeVisible();
  // Hidden words are never on screen during play.
  await expect(page.getByText(/^(bean|plant|farm|cloud|water|river)$/i)).toHaveCount(0);

  // Ana goes first and they alternate; she cracks her third word first and wins the race.
  for (let round = 1; round <= 3; round++) {
    for (const [name, chain] of [["Ana", CHAIN_BEN], ["Ben", CHAIN_ANA]] as const) {
      if (round === 3 && name === "Ben") break;
      await expect(page.getByText(`${name}'s turn — crack word ${round + 1}`)).toBeVisible({ timeout: 15_000 });
      await expect(input).toBeEnabled();
      await input.fill(chain[round]!);
      await input.press("Enter");
      await expect(page.getByText(/Correct!/).first()).toBeVisible();
    }
  }

  await expect(page.getByRole("heading", { name: /wins!|draw/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("4 words · no timer")).toBeVisible();
  await page.getByRole("button", { name: "Play again" }).click();
  await expect(page.getByRole("heading", { name: "Ana goes first" })).toBeVisible();
});

test("host picks words and timer in the lobby; guest sees it", async ({ browser }) => {
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();
  await host.goto("/create");
  await host.waitForURL(/\/game\/[A-Z2-9]{5}$/);
  const code = host.url().split("/").pop()!;
  await guest.goto(`/game/${code}`);

  await host.getByRole("radio", { name: "7 words" }).click();
  await host.getByRole("radio", { name: "45 seconds" }).click();
  await expect(guest.getByRole("radio", { name: "7 words" })).toHaveAttribute("aria-checked", "true");
  await expect(guest.getByRole("radio", { name: "45 seconds" })).toHaveAttribute("aria-checked", "true");
  await expect(guest.getByRole("radio", { name: "4 words" })).toBeDisabled();

  await host.getByRole("button", { name: "I'm ready" }).click();
  await guest.getByRole("button", { name: "I'm ready" }).click();
  await expect(host.getByRole("heading", { name: "Create your chain" })).toBeVisible();
  await expect(host.locator("#chain-6")).toBeVisible();
  await expect(host.locator("#chain-7")).toHaveCount(0);
  await expect(host.getByText("7 words · 45s turns")).toBeVisible();
});
