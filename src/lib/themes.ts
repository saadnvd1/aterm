export interface Theme {
  id: string;
  name: string;
  colors: {
    // Base
    bg: string;
    bgSecondary: string;
    bgTertiary: string;
    border: string;
    borderSubtle: string;

    // Text
    text: string;
    textMuted: string;
    textSubtle: string;

    // Accents
    accent: string;
    accentHover: string;
    accentMuted: string;

    // Status
    success: string;
    warning: string;
    error: string;

    // Terminal
    terminalBg: string;
    terminalText: string;
    terminalCursor: string;
  };
  terminal: {
    fontFamily: string;
    fontSize: number;
    theme: {
      background: string;
      foreground: string;
      cursor: string;
      cursorAccent: string;
      selectionBackground: string;
      black: string;
      red: string;
      green: string;
      yellow: string;
      blue: string;
      magenta: string;
      cyan: string;
      white: string;
      brightBlack: string;
      brightRed: string;
      brightGreen: string;
      brightYellow: string;
      brightBlue: string;
      brightMagenta: string;
      brightCyan: string;
      brightWhite: string;
    };
  };
}

export const themes: Record<string, Theme> = {
  midnight: {
    id: "midnight",
    name: "Midnight",
    colors: {
      bg: "#0a0a0f",
      bgSecondary: "#12121a",
      bgTertiary: "#1a1a24",
      border: "#2a2a3a",
      borderSubtle: "#1f1f2a",
      text: "#e4e4e8",
      textMuted: "#8888a0",
      textSubtle: "#55556a",
      accent: "#7c5cff",
      accentHover: "#9070ff",
      accentMuted: "#4a3a80",
      success: "#50fa7b",
      warning: "#f1fa8c",
      error: "#ff5555",
      terminalBg: "#0a0a0f",
      terminalText: "#e4e4e8",
      terminalCursor: "#7c5cff",
    },
    terminal: {
      fontFamily: "JetBrains Mono, Menlo, Monaco, 'Courier New', monospace",
      fontSize: 13,
      theme: {
        background: "#0a0a0f",
        foreground: "#e4e4e8",
        cursor: "#7c5cff",
        cursorAccent: "#0a0a0f",
        selectionBackground: "#3a3a5a",
        black: "#0a0a0f",
        red: "#ff5555",
        green: "#50fa7b",
        yellow: "#f1fa8c",
        blue: "#7c5cff",
        magenta: "#ff79c6",
        cyan: "#8be9fd",
        white: "#e4e4e8",
        brightBlack: "#55556a",
        brightRed: "#ff6e6e",
        brightGreen: "#69ff94",
        brightYellow: "#ffffa5",
        brightBlue: "#9580ff",
        brightMagenta: "#ff92df",
        brightCyan: "#a4ffff",
        brightWhite: "#ffffff",
      },
    },
  },

  dracula: {
    id: "dracula",
    name: "Dracula",
    colors: {
      bg: "#282a36",
      bgSecondary: "#21222c",
      bgTertiary: "#343746",
      border: "#44475a",
      borderSubtle: "#383a4a",
      text: "#f8f8f2",
      textMuted: "#6272a4",
      textSubtle: "#44475a",
      accent: "#bd93f9",
      accentHover: "#caa4ff",
      accentMuted: "#6d5a9a",
      success: "#50fa7b",
      warning: "#f1fa8c",
      error: "#ff5555",
      terminalBg: "#282a36",
      terminalText: "#f8f8f2",
      terminalCursor: "#f8f8f2",
    },
    terminal: {
      fontFamily: "JetBrains Mono, Menlo, Monaco, 'Courier New', monospace",
      fontSize: 13,
      theme: {
        background: "#282a36",
        foreground: "#f8f8f2",
        cursor: "#f8f8f2",
        cursorAccent: "#282a36",
        selectionBackground: "#44475a",
        black: "#21222c",
        red: "#ff5555",
        green: "#50fa7b",
        yellow: "#f1fa8c",
        blue: "#bd93f9",
        magenta: "#ff79c6",
        cyan: "#8be9fd",
        white: "#f8f8f2",
        brightBlack: "#6272a4",
        brightRed: "#ff6e6e",
        brightGreen: "#69ff94",
        brightYellow: "#ffffa5",
        brightBlue: "#d6acff",
        brightMagenta: "#ff92df",
        brightCyan: "#a4ffff",
        brightWhite: "#ffffff",
      },
    },
  },

  nord: {
    id: "nord",
    name: "Nord",
    colors: {
      bg: "#2e3440",
      bgSecondary: "#272c36",
      bgTertiary: "#3b4252",
      border: "#4c566a",
      borderSubtle: "#434c5e",
      text: "#eceff4",
      textMuted: "#8990a0",
      textSubtle: "#616e88",
      accent: "#88c0d0",
      accentHover: "#9dd0e0",
      accentMuted: "#5e8a94",
      success: "#a3be8c",
      warning: "#ebcb8b",
      error: "#bf616a",
      terminalBg: "#2e3440",
      terminalText: "#eceff4",
      terminalCursor: "#eceff4",
    },
    terminal: {
      fontFamily: "JetBrains Mono, Menlo, Monaco, 'Courier New', monospace",
      fontSize: 13,
      theme: {
        background: "#2e3440",
        foreground: "#eceff4",
        cursor: "#eceff4",
        cursorAccent: "#2e3440",
        selectionBackground: "#434c5e",
        black: "#3b4252",
        red: "#bf616a",
        green: "#a3be8c",
        yellow: "#ebcb8b",
        blue: "#81a1c1",
        magenta: "#b48ead",
        cyan: "#88c0d0",
        white: "#e5e9f0",
        brightBlack: "#4c566a",
        brightRed: "#bf616a",
        brightGreen: "#a3be8c",
        brightYellow: "#ebcb8b",
        brightBlue: "#81a1c1",
        brightMagenta: "#b48ead",
        brightCyan: "#8fbcbb",
        brightWhite: "#eceff4",
      },
    },
  },

  tokyoNight: {
    id: "tokyoNight",
    name: "Tokyo Night",
    colors: {
      bg: "#1a1b26",
      bgSecondary: "#16161e",
      bgTertiary: "#24283b",
      border: "#3b4261",
      borderSubtle: "#292e42",
      text: "#c0caf5",
      textMuted: "#565f89",
      textSubtle: "#414868",
      accent: "#7aa2f7",
      accentHover: "#89b4fa",
      accentMuted: "#4a5a8a",
      success: "#9ece6a",
      warning: "#e0af68",
      error: "#f7768e",
      terminalBg: "#1a1b26",
      terminalText: "#c0caf5",
      terminalCursor: "#c0caf5",
    },
    terminal: {
      fontFamily: "JetBrains Mono, Menlo, Monaco, 'Courier New', monospace",
      fontSize: 13,
      theme: {
        background: "#1a1b26",
        foreground: "#c0caf5",
        cursor: "#c0caf5",
        cursorAccent: "#1a1b26",
        selectionBackground: "#33467c",
        black: "#15161e",
        red: "#f7768e",
        green: "#9ece6a",
        yellow: "#e0af68",
        blue: "#7aa2f7",
        magenta: "#bb9af7",
        cyan: "#7dcfff",
        white: "#a9b1d6",
        brightBlack: "#414868",
        brightRed: "#f7768e",
        brightGreen: "#9ece6a",
        brightYellow: "#e0af68",
        brightBlue: "#7aa2f7",
        brightMagenta: "#bb9af7",
        brightCyan: "#7dcfff",
        brightWhite: "#c0caf5",
      },
    },
  },

  gruvbox: {
    id: "gruvbox",
    name: "Gruvbox Dark",
    colors: {
      bg: "#1d2021",
      bgSecondary: "#282828",
      bgTertiary: "#3c3836",
      border: "#504945",
      borderSubtle: "#3c3836",
      text: "#ebdbb2",
      textMuted: "#928374",
      textSubtle: "#665c54",
      accent: "#fe8019",
      accentHover: "#fabd2f",
      accentMuted: "#8a5a2a",
      success: "#b8bb26",
      warning: "#fabd2f",
      error: "#fb4934",
      terminalBg: "#1d2021",
      terminalText: "#ebdbb2",
      terminalCursor: "#ebdbb2",
    },
    terminal: {
      fontFamily: "JetBrains Mono, Menlo, Monaco, 'Courier New', monospace",
      fontSize: 13,
      theme: {
        background: "#1d2021",
        foreground: "#ebdbb2",
        cursor: "#ebdbb2",
        cursorAccent: "#1d2021",
        selectionBackground: "#504945",
        black: "#282828",
        red: "#cc241d",
        green: "#98971a",
        yellow: "#d79921",
        blue: "#458588",
        magenta: "#b16286",
        cyan: "#689d6a",
        white: "#a89984",
        brightBlack: "#928374",
        brightRed: "#fb4934",
        brightGreen: "#b8bb26",
        brightYellow: "#fabd2f",
        brightBlue: "#83a598",
        brightMagenta: "#d3869b",
        brightCyan: "#8ec07c",
        brightWhite: "#ebdbb2",
      },
    },
  },
};

export const DEFAULT_THEME = "dracula";

export function getTheme(themeId: string): Theme {
  return themes[themeId] || themes[DEFAULT_THEME];
}

export function getThemeList(): Theme[] {
  return Object.values(themes);
}
