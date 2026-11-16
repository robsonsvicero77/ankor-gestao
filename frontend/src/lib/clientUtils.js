export function formatClientDocument(value, personType) {
  const rawValue = String(value || '');
  const normalized = (personType === 'PF'
    ? rawValue.replace(/\D/g, '')
    : rawValue.replace(/[^a-z0-9]/gi, '').toUpperCase()
  ).slice(0, personType === 'PF' ? 11 : 14);

  if (personType === 'PF') {
    if (normalized.length > 9) {
      return `${normalized.slice(0, 3)}.${normalized.slice(3, 6)}.${normalized.slice(6, 9)}-${normalized.slice(9)}`;
    }
    if (normalized.length > 6) {
      return `${normalized.slice(0, 3)}.${normalized.slice(3, 6)}.${normalized.slice(6)}`;
    }
    if (normalized.length > 3) {
      return `${normalized.slice(0, 3)}.${normalized.slice(3)}`;
    }
    return normalized;
  }

  if (normalized.length > 12) {
    return `${normalized.slice(0, 2)}.${normalized.slice(2, 5)}.${normalized.slice(5, 8)}/${normalized.slice(8, 12)}-${normalized.slice(12)}`;
  }
  if (normalized.length > 8) {
    return `${normalized.slice(0, 2)}.${normalized.slice(2, 5)}.${normalized.slice(5, 8)}/${normalized.slice(8)}`;
  }
  if (normalized.length > 5) {
    return `${normalized.slice(0, 2)}.${normalized.slice(2, 5)}.${normalized.slice(5)}`;
  }
  if (normalized.length > 2) {
    return `${normalized.slice(0, 2)}.${normalized.slice(2)}`;
  }
  return normalized;
}

export function formatPostalCode(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}
