// ========================================
// SIDEBAR (menu lateral - só desktop)
// ========================================
// Cada item é um Button do HeroUI que funciona como link (NavLink).

import { NavLink } from 'react-router-dom';
import { Button } from '@heroui/react';
import { FiHome, FiList, FiCreditCard, FiTag } from 'react-icons/fi';

function Sidebar() {
  // Para criar um novo item, copie uma linha
  // (o path deve ser igual ao <Route path="..."> do App.jsx).
  const links = [
    { icon: FiHome, label: 'Início', path: '/' },
    { icon: FiList, label: 'Transações', path: '/transacoes' },
    { icon: FiCreditCard, label: 'Contas', path: '/contas' },
    { icon: FiTag, label: 'Categorias', path: '/categorias' },
  ];

  return (
    <aside className="w-64 p-4 border-r border-black/10 dark:border-white/10">
      <nav className="flex flex-col gap-2">
        {links.map(({ icon: Icon, label, path }) => (
          <Button
            key={path}
            variant="ghost"
            className="justify-start"
            // render troca o <button> por um link do react-router
            render={(props) => <NavLink to={path} end={path === '/'} {...props} />}
          >
            <Icon size={20} />
            {label}
          </Button>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
