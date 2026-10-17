import { useMemo, useState } from 'react';
import { CalendarCheck, CalendarX2, Clock, MapPin, Stethoscope } from 'lucide-react';
import { useAppData } from '../store';

const availableTimes = ['07:00', '08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
const today = new Date().toISOString().slice(0, 10);

const blankForm = {
  attentionType: '',
  doctorId: '',
  sede: '',
  date: today,
  time: '',
  reason: '',
};

const statusClass = (status = '') => status.toLowerCase().replaceAll(' ', '-');

export default function Citas() {
  const { currentUser, data, createAppointment, updateAppointment } = useAppData();
  const [form, setForm] = useState(blankForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isPatient = currentUser.role === 'patient';
  const isDoctor = currentUser.role === 'doctor';

  const filteredDoctors = useMemo(() => {
    const active = data.doctors.filter((doctor) => doctor.status === 'activo');
    if (!form.attentionType) return active;
    return active.filter((doctor) =>
      form.attentionType === 'general' ? doctor.medicalType === 'general' : doctor.medicalType !== 'general',
    );
  }, [data.doctors, form.attentionType]);

  const selectedDoctor = data.doctors.find((doctor) => doctor.id === form.doctorId);
  const occupiedTimes = data.appointments
    .filter(
      (appointment) =>
        appointment.doctorId === form.doctorId &&
        appointment.date === form.date &&
        ['Pendiente', 'En curso'].includes(appointment.status),
    )
    .map((appointment) => appointment.time);
  const availableForDoctor = availableTimes.filter((time) => !occupiedTimes.includes(time));
  const visibleAppointments = isPatient
    ? data.appointments.filter((appointment) => appointment.patientId === currentUser.id)
    : data.appointments.filter((appointment) => appointment.doctorId === currentUser.id);

  const updateForm = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'attentionType') {
        next.doctorId = '';
        next.time = '';
      }
      if (field === 'doctorId' || field === 'date') next.time = '';
      return next;
    });
    setMessage('');
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!isPatient) return;
    if (!form.attentionType || !form.doctorId || !form.sede || !form.date || !form.time || !form.reason) {
      setError('Completa todos los campos para confirmar la cita.');
      return;
    }

    const result = await createAppointment(form);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    setMessage('Cita creada en estado Pendiente. El horario quedo reservado.');
    setForm(blankForm);
  };

  const cancelAppointment = async (appointmentId) => {
    const result = await updateAppointment(appointmentId, { status: 'Cancelada' });
    if (result.ok) setMessage('Cita cancelada. El horario vuelve a quedar disponible.');
    else setError(result.message);
  };

  return (
    <section className="page-content appointment-layout">
      <header className="module-header">
        <div>
          <span className="eyebrow">Citas medicas</span>
          <h1>Agendamiento con disponibilidad real</h1>
          <p>
            El sistema valida doctor, fecha y hora antes de guardar. Si el medico ya tiene una cita,
            se muestra el aviso de no disponibilidad.
          </p>
        </div>
        <div className="module-chip">
          <CalendarCheck size={24} />
          Disponibilidad
        </div>
      </header>

      {error ? <p className="form-message error">{error}</p> : null}
      {message ? <p className="form-message success">{message}</p> : null}

      <div className="appointment-grid">
        {isPatient ? (
          <form className="scheduler-card" onSubmit={handleSubmit}>
            <div className="section-intro compact">
              <span className="eyebrow">Nueva cita</span>
              <h2>Seleccion de atencion</h2>
            </div>

            <label>
              Tipo de atencion *
              <select value={form.attentionType} onChange={(event) => updateForm('attentionType', event.target.value)} required>
                <option value="">Seleccionar</option>
                <option value="general">Medicina general</option>
                <option value="especialista">Especialista</option>
              </select>
            </label>

            <label>
              Medico *
              <select value={form.doctorId} onChange={(event) => updateForm('doctorId', event.target.value)} required>
                <option value="">Seleccionar medico</option>
                {filteredDoctors.map((doctor) => (
                  <option value={doctor.id} key={doctor.id}>
                    {doctor.name} - {doctor.specialty}
                  </option>
                ))}
              </select>
            </label>

            <div className="form-grid two">
              <label>
                Sede *
                <select value={form.sede} onChange={(event) => updateForm('sede', event.target.value)} required>
                  <option value="">Seleccionar sede</option>
                  {data.sedes.map((site) => (
                    <option value={site.name} key={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Fecha *
                <input type="date" min={today} value={form.date} onChange={(event) => updateForm('date', event.target.value)} required />
              </label>
            </div>

            <fieldset className="time-fieldset">
              <legend>Horarios disponibles *</legend>
              {form.doctorId && availableForDoctor.length === 0 ? (
                <p className="form-message error">No hay disponibilidad para ese medico en la fecha seleccionada.</p>
              ) : null}
              <div className="time-options">
                {(form.doctorId ? availableForDoctor : availableTimes).map((time) => (
                  <button type="button" className={form.time === time ? 'selected' : ''} key={time} onClick={() => updateForm('time', time)} disabled={!form.doctorId}>
                    {time}
                  </button>
                ))}
              </div>
            </fieldset>

            <label>
              Motivo de consulta *
              <textarea value={form.reason} onChange={(event) => updateForm('reason', event.target.value)} required />
            </label>

            <button className="btn btn-primary full" type="submit">
              Confirmar cita
            </button>
          </form>
        ) : (
          <section className="scheduler-card">
            <div className="section-intro compact">
              <span className="eyebrow">Vista medica</span>
              <h2>Citas asignadas</h2>
            </div>
            <p>Desde esta vista revisas tus citas. El inicio de consulta se gestiona en Medico.</p>
          </section>
        )}

        <aside id="appointment-summary" className="appointment-summary" aria-label="Resumen de disponibilidad">
          <span className="eyebrow">Resumen</span>
          <h2>{isPatient ? 'Antes de confirmar' : 'Agenda del medico'}</h2>
          <dl>
            <div>
              <dt>Medico</dt>
              <dd>{selectedDoctor?.name || (isDoctor ? currentUser.name : 'Pendiente')}</dd>
            </div>
            <div>
              <dt>Fecha y hora</dt>
              <dd>
                {form.date} {form.time}
              </dd>
            </div>
            <div>
              <dt>Disponibles</dt>
              <dd>{form.doctorId ? availableForDoctor.length : availableTimes.length} bloques</dd>
            </div>
          </dl>
          <p>Los datos se guardan solo al confirmar y se actualizan en panel, medico e historias clinicas.</p>
        </aside>
      </div>

      <section id="appointments-list" className="appointment-list-panel" aria-labelledby="appointments-title">
        <div className="section-intro compact">
          <span className="eyebrow">{isPatient ? 'Mis citas' : 'Mis pacientes citados'}</span>
          <h2 id="appointments-title">Registros creados</h2>
        </div>
        {visibleAppointments.length ? (
          <div className="appointment-list">
            {visibleAppointments.slice().reverse().map((appointment) => (
              <article className="appointment-row" key={appointment.id}>
                <div className={`status-dot ${statusClass(appointment.status)}`} />
                <div>
                  <strong>{isPatient ? appointment.doctorName : appointment.patientName}</strong>
                  <span>
                    {appointment.date} - {appointment.time} - {appointment.sede}
                  </span>
                  <small>{appointment.reason}</small>
                </div>
                <span className={`status-badge ${statusClass(appointment.status)}`}>{appointment.status}</span>
                {isPatient && appointment.status === 'Pendiente' ? (
                  <button className="icon-danger" type="button" onClick={() => cancelAppointment(appointment.id)}>
                    <CalendarX2 size={18} />
                    Cancelar
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">No hay citas creadas para este usuario.</p>
        )}
      </section>

      <section className="availability-notes">
        <article>
          <Clock size={22} />
          <strong>Horarios</strong>
          <span>Los bloques ocupados desaparecen de la seleccion.</span>
        </article>
        <article>
          <Stethoscope size={22} />
          <strong>Profesional</strong>
          <span>Solo se muestran doctores activos.</span>
        </article>
        <article>
          <MapPin size={22} />
          <strong>Sedes</strong>
          <span>La cita queda asociada a una sede institucional.</span>
        </article>
      </section>
    </section>
  );
}
