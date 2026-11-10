// ========================================
// 🎯 APP PRINCIPAL
// ========================================
// Estrutura mínima: contextos globais + rotas (login público e a tela de
// boas-vindas protegida). Base para crescer o app a partir daqui.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toast } from '@heroui/react';

// Provedores de contexto
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Páginas
import Login from './pages/Login/Login';
import Welcome from './pages/Welcome/Welcome';
import AppLayout from './components/Layout/AppLayout';
import Faturas from './pages/Faturas/Faturas';
import Relatorios from './pages/Relatorios/Relatorios';
import EmBreve from './pages/EmBreve/EmBreve';
import Usuarios from './pages/Usuarios/Usuarios';
import Cartoes from './pages/Cartoes/Cartoes';
import Cadastros from './pages/Cadastros/Cadastros';
import Categorias from './pages/Categorias/Categorias';
import Dashboard from './pages/Dashboard/Dashboard';
function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          {/* Toast do HeroUI: toast.success('...'), toast.danger('...') */}
          <Toast.Provider />
          <AppRoutes />
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

// ========================================
// ROTAS (login público + welcome protegida)
// ========================================
function AppRoutes() {
  const { isAuthenticated: autenticado, loading } = useAuth();
  // VITE_MODO_DEMO=true libera as telas sem backend (só para ver o front com mock).
  const isAuthenticated = autenticado || import.meta.env.VITE_MODO_DEMO === 'true';

  // Aguarda carregar os dados de autenticação (evita "piscar" o login).
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <Routes>
      {/* Login - público */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" /> : <Login />}
      />

      {/* Welcome - protegida */}
      {isAuthenticated ? (
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/faturas" element={<Faturas />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/cadastros" element={<Cadastros />} />
          <Route path="/cadastros/usuarios" element={<Usuarios />} />
          <Route path="/cadastros/cartoes" element={<Cartoes />} />
          <Route path="/cadastros/contas" element={<EmBreve titulo="Contas" />} />
          <Route path="/cadastros/categorias" element={<Categorias />} />
          <Route path="/perfil" element={<Welcome />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" />} />
      )}
    </Routes>
  );
}

export default App;
