import { useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  FilterX,
  Pill,
  PlayCircle,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import { useAppData } from '../store';
import { downloadHospitalPdf, pdfFilename } from '../utils/hospitalPdf';

const today = new Date().toISOString().slice(0, 10);
const blankClinicalForm = { symptoms: '', diagnosis: '', observations: '', prescriptions: {} };
const statusClass = (status = '') => status.toLowerCase().replaceAll(' ', '-');

export default function Doctores() {
  const { currentUser, data, startAppointment, updateAppointment, saveClinicalRecord } = useAppData();
  const [agendaDate, setAgendaDate] = useState(today);
  const [activeAppointmentId, setActiveAppointmentId] = useState(null);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [patientQuery, setPatientQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [specialtyFilter, setSpecialtyFilter] = useState('Todas');
  const [isClinicalModalOpen, setIsClinicalModalOpen] = useState(false);
  const [clinicalForm, setClinicalForm] = useState(blankClinicalForm);
  const [medicationQuery, setMedicationQuery] = useState('');
  const [consultationId, setConsultationId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const doctorAppointments = useMemo(
    () => data.appointments.filter((appointment) => appointment.doctorId === currentUser.id),
    [data.appointments, currentUser.id],
  );
  const dayAgenda = useMemo(
    () => doctorAppointments.filter((appointment) => appointment.date === agendaDate).sort((a, b) => a.time.localeCompare(b.time)),
    [doctorAppointments, agendaDate],
  );
  const specialties = [...new Set(doctorAppointments.map((appointment) => appointment.specialty).filter(Boolean))];
  const filteredAgenda = dayAgenda.filter((appointment) => {
    const query = patientQuery.trim().toLowerCase();
    const matchesQuery = !query || `${appointment.patientName} ${appointment.patientDocument} ${appointment.reason}`.toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'Todos' || appointment.status === statusFilter;
    const matchesSpecialty = specialtyFilter === 'Todas' || appointment.specialty === specialtyFilter;
    return matchesQuery && matchesStatus && matchesSpecialty;
  });
  const activeAppointment = filteredAgenda.find((appointment) => appointment.id === activeAppointmentId) || filteredAgenda[0] || null;

  const dayPatients = useMemo(() => {
    const uniquePatients = new Map();
    filteredAgenda.forEach((appointment) => {
      if (uniquePatients.has(appointment.patientId)) return;
      const patient = data.patients.find((item) => item.id === appointment.patientId);
      uniquePatients.set(appointment.patientId, {
        ...(patient || {}),
        id: appointment.patientId,
        document: patient?.document || appointment.patientDocument,
        name: patient?.name || appointment.patientName,
        email: patient?.email || 'Sin correo registrado',
        phone: patient?.phone || 'Sin telefono registrado',
        lastAppointment: appointment,
      });
    });
    return Array.from(uniquePatients.values());
  }, [data.patients, filteredAgenda]);

  const visiblePatients = dayPatients.filter((patient) => `${patient.name} ${patient.document}`.toLowerCase().includes(patientQuery.toLowerCase()));
  const selectedPatient = dayPatients.find((patient) => patient.id === selectedPatientId) || dayPatients[0] || null;
  const recentRecords = data.clinicalRecords
    .filter((record) => record.doctorId === currentUser.id)
    .slice()
    .sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date));
  const selectedMedicationEntries = Object.values(clinicalForm.prescriptions);

  const downloadConsultation = (record) => {
    const patient = data.patients.find((item) => item.id === record.patientId) || {
      name: record.patientName,
      document: record.patientDocument,
    };
    const prescriptions = data.prescriptions.filter((item) => item.recordId === record.id);
    downloadHospitalPdf({
      title: 'Resumen de consulta médica',
      subtitle: `Atención clínica · Folio ${record.id}`,
      patient,
      generatedBy: currentUser.name,
      sections: [
        { title: 'Datos de la atencion', rows: [
          { label: 'Fecha', value: record.date },
          { label: 'Medico tratante', value: record.doctorName },
          { label: 'Especialidad', value: record.specialty },
          { label: 'Sede', value: record.sede },
          { label: 'Motivo informado', value: record.reason },
        ] },
        { title: 'Registro clinico', rows: [
          { label: 'Síntomas', value: record.symptoms },
          { label: 'Diagnóstico', value: record.diagnosis },
          { label: 'Observaciones y plan', value: record.observations },
        ] },
        { title: 'Medicamentos formulados', items: prescriptions.map((item) => `${item.medicine} · ${item.dose} · ${item.frequency} · ${item.duration}`) },
      ],
    }, pdfFilename(`hospital-fda-consulta-${record.patientDocument}-${record.date}`));
  };

  const openConsultation = async (appointment) => {
    setError('');
    setMessage('');
    setActiveAppointmentId(appointment.id);
    const result = await startAppointment(appointment.id);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setConsultationId(appointment.id);
    setClinicalForm(blankClinicalForm);
    setIsClinicalModalOpen(true);
  };

  const closeClinicalModal = () => {
    setIsClinicalModalOpen(false);
    setConsultationId(null);
    setClinicalForm(blankClinicalForm);
  };

  const updateClinicalField = (field, value) => {
    setClinicalForm((current) => ({ ...current, [field]: value }));
    setError('');
  };

  const toggleMedication = (medicine) => {
    setClinicalForm((current) => {
      const next = { ...current.prescriptions };
      if (next[medicine]) delete next[medicine];
      else next[medicine] = { medicine, dose: '', frequency: '', duration: '' };
      return { ...current, prescriptions: next };
    });
  };

  const updatePrescription = (medicine, field, value) => {
    setClinicalForm((current) => ({
      ...current,
      prescriptions: { ...current.prescriptions, [medicine]: { ...current.prescriptions[medicine], [field]: value } },
    }));
  };

  const saveConsultation = async (event) => {
    event.preventDefault();
    if (!clinicalForm.symptoms || !clinicalForm.diagnosis || !clinicalForm.observations) {
      setError('Completa sintomas, diagnostico y observaciones antes de finalizar.');
      return;
    }
    if (selectedMedicationEntries.some((item) => !item.dose || !item.frequency || !item.duration)) {
      setError('Completa dosis, frecuencia y duracion de cada medicamento seleccionado.');
      return;
    }
    const result = await saveClinicalRecord({
      appointmentId: consultationId,
      symptoms: clinicalForm.symptoms,
      diagnosis: clinicalForm.diagnosis,
      observations: clinicalForm.observations,
      prescriptions: selectedMedicationEntries,
    });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    closeClinicalModal();
    setMessage('Consulta finalizada. El historial y los medicamentos se actualizaron en tiempo real.');
  };

  const cancelAppointment = async (appointment) => {
    const result = await updateAppointment(appointment.id, { status: 'Cancelada' });
    if (result.ok) setMessage('Cita cancelada.');
    else setError(result.message);
    setError('');
  };

  return (
    <section className="page-content doctor-workbench">
      <header className="module-header doctor-header">
        <div>
          <span className="eyebrow">Panel medico unificado</span>
          <h1>Agenda, pacientes e inicio de consulta</h1>
          <p>Todo lo que necesitas para atender la jornada esta organizado en una sola vista y conectado al historial.</p>
        </div>
      </header>

      {error ? <p className="form-message error">{error}</p> : null}
      {message ? <p className="form-message success">{message}</p> : null}

      <div className="doctor-unified-grid">
        <section className="agenda-timeline" aria-labelledby="agenda-title">
          <div className="section-intro compact"><span className="eyebrow">Agenda del dia</span><h2 id="agenda-title">Citas ordenadas cronologicamente</h2><p>{filteredAgenda.length} resultados con los filtros actuales.</p></div>
          {filteredAgenda.length ? (
            <div className="doctor-agenda-list">
              {filteredAgenda.map((appointment) => (
                <article className={`doctor-appointment ${appointment.id === activeAppointment?.id ? 'selected' : ''}`} key={appointment.id}>
                  <button type="button" onClick={() => setActiveAppointmentId(appointment.id)}>
                    <time>{appointment.time}</time>
                    <div><strong>{appointment.patientName}</strong><span>{appointment.patientDocument}</span><small>{appointment.reason || 'Sin motivo registrado'}</small></div>
                  </button>
                  <span className={`status-badge ${statusClass(appointment.status)}`}>{appointment.status}</span>
                  <div className="row-actions">
                    {appointment.status === 'Pendiente' ? (
                      <>
                        <button type="button" className="btn-mini" onClick={() => openConsultation(appointment)}><PlayCircle size={16} />Iniciar cita</button>
                        <button type="button" className="btn-mini danger" onClick={() => cancelAppointment(appointment)}><Ban size={16} />Cancelar</button>
                      </>
                    ) : null}
                    {appointment.status === 'En curso' ? (
                      <button type="button" className="btn-mini" onClick={() => { setConsultationId(appointment.id); setClinicalForm(blankClinicalForm); setIsClinicalModalOpen(true); }}><FileText size={16} />Continuar consulta</button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-panel"><ClipboardList size={30} /><strong>No hay citas para esta fecha</strong><span>Las citas creadas por los pacientes apareceran aqui automaticamente.</span></div>
          )}
        </section>

        <aside className="doctor-patients-panel" aria-labelledby="patients-day-title">
          <section className="doctor-filter-panel" aria-labelledby="doctor-filters-title">
            <div className="section-intro compact"><span className="eyebrow">Vista personalizada</span><h2 id="doctor-filters-title">Filtros generales</h2></div>
            <label>Fecha de agenda<input type="date" value={agendaDate} onChange={(event) => setAgendaDate(event.target.value)} /></label>
            <label>Estado de cita<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>Todos</option><option>Pendiente</option><option>En curso</option><option>Finalizada</option><option>Cancelada</option></select></label>
            <label>Especialidad<select value={specialtyFilter} onChange={(event) => setSpecialtyFilter(event.target.value)}><option>Todas</option>{specialties.map((specialty) => <option key={specialty}>{specialty}</option>)}</select></label>
            <label>Buscar en agenda<input value={patientQuery} onChange={(event) => setPatientQuery(event.target.value)} placeholder="Paciente, documento o motivo" /></label>
            <button type="button" className="btn btn-secondary full" onClick={() => { setAgendaDate(today); setStatusFilter('Todos'); setSpecialtyFilter('Todas'); setPatientQuery(''); }}><FilterX size={17} />Limpiar filtros</button>
          </section>
          <div className="section-intro compact"><span className="eyebrow">Seguimiento</span><h2 id="patients-day-title">Pacientes del dia</h2></div>
          <div className="doctor-patient-list">
            {visiblePatients.length ? visiblePatients.map((patient) => (
              <button type="button" className={patient.id === selectedPatient?.id ? 'active' : ''} key={patient.id} onClick={() => setSelectedPatientId(patient.id)}>
                <UserRound size={20} /><span><strong>{patient.name}</strong><small>{patient.document} - {patient.lastAppointment.time}</small></span><span className={`status-dot ${statusClass(patient.lastAppointment.status)}`} />
              </button>
            )) : <p className="empty-state">No hay pacientes en esta jornada.</p>}
          </div>
          {selectedPatient ? (
            <div className="selected-patient-card">
              <div className="profile-hero-row compact"><div className="avatar-mark small"><UserRound size={22} /></div><div><span className="eyebrow">Ficha rapida</span><h3>{selectedPatient.name}</h3></div></div>
              <dl className="patient-facts">
                <div><dt>Documento</dt><dd>{selectedPatient.document}</dd></div>
                <div><dt>Contacto</dt><dd>{selectedPatient.phone}</dd></div>
                <div><dt>Correo</dt><dd>{selectedPatient.email}</dd></div>
                <div><dt>Motivo</dt><dd>{selectedPatient.lastAppointment.reason || 'Sin motivo'}</dd></div>
              </dl>
            </div>
          ) : null}
        </aside>
      </div>

      <section className="doctor-bottom-grid">
        <article className="dashboard-card">
          <div className="section-intro compact"><span className="eyebrow">Archivo clinico</span><h2>Consultas generadas por ti</h2><p>{recentRecords.length} registros disponibles para descargar.</p></div>
          {recentRecords.length ? <div className="doctor-record-list">{recentRecords.map((record) => (
            <div className="history-preview-row doctor-record-row" key={record.id}><FileText size={20} /><div><strong>{record.patientName}</strong><span>{record.date} - {record.diagnosis}</span></div><span className="status-badge finalizada">Guardado</span><button type="button" className="btn-mini doctor-record-download" onClick={() => downloadConsultation(record)} title={`Descargar consulta de ${record.patientName}`}><Download size={16} />PDF</button></div>
          ))}</div> : <p className="empty-state">Aun no has generado historiales.</p>}
        </article>
        <article className="dashboard-card doctor-active-summary">
          <div className="section-intro compact"><span className="eyebrow">Consulta seleccionada</span><h2>{activeAppointment?.patientName || 'Sin seleccion'}</h2></div>
          {activeAppointment ? <dl className="clinical-summary"><div><dt>Estado</dt><dd>{activeAppointment.status}</dd></div><div><dt>Hora</dt><dd>{activeAppointment.time}</dd></div><div><dt>Motivo</dt><dd>{activeAppointment.reason || 'Sin motivo registrado'}</dd></div></dl> : <p className="empty-state">Selecciona una cita para ver su resumen.</p>}
        </article>
      </section>

      {isClinicalModalOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeClinicalModal(); }}>
          <section className="clinical-modal" role="dialog" aria-modal="true" aria-labelledby="clinical-modal-title">
            <header className="modal-header">
              <div><span className="eyebrow">Consulta en curso</span><h2 id="clinical-modal-title">Registro de {activeAppointment?.patientName}</h2><p>{activeAppointment?.date} - {activeAppointment?.time} - {activeAppointment?.reason}</p></div>
              <button type="button" className="icon-button" onClick={closeClinicalModal} title="Cerrar ventana"><X size={22} /></button>
            </header>
            <form className="clinical-modal-form" onSubmit={saveConsultation}>
              <div className="form-grid two">
                <label>Sintomas *<textarea value={clinicalForm.symptoms} onChange={(event) => updateClinicalField('symptoms', event.target.value)} placeholder="Describe los sintomas reportados" required /></label>
                <label>Diagnostico *<textarea value={clinicalForm.diagnosis} onChange={(event) => updateClinicalField('diagnosis', event.target.value)} placeholder="Registra el diagnostico" required /></label>
              </div>
              <label>Observaciones *<textarea value={clinicalForm.observations} onChange={(event) => updateClinicalField('observations', event.target.value)} placeholder="Hallazgos, recomendaciones y plan de control" required /></label>
              <fieldset className="medication-picker">
                <legend>Medicamentos indicados</legend>
                <p>Selecciona uno o varios y completa las instrucciones de cada uno.</p>
                <label className="search-box medication-list-search"><Search size={18} /><input value={medicationQuery} onChange={(event) => setMedicationQuery(event.target.value)} placeholder="Buscar en el catalogo" aria-label="Buscar medicamentos para prescribir" /></label>
                <div className="medication-picker-list">
                  {data.medications.filter((medicine) => medicine.toLocaleLowerCase().includes(medicationQuery.trim().toLocaleLowerCase())).map((medicine) => (
                    <label className="medicine-choice" key={medicine}><input type="checkbox" checked={Boolean(clinicalForm.prescriptions[medicine])} onChange={() => toggleMedication(medicine)} /><span><Pill size={17} /><strong>{medicine}</strong></span></label>
                  ))}
                </div>
                {!data.medications.some((medicine) => medicine.toLocaleLowerCase().includes(medicationQuery.trim().toLocaleLowerCase())) ? <p className="empty-state">No hay medicamentos que coincidan con la busqueda.</p> : null}
                {selectedMedicationEntries.length ? <div className="prescription-detail-list">{selectedMedicationEntries.map((item) => (
                  <div className="prescription-detail-row" key={item.medicine}>
                    <strong>{item.medicine}</strong>
                    <input aria-label={`Dosis de ${item.medicine}`} placeholder="Dosis" value={item.dose} onChange={(event) => updatePrescription(item.medicine, 'dose', event.target.value)} />
                    <input aria-label={`Frecuencia de ${item.medicine}`} placeholder="Frecuencia" value={item.frequency} onChange={(event) => updatePrescription(item.medicine, 'frequency', event.target.value)} />
                    <input aria-label={`Duracion de ${item.medicine}`} placeholder="Duracion" value={item.duration} onChange={(event) => updatePrescription(item.medicine, 'duration', event.target.value)} />
                  </div>
                ))}</div> : null}
              </fieldset>
              {error ? <p className="form-message error">{error}</p> : null}
              <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={closeClinicalModal}>Seguir despues</button><button type="submit" className="btn btn-primary"><CheckCircle2 size={18} />Guardar y finalizar</button></div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
