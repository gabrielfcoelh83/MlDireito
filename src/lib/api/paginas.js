// Percorrer uma rota paginada até o fim.
//
// Mora fora de `api.js` pelo mesmo motivo de `acervo.js`: aquele arquivo lê
// `import.meta.env` e não roda no `node`, e o laço é justamente a parte que
// precisa de teste. Um `>=` trocado por `>` ou um offset que não avança não
// lançam erro nenhum — só entregam uma lista cortada ou repetida, que a tela
// mostra como se estivesse certa.

/**
 * Pede páginas a `buscarPagina(offset)` até somar o `total` que o servidor
 * informa, ou até uma página vir vazia.
 *
 * `buscarPagina` devolve `{ itens, total }`. `chaveDe`, quando dado, descarta
 * item repetido entre páginas — o que acontece com paginação por offset
 * quando uma linha nova entra no topo da lista no meio da leitura.
 *
 * `completo` é falso só quando `maxPaginas` estourou: o teto existe para um
 * servidor que devolva sempre a mesma página não prender o laço, e quem chama
 * decide o que fazer com a lista parcial.
 */
export async function percorrerPaginas(buscarPagina, { maxPaginas, chaveDe } = {}) {
  const itens = [];
  const vistos = new Set();
  let offset = 0;

  for (let pagina = 0; pagina < maxPaginas; pagina++) {
    const { itens: daPagina, total } = await buscarPagina(offset);

    for (const item of daPagina) {
      if (chaveDe) {
        const chave = String(chaveDe(item));
        if (vistos.has(chave)) continue;
        vistos.add(chave);
      }
      itens.push(item);
    }

    // O offset anda pelo que o SERVIDOR devolveu, não pelo que sobrou depois
    // de tirar as repetidas: é a posição na lista dele que conta. E o `total`
    // é o da última página, porque a lista pode ter crescido desde a primeira.
    offset += daPagina.length;
    if (daPagina.length === 0 || offset >= total) return { itens, completo: true };
  }

  return { itens, completo: false };
}
