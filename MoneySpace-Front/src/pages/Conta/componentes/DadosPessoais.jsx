// Dados pessoais de quem está logado: nome, e-mail e CPF. Perfil e senha ficam em outros lugares.
import { useState } from 'react';
import { Button, Input, Label, TextField, toast } from '@heroui/react';
import { FiSave } from 'react-icons/fi';
import { atualizarMinhaConta } from '../../../services/contaService';

export default function DadosPessoais({ conta, onSalvo }) {
  const [nome, setNome] = useState(conta.nome ?? '');
  const [email, setEmail] = useState(conta.email ?? '');
  const [cpf, setCpf] = useState(conta.cpf ?? '');
  const [salvando, setSalvando] = useState(false);

  // Manda os três campos; o back valida e devolve os dados gravados
  const salvar = async (e) => {
    e.preventDefault();
    setSalvando(true);
    try {
      const atualizado = await atualizarMinhaConta({ nome, email, cpf });
      onSalvo(atualizado);
      toast.success('Dados atualizados!');
    } catch (erro) {
      toast.danger(erro.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={salvar} className="space-y-3">
      <TextField fullWidth>
        <Label>Nome</Label>
        <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
      </TextField>
      <TextField fullWidth>
        <Label>E-mail</Label>
        <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </TextField>
      <TextField fullWidth>
        <Label>CPF</Label>
        <Input inputMode="numeric" value={cpf} onChange={(e) => setCpf(e.target.value)} required />
      </TextField>
      <Button type="submit" isDisabled={salvando}>
        <FiSave size={16} /> {salvando ? 'Salvando...' : 'Salvar dados'}
      </Button>
    </form>
  );
}
