# Arquitetura do Frontend - MlDireito

SPA em React 18 + Vite, publicada na Vercel. Não usa React Router nem
biblioteca de estado: a navegação é um campo do estado (`state.screen`) e tudo
desce de `App.jsx` por props.

Os dados vêm de dois lugares diferentes, e a distinção importa em todo o resto
deste documento:

- **Gateway da plataforma de microserviços** — login, perfil, tentativas e
  acervo de questões. Em produção fica em outro domínio (`VITE_API_URL`).
- **Rotas serverless em `api/`** — geração de questões por IA, enriquecimento
  de questão e consulta ao DataJud. Rodam na própria Vercel.

---

## Estrutura de pastas

```
src/
├── main.jsx              # Entry point (StrictMode + App)
├── App.jsx               # Estado global, carga de dados, layout e navegação
├── index.css             # Estilos globais e animações
├── screens/              # Uma tela por arquivo (12, contando o Login)
├── components/ui/        # Componentes usados por mais de um ponto da tela
│   ├── ConfigSimulado.jsx   # Formulário de configuração do simulado
│   ├── Cronometro.jsx       # Timer do simulado
│   └── GeradorQuestoes.jsx  # Gerador por IA — NÃO está em uso (ver Pendências)
└── lib/                  # Lógica pura, testável no `node` sem navegador
    ├── api/api.js        # Único cliente HTTP do gateway
    ├── questions/acervo.js  # Tradução acervo → tela, embaralhar, fontes do quiz
    ├── storage.js        # localStorage com merge de um nível
    ├── metrics.js        # Meta diária, sequência, taxas, evolução, estatísticas
    ├── revisao.js        # O que está errado / não respondido / favoritado
    ├── disciplinas.js    # Disciplinas derivadas do acervo, cores, prioridade
    ├── agenda.js         # Plano da semana e calendário do Cronograma
    ├── perfil.js         # Payload do JWT, nome de exibição, saudação
    ├── navegacao.js      # Menu, título/subtítulo das telas, ícones, tags
    ├── theme.js          # Temas (rosa, azul, verde) e buildStyles()
    ├── icons.jsx         # Ícones SVG (<Icon name=... />)
    └── charts.jsx        # Sparkline, MiniBars, AreaLine, LabeledBars

api/                      # Funções serverless (Vercel)
├── gerar-questoes.js     # OpenRouter
├── enriquecer-questao.js
├── buscar-datajud.js     # DataJud (CNJ)
└── _lib/                 # auth.js (exige login), datajud.js

server/dev-api.js         # Serve as rotas de api/ em dev (o Vite não serve)
tests/                    # Testes unitários da lib/, de API e e2e (Playwright)
```

Os `index.js` de `lib/api/` e `lib/questions/` exportam o módulo como
`default` e ninguém os importa: importe direto do arquivo
(`./lib/api/api`, `./lib/questions/acervo`).

`App.jsx` também desenha o layout — barra lateral, topo, sino de avisos e o
cartão "Foco de hoje". Não existem pastas `layout/`, `hooks/` nem `contexts/`.

---

## Telas

`NAV` em `lib/navegacao.js` define o menu; `App.jsx` renderiza a tela cuja
chave está em `state.screen`. Como a tela atual é salva no localStorage,
recarregar a página volta para ela — mas não há URL por tela.

| Chave | Arquivo | O que faz | Props além das comuns |
|---|---|---|---|
| — | `Login.jsx` | Entrar e criar conta | `onEntrar` |
| `dashboard` | `Dashboard.jsx` | Resumo do dia, próximo passo, evolução | `dash`, `setDash`, `acervo` |
| `cronograma` | `Cronograma.jsx` | Sugestão de semana e calendário do mês | — |
| `questoes` | `Questoes.jsx` | Escolha de fonte e quiz | `quest`, `setQuest`, `registrar`, `anotarFeedback`, `acervo`, `recarregarAcervo` |
| `simulados` | `Simulados.jsx` | Configurar, cronometrar e corrigir simulado | `sim`, `setSim`, `setResultadosHistorico`, `registrar` |
| `revisoes` | `Revisoes.jsx` | Erradas, favoritas, menor desempenho | `rev`, `setRev`, `favoritos`, `toggleFavorito` |
| `desempenho` | `Desempenho.jsx` | Evolução ao longo do tempo | `perf`, `setPerf` |
| `estatisticas` | `Estatisticas.jsx` | Números por período e disciplina | `filtros`, `setFiltros` |
| `favoritos` | `Favoritos.jsx` | Questões marcadas com estrela | `favoritos`, `toggleFavorito` |
| `disciplinas` | `Disciplinas.jsx` | Aproveitamento por matéria e tema | `disc`, `setDisc` |
| `anotacoes` | `Anotacoes.jsx` | Notas com pastas e tags | `notas`, `setNotas` |
| `configuracoes` | `Configuracoes.jsx` | Nome, meta, data da prova, tema | `perfil`, `nome`, `atualizarNome`, `atualizarConfig`, `themeKey`, `setTheme` |

Props comuns (`screenProps`): `theme`, `s` (estilos de `buildStyles`), `data`
(`{ QUESTOES, DISCIPLINAS }`), `go`, `usuarioTentativas`, `disciplinas`,
`revisao`, `resultados_historico`, `config`, `revisarQuestoes`,
`praticarDisciplina`.

---

## Estado

O estado se divide pela **origem do dado**, não pela tela. Misturar os dois
tipos é o que fazia uma gravação que falhou divergir em silêncio do servidor.

| Tipo | Onde fica | Persistência | Conteúdo |
|---|---|---|---|
| Interface | `state` (`DEFAULT_STATE`) | localStorage (`ma-questoes-state-v1`) | tema, tela atual, filtros de cada tela, quiz em andamento, favoritos, anotações, histórico de simulado |
| Servidor | `useState` próprios | nenhuma — recarregados a cada sessão | `acervo`, `usuarioTentativas`, `perfil`, `sessao`, `erroSync` |

Meta diária e data da prova são o caso misto: ficam em
`state.configuracoes` para a tela responder na hora, mas o servidor
(`profile_data` do perfil) é a fonte da verdade e sobrescreve o valor local
ao carregar o perfil.

```javascript
const DEFAULT_STATE = {
  __usuario: null,         // de quem é o estado salvo neste navegador
  theme: 'rosa',
  screen: 'dashboard',
  dashboard: { period: '7' },
  cronograma: {},
  questoes: { selected, quiz, idx, selectedAlt, certas, erradas, done },
  simulados: { running: {}, resultados_historico: [] },  // ver Pendências
  revisoes: { tab: 'todas' },
  desempenho: { period: '6' },
  estatisticas: { range: '30d', disc: 'Todas' },
  disciplinas: { openNome: null },
  anotacoes: { folder: 'Todas', activeId: null, itens: [] },
  favoritos: [],
  configuracoes: { meta: 20, dataProva: null },
  resultados_historico: [],  // histórico real dos simulados
};
```

Regras que o código já garante:

- **Merge de um nível** (`loadState`): campo novo dentro de uma fatia chega a
  quem já tinha estado salvo. Com `{...defaults, ...salvo}` a fatia salva
  inteira venceria e o campo novo nunca apareceria para usuário antigo.
- **Troca de conta**: se `__usuario` não bate com o perfil carregado, o estado
  recomeça do padrão (mantendo só o tema).
- **Logout** (`sair`): apaga o token, zera o estado da interface **e o
  localStorage** — favoritos e anotações incluídos.
- **Fatias por tela**: cada tela recebe a sua fatia e um setter montado com
  `updateSlice(chave, parcial)`, que aceita objeto (merge) ou função.

### Refs de gravação assíncrona

- `registroPendente` — `Map` de questão → promessa do POST da tentativa. O
  quiz não espera a rede; o feedback ("foi chute", "eliminei") espera essa
  promessa porque precisa do `id` que o POST devolve.
- `sessaoEpoch` — contador incrementado no logout. Toda escrita de estado
  depois de um `await` confere se a sessão ainda é a mesma, para uma resposta
  que chega atrasada não reaparecer para a próxima pessoa.
- `gravacaoDePreferencias` — fila de uma só para os PUT de perfil: dois PUT
  soltos podem chegar fora de ordem e o mais velho sobrescrever o mais novo.

---

## Comunicação com a API

Todo acesso ao gateway passa por `lib/api/api.js`, com `fetch`. O `axios` do
`package.json` é usado só pelas funções de `api/` e pelos testes.

**Autenticação.** O login devolve um JWT, guardado em
`ma-questoes-token-v1` (chave separada do estado, para limpar um não derrubar
o outro) e enviado como `Authorization: Bearer`. Qualquer 401 apaga o token e
o `App` volta para o Login.

**Erros.** Toda falha vira `ApiError(message, status)`. `status` 0 significa
que a requisição não chegou (rede ou CORS — o navegador não deixa distinguir).
Erro de carga de tentativas e de gravação aparece na faixa `erroSync` do topo;
erro do acervo aparece na própria tela de Questões, com botão de recarregar.

| Função | Rota | Observação |
|---|---|---|
| `login`, `criarConta` | `POST /api/auth/login`, `/register` | o register já devolve token |
| `buscarPerfil`, `salvarPerfil` | `GET`/`PUT /api/users/:id` | nome e `profile_data` |
| `listarTentativas` | `GET /api/tentativas?limite=1000` | agrupa por questão, ordem cronológica |
| `registrarTentativa` | `POST /api/tentativas` | |
| `anotarFeedbackTentativa` | `PATCH /api/tentativas/:id` | tipo e certeza da resposta |
| `listarQuestoes` | `GET /api/questoes?paginado=1` | percorre as páginas até somar `total`; aceita também o formato antigo (array) |

### Rotas serverless

As três rotas de `api/` exigem login: `_lib/auth.js` valida o token contra o
gateway (`POST /api/auth/verify`) em vez de duplicar o segredo do JWT na
Vercel. Hoje nenhuma tela do app as chama.

### Dev x produção

- **Produção:** chamadas ao gateway usam a URL absoluta de `VITE_API_URL` (um
  build sem ela falha com mensagem explícita, em vez de um 404 na Vercel); as
  rotas de `api/` são relativas à própria Vercel.
- **Dev:** `VITE_API_URL` fica vazia e o proxy do `vite.config.js` separa os
  dois backends que dividem o prefixo `/api`:
  - `/api/auth`, `/api/tentativas`, `/api/questoes`, `/api/users` → gateway
    em `localhost:3000` (`GATEWAY_PORT`)
  - resto de `/api` → `server/dev-api.js` em `localhost:3100` (`DEV_API_PORT`)

  Rota nova do gateway precisa de linha própria no proxy, acima de `/api`;
  sem ela o pedido cai no dev-api e falha de um jeito que parece bug de tela.

---

## Rodar e testar

```bash
# Backend (postgres, redis, auth, user, estudo, questoes, gateway) com usuário de teste
./scripts/e2e-backend.sh

# Rotas de api/ — a porta padrão do script é 3000, que é a do gateway
PORT=3100 node server/dev-api.js

# Front
npm run dev
```

| Script | O que roda | Na CI? |
|---|---|---|
| `npm run lint` | ESLint | sim |
| `npm run build` | build de produção | sim |
| `npm run test:e2e` | Playwright contra `npm run dev` + backend do script acima | sim |
| `npm run test:api` | rotas de `api/` recusam pedido sem token | sim |
| `npm run test:estado` | lib/: perfil, disciplinas, revisão, agenda, métricas | **não** |
| `npm run test:questoes` | lib/: tradução acervo → tela | **não** |
| `npm run ci` | lint + test:questoes + test:estado + build | nenhum workflow chama |

Os testes da `lib/` rodam no `node` puro: é por isso que a lógica fica fora das
telas e não importa React nem `import.meta.env`.

---

## Pendências

### Lacunas conhecidas

1. **Favoritos, anotações e simulados só existem no navegador** — não há rota
   na API. Como o logout limpa o localStorage, sair da conta apaga esses dados
   de vez.
2. **Tentativas sem paginação** — `listarTentativas` pede no máximo 1000 e,
   passando disso, a lista vem cortada sem aviso. O acervo já tem paginação
   (`listarQuestoes`); falta o mesmo aqui.
3. **Trocar o e-mail** não é possível pela tela de Configurações.
4. **Testes da `lib/` fora da CI** — `test:estado` e `test:questoes` só rodam
   se alguém chamar à mão.

### Limpeza

- `GeradorQuestoes.jsx` não é importado por nenhuma tela; as rotas de `api/`
  ficam sem uso no app até que algo o monte.
- `simulados.running` e `simulados.resultados_historico` não são lidos (o
  histórico usado é o `resultados_historico` da raiz); `sim.preDisciplina` é
  lido em `Simulados.jsx`, mas nada o grava.
- `App.jsx` e o e2e citam uma "ADR-001" que não existe no repositório — o
  raciocínio dela está na seção *Refs de gravação assíncrona* acima.
- `lib/api/index.js` e `lib/questions/index.js` sem uso.

### Refatoração planejada

1. Tirar estado e carga de dados do `App.jsx` (hoje ~735 linhas) para
   contextos — sessão/perfil, acervo e tentativas, interface.
2. Extrair o layout (barra lateral, topo, avisos) para componentes próprios.
3. Biblioteca de componentes de interface (botão, card, modal, abas, etc.) no
   lugar dos estilos inline repetidos.
4. Quebrar as telas maiores (`Questoes`, `Simulados`, `Dashboard`).
5. TypeScript nas props e validação das respostas da API.
6. Testes de componente, além dos unitários e do e2e que já existem.

---

## Convenções

- **Componentes:** PascalCase (`ConfigSimulado.jsx`)
- **Funções:** camelCase, em português (`montarDisciplinas`, `embaralhar`)
- **Constantes:** UPPER_SNAKE_CASE (`DEFAULT_STATE`, `THEMES`)
- **Lógica nova** vai para `lib/` como função pura, com teste em `tests/`.
- **Dado que é do servidor** não entra em `state` nem no localStorage.
- **Comentários** explicam o porquê — o bug que a linha evita — e não o quê.
