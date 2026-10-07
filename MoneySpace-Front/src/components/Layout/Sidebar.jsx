// ========================================
// SIDEBAR (menu lateral - só desktop)
// ========================================
// Cada item é um Button do HeroUI que funciona como link (NavLink).

import { NavLink } from 'react-router-dom';
import { Button, Separator } from '@heroui/react';
import { FiHome, FiList, FiCreditCard, FiTag, FiUsers } from 'react-icons/fi';

function Sidebar() {
  // Navegação principal (o path deve ser igual ao <Route path="..."> do App.jsx).
  const links = [
    { icon: FiHome, label: 'Início', path: '/' },
    { icon: FiList, label: 'Transações', path: '/transacoes' },
    { icon: FiCreditCard, label: 'Contas', path: '/contas' },
  ];

  // Seção "Cadastros": parte administrativa.
  const cadastros = [
    { icon: FiUsers, label: 'Usuários', path: '/cadastros/usuarios' },
    { icon: FiTag, label: 'Categorias', path: '/cadastros/categorias' },
  ];

  const renderItem = ({ icon: Icon, label, path }) => (
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
  );

  return (
    <aside className="w-64 p-4 border-r border-black/10 dark:border-white/10">
      <nav className="flex flex-col gap-2">
        {links.map(renderItem)}

        <Separator className="my-2" />
        <p className="px-3 text-xs font-medium uppercase tracking-wide text-foreground-500">
          Cadastros
        </p>
        {cadastros.map(renderItem)}
      </nav>
    </aside>
  );
}

export default Sidebar;
