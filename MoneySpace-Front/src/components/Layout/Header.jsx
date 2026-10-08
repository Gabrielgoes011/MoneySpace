// ========================================
// HEADER (barra superior)
// ========================================
// À esquerda: avatar do usuário (abre o menu lateral, estilo LinkedIn) + marca.
// À direita: alternância de tema e sair (atalhos rápidos no desktop).

import { useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react';
import { FiLogOut, FiSun, FiMoon } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import MenuLateral from './MenuLateral';

function Header() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Encerra a sessão (limpa cookies no backend + localStorage) e volta ao login.
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-black/10 dark:border-white/10">
      {/* Esquerda: avatar (abre o menu lateral) + marca */}
      <div className="flex items-center gap-3">
        <MenuLateral />
        <p className="font-bold text-lg">MoneySpace</p>
      </div>

      {/* Direita: atalhos rápidos */}
      <div className="flex items-center gap-2">
        {user && (
          <span className="hidden sm:block text-sm">
            Olá, <strong>{user.nome}</strong>
          </span>
        )}

        <Button isIconOnly variant="ghost" onPress={toggleTheme} aria-label="Alternar tema">
          {isDark ? <FiSun size={20} /> : <FiMoon size={20} />}
        </Button>

        <Button isIconOnly variant="ghost" onPress={handleLogout} aria-label="Sair">
          <FiLogOut size={20} />
        </Button>
      </div>
    </header>
  );
}

export default Header;
