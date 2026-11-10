// Itens de navegação (lateral, menu do topo e barra inferior do celular).
// `filhos` = submenu. A rota do grupo (/cadastros) é um hub para o celular.
import { FiHome, FiCreditCard, FiList, FiFolder, FiUsers, FiTag } from 'react-icons/fi';

export const ITENS = [
  { to: '/dashboard', label: 'Início', icon: FiHome },
  { to: '/faturas', label: 'Faturas', icon: FiCreditCard },
  {
    to: '/cadastros', label: 'Cadastros', icon: FiFolder,
    filhos: [
      { to: '/cadastros/usuarios', label: 'Usuários', icon: FiUsers },
      { to: '/cadastros/contas', label: 'Contas', icon: FiList },
      { to: '/cadastros/categorias', label: 'Categorias', icon: FiTag },
    ],
  },
];
