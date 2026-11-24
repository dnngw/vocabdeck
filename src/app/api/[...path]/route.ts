import { z } from "zod";
import { getDb } from "@/lib/db";
import { idSchema } from "@/lib/validation";
import { api, readJson } from "@/server/http";
import { AppError } from "@/server/errors";
import { ContentService } from "@/server/content";
import { ImportService } from "@/server/import";
import { StudyService } from "@/server/study";
import { StatisticsService } from "@/server/statistics";
import { AIService, aiLimits, aiProvider } from "@/server/ai";
import { AdminService } from "@/server/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  return api(request, async (user) => {
    const { path } = await context.params;
    const route = path.join("/");
    const method = request.method;
    const db = getDb();
    const content = new ContentService(db);
    const study = new StudyService(db);
    if (route === "decks") {
      if (method === "GET") return content.listDecks(user);
      if (method === "POST")
        return content.createDeck(user, await readJson(request));
    }
    if (path[0] === "decks" && path.length === 2) {
      const id = idSchema.parse(path[1]);
      if (method === "GET")
        return content.getDeck(
          user,
          id,
          new URL(request.url).searchParams.get("q") || "",
        );
      if (method === "PATCH")
        return content.updateDeck(user, id, await readJson(request));
      if (method === "DELETE") return content.deleteDeck(user, id);
    }
    if (path[0] === "decks" && path[2] === "vocabulary" && path.length === 3) {
      const id = idSchema.parse(path[1]);
      if (method === "GET")
        return (
          await content.getDeck(
            user,
            id,
            new URL(request.url).searchParams.get("q") || "",
          )
        ).vocabulary;
      if (method === "POST") {
        const body = z
          .object({
            items: z.array(z.unknown()).min(1).max(20),
            source: z.enum(["manual", "ai"]).default("manual"),
          })
          .parse(await readJson(request, 1_000_000));
        return content.addBatch(user, id, body.items, body.source);
      }
    }
    if (path[0] === "vocabulary" && path.length === 2) {
      const id = idSchema.parse(path[1]);
      if (method === "GET") return content.getVocabulary(user, id);
      if (method === "PATCH")
        return content.updateVocabulary(user, id, await readJson(request));
      if (method === "DELETE") return content.deleteVocabulary(user, id);
    }
    if (route === "import/csv/preview" && method === "POST")
      return new ImportService(db).preview(
        user,
        await readJson(request, 1_100_000),
      );
    if (route === "import/csv/commit" && method === "POST")
      return new ImportService(db).commit(
        user,
        await readJson(request, 1_100_000),
      );
    if (route === "study/queue" && method === "GET") {
      const deckId = new URL(request.url).searchParams.get("deckId");
      return study.queue(user, deckId ? idSchema.parse(deckId) : undefined);
    }
    if (route === "study/review" && method === "POST")
      return study.review(user, await readJson(request));
    if (route === "statistics/summary" && method === "GET")
      return new StatisticsService(db).summary(user);
    if (route === "settings") {
      if (method === "GET") return study.settings(user);
      if (method === "PATCH")
        return study.updateSettings(user, await readJson(request));
    }
    if (route === "ai/generate" && method === "POST") {
      const limits = aiLimits();
      if (!limits.enabled)
        throw new AppError(
          503,
          "AI_DISABLED",
          "AI belum diaktifkan oleh pengelola. Input manual dan CSV tetap tersedia.",
        );
      return new AIService(db, aiProvider(), limits).generate(
        user,
        await readJson(request, 16_000),
      );
    }
    if (route === "ai/preview" && method === "POST") {
      const input = z
        .object({
          deckId: idSchema,
          items: z.array(z.unknown()).min(1).max(20),
        })
        .parse(await readJson(request, 1_000_000));
      return content.previewBatch(user, input.deckId, input.items);
    }
    if (route === "admin/users" && method === "GET")
      return new AdminService(db).users(user);
    if (
      path[0] === "admin" &&
      path[1] === "users" &&
      path.length === 3 &&
      method === "PATCH"
    )
      return new AdminService(db).setStatus(
        user,
        idSchema.parse(path[2]),
        await readJson(request),
      );
    if (route === "admin/usage" && method === "GET")
      return new AdminService(db).usage(user);
    if (route === "admin/settings" && method === "PATCH")
      return new AdminService(db).updateAi(user, await readJson(request));
    throw new AppError(404, "NOT_FOUND", "Endpoint tidak ditemukan.");
  });
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
