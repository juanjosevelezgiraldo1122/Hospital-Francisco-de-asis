import test from 'node:test';
import assert from 'node:assert/strict';
import { addressPartsFromRow, formatColombianAddress, normalizeAddressParts } from '../shared/colombianAddress.js';

test('formats a Colombian urban address with bis, quadrant and locality', () => {
  const address = formatColombianAddress({
    streetType: 'CL', streetNumber: '10', streetLetter: 'A', streetBis: true,
    streetQuadrant: 'N', crossNumber: '5', crossLetter: 'B', crossQuadrant: 'S',
    plateNumber: '20', complement: 'Apto 301, Torre 2', neighborhood: 'San José',
    municipality: 'Cali', department: 'Valle del Cauca',
  });

  assert.equal(address, 'CL 10 A BIS N # 5 B S - 20, Apto 301, Torre 2, Barrio San José, Cali, Valle del Cauca');
});

test('normalizes optional values and caps field lengths', () => {
  const parts = normalizeAddressParts({ streetLetter: ' ab ', complement: 'x'.repeat(140), streetBis: 'false' });
  assert.equal(parts.streetLetter, 'AB');
  assert.equal(parts.complement.length, 120);
  assert.equal(parts.streetBis, false);
});

test('maps persisted SQL address columns to profile fields', () => {
  assert.deepEqual(addressPartsFromRow({ DIRECCION_TIPO_VIA: 'CR', DIRECCION_NUMERO_VIA: '45', DIRECCION_BIS: 1, MUNICIPIO: 'Pereira' }), {
    streetType: 'CR', streetNumber: '45', streetLetter: '', streetBis: true, streetQuadrant: '',
    crossNumber: '', crossLetter: '', crossQuadrant: '', plateNumber: '', complement: '',
    neighborhood: '', municipality: 'Pereira', department: '',
  });
});
