// ========================================
// MENU LATERAL (Drawer estilo LinkedIn)
// ========================================
// Um Avatar com a foto (ou iniciais) do usuário fica ao lado da marca no Header.
// Ao clicar, abre um Drawer à esquerda com: perfil, navegação, tema e sair.

import { NavLink, useNavigate } from 'react-router-dom';
import { Avatar, Button, Drawer, Separator, Chip, Disclosure } from '@heroui/react';
import {
  FiHome,
  FiList,
  FiCreditCard,
  FiTag,
  FiSun,
  FiMoon,
  FiLogOut,
  FiUsers,
  FiFolderPlus,
  FiChevronDown,
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

// Gera as iniciais do nome para o fallback do avatar (ex.: "Gabriel Goes" -> "GG").
function iniciais(nome = '') {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

// Navegação principal (mesmos paths das rotas em App.jsx).
const links = [
  { icon: FiHome, label: 'Início', path: '/' },
  { icon: FiList, label: 'Transações', path: '/transacoes' },
  { icon: FiCreditCard, label: 'Contas', path: '/contas' },
];

// Seção "Cadastros": a parte administrativa (cadastros de base).
const cadastros = [
  { icon: FiUsers, label: 'Usuários', path: '/cadastros/usuarios' },
  { icon: FiTag, label: 'Categorias', path: '/cadastros/categorias' },
];

// Classe compartilhada entre os itens de navegação (ativo x inativo).
function classeItem({ isActive }) {
  return `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
    isActive
      ? 'bg-primary/10 text-primary font-medium'
      : 'text-foreground hover:bg-black/5 dark:hover:bg-white/5'
  }`;
}

function MenuLateral() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <Drawer>
      {/* Gatilho: a "bolinha" com a foto do usuário, ao lado da marca */}
      <Drawer.Trigger
        render={(props) => (
          <button
            {...props}
            type="button"
            aria-label="Abrir menu"
            className="rounded-full outline-none focus-visible:ring-2 ring-primary"
          >
            <Avatar size="sm">
              {user?.foto && <Avatar.Image src={user.foto} alt={user?.nome} />}
              <Avatar.Fallback color="accent">{iniciais(user?.nome)}</Avatar.Fallback>
            </Avatar>
          </button>
        )}
      />

      <Drawer.Backdrop>
        <Drawer.Content placement="left">
          <Drawer.Dialog>
            <Drawer.CloseTrigger />

            {/* ── Cabeçalho: perfil do usuário ───────────────────── */}
            <Drawer.Header>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Avatar size="lg">
                    {user?.foto && <Avatar.Image src={user.foto} alt={user?.nome} />}
                    <Avatar.Fallback color="accent">{iniciais(user?.nome)}</Avatar.Fallback>
                  </Avatar>
                  <div className="min-w-0">
                    <Drawer.Heading className="truncate">{user?.nome || 'Visitante'}</Drawer.Heading>
                    <p className="text-xs text-foreground-500 truncate">{user?.email}</p>
                  </div>
                </div>

                {/* Família vinculada do usuário */}
                {user?.familia_nome && (
                  <Chip variant="flat" color="primary" startContent={<FiUsers size={14} />}>
                    {user.familia_nome}
                  </Chip>
                )}
              </div>
            </Drawer.Header>

            {/* ── Corpo: navegação + ações ───────────────────────── */}
            <Drawer.Body>
              <nav className="flex flex-col gap-1">
                {links.map(({ icon: Icon, label, path }) => (
                  <Drawer.CloseTrigger
                    key={path}
                    render={(props) => (
                      <NavLink {...props} to={path} end={path === '/'} className={classeItem}>
                        <Icon size={20} />
                        {label}
                      </NavLink>
                    )}
                  />
                ))}

                {/* Seção Cadastros: recolhível (Disclosure do HeroUI) */}
                <Disclosure>
                  <Disclosure.Heading>
                    <Disclosure.Trigger
                      render={(props) => (
                        <button
                          {...props}
                          type="button"
                          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                        >
                          <FiFolderPlus size={20} />
                          <span className="flex-1 text-left">Cadastros</span>
                          <Disclosure.Indicator>
                            <FiChevronDown size={16} />
                          </Disclosure.Indicator>
                        </button>
                      )}
                    />
                  </Disclosure.Heading>

                  <Disclosure.Content>
                    <div className="flex flex-col gap-1 pl-4 pt-1">
                      {cadastros.map(({ icon: Icon, label, path }) => (
                        <Drawer.CloseTrigger
                          key={path}
                          render={(props) => (
                            <NavLink {...props} to={path} className={classeItem}>
                              <Icon size={18} />
                              {label}
                            </NavLink>
                          )}
                        />
                      ))}
                    </div>
                  </Disclosure.Content>
                </Disclosure>
              </nav>

              <Separator className="my-4" />

              <div className="flex flex-col gap-1">
                <Button variant="ghost" className="justify-start" onPress={toggleTheme}>
                  {isDark ? <FiSun size={20} /> : <FiMoon size={20} />}
                  {isDark ? 'Tema claro' : 'Tema escuro'}
                </Button>

                <Button
                  variant="ghost"
                  className="justify-start text-danger"
                  onPress={async () => {
                    await logout();
                    navigate('/login');
                  }}
                >
                  <FiLogOut size={20} />
                  Sair
                </Button>
              </div>
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

export default MenuLateral;
