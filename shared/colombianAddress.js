const trim = (value) => String(value || '').trim();

export const emptyAddressParts = {
  streetType: 'CL',
  streetNumber: '',
  streetLetter: '',
  streetBis: false,
  streetQuadrant: '',
  crossNumber: '',
  crossLetter: '',
  crossQuadrant: '',
  plateNumber: '',
  complement: '',
  neighborhood: '',
  municipality: '',
  department: '',
};

export function formatColombianAddress(parts = {}) {
  const streetNumber = trim(parts.streetNumber);
  const crossNumber = trim(parts.crossNumber);
  const plateNumber = trim(parts.plateNumber);
  const street = [
    trim(parts.streetType),
    `${streetNumber}${trim(parts.streetLetter) ? ` ${trim(parts.streetLetter).toUpperCase()}` : ''}`,
    parts.streetBis ? 'BIS' : '',
    trim(parts.streetQuadrant).toUpperCase(),
  ].filter(Boolean).join(' ');
  const cross = [
    crossNumber,
    trim(parts.crossLetter).toUpperCase(),
    trim(parts.crossQuadrant).toUpperCase(),
  ].filter(Boolean).join(' ');
  const lines = [];

  if (street || cross || plateNumber) lines.push(`${street}${cross ? ` # ${cross}` : ''}${plateNumber ? ` - ${plateNumber}` : ''}`.trim());
  if (trim(parts.complement)) lines.push(trim(parts.complement));
  if (trim(parts.neighborhood)) lines.push(`Barrio ${trim(parts.neighborhood)}`);
  const locality = [trim(parts.municipality), trim(parts.department)].filter(Boolean).join(', ');
  if (locality) lines.push(locality);
  return lines.join(', ');
}

export function normalizeAddressParts(parts = {}) {
  return {
    streetType: trim(parts.streetType).toUpperCase().slice(0, 20),
    streetNumber: trim(parts.streetNumber).slice(0, 8),
    streetLetter: trim(parts.streetLetter).toUpperCase().slice(0, 4),
    streetBis: parts.streetBis === true || parts.streetBis === 1 || parts.streetBis === '1',
    streetQuadrant: trim(parts.streetQuadrant).toUpperCase().slice(0, 2),
    crossNumber: trim(parts.crossNumber).slice(0, 8),
    crossLetter: trim(parts.crossLetter).toUpperCase().slice(0, 4),
    crossQuadrant: trim(parts.crossQuadrant).toUpperCase().slice(0, 2),
    plateNumber: trim(parts.plateNumber).slice(0, 8),
    complement: trim(parts.complement).slice(0, 120),
    neighborhood: trim(parts.neighborhood).slice(0, 100),
    municipality: trim(parts.municipality).slice(0, 100),
    department: trim(parts.department).slice(0, 100),
  };
}

export function addressPartsFromRow(row = {}) {
  return {
    streetType: row.DIRECCION_TIPO_VIA || 'CL',
    streetNumber: row.DIRECCION_NUMERO_VIA || '',
    streetLetter: row.DIRECCION_LETRA_VIA || '',
    streetBis: Boolean(row.DIRECCION_BIS),
    streetQuadrant: row.DIRECCION_CUADRANTE_VIA || '',
    crossNumber: row.DIRECCION_NUMERO_CRUCE || '',
    crossLetter: row.DIRECCION_LETRA_CRUCE || '',
    crossQuadrant: row.DIRECCION_CUADRANTE_CRUCE || '',
    plateNumber: row.DIRECCION_NUMERO_PLACA || '',
    complement: row.DIRECCION_COMPLEMENTO || '',
    neighborhood: row.BARRIO || '',
    municipality: row.MUNICIPIO || '',
    department: row.DEPARTAMENTO || '',
  };
}
