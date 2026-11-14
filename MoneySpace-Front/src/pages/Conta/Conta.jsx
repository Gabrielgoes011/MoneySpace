// Minha conta: dados pessoais, troca de senha e autenticação em dois fatores (2FA).
// Tudo de quem está logado. Perfil de acesso (ADMIN/MEMBRO) não muda aqui.
import { useEffect, useState } from 'react';
import { Button, Card, Spinner, useOverlayState } from '@heroui/react';
import { FiKey } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { buscarMinhaConta } from '../../services/contaService';
import DadosPessoais from './componentes/DadosPessoais';
import Seguranca2fa from './componentes/Seguranca2fa';
import TrocarSenhaModal from './componentes/TrocarSenhaModal';

export default function Conta() {
  const { user, setUser } = useAuth();
  const [conta, setConta] = useState(null);
  const [erro, setErro] = useState('');
  const modalSenha = useOverlayState();

  // Carrega os dados atuais (o back é a fonte: nome, e-mail, CPF e 2FA)
  useEffect(() => {
    buscarMinhaConta().then(setConta).catch((e) => setErro(e.message));
  }, []);

  // Atualiza também a sessão, para o topo mostrar o nome novo
  const aoSalvarDados = (atualizado) => {
    setConta(atualizado);
    setUser({ ...user, nome: atualizado.nome, email: atualizado.email });
  };

  const aoMudarDoisFatores = (ativo) => {
    setConta((anterior) => ({ ...anterior, mfa_ativo: ativo }));
    setUser({ ...user, mfa_ativo: ativo });
  };

  if (erro) {
    return <p className="rounded-xl border border-dashed border-separator p-10 text-center text-danger">{erro}</p>;
  }
  if (!conta) {
    return <div className="flex justify-center p-16"><Spinner /></div>;
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Minha conta</h1>
        <p className="text-sm text-muted">Seus dados, sua senha e a proteção do login</p>
      </div>

      <Card>
        <Card.Header><Card.Title>Dados pessoais</Card.Title></Card.Header>
        <Card.Content>
          <DadosPessoais key={conta.id} conta={conta} onSalvo={aoSalvarDados} />
        </Card.Content>
      </Card>

      <Card>
        <Card.Header><Card.Title>Senha</Card.Title></Card.Header>
        <Card.Content className="gap-3">
          <p className="text-sm text-muted">Use uma senha com no mínimo 8 caracteres e que você não usa em outros lugares.</p>
          <Button variant="secondary" className="w-full sm:w-auto" onPress={modalSenha.open}>
            <FiKey size={16} /> Trocar senha
          </Button>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header><Card.Title>Autenticação em dois fatores (2FA)</Card.Title></Card.Header>
        <Card.Content>
          <Seguranca2fa ativo={!!conta.mfa_ativo} onMudou={aoMudarDoisFatores} />
        </Card.Content>
      </Card>

      <TrocarSenhaModal state={modalSenha} />
    </div>
  );
}
