import { createProposalPdfDefinition } from './proposalPdf';

test('proposal PDF definition includes client, dates, investment and section text', () => {
  const logoDataUrl = 'data:image/png;base64,cm9ic29u';
  const definition = createProposalPdfDefinition({
    title: 'Plano de atendimento',
    client_name: 'Cliente Exemplo',
    contact_name: 'Ana',
    issue_date: '2026-03-01',
    valid_until: '2026-03-31',
    amount_cents: 750000,
    content: {
      city: 'São Paulo',
      provider: {
        display_name: 'Estúdio Exemplo',
        legal_name: 'Estúdio Exemplo Ltda.',
        document: '12.345.678/0001-90',
        email: 'contato@example.com',
      },
      sections: [
        { title: 'Objetivos', body: 'Aumentar alcance\n• Melhorar conversão' },
        { title: 'Investimento', body: '' },
      ],
    },
  }, logoDataUrl);
  const serialized = JSON.stringify(definition);
  const footer = JSON.stringify(definition.footer(1, 1));

  expect(serialized).toContain('Cliente Exemplo');
  expect(serialized).toContain('01/03/2026');
  expect(serialized).toContain('R$');
  expect(serialized).toContain('Aumentar alcance');
  expect(serialized).toContain('Melhorar conversão');
  expect(serialized).toContain('São Paulo');
  expect(footer).toContain('Estúdio Exemplo Ltda.');
  expect(footer).toContain('contato@example.com');
  expect(definition.header.columns[0].image).toBe(logoDataUrl);
  expect(serialized).toContain('#0052CC');
  expect(serialized).not.toContain('#047857');
});

test('proposal PDF groups investment notes and scheduled payments', () => {
  const definition = createProposalPdfDefinition({
    title: 'Identidade visual',
    client_name: 'Cliente Exemplo',
    issue_date: '2026-03-01',
    valid_until: '2026-03-31',
    amount_cents: 100000,
    content: {
      payment_schedule: [
        {
          description: 'Entrada',
          due_date: '2026-03-05',
          amount_cents: 40000,
        },
        {
          description: 'Entrega',
          due_date: '2026-03-31',
          amount_cents: 60000,
        },
      ],
      sections: [
        { title: 'Investimento', body: 'Valor sujeito à aprovação final.' },
        { title: 'Condições de pagamento', body: 'Pagamento por transferência.' },
        { title: 'Aceite', body: 'Aprovação por e-mail.' },
      ],
    },
  }, 'data:image/png;base64,cm9ic29u');
  const serialized = JSON.stringify(definition);

  expect(serialized).toContain('Investimento e formas de pagamento');
  expect(serialized).toContain('1.000,00');
  expect(serialized).toContain('Entrada');
  expect(serialized).toContain('05/03/2026');
  expect(serialized).toContain('Valor sujeito à aprovação final.');
  expect(serialized).toContain('Pagamento por transferência.');
  expect(serialized.match(/Investimento e formas de pagamento/g)).toHaveLength(1);
});
