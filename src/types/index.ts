/**
 * Tipos e interfaces do domínio de Pontos
 */

export interface Cliente {
  id: string
  nome: string
  email: string
  criado_em: string
}

export interface Lancamento {
  id: string
  cliente_id: string
  tipo: 'CREDITO' | 'DEBITO'
  valor: number
  descricao: string
  data_lancamento: string
  criado_em: string
}

export interface Saldo {
  id: string
  cliente_id: string
  pontos_disponiveis: number
  pontos_expirados: number
  pontos_pendentes: number
  atualizado_em: string
}
