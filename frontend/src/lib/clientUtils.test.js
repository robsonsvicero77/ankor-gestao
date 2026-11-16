import { formatClientDocument, formatPostalCode } from './clientUtils';

test('formats CPF and numeric or alphanumeric CNPJ values', () => {
  expect(formatClientDocument('52998224725', 'PF')).toBe('529.982.247-25');
  expect(formatClientDocument('11222333000181', 'PJ')).toBe('11.222.333/0001-81');
  expect(formatClientDocument('12ABC34501DE35', 'PJ')).toBe('12.ABC.345/01DE-35');
});

test('formats CEP and limits it to eight digits', () => {
  expect(formatPostalCode('01310100')).toBe('01310-100');
  expect(formatPostalCode('01310-10099')).toBe('01310-100');
});
