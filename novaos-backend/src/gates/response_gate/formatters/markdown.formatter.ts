// ═══════════════════════════════════════════════════════════════════════════════
// MARKDOWN FORMATTER
// Converts markdown to clean formatting for all providers
// ═══════════════════════════════════════════════════════════════════════════════

export function formatOutput(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')              // **bold** → bold
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1')   // *italic* → italic (not at line start)
    .replace(/^###\s*(.+)$/gm, '$1:')               // ### Header → Header:
    .replace(/^##\s*(.+)$/gm, '$1:')                // ## Header → Header:
    .replace(/^#\s*(.+)$/gm, '$1:')                 // # Header → Header:
    .replace(/`([^`]+)`/g, '$1')                    // `code` → code
    .replace(/^(\s*)[-*]\s+/gm, '$1• ');            // - item OR * item → • item
}
