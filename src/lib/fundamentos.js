// Confere se uma resposta discursiva cita os fundamentos do padrão de
// resposta da FGV.
//
// Não é correção: a banca pontua a fundamentação, e o próprio enunciado avisa
// que citar o artigo sozinho não pontua. O que dá para conferir sem IA é o
// que a cliente pediu — "bater se eu fundamentar e colocar o artigo certo" —,
// e é só isso que este módulo faz.
//
// A comparação é no nível diploma + artigo (ou súmula + tribunal). Parágrafo,
// inciso e alínea ficam como detalhe exibido: quem escreveu "art. 1.659, I,
// do CC" e quem escreveu "art. 1.659 do CC" citaram o mesmo fundamento, e
// cobrar o inciso aqui daria "errado" para uma resposta que a banca aceitaria.

// ---------------------------------------------------------------------------
// Diplomas
// ---------------------------------------------------------------------------
//
// `nome` casa sem diferenciar maiúsculas; `sigla`, só em maiúsculas. "cf."
// (confira) e "cc" (com cópia) aparecem em texto corrido, e ler um deles como
// Constituição ou Código Civil inventaria uma citação.

const DIPLOMAS = [
  { id: 'CC', nome: 'c[óo]digo\\s+civil(?:\\s+brasileiro)?(?:\\s+de\\s+2002)?', sigla: 'CCB?(?:\\s*\\/\\s*(?:20)?02)?' },
  { id: 'CPC', nome: 'c[óo]digo\\s+de\\s+processo\\s+civil(?:\\s+de\\s+2015)?', sigla: 'N?CPC(?:\\s*\\/\\s*(?:20)?15)?' },
  { id: 'CDC', nome: 'c[óo]digo\\s+de\\s+defesa\\s+do\\s+consumidor', sigla: 'CDC' },
  { id: 'CF', nome: 'constitui[çc][ãa]o(?:\\s+federal|\\s+da\\s+rep[úu]blica)?(?:\\s+de\\s+1988)?', sigla: '(?:CRFB|CF)(?:\\s*\\/\\s*(?:19)?88)?' },
  { id: 'CP', nome: 'c[óo]digo\\s+penal', sigla: 'CP' },
  { id: 'CPP', nome: 'c[óo]digo\\s+de\\s+processo\\s+penal', sigla: 'CPP' },
  { id: 'CTN', nome: 'c[óo]digo\\s+tribut[áa]rio\\s+nacional', sigla: 'CTN' },
  { id: 'CLT', nome: 'consolida[çc][ãa]o\\s+das\\s+leis\\s+do\\s+trabalho', sigla: 'CLT' },
  { id: 'ECA', nome: 'estatuto\\s+da\\s+crian[çc]a\\s+e\\s+do\\s+adolescente', sigla: 'ECA' },
  { id: 'LINDB', nome: 'lei\\s+de\\s+introdu[çc][ãa]o\\s+[àa]s\\s+normas\\s+do\\s+direito\\s+brasileiro', sigla: 'LINDB' },
  { id: 'LGPD', nome: 'lei\\s+geral\\s+de\\s+prote[çc][ãa]o\\s+de\\s+dados(?:\\s+pessoais)?', sigla: 'LGPD' },
  { id: 'EPD', nome: 'estatuto\\s+da\\s+pessoa\\s+com\\s+defici[êe]ncia', sigla: 'EPD' },
  { id: 'Lei 6.015', nome: 'lei\\s+de\\s+registros\\s+p[úu]blicos', sigla: 'LRP' },
  { id: 'Lei 8.245', nome: 'lei\\s+do\\s+inquilinato|lei\\s+de\\s+loca[çc][õo]es', sigla: null },
];

// "da CF", "da LGPD", "da Lei 6.015"; "do CC", "do CPC".
const FEMININOS = new Set(['CF', 'CLT', 'LINDB', 'LGPD']);

// Lei citada pelo número. As que têm sigla própria viram a sigla: "Lei nº
// 8.078/90, art. 14" e "art. 14 do CDC" são o mesmo fundamento.
const LEI = '(?:lei|l\\.)\\s+(?:federal\\s+)?(?:n(?:[º°o]|\\.\\s*[º°o]?)?\\s*)?(\\d{1,2}\\.?\\d{3})(?:\\s*\\/\\s*(\\d{2,4}))?';
const LEI_COM_SIGLA = { 8078: 'CDC', 8069: 'ECA', 10406: 'CC', 13105: 'CPC', 13709: 'LGPD', 13146: 'EPD' };

const FIM_DE_PALAVRA = '(?![\\p{L}\\d])';
const INICIO_DE_PALAVRA = '(?<![\\p{L}\\d])';

const sticky = (fonte, i) => new RegExp(fonte + FIM_DE_PALAVRA, i ? 'iuy' : 'uy');
const noFim = (fonte, i) => new RegExp(INICIO_DE_PALAVRA + '(?:' + fonte + ')[\\s,]*$', i ? 'iu' : 'u');

const DIPLOMA_EM = DIPLOMAS.flatMap((d) => [
  { id: d.id, re: sticky(d.nome, true) },
  ...(d.sigla ? [{ id: d.id, re: sticky(d.sigla, false) }] : []),
]);
const DIPLOMA_ANTES = DIPLOMAS.flatMap((d) => [
  { id: d.id, re: noFim(d.nome, true) },
  ...(d.sigla ? [{ id: d.id, re: noFim(d.sigla, false) }] : []),
]);
const LEI_EM = sticky(LEI, true);
const LEI_ANTES = noFim(LEI, true);

function idDaLei(numero) {
  const n = Number(numero.replace(/\./g, ''));
  return LEI_COM_SIGLA[n] || `Lei ${milhar(String(n))}`;
}

// O diploma que começa exatamente em `pos`.
function diplomaEm(texto, pos) {
  for (const { id, re } of DIPLOMA_EM) {
    re.lastIndex = pos;
    const m = re.exec(texto);
    if (m) return { id, fim: pos + m[0].length };
  }
  LEI_EM.lastIndex = pos;
  const lei = LEI_EM.exec(texto);
  if (lei) return { id: idDaLei(lei[1]), fim: pos + lei[0].length };
  return null;
}

// "…, do CC", " da Lei nº 8.078/90", " (CPC)", ", ambos do CC", ", do mesmo diploma".
const ANTES_DO_DIPLOMA = /[\s,]*\(?\s*(?:amb[oa]s\s+)?(?:(?:d[oa]s?|n[oa]s?|em)\s+)?/iuy;
const MESMO_DIPLOMA = new RegExp('mesm[oa]\\s+(?:diploma|c[óo]digo|lei|estatuto)' + FIM_DE_PALAVRA, 'iuy');

function diplomaAdiante(texto, pos) {
  ANTES_DO_DIPLOMA.lastIndex = pos;
  const filler = ANTES_DO_DIPLOMA.exec(texto);
  const inicio = pos + (filler ? filler[0].length : 0);

  MESMO_DIPLOMA.lastIndex = inicio;
  const mesmo = MESMO_DIPLOMA.exec(texto);
  if (mesmo) return { id: null, mesmo: true, fim: inicio + mesmo[0].length };

  const achado = diplomaEm(texto, inicio);
  if (!achado) return null;
  let fim = achado.fim;
  if (texto[fim] === ')') fim += 1;
  return { ...achado, fim };
}

// "CC, art. 186", "Lei nº 8.078/90, art. 14": o diploma vem antes.
function diplomaAtras(texto, pos) {
  const trecho = texto.slice(Math.max(0, pos - 90), pos);
  for (const { id, re } of DIPLOMA_ANTES) {
    if (re.test(trecho)) return id;
  }
  const lei = LEI_ANTES.exec(trecho);
  return lei ? idDaLei(lei[1]) : null;
}

// ---------------------------------------------------------------------------
// Artigos
// ---------------------------------------------------------------------------

const RE_ART = new RegExp(INICIO_DE_PALAVRA + '(?:arts?\\.?|artigos?)\\s*(?=\\d)', 'giu');

// 1.659 e 1659 são o mesmo artigo; "5º" e "5o" também. "1.240-A" existe.
const RE_NUMERO = /(\d{1,3}(?:\.\d{3})+|\d+)(?:\s*[º°o](?![\p{L}\d]))?(?:\s*-\s*([A-Z])(?![\p{L}\d]))?/uy;

// Parágrafo, inciso, alínea: o detalhe que acompanha o artigo. O romano solto
// ("art. 1.659, I") só é aceito em maiúsculas e depois de conferido que não é
// sigla de diploma — "CC" e "CDC" são letras romanas válidas.
const RE_DETALHE = new RegExp(
  '(?:(?:e|ou)\\s+)?(?:'
  + '§{1,2}\\s*\\d+\\s*[º°o]?(?:\\s*(?:e|ou|,)\\s*§?\\s*\\d+\\s*[º°o]?(?![\\p{L}\\d]))*'
  + '|par[áa]grafo\\s+(?:[úu]nico|\\d+\\s*[º°o]?)'
  + '|p\\.\\s*[úu]\\.'
  + '|caput|in\\s+fine|parte\\s+final|(?:primeira|segunda)\\s+parte'
  + '|incisos?\\s+[IVXLCDM]+(?:\\s*(?:e|ou|,|a)\\s*[IVXLCDM]+(?![\\p{L}\\d]))*'
  + '|inc\\.\\s*[IVXLCDM]+'
  + '|al[íi]neas?\\s+["“\']?[a-z]["”\']?'
  + '|[IVXLCDM]+'
  + ')' + FIM_DE_PALAVRA,
  'uy',
);
const RE_ESPACO_VIRGULA = /[\s,]*/y;

// Entre um artigo e o próximo do mesmo grupo: "arts. 186 e 927",
// "art. 186 c/c 927", "art. 876 ou 877", "arts. 186, 187 e 927".
const RE_CONTINUACAO = new RegExp(
  '[\\s,]*(?:(e|ou|c\\/c|c\\.c\\.)\\s+)?(?:(?:o|os|do|dos|no|nos)\\s+)?(?:(?:arts?\\.?|artigos?)\\s*)?(?=\\d)',
  'iuy',
);
// Um número só continua o grupo se o que vem depois tem cara de citação.
// Sem isto, "art. 186 e 10 testemunhas" citaria um art. 10.
const RE_DEPOIS_DO_NUMERO = /(?:[º°o](?![\p{L}\d])|\s*-\s*[A-Z](?![\p{L}\d])|\s*(?:[,;.:)]|$|§|\(|(?:e|ou|d[oa]s?|n[oa]s?|c\/c|caput|inciso|par[áa]grafo|al[íi]nea)(?![\p{L}\d])))/iuy;

function lerNumero(texto, pos) {
  RE_NUMERO.lastIndex = pos;
  const m = RE_NUMERO.exec(texto);
  if (!m) return null;
  const artigo = m[1].replace(/\./g, '') + (m[2] ? `-${m[2]}` : '');
  return { artigo, fim: pos + m[0].length };
}

function lerDetalhes(texto, pos) {
  const detalhes = [];
  let q = pos;
  for (;;) {
    RE_ESPACO_VIRGULA.lastIndex = q;
    const inicio = q + RE_ESPACO_VIRGULA.exec(texto)[0].length;
    if (diplomaAdiante(texto, q)) break;
    RE_DETALHE.lastIndex = inicio;
    const m = RE_DETALHE.exec(texto);
    if (!m) break;
    detalhes.push(m[0].replace(/\s+/g, ' ').trim());
    q = inicio + m[0].length;
  }
  return { detalhe: detalhes.join(', '), fim: q };
}

function lerGrupoDeArtigos(texto, pos) {
  const artigos = [];
  let q = pos;
  let conector = null;

  for (;;) {
    const numero = lerNumero(texto, q);
    if (!numero) break;
    const { detalhe, fim } = lerDetalhes(texto, numero.fim);
    artigos.push({ artigo: numero.artigo, detalhe, alternativaDaAnterior: conector === 'ou' });
    q = fim;

    if (diplomaAdiante(texto, q)) break;
    RE_CONTINUACAO.lastIndex = q;
    const cont = RE_CONTINUACAO.exec(texto);
    if (!cont) break;
    const inicioNumero = q + cont[0].length;
    const proximo = lerNumero(texto, inicioNumero);
    if (!proximo) break;
    RE_DEPOIS_DO_NUMERO.lastIndex = proximo.fim;
    if (!RE_DEPOIS_DO_NUMERO.test(texto)) break;
    conector = cont[1] ? cont[1].toLowerCase() : null;
    q = inicioNumero;
  }

  return { artigos, fim: q };
}

// ---------------------------------------------------------------------------
// Súmulas
// ---------------------------------------------------------------------------

const RE_SUMULA = new RegExp(
  INICIO_DE_PALAVRA
  + 's[úu]mula\\s+(vinculante\\s+)?(?:n(?:[º°o]|\\.\\s*[º°o]?)?\\s*)?(\\d+)'
  + '(?:\\s*,?\\s*(?:d[oa]\\s+)?(STJ|STF|TST|superior\\s+tribunal\\s+de\\s+justi[çc]a|supremo\\s+tribunal\\s+federal|tribunal\\s+superior\\s+do\\s+trabalho)'
  + FIM_DE_PALAVRA + ')?',
  'giu',
);

function tribunal(nome, vinculante) {
  if (vinculante) return 'STF';
  if (!nome) return null;
  const n = nome.toLowerCase();
  if (n === 'stj' || n.startsWith('superior')) return 'STJ';
  if (n === 'stf' || n.startsWith('supremo')) return 'STF';
  return 'TST';
}

// ---------------------------------------------------------------------------
// Rótulos
// ---------------------------------------------------------------------------

function milhar(numero) {
  return numero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatarArtigo(artigo) {
  const [numero, letra] = String(artigo).split('-');
  const n = Number(numero);
  const base = n >= 1 && n <= 9 ? `${n}º` : milhar(numero);
  return letra ? `${base}-${letra}` : base;
}

function rotuloDe(citacao) {
  if (citacao.tipo === 'sumula') {
    const nome = citacao.vinculante ? 'Súmula Vinculante' : 'Súmula';
    return citacao.tribunal ? `${nome} ${citacao.numero} do ${citacao.tribunal}` : `${nome} ${citacao.numero}`;
  }
  const art = `Art. ${formatarArtigo(citacao.artigo)}`;
  if (!citacao.diploma) return art;
  const feminino = FEMININOS.has(citacao.diploma) || citacao.diploma.startsWith('Lei ');
  return `${art} ${feminino ? 'da' : 'do'} ${citacao.diploma}`;
}

function chaveDe(citacao) {
  if (citacao.tipo === 'sumula') {
    return `SUM:${citacao.vinculante ? 'V' : ''}${citacao.tribunal || '?'}:${citacao.numero}`;
  }
  return `${citacao.diploma || '?'}:${citacao.artigo}`;
}

// ---------------------------------------------------------------------------
// Extração
// ---------------------------------------------------------------------------

/**
 * As citações legais de um texto, na ordem em que aparecem.
 *
 * Cada uma: `{ tipo: 'artigo'|'sumula', chave, rotulo, detalhe, diploma,
 * artigo, inicio, fim, alternativaDaAnterior }`. `fim` é o fim do grupo
 * inteiro ("arts. 186 e 927 do CC" termina depois de "CC") — é por ele que
 * `esperadosDoGabarito` descobre um "ou" entre dois fundamentos.
 *
 * Número solto não é citação: sem "art."/"artigo"/"Súmula" antes, "1.659"
 * pode ser valor, prazo ou número de processo.
 */
export function extrairCitacoes(texto) {
  const fonte = String(texto || '');
  const citacoes = [];

  RE_ART.lastIndex = 0;
  let m;
  while ((m = RE_ART.exec(fonte))) {
    const inicio = m.index;
    const grupo = lerGrupoDeArtigos(fonte, inicio + m[0].length);
    if (grupo.artigos.length === 0) continue;

    let fim = grupo.fim;
    let diploma = null;
    const adiante = diplomaAdiante(fonte, grupo.fim);
    if (adiante) {
      fim = adiante.fim;
      diploma = adiante.mesmo ? (citacoes.filter((c) => c.tipo === 'artigo').at(-1)?.diploma ?? null) : adiante.id;
    } else {
      diploma = diplomaAtras(fonte, inicio);
    }

    for (const a of grupo.artigos) {
      const citacao = {
        tipo: 'artigo', diploma, artigo: a.artigo, detalhe: a.detalhe,
        alternativaDaAnterior: a.alternativaDaAnterior, inicio, fim,
      };
      citacoes.push({ ...citacao, chave: chaveDe(citacao), rotulo: rotuloDe(citacao) });
    }
    RE_ART.lastIndex = Math.max(RE_ART.lastIndex, grupo.fim);
  }

  RE_SUMULA.lastIndex = 0;
  while ((m = RE_SUMULA.exec(fonte))) {
    const citacao = {
      tipo: 'sumula', vinculante: Boolean(m[1]), numero: m[2], tribunal: tribunal(m[3], m[1]),
      detalhe: '', alternativaDaAnterior: false, inicio: m.index, fim: m.index + m[0].length,
    };
    citacoes.push({ ...citacao, chave: chaveDe(citacao), rotulo: rotuloDe(citacao) });
  }

  return resolverSemDiploma(citacoes.sort((a, b) => a.inicio - b.inicio));
}

// "…na forma do Art. 462 do CC. (…) o Art. 462 adota a liberdade formal…":
// o segundo é o mesmo artigo, só que sem a lei repetida. Se no mesmo texto o
// número aparece com um diploma só, é dele.
function resolverSemDiploma(citacoes) {
  return citacoes.map((c) => {
    if (c.tipo !== 'artigo' || c.diploma != null) return c;
    const diplomas = new Set(citacoes.filter((o) => o.tipo === 'artigo' && o.artigo === c.artigo && o.diploma).map((o) => o.diploma));
    if (diplomas.size !== 1) return c;
    const resolvida = { ...c, diploma: [...diplomas][0] };
    return { ...resolvida, chave: chaveDe(resolvida), rotulo: rotuloDe(resolvida) };
  });
}

// ---------------------------------------------------------------------------
// Gabarito × resposta
// ---------------------------------------------------------------------------

// "…do CC ou do Art. 125…", "…do CPC, ou da Súmula 537…"
const RE_OU_ENTRE = /^[\s,;()]*ou(?![\p{L}\d])/iu;

const opcao = (c) => ({ chave: c.chave, rotulo: c.rotulo, detalhe: c.detalhe });

/**
 * Os fundamentos que o padrão de resposta espera: `[{ rotulo, opcoes }]`.
 *
 * Citações ligadas por "ou" viram UM fundamento com várias opções, e
 * qualquer uma o satisfaz — é assim que a FGV escreve quando aceita mais de
 * um caminho ("Art. 787, §3º, do CC ou do Art. 125, inciso II, do CPC, ou da
 * Súmula 537 do STJ").
 */
export function esperadosDoGabarito(gabarito) {
  const fonte = String(gabarito || '');
  const citacoes = extrairCitacoes(fonte);
  const grupos = [];

  citacoes.forEach((c, i) => {
    const anterior = citacoes[i - 1];
    const ouNoTexto = anterior && anterior.fim <= c.inicio && RE_OU_ENTRE.test(fonte.slice(anterior.fim, c.inicio));
    if (grupos.length > 0 && (c.alternativaDaAnterior || ouNoTexto)) grupos.at(-1).push(c);
    else grupos.push([c]);
  });

  const esperados = [];
  const vistas = new Set();
  for (const grupo of grupos) {
    // O artigo que já é fundamento não volta como opção de outro. Sem isto,
    // "…conforme o Art. 464, parte final, do CC, ou se for do interesse da
    // credora, (…) na forma do Art. 465 do CC" (36º Exame) deixava o art. 465
    // dispensável para quem citou o 464 — que já tinha sido pedido antes.
    const opcoes = [];
    for (const c of grupo) {
      if (!vistas.has(c.chave) && !opcoes.some((o) => o.chave === c.chave)) opcoes.push(opcao(c));
    }
    if (opcoes.length === 0) continue;
    opcoes.forEach((o) => vistas.add(o.chave));
    esperados.push({ rotulo: opcoes.map((o) => o.rotulo).join(' ou '), opcoes });
  }
  return esperados;
}

const numeroDe = (chave) => chave.slice(chave.lastIndexOf(':') + 1);
const tipoDe = (chave) => (chave.startsWith('SUM:') ? 'sumula' : 'artigo');

// Quem escreveu "art. 1.659, I" sem dizer a lei citou o artigo certo; conta,
// mas a tela avisa (`semDiploma`). O inverso — "art. 186 do CP" quando o
// esperado é o do CC — não conta: é outro artigo.
function casa(citada, chaveEsperada) {
  if (citada.chave === chaveEsperada) return { semDiploma: false };
  if (tipoDe(chaveEsperada) !== citada.tipo) return null;
  if (numeroDe(chaveEsperada) !== numeroDe(citada.chave)) return null;

  if (citada.tipo === 'artigo') {
    if (citada.diploma == null) return { semDiploma: true };
    if (chaveEsperada.startsWith('?:')) return { semDiploma: false };
    return null;
  }
  // Súmula sem tribunal casa com a do tribunal esperado.
  if (citada.tribunal == null && citada.vinculante === chaveEsperada.startsWith('SUM:V')) return { semDiploma: true };
  return null;
}

/**
 * Compara a resposta de um item com o gabarito comentado dele.
 *
 * `{ esperados, atendidos, faltando, extras, caminhos, caminho }` —
 * `caminhos` é quantas respostas alternativas o padrão aceita (ver
 * `caminhosDoGabarito`) e `caminho`, qual delas foi usada: a que a resposta
 * mais atende. `atendidos` e `faltando`
 * são esperados (`{ rotulo, opcoes }`), com `citado` nos atendidos: o que a
 * pessoa escreveu que o satisfez. `extras` são citações da resposta que o
 * padrão não traz — não estão erradas por isso, só não estão no gabarito.
 */
export function compararFundamentos(resposta, gabarito) {
  const caminhos = caminhosDoGabarito(gabarito);
  const resultados = caminhos.map((caminho) => compararComCaminho(resposta, caminho));

  // O melhor caminho para esta resposta: maior proporção de fundamentos
  // citados; empatados, o que tem mais citados. Caminho sem artigo nenhum só
  // vence se nenhum tiver — senão ganharia sempre, com "0 de 0".
  let melhor = 0;
  const nota = (r) => (r.esperados.length === 0 ? -1 : r.atendidos.length / r.esperados.length);
  resultados.forEach((r, i) => {
    const atual = resultados[melhor];
    if (nota(r) > nota(atual) || (nota(r) === nota(atual) && r.atendidos.length > atual.atendidos.length)) melhor = i;
  });

  return { ...resultados[melhor], caminhos: caminhos.length, caminho: melhor };
}

// A FGV marca respostas alternativas com uma linha "OU" sozinha entre elas
// (43º Exame, Direito Civil, questão 1, item B: foro de Santos pelo art. 47
// do CPC OU foro de São Paulo pelo art. 46). Cada bloco é um caminho de
// resposta completo, com os fundamentos dele.
const LINHA_OU = /^[ \t]*OU[ \t]*$/gm;

export function caminhosDoGabarito(gabarito) {
  const blocos = String(gabarito || '').split(LINHA_OU).filter((b) => b.trim() !== '');
  return blocos.length > 0 ? blocos : [''];
}

function compararComCaminho(resposta, gabarito) {
  const esperados = esperadosDoGabarito(gabarito);
  const citadas = extrairCitacoes(resposta);

  const atendidos = [];
  const faltando = [];
  for (const esperado of esperados) {
    let achado = null;
    for (const c of citadas) {
      for (const o of esperado.opcoes) {
        const r = casa(c, o.chave);
        if (r && (!achado || (achado.semDiploma && !r.semDiploma))) {
          achado = { rotulo: c.rotulo, detalhe: c.detalhe, semDiploma: r.semDiploma };
        }
      }
    }
    if (achado) atendidos.push({ ...esperado, citado: achado });
    else faltando.push(esperado);
  }

  const extras = [];
  const vistas = new Set();
  for (const c of citadas) {
    if (vistas.has(c.chave)) continue;
    vistas.add(c.chave);
    const noGabarito = esperados.some((e) => e.opcoes.some((o) => casa(c, o.chave)));
    if (!noGabarito) extras.push({ chave: c.chave, rotulo: c.rotulo, detalhe: c.detalhe, semDiploma: c.tipo === 'artigo' && c.diploma == null });
  }

  return { esperados, atendidos, faltando, extras };
}

/**
 * A conferência da questão inteira: um resultado por item, e o total de
 * fundamentos citados e esperados — o `fundamentos` que vai para o servidor.
 */
export function conferirQuestao(itens, respostas) {
  const porItem = {};
  let citados = 0;
  let esperados = 0;
  for (const item of itens || []) {
    const r = compararFundamentos(respostas?.[item.letra] || '', item.gabarito);
    porItem[item.letra] = r;
    citados += r.atendidos.length;
    esperados += r.esperados.length;
  }
  return { porItem, citados, esperados };
}
