import { createProposalPdfDefinition } from './proposalPdf';

test('proposal PDF definition includes client, dates, investment and section text', () => {
  const definition = createProposalPdfDefinition({
    title: 'Plano de atendimento',
    client_name: 'Cliente Exemplo',
    contact_name: 'Ana',
    issue_date: '2026-03-01',
    valid_until: '2026-03-31',
    amount_cents: 750000,
    content: {
      city: 'São Paulo',
      sections: [
        { title: 'Objetivos', body: 'Aumentar alcance\n• Melhorar conversão' },
        { title: 'Investimento', body: '' },
      ],
    },
  });
  const serialized = JSON.stringify(definition);

  expect(serialized).toContain('Cliente Exemplo');
  expect(serialized).toContain('01/03/2026');
  expect(serialized).toContain('R$');
  expect(serialized).toContain('Aumentar alcance');
  expect(serialized).toContain('Melhorar conversão');
  expect(serialized).toContain('São Paulo');
});
