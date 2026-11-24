export async function apiFetch<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.error)
    throw new Error(
      result?.error?.message || "Koneksi terputus. Silakan coba lagi.",
    );
  return result.data as T;
}
