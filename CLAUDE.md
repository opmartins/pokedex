# Pokédex · Champions — Contexto do Projeto

> Arquivo de contexto carregado automaticamente em novas sessões do Claude Code.
> Mantém o registro do que foi construído e das decisões tomadas.

## Objetivo

Aplicação web que recebe o **nome de um Pokémon** e mostra seus **tipos e
fraquezas em destaque**, seguidos das demais informações. Jogo de destaque /
tema visual: **Pokémon Champions**.

Requisitos originais:
- Home page simples: campo de busca no meio da tela e, abaixo, as pesquisas recentes.
- Usar PokeAPI ou Tyradex. → **Escolhido: PokeAPI** (`https://pokeapi.co/api/v2`, sem chave).
- Tipos e fraquezas em destaque; demais informações depois.

## Idioma

- **UI em inglês** (mudada de pt-BR em 2026-06-20). `index.html` usa `lang="en"`.

## Stack

- **React 18 + Vite 5** (JavaScript, sem TypeScript).
- CSS puro em [src/index.css](src/index.css) (dark theme, paleta dourado/azul Pokémon).
- Sem dependências além de react / react-dom / vite / @vitejs/plugin-react.

## Como rodar

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de produção em dist/
```

## Estrutura de arquivos

- [index.html](index.html) — HTML raiz, lang pt-BR, favicon pokeball.
- [public/pokeball.svg](public/pokeball.svg) — ícone/favicon e logo da topbar.
- [src/main.jsx](src/main.jsx) — bootstrap do React.
- [src/App.jsx](src/App.jsx) — componente principal: home (busca centralizada +
  recentes), estado de loading/erro, view de resultado. Recentes em
  `localStorage` (chave `pokedex.recent`, máx. 8).
- [src/api.js](src/api.js) — `fetchPokemon(query)`: busca `/pokemon/{nome}`,
  normaliza dados e calcula matchups. Cache em memória das relações de tipo.
  `fetchAllNames()`: busca a lista completa de nomes (`/pokemon?limit=100000`,
  ~1350 nomes) uma única vez e faz cache — usada pelo autocomplete.
- [src/PokemonCard.jsx](src/PokemonCard.jsx) — card do resultado: artwork,
  número, nome, tipos, **bloco de fraquezas em destaque**, resistências,
  imunidades, infos (altura/peso/habilidades) e atributos base com barras.
- [src/TypeBadge.jsx](src/TypeBadge.jsx) — badge de tipo com cor e multiplicador.
- [src/types.js](src/types.js) — `TYPE_INFO` (cor + label PT de cada tipo) e
  `STAT_LABELS` (nomes dos atributos em PT).

## Strong counters por uso competitivo (Showdown/Smogon)

- A seção "Strong counters" mostra **apenas Pokémon usados pelos players**,
  ordenados por % de uso, cruzando as fraquezas do alvo com as usage stats.
- Fonte: **Smogon chaos JSON** (`smogon.com/stats/<mês>/chaos/<formato>-1760.json`),
  derivado do ladder do Pokémon Showdown. Formato atual: `gen9vgc2026regi`
  (constante `DEFAULT_FORMAT` em [api/usage.js](api/usage.js) — **atualizar quando
  a regulation mudar**).
- **CORS:** o smogon.com não envia header CORS, então o browser não busca direto.
  Por isso há uma **Vercel Serverless Function** [api/usage.js](api/usage.js) que
  busca server-side, normaliza nomes Smogon→PokéAPI (aliases p/ formes: Urshifu,
  Landorus, Ogerpon-*, Indeedee-F…) e devolve `{ usage: { slug: fração } }` com
  cache (warm-instance + `Cache-Control` na CDN).
- Cliente: `fetchUsage()` chama `/api/usage`; `fetchCounters()` usa
  `countersByUsage` (parte dos ~90 mais usados, busca tipos e agrupa por fraqueza).
  **Fallback** para `countersByStats` (mais fortes por base stats) quando o usage
  não está disponível — ex.: `vite dev` local **não** roda a function; só `vercel
  dev` ou produção servem `/api/usage`.

## Decisão importante: cálculo de fraquezas

A PokeAPI **não** retorna "fraquezas" prontas. Em [src/api.js](src/api.js):
1. Busca `/type/{nome}` para cada tipo do Pokémon.
2. Combina `double_damage_from` (×2), `half_damage_from` (×0.5),
   `no_damage_from` (×0), multiplicando os fatores entre os tipos.
3. Multiplicador resultante: `>1` = fraqueza, `0<x<1` = resistência, `0` = imunidade.

Funciona para tipos duplos. Validado: Charizard (Fire/Flying) → ×4 Rock, ×2 Water, ×2 Electric.

## Comportamento / limitações conhecidas

- A busca usa o nome em **inglês** (como a PokeAPI indexa): `charizard`, `pikachu`.
  Aceita também número/id.
- **Autocomplete implementado**: ao digitar, mostra sugestões (prefixo primeiro,
  depois "contém"), com navegação por teclado (↑ ↓ Enter Esc), clique e
  fechar-ao-clicar-fora. Filtragem é **local** sobre a lista cacheada, então é
  instantânea e não chama a API por tecla.
- Idioma da UI: **inglês**.
- 404 da API → mensagem "No Pokémon found".

## Estado / verificações já feitas

- `npm install` + `npm run build` → OK.
- Lógica de fraquezas validada contra a API ao vivo (Charizard).
- Dev server responde HTTP 200.

## Próximos passos possíveis (não feitos)

- Tratamento offline / retry da lista de nomes.
- Suporte a nomes/idioma além do inglês.
