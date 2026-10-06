// ========================================
// HEADER (barra superior)
// ========================================
// O HeroUI v3 não tem Navbar, então é um <header> simples com Buttons do HeroUI.

import { Button } from '@heroui/react';
import { FiLogOut, FiSun, FiMoon } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

function Header() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-black/10 dark:border-white/10">
      <p className="font-bold text-lg">MoneySpace</p>

      <div className="flex items-center gap-2">
        {user && (
          <span className="hidden sm:block text-sm">
            Olá, <strong>{user.nome}</strong>
          </span>
        )}

        <Button isIconOnly variant="ghost" onPress={toggleTheme} aria-label="Alternar tema">
          {isDark ? <FiSun size={20} /> : <FiMoon size={20} />}
        </Button>

        <Button isIconOnly variant="ghost" onPress={logout} aria-label="Sair">
          <FiLogOut size={20} />
        </Button>
      </div>
    </header>
  );
}

export default Header;
