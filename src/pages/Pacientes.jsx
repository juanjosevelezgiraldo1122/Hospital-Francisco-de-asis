import { useMemo, useState } from 'react';
import { BadgeCheck, Mail, MapPin, Phone, Search, ShieldCheck, UserRound } from 'lucide-react';
import { appointments, patients, prescriptions } from '../medicalData';

export default function Pacientes() {
  const [query, setQuery] = useState('');
  const [medicineQuery, setMedicineQuery] = useState('');
  const [selectedDocument, setSelectedDocument] = useState(patients[0].document);

  const filteredPatients = useMemo(
    () =>
      patients.filter((patient) =>
        `${patient.name} ${patient.document} ${patient.email}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );

  const selectedPatient =
    patients.find((patient) => patient.document === selectedDocument) || filteredPatients[0] || patients[0];

  const patientAppointments = appointments.filter((appointment) => appointment.document === selectedPatient.document);
  const patientPrescriptions = prescriptions.filter(
    (prescription) => prescription.patientDocument === selectedPatient.document,
  );
  const visiblePrescriptions = patientPrescriptions.filter((prescription) =>
    `${prescription.medicine} ${prescription.dose || ''}`.toLocaleLowerCase().includes(medicineQuery.trim().toLocaleLowerCase()),
  );

  return (
    <section className="page-content patient-console">
      <header className="module-header patient-header">
        <div>
          <span className="eyebrow">Paciente - ficha y trazabilidad</span>
          <h1>Consulta de pacientes registrados</h1>
          <p>
            Visualiza datos basicos, citas asociadas y tratamientos visibles sin exponer diagnosticos
            fuera del modulo clinico.
          </p>
        </div>
        <div className="module-chip">
          <ShieldCheck size={24} />
          Datos activos
        </div>
      </header>

      <div className="patient-grid">
        <aside className="patient-search-panel">
          <label className="search-box">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre, documento o correo"
            />
          </label>
          <div className="patient-list">
            {filteredPatients.map((patient) => (
              <button
                type="button"
                className={patient.document === selectedPatient.document ? 'active' : ''}
                key={patient.document}
                onClick={() => setSelectedDocument(patient.document)}
              >
                <UserRound size={20} />
                <span>
                  <strong>{patient.name}</strong>
                  <small>{patient.document}</small>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="patient-profile-card" aria-labelledby="patient-name">
          <div className="profile-hero-row">
            <div className="avatar-mark">
              <UserRound size={36} />
            </div>
            <div>
              <span className="eyebrow">{selectedPatient.typeId}</span>
              <h2 id="patient-name">{selectedPatient.name}</h2>
              <p>{selectedPatient.eps}</p>
            </div>
            <span className="status-badge pendiente">{selectedPatient.status}</span>
          </div>

          <div className="contact-grid">
            <article>
              <Mail size={20} />
              <span>Correo</span>
              <strong>{selectedPatient.email}</strong>
            </article>
            <article>
              <Phone size={20} />
              <span>Telefono</span>
              <strong>{selectedPatient.phone}</strong>
            </article>
            <article>
              <MapPin size={20} />
              <span>Direccion</span>
              <strong>{selectedPatient.address}</strong>
            </article>
            <article>
              <BadgeCheck size={20} />
              <span>Nacimiento</span>
              <strong>{selectedPatient.birthDate}</strong>
            </article>
          </div>

          <div className="patient-detail-columns">
            <article>
              <h3>Citas del paciente</h3>
              <div className="compact-records">
                {patientAppointments.length ? (
                  patientAppointments.map((appointment) => (
                    <div key={appointment.id}>
                      <span className={`status-dot ${appointment.status.toLowerCase().replaceAll(' ', '-')}`} />
                      <div>
                        <strong>{appointment.doctorName}</strong>
                        <small>
                          {appointment.date} - {appointment.time} - {appointment.status}
                        </small>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="empty-state">No hay citas asociadas.</p>
                )}
              </div>
            </article>
            <article>
              <h3>Medicamentos visibles</h3>
              <label className="search-box medication-list-search"><Search size={18} /><input value={medicineQuery} onChange={(event) => setMedicineQuery(event.target.value)} placeholder="Buscar medicamento" aria-label="Buscar medicamento en la ficha" /></label>
              <div className="compact-records">
                {patientPrescriptions.length ? visiblePrescriptions.length ? (
                  visiblePrescriptions.map((prescription) => (
                    <div key={`${prescription.appointmentId}-${prescription.medicine}`}>
                      <span className="status-dot finalizada" />
                      <div>
                        <strong>{prescription.medicine}</strong>
                        <small>
                          {prescription.dose} - {prescription.frequency} - {prescription.duration}
                        </small>
                      </div>
                    </div>
                  ))
                ) : <p className="empty-state">No hay medicamentos que coincidan con la busqueda.</p> : (
                  <p className="empty-state">No hay medicamentos de citas finalizadas.</p>
                )}
              </div>
            </article>
          </div>
        </section>
      </div>
    </section>
  );
}
