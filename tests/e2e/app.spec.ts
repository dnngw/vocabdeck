import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { testDb } from "./database";
import { learnerId, otherId, adminId } from "./fixtures";
const db = testDb();
async function login(page: Page, email = "learner@example.test") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("vocabdeck-e2e-password");
  await page.getByRole("button", { name: "Masuk ke Vocabdeck" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
test.beforeEach(async () => {
  await db.profile.update({
    where: { id: learnerId },
    data: { status: "active" },
  });
  await db.deck.deleteMany({
    where: { ownerId: { in: [learnerId, otherId] } },
  });
  await db.userSettings.deleteMany({ where: { userId: learnerId } });
  await db.appSetting.upsert({
    where: { key: "ai_enabled" },
    create: { key: "ai_enabled", value: false, updatedBy: adminId },
    update: { value: false, updatedBy: adminId },
  });
});
test.afterAll(() => db.$disconnect());

test("AI preview stays unsaved until edited selections are explicitly committed", async ({
  page,
}) => {
  const deck = await db.deck.create({
    data: { name: "AI preview", ownerId: learnerId },
  });
  await db.appSetting.update({
    where: { key: "ai_enabled" },
    data: { value: true },
  });
  const items = ["take", "run"].map((word) => ({
    word,
    partOfSpeech: "verb",
    senses: [
      {
        meaningInIndonesian: word === "take" ? "ambil" : "berlari",
        definitionEn: "",
        examples: [
          {
            sentenceEn: word === "take" ? "Take the book." : "I run daily.",
            translationInIndonesian: "",
            contextExplanationInIndonesian: "",
          },
        ],
      },
    ],
  }));
  // Only generation transport is stubbed. Preview validation and saving use the
  // real authorized API/database; provider/quota behavior has integration tests.
  await page.route("**/api/ai/generate", (route) =>
    route.fulfill({ json: { data: { items, remaining: 9 }, error: null } }),
  );
  await login(page);
  await page.goto(`/ai/generate?deckId=${deck.id}`);
  await page.getByLabel("Buat dari").selectOption("topic");
  await page
    .getByLabel("Topik yang ingin dipahami")
    .fill("Everyday activities");
  await page.getByRole("button", { name: "Buat preview" }).click();
  await expect(
    page.getByRole("heading", { name: "Periksa pilihanmu" }),
  ).toBeVisible();
  expect(await db.vocabularyEntry.count({ where: { deckId: deck.id } })).toBe(
    0,
  );
  await page.getByRole("checkbox", { name: "Pilih “run”" }).uncheck();
  await page
    .getByText("Edit kata dan konteks", { exact: true })
    .first()
    .click();
  await page
    .getByLabel("Makna dalam bahasa Indonesia")
    .first()
    .fill("mengambil");
  await page
    .getByRole("button", { name: "Periksa validasi dan duplikat" })
    .click();
  await page.getByRole("button", { name: "Simpan 1 kata terpilih" }).click();
  await expect(
    page.getByRole("heading", { name: "Pilihanmu sudah tersimpan" }),
  ).toBeVisible();
  const entries = await db.vocabularyEntry.findMany({
    where: { deckId: deck.id },
    include: { senses: true },
  });
  expect(entries).toHaveLength(1);
  expect(entries[0].senses[0].meaningInIndonesian).toBe("mengambil");
  await noOverflow(page);
});

test("public pages have no signup and private routes require login", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Pahami konteksnya/ }),
  ).toBeVisible();
  await noOverflow(page);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("link", { name: /daftar|register|sign up/i }),
  ).toHaveCount(0);
  expect((await page.request.get("/api/decks")).status()).toBe(401);
  expect(
    (
      await page.request.post("/api/auth/signup", {
        headers: { Origin: "http://localhost:3100" },
        data: {},
      })
    ).status(),
  ).toBe(404);
});
test("create multiple meanings, review, reload and preserve independent schedules", async ({
  page,
}) => {
  await login(page);
  await page.goto("/decks");
  await page.getByRole("button", { name: "Buat deck", exact: true }).click();
  await page.getByLabel("Nama deck", { exact: true }).fill("Everyday English");
  await page.getByRole("button", { name: "Simpan deck" }).click();
  await expect(page).toHaveURL(/\/decks\/[a-f0-9-]+$/);
  const deckUrl = page.url();
  await page.getByRole("link", { name: "Tambah kata", exact: true }).click();
  await page.getByLabel("Kata atau frasa Inggris").fill("take");
  await page.getByLabel("Jenis kata").fill("verb");
  await page.getByLabel("Makna dalam bahasa Indonesia").fill("mengambil");
  await page
    .getByLabel("Kalimat bahasa Inggris", { exact: true })
    .fill("Take this book.");
  await page.getByRole("button", { name: "Tambah makna" }).click();
  await page
    .getByLabel("Makna dalam bahasa Indonesia")
    .nth(1)
    .fill("membutuhkan waktu");
  await page
    .getByLabel("Kalimat bahasa Inggris", { exact: true })
    .nth(1)
    .fill("It takes two hours.");
  await page.getByRole("button", { name: "Periksa kartu" }).click();
  await expect(
    page.getByRole("heading", { name: "mengambil", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Simpan vocabulary" }).click();
  await expect(page).toHaveURL(/\/vocabulary\/[a-f0-9-]+$/);
  await page.goto(deckUrl);
  await page.getByRole("link", { name: "Belajar deck ini" }).click();
  await expect(page.getByRole("button", { name: /Good/ })).toHaveCount(0);
  await page.getByRole("button", { name: /Tampilkan jawaban/ }).click();
  await expect(
    page.getByRole("heading", { name: "mengambil", exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await page.getByRole("button", { name: /Easy/ }).click();
  await expect(
    page.getByText("1 jawaban tersimpan", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("“It takes two hours.”", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Tampilkan jawaban/ }).click();
  await expect(
    page.getByRole("heading", { name: "membutuhkan waktu", exact: true }),
  ).toBeVisible();
  const progress = await db.cardProgress.findMany({
    where: { userId: learnerId },
    orderBy: { version: "desc" },
  });
  expect(progress.map((p) => p.version)).toEqual([1, 0]);
  expect(await db.reviewLog.count({ where: { userId: learnerId } })).toBe(1);
  await page.screenshot({
    path: `test-results/study-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("CSV preview does not write; import works while AI is disabled", async ({
  page,
}) => {
  const deck = await db.deck.create({
    data: { name: "CSV deck", ownerId: learnerId },
  });
  await login(page);
  await page.goto(`/decks/${deck.id}/import`);
  await page.getByLabel(/File CSV/).setInputFiles({
    name: "words.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "word,meaning_indonesian,sentence_en\nrun,berlari,I run every morning.\nrun,,It runs well.",
    ),
  });
  await page.getByRole("button", { name: "Periksa CSV" }).click();
  await expect(
    page.getByRole("heading", { name: "Preview impor" }),
  ).toBeVisible();
  expect(await db.vocabularyEntry.count({ where: { deckId: deck.id } })).toBe(
    0,
  );
  await page.getByRole("button", { name: "Impor 1 baris terpilih" }).click();
  await expect(
    page.getByRole("heading", { name: "Impor selesai" }),
  ).toBeVisible();
  await page.goto(`/ai/generate?deckId=${deck.id}`);
  await expect(
    page.getByRole("button", { name: "Buat preview" }),
  ).toBeDisabled();
  expect(await db.vocabularyEntry.count({ where: { deckId: deck.id } })).toBe(
    1,
  );
  await noOverflow(page);
});
test("suspension blocks a still-valid browser session and cross-tenant access fails", async ({
  page,
}) => {
  const other = await db.deck.create({
    data: { id: randomUUID(), name: "Private other deck", ownerId: otherId },
  });
  await login(page);
  expect((await page.request.get(`/api/decks/${other.id}`)).status()).toBe(404);
  expect((await page.request.get("/api/admin/users")).status()).toBe(403);
  expect(
    (
      await page.request.post("/api/decks", {
        headers: { Origin: "https://untrusted.example" },
        data: { name: "attack" },
      })
    ).status(),
  ).toBe(403);
  await db.profile.update({
    where: { id: learnerId },
    data: { status: "suspended" },
  });
  expect((await page.request.get("/api/decks")).status()).toBe(403);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?error=inactive$/);
});
