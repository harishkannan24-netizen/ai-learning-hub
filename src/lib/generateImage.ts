const URL_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`;
const AUTH = `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Generate an image with retry-on-429 + exponential backoff. */
export async function generateImage(prompt: string, maxRetries = 4): Promise<string | null> {
  let delay = 1500;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(URL_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: AUTH },
        body: JSON.stringify({ prompt }),
      });
      if (resp.status === 429) {
        if (attempt === maxRetries) return null;
        await sleep(delay);
        delay *= 2;
        continue;
      }
      if (!resp.ok) return null;
      const data = await resp.json();
      const img = data.images?.[0];
      if (typeof img === "string") return img;
      return img?.image_url?.url || img?.url || null;
    } catch {
      if (attempt === maxRetries) return null;
      await sleep(delay);
      delay *= 2;
    }
  }
  return null;
}

/** Run async tasks sequentially with a small spacing delay to avoid rate limits. */
export async function runSequential<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  spacingMs = 800,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i++) {
    results.push(await fn(items[i], i));
    if (i < items.length - 1) await sleep(spacingMs);
  }
  return results;
}