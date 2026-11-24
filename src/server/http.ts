import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./errors";
import { requireUser, type UserContext } from "./auth";
import { Prisma } from "@/generated/prisma/client";

export function checkOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.NEXT_PUBLIC_APP_URL || request.url).origin;
  if (!origin || origin !== expected) throw new AppError(403, "INVALID_ORIGIN", "Permintaan tidak diizinkan.");
}
export async function readJson(request: Request, maxBytes = 256_000): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new AppError(415, "INVALID_CONTENT_TYPE", "Gunakan format JSON.");
  if (Number(request.headers.get("content-length") || 0) > maxBytes) throw new AppError(413, "BODY_TOO_LARGE", "Data terlalu besar.");
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(422, "INVALID_JSON", "Data JSON kosong.");
  const chunks: Uint8Array[] = []; let total = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { await reader.cancel(); throw new AppError(413, "BODY_TOO_LARGE", "Data terlalu besar."); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new AppError(422, "INVALID_JSON", "Format JSON tidak valid."); }
}
export function errorResponse(error: unknown) {
  let failure = error instanceof AppError ? error : new AppError(500, "INTERNAL_ERROR", "Terjadi kesalahan. Silakan coba lagi.");
  if (error instanceof ZodError) failure = new AppError(422, "VALIDATION_ERROR", error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ").slice(0, 1000));
  if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) failure = new AppError(409, "CONFLICT", "Data sudah ada atau telah berubah. Muat ulang dan coba lagi.");
  if (failure.status === 500) console.error("Request failed", { type: error instanceof Error ? error.name : "unknown" });
  return NextResponse.json({ data: null, error: { code: failure.code, message: failure.message } }, { status: failure.status, headers: { "Cache-Control": "private, no-store" } });
}
export async function api(request: Request, action: (user: UserContext) => Promise<unknown>, status = 200) {
  try { checkOrigin(request); const user = await requireUser(); return NextResponse.json({ data: await action(user), error: null }, { status, headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return errorResponse(error); }
}
