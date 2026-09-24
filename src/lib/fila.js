// Enviar uma lista ao servidor um item de cada vez.
//
// Existe por causa do simulado: ele mandava um POST por resposta, todos
// juntos. O nginx aceita 30 pedidos por segundo com folga de 50, e numa prova
// de 80 questões umas 30 respostas voltavam 429 sem virar tentativa — sumiam
// do desempenho por disciplina, da revisão, da meta e da taxa de acertos. Em
// fila, a prova inteira cabe no limite.

/**
 * Chama `enviar(item)` para cada item, esperando um terminar antes de mandar
 * o próximo. `enviar` devolve `true` quando o item foi salvo; se lançar, o
 * item conta como falha e a fila segue.
 *
 * Antes de cada envio pergunta a `continuar()` se ainda faz sentido. É por ali
 * que quem chama para a fila quando a sessão acaba: o resto não pode sair com
 * o token de outra pessoa.
 */
export async function enviarEmFila(itens, enviar, { continuar = () => true } = {}) {
  let salvos = 0;
  let falhas = 0;

  for (const item of itens) {
    if (!continuar()) return { salvos, falhas, interrompida: true };

    let ok = false;
    try {
      ok = (await enviar(item)) === true;
    } catch {
      ok = false;
    }
    if (ok) salvos += 1;
    else falhas += 1;
  }

  return { salvos, falhas, interrompida: false };
}
