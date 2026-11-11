const HTML_ENTITIES: Record<string, string> = {
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  '"': "&quot;",
  "'": "&#39;",
  "/": "&#x2F;",
};

export function escapeHtml(text: string) {
  return text.replace(/[<>&"'\/]/g, (char) => HTML_ENTITIES[char]!);
}
