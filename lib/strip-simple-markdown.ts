/**
 * Plain-text display for chat bubbles: removes common markdown tokens
 * so models can still emit markdown without showing **, #, etc. to users.
 */
export function stripSimpleMarkdownForDisplay(text: string): string {
  let s = text

  // Bold **text** and __text__
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1")
  s = s.replace(/__([^_]+)__/g, "$1")
  // Remaining stray doubled markers
  s = s.replace(/\*\*/g, "")
  s = s.replace(/__/g, "")

  // ATX headings at line start (# …)
  s = s.replace(/^[ \t]*#{1,6}[ \t]+/gm, "")

  // Inline `code`
  s = s.replace(/`([^`]+)`/g, "$1")

  // Links [label](url) → label
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")

  return s
}
