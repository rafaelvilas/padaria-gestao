import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoeda(valor: number | string | null | undefined): string {
  const num = Number(valor || 0);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
}

export function formatData(data: string | Date | null | undefined): string {
  if (!data) return '-';
  try {
    return format(new Date(data), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return String(data);
  }
}

export function formatPercentual(valor: number | null | undefined, casas = 1): string {
  return `${Number(valor || 0).toFixed(casas)}%`;
}

export function getCmvColor(cmvPct: number): string {
  if (cmvPct <= 28) return 'text-green-600';
  if (cmvPct <= 35) return 'text-yellow-600';
  if (cmvPct <= 42) return 'text-orange-500';
  return 'text-red-600';
}

export function getCmvBgColor(cmvPct: number): string {
  if (cmvPct <= 28) return 'bg-green-50 border-green-200';
  if (cmvPct <= 35) return 'bg-yellow-50 border-yellow-200';
  if (cmvPct <= 42) return 'bg-orange-50 border-orange-200';
  return 'bg-red-50 border-red-200';
}

export function getScoreColor(score: number): string {
  if (score >= 85) return 'bg-green-100 text-green-800';
  if (score >= 70) return 'bg-blue-100 text-blue-800';
  if (score >= 55) return 'bg-yellow-100 text-yellow-800';
  if (score >= 40) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
}

export function getScoreFaixa(score: number): string {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'E';
}

export function getScoreLabel(score: number): string {
  if (score >= 85) return 'Excelente';
  if (score >= 70) return 'Bom';
  if (score >= 55) return 'Regular';
  if (score >= 40) return 'Atenção';
  return 'Crítico';
}

export function formatNumero(valor: number | string | null | undefined, casas = 2): string {
  return Number(valor || 0).toFixed(casas);
}
