export type RichButton = {
  text: string;
  data?: string;
  url?: string;
};

function attribute(attributes: string, name: string): string | undefined {
  const match = attributes.match(new RegExp(`\\b${name}="([^"]*)"`));

  return match?.[1];
}

/** Parses the inline buttons embedded in a rich message's HTML. */
export function parseRichButtons(html: string): RichButton[] {
  return Array.from(
    html.matchAll(/<tg-button(?=\s|>)([^>]*)>([\s\S]*?)<\/tg-button>/g),
    (match) => ({
      text: match[2] ?? "",
      data: attribute(match[1] ?? "", "data"),
      url: attribute(match[1] ?? "", "url"),
    }),
  );
}
