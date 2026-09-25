// A ficha de boas-vindas e a gravação de `profile_data`.
//
// O risco que este arquivo cobre é silencioso: o user-service SUBSTITUI o
// `profile_data` inteiro a cada PUT. Um PUT só com `{ meta, dataProva }`
// apagava a ficha, e a pessoa voltava a vê-la no próximo acesso — sem erro
// nenhum na tela. O servidor falso abaixo faz exatamente o que o de verdade
// faz (substitui), e os PUT demoram tempos diferentes, para a ordem importar.

import { criarFilaDePreferencias, mesclarPreferencias, PerfilDesconhecidoError } from '../src/lib/preferencias.js';
import {
  fichaConcluida, metaSugerida, metaValida, erroDoPasso, montarFicha, respostasIniciais,
  opcoesDeDificuldade, escolherTempo, DISCIPLINAS_OAB, rotuloDosDias, formatarData,
} from '../src/lib/ficha.js';
import { prioridadeDeEstudo, montarDisciplinas, TENTATIVAS_PARA_CONFIAR } from '../src/lib/disciplinas.js';
import { planoDaSemana } from '../src/lib/agenda.js';

const falhas = [];
const exigir = (condicao, mensagem) => {
  if (!condicao) falhas.push(mensagem);
};
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Servidor falso: `profile_data = COALESCE($3, profile_data)`, como o
// user-service. Cada PUT leva o tempo da lista `demoras`, na ordem.
function servidorFalso(inicial, demoras = []) {
  const srv = { profile_data: inicial, puts: [] };
  let n = 0;
  srv.salvar = async (preferencias, extra) => {
    const demora = demoras[n++] ?? 0;
    srv.puts.push({ preferencias, extra });
    await esperar(demora);
    if (preferencias !== undefined) srv.profile_data = JSON.parse(JSON.stringify(preferencias));
    return { name: extra?.nome ?? 'Nome', preferencias: srv.profile_data };
  };
  return srv;
}

const FICHA = { versao: 1, concluidaEm: '2026-09-20T10:00:00.000Z', fase: 'objetiva', jaFez: 'nao', diasDaSemana: [1, 3], minutosPorDia: 60, dificuldades: ['Direito Penal'] };

// ---------------------------------------------------------------------------
// Fila de profile_data
// ---------------------------------------------------------------------------

await (async () => {
  exigir(JSON.stringify(mesclarPreferencias({ a: 1, ficha: FICHA }, { a: 2 })) === JSON.stringify({ a: 2, ficha: FICHA }), 'mesclar deveria manter as chaves que a mudança não traz');
  exigir(JSON.stringify(mesclarPreferencias(null, { meta: 3 })) === '{"meta":3}', 'mesclar sobre nada deveria dar só a mudança');
})();

// Salvar a meta preserva a ficha.
await (async () => {
  const srv = servidorFalso({ meta: 20, dataProva: null, ficha: FICHA, outraChave: 'x' });
  const fila = criarFilaDePreferencias(srv.salvar);
  fila.conhecer(srv.profile_data);

  await fila.gravar({ meta: 7, dataProva: '2030-03-10' }, { extra: { id: 1 } });
  exigir(srv.profile_data.meta === 7, 'a meta não foi gravada');
  exigir(srv.profile_data.dataProva === '2030-03-10', 'a data da prova não foi gravada');
  exigir(srv.profile_data.ficha?.concluidaEm === FICHA.concluidaEm, 'salvar a meta APAGOU a ficha');
  exigir(srv.profile_data.outraChave === 'x', 'salvar a meta apagou uma chave que o front não conhece');
})();

// Salvar a ficha preserva meta, data e o resto.
await (async () => {
  const srv = servidorFalso({ meta: 12, dataProva: '2031-01-05', tema: 'azul' });
  const fila = criarFilaDePreferencias(srv.salvar);
  fila.conhecer(srv.profile_data);

  const resposta = await fila.gravar({ ficha: FICHA }, { extra: { id: 1, nome: 'Ana' } });
  exigir(srv.profile_data.ficha?.concluidaEm === FICHA.concluidaEm, 'a ficha não foi gravada');
  exigir(srv.profile_data.meta === 12 && srv.profile_data.dataProva === '2031-01-05', 'salvar a ficha apagou meta ou data');
  exigir(srv.profile_data.tema === 'azul', 'salvar a ficha apagou uma chave que o front não conhece');
  exigir(srv.puts[0].extra.nome === 'Ana', 'o nome deveria ir no mesmo PUT da ficha');
  exigir(resposta?.preferencias?.ficha != null, 'a fila deveria devolver a resposta do servidor');
})();

// Meta, ficha e meta em seguida, com o primeiro PUT mais lento que os outros:
// cada um parte do que o anterior gravou, e nada se perde.
await (async () => {
  const srv = servidorFalso({ meta: 20 }, [40, 5, 0]);
  const fila = criarFilaDePreferencias(srv.salvar);
  fila.conhecer(srv.profile_data);

  const a = fila.gravar({ meta: 8, dataProva: null }, { extra: { id: 1 } });
  const b = fila.gravar({ ficha: FICHA, meta: 10, dataProva: '2030-01-01' }, { extra: { id: 1 } });
  const c = fila.gravar({ meta: 15, dataProva: '2030-01-01' }, { extra: { id: 1 } });
  await Promise.all([a, b, c]);

  exigir(srv.profile_data.meta === 15, `a última meta deveria valer, veio ${srv.profile_data.meta}`);
  exigir(srv.profile_data.ficha?.concluidaEm === FICHA.concluidaEm, 'a meta gravada depois da ficha apagou a ficha');
  exigir(srv.puts[1].preferencias.meta === 10, 'a ficha deveria sair depois da primeira meta, não junto');
  exigir(srv.puts.length === 3, `deveriam ser 3 PUT, foram ${srv.puts.length}`);
})();

// Sem saber o que o servidor tem, não grava: o PUT substituiria tudo.
await (async () => {
  const srv = servidorFalso({ ficha: FICHA });
  const fila = criarFilaDePreferencias(srv.salvar);
  let erro = null;
  try { await fila.gravar({ meta: 5 }, { extra: { id: 1 } }); } catch (e) { erro = e; }
  exigir(erro instanceof PerfilDesconhecidoError, 'sem profile_data conhecido deveria recusar');
  exigir(srv.puts.length === 0, 'sem profile_data conhecido o PUT não pode sair');
  exigir(srv.profile_data.ficha != null, 'a ficha sumiu');
})();

// Sessão acabou antes da vez: não sai. Uma falha não trava os seguintes.
await (async () => {
  const srv = servidorFalso({ meta: 1 });
  let chamadas = 0;
  const fila = criarFilaDePreferencias(async (p, e) => {
    chamadas += 1;
    if (chamadas === 1) throw Object.assign(new Error('rede'), { status: 0 });
    return srv.salvar(p, e);
  });
  fila.conhecer(srv.profile_data);

  let vivo = true;
  const falha = fila.gravar({ meta: 2 }, { continuar: () => vivo, extra: { id: 1 } }).catch((e) => e);
  const depois = fila.gravar({ meta: 3 }, { continuar: () => vivo, extra: { id: 1 } });
  exigir((await falha)?.message === 'rede', 'o erro do PUT deveria chegar a quem gravou');
  exigir((await depois)?.preferencias?.meta === 3, 'a falha anterior não pode travar a fila');

  const parada = fila.gravar({ meta: 9 }, { continuar: () => vivo, extra: { id: 1 } });
  vivo = false;
  exigir((await parada) === null, 'com a sessão encerrada a vez deveria resolver null');
  exigir(srv.profile_data.meta === 3, 'o PUT de uma sessão encerrada saiu');
})();

// ---------------------------------------------------------------------------
// Ficha: regras dos passos
// ---------------------------------------------------------------------------

{
  exigir(fichaConcluida({ ficha: FICHA }) === true, 'ficha com concluidaEm deveria contar como feita');
  exigir(fichaConcluida({ ficha: { versao: 1 } }) === false, 'ficha sem concluidaEm não está feita');
  exigir(fichaConcluida(null) === false && fichaConcluida({}) === false, 'sem ficha não está feita');

  exigir(metaSugerida(30) === 10, `30 min → 10 questões, veio ${metaSugerida(30)}`);
  exigir(metaSugerida(60) === 20, `1 h → 20 questões, veio ${metaSugerida(60)}`);
  exigir(metaSugerida(120) === 40, `2 h → 40, veio ${metaSugerida(120)}`);
  exigir(metaSugerida(180) === 60, `3 h → 60, veio ${metaSugerida(180)}`);
  exigir(metaSugerida(null) === null, 'sem tempo não há sugestão');

  exigir(metaValida('12') === 12 && metaValida('0') === null && metaValida('') === null && metaValida('9999') === 500, 'metaValida errada');

  const r = escolherTempo({ meta: 7, minutosPorDia: null }, 120);
  exigir(r.meta === 40 && r.minutosPorDia === 120, 'escolher o tempo deveria sugerir a meta');
}

{
  const hoje = new Date('2026-09-25T12:00:00');
  const base = {
    nome: 'Ana', fase: 'objetiva', dataProva: '', dataIndefinida: false, jaFez: null,
    diasDaSemana: [], minutosPorDia: null, meta: '', dificuldades: [], dificuldadesIndefinidas: false,
  };
  exigir(erroDoPasso(0, { ...base, nome: '  ' }, hoje) != null, 'nome em branco deveria barrar o passo 1');
  exigir(erroDoPasso(0, base, hoje) === null, 'nome e fase bastam no passo 1');
  exigir(erroDoPasso(0, { ...base, fase: 'discursiva-penal' }, hoje) != null, 'fase inexistente deveria barrar');

  exigir(erroDoPasso(1, { ...base, jaFez: 'nao' }, hoje) != null, 'sem data e sem "ainda não sei" deveria barrar');
  exigir(erroDoPasso(1, { ...base, jaFez: 'nao', dataIndefinida: true }, hoje) === null, '"Ainda não sei" é resposta válida');
  exigir(erroDoPasso(1, { ...base, jaFez: 'nao', dataProva: '2026-09-24' }, hoje) != null, 'data que já passou deveria barrar');
  exigir(erroDoPasso(1, { ...base, jaFez: 'nao', dataProva: '2026-09-25' }, hoje) === null, 'a prova pode ser hoje');
  exigir(erroDoPasso(1, { ...base, dataIndefinida: true }, hoje) != null, 'sem "já fez" deveria barrar');

  const rotina = { ...base, diasDaSemana: [1], minutosPorDia: 60, meta: 20 };
  exigir(erroDoPasso(2, rotina, hoje) === null, 'rotina completa deveria passar');
  exigir(erroDoPasso(2, { ...rotina, diasDaSemana: [] }, hoje) != null, 'sem dia da semana deveria barrar');
  exigir(erroDoPasso(2, { ...rotina, meta: '0' }, hoje) != null, 'meta zero deveria barrar');

  exigir(erroDoPasso(3, base, hoje) != null, 'nenhuma matéria e sem "ainda não sei" deveria barrar');
  exigir(erroDoPasso(3, { ...base, dificuldadesIndefinidas: true }, hoje) === null, '"Ainda não sei" vale no passo 4');
  exigir(erroDoPasso(3, { ...base, dificuldades: ['Direito Civil'] }, hoje) === null, 'uma matéria basta');
}

{
  const agora = new Date('2026-09-25T15:00:00.000Z');
  const r = {
    nome: '  Ana Souza ', fase: 'discursiva-civil', dataProva: '2027-02-28', dataIndefinida: true, jaFez: 'uma-vez',
    diasDaSemana: [0, 1, 1, 3], minutosPorDia: 120, meta: '35', dificuldades: ['Direito Penal'], dificuldadesIndefinidas: true,
  };
  const { nome, preferencias } = montarFicha(r, { agora });
  exigir(nome === 'Ana Souza', 'o nome deveria ir sem espaços nas pontas');
  exigir(preferencias.meta === 35, 'a meta vai como número');
  exigir(preferencias.dataProva === null, '"Ainda não sei" grava a data como null');
  exigir(preferencias.ficha.concluidaEm === agora.toISOString(), 'concluidaEm deveria ser agora');
  exigir(preferencias.ficha.versao === 1, 'versao deveria ser 1');
  exigir(JSON.stringify(preferencias.ficha.diasDaSemana) === '[1,3,0]', `dias em ordem seg→dom e sem repetir, veio ${preferencias.ficha.diasDaSemana}`);
  exigir(preferencias.ficha.dificuldades.length === 0, '"Ainda não sei" grava dificuldades vazias');
  exigir(!('atualizadaEm' in preferencias.ficha), 'primeira conclusão não tem atualizadaEm');

  const edicao = montarFicha({ ...r, dataIndefinida: false, dificuldadesIndefinidas: false }, { anterior: FICHA, agora });
  exigir(edicao.preferencias.ficha.concluidaEm === FICHA.concluidaEm, 'editar não pode mudar a data da conclusão');
  exigir(edicao.preferencias.ficha.atualizadaEm === agora.toISOString(), 'editar marca atualizadaEm');
  exigir(edicao.preferencias.dataProva === '2027-02-28', 'com data, a data vai');
  exigir(edicao.preferencias.ficha.dificuldades[0] === 'Direito Penal', 'as matérias marcadas vão');
}

{
  // Conta antiga, sem ficha: nome, meta e data que já existem vêm preenchidos.
  const r = respostasIniciais({ nome: 'Maria', configuracoes: { meta: 7, dataProva: '2030-03-10' }, fase: 'objetiva', preferencias: { meta: 7, dataProva: '2030-03-10' } });
  exigir(r.nome === 'Maria' && r.meta === 7 && r.dataProva === '2030-03-10', 'conta antiga deveria vir pré-preenchida');
  exigir(r.dataIndefinida === false && r.jaFez === null && r.dificuldadesIndefinidas === false, 'o que não foi respondido começa em aberto');

  // Ficha feita, reaberta: as respostas voltam, inclusive os "ainda não sei".
  const salva = respostasIniciais({ nome: 'Maria', configuracoes: { meta: 20, dataProva: null }, fase: 'objetiva', preferencias: { meta: 20, dataProva: null, ficha: { ...FICHA, dificuldades: [] } } });
  exigir(salva.dataIndefinida === true && salva.dificuldadesIndefinidas === true, 'os "ainda não sei" deveriam voltar marcados');
  exigir(salva.minutosPorDia === 60 && salva.jaFez === 'nao' && salva.diasDaSemana.length === 2, 'as respostas da ficha deveriam voltar');

  // Data em formato estranho não entra no campo.
  exigir(respostasIniciais({ configuracoes: { dataProva: 'amanhã' } }).dataProva === '', 'data inválida não pode ir para o campo');
}

{
  const acervo = [{ disciplina: 'Direito Penal' }, { disciplina: 'Ética Profissional' }, { disciplina: null }, { disciplina: 'Direito Penal' }];
  const doAcervo = opcoesDeDificuldade(acervo);
  exigir(JSON.stringify(doAcervo) === JSON.stringify(['Direito Penal', 'Ética Profissional']), `as opções saem do acervo, sem repetir e sem "sem classificação": ${doAcervo}`);
  exigir(opcoesDeDificuldade([]).length === DISCIPLINAS_OAB.length && DISCIPLINAS_OAB.length === 18, 'sem acervo, as 18 matérias conhecidas');
  exigir(opcoesDeDificuldade(acervo, ['Direito Ambiental']).includes('Direito Ambiental'), 'matéria já marcada não pode sumir da lista');

  exigir(rotuloDosDias([1, 2, 3, 4, 5, 6, 0]) === 'todos os dias', 'sete dias = todos os dias');
  exigir(rotuloDosDias([0, 1]) === 'Seg, Dom', `dias na ordem da semana: ${rotuloDosDias([0, 1])}`);
  exigir(formatarData('2027-02-28') === '28/02/2027' && formatarData(null) === 'Ainda não sei', 'formatarData errada');
}

// ---------------------------------------------------------------------------
// Pontos fracos na prioridade de estudo
// ---------------------------------------------------------------------------

{
  const q = (id, disciplina) => ({ id, disciplina, revisada: true });
  const questoes = [
    q('1', 'Civil'), q('2', 'Civil'), q('3', 'Civil'),
    q('4', 'Penal'),
    q('5', 'Ética'), q('6', 'Ética'),
  ];

  // Conta nova: tudo "novo". Sem dificuldade declarada vence a que tem mais
  // questões; com Penal marcada, Penal vem primeiro.
  const semHistorico = montarDisciplinas(questoes, {});
  exigir(prioridadeDeEstudo(semHistorico)[0].nome === 'Civil', 'sem ficha, a de mais questões vem primeiro');
  const comFicha = prioridadeDeEstudo(semHistorico, { dificuldades: ['Penal'] });
  exigir(comFicha[0].nome === 'Penal' && comFicha[0].pontoFraco === true, `a matéria difícil deveria vir primeiro no começo, veio ${comFicha[0].nome}`);
  exigir(comFicha[1].pontoFraco !== true, 'só a declarada ganha pontoFraco');

  // Duas declaradas: entre elas, a de mais questões primeiro.
  const duas = prioridadeDeEstudo(semHistorico, { dificuldades: ['Penal', 'Ética'] }).map((d) => d.nome);
  exigir(duas[0] === 'Ética' && duas[1] === 'Penal' && duas[2] === 'Civil', `duas declaradas: ${duas}`);

  // Com respostas suficientes em Penal, o desempenho manda: acertou tudo,
  // domina, e vai para o fim.
  const tent = (correta) => ({ correta, data: '2026-09-20T10:00:00' });
  const acertos = { '4': { tentativas: Array.from({ length: TENTATIVAS_PARA_CONFIAR }, () => tent(true)) } };
  const comDados = prioridadeDeEstudo(montarDisciplinas(questoes, acertos), { dificuldades: ['Penal'] });
  exigir(comDados[comDados.length - 1].nome === 'Penal', `com ${TENTATIVAS_PARA_CONFIAR} acertos Penal deveria ir para o fim, ordem: ${comDados.map((d) => d.nome)}`);
  exigir(!comDados.some((d) => d.pontoFraco), 'com dados, nenhuma é ponto fraco pela ficha');

  // Com poucas respostas ainda vale a ficha, mesmo que tenha acertado.
  const poucas = { '4': { tentativas: [tent(true)] } };
  exigir(prioridadeDeEstudo(montarDisciplinas(questoes, poucas), { dificuldades: ['Penal'] })[0].nome === 'Penal', 'uma resposta só não basta para tirar a matéria da frente');

  // Matéria errada de verdade continua antes das "novas", mas a declarada
  // sem dados vem antes: é o que a pessoa disse que precisa.
  const errosEmCivil = { '1': { tentativas: Array.from({ length: 6 }, () => tent(false)) } };
  const misto = prioridadeDeEstudo(montarDisciplinas(questoes, errosEmCivil), { dificuldades: ['Ética'] }).map((d) => d.nome);
  exigir(misto[0] === 'Ética' && misto[1] === 'Civil' && misto[2] === 'Penal', `ordem com dados e ficha: ${misto}`);

  // O plano da semana usa a mesma ordem e diz de onde veio a sugestão.
  const plano = planoDaSemana({ disciplinas: semHistorico, tentativas: {}, meta: 10, hoje: new Date('2026-09-25T09:00:00'), dificuldades: ['Penal'] });
  exigir(plano[0].disciplina === 'Penal', `o cronograma deveria começar pela matéria difícil, veio ${plano[0].disciplina}`);
  exigir(/ponto fraco/.test(plano[0].motivo || ''), `o motivo deveria citar a ficha: ${plano[0].motivo}`);
}

if (falhas.length > 0) {
  console.error(`✗ ${falhas.length} falha(s) em ficha.test.js:`);
  for (const f of falhas) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('✓ ficha.test.js: fila de profile_data, passos da ficha e pontos fracos na prioridade');
