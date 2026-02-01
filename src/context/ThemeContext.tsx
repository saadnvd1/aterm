import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Theme, getTheme, DEFAULT_THEME } from "../lib/themes";

interface ThemeContextType {
  theme: Theme;
  themeId: string;
  setThemeId: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState(() => {
    return localStorage.getItem("aterm-theme") || DEFAULT_THEME;
  });

  const theme = getTheme(themeId);

  useEffect(() => {
    localStorage.setItem("aterm-theme", themeId);

    // Apply CSS variables to root
    const root = document.documentElement;
    const { colors } = theme;

    root.style.setProperty("--bg", colors.bg);
    root.style.setProperty("--bg-secondary", colors.bgSecondary);
    root.style.setProperty("--bg-tertiary", colors.bgTertiary);
    root.style.setProperty("--border", colors.border);
    root.style.setProperty("--border-subtle", colors.borderSubtle);
    root.style.setProperty("--text", colors.text);
    root.style.setProperty("--text-muted", colors.textMuted);
    root.style.setProperty("--text-subtle", colors.textSubtle);
    root.style.setProperty("--accent", colors.accent);
    root.style.setProperty("--accent-hover", colors.accentHover);
    root.style.setProperty("--accent-muted", colors.accentMuted);
    root.style.setProperty("--success", colors.success);
    root.style.setProperty("--warning", colors.warning);
    root.style.setProperty("--error", colors.error);
  }, [theme, themeId]);

  return (
    <ThemeContext.Provider value={{ theme, themeId, setThemeId }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
