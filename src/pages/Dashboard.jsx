import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  ClipboardList,
  HeartPulse,
  PackageCheck,
  Pill,
  Search,
  Stethoscope,
  UserCog,
  UsersRound,
} from 'lucide-react';
import { useAppData } from '../store';

const statusClass = (status = '') => status.toLowerCase().replaceAll(' ', '-');

export default function Dashboard() {
  const { currentUser, data } = useAppData();
  const [medicationQuery, setMedicationQuery] = useState('');

  const patientAppointments = data.appointments.filter((item) => item.patientId === currentUser.id);
  const doctorAppointments = data.appointments.filter((item) => item.doctorId === currentUser.id);
  const patientPrescriptions = data.prescriptions.filter((item) => item.patientId === currentUser.id);
  const patientDeliveries = data.deliveries.filter((item) => item.patientId === currentUser.id);
  const visiblePatientDeliveries = patientDeliveries.filter((delivery) =>
    `${delivery.id} ${(delivery.items || []).map((item) => item.medicine).join(' ')}`.toLocaleLowerCase().includes(medicationQuery.trim().toLocaleLowerCase()),
  );
  const doctorRecords = data.clinicalRecords.filter((item) => item.doctorId === currentUser.id);
  const doctorPatientIds = new Set(doctorRecords.map((item) => item.patientId));

  const rolePanels = {
    patient: {
      title: 'Panel del paciente',
      description: 'Tus citas, tratamientos y domicilios se actualizan con lo que generas en el sistema.',
      primary: { to: '/citas', label: 'Agendar cita' },
      metrics: [
        { label: 'Citas propias', value: patientAppointments.length, icon: CalendarDays },
        { label: 'Medicamentos prescritos', value: patientPrescriptions.length, icon: Pill },
        { label: 'Domicilios', value: patientDeliveries.length, icon: PackageCheck },
      ],
      listTitle: 'Tus proximas citas',
      items: patientAppointments.slice().reverse(),
    },
    doctor: {
      title: 'Panel medico',
      description: 'Agenda, historias clinicas y pacientes atendidos por tu usuario medico.',
      primary: { to: '/doctores', label: 'Ver agenda' },
      metrics: [
        { label: 'Citas asignadas', value: doctorAppointments.length, icon: CalendarDays },
        { label: 'Pendientes', value: doctorAppointments.filter((item) => item.status === 'Pendiente').length, icon: HeartPulse },
        { label: 'Pacientes atendidos', value: doctorPatientIds.size, icon: UsersRound },
      ],
      listTitle: 'Citas del medico',
      items: doctorAppointments.slice().reverse(),
    },
    admin: {
      title: 'Panel administrativo',
      description: 'Resumen real del sistema para gestionar doctores, secretaria y operacion.',
      primary: { to: '/administracion', label: 'Panel admin' },
      metrics: [
        { label: 'Pacientes registrados', value: data.patients.length, icon: UsersRound },
        { label: 'Doctores activos', value: data.doctors.filter((item) => item.status === 'activo').length, icon: Stethoscope },
        { label: 'Citas totales', value: data.appointments.length, icon: ClipboardList },
      ],
      listTitle: 'Actividad reciente',
      items: data.appointments.slice().reverse(),
    },
  };

  const panel = rolePanels[currentUser.role];

  return (
    <section className="page-content dashboard-layout">
      <header className="module-header dashboard-hero">
        <div>
          <span className="eyebrow">Panel principal</span>
          <h1>{panel.title}</h1>
          <p>{panel.description}</p>
        </div>
        <Link className="btn btn-primary" to={panel.primary.to}>
          {panel.primary.label}
        </Link>
      </header>

      <section className="dashboard-metrics" aria-label="Indicadores reales">
        {panel.metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article className="metric-card" key={metric.label}>
              <Icon size={24} />
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          );
        })}
      </section>

      <div className="dashboard-columns">
        <section className="dashboard-card" aria-labelledby="activity-title">
          <div className="section-intro compact">
            <span className="eyebrow">Actividad</span>
            <h2 id="activity-title">{panel.listTitle}</h2>
          </div>

          {panel.items.length ? (
            <div className="appointment-list">
              {panel.items.map((appointment) => (
                <article className="appointment-row" key={appointment.id}>
                  <div className={`status-dot ${statusClass(appointment.status)}`} />
                  <div>
                    <strong>{appointment.patientName}</strong>
                    <span>
                      {appointment.date} - {appointment.time} - {appointment.doctorName}
                    </span>
                    <small>{appointment.reason || appointment.sede}</small>
                  </div>
                  <span className={`status-badge ${statusClass(appointment.status)}`}>
                    {appointment.status}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-state">Aun no hay registros creados para mostrar aqui.</p>
          )}
        </section>

        <aside className="dashboard-card dashboard-route-card" aria-labelledby="next-title">
          <UserCog size={30} />
          <h2 id="next-title">Accesos segun rol</h2>
          <p>
            El menu solo muestra los apartados permitidos para {currentUser.name}. Las demas rutas quedan
            protegidas automaticamente.
          </p>
          <div className="route-pills">
            {currentUser.role === 'doctor' ? (
              <>
                <Link to="/doctores">Panel medico</Link>
                <Link to="/historia-clinica">Historial</Link>
              </>
            ) : null}
            {currentUser.role === 'patient' ? (
              <>
                <Link to="/citas">Citas</Link>
                <Link to="/medicamentos">Medicamentos</Link>
              </>
            ) : null}
            {currentUser.role === 'admin' ? (
              <>
                <Link to="/secretaria">Secretaria</Link>
                <Link to="/administracion">Administracion</Link>
              </>
            ) : null}
          </div>
        </aside>
      </div>

      {currentUser.role === 'patient' ? (
        <section id="patient-order-history" className="dashboard-card patient-order-history" aria-labelledby="patient-orders-title">
          <div className="section-intro compact">
            <span className="eyebrow">Farmacia</span>
            <h2 id="patient-orders-title">Estado de mis pedidos</h2>
            <p>El seguimiento cambia cuando farmacia actualiza el despacho.</p>
          </div>
          {patientDeliveries.length ? (
            <>
            <label className="search-box medication-list-search"><Search size={18} /><input value={medicationQuery} onChange={(event) => setMedicationQuery(event.target.value)} placeholder="Buscar en mis pedidos" aria-label="Buscar medicamentos en mis pedidos" /></label>
            {visiblePatientDeliveries.length ? (
            <div className="patient-order-list">
              {visiblePatientDeliveries.slice().reverse().map((delivery) => (
                <article key={delivery.id}>
                  <div><PackageCheck size={20} /><div><strong>{delivery.id}</strong><span>{new Date(delivery.createdAt).toLocaleString('es-CO')}</span></div></div>
                  <strong className="patient-order-status">{delivery.orderStatus || 'Recibido'}</strong>
                  <small>{(delivery.items || []).map((item) => `${item.medicine} × ${item.quantity}`).join(', ') || `${delivery.prescriptionIds.length} medicamentos`}</small>
                </article>
              ))}
            </div>
            ) : <p className="empty-state">No hay pedidos que coincidan con la busqueda.</p>}
            </>
          ) : <p className="empty-state">Aún no has realizado solicitudes de medicamentos.</p>}
        </section>
      ) : null}
    </section>
  );
}
