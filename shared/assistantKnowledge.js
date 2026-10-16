export const hospitalKnowledge = Object.freeze({
  hospital: 'Hospital Francisco de Asis',
  language: 'es',
  locations: ['Sede Norte', 'Sede Centro', 'Sede Universitaria'],
  appointmentBooking: {
    patientRoute: '/citas',
    steps: ['Seleccionar medicina general o especialista', 'Elegir medico disponible', 'Seleccionar sede y fecha', 'Elegir un bloque horario disponible', 'Indicar el motivo y confirmar'],
    secretaryRoute: '/secretaria',
    secretarySteps: ['Abrir Nueva cita', 'Seleccionar o registrar una ficha completa de paciente', 'Elegir tipo de atencion y medico', 'Seleccionar sede, fecha y hora disponible', 'Indicar el motivo y confirmar'],
    validation: 'El portal valida la disponibilidad del medico y no permite reservar un bloque ocupado.',
  },
  medicationRequests: {
    patientRoute: '/medicamentos',
    requirements: ['El medicamento debe estar prescrito por un medico en una consulta finalizada', 'Debe haber existencias disponibles', 'El paciente completa contacto y direccion de entrega', 'El paciente elige un medio de pago y confirma la solicitud'],
  },
  medicationPayments: ['Pago en linea con tarjeta', 'Contra entrega'],
  deliveryStatuses: ['Recibido', 'Preparando', 'Enviado', 'Entregado', 'Cancelado'],
  verifiedRoutes: {
    appointments: '/citas',
    patientMedications: '/medicamentos',
    secretaryDesk: '/secretaria',
    adminMedicationPanel: '/panel-medicamentos',
  },
  unknownInformation: ['direcciones fisicas de sedes', 'horarios de atencion', 'precios de consultas', 'telefonos de contacto'],
});
