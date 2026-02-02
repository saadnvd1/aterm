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

  oneDark: {
    id: "oneDark",
    name: "One Dark",
    colors: {
      bg: "#21252b",
      bgSecondary: "#282c34",
      bgTertiary: "#2c323c",
      border: "#3e4451",
      borderSubtle: "#353b45",
      text: "#abb2bf",
      textMuted: "#5c6370",
      textSubtle: "#4b5263",
      accent: "#61afef",
      accentHover: "#74b9f0",
      accentMuted: "#3a6a8f",
      success: "#98c379",
      warning: "#e5c07b",
      error: "#e06c75",
      terminalBg: "#21252b",
      terminalText: "#abb2bf",
      terminalCursor: "#528bff",
    },
    terminal: {
      fontFamily: "JetBrains Mono, Menlo, Monaco, 'Courier New', monospace",
      fontSize: 13,
      theme: {
        background: "#21252b",
        foreground: "#abb2bf",
        cursor: "#528bff",
        cursorAccent: "#21252b",
        selectionBackground: "#3e4451",
        black: "#1e2127",
        red: "#e06c75",
        green: "#98c379",
        yellow: "#e5c07b",
        blue: "#61afef",
        magenta: "#c678dd",
        cyan: "#56b6c2",
        white: "#abb2bf",
        brightBlack: "#5c6370",
        brightRed: "#e06c75",
        brightGreen: "#98c379",
        brightYellow: "#e5c07b",
        brightBlue: "#61afef",
        brightMagenta: "#c678dd",
        brightCyan: "#56b6c2",
        brightWhite: "#ffffff",
      },
    },
  },

  catppuccin: {
    id: "catppuccin",
    name: "Catppuccin Mocha",
    colors: {
      bg: "#1e1e2e",
      bgSecondary: "#181825",
      bgTertiary: "#313244",
      border: "#45475a",
      borderSubtle: "#313244",
      text: "#cdd6f4",
      textMuted: "#a6adc8",
      textSubtle: "#6c7086",
      accent: "#cba6f7",
      accentHover: "#d4bfff",
      accentMuted: "#7c5a9a",
      success: "#a6e3a1",
      warning: "#f9e2af",
      error: "#f38ba8",
      terminalBg: "#1e1e2e",
      terminalText: "#cdd6f4",
      terminalCursor: "#f5e0dc",
    },
    terminal: {
      fontFamily: "JetBrains Mono, Menlo, Monaco, 'Courier New', monospace",
      fontSize: 13,
      theme: {
        background: "#1e1e2e",
        foreground: "#cdd6f4",
        cursor: "#f5e0dc",
        cursorAccent: "#1e1e2e",
        selectionBackground: "#45475a",
        black: "#45475a",
        red: "#f38ba8",
        green: "#a6e3a1",
        yellow: "#f9e2af",
        blue: "#89b4fa",
        magenta: "#cba6f7",
        cyan: "#94e2d5",
        white: "#bac2de",
        brightBlack: "#585b70",
        brightRed: "#f38ba8",
        brightGreen: "#a6e3a1",
        brightYellow: "#f9e2af",
        brightBlue: "#89b4fa",
        brightMagenta: "#cba6f7",
        brightCyan: "#94e2d5",
        brightWhite: "#a6adc8",
      },
    },
  },

  monokai: {
    id: "monokai",
    name: "Monokai Pro",
    colors: {
      bg: "#2d2a2e",
      bgSecondary: "#221f22",
      bgTertiary: "#403e41",
      border: "#5b595c",
      borderSubtle: "#403e41",
      text: "#fcfcfa",
      textMuted: "#939293",
      textSubtle: "#727072",
      accent: "#ffd866",
      accentHover: "#ffe08a",
      accentMuted: "#8a7a3a",
      success: "#a9dc76",
      warning: "#ffd866",
      error: "#ff6188",
      terminalBg: "#2d2a2e",
      terminalText: "#fcfcfa",
      terminalCursor: "#fcfcfa",
    },
    terminal: {
      fontFamily: "JetBrains Mono, Menlo, Monaco, 'Courier New', monospace",
      fontSize: 13,
      theme: {
        background: "#2d2a2e",
        foreground: "#fcfcfa",
        cursor: "#fcfcfa",
        cursorAccent: "#2d2a2e",
        selectionBackground: "#5b595c",
        black: "#403e41",
        red: "#ff6188",
        green: "#a9dc76",
        yellow: "#ffd866",
        blue: "#fc9867",
        magenta: "#ab9df2",
        cyan: "#78dce8",
        white: "#fcfcfa",
        brightBlack: "#727072",
        brightRed: "#ff6188",
        brightGreen: "#a9dc76",
        brightYellow: "#ffd866",
        brightBlue: "#fc9867",
        brightMagenta: "#ab9df2",
        brightCyan: "#78dce8",
        brightWhite: "#fcfcfa",
      },
    },
  },

  solarized: {
    id: "solarized",
    name: "Solarized Dark",
    colors: {
      bg: "#002b36",
      bgSecondary: "#073642",
      bgTertiary: "#094552",
      border: "#586e75",
      borderSubtle: "#073642",
      text: "#839496",
      textMuted: "#657b83",
      textSubtle: "#586e75",
      accent: "#268bd2",
      accentHover: "#2aa5f5",
      accentMuted: "#1a5a8a",
      success: "#859900",
      warning: "#b58900",
      error: "#dc322f",
      terminalBg: "#002b36",
      terminalText: "#839496",
      terminalCursor: "#839496",
    },
    terminal: {
      fontFamily: "JetBrains Mono, Menlo, Monaco, 'Courier New', monospace",
      fontSize: 13,
      theme: {
        background: "#002b36",
        foreground: "#839496",
        cursor: "#839496",
        cursorAccent: "#002b36",
        selectionBackground: "#073642",
        black: "#073642",
        red: "#dc322f",
        green: "#859900",
        yellow: "#b58900",
        blue: "#268bd2",
        magenta: "#d33682",
        cyan: "#2aa198",
        white: "#eee8d5",
        brightBlack: "#002b36",
        brightRed: "#cb4b16",
        brightGreen: "#586e75",
        brightYellow: "#657b83",
        brightBlue: "#839496",
        brightMagenta: "#6c71c4",
        brightCyan: "#93a1a1",
        brightWhite: "#fdf6e3",
      },
    },
  },

  rosePine: {
    id: "rosePine",
    name: "Rosé Pine",
    colors: {
      bg: "#191724",
      bgSecondary: "#1f1d2e",
      bgTertiary: "#26233a",
      border: "#403d52",
      borderSubtle: "#26233a",
      text: "#e0def4",
      textMuted: "#908caa",
      textSubtle: "#6e6a86",
      accent: "#c4a7e7",
      accentHover: "#d4bff7",
      accentMuted: "#7a5a9a",
      success: "#9ccfd8",
      warning: "#f6c177",
      error: "#eb6f92",
      terminalBg: "#191724",
      terminalText: "#e0def4",
      terminalCursor: "#524f67",
    },
    terminal: {
      fontFamily: "JetBrains Mono, Menlo, Monaco, 'Courier New', monospace",
      fontSize: 13,
      theme: {
        background: "#191724",
        foreground: "#e0def4",
        cursor: "#524f67",
        cursorAccent: "#e0def4",
        selectionBackground: "#403d52",
        black: "#26233a",
        red: "#eb6f92",
        green: "#9ccfd8",
        yellow: "#f6c177",
        blue: "#31748f",
        magenta: "#c4a7e7",
        cyan: "#ebbcba",
        white: "#e0def4",
        brightBlack: "#6e6a86",
        brightRed: "#eb6f92",
        brightGreen: "#9ccfd8",
        brightYellow: "#f6c177",
        brightBlue: "#31748f",
        brightMagenta: "#c4a7e7",
        brightCyan: "#ebbcba",
        brightWhite: "#e0def4",
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
