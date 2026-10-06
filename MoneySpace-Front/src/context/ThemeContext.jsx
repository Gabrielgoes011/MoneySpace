// ========================================
// 🌙 CONTEXTO DE TEMA (Escuro/Claro)
// ========================================
// Gerencia modo escuro vs modo claro da aplicação

import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // Verifica se tem preferência salva, senão usa a do sistema
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';

    // Usa preferência do sistema (dark mode do SO)
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Quando muda o tema, salva e aplica no HTML
  useEffect(() => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // Função para alternar tema
  const toggleTheme = () => setIsDark(!isDark);

  const value = {
    isDark,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook para usar tema em qualquer componente
 *
 * Exemplo:
 *   const { isDark, toggleTheme } = useTheme();
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme deve ser usado dentro de <ThemeProvider>');
  }
  return context;
}
