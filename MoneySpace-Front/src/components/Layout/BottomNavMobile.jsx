// ========================================
// 🔻 MENU INFERIOR (MOBILE)
// ========================================
// No celular o menu fica embaixo da tela (mais fácil de tocar com o polegar)

import { NavLink } from 'react-router-dom';
import { FiHome, FiList, FiCreditCard, FiTag } from 'react-icons/fi';

function BottomNavMobile() {
  // Mesmos links da Sidebar
  const links = [
    { icon: FiHome, label: 'Início', path: '/' },
    { icon: FiList, label: 'Transações', path: '/transacoes' },
    { icon: FiCreditCard, label: 'Contas', path: '/contas' },
    { icon: FiTag, label: 'Categorias', path: '/categorias' },
  ];

  return (
    <nav className="bg-background border-t border-black/10 dark:border-white/10 flex">
      {links.map((link) => {
        const Icon = link.icon;
        return (
          // NavLink marca automaticamente o link da página atual como "ativo"
          <NavLink
            key={link.path}
            to={link.path}
            end={link.path === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-3 text-xs ${
                isActive ? 'text-blue-500' : 'text-gray-500'
              }`
            }
          >
            <Icon size={22} />
            <span className="mt-1">{link.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export default BottomNavMobile;
