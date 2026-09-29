// Two-way binding between a page's state and its URL query (see utils/query.ts).
import type { LocationQuery } from 'vue-router';
import type { Query } from '~/utils/query';

const same = (a: Record<string, unknown>, b: Record<string, unknown>) => JSON.stringify(a) === JSON.stringify(b);

function normalise(q: LocationQuery): Record<string, string> {
  return Object.fromEntries(
    Object.entries(q)
      .map(([k, v]) => [k, Array.isArray(v) ? v[0] : v] as const)
      .filter((e): e is [string, string] => typeof e[1] === 'string')
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

/**
 * State decoded from the URL; every change is written back with `router.replace`, so a
 * reload or a shared link shows the same page. Navigating (back button, a link) re-reads it.
 */
export function useUrlState<T extends object>(decode: (q: Query) => T, encode: (s: T) => Record<string, string>) {
  const route = useRoute();
  const router = useRouter();
  const state = ref(decode(route.query)) as Ref<T>;

  watch(
    state,
    (s) => {
      const next = normalise(encode(s));
      if (!same(next, normalise(route.query))) router.replace({ query: next });
    },
    { deep: true },
  );

  watch(
    () => route.query,
    (q) => {
      if (!same(normalise(q), normalise(encode(state.value)))) state.value = decode(q);
    },
  );

  /** Replace the whole state, e.g. after a new description was analysed. */
  function reset(next: T) {
    state.value = next;
  }

  return { state, reset };
}
