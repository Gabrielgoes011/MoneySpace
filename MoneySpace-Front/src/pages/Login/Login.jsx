// ========================================
// PÁGINA DE LOGIN
// ========================================
// Usa componentes do HeroUI v3: Card, InputGroup, Button, Separator e toast.
// Chama a API e, se der certo, guarda o token com login() do AuthContext.

import { useState } from 'react';
import { Card, InputGroup, Button, toast } from '@heroui/react';
import { FiLayers, FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

function Login() {
  const { login } = useAuth();

  // Guardam o que o usuário digita
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const entrar = (credenciais) => {
    setCarregando(true);

    // Promise do login: faz a chamada, guarda o token e devolve o usuário.
    // O usuário retornado alimenta a mensagem de sucesso do toast.
    const promessaLogin = api
      .post('/login', credenciais)
      .then((resposta) => {
        // O backend responde { success, message, data: { usuario, token } }
        const { usuario, token } = resposta.data.data;
        login(usuario, token);
        return usuario;
      })
      .catch((erro) => {
        // Repassa uma mensagem amigável para o toast exibir no estado de erro.
        throw new Error(erro.response?.data?.message || 'Não foi possível fazer login.');
      })
      .finally(() => setCarregando(false));

    // toast.promise cuida sozinho dos estados de loading, sucesso e erro.
    toast.promise(promessaLogin, {
      loading: 'Entrando...',
      success: (usuario) => `Bem-vindo de volta, ${usuario.nome}!`,
      error: (erro) => erro.message,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault(); // impede a página de recarregar
    entrar({ email, senha });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-background">
      <div className="w-full max-w-sm space-y-6">
        {/* ── Marca do template ──────────────────────────────── */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex items-center justify-center size-12 rounded-xl bg-primary/10 text-primary">
            <FiLayers size={24} />
          </div>
          <h1 className="text-xl font-bold">MoneySpace</h1>
          <p className="text-sm text-foreground-500">
            Um espaço para organizar toda sua vida financeira.
          </p>
        </div>

        <Card className="w-full">
          <Card.Header>
            <Card.Title>Bem-vindo de volta</Card.Title>
            <Card.Description>Entre para continuar no MoneySpace</Card.Description>
          </Card.Header>

          <Card.Content>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <InputGroup>
                <InputGroup.Prefix>
                  <FiMail size={16} />
                </InputGroup.Prefix>
                <InputGroup.Input
                  type="email"
                  placeholder="E-mail"
                  aria-label="E-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </InputGroup>

              <InputGroup>
                <InputGroup.Prefix>
                  <FiLock size={16} />
                </InputGroup.Prefix>
                <InputGroup.Input
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="Senha"
                  aria-label="Senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                />
                <InputGroup.Suffix>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    onPress={() => setMostrarSenha((v) => !v)}
                    aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {mostrarSenha ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </Button>
                </InputGroup.Suffix>
              </InputGroup>

              {/* isPending mostra o "carregando" no botão */}
              <Button type="submit" fullWidth isPending={carregando}>
                Entrar
              </Button>
            </form>
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}

export default Login;
