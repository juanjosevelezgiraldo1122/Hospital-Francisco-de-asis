import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CalendarCheck,
  CalendarPlus,
  CalendarSync,
  CalendarX2,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Search,
  UserPlus,
  UserRound,
  CalendarClock,
  UsersRound,
  X,
} from 'lucide-react';
import { useAppData } from '../store';
import { downloadHospitalPdf, pdfFilename } from '../utils/hospitalPdf';

const today = new Date().toISOString().slice(0, 10);
const availableTimes = ['07:00', '08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
const blankPatient = {
  typeId: 'CC', document: '', names: '', lastNames: '', email: '', phone: '', birthDate: '', eps: '',
};
const blankAppointment = {
  patientId: '', attentionType: 'general', doctorId: '', sede: '', date: today, time: '', reason: '',
};
const statusClass = (status = '') => status.toLowerCase().replaceAll(' ', '-');

export default function Secretaria() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    currentUser,
    data,
    registerPatientBySecretary,
    createAppointmentForSecretary,
    rescheduleAppointment,
    updateAppointment,
  } = useAppData();
  const [patientQuery, setPatientQuery] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [selectedDocumentAppointmentId, setSelectedDocumentAppointmentId] = useState('');
  const [patientForm, setPatientForm] = useState(blankPatient);
  const [appointmentForm, setAppointmentForm] = useState(blankAppointment);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState(null);
  const [reservationStatus, setReservationStatus] = useState('Todas');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedPatient = data.patients.find((patient) => patient.id === selectedPatientId) || null;
  const patientAppointments = data.appointments
    .filter((appointment) => appointment.patientId === selectedPatientId)
    .slice()
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const patientDeliveries = data.deliveries.filter((delivery) => delivery.patientId === selectedPatientId);
  const selectedDocumentAppointment = patientAppointments.find((item) => item.id === selectedDocumentAppointmentId)
    || patientAppointments.find((item) => item.date >= today && item.status === 'Pendiente')
    || patientAppointments[0]
    || null;
  const filteredPatients = data.patients.filter((patient) =>
    `${patient.name} ${patient.document} ${patient.email}`.toLowerCase().includes(patientQuery.toLowerCase()),
  );
  const activeDoctors = data.doctors.filter((doctor) => doctor.status === 'activo');
  const todaysAppointments = data.appointments.filter((appointment) => appointment.date === today);
  const currentTime = new Date().toTimeString().slice(0, 5);
  const nextAppointment = todaysAppointments
    .filter((appointment) => appointment.status === 'Pendiente' && appointment.time >= currentTime)
    .sort((a, b) => a.time.localeCompare(b.time))[0]
    || todaysAppointments.find((appointment) => appointment.status === 'En curso')
    || null;
  const reservations = data.appointments
    .filter((appointment) => {
      const haystack = `${appointment.patientName} ${appointment.patientDocument} ${appointment.doctorName} ${appointment.status}`.toLowerCase();
      return haystack.includes(patientQuery.toLowerCase());
    })
    .slice()
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const visibleReservations = reservations.filter((appointment) =>
    reservationStatus === 'Todas' || appointment.status === reservationStatus,
  );
  const administrativeDocuments = [
    {
      id: 'contact-sheet', title: 'Ficha de contacto', description: 'Identificacion y canales de contacto registrados.', available: Boolean(selectedPatient),
      sections: () => [{ title: 'Datos registrados', rows: [
        { label: 'Tipo de documento', value: selectedPatient?.typeId },
        { label: 'Documento', value: selectedPatient?.document },
        { label: 'Telefono', value: selectedPatient?.phone },
        { label: 'Correo', value: selectedPatient?.email },
        { label: 'Direccion', value: selectedPatient?.address },
        { label: 'EPS registrada', value: selectedPatient?.eps },
      ] }],
    },
    {
      id: 'appointment-proof', title: 'Comprobante informativo de cita', description: 'Datos de una reserva existente, sin valor de certificado oficial.', available: Boolean(selectedPatient && selectedDocumentAppointment),
      sections: () => [{ title: 'Reserva seleccionada', rows: [
        { label: 'Fecha', value: selectedDocumentAppointment?.date },
        { label: 'Hora', value: selectedDocumentAppointment?.time },
        { label: 'Profesional', value: selectedDocumentAppointment?.doctorName },
        { label: 'Especialidad', value: selectedDocumentAppointment?.specialty },
        { label: 'Sede', value: selectedDocumentAppointment?.sede },
        { label: 'Estado', value: selectedDocumentAppointment?.status },
        { label: 'Motivo informado', value: selectedDocumentAppointment?.reason },
      ] }],
    },
    {
      id: 'appointment-list', title: 'Agenda del paciente', description: 'Relacion de citas registradas y estados actuales.', available: Boolean(selectedPatient && patientAppointments.length),
      sections: () => [{ title: 'Citas registradas', items: patientAppointments.map((item) => `${item.date} · ${item.time} · ${item.doctorName} · ${item.sede} · ${item.status}`) }],
    },
    {
      id: 'delivery-tracking', title: 'Seguimiento de pedidos', description: 'Estado, direccion y detalle de pedidos de medicamentos.', available: Boolean(selectedPatient && patientDeliveries.length),
      sections: () => patientDeliveries.map((item) => ({
        title: `Pedido ${item.id}`,
        rows: [
          { label: 'Fecha de solicitud', value: item.createdAt ? new Date(item.createdAt).toLocaleString('es-CO') : null },
          { label: 'Estado del pedido', value: item.orderStatus || item.status },
          { label: 'Estado del pago', value: item.paymentStatus || item.status },
          { label: 'Direccion de entrega', value: item.address },
          { label: 'Telefono de contacto', value: item.patientPhone },
          { label: 'Notas', value: item.deliveryNotes },
        ],
        items: (item.items || []).map((medicine) => `${medicine.medicine} · ${medicine.quantity} unidad(es)`),
      })),
    },
    {
      id: 'support-summary', title: 'Resumen de acompañamiento', description: 'Datos utiles para orientar al paciente en sus tramites.', available: Boolean(selectedPatient),
      sections: () => [
        { title: 'Contacto del paciente', rows: [
          { label: 'Telefono', value: selectedPatient?.phone },
          { label: 'Correo', value: selectedPatient?.email },
          { label: 'EPS registrada', value: selectedPatient?.eps },
        ] },
        { title: 'Citas', items: patientAppointments.map((item) => `${item.date} · ${item.time} · ${item.status} · ${item.doctorName}`) },
        { title: 'Pedidos', items: patientDeliveries.map((item) => `${item.id} · ${item.orderStatus || item.status} · ${item.createdAt ? new Date(item.createdAt).toLocaleDateString('es-CO') : 'Fecha no registrada'}`) },
      ],
    },
  ];

  const downloadAdministrativeDocument = (document) => {
    if (!selectedPatient || !document.available) return;
    downloadHospitalPdf({
      title: document.title,
      subtitle: 'Documento de apoyo administrativo · No incluye información clínica',
      patient: selectedPatient,
      sections: document.sections(),
      generatedBy: currentUser.name,
    }, pdfFilename(`hospital-fda-${document.id}-${selectedPatient.document}`));
  };
  const selectedAppointmentPatient = data.patients.find((patient) => patient.id === appointmentForm.patientId);
  const occupiedTimes = data.appointments
    .filter((appointment) =>
      appointment.doctorId === appointmentForm.doctorId &&
      appointment.date === appointmentForm.date &&
      appointment.id !== editingAppointmentId &&
      ['Pendiente', 'En curso'].includes(appointment.status),
    )
    .map((appointment) => appointment.time);
  const availableForDoctor = availableTimes.filter((time) => !occupiedTimes.includes(time));

  const resetFeedback = () => {
    setMessage('');
    setError('');
  };

  const openPatientModal = () => {
    resetFeedback();
    setPatientForm(blankPatient);
    setIsPatientModalOpen(true);
  };

  useEffect(() => {
    const action = searchParams.get('accion');
    if (action === 'registrar-paciente') {
      openPatientModal();
    } else if (action === 'nueva-cita') {
      resetFeedback();
      setAppointmentForm(blankAppointment);
      setEditingAppointmentId(null);
      setIsAppointmentModalOpen(true);
    } else {
      return;
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const savePatient = async (event) => {
    event.preventDefault();
    resetFeedback();
    const result = await registerPatientBySecretary(patientForm);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSelectedPatientId(result.patient.id);
    setPatientQuery(patientForm.document);
    setIsPatientModalOpen(false);
    setMessage(`Paciente ${result.patient.name} registrado correctamente.`);
  };

  const openAppointmentModal = (patientId = selectedPatientId) => {
    resetFeedback();
    if (!patientId && !data.patients.length) {
      setError('Registra un paciente antes de crear la primera cita.');
      return;
    }
    setAppointmentForm({ ...blankAppointment, patientId });
    setEditingAppointmentId(null);
    setIsAppointmentModalOpen(true);
  };

  const openRescheduleModal = (appointment) => {
    resetFeedback();
    setAppointmentForm({
      patientId: appointment.patientId,
      attentionType: appointment.attentionType || 'general',
      doctorId: appointment.doctorId,
      sede: appointment.sede,
      date: appointment.date,
      time: appointment.time,
      reason: appointment.reason || '',
    });
    setEditingAppointmentId(appointment.id);
    setIsAppointmentModalOpen(true);
  };

  const updateAppointmentForm = (field, value) => {
    setAppointmentForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'doctorId' || field === 'date') next.time = '';
      return next;
    });
    resetFeedback();
  };

  const saveAppointment = async (event) => {
    event.preventDefault();
    resetFeedback();
    if (!appointmentForm.patientId || !appointmentForm.doctorId || !appointmentForm.sede || !appointmentForm.date || !appointmentForm.time || !appointmentForm.reason) {
      setError('Completa paciente, medico, sede, fecha, hora y motivo.');
      return;
    }
    const result = await (editingAppointmentId
      ? rescheduleAppointment(editingAppointmentId, appointmentForm)
      : createAppointmentForSecretary(appointmentForm));
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setIsAppointmentModalOpen(false);
    setSelectedPatientId(appointmentForm.patientId);
    setMessage(editingAppointmentId ? 'Reserva reprogramada correctamente.' : 'Cita creada y reservada correctamente.');
  };

  const cancelReservation = async (appointment) => {
    const result = await updateAppointment(appointment.id, { status: 'Cancelada' });
    if (result.ok) setMessage('Reserva cancelada y disponibilidad liberada.');
    else setError(result.message);
    setError('');
  };

  const setPatientValue = (field, value) => setPatientForm((current) => ({ ...current, [field]: value }));

  return (
    <section className="page-content secretary-command-center">
      <header className="secretary-welcome-band">
        <div className="secretary-welcome-copy">
          <span className="eyebrow"><span className="secretary-live-dot" />Recepcion · {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <h1>Hola, {currentUser.name.split(' ')[0]}</h1>
          <p>Tu espacio de recepción está listo. Organiza la agenda y acompaña cada llegada.</p>
          <div className="secretary-welcome-actions">
            <button type="button" className="btn btn-primary" onClick={() => openAppointmentModal()}><CalendarPlus size={18} />Nueva cita</button>
            <button type="button" className="btn btn-secondary" onClick={openPatientModal}><UserPlus size={18} />Registrar paciente</button>
          </div>
        </div>
        <aside className="secretary-next-up" aria-live="polite">
          <span className="secretary-next-label"><Clock3 size={16} />Siguiente turno</span>
          {nextAppointment ? <>
            <strong className="secretary-next-time">{nextAppointment.time}</strong>
            <span className="secretary-next-patient">{nextAppointment.patientName}</span>
            <span className="secretary-next-doctor">{nextAppointment.doctorName} · {nextAppointment.specialty}</span>
          </> : <>
            <strong className="secretary-next-time">Agenda al día</strong>
            <span className="secretary-next-patient">No hay turnos pendientes hoy</span>
            <span className="secretary-next-doctor">Las nuevas reservas aparecerán aquí</span>
          </>}
        </aside>
      </header>

      {error ? <p className="form-message error">{error}</p> : null}
      {message ? <p className="form-message success">{message}</p> : null}

      <section id="secretary-kpis" className="secretary-kpi-grid" aria-label="Agenda del dia" aria-live="polite">
        <article className="metric-card secretary-metric secretary-metric-total"><span className="secretary-metric-icon"><CalendarCheck size={20} /></span><span className="secretary-metric-label">Citas de hoy</span><strong>{todaysAppointments.length}</strong><small>En toda la sede</small></article>
        <article className="metric-card secretary-metric secretary-metric-pending"><span className="secretary-metric-icon"><Clock3 size={20} /></span><span className="secretary-metric-label">Por atender</span><strong>{todaysAppointments.filter((item) => item.status === 'Pendiente').length}</strong><small>Esperando su turno</small></article>
        <article className="metric-card secretary-metric secretary-metric-active"><span className="secretary-metric-icon"><CalendarClock size={20} /></span><span className="secretary-metric-label">En consulta</span><strong>{todaysAppointments.filter((item) => item.status === 'En curso').length}</strong><small>Atención en curso</small></article>
        <article className="metric-card secretary-metric secretary-metric-cancelled"><span className="secretary-metric-icon"><CalendarX2 size={20} /></span><span className="secretary-metric-label">Canceladas</span><strong>{todaysAppointments.filter((item) => item.status === 'Cancelada').length}</strong><small>Disponibilidad liberada</small></article>
      </section>

      <section className="secretary-toolbar">
        <label className="search-box"><Search size={19} /><input value={patientQuery} onChange={(event) => setPatientQuery(event.target.value)} placeholder="Buscar paciente, documento, profesional o reserva" aria-label="Buscar en pacientes y reservas" /></label>
        <span className="secretary-search-count">{filteredPatients.length} fichas encontradas</span>
      </section>

      <div className="secretary-command-grid">
        <section id="secretary-patients" className="secretary-patient-console" aria-labelledby="secretary-patients-title">
          <div className="secretary-section-heading"><div className="section-intro compact"><span className="eyebrow">Directorio conectado</span><h2 id="secretary-patients-title">Pacientes disponibles</h2><p>Selecciona una ficha completa para iniciar una reserva.</p></div><span className="secretary-section-count">{filteredPatients.length}</span></div>
          <div className="secretary-patient-list">
            {filteredPatients.length ? filteredPatients.map((patient) => (
              <button type="button" className={patient.id === selectedPatient?.id ? 'active' : ''} key={patient.id} onClick={() => setSelectedPatientId(patient.id)} aria-pressed={patient.id === selectedPatient?.id}>
                <span className="secretary-patient-avatar">{patient.name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><span className="secretary-patient-copy"><strong>{patient.name}</strong><small>{patient.document} · {patient.eps}</small></span><span className="secretary-patient-action"><CalendarPlus size={17} /></span>
              </button>
            )) : <div className="empty-panel"><UserRound size={28} /><strong>No hay pacientes registrados</strong><span>Registra la ficha completa para poder agendar.</span><button type="button" className="btn btn-secondary" onClick={openPatientModal}>Registrar paciente</button></div>}
          </div>
        </section>

        <aside className="secretary-selected-patient" aria-labelledby="selected-secretary-patient-title">
          <div className="secretary-section-heading"><div className="section-intro compact"><span className="eyebrow">Ficha seleccionada</span><h2 id="selected-secretary-patient-title">{selectedPatient?.name || 'Prepara una reserva'}</h2></div>{selectedPatient ? <span className="secretary-profile-ready"><CheckCircle2 size={15} />Ficha completa</span> : null}</div>
          {selectedPatient ? (
            <>
              <div className="secretary-profile-overview"><div className="secretary-profile-mark"><UserRound size={30} /></div><div><strong>{selectedPatient.typeId} {selectedPatient.document}</strong><span>{selectedPatient.eps}</span></div></div>
              <dl className="secretary-patient-facts"><div><dt>Contacto</dt><dd>{selectedPatient.phone}</dd></div><div><dt>Correo</dt><dd>{selectedPatient.email}</dd></div><div><dt>Direccion</dt><dd>{selectedPatient.address}</dd></div><div><dt>Nacimiento</dt><dd>{selectedPatient.birthDate}</dd></div></dl>
              <button type="button" className="btn btn-primary full" onClick={() => openAppointmentModal(selectedPatient.id)}><CalendarPlus size={18} />Crear cita para este paciente</button>
            </>
          ) : <div className="empty-panel"><UsersRound size={30} /><span>La ficha completa aparecera aqui.</span></div>}
        </aside>
      </div>

      <section className="secretary-documents" aria-labelledby="secretary-documents-title">
        <div className="secretary-documents-heading">
          <div className="section-intro compact">
            <span className="eyebrow">Acompanamiento al paciente</span>
            <h2 id="secretary-documents-title">Documentos de apoyo</h2>
            <p>Genera copias administrativas para entregar o enviar al paciente seleccionado.</p>
          </div>
          {selectedPatient && patientAppointments.length ? (
            <label className="secretary-document-appointment">Cita para el comprobante
              <select value={selectedDocumentAppointment?.id || ''} onChange={(event) => setSelectedDocumentAppointmentId(event.target.value)}>
                {patientAppointments.map((appointment) => <option value={appointment.id} key={appointment.id}>{appointment.date} · {appointment.time} · {appointment.doctorName}</option>)}
              </select>
            </label>
          ) : null}
        </div>
        {selectedPatient ? (
          <>
            <div className="secretary-document-patient"><UserRound size={19} /><span>Paciente seleccionado</span><strong>{selectedPatient.name}</strong><small>{selectedPatient.document}</small></div>
            <div className="secretary-document-grid">
              {administrativeDocuments.map((document) => (
                <article className="secretary-document-item" key={document.id}>
                  <span className="secretary-document-icon"><FileText size={20} /></span>
                  <div><strong>{document.title}</strong><p>{document.description}</p></div>
                  <button type="button" className="icon-button secretary-document-download" onClick={() => downloadAdministrativeDocument(document)} disabled={!document.available} aria-label={`Descargar ${document.title}`} title={document.available ? 'Descargar PDF' : 'Aun no hay datos para este documento'}><Download size={18} /></button>
                </article>
              ))}
            </div>
            <p className="secretary-document-note">Estos PDF son documentos informativos basados en datos registrados. No contienen diagnosticos ni reemplazan certificados oficiales.</p>
          </>
        ) : (
          <div className="empty-panel secretary-documents-empty"><FileText size={28} /><strong>Selecciona un paciente</strong><span>Elige una ficha del directorio para preparar sus documentos de apoyo.</span></div>
        )}
      </section>

      <section id="reservations" className="secretary-reservations" aria-labelledby="reservations-title">
        <div className="secretary-reservations-heading"><div className="section-intro compact"><span className="eyebrow">Agenda operativa</span><h2 id="reservations-title">Reservas de citas</h2><p>Consulta y actualiza las reservas creadas por pacientes o secretaria.</p></div><label className="secretary-status-select">Estado<select value={reservationStatus} onChange={(event) => setReservationStatus(event.target.value)}><option>Todas</option><option>Pendiente</option><option>En curso</option><option>Finalizada</option><option>Cancelada</option></select></label></div>
        {visibleReservations.length ? <div className="reservation-table"><div className="reservation-table-head"><span>Paciente</span><span>Profesional</span><span>Fecha y hora</span><span>Estado</span><span>Acciones</span></div>{visibleReservations.map((appointment) => <article key={appointment.id}><div><strong>{appointment.patientName}</strong><small>{appointment.patientDocument}</small></div><div><strong>{appointment.doctorName}</strong><small>{appointment.specialty}</small></div><div><strong>{appointment.date}</strong><small>{appointment.time} - {appointment.sede}</small></div><span className={`status-badge ${statusClass(appointment.status)}`}>{appointment.status}</span><div className="row-actions">{['Pendiente'].includes(appointment.status) ? <><button type="button" className="btn-mini" onClick={() => openRescheduleModal(appointment)}><CalendarSync size={16} />Reprogramar</button><button type="button" className="btn-mini danger" onClick={() => cancelReservation(appointment)}><CalendarX2 size={16} />Cancelar</button></> : <small>Sin acciones disponibles</small>}</div></article>)}</div> : <div className="empty-panel"><CalendarCheck size={32} /><strong>{reservations.length ? 'No hay reservas con este estado' : 'No hay reservas para mostrar'}</strong><span>{reservations.length ? 'Prueba otro filtro o revisa de nuevo mas tarde.' : 'Las citas creadas apareceran aqui inmediatamente.'}</span></div>}
      </section>

      {isPatientModalOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsPatientModalOpen(false); }}>
          <section className="secretary-modal" role="dialog" aria-modal="true" aria-labelledby="patient-modal-title">
            <header className="modal-header"><div><span className="eyebrow">Ficha obligatoria</span><h2 id="patient-modal-title">Registrar paciente completo</h2><p>Estos datos seran la base de sus citas y su acceso posterior.</p></div><button type="button" className="icon-button" onClick={() => setIsPatientModalOpen(false)} title="Cerrar ventana"><X size={22} /></button></header>
            <form className="secretary-form" onSubmit={savePatient}>
              <div className="form-grid two"><label>Tipo ID<select value={patientForm.typeId} onChange={(event) => setPatientValue('typeId', event.target.value)}><option>CC</option><option>TI</option><option>CE</option></select></label><label>Documento<input value={patientForm.document} onChange={(event) => setPatientValue('document', event.target.value)} required /></label></div>
              <div className="form-grid two"><label>Nombres<input value={patientForm.names} onChange={(event) => setPatientValue('names', event.target.value)} required /></label><label>Apellidos<input value={patientForm.lastNames} onChange={(event) => setPatientValue('lastNames', event.target.value)} required /></label></div>
              <div className="form-grid two"><label>Correo<input type="email" value={patientForm.email} onChange={(event) => setPatientValue('email', event.target.value)} required /></label><label>Telefono<input value={patientForm.phone} onChange={(event) => setPatientValue('phone', event.target.value)} required /></label></div>
              <div className="form-grid two"><label>Fecha de nacimiento<input type="date" value={patientForm.birthDate} onChange={(event) => setPatientValue('birthDate', event.target.value)} required /></label><label>EPS<input value={patientForm.eps} onChange={(event) => setPatientValue('eps', event.target.value)} required /></label></div>
              <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setIsPatientModalOpen(false)}>Cancelar</button><button type="submit" className="btn btn-primary"><CheckCircle2 size={18} />Guardar ficha</button></div>
            </form>
          </section>
        </div>
      ) : null}

      {isAppointmentModalOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsAppointmentModalOpen(false); }}>
          <section className="secretary-modal" role="dialog" aria-modal="true" aria-labelledby="appointment-modal-title">
            <header className="modal-header"><div><span className="eyebrow">Reserva asistida</span><h2 id="appointment-modal-title">{editingAppointmentId ? 'Reprogramar cita' : 'Crear nueva cita'}</h2><p>La disponibilidad se valida antes de guardar.</p></div><button type="button" className="icon-button" onClick={() => setIsAppointmentModalOpen(false)} title="Cerrar ventana"><X size={22} /></button></header>
            <form className="secretary-form" onSubmit={saveAppointment}>
              <label>Paciente<select value={appointmentForm.patientId} onChange={(event) => updateAppointmentForm('patientId', event.target.value)} required><option value="">Seleccionar paciente</option>{data.patients.map((patient) => <option value={patient.id} key={patient.id}>{patient.name} - {patient.document}</option>)}</select></label>
              {selectedAppointmentPatient ? <div className="appointment-patient-strip"><UserRound size={20} /><div><strong>{selectedAppointmentPatient.name}</strong><span>{selectedAppointmentPatient.document} - {selectedAppointmentPatient.phone} - {selectedAppointmentPatient.eps}</span></div></div> : null}
              <div className="form-grid two"><label>Tipo de atencion<select value={appointmentForm.attentionType} onChange={(event) => updateAppointmentForm('attentionType', event.target.value)}><option value="general">Medicina general</option><option value="especialista">Especialista</option></select></label><label>Medico<select value={appointmentForm.doctorId} onChange={(event) => updateAppointmentForm('doctorId', event.target.value)} required><option value="">Seleccionar medico</option>{activeDoctors.filter((doctor) => appointmentForm.attentionType === 'general' ? doctor.medicalType === 'general' : doctor.medicalType !== 'general').map((doctor) => <option value={doctor.id} key={doctor.id}>{doctor.name} - {doctor.specialty}</option>)}</select></label></div>
              <div className="form-grid two"><label>Sede<select value={appointmentForm.sede} onChange={(event) => updateAppointmentForm('sede', event.target.value)} required><option value="">Seleccionar sede</option>{data.sedes.map((site) => <option value={site.name} key={site.id}>{site.name}</option>)}</select></label><label>Fecha<input type="date" min={today} value={appointmentForm.date} onChange={(event) => updateAppointmentForm('date', event.target.value)} required /></label></div>
              <fieldset className="secretary-time-picker"><legend>Hora disponible</legend><div className="time-options">{(appointmentForm.doctorId ? availableForDoctor : availableTimes).map((time) => <button type="button" className={appointmentForm.time === time ? 'selected' : ''} key={time} disabled={!appointmentForm.doctorId} onClick={() => updateAppointmentForm('time', time)}>{time}</button>)}</div></fieldset>
              <label>Motivo de consulta<textarea value={appointmentForm.reason} onChange={(event) => updateAppointmentForm('reason', event.target.value)} required /></label>
              <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setIsAppointmentModalOpen(false)}>Cancelar</button><button type="submit" className="btn btn-primary"><CalendarCheck size={18} />{editingAppointmentId ? 'Guardar cambio' : 'Confirmar reserva'}</button></div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
