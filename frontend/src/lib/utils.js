import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Format currency in BRL
export function formatCurrency(cents) {
  const value = cents / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

// Format date in Brazilian format
export function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

// Format date for input (YYYY-MM-DD)
export function formatDateInput(dateString) {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
}

// Get relative date description
export function getRelativeDate(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  
  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Amanhã';
  if (diffDays === -1) return 'Ontem';
  if (diffDays > 1 && diffDays <= 7) return `Em ${diffDays} dias`;
  if (diffDays < -1) return `${Math.abs(diffDays)} dias atrás`;
  
  return formatDate(dateString);
}

// Parse currency input to cents
export function parseCurrencyToCents(value) {
  const cleaned = value.replace(/[^\d,]/g, '').replace(',', '.');
  const number = parseFloat(cleaned);
  return Math.round(number * 100);
}

// Status helpers
export function getStatusColor(status) {
  switch (status) {
    case 'PAGO':
      return 'status-ok';
    case 'PENDENTE':
      return 'status-atencao';
    case 'ATRASADO':
      return 'status-risco';
    default:
      return '';
  }
}

export function getStatusLabel(status) {
  switch (status) {
    case 'PAGO':
      return 'Pago';
    case 'PENDENTE':
      return 'Pendente';
    case 'ATRASADO':
      return 'Atrasado';
    default:
      return status;
  }
}

export function getAlertStatusColor(status) {
  switch (status) {
    case 'OK':
      return 'status-ok';
    case 'ATENCAO':
      return 'status-atencao';
    case 'RISCO':
      return 'status-risco';
    default:
      return '';
  }
}

export function getAlertStatusLabel(status) {
  switch (status) {
    case 'OK':
      return 'Situação OK';
    case 'ATENCAO':
      return 'Atenção';
    case 'RISCO':
      return 'Risco';
    default:
      return status;
  }
}
