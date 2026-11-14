// Autenticação em dois fatores (2FA): ativar com o app autenticador e desativar com o código atual.
import { useState } from 'react';
import { Button, Chip, Input, Label, TextField, toast } from '@heroui/react';
import { FiShield, FiShieldOff } from 'react-icons/fi';
import {
  iniciarSegundoFator,
  confirmarSegundoFator,
  desativarSegundoFator
} from '../../../services/contaService';

export default function Seguranca2fa({ ativo, onMudou }) {
  // QR code e chave enquanto o usuário ainda não confirmou o primeiro código
  const [configuracao, setConfiguracao] = useState(null);
  const [desativando, setDesativando] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);

  // Gera o segredo e o QR code (o 2FA ainda não fica ativo aqui)
  const comecarAtivacao = async () => {
    setOcupado(true);
    try {
      setConfiguracao(await iniciarSegundoFator());
      setCodigo('');
    } catch (erro) {
      toast.danger(erro.message);
    } finally {
      setOcupado(false);
    }
  };

  // Confirma o primeiro código do app: só então o 2FA liga
  const confirmarAtivacao = async (e) => {
    e.preventDefault();
    setOcupado(true);
    try {
      await confirmarSegundoFator(codigo);
      setConfiguracao(null);
      setCodigo('');
      toast.success('2FA ativado!');
      onMudou(true);
    } catch (erro) {
      toast.danger(erro.message);
    } finally {
      setOcupado(false);
    }
  };

  // Desliga o 2FA com o código atual do app
  const desativar = async (e) => {
    e.preventDefault();
    setOcupado(true);
    try {
      await desativarSegundoFator(codigo);
      setDesativando(false);
      setCodigo('');
      toast.success('2FA desativado.');
      onMudou(false);
    } catch (erro) {
      toast.danger(erro.message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {ativo ? 'Ligado: o login pede o código do app além da senha.' : 'Desligado: o login usa só a senha.'}
        </p>
        <Chip size="sm" variant="soft" color={ativo ? 'success' : 'default'}>
          {ativo ? 'Ligado' : 'Desligado'}
        </Chip>
      </div>

      {!ativo && !configuracao && (
        <Button onPress={comecarAtivacao} isDisabled={ocupado}>
          <FiShield size={16} /> Ativar 2FA
        </Button>
      )}

      {!ativo && configuracao && (
        <form onSubmit={confirmarAtivacao} className="space-y-3">
          <p className="text-sm">1. Escaneie o QR code no seu app autenticador (Google ou Microsoft Authenticator, por exemplo).</p>
          <img src={configuracao.qrCodeDataUrl} alt="QR code do 2FA" className="mx-auto h-48 w-48 rounded-lg bg-white p-2" />
          <p className="break-all text-xs text-muted">
            Ou digite esta chave no app: <span className="font-mono">{configuracao.secretBase32}</span>
          </p>
          <TextField fullWidth>
            <Label>2. Código de 6 dígitos do app</Label>
            <Input inputMode="numeric" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} required />
          </TextField>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" isDisabled={ocupado || codigo.length < 6}>Confirmar e ativar</Button>
            <Button variant="secondary" type="button" onPress={() => setConfiguracao(null)}>Cancelar</Button>
          </div>
        </form>
      )}

      {ativo && !desativando && (
        <Button variant="secondary" onPress={() => { setDesativando(true); setCodigo(''); }}>
          <FiShieldOff size={16} /> Desativar 2FA
        </Button>
      )}

      {ativo && desativando && (
        <form onSubmit={desativar} className="space-y-3">
          <TextField fullWidth>
            <Label>Código de 6 dígitos do app (para confirmar)</Label>
            <Input inputMode="numeric" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} required />
          </TextField>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="danger" isDisabled={ocupado || codigo.length < 6}>Desativar 2FA</Button>
            <Button variant="secondary" type="button" onPress={() => setDesativando(false)}>Cancelar</Button>
          </div>
        </form>
      )}
    </div>
  );
}
