import {
  amountToCents,
  getNextScheduledPayment,
  getClientAddress,
  getContractServiceLabel,
} from './contractUtils';

test('parses Brazilian and decimal currency input into cents', () => {
  expect(amountToCents('1.234,56')).toBe(123456);
  expect(amountToCents('1234.56')).toBe(123456);
  expect(amountToCents('')).toBeNaN();
});

test('finds the next scheduled installment without implying payment status', () => {
  const payment = getNextScheduledPayment({
    content: {
      payment_schedule: [
        { due_date: '2026-03-10', amount_cents: 50000 },
        { due_date: '2026-04-10', amount_cents: 75000 },
      ],
    },
  }, '2026-03-15');

  expect(payment).toEqual({ due_date: '2026-04-10', amount_cents: 75000 });
  expect(getNextScheduledPayment({
    content: { payment_schedule: [{ due_date: '2026-03-10' }] },
  }, '2026-03-15')).toBeNull();
});

test('formats client address and service label from stored snapshots', () => {
  expect(getClientAddress({
    street: 'Rua Exemplo',
    number: '10',
    district: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    postal_code: '01310100',
  })).toBe('Rua Exemplo, 10 · Centro · São Paulo / SP · 01310100');

  expect(getContractServiceLabel({
    content: {
      service_types: ['UX Design', 'Outro'],
      custom_service: 'Pesquisa com usuários',
    },
  })).toBe('UX Design, Pesquisa com usuários');
});
