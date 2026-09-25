// A fila das gravações de `profile_data`.
//
// O user-service SUBSTITUI a coluna inteira a cada PUT (`COALESCE($3,
// profile_data)`: não mescla). Enquanto só havia meta e data da prova, mandar
// as duas bastava. Com a ficha de boas-vindas em `profile_data.ficha`, um PUT
// de `{ meta, dataProva }` apagaria a ficha — e a pessoa voltaria a vê-la no
// próximo acesso. Então todo PUT leva o objeto completo: o último que o
// servidor confirmou, com a mudança por cima.
//
// "O último que o servidor confirmou" é lido na hora em que o PUT sai, não na
// hora em que entrou na fila: meta e ficha enfileiradas em seguida saem uma
// depois da outra, e a segunda já parte do que a primeira gravou. Uma de
// cada vez pelo mesmo motivo de antes — dois PUT soltos podem chegar fora de
// ordem e o mais velho sobrescrever o mais novo.

/** O objeto completo a gravar: o conhecido, com a mudança por cima. */
export function mesclarPreferencias(conhecido, parcial) {
  return { ...(conhecido || {}), ...(parcial || {}) };
}

export class PerfilDesconhecidoError extends Error {
  constructor() {
    super('seu perfil ainda não carregou. Tente de novo em instantes.');
    this.name = 'PerfilDesconhecidoError';
  }
}

/**
 * `salvar(preferenciasCompletas, extra)` faz o PUT e devolve o que o servidor
 * respondeu, com `preferencias` (o `profile_data` gravado). `extra` passa
 * direto (o nome, que vai no mesmo PUT da ficha).
 *
 * Uma fila por sessão: a da sessão anterior pode ainda ter um PUT no ar, e
 * ele não pode ensinar a esta o `profile_data` de outra conta.
 */
export function criarFilaDePreferencias(salvar) {
  // null = ainda não sabemos o que o servidor tem. Gravar assim apagaria o
  // que estiver lá (a ficha, por exemplo), então não grava.
  let conhecido = null;
  let cauda = Promise.resolve();

  return {
    conhecer(preferencias) {
      conhecido = { ...(preferencias || {}) };
    },
    conhecido: () => conhecido,

    /**
     * Entra na fila. Resolve com a resposta do servidor, ou com `null` se
     * `continuar()` disser que a sessão acabou antes da vez (o PUT não sai).
     * Rejeita com o erro do PUT, ou `PerfilDesconhecidoError`.
     */
    gravar(parcial, { continuar = () => true, extra } = {}) {
      const vez = cauda.then(async () => {
        if (!continuar()) return null;
        if (conhecido == null) throw new PerfilDesconhecidoError();
        const resposta = await salvar(mesclarPreferencias(conhecido, parcial), extra);
        conhecido = { ...(resposta?.preferencias || mesclarPreferencias(conhecido, parcial)) };
        return resposta;
      });
      // A falha de um PUT não trava os seguintes.
      cauda = vez.catch(() => {});
      return vez;
    },
  };
}
