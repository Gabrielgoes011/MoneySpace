// Itens de navegação (lateral, menu do topo e barra inferior do celular).
// `filhos` = submenu. A rota do grupo (/cadastros) é um hub para o celular.
// `somenteMaster` = só aparece para o dono do app (use filtrarItens).
import { FiHome, FiCreditCard, FiFileText, FiList, FiFolder, FiUsers, FiTag, FiGrid } from 'react-icons/fi';
// (cartões aparecem como submenu de Cadastros; FiCreditCard já importado)

export const ITENS = [
  { to: '/dashboard', label: 'Início', icon: FiHome },
  { to: '/faturas', label: 'Faturas', icon: FiCreditCard },
  { to: '/relatorios', label: 'Relatórios', icon: FiFileText },
  {
    to: '/cadastros', label: 'Cadastros', icon: FiFolder,
    filhos: [
      { to: '/cadastros/usuarios', label: 'Usuários', icon: FiUsers },
      { to: '/cadastros/familias', label: 'Famílias', icon: FiGrid, somenteMaster: true },
      { to: '/cadastros/cartoes', label: 'Cartões', icon: FiCreditCard },
      { to: '/cadastros/contas', label: 'Contas', icon: FiList },
      { to: '/cadastros/categorias', label: 'Categorias', icon: FiTag },
    ],
  },
];

// Tira os itens que só o dono do app vê. A segurança real está no back (o banco recusa),
// isto só evita mostrar um menu que daria erro.
export function filtrarItens(ehMaster) {
  return ITENS
    .filter((item) => !item.somenteMaster || ehMaster === true)
    .map((item) => (item.filhos
      ? { ...item, filhos: item.filhos.filter((filho) => !filho.somenteMaster || ehMaster === true) }
      : item));
}
