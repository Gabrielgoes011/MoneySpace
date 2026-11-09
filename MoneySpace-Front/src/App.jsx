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
  const { isAuthenticated, loading } = useAuth();

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
        <Route path="/" element={<Welcome />} />
      ) : (
        <Route path="*" element={<Navigate to="/login" />} />
      )}
    </Routes>
  );
}

export default App;
