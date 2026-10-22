import type { Logger } from "pino";

export async function pingOnce(url: string, fetchFn: typeof fetch = fetch, timeoutMs = 10_000): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export interface KeepAliveOptions {
  url: string; // public base URL of this service
  log: Logger;
  intervalMs?: number; // Render Free sleeps after ~15 min idle; default 10 min
  fetchFn?: typeof fetch;
}

/** Owner-requested self-ping of GET /health through the public URL so the free instance stays awake. */
export function startKeepAlive(o: KeepAliveOptions): () => void {
  const target = o.url.replace(/\/+$/, "") + "/health";
  let fails = 0;
  const run = async () => {
    if (await pingOnce(target, o.fetchFn)) {
      fails = 0;
    } else {
      fails++;
      if (fails === 1 || fails % 6 === 0) o.log.warn({ fails }, "keep-alive ping failed");
    }
  };
  const timer = setInterval(run, o.intervalMs ?? 10 * 60 * 1000);
  timer.unref();
  o.log.info({ everyMinutes: (o.intervalMs ?? 600_000) / 60_000 }, "keep-alive enabled");
  return () => clearInterval(timer);
}
