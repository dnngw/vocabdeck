import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "./auth";
import { AppError } from "./errors";
export const pageUser = cache(async () => {
  try {
    return await requireUser();
  } catch (error) {
    if (error instanceof AppError && error.status === 403)
      redirect("/login?error=inactive");
    if (error instanceof AppError && [401, 503].includes(error.status))
      redirect("/login");
    throw error;
  }
});
export async function pageData<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}
