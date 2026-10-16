import { useMemo, useState } from 'react';
import { CalendarDays, FileText, Lock, Pill, Search, Stethoscope, UserRound } from 'lucide-react';
import { useAppData } from '../store';

const today = new Date().toISOString().slice(0, 10);
const statusClass = (status = '') => status.toLowerCase().replaceAll(' ', '-');

export default function HistoriaClinica() {
  const { currentUser, data } = useAppData();
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [historyDate, setHistoryDate] = useState(today);
  const [patientQuery, setPatientQuery] = useState('');
  const [medicineQuery, setMedicineQuery] = useState('');

  const dayAppointments = useMemo(
    () => data.appointments
      .filter((appointment) => appointment.doctorId === currentUser.id && appointment.date === historyDate)
      .sort((a, b) => a.time.localeCompare(b.time)),
    [data.appointments, currentUser.id, historyDate],
  );

  const dayPatients = useMemo(() => {
    const unique = new Map();
    dayAppointments.forEach((appointment) => {
      if (unique.has(appointment.patientId)) return;
      const patient = data.patients.find((item) => item.id === appointment.patientId);
      unique.set(appointment.patientId, {
        id: appointment.patientId,
        name: patient?.name || appointment.patientName,
        document: patient?.document || appointment.patientDocument,
        appointment,
      });
    });
    return Array.from(unique.values());
  }, [data.patients, dayAppointments]);

  const visiblePatients = dayPatients.filter((patient) =>
    `${patient.name} ${patient.document}`.toLowerCase().includes(patientQuery.toLowerCase()),
  );
  const latestRecords = data.clinicalRecords
    .slice()
    .sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date))
    .slice(0, 2);
  const selectedRecord = latestRecords.find((record) => record.id === selectedRecordId) || latestRecords[0] || null;
  const selectedPrescriptions = selectedRecord
    ? data.prescriptions.filter((prescription) => prescription.recordId === selectedRecord.id)
    : [];
  const visiblePrescriptions = selectedPrescriptions.filter((prescription) =>
    `${prescription.medicine} ${prescription.dose || ''}`.toLocaleLowerCase().includes(medicineQuery.trim().toLocaleLowerCase()),
  );

  return (
    <section className="page-content history-layout">
      <header className="module-header history-header">
        <div>
          <span className="eyebrow">Historial</span>
          <h1>Pacientes del dia y ultimos registros medicos</h1>
          <p>Esta seccion se alimenta del mismo estado que usa el panel medico. Cada consulta finalizada aparece aqui de inmediato.</p>
        </div>
        <label className="date-filter"><CalendarDays size={18} /> Fecha de pacientes<input type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} /></label>
      </header>

      <div className="history-live-banner"><Lock size={20} /><span>Acceso clinico protegido. Los registros son de solo lectura despues de finalizar una consulta.</span></div>

      <div className="history-live-grid">
        <aside className="record-index day-patient-index" aria-labelledby="day-patients-title">
          <div className="section-intro compact"><span className="eyebrow">Agenda vinculada</span><h2 id="day-patients-title">Pacientes del dia</h2></div>
          <label className="search-box"><Search size={18} /><input value={patientQuery} onChange={(event) => setPatientQuery(event.target.value)} placeholder="Buscar paciente" /></label>
          <div className="history-patient-list">
            {visiblePatients.length ? visiblePatients.map((patient) => (
              <article key={patient.id}>
                <UserRound size={20} />
                <div><strong>{patient.name}</strong><small>{patient.document}</small><small>{patient.appointment.time} - {patient.appointment.status}</small></div>
                <span className={`status-dot ${statusClass(patient.appointment.status)}`} />
              </article>
            )) : <p className="empty-state">No hay pacientes agendados para esta fecha.</p>}
          </div>
        </aside>

        <section id="recent-history" className="clinical-document" aria-labelledby="latest-history-title">
          <div className="document-toolbar"><div><span className="eyebrow">Actualizacion en tiempo real</span><h2 id="latest-history-title">Dos ultimos historiales</h2></div><span className="module-chip"><FileText size={18} />{latestRecords.length} registros</span></div>
          {selectedRecord ? (
            <>
              <div className="history-record-tabs">
                {latestRecords.map((record, index) => (
                  <button type="button" className={record.id === selectedRecord.id ? 'active' : ''} key={record.id} onClick={() => setSelectedRecordId(record.id)}>
                    <span>Registro {index + 1}</span><strong>{record.patientName}</strong><small>{record.date}</small>
                  </button>
                ))}
              </div>
              <div className="clinical-sheet">
                <article><Stethoscope size={22} /><div><span>Medico tratante</span><strong>{selectedRecord.doctorName}</strong><small>{selectedRecord.specialty || 'Especialidad no registrada'}</small></div></article>
                <article><FileText size={22} /><div><span>Paciente</span><strong>{selectedRecord.patientName}</strong><small>{selectedRecord.patientDocument}</small></div></article>
              </div>
              <div className="history-data-grid">
                <article><span>Sintomas</span><strong>{selectedRecord.symptoms || 'No registrados'}</strong></article>
                <article><span>Diagnostico</span><strong>{selectedRecord.diagnosis}</strong></article>
                <article className="wide"><span>Observaciones</span><strong>{selectedRecord.observations}</strong></article>
              </div>
              <section className="history-medications"><div className="section-intro compact"><span className="eyebrow">Prescripcion vinculada</span><h2>Medicamentos indicados</h2></div>{selectedPrescriptions.length ? <><label className="search-box medication-list-search"><Search size={18} /><input value={medicineQuery} onChange={(event) => setMedicineQuery(event.target.value)} placeholder="Buscar medicamento" aria-label="Buscar medicamento en el historial" /></label>{visiblePrescriptions.length ? <div className="history-medication-list">{visiblePrescriptions.map((prescription) => <article key={prescription.id}><Pill size={20} /><div><strong>{prescription.medicine}</strong><span>{prescription.dose} - {prescription.frequency} - {prescription.duration}</span></div></article>)}</div> : <p className="empty-state">No hay medicamentos que coincidan con la busqueda.</p>}</> : <p className="empty-state">Este registro no tiene medicamentos indicados.</p>}</section>
            </>
          ) : (
            <div className="empty-panel history-empty"><FileText size={34} /><strong>Aun no hay historiales finalizados</strong><span>Cuando finalices una consulta desde Panel medico, los dos registros mas recientes apareceran aqui.</span></div>
          )}
        </section>
      </div>
    </section>
  );
}
