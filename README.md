# Frontend TiCorp

Frontend React/TypeScript do EMPREST.AI, integrado à API REST para login,
catálogo, solicitação de empréstimos e consulta dos empréstimos do titular.

## Contrato da prática SDD

O contrato de negócio fica em `../backend/docs/PRD.md` e a proposta de plano
com critérios de aceite em `../backend/docs/plan.md`, na pasta TiCorp.
O conteúdo de Programa de Pontos foi preservado como histórico. Consulte as
rules e ADRs do backend antes de mudanças integradas. O fluxo básico está
implementado; seed/imagens, verificador independente e validação de produção
continuam pendentes.

- Decisão humana confirmada: limite de **3 empréstimos em aberto**.
- **TI-0004, TI-0007 e TI-0010** em manutenção; os outros 9 itens da lista
  inicial disponíveis. Equipamentos em manutenção não podem ser solicitados.
- Prazo confirmado: 14 dias de segunda a sexta, excluindo dia inicial,
  sem descontar feriados, America/Sao_Paulo. Atraso começa no dia seguinte
  à data de vencimento nesse fuso.
- Pixabay substitui Pexels por orientação do professor relatada por Gabriel.
  Catálogo deve exibir as 12 fotos da skill e "Fotos: Pixabay" com link
  https://pixabay.com/pt/, como requisito de origem do projeto. Não atribuir
  regras do Pexels à licença Pixabay: seguir docs/PRD.md e suas fontes.
- Sem hotlink permanente de URLs Pixabay; fotos finais vêm do Storage após
  preparação e publicação humana. Revisão visual, tamanho 800×600 e fotos únicas
  continuam obrigatórios. Chave da API Pixabay nunca vai ao frontend.
- Exceção aprovada para esta prática: chave Pixabay só no preparo local, com
  entrada vazia no .env.example do backend; não é cadastrada na Vercel.
- Após timeout/perda de resposta, não repetir solicitação automaticamente.
  Consultar próprios empréstimos e catálogo. Se não puder confirmar o resultado,
  exibir "Não foi possível confirmar a solicitação", sem simular sucesso/recusa.
- Login e empréstimos devem usar identidade real; o servidor valida as regras.
  Identidade fixa e bloqueio apenas na interface não atendem aos requisitos.
- A conta do professor não é usada para testes de solicitação e permanece
  com zero empréstimos. Nenhuma senha, token ou chave em código ou no git.
- Verificador independente deve conferir cada critério, sem corrigir
  código/testes, e cobrir os dois projetos. Isolamento do harness ainda precisa
  ser demonstrado.
- Dados/imagens e verificador independente ainda precisam ser concluídos.
  Não instale dependências sem aprovação.
- ENTREGA.md deve registrar decisões e evidências reais após as validações
  finais; não invente validação de produção, commits ou verificações.
- Agente não grava no banco/Storage do deploy. Produção é executada pelo usuário.

Specs integradas de back/front mantidas no backend:
- `../backend/docs/specs/003-dados-iniciais/spec.md`, com plan.md e tasks.md.
- `../backend/docs/specs/004-solicitar-emprestimo/spec.md`, com plan.md e tasks.md.

Não duplicar contratos divergentes no frontend. O fluxo básico foi aprovado em
recortes específicos; as specs integrais ainda dependem de seed/imagens,
verificação independente e validação de produção.
Nenhuma alteração de landing/logo é necessária nesta etapa.

## Tecnologias

- React 18+
- TypeScript
- Vite
- Tailwind CSS
- axios para requisições HTTP

## Instalação

```bash
npm install
```

## Desenvolvimento

```bash
npm run dev
```

O projeto rodará em `http://localhost:5173`

## Build

```bash
npm run build
```

## Variáveis de Ambiente

Copie `.env.example` para `.env.local` e configure `VITE_API_URL` com a base da
API (por exemplo, `http://127.0.0.1:8000/api` em desenvolvimento local). Não
coloque senhas de banco, chaves administrativas ou a chave Pixabay no frontend.

## Verificação local

`npm run build` executa o type-check do TypeScript e o build de produção.
Os testes de serviço existentes podem ser executados com:

```bash
node --test src/services/auth.test.mjs
```

`npm run lint` requer configuração ESLint, que não existe atualmente neste
checkout. O frontend ainda não foi validado em produção nem com o banco usando
a role `emprestai_runtime`.
