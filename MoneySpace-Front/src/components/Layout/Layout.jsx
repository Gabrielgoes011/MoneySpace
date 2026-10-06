// ========================================
// 📐 LAYOUT PRINCIPAL
// ========================================
// Layout responsivo que muda de Sidebar (desktop) para BottomNav (mobile)

import { Outlet } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useIsMobile';
import Header from './Header';
import Sidebar from './Sidebar';
import BottomNavMobile from './BottomNavMobile';

function Layout() {
  const isMobile = useIsMobile();

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* HEADER (topo - em todos os casos) */}
      <Header />

      {/* CONTEÚDO PRINCIPAL */}
      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR (apenas desktop) */}
        {!isMobile && <Sidebar />}

        {/* PÁGINA ATUAL */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      {/* BOTTOM NAV (apenas mobile) */}
      {isMobile && <BottomNavMobile />}
    </div>
  );
}

export default Layout;
