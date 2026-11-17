export const CONTRACT_STATUSES = [
  { value: 'RASCUNHO', label: 'Rascunho' },
  { value: 'ENVIADO', label: 'Enviado' },
  { value: 'ASSINADO', label: 'Assinado' },
  { value: 'EM_EXECUCAO', label: 'Em execução' },
  { value: 'CONCLUIDO', label: 'Concluído' },
  { value: 'CANCELADO', label: 'Cancelado' },
];

export const CONTRACT_SERVICE_TYPES = [
  'Criação de site',
  'Criação de app',
  'Identidade visual',
  'UX Design',
  'Outro',
];

export const DEFAULT_PROVIDER = {
  display_name: 'Robson Svicero',
  legal_name: '55.168.143ROBERTO ROBSON SVICERO',
  document: '55.168.143/0001-07',
  address: 'R. ALBERTO LOHNHOFF, 58 - LAUZANE PAULISTA',
  phone: '11 96493-2007',
  email: 'ola@robsonsvicero.com.br',
  representative_name: 'Roberto Robson Svicero',
};

export function getProviderDefaults(settings = {}, configured = false) {
  if (!configured) return { ...DEFAULT_PROVIDER };
  return Object.fromEntries(
    Object.keys(DEFAULT_PROVIDER).map((key) => [key, settings[key] || '']),
  );
}

export function parseAmount(value) {
  const normalized = String(value).trim().replace(/\s/g, '');
  const decimalValue = normalized.includes(',')
    ? normalized.replace(/\./g, '').replace(',', '.')
    : normalized;
  return decimalValue === '' ? NaN : Number(decimalValue);
}

export function amountToCents(value) {
  const amount = parseAmount(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : NaN;
}

export function formatCurrency(cents) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format((cents || 0) / 100);
}

export function formatDate(value) {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

export function dateInputValue(value = new Date()) {
  const localDate = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

export function getClientAddress(client) {
  if (!client) return '';
  const street = [client.street, client.number].filter(Boolean).join(', ');
  const neighborhood = [client.complement, client.district].filter(Boolean).join(' - ');
  const city = [client.city, client.state].filter(Boolean).join(' / ');
  return [street, neighborhood, city, client.postal_code]
    .filter(Boolean)
    .join(' · ');
}

export function getClientSnapshot(client) {
  if (!client) return null;
  const {
    person_type,
    name,
    trade_name,
    document,
    email,
    phone,
    contact_name,
    postal_code,
    street,
    number,
    complement,
    district,
    city,
    state,
  } = client;
  return {
    person_type,
    name,
    trade_name,
    document,
    email,
    phone,
    contact_name,
    postal_code,
    street,
    number,
    complement,
    district,
    city,
    state,
  };
}

export function getContractServiceLabel(contract) {
  const content = contract.content || {};
  const services = content.service_types || [];
  const labels = services.filter((service) => service !== 'Outro');
  if (services.includes('Outro') && content.custom_service) {
    labels.push(content.custom_service);
  }
  return labels.join(', ') || 'Serviço personalizado';
}

export function getNextScheduledPayment(contract, today = dateInputValue()) {
  return (contract.content?.payment_schedule || [])
    .filter((payment) => payment.due_date >= today)
    .sort((left, right) => left.due_date.localeCompare(right.due_date))[0] || null;
}
