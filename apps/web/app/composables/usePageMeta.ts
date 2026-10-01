// Title and description for search results and link previews (WhatsApp, Signal, LinkedIn,
// Mastodon read the Open Graph tags; without them they guess from the page).
export function usePageMeta(title: () => string, description: () => string) {
  useSeoMeta({
    title,
    description,
    ogTitle: () => `${title()} · CreteLab`,
    ogDescription: description,
  });
}
