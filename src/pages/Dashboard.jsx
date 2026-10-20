import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  HeartPulse,
  PackageCheck,
  Pill,
  Search,
  ShieldCheck,
  Stethoscope,
  UsersRound,
} from 'lucide-react';
import { useAppData } from '../store';

const today = new Date().toISOString().slice(0, 10);
const statusClass = (status = '') => status.toLowerCase().replaceAll(' ', '-');
const formatDate = (value = '') => /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`
  : value || 'Fecha pendiente';

const quickLinks = {
  patient: [
    { to: '/citas', label: 'Mis citas', detail: 'Consulta o agenda una atención', icon: CalendarDays },
    { to: '/medicamentos', label: 'Medicamentos', detail: 'Tratamientos y solicitudes', icon: Pill },
    { to: '/mis-documentos', label: 'Mis documentos', detail: 'Consulta tus documentos', icon: FileText },
  ],
  doctor: [
    { to: '/doctores', label: 'Agenda médica', detail: 'Revisa y gestiona atenciones', icon: CalendarDays },
    { to: '/historia-clinica', label: 'Historias clínicas', detail: 'Continúa el seguimiento clínico', icon: FileText },
    { to: '/medicamentos', label: 'Medicamentos', detail: 'Consulta prescripciones', icon: Pill },
  ],
  admin: [
    { to: '/administracion', label: 'Administración', detail: 'Usuarios y configuración', icon: ShieldCheck },
    { to: '/secretaria', label: 'Agenda y recepción', detail: 'Citas y atención', icon: ClipboardList },
    { to: '/panel-medicamentos', label: 'Farmacia', detail: 'Inventario y solicitudes', icon: Pill },
  ],
};

export default function Dashboard() {
  const { currentUser, data } = useAppData();
  const [medicationQuery, setMedicationQuery] = useState('');

  const patientAppointments = data.appointments.filter((item) => item.patientId === currentUser.id);
  const doctorAppointments = data.appointments.filter((item) => item.doctorId === currentUser.id);
  const patientPrescriptions = data.prescriptions.filter((item) => item.patientId === currentUser.id);
  const patientDeliveries = data.deliveries.filter((item) => item.patientId === currentUser.id);
  const doctorRecords = data.clinicalRecords.filter((item) => item.doctorId === currentUser.id);
  const doctorPatientIds = new Set(doctorRecords.map((item) => item.patientId));
  const appointmentSource = currentUser.role === 'patient' ? patientAppointments
    : currentUser.role === 'doctor' ? doctorAppointments : data.appointments;
  const orderedAppointments = useMemo(() => appointmentSource.slice().sort((a, b) => {
    const aKey = `${a.date || ''} ${a.time || ''}`;
    const bKey = `${b.date || ''} ${b.time || ''}`;
    if (currentUser.role === 'admin') return bKey.localeCompare(aKey);
    const aFuture = a.date >= today;
    const bFuture = b.date >= today;
    if (aFuture !== bFuture) return aFuture ? -1 : 1;
    return aFuture ? aKey.localeCompare(bKey) : bKey.localeCompare(aKey);
  }), [appointmentSource, currentUser.role]);
  const nextAppointment = orderedAppointments.find((appointment) => appointment.date >= today && !['Cancelada', 'Finalizada'].includes(appointment.status));
  const visiblePatientDeliveries = patientDeliveries.filter((delivery) =>
    `${delivery.id} ${(delivery.items || []).map((item) => item.medicine).join(' ')}`.toLocaleLowerCase().includes(medicationQuery.trim().toLocaleLowerCase()),
  );

  const rolePanels = {
    patient: {
      title: 'Tu salud, en un solo lugar',
      description: 'Revisa tus atenciones, tratamientos y solicitudes desde tu espacio personal.',
      action: { to: '/citas', label: 'Agendar una cita', icon: CalendarDays },
      metrics: [
        { label: 'Citas registradas', value: patientAppointments.length, icon: CalendarDays, note: 'En tu cuenta' },
        { label: 'Tratamientos', value: patientPrescriptions.length, icon: Pill, note: 'Prescripciones en tu cuenta' },
        { label: 'Solicitudes', value: patientDeliveries.length, icon: PackageCheck, note: 'Pedidos de farmacia' },
      ],
      activityTitle: 'Próximas citas',
      activityLink: { to: '/citas', label: 'Ver todas' },
    },
    doctor: {
      title: 'Tu jornada médica',
      description: 'Una vista clara de tu agenda y del seguimiento de tus pacientes.',
      action: { to: '/doctores', label: 'Abrir agenda', icon: Stethoscope },
      metrics: [
        { label: 'Citas asignadas', value: doctorAppointments.length, icon: CalendarDays, note: 'En tu agenda' },
        { label: 'Por atender', value: doctorAppointments.filter((item) => item.status === 'Pendiente').length, icon: Clock3, note: 'Estado pendiente' },
        { label: 'Pacientes atendidos', value: doctorPatientIds.size, icon: UsersRound, note: 'Con historia clínica' },
      ],
      activityTitle: 'Agenda médica',
      activityLink: { to: '/doctores', label: 'Gestionar agenda' },
    },
    admin: {
      title: 'Resumen del hospital',
      description: 'Indicadores de operación y accesos principales para administrar el sistema.',
      action: { to: '/administracion', label: 'Administrar sistema', icon: ShieldCheck },
      metrics: [
        { label: 'Pacientes', value: data.patients.length, icon: UsersRound, note: 'Cuentas registradas' },
        { label: 'Equipo médico', value: data.doctors.filter((item) => item.status === 'activo').length, icon: Stethoscope, note: 'Profesionales activos' },
        { label: 'Citas', value: data.appointments.length, icon: ClipboardList, note: 'Registros del sistema' },
      ],
      activityTitle: 'Actividad de citas',
      activityLink: { to: '/secretaria', label: 'Abrir agenda' },
    },
  };

  const panel = rolePanels[currentUser.role] || rolePanels.patient;
  const links = quickLinks[currentUser.role] || quickLinks.patient;

  return (
    <section className={`page-content dashboard-layout dashboard-v2 dashboard-${currentUser.role}`}>
      <header className="dashboard-v2-hero">
        <div className="dashboard-v2-copy">
          <span className="dashboard-v2-kicker"><HeartPulse size={15} /> PORTAL DE SALUD</span>
          <h1>{panel.title}</h1>
          <p>{panel.description}</p>
          <div className="dashboard-v2-welcome"><span className="dashboard-v2-avatar">{(currentUser.name || 'U').trim().charAt(0).toUpperCase()}</span><span>Hola, <strong>{currentUser.name}</strong></span></div>
        </div>
        <div className="dashboard-v2-hero-side">
          {nextAppointment ? (
            <div className="dashboard-next-appointment">
              <span className="dashboard-next-label"><CalendarDays size={16} /> {currentUser.role === 'admin' ? 'PRÓXIMA ATENCIÓN' : 'TU PRÓXIMA CITA'}</span>
              <strong>{formatDate(nextAppointment.date)} <span>{nextAppointment.time}</span></strong>
              <small>{currentUser.role === 'patient' ? nextAppointment.doctorName : nextAppointment.patientName}</small>
            </div>
          ) : (
            <div className="dashboard-next-appointment is-empty">
              <span className="dashboard-next-label"><CheckCircle2 size={16} /> AGENDA</span>
              <strong>{currentUser.role === 'patient' ? 'Sin citas próximas' : 'Todo al día'}</strong>
              <small>{currentUser.role === 'patient' ? 'Cuando agendes, verás aquí tu próxima atención.' : 'No hay próximas atenciones pendientes.'}</small>
            </div>
          )}
          <Link className="dashboard-v2-action" to={panel.action.to}>{panel.action.label}<ArrowRight size={17} /></Link>
        </div>
      </header>

      <section className="dashboard-v2-metrics" aria-label="Indicadores principales">
        {panel.metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <article className={`dashboard-metric dashboard-metric-${index + 1}`} key={metric.label}>
              <span className="dashboard-metric-icon"><Icon size={20} /></span>
              <div className="dashboard-metric-copy"><span>{metric.label}</span><small>{metric.note}</small></div>
              <strong>{metric.value}</strong>
            </article>
          );
        })}
      </section>

      <div className="dashboard-v2-content">
        <section className="dashboard-v2-section dashboard-v2-activity" aria-labelledby="dashboard-activity-title">
          <div className="dashboard-v2-section-heading">
            <div><span className="dashboard-v2-section-kicker">SEGUIMIENTO</span><h2 id="dashboard-activity-title">{panel.activityTitle}</h2></div>
            <Link to={panel.activityLink.to}>{panel.activityLink.label}<ArrowRight size={15} /></Link>
          </div>
          {orderedAppointments.length ? (
            <div className="dashboard-appointment-list">
              {orderedAppointments.slice(0, 5).map((appointment) => (
                <article className="dashboard-appointment" key={appointment.id}>
                  <div className="dashboard-appointment-date"><strong>{appointment.date?.slice(8, 10) || '--'}</strong><span>{formatDate(appointment.date).slice(3, 10)}</span></div>
                  <div className="dashboard-appointment-main">
                    <strong>{currentUser.role === 'patient' ? appointment.doctorName || 'Atención médica' : appointment.patientName || 'Paciente'}</strong>
                    <span>{appointment.time || 'Hora pendiente'}{appointment.specialty ? ` · ${appointment.specialty}` : appointment.sede ? ` · ${appointment.sede}` : ''}</span>
                  </div>
                  <span className={`dashboard-appointment-status ${statusClass(appointment.status)}`}>{appointment.status || 'Pendiente'}</span>
                </article>
              ))}
            </div>
          ) : (
            <div className="dashboard-v2-empty"><CalendarDays size={24} /><strong>Aún no hay citas para mostrar</strong><span>Cuando se registre una cita, aparecerá aquí.</span>{currentUser.role === 'patient' ? <Link to="/citas">Agendar cita<ArrowRight size={15} /></Link> : null}</div>
          )}
        </section>

        <aside className="dashboard-v2-section dashboard-v2-links" aria-labelledby="dashboard-links-title">
          <div className="dashboard-v2-section-heading"><div><span className="dashboard-v2-section-kicker">ACCESO RÁPIDO</span><h2 id="dashboard-links-title">Tus herramientas</h2></div></div>
          <div className="dashboard-shortcut-list">
            {links.map((item) => {
              const Icon = item.icon;
              return <Link className="dashboard-shortcut" to={item.to} key={item.to}><span className="dashboard-shortcut-icon"><Icon size={19} /></span><span className="dashboard-shortcut-copy"><strong>{item.label}</strong><small>{item.detail}</small></span><ArrowRight size={16} /></Link>;
            })}
          </div>
        </aside>
      </div>

      {currentUser.role === 'patient' ? (
        <section id="patient-order-history" className="dashboard-v2-section dashboard-v2-orders" aria-labelledby="patient-orders-title">
          <div className="dashboard-v2-section-heading">
            <div><span className="dashboard-v2-section-kicker">FARMACIA</span><h2 id="patient-orders-title">Seguimiento de pedidos</h2><p>Consulta el estado de tus solicitudes de medicamentos.</p></div>
            <Link to="/medicamentos">Ir a medicamentos<ArrowRight size={15} /></Link>
          </div>
          {patientDeliveries.length ? (
            <>
              <label className="dashboard-order-search"><Search size={17} /><input value={medicationQuery} onChange={(event) => setMedicationQuery(event.target.value)} placeholder="Buscar por pedido o medicamento" aria-label="Buscar medicamentos en mis pedidos" /></label>
              {visiblePatientDeliveries.length ? (
                <div className="dashboard-order-list">
                  {visiblePatientDeliveries.slice().reverse().map((delivery) => (
                    <article key={delivery.id}>
                      <span className="dashboard-order-icon"><PackageCheck size={19} /></span>
                      <div className="dashboard-order-main"><strong>Solicitud {delivery.id}</strong><small>{delivery.items?.map((item) => `${item.medicine} × ${item.quantity}`).join(', ') || `${delivery.prescriptionIds?.length || 0} medicamentos`}</small></div>
                      <span className="dashboard-order-status">{delivery.orderStatus || 'Recibido'}</span>
                    </article>
                  ))}
                </div>
              ) : <p className="dashboard-order-empty">No hay pedidos que coincidan con la búsqueda.</p>}
            </>
          ) : <div className="dashboard-order-empty">Aún no has realizado solicitudes de medicamentos.</div>}
        </section>
      ) : null}
    </section>
  );
}
