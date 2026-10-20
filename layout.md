# ADR-001 — Design System do EMPREST.AI

- **Status:** Aceita
- **Data:** 01/10/2026
- **Decisores:** Produto e engenharia do EMPREST.AI
- **Escopo:** Interface web v1 para empréstimo interno de equipamentos de TI

## Contexto

O EMPREST.AI precisa de uma interface operacional, escura e compacta, utilizável por colaboradores e pela equipe de Operações. Estado, prazo e disponibilidade devem ser facilmente identificáveis. A solução precisa cobrir login, catálogo, empréstimos do usuário, operações e cadastro de equipamentos sem fragmentar a linguagem visual.

O sistema parte da linguagem visual do **Nocturne**, substituindo seu acento e sua tipografia pelos elementos da marca EMPREST.AI.

## Decisão

Adotaremos um design system de tema escuro, alta densidade e baixa cromia, com teal como acento e Raleway como família tipográfica única. O acento será empregado em linhas, contornos, ícones, foco e informação de destaque — nunca como preenchimento sólido em áreas extensas.

Os estilos ficarão na folha do Nocturne (`styles.css`) e em tokens de `:root`. O markup usará as classes existentes do sistema e estilos locais apenas para composição. Para espaçar elementos irmãos, usar sempre flexbox ou grid com `gap`.

## Fundamentos visuais

### Cores e tokens

| Token | Valor | Uso |
|---|---|---|
| `--color-bg` | `#161826` | fundo da página |
| `--color-surface` | `#232532` | cards, tabelas, modais e inputs |
| `--color-text` | `#e9e9ed` | texto principal |
| `--color-divider` | `color-mix(in srgb, #e9e9ed 16%, transparent)` | bordas e réguas |
| `--color-neutral-900` | `#292b31` | avatares neutros |
| `--color-accent-100` | `#e6faf7` | rampa teal |
| `--color-accent-200` | `#c2f1eb` | texto de toast |
| `--color-accent-300` | `#93e3da` | texto sobre fundo escuro |
| `--color-accent-400` | `#5fcfc4` | estado disponível |
| `--color-accent-500` | `#2fb8ac` | acento principal |
| `--color-accent-600` | `#26978e` | rampa teal |
| `--color-accent-700` | `#1d746d` | bordas tintadas |
| `--color-accent-800` | `#15534e` | rampa teal |
| `--color-accent-900` | `#0f3733` | avatar e toast |

Usar transparência `0.10` no filtro ativo, `0.12` em hover de botão primário e pill disponível, e `0.22` no estado pressed.

| Estado | Texto | Fundo | Borda |
|---|---|---|---|
| Disponível / Em dia | `#5fcfc4` | `rgba(47,184,172,0.12)` | `rgba(47,184,172,0.40)` |
| Emprestado / A vencer | `#c9a25f` | `rgba(201,162,95,0.12)` | `rgba(201,162,95,0.38)` |
| Em atraso / Erro | `#e88b8b` | `rgba(200,90,90,0.14)` | `rgba(200,90,90,0.40)` |
| Em manutenção / Inativo | `#9aa0ad` | `rgba(154,160,173,0.10)` | `rgba(154,160,173,0.30)` |

O banner de bloqueio usa borda `#7a3b3b`, fundo `rgba(122,59,59,0.14)` e texto `#e88b8b`. Texto secundário deriva de `--color-text`: 72% para apoio em painéis, 70% para labels, 62% para diálogos, 55% para subtítulos e metadados, 45% para kickers e 40% para rodapés. Nunca usar preto ou branco puros.

### Tipografia

Usar **Raleway** (pesos 400, 500, 600 e 700) para `--font-heading` e `--font-body`. Títulos usam peso 600, `line-height: 1.12`, `letter-spacing: -0.015em` e `text-wrap: pretty`; corpo usa peso 400 e `line-height: 1.55`.

| Elemento | Tamanho |
|---|---|
| H1 de login | 44px |
| H1 interno / número de KPI | 30px |
| H2 de login | 26px |
| Título de modal | 20px |
| Título de seção | 17px |
| Título de card | 16.5px |
| Item de lista | 16px |
| Subtítulo / lead | 14–16px |
| Corpo, célula, input e botão | 13.5–14px |
| Nota, metadado e chip | 12–13px |
| Kicker / cabeçalho de tabela | 11–11.5px, caixa alta, espaçamento `0.08–0.09em` |

A marca é `EMPREST` em peso 700, seguida de `.AI` no acento, com `letter-spacing: 0.02em`: 17px no login e 15px na navegação.

### Espaçamento, raios e elevação

Usar a escala `2.8 · 5.6 · 8.4 · 11.2 · 16.8 · 22.4px`; `--radius-sm: 4px`, `--radius-md: 8px` e `--radius-lg: 14px`. Aplicar somente uma elevação do sistema (`--shadow-sm`, `--shadow-md` ou `--shadow-lg`) por elemento.

Inputs/selects têm 36px e padding `6px 10px`; botão padrão, 36px; botão de login, 40px; avatar, 28px (26px em tabela); pills têm padding `3px 9px` e raio completo. Os indicadores do limite de itens têm 5px, largura flexível igual e raio completo.

## Componentes e padrões de interação

Usar `.btn` com `.btn-primary` (contorno em acento), `.btn-secondary` (contorno divisor), `.btn-ghost` e `.btn-block`; `.tag`/`.tag-outline`; `.card`, `.card-kicker`, `.card-title` e `.elev-*`; `.field`, `label`, `.input`; `.radio`/`.dot`; `.nav`/`.nav-brand`; `.table`; `.dialog-backdrop`/`.dialog` e suas regiões.

Hover usa tint do acento, pressed usa o próximo nível de tint, e foco usa `outline: 2px solid var(--color-accent); outline-offset: 2px`. Desabilitados usam `opacity: .45` e `cursor: not-allowed`. Usar Phosphor Icons. A marca gráfica é um quadrado de 22–26px, borda teal de 1.5px, raio 6–7px e quadrado central preenchido de 8–9px.

Réguas de seção:

```css
height: 1px;
background: linear-gradient(90deg, transparent, var(--color-divider) 48px,
  var(--color-divider) calc(100% - 48px), transparent);
```

## Aplicação nas telas

| Tela | Estrutura e requisitos |
|---|---|
| Login | Grade `1.05fr 0.95fr`, mínimo 820px e padding `64px 56px`. Esquerda: gradiente `linear-gradient(160deg,#1b1f2e,#161826 60%)`, brilho teal radial, marca, título, lead, três estatísticas e rodapé. Direita: coluna central de 340px, credenciais, CTA, entrada de Operações e nota de escopo. |
| Catálogo | Máximo 1240px e padding `36px 40px 64px`. H1, disponibilidade, busca de 260px, banner de atraso condicional e filtros exclusivos. Grade `repeat(auto-fill, minmax(292px, 1fr))`, gap 16px; card com padding 18px, kicker, nome, patrimônio, pill, detalhe e ação total. |
| Meus empréstimos | Máximo 1000px. H1, ocupação `N de 3`, prazo e três traços de limite. Linha com borda esquerda de 3px e colunas: item (1.4), retirada (1), prazo (1), pill (0.9) e devolução. Vazio tracejado, centralizado, padding 48px. |
| Operações | Máximo 1320px. Busca 230px e ação de cadastro. Quatro KPIs com gap 14px e padding `16px 18px`. Tabela com pessoa, equipamento, patrimônio, retirada, prazo, situação e ação; contêiner arredondado com overflow oculto. |
| Cadastro | Máximo 1160px; grade `1fr 300px`, gap 34px. Formulário em duas colunas e gap 14px; lateral com “Regras em vigor” e “Fora desta versão” a 42% de opacidade. |
| Sobreposições | Modal de 420px, padding 26px e resumo com borda, raio médio e padding `14px 16px`. Backdrop `rgba(10,11,18,0.68)`. Toast central na base, `bottom: 28px`, padding `12px 20px`, pill teal e remoção em 2600ms. |

A navegação tem 60px de altura, padding lateral 40px, gap 32px, é `sticky` no topo e usa `z-index: 20`. Colaborador vê Catálogo e Meus empréstimos; Operações vê também Operações e Equipamentos. A aba ativa recebe borda inferior teal de 2px; a inativa mantém texto a 55%.

## Regras de negócio expressas na interface

1. Solicitar item disponível abre confirmação com devolução em hoje + 14 dias; a confirmação atualiza todas as listas e mostra toast.
2. Devolver, pelo usuário ou balcão, torna o item disponível, libera slot e mostra toast.
3. Com três empréstimos ativos, a ação muda para “Limite de 3 itens”. Havendo atraso, muda para “Bloqueado por atraso” e exibe banner no catálogo.
4. Manutenção nunca é disponibilidade. Item com o usuário mostra “Está com você”; com outra pessoa, “Emprestado”.
5. Busca é imediata e case-insensitive: nome/patrimônio no catálogo; pessoa/item em Operações. Filtros de situação são exclusivos.
6. Nome é obrigatório no cadastro; patrimônio vazio resulta em `TI-—`; novo item entra no topo da lista.
7. Colaboradores só veem seus próprios empréstimos; a visão completa pertence a Operações.

Não fazem parte da v1: reserva futura, notificação por e-mail e importação de planilha. Não haverá rotas aninhadas ou modais empilhados.

## Movimento, conteúdo e dados de referência

A interface é discreta: cards usam `fadeUp .25s ease both`, modal `.18s` e toast `.2s`. Não animar KPIs, tabela ou navegação, nem aplicar escala, parallax ou sombras pulsantes.

Usar português do Brasil, datas `DD/MM/AAAA` e copy direta, operacional, sem exclamações ou emoji. A referência de layout é 1360–1440px de largura e 820px de altura mínima.

Para reprodução, usar Ana Ribeiro (AR) em 31/08/2026. O estado inicial esperado tem 2 de 3 slots ocupados e em dia, 4 itens disponíveis, 2 em manutenção, 6 empréstimos abertos e 1 em atraso.

## Consequências

- Estados operacionais passam a ter representação visual consistente em todas as telas.
- A identidade teal se mantém reconhecível sem comprometer a hierarquia do tema escuro.
- A implementação deve evitar valores avulsos, novos cinzas, margens entre irmãos e componentes paralelos fora dos tokens definidos.
- Mudanças de fluxo precisam preservar os estados, rótulos, bloqueios e feedbacks estabelecidos por esta ADR.
