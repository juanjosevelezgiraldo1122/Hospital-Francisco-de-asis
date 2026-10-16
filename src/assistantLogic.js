import { hospitalKnowledge } from '../shared/assistantKnowledge.js';

const normalize = (value = '') => value
  .toLocaleLowerCase('es')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const formatAppointment = (appointment) => {
  const date = new Date(`${appointment.date}T12:00:00`).toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  return `${date}, ${appointment.time}${appointment.doctorName ? ` con ${appointment.doctorName}` : ''}${appointment.specialty ? ` (${appointment.specialty})` : ''}${appointment.sede ? ` en ${appointment.sede}` : ''}. Estado: ${appointment.status}.`;
};

const isUpcoming = (appointment, today) =>
  appointment.date >= today && ['Pendiente', 'En curso'].includes(appointment.status);

const personalAppointmentAnswer = (role, currentUser, data) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  if (role === 'patient') {
    const appointments = data.appointments
      .filter((item) => item.patientId === currentUser.id && isUpcoming(item, today))
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    return appointments.length
      ? `Estas son tus próximas citas registradas:\n${appointments.slice(0, 5).map((item, index) => `${index + 1}. ${formatAppointment(item)}`).join('\n')}`
      : 'No encuentro citas futuras pendientes o en curso en tu cuenta. Puedes solicitar una desde la sección Citas.';
  }

  if (role === 'doctor') {
    const appointments = data.appointments
      .filter((item) => item.doctorId === currentUser.id && isUpcoming(item, today))
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    return appointments.length
      ? `Tu agenda tiene ${appointments.length} cita(s) pendiente(s) o en curso. Próximos bloques:\n${appointments.slice(0, 5).map((item, index) => `${index + 1}. ${formatAppointment({ ...item, doctorName: '' })}`).join('\n')}\nNo incluyo información de pacientes en esta respuesta.`
      : 'No encuentro citas futuras pendientes o en curso asignadas a tu cuenta.';
  }

  const appointments = data.appointments
    .filter((item) => isUpcoming(item, today))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  return appointments.length
    ? `La agenda compartida tiene ${appointments.length} reserva(s) pendiente(s) o en curso. Los proximos horarios son: ${appointments.slice(0, 5).map((item) => `${item.date} ${item.time} (${item.status})`).join('; ')}. Consulta los nombres y detalles en Panel secretaria.`
    : 'No hay reservas futuras pendientes o en curso en la agenda.';
};

const personalOrderAnswer = (role, currentUser, data) => {
  if (role !== 'patient') return 'El seguimiento de pedidos personales esta disponible en la cuenta del paciente. Puedo explicarte el proceso de solicitud y envio.';
  const deliveries = data.deliveries
    .filter((item) => item.patientId === currentUser.id)
    .slice()
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  if (!deliveries.length) return 'No encuentro pedidos de medicamentos asociados a tu cuenta.';
  return `Estos son tus pedidos registrados:\n${deliveries.slice(0, 5).map((item) => `- ${item.id}: ${item.orderStatus || 'Recibido'}${item.createdAt ? `, solicitado el ${new Date(item.createdAt).toLocaleDateString('es-CO')}` : ''}. Pago: ${item.paymentStatus || item.status || 'Sin actualizar'}.`).join('\n')}`;
};

export function getLocalAssistantAnswer(message, currentUser, data) {
  const text = normalize(message);
  const role = currentUser?.role;
  if (!text || !role) return null;

  const requestsClinicalAdvice = /(diagnostico|sintoma|dolor|tratamiento para|que medicamento debo|dosis|efecto secundario|urgencia medica)/.test(text);
  if (requestsClinicalAdvice) {
    return 'No puedo evaluar síntomas, diagnosticar ni recomendar medicamentos o dosis. Consulta a un profesional de salud. Si crees que es una urgencia, contacta directamente los servicios locales de emergencia.';
  }

  const asksPersonalAppointments = /(proxim|mis citas|mi cita|cuando.*cita|citas.*tengo|mi agenda|agenda de hoy|turnos? de hoy)/.test(text);
  if (asksPersonalAppointments) return personalAppointmentAnswer(role, currentUser, data);

  const asksPersonalOrder = /(mis pedidos|mi pedido|mis domicilios|mis envios|mi envio|estado.*pedido|pedido.*estado|seguimiento.*pedido|como va.*pedido|donde esta.*pedido|estado.*envio|envio.*estado)/.test(text);
  if (asksPersonalOrder) return personalOrderAnswer(role, currentUser, data);

  if (role === 'patient' && /(medicamento|medicina|recetaron|prescrito|formula)/.test(text) && /(mi |mis |me )/.test(`${text} `)) {
    const prescriptions = data.prescriptions.filter((item) => item.patientId === currentUser.id);
    return prescriptions.length
      ? `En tu cuenta aparecen estos medicamentos prescritos: ${[...new Set(prescriptions.map((item) => item.medicine))].join(', ')}. Revisa las indicaciones completas en Medicamentos; no cambies dosis sin consultar a tu médico.`
      : 'No encuentro medicamentos prescritos asociados a tu cuenta. Consulta la sección Medicamentos después de que el médico registre una prescripción.';
  }

  if (role === 'admin' && /(stock|existencias|inventario|cuanto.*(hay|queda)|cuantos.*disponibles)/.test(text)) {
    const medicine = data.inventory.find((item) => normalize(item.medicine).split(' ').every((word) => text.includes(word)));
    if (medicine) return `El stock registrado de ${medicine.medicine} es ${medicine.stock} unidad(es). Puedes modificarlo en Panel medicamentos.`;
    if (/\b(stock|inventario|existencias)\b/.test(text)) {
      return `El stock se consulta y modifica en ${hospitalKnowledge.verifiedRoutes.adminMedicationPanel}. Escribe el nombre del medicamento en el buscador para ver su existencia actual.`;
    }
  }

  if ((role === 'secretary' || role === 'admin') && /(cuantas|numero|total).*(reservas?|citas?).*(hoy|pendientes?)|reservas?.*pendientes?.*hoy/.test(text)) {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
    const todayReservations = data.appointments.filter((item) => item.date === today);
    const pending = todayReservations.filter((item) => item.status === 'Pendiente').length;
    const inProgress = todayReservations.filter((item) => item.status === 'En curso').length;
    return `Hoy hay ${todayReservations.length} reserva(s): ${pending} pendiente(s) y ${inProgress} en curso. Puedes revisar el detalle en Panel secretaria.`;
  }

  if (/(sede|sedes|direccion|ubicacion)/.test(text)) {
    return `En el portal aparecen estas sedes: ${hospitalKnowledge.locations.join(', ')}. Las direcciones físicas y los horarios no están registrados en la información disponible, así que no puedo confirmarlos.`;
  }

  if (/(medio.*pago|como pago|formas? de pago|pagar|tarjeta|contra entrega)/.test(text)) {
    return `Para solicitudes de medicamentos, el portal ofrece: ${hospitalKnowledge.medicationPayments.join(' o ')}. El pago en linea se completa desde la pantalla de pago despues de confirmar el domicilio. No tengo informacion verificada sobre costos de consulta.`;
  }

  if (/(como|donde|pedir|solicitar|ordenar).*(cita|turno)|cita.*(pedir|solicitar|reservar|agendar)|agendar.*cita/.test(text)) {
    if (role === 'patient') {
      return `Para pedir una cita, abre ${hospitalKnowledge.verifiedRoutes.appointments} y selecciona el tipo de atencion, un medico disponible, sede, fecha y horario. Escribe el motivo y confirma. El portal comprueba que el horario no este ocupado.`;
    }
    if (role === 'secretary' || role === 'admin') {
      return `Desde ${hospitalKnowledge.verifiedRoutes.secretaryDesk}, elige Nueva cita, selecciona una ficha completa de paciente, tipo de atencion, medico, sede, fecha y horario disponible; luego registra el motivo y confirma. La cita se guarda solo si el bloque esta disponible.`;
    }
    return 'Como medico, puedes consultar tu agenda y citas asignadas en Panel medico. Las citas nuevas las solicitan los pacientes o las registra recepcion desde Panel secretaria.';
  }

  if (/(medicamento|medicina|farmacia|domicilio).*(pedir|solicitar|ordenar|como)|como.*(pedir|solicitar).*(medicamento|medicina)|proceso.*envio|envio.*medicamento/.test(text)) {
    if (role === 'patient') {
      return `Para solicitar medicamentos, primero deben estar prescritos por un medico en una consulta finalizada y tener existencias disponibles. Entra a ${hospitalKnowledge.verifiedRoutes.patientMedications}, selecciona el tratamiento, confirma tus datos de contacto y direccion, elige el pago y registra la solicitud. No se puede pedir desde esta seccion un medicamento que no aparezca prescrito.`;
    }
    if (role === 'doctor') return 'Durante la consulta, registra y finaliza la atencion para guardar las prescripciones. Solo indica medicamentos de acuerdo con tu criterio profesional; el paciente podra verlos en su modulo de Medicamentos.';
    if (role === 'admin') return `El catalogo, las existencias y el seguimiento de pedidos se administran en ${hospitalKnowledge.verifiedRoutes.adminMedicationPanel}. Los pacientes solo pueden solicitar medicamentos prescritos y con stock disponible.`;
    return 'Los pedidos corresponden al paciente. Recepcion puede ayudar con citas y datos de la ficha; el catalogo, stock y despacho se consultan desde los paneles correspondientes.';
  }

  if (/(envio|pedido|domicilio|despacho)/.test(text) && /(proceso|etapa|estado|significa|como funciona)/.test(text)) {
    return `Los estados definidos para un pedido son: ${hospitalKnowledge.deliveryStatuses.join(' → ')}. El portal actualiza el seguimiento cuando farmacia cambia el estado. No muestra estimaciones de entrega ni direcciones de las sedes.`;
  }

  return null;
}
