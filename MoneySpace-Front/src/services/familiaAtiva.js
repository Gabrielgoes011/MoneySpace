// Família ativa do DONO do app (master): quando ele "entra" em outra família, o front manda o id dela
// no header X-Familia-Ativa (ver api.js) e o back confere no banco se ele é master antes de trocar.
// Fica no localStorage para sobreviver a um refresh. Quem não é master nunca usa isto.
const CHAVE = 'familiaAtiva';

// Lê { id, nome } da família ativa, ou null quando está na própria família.
export function lerFamiliaAtiva() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    localStorage.removeItem(CHAVE);
    return null;
  }
}

export function definirFamiliaAtiva(familia) {
  localStorage.setItem(CHAVE, JSON.stringify({ id: familia.id, nome: familia.nome }));
}

export function limparFamiliaAtiva() {
  localStorage.removeItem(CHAVE);
}
