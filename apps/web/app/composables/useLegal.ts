// The operator's details for the legal notice and the privacy policy. They come from the
// environment at build time (.env, see .env.example) and are never part of the repository.
export function useLegal() {
  const legal = useRuntimeConfig().public.legal as Record<string, string>;
  const configured = Boolean(legal.name && legal.street && legal.city);
  return { legal, configured };
}
