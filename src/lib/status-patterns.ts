/**
 * Status Detection Patterns
 *
 * Detection patterns for determining terminal session status.
 * Based on agent-os patterns.
 */

// Spinner characters used by Claude Code and other AI tools
export const SPINNER_CHARS = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// Text indicators that Claude Code is actively running
export const BUSY_INDICATORS = [
  "esc to interrupt",
  "(esc to interrupt)",
  "· esc to interrupt",
];

// Whimsical words Claude Code uses with spinners
export const WHIMSICAL_WORDS = [
  "accomplishing", "actioning", "actualizing", "baking", "booping", "brewing",
  "calculating", "cerebrating", "channelling", "churning", "clauding", "coalescing",
  "cogitating", "combobulating", "computing", "concocting", "conjuring", "considering",
  "contemplating", "cooking", "crafting", "creating", "crunching", "deciphering",
  "deliberating", "determining", "discombobulating", "divining", "doing", "effecting",
  "elucidating", "enchanting", "envisioning", "finagling", "flibbertigibbeting",
  "forging", "forming", "frolicking", "generating", "germinating", "hatching",
  "herding", "honking", "hustling", "ideating", "imagining", "incubating", "inferring",
  "jiving", "manifesting", "marinating", "meandering", "moseying", "mulling",
  "mustering", "musing", "noodling", "percolating", "perusing", "philosophising",
  "pondering", "pontificating", "processing", "puttering", "puzzling", "reticulating",
  "ruminating", "scheming", "schlepping", "shimmying", "shucking", "simmering",
  "smooshing", "spelunking", "spinning", "stewing", "sussing", "synthesizing",
  "thinking", "tinkering", "transmuting", "unfurling", "unravelling", "vibing",
  "wandering", "whirring", "wibbling", "wizarding", "working", "wrangling",
];

// Patterns that indicate waiting for user input
export const WAITING_PATTERNS = [
  /\[Y\/n\]/i,
  /\[y\/N\]/i,
  /Allow\?/i,
  /Approve\?/i,
  /Continue\?/i,
  /Press Enter to/i,
  /waiting for input/i,
  /\(yes\/no\)/i,
  /Do you want to/i,
  /Enter to confirm.*Esc to cancel/i,
  />\s*1\.\s*Yes/,
  /Yes, allow all/i,
  /allow all edits/i,
  /allow all commands/i,
  /accept edits on/i,  // Claude Code diff acceptance prompt
  /shift\+tab to cycle/i,  // Claude Code diff cycling
];

/**
 * Check if content contains busy indicators (running status)
 * Only checks last 10 lines to avoid false positives from scrollback
 */
export function checkBusyIndicators(content: string): boolean {
  const lines = content.split("\n");
  const recentContent = lines.slice(-10).join("\n").toLowerCase();
  const recentContentOriginal = lines.slice(-10).join("\n"); // Keep original case for some checks

  // Check text indicators
  if (BUSY_INDICATORS.some((ind) => recentContent.includes(ind))) {
    return true;
  }

  // Check whimsical words + "tokens" pattern (Claude Code specific)
  if (
    recentContent.includes("tokens") &&
    WHIMSICAL_WORDS.some((w) => recentContent.includes(w))
  ) {
    return true;
  }

  // Check for new Claude Code format: "· Swirling…" (dot + whimsical word + ellipsis)
  // Pattern: · followed by capitalized whimsical word and ellipsis
  if (WHIMSICAL_WORDS.some((w) => {
    const capitalized = w.charAt(0).toUpperCase() + w.slice(1);
    return recentContentOriginal.includes(`· ${capitalized}…`) ||
           recentContentOriginal.includes(`${capitalized}…`);
  })) {
    return true;
  }

  // Check spinners in last 5 lines
  const last5 = lines.slice(-5).join("");
  if (SPINNER_CHARS.some((s) => last5.includes(s))) {
    return true;
  }

  return false;
}

/**
 * Check if content contains waiting patterns (needs user input)
 * Only checks last 5 lines
 */
export function checkWaitingPatterns(content: string): boolean {
  const recentLines = content.split("\n").slice(-5).join("\n");
  return WAITING_PATTERNS.some((p) => p.test(recentLines));
}
