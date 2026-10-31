const MAX_BASE_LENGTH = 60;

/** URL-friendly, accent-free slug with a random suffix to keep it unique (e.g. "sertanejo-sexta-ab12"). */
export function slugFromTitle(title: string, suffix: string): string {

  const withoutAccents: string = title.normalize("NFD").replace(/[̀-ͯ]/g, "");

  const base: string = withoutAccents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_BASE_LENGTH);

  return base.length > 0 ? `${base}-${suffix}` : suffix;
}
