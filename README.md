# Pokédex · Champions

Aplicação web que busca um Pokémon pelo nome e exibe **tipos e fraquezas em
destaque**, seguidos das demais informações. Tema inspirado no jogo
**Pokémon Champions**.

## Funcionalidades

- **Home page simples**: campo de busca centralizado e, abaixo, as pesquisas
  recentes (salvas no `localStorage`).
- Busca por nome (ou número) na [PokeAPI](https://pokeapi.co).
- **Autocomplete**: sugestões enquanto digita (navegação por teclado), filtradas
  localmente a partir da lista completa de nomes (carregada uma vez).
- Interface em **inglês**.
- **Fraquezas em destaque**, calculadas a partir das relações de dano dos tipos
  do Pokémon (inclui Pokémon de tipo duplo, com multiplicadores ×2/×4).
- Resistências e imunidades também calculadas.
- Outras informações: artwork oficial, altura, peso, habilidades e atributos base.

## Como rodar

```bash
npm install
npm run dev
```

Abra o endereço exibido no terminal (por padrão http://localhost:5173).

## Stack

- React + Vite
- PokeAPI (sem chave de API)

## Como as fraquezas são calculadas

A PokeAPI não retorna "fraquezas" diretamente. A aplicação busca, para cada tipo
do Pokémon, o endpoint `/type/{nome}` e combina as relações de dano
(`double_damage_from`, `half_damage_from`, `no_damage_from`), multiplicando os
fatores. Tipos com multiplicador resultante maior que 1 são fraquezas.
