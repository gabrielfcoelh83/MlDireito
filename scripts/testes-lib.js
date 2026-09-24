// Roda os testes de lib/: todo `tests/*.test.js`, menos os que precisam de
// servidor no ar.
//
// Um laço, e não uma lista no package.json, porque a lista foi o que deixou
// `test:estado` e `test:questoes` fora da CI desde que nasceram: cada teste
// novo precisava lembrar de entrar no script e no workflow, e nenhum entrou.
// Passavam na máquina de quem escreveu e nenhum PR os rodava. Com o laço,
// arquivo novo em tests/ roda na próxima CI sem ninguém lembrar de nada.

import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Chamam o gateway, o dev-api e serviços pagos: rodam em passo próprio da CI,
// com o backend no ar (`test:api` no ci.yml).
const PRECISAM_DE_SERVIDOR = new Set(['api.test.js']);

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pasta = path.join(raiz, 'tests');

const arquivos = readdirSync(pasta)
  .filter((f) => f.endsWith('.test.js') && !PRECISAM_DE_SERVIDOR.has(f))
  .sort();

// Zero arquivos é pasta renomeada ou filtro quebrado, não "tudo passou".
if (arquivos.length === 0) {
  console.error('Nenhum teste de lib encontrado em tests/.');
  process.exit(1);
}

// Roda todos antes de reprovar: quem abriu o PR vê de uma vez tudo o que
// quebrou, em vez de consertar um arquivo por rodada de CI.
const reprovados = [];
for (const arquivo of arquivos) {
  console.log(`\n▶ ${arquivo}`);
  const { status } = spawnSync(process.execPath, [path.join(pasta, arquivo)], {
    stdio: 'inherit',
    cwd: raiz,
  });
  if (status !== 0) reprovados.push(arquivo);
}

if (reprovados.length > 0) {
  console.error(`\n❌ ${reprovados.length} de ${arquivos.length} arquivo(s) reprovado(s): ${reprovados.join(', ')}`);
  process.exit(1);
}

console.log(`\n✅ ${arquivos.length} arquivo(s) de teste de lib passaram.`);
