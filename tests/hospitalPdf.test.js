import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createHospitalPdf, pdfFilename } from '../src/utils/hospitalPdf.js';

test('creates a valid PDF with the hospital mark watermark', () => {
  const mark = readFileSync(new URL('../public/hospital-francisco-de-asis-marca.png', import.meta.url)).toString('base64');
  const pdf = createHospitalPdf({
    title: 'Resumen de consulta',
    subtitle: 'Documento de prueba',
    patient: { name: 'Paciente Demo', document: '12345', email: 'demo@example.com', phone: '3000000000' },
    generatedBy: 'Medico Demo',
    watermarkDataUrl: `data:image/png;base64,${mark}`,
    sections: [{ title: 'Atencion', rows: [{ label: 'Diagnostico', value: 'Control general' }] }],
  });

  assert.match(pdf.output(), /^%PDF-/);
  assert.equal(pdf.getNumberOfPages(), 1);
});

test('creates safe and readable PDF filenames', () => {
  assert.equal(pdfFilename('Hospital Francisco de Asis - Cita 123'), 'hospital-francisco-de-asis-cita-123.pdf');
  assert.equal(pdfFilename('Áéíóú'), 'aeiou.pdf');
});
