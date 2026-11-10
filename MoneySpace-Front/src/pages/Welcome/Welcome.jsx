// ========================================
// TELA DE BEM-VINDO
// ========================================
// Tela mínima exibida após o login. Mostra o usuário logado (e a família,
// quando houver) e oferece alternância de tema e sair. Ponto de partida para
// as próximas telas do app.

import { useNavigate } from 'react-router-dom';
import { Card, Button, Chip } from '@heroui/react';
import { FiLogOut, FiSun, FiMoon, FiUsers } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

function Welcome() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-accent/10 via-background to-background text-foreground">
      <Card className="w-full max-w-md">
        <Card.Header>
          <Card.Title>Bem-vindo, {user?.nome || 'por aqui'} 👋</Card.Title>
          <Card.Description>Você está logado.</Card.Description>
        </Card.Header>

        <Card.Content className="space-y-4">
          {user?.email && (
            <p className="text-sm text-foreground-500 truncate">{user.email}</p>
          )}

          {user?.familia_nome && (
            <Chip variant="soft" color="accent">
              <FiUsers size={14} /> {user.familia_nome}
            </Chip>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Button variant="ghost" className="justify-start" onPress={toggleTheme}>
              {isDark ? <FiSun size={18} /> : <FiMoon size={18} />}
              {isDark ? 'Tema claro' : 'Tema escuro'}
            </Button>

            <Button
              variant="ghost"
              className="justify-start text-danger"
              onPress={handleLogout}
            >
              <FiLogOut size={18} />
              Sair
            </Button>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}

export default Welcome;
