import { expect, test, type Browser, type Page } from "@playwright/test";

const CHAIN_A = ["coffee", "bean", "plant", "farm", "market"];
const CHAIN_B = ["rain", "cloud", "water", "river", "ocean"];

async function newPlayer(browser: Browser, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  // Create the guest session and set a recognizable name.
  await page.goto("/play");
  await expect(page.getByText("Playing as")).toBeVisible();
  const res = await page.request.patch("/api/session", { data: { displayName: name } });
  expect(res.ok()).toBe(true);
  return { context, page };
}

async function createRoom(page: Page): Promise<string> {
  await page.goto("/create");
  await page.waitForURL(/\/game\/[A-Z2-9]{5}$/);
  const code = page.url().split("/").pop()!;
  await expect(page.getByRole("heading", { name: /waiting for your opponent/i })).toBeVisible();
  return code;
}

async function buildChain(page: Page, words: string[]) {
  await expect(page.getByRole("heading", { name: "Create your chain" })).toBeVisible();
  for (let i = 0; i < words.length; i++) {
    await page.locator(`#chain-${i}`).fill(words[i]!);
  }
  await page.getByRole("button", { name: "Lock in chain" }).click();
  await expect(page.getByText(/Locked in!/)).toBeVisible();
}

async function whoseTurn(a: Page, b: Page, timeoutMs = 20_000): Promise<Page> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const p of [a, b]) {
      if (await p.locator("#guess-input").isEnabled({ timeout: 100 }).catch(() => false)) return p;
    }
    await a.waitForTimeout(100);
  }
  throw new Error("Nobody's turn came up");
}

/** Plays every turn: whoever's input is enabled guesses the next word of the other chain. */
async function playOut(a: Page, b: Page, opts: { reloadBMidGame?: boolean } = {}) {
  const progress = new Map<Page, number>([
    [a, 1],
    [b, 1],
  ]);
  let reloaded = false;
  for (let turns = 0; turns < 8; turns++) {
    const guesser = await whoseTurn(a, b);
    const n = progress.get(guesser)!;
    const word = (guesser === a ? CHAIN_B : CHAIN_A)[n]!;

    if (opts.reloadBMidGame && !reloaded && turns === 2) {
      reloaded = true;
      // Refresh mid-match: the server must restore the exact game state.
      await b.reload();
      await expect(b.getByText(/Duel · /)).toBeVisible();
      await expect(b.getByText(/is guessing word \d|Your turn — crack word \d/).first()).toBeVisible();
    }

    const input = guesser.locator("#guess-input");
    await expect(input).toBeEnabled();
    // A wrong guess first on round 1, to exercise feedback.
    if (n === 1) {
      await input.fill("zzzz");
      await input.press("Enter");
      await expect(guesser.getByText("Not quite!")).toBeVisible();
    }
    // And a hint on round 2.
    if (n === 2) {
      await guesser.getByRole("button", { name: /Reveal letter/ }).click();
      await expect(guesser.getByText(/Hint used/)).toBeVisible();
    }
    await input.fill(word);
    await input.press("Enter");
    await expect(guesser.getByText(/Correct! \+\d+/).first()).toBeVisible();
    progress.set(guesser, n + 1);
    // Turn resolved: the input is disabled (result phase) or gone (game over / opponent's turn).
    await expect.poll(() => input.isEnabled({ timeout: 100 }).catch(() => false), { timeout: 5_000 }).toBe(false);
  }
}

test.describe("Word Duel end-to-end", () => {
  test("two players create, join, build chains, duel and finish", async ({ browser }) => {
    const alice = await newPlayer(browser, "Alice");
    const bob = await newPlayer(browser, "Bob");

    const code = await createRoom(alice.page);
    await bob.page.goto(`/game/${code}`);
    await expect(alice.page.getByText("Bob").first()).toBeVisible();
    await expect(bob.page.getByText("Alice").first()).toBeVisible();

    await alice.page.getByRole("button", { name: "I'm ready" }).click();
    await bob.page.getByRole("button", { name: "I'm ready" }).click();

    await buildChain(alice.page, CHAIN_A);
    await buildChain(bob.page, CHAIN_B);

    // Secret protection, end to end: Bob's hidden words never appear on Alice's screen.
    await expect(alice.page.locator("#guess-input")).toBeAttached({ timeout: 10_000 });
    const aliceText = (await alice.page.locator("body").innerText()).toLowerCase();
    for (const secret of CHAIN_B.slice(1)) expect(aliceText).not.toContain(secret);

    await playOut(alice.page, bob.page);

    const outcome = /You win!|So close!|It's a draw!/;
    await expect(alice.page.getByRole("heading", { name: outcome })).toBeVisible({ timeout: 15_000 });
    await expect(bob.page.getByRole("heading", { name: outcome })).toBeVisible();

    // Rematch flow.
    await alice.page.getByRole("button", { name: "Rematch" }).click();
    await expect(bob.page.getByRole("dialog", { name: /Alice wants a rematch!/ })).toBeVisible();
    await bob.page.getByRole("button", { name: "Accept" }).click();
    await expect(alice.page.getByRole("heading", { name: "Create your chain" })).toBeVisible();
    await expect(bob.page.getByRole("heading", { name: "Create your chain" })).toBeVisible();

    // Profile reflects the finished game.
    await alice.page.goto("/profile");
    await expect(alice.page.getByRole("heading", { name: "Recent matches" })).toBeVisible();
    await expect(alice.page.getByRole("link", { name: /Bob/ })).toBeVisible();

    await alice.context.close();
    await bob.context.close();
  });

  test("a player who refreshes mid-game is restored and the game continues", async ({ browser }) => {
    const alice = await newPlayer(browser, "Alice");
    const bob = await newPlayer(browser, "Bob");
    const code = await createRoom(alice.page);
    await bob.page.goto(`/game/${code}`);
    await alice.page.getByRole("button", { name: "I'm ready" }).click();
    await bob.page.getByRole("button", { name: "I'm ready" }).click();
    await buildChain(alice.page, CHAIN_A);
    await buildChain(bob.page, CHAIN_B);

    await playOut(alice.page, bob.page, { reloadBMidGame: true });
    await expect(bob.page.getByRole("heading", { name: /You win!|So close!|It's a draw!/ })).toBeVisible({ timeout: 15_000 });

    await alice.context.close();
    await bob.context.close();
  });

  test("join screen explains bad codes", async ({ page }) => {
    await page.goto("/join");
    await page.getByLabel("Enter game code").fill("ZZZZZ");
    await page.getByRole("button", { name: /Join game/ }).click();
    await expect(page.locator("#join-error")).toContainText(/couldn't find a game/i);
    await page.getByLabel("Enter game code").fill("AB");
    await page.getByRole("button", { name: /Join game/ }).click();
    await expect(page.locator("#join-error")).toContainText(/5 characters/i);
  });
});
