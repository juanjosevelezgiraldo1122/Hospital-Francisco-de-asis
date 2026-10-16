import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocalAssistantAnswer } from '../src/assistantLogic.js';

const data = {
  appointments: [
    { id: 'A1', patientId: 'P1', doctorId: 'D1', date: '2099-01-02', time: '09:00', status: 'Pendiente', sede: 'Sede Norte' },
    { id: 'A2', patientId: 'P2', doctorId: 'D1', date: '2099-01-03', time: '10:00', status: 'Pendiente', sede: 'Sede Centro' },
  ],
  deliveries: [
    { id: 'O1', patientId: 'P1', orderStatus: 'Enviado', paymentStatus: 'Pagado' },
    { id: 'O2', patientId: 'P2', orderStatus: 'Entregado', paymentStatus: 'Pagado' },
  ],
  prescriptions: [
    { patientId: 'P1', medicine: 'Loratadina 10 mg' },
    { patientId: 'P2', medicine: 'Omeprazol 20 mg' },
  ],
  inventory: [
    { medicine: 'Acetaminofen 500 mg', stock: 12 },
    { medicine: 'Ibuprofeno 400 mg', stock: 0 },
  ],
};

test('muestra al paciente solo sus próximas citas', () => {
  const answer = getLocalAssistantAnswer('¿Cuándo es mi próxima cita?', { id: 'P1', role: 'patient' }, data);
  assert.match(answer, /Sede Norte/);
  assert.doesNotMatch(answer, /Sede Centro/);
});

test('muestra al paciente solo el estado de su pedido', () => {
  const answer = getLocalAssistantAnswer('¿Cómo va mi pedido?', { id: 'P1', role: 'patient' }, data);
  assert.match(answer, /O1: Enviado/);
  assert.doesNotMatch(answer, /O2|Entregado/);
});

test('contesta sedes con la lista configurada y no inventa direcciones', () => {
  const answer = getLocalAssistantAnswer('¿Cuáles son las sedes disponibles?', { role: 'patient' }, data);
  assert.match(answer, /Sede Norte, Sede Centro, Sede Universitaria/);
  assert.match(answer, /direcciones físicas y los horarios no están registrados/i);
});

test('no recomienda medicamentos ni interpreta síntomas', () => {
  const answer = getLocalAssistantAnswer('¿Qué medicamento debo tomar para este dolor?', { role: 'patient' }, data);
  assert.match(answer, /No puedo evaluar síntomas, diagnosticar ni recomendar medicamentos o dosis/);
});

test('consulta medicamentos prescritos de la cuenta local sin exponer la receta de otra persona', () => {
  const answer = getLocalAssistantAnswer('¿Qué medicamentos me recetaron?', { id: 'P1', role: 'patient' }, data);
  assert.match(answer, /Loratadina 10 mg/);
  assert.doesNotMatch(answer, /Omeprazol/);
});

test('el administrador consulta el stock real desde los datos locales', () => {
  const answer = getLocalAssistantAnswer('¿Cuánto stock hay de Acetaminofen 500 mg?', { role: 'admin' }, data);
  assert.match(answer, /12 unidad/);
});
