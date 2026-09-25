// Apoio da tela da 2ª fase: o que não é conferência de fundamento
// (`fundamentos.js`) nem rede (`api/api.js`). Puro, testado em
// tests/fundamentos.test.js.

/** "0,60" — como a FGV escreve o valor do item no enunciado. */
export function formatarValor(valor) {
  const n = Number(valor);
  if (valor == null || valor === '' || !Number.isFinite(n)) return null;
  return n.toFixed(2).replace('.', ',');
}

/**
 * A lista do servidor agrupada por exame, do mais recente ao mais antigo, e
 * por número dentro de cada um. O servidor já ordena assim; ordenar de novo
 * aqui é o que impede a lista de embaralhar se um dia ele deixar de ordenar.
 */
export function agruparPorExame(lista) {
  const porExame = new Map();
  for (const q of lista || []) {
    if (!porExame.has(q.exame)) porExame.set(q.exame, []);
    porExame.get(q.exame).push(q);
  }
  return [...porExame.entries()]
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([exame, questoes]) => ({
      exame,
      questoes: [...questoes].sort((a, b) => Number(a.numero) - Number(b.numero)),
    }));
}

/**
 * O rascunho ainda é o texto que foi enviado? Item ausente vale como vazio:
 * o envio leva todos os itens, o rascunho só os que a pessoa tocou.
 */
export function mesmoRascunho(rascunho, respostas) {
  const letras = new Set([...Object.keys(rascunho || {}), ...Object.keys(respostas || {})]);
  return [...letras].every((l) => (rascunho?.[l] || '') === (respostas?.[l] || ''));
}

/** Quantos itens têm algum texto escrito. */
export function respostasPreenchidas(respostas) {
  return Object.values(respostas || {}).filter((t) => typeof t === 'string' && t.trim() !== '').length;
}
