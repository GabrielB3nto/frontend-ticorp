import apiClient from './api'

export interface DashboardResumo {
  clientes_ativos: number
  pontos_emitidos: number
  pontos_resgatados: number
  saldo_circulacao: number
  serie: Array<{ data: string; emitidos: number; resgatados: number }>
  ranking: Array<{ id: string; nome: string; pontos: number }>
  atividades: Array<{ cliente: string; tipo: string; pontos: number; descricao: string; criado_em: string }>
}

export async function buscarResumoDashboard() {
  const { data } = await apiClient.get<DashboardResumo>('/dashboard/resumo')
  return data
}
