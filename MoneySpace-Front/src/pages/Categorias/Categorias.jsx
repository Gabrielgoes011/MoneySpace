// Cadastro de categorias (globais): lista as categorias e permite ao dono do app criar novas.
import { useEffect, useState } from 'react';
import { Button, Card, Chip, Spinner, useOverlayState } from '@heroui/react';
import { FiPlus, FiTag } from 'react-icons/fi';
import { listarCategorias } from '../../services/categoriaService';
import { properCase } from '../../utils/formatar';
import CategoriaFormModal from './componentes/CategoriaFormModal';

export default function Categorias() {
  const [dados, setDados] = useState(null); // { categorias, pode_editar }
  const [erro, setErro] = useState('');
  const modal = useOverlayState();

  const carregar = () =>
    listarCategorias().then(setDados).catch((e) => setErro(e.message));

  useEffect(() => { carregar(); }, []);

  if (erro) {
    return <p className="rounded-xl border border-dashed border-separator p-10 text-center text-danger">{erro}</p>;
  }
  if (!dados) {
    return <div className="flex justify-center p-16"><Spinner /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Categorias</h1>
          <p className="text-sm text-muted">Usadas para classificar os lançamentos da fatura</p>
        </div>
        {dados.pode_editar && (
          <Button onPress={modal.open} className="w-full sm:w-auto"><FiPlus size={16} /> Nova categoria</Button>
        )}
      </div>

      {dados.categorias.length === 0 ? (
        <p className="rounded-xl border border-dashed border-separator p-10 text-center text-muted">Nenhuma categoria cadastrada.</p>
      ) : (
        <Card>
          <Card.Header className="flex-row items-center justify-between">
            <Card.Title>Categorias cadastradas</Card.Title>
            <Chip variant="soft">{dados.categorias.length}</Chip>
          </Card.Header>
          <Card.Content className="gap-0 p-0">
            <ul>
              {dados.categorias.map((c) => (
                <li key={c.id} className="flex items-center gap-3 border-t border-separator px-4 py-3 first:border-t-0">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-accent/10 text-accent"><FiTag size={16} /></span>
                  <span className="min-w-0 flex-1 truncate">{properCase(c.valor)}</span>
                </li>
              ))}
            </ul>
          </Card.Content>
        </Card>
      )}

      <CategoriaFormModal state={modal} onSalvo={carregar} />
    </div>
  );
}
