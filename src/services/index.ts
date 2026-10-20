import apiClient from './api'
import type { Cliente, Lancamento, Saldo } from '../types'

// Serviços de Cliente
export const clienteService = {
  list: () => apiClient.get<Cliente[]>('/clientes'),
  get: (id: string) => apiClient.get<Cliente>(`/clientes/${id}`),
  create: (data: Omit<Cliente, 'id' | 'criado_em'>) =>
    apiClient.post<Cliente>('/clientes', data),
  update: (id: string, data: Partial<Cliente>) =>
    apiClient.put<Cliente>(`/clientes/${id}`, data),
  delete: (id: string) => apiClient.delete(`/clientes/${id}`),
}

// Serviços de Lançamento
export const lancamentoService = {
  list: (clienteId?: string) =>
    apiClient.get<Lancamento[]>('/lancamentos', {
      params: { cliente_id: clienteId },
    }),
  get: (id: string) => apiClient.get<Lancamento>(`/lancamentos/${id}`),
  create: (data: Omit<Lancamento, 'id' | 'criado_em'>) =>
    apiClient.post<Lancamento>('/lancamentos', data),
}

// Serviços de Saldo
export const saldoService = {
  get: (clienteId: string) =>
    apiClient.get<Saldo>(`/saldos/${clienteId}`),
  list: () => apiClient.get<Saldo[]>('/saldos'),
}
