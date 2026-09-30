// Sends a description to the Laya service. Results are cached per text for the tab, so
// going back to a page or reloading it does not ask the model again.
import type { AnalysisResponse } from '@cretelab/engine';

const CACHE_KEY = 'cretelab:analysis';

function readCache(): Record<string, AnalysisResponse> {
  try {
    return JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeCache(text: string, result: AnalysisResponse) {
  try {
    // Keep the last few descriptions only.
    const entries = Object.entries(readCache()).filter(([t]) => t !== text).slice(-9);
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries([...entries, [text, result]])));
  } catch {
    // Storage blocked: the page still works, it just asks again next time.
  }
}

export function cachedAnalysis(text: string): AnalysisResponse | undefined {
  return import.meta.client ? readCache()[text] : undefined;
}

export function useAnalysis() {
  const { apiBase } = useRuntimeConfig().public;
  const busy = ref(false);
  const error = ref<string | null>(null);

  async function analyse(text: string): Promise<AnalysisResponse | null> {
    error.value = null;
    const cached = cachedAnalysis(text);
    if (cached) return cached;
    busy.value = true;
    try {
      const result = await $fetch<AnalysisResponse>(`${apiBase}/describe`, { method: 'POST', body: { text } });
      writeCache(text, result);
      return result;
    } catch (e: unknown) {
      const status = (e as { statusCode?: number }).statusCode;
      // Rate limit (nginx) or all model slots taken (API): ask to try again, no status code.
      // A gateway timeout means the model took too long.
      error.value =
        status === 429 || status === 503 ? 'busy' : status === 504 ? 'timeout' : status ? `HTTP ${status}` : 'offline';
      return null;
    } finally {
      busy.value = false;
    }
  }

  return { analyse, busy: readonly(busy), error: readonly(error) };
}
