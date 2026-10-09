// Sequência de dias e meta do dia com a folga da ficha (src/lib/metrics.js).
//
// Datas sem "Z" são hora local de propósito: o test:lib roda este arquivo em
// UTC e em America/Sao_Paulo, e a sequência conta dias do calendário local.
// Outubro de 2026: 5 é segunda; 3 e 4 são sábado e domingo.

import { sequenciaAtual, metaDiaria, dateKey } from '../src/lib/metrics.js';
import { diasDeEstudoDaFicha } from '../src/lib/agenda.js';

const falhas = [];
const exigir = (condicao, mensagem) => {
  if (!condicao) falhas.push(mensagem);
};

const SEG_A_SEX = [1, 2, 3, 4, 5];
// Uma resposta às 10h locais em cada dia da lista.
const respostas = (...dias) => ({
  q1: { tentativas: dias.map((d) => ({ correta: true, data: `${d}T10:00:00` })) },
});
const dia = (chave, hora = 15) => {
  const [y, m, d] = chave.split('-').map(Number);
  return new Date(y, m - 1, d, hora);
};
const seq = (tentativas, hoje, diasDeEstudo, historico = []) => sequenciaAtual(tentativas, historico, dia(hoje), diasDeEstudo).dias;

const SEMANA = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']; // seg a sex

// --- a ficha nunca deixa "todo dia é folga" ---
{
  exigir(diasDeEstudoDaFicha({ diasDaSemana: [] }) === null, 'ficha sem dias = sem ficha (todos de estudo)');
  exigir(diasDeEstudoDaFicha({}) === null, 'ficha sem diasDaSemana = todos de estudo');
}

// --- sequência com folga ---
{
  // Estudou seg–sex; hoje é segunda e ainda não respondeu: sáb/dom são folga.
  exigir(seq(respostas(...SEMANA), '2026-10-05', SEG_A_SEX) === 5, `seg–sex, hoje segunda sem nada: ${seq(respostas(...SEMANA), '2026-10-05', SEG_A_SEX)}, esperado 5`);
  // ...e respondeu na segunda.
  exigir(seq(respostas(...SEMANA, '2026-10-05'), '2026-10-05', SEG_A_SEX) === 6, 'seg–sex + segunda = 6');
  // Faltou na quarta (dia de estudo): quebra ali.
  const semQuarta = SEMANA.filter((d) => d !== '2026-09-30');
  exigir(seq(respostas(...semQuarta, '2026-10-05'), '2026-10-05', SEG_A_SEX) === 3, `faltou na quarta: ${seq(respostas(...semQuarta, '2026-10-05'), '2026-10-05', SEG_A_SEX)}, esperado 3`);
  // Estudar na folga soma.
  exigir(seq(respostas(...SEMANA, '2026-10-03', '2026-10-05'), '2026-10-05', SEG_A_SEX) === 7, 'sábado de folga com estudo soma');
  // Hoje é sábado (folga), sem nada: a sequência da semana continua.
  exigir(seq(respostas(...SEMANA), '2026-10-03', SEG_A_SEX) === 5, 'sábado de folga não quebra');
  exigir(seq(respostas(...SEMANA), '2026-10-04', SEG_A_SEX) === 5, 'domingo de folga, depois de sábado de folga, não quebra');
  // Segunda sem nada e terça (hoje) sem nada: a segunda era dia de estudo.
  exigir(seq(respostas(...SEMANA), '2026-10-06', SEG_A_SEX) === 0, 'segunda de estudo vazia quebra');
  // Simulado concluído também é atividade.
  const simulado = [{ quantidade: 10, acertos: 5, data_conclusao: '2026-10-02T18:00:00' }];
  exigir(seq(respostas('2026-10-01'), '2026-10-05', SEG_A_SEX, simulado) === 2, 'simulado conta como dia de estudo');
  // Virada de mês: qui 29/10, sex 30/10, (sáb 31, dom 1º folga), seg 2/11.
  exigir(seq(respostas('2026-10-29', '2026-10-30', '2026-11-02'), '2026-11-02', SEG_A_SEX) === 3, 'virada de mês com fim de semana de folga');
  exigir(seq(respostas('2026-10-29', '2026-10-30'), '2026-11-02', SEG_A_SEX) === 2, 'virada de mês, hoje ainda sem resposta');
  // Folga no meio da semana (estuda seg, qua, sex).
  exigir(seq(respostas('2026-09-28', '2026-09-30', '2026-10-02'), '2026-10-02', [1, 3, 5]) === 3, 'folga em ter/qui não quebra');
  // Fim do dia: 23h30 locais ainda é o dia.
  exigir(sequenciaAtual(respostas(...SEMANA), [], dia('2026-10-02', 23), SEG_A_SEX).dias === 5, 'tarde da noite ainda é o mesmo dia');
  const r = sequenciaAtual(respostas(...SEMANA), [], dia('2026-10-05'), SEG_A_SEX);
  exigir(r.ultimaAtividade === '2026-10-02', `ultimaAtividade: ${r.ultimaAtividade}`);
  exigir(sequenciaAtual({}, [], dia('2026-10-05'), SEG_A_SEX).dias === 0, 'sem atividade, 0');
}

// --- sem ficha (ou todos os dias de estudo): idêntico à regra antiga ---
// A regra de antes, copiada como era: só vale a sequência que termina hoje
// ou ontem, contada a partir do dia mais recente.
function sequenciaAntiga(usuarioTentativas, hoje) {
  const dias = new Set();
  for (const r of Object.values(usuarioTentativas)) for (const t of r.tentativas) dias.add(dateKey(t.data));
  if (dias.size === 0) return 0;
  const ordenados = [...dias].sort();
  const diff = (a, b) => Math.round((new Date(a + 'T00:00:00') - new Date(b + 'T00:00:00')) / 86400000);
  if (diff(dateKey(hoje), ordenados[ordenados.length - 1]) > 1) return 0;
  let streak = 1;
  for (let i = ordenados.length - 1; i > 0; i--) {
    if (diff(ordenados[i], ordenados[i - 1]) === 1) streak++;
    else break;
  }
  return streak;
}
{
  exigir(seq(respostas(...SEMANA), '2026-10-05', null) === 0, 'sem ficha, fim de semana vazio quebra');
  exigir(seq(respostas(...SEMANA), '2026-10-03', null) === 5, 'sem ficha, ontem conta (gap 1)');
  exigir(seq(respostas(...SEMANA, '2026-10-03'), '2026-10-03', null) === 6, 'sem ficha, hoje soma');
  // Sorteio determinístico de agendas, comparado com a regra antiga, e com
  // os sete dias marcados (que é o mesmo que não ter folga).
  let semente = 42;
  const sorteio = () => { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; };
  const base = dia('2026-10-31');
  for (let caso = 0; caso < 300; caso++) {
    const dias = [];
    for (let i = 0; i < 40; i++) {
      if (sorteio() < 0.7) {
        const d = new Date(base); d.setDate(d.getDate() - i);
        dias.push(dateKey(d));
      }
    }
    const tentativas = respostas(...dias);
    const hoje = dia(dateKey(new Date(base.getFullYear(), base.getMonth(), base.getDate() - Math.floor(sorteio() * 5), 15)));
    const antiga = sequenciaAntiga(tentativas, hoje);
    const nova = sequenciaAtual(tentativas, [], hoje, null).dias;
    const todos = sequenciaAtual(tentativas, [], hoje, [0, 1, 2, 3, 4, 5, 6]).dias;
    const semDefault = sequenciaAtual(tentativas, [], hoje).dias;
    if (antiga !== nova || antiga !== todos || antiga !== semDefault) {
      exigir(false, `caso ${caso}: antiga ${antiga}, nova ${nova}, 7 dias ${todos}, sem parâmetro ${semDefault}`);
      break;
    }
  }
}

// --- meta do dia ---
{
  const t = respostas('2026-10-03', '2026-10-03', '2026-10-03');
  t.q1.tentativas = Array.from({ length: 3 }, () => ({ correta: true, data: '2026-10-03T10:00:00' }));
  const sabado = metaDiaria({ meta: 20 }, t, [], dia('2026-10-03'), SEG_A_SEX);
  exigir(sabado.folga === true && sabado.cobrada === false, 'sábado fora da ficha é folga e não é cobrada');
  exigir(sabado.meta === 20 && sabado.respondidas === 3 && sabado.faltam === 17, 'na folga a meta continua o número configurado');
  exigir(sabado.batida === false, 'batida segue respondidas >= meta');
  const segunda = metaDiaria({ meta: 20 }, t, [], dia('2026-10-05'), SEG_A_SEX);
  exigir(segunda.folga === false && segunda.cobrada === true, 'segunda é dia de estudo');
  const semFicha = metaDiaria({ meta: 20 }, t, [], dia('2026-10-03'));
  exigir(semFicha.folga === false && semFicha.cobrada === true, 'sem ficha nunca é folga');
  exigir(semFicha.respondidas === 3 && semFicha.faltam === 17 && semFicha.pct === 15 && semFicha.batida === false, 'sem ficha, os números de antes');
  // Chave 'AAAA-MM-DD' como "hoje": o dia da semana é o local, não o UTC.
  exigir(metaDiaria({ meta: 20 }, {}, [], '2026-10-03', SEG_A_SEX).folga === true, 'hoje como chave: sábado');
  exigir(metaDiaria({ meta: 20 }, {}, [], '2026-10-05', SEG_A_SEX).folga === false, 'hoje como chave: segunda');
  // 23h50 de sexta continua sexta (no Brasil o UTC já é sábado).
  exigir(metaDiaria({ meta: 20 }, {}, [], new Date(2026, 9, 2, 23, 50), SEG_A_SEX).folga === false, 'sexta à noite não vira folga');
}

if (falhas.length > 0) {
  console.error(`✗ ${falhas.length} falha(s) em sequencia.test.js:`);
  for (const f of falhas) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('✓ sequencia.test.js: sequência e meta do dia com a folga da ficha');
