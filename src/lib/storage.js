// O estado da interface que sobrevive ao recarregar a página.
//
// Aqui ficam preferências e coisas que ainda não têm rota na API (favoritos,
// anotações, histórico de simulado). O que É do servidor — tentativas, acervo,
// perfil — não passa por aqui de propósito: duas fontes de verdade divergem em
// silêncio na primeira gravação que falha.

const KEY = 'ma-questoes-state-v1';

const ehObjetoSimples = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Lê o estado salvo e completa o que faltar com os padrões.
 *
 * O merge desce um nível, e isso não é detalhe: `{...defaults, ...parsed}`
 * puro substitui a fatia inteira, então um campo NOVO dentro de
 * `configuracoes` nunca chegava a quem já tinha usado o app — a fatia salva
 * (sem o campo) vencia o padrão (com o campo), e a tela quebrava só para
 * usuário antigo, que é o pior lugar para um bug aparecer.
 */
export function loadState(defaults) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw);
    if (!ehObjetoSimples(parsed)) return defaults;

    return mesclarComPadrao(defaults, parsed);
  } catch {
    return defaults;
  }
}

function mesclarComPadrao(defaults, salvo) {
  const resultado = { ...defaults };

  for (const [chave, valor] of Object.entries(salvo)) {
    const padrao = defaults[chave];
    resultado[chave] = ehObjetoSimples(padrao) && ehObjetoSimples(valor)
      ? { ...padrao, ...valor }
      : valor;
  }

  return resultado;
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // modo privado ou quota estourada: o app continua, só não lembra depois
  }
}

/**
 * Apaga o estado da interface — não os dados da conta, que têm chave própria
 * (ver abaixo).
 *
 * Sem isto, sair de uma conta e entrar em outra no mesmo computador mantinha
 * as telas da pessoa anterior — filtros, quiz em andamento — e o app mostrava
 * o estado de alguém sem nunca ter mentido explicitamente sobre isso.
 */
export function limparEstado() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // idem: nada a fazer, e não vale derrubar a tela
  }
}

// ---------------------------------------------------------------------------
// Dados da conta
// ---------------------------------------------------------------------------
//
// Favoritos, anotações e o histórico de simulado não têm rota na API: moram
// neste navegador. Enquanto moravam só no estado da interface, o logout tinha
// de escolher entre apagá-los — e a pessoa perdia o que tinha escrito e as
// notas das provas que fez ao clicar em "Sair" — e mantê-los, mostrando-os a
// quem entrasse depois no mesmo computador. Com uma chave por conta, nenhuma
// das duas coisas acontece.
//
// O histórico de simulado não é só a lista da tela de Simulados: `metaDiaria`
// e `sequenciaAtual` também o leem. Apagá-lo no logout mudava a meta do dia e
// podia encurtar a sequência de quem só tinha saído e entrado de novo.
//
// Não é sigilo: a chave de outra conta continua legível nas ferramentas do
// navegador. O que ela garante é que a tela de uma conta não mostra o que é de
// outra. Sigilo de verdade, e dado que acompanha a pessoa entre aparelhos, só
// com rota na API.

const PREFIXO_CONTA = 'ma-questoes-conta-v1:';
export const FATIAS_DA_CONTA = ['favoritos', 'anotacoes', 'resultados_historico'];

const chaveDaConta = (id) => `${PREFIXO_CONTA}${id}`;

export function carregarDadosDaConta(id) {
  if (id == null) return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(chaveDaConta(id)) || '{}');
    if (!ehObjetoSimples(parsed)) return {};

    // Só as fatias da conta: uma chave adulterada não pode trocar tema, tela
    // ou `__usuario` de quem entrar.
    return Object.fromEntries(
      FATIAS_DA_CONTA.filter((fatia) => fatia in parsed).map((fatia) => [fatia, parsed[fatia]])
    );
  } catch {
    return {};
  }
}

export function salvarDadosDaConta(id, estado) {
  if (id == null) return;
  try {
    const dados = Object.fromEntries(FATIAS_DA_CONTA.map((fatia) => [fatia, estado[fatia]]));
    localStorage.setItem(chaveDaConta(id), JSON.stringify(dados));
  } catch {
    // modo privado ou quota: o que está na tela continua valendo nesta aba
  }
}

/**
 * O estado com que uma conta começa ao entrar.
 *
 * Mesma conta do estado salvo: segue como está. Outra conta, ou nenhuma
 * (depois de um logout): recomeça do padrão, mantendo o tema — que é do
 * aparelho, não da conta — e recupera os favoritos e as anotações guardados
 * para ela.
 *
 * Pura de propósito: roda dentro de um updater do `setState`, então quem
 * chama lê `carregarDadosDaConta` antes e passa o resultado.
 */
export function estadoDaConta(atual, id, defaults, dadosDaConta = {}) {
  if (atual.__usuario != null && String(atual.__usuario) === String(id)) return atual;

  return {
    ...mesclarComPadrao(defaults, dadosDaConta),
    theme: atual.theme,
    __usuario: id,
  };
}
