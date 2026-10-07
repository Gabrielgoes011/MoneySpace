// ========================================
// 🎯 APP PRINCIPAL
// ========================================
// Aqui fica toda a estrutura de rotas e contextos da aplicação

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toast } from '@heroui/react';

// Provedores de contexto
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { PrivacyProvider } from './context/PrivacyContext';

// Páginas
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Transacoes from './pages/Transacoes/Transacoes';
import Contas from './pages/Contas/Contas';
import Categorias from './pages/Categorias/Categorias';
import Usuarios from './pages/Usuarios/Usuarios';
import Layout from './components/Layout/Layout';

// Hook de autenticação
import { useAuth } from './context/AuthContext';

function App() {
  return (
    // Envolve toda a aplicação com contextos globais
    <AuthProvider>
      <ThemeProvider>
        <PrivacyProvider>
          {/* Rotas da aplicação */}
          <BrowserRouter>
            {/* Toast do HeroUI: notificações no canto da tela.
                Para mostrar uma: import { toast } from '@heroui/react'
                e chame toast.success('Salvo!') ou toast.danger('Erro') */}
            <Toast.Provider />
            <AppRoutes />
          </BrowserRouter>
        </PrivacyProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

// ========================================
// COMPONENTE DE ROTAS PROTEGIDAS
// ========================================
function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  // Aguarda carregar dados de autenticação
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <Routes>
      {/* Rota de login - pública */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" /> : <Login />}
      />

      {/* Rotas protegidas - só acessa se está autenticado */}
      {isAuthenticated ? (
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transacoes" element={<Transacoes />} />
          <Route path="/contas" element={<Contas />} />
          {/* Cadastros (parte administrativa) */}
          <Route path="/cadastros/usuarios" element={<Usuarios />} />
          <Route path="/cadastros/categorias" element={<Categorias />} />
        </Route>
      ) : (
        // Se não está autenticado, redireciona para login
        <Route path="*" element={<Navigate to="/login" />} />
      )}
    </Routes>
  );
}

export default App;
