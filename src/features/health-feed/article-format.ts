export type HealthArticle = {
  id: string;
  title: string;
  summary: string;
  body: string;
  checklist: string[];
  content_type: string;
  severity_level?: string;
  is_saved: boolean;
  saveable: boolean;
  shareable: boolean;
  localOnly?: boolean;
};
export type ArticleBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string; level: 2 | 3 }
  | { type: "list"; ordered: boolean; ordinals: number[]; items: string[] };

export function normalizeHealthArticle(value: unknown): HealthArticle | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== "string" ||
    typeof item.title !== "string" ||
    !item.title.trim()
  )
    return null;
  return {
    id: item.id,
    title: item.title.trim(),
    summary: typeof item.summary === "string" ? item.summary.trim() : "",
    body: typeof item.body === "string" ? item.body.trim() : "",
    checklist: Array.isArray(item.checklist)
      ? item.checklist
          .filter(
            (text): text is string =>
              typeof text === "string" && Boolean(text.trim())
          )
          .map((text) => text.trim())
      : [],
    content_type:
      typeof item.content_type === "string" ? item.content_type : "advice",
    severity_level:
      typeof item.severity_level === "string" ? item.severity_level : undefined,
    is_saved: item.is_saved === true,
    saveable: item.saveable !== false,
    shareable: item.shareable !== false,
  };
}

/** Format explicit structure only; preserve the supplied medical statements. */
export function articleBlocks(body: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  let paragraph: string[] = [];
  let list: Extract<ArticleBlock, { type: "list" }> | null = null;
  const flush = () => {
    if (paragraph.length)
      blocks.push({ type: "paragraph", text: paragraph.join(" ") });
    if (list) blocks.push(list);
    paragraph = [];
    list = null;
  };
  for (const raw of body.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = /^(#{1,6})\s+(.+?)\s*#*$/.exec(line);
    const boldHeading = /^\*\*([^*]+)\*\*$/.exec(line);
    if (heading || boldHeading) {
      flush();
      blocks.push({
        type: "heading",
        text: heading ? heading[2] : boldHeading![1],
        level: heading && heading[1].length >= 3 ? 3 : 2,
      });
      continue;
    }
    const bullet = /^(?:([-*•])\s+|(\d+)[.)]\s+)(.+)$/.exec(line);
    if (bullet) {
      const ordered = Boolean(bullet[2]);
      if (paragraph.length || (list && list.ordered !== ordered)) flush();
      list ||= {
        type: "list",
        ordered,
        ordinals: [],
        items: [],
      };
      list.items.push(bullet[3]);
      if (ordered) list.ordinals.push(Number(bullet[2]));
    } else if (list && /^\s{2,}/.test(raw))
      list.items[list.items.length - 1] += ` ${line}`;
    else {
      if (list) flush();
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}
export const articlePlainText = (text: string) =>
  text.replace(/\*\*([^*]+)\*\*/g, "$1");
export function articleReadingMinutes(article: HealthArticle): number {
  const text = [
    article.title,
    article.summary,
    article.body,
    ...article.checklist,
  ].join(" ");
  return Math.max(1, Math.ceil(text.trim().split(/\s+/).length / 220));
}
export function articleChecklistHeading(type: string): string {
  return type === "warning"
    ? "feedArticleWarningPoints"
    : type === "family_note"
    ? "feedArticleFamilyPoints"
    : "feedArticleTakeaways";
}
export function articleCategory(type: string): string {
  return type === "warning"
    ? "feedArticleCategoryWarning"
    : type === "family_note"
    ? "feedArticleCategoryFamily"
    : type === "checklist"
    ? "feedArticleCategoryChecklist"
    : "feedArticleCategoryAdvice";
}
export function articleShareText(
  article: HealthArticle,
  t: (key: string) => string
): string {
  const parts = [article.title, article.summary];
  for (const block of articleBlocks(article.body)) {
    if (block.type === "list")
      parts.push(
        block.items
          .map(
            (item, index) =>
              `${
                block.ordered ? `${block.ordinals[index]}.` : "•"
              } ${articlePlainText(item)}`
          )
          .join("\n")
      );
    else if (block.text !== article.summary)
      parts.push(articlePlainText(block.text));
  }
  if (article.checklist.length) {
    parts.push(t(articleChecklistHeading(article.content_type)));
    parts.push(
      article.checklist
        .map((item, index) => `${index + 1}. ${articlePlainText(item)}`)
        .join("\n")
    );
  }
  parts.push(t("feedShareFooter"));
  return parts.filter(Boolean).join("\n\n");
}
export function bundledHealthArticle(
  id: string,
  t: (key: string) => string
): HealthArticle | null {
  const match = /^curated-([1-5])$/.exec(id);
  if (!match) return null;
  const number = match[1];
  return {
    id,
    title: t(`feedCurated${number}Title`),
    summary: t(`feedCurated${number}Summary`),
    body: t(`feedCurated${number}Body`),
    checklist:
      number === "2" || number === "5"
        ? Array.from({ length: 5 }, (_, index) =>
            t(`feedCurated${number}Item${index + 1}`)
          )
        : [],
    content_type:
      number === "2" ? "checklist" : number === "5" ? "warning" : "family_note",
    is_saved: false,
    saveable: false,
    shareable: true,
    localOnly: true,
  };
}
