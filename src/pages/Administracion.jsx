import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ClipboardCheck,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserCog,
  UserPlus,
  UserRound,
} from 'lucide-react';
import { useAppData } from '../store';

const roleLabels = {
  admin: 'Administrador',
  doctor: 'Medico',
  secretary: 'Secretaria',
  patient: 'Paciente',
};

const roleIcons = {
  doctor: Stethoscope,
  secretary: ClipboardCheck,
  patient: UserRound,
};

const roleExperience = {
  doctor: {
    title: 'Perfil clinico',
    subtitle: 'Atencion y seguimiento de pacientes',
    access: ['Agenda y citas asignadas', 'Historias clinicas', 'Prescripciones medicas'],
    destination: 'Agenda medica y consulta',
  },
  secretary: {
    title: 'Perfil de recepcion',
    subtitle: 'Organizacion de citas y orientacion',
    access: ['Reservas y disponibilidad', 'Registro de pacientes', 'Agenda diaria'],
    destination: 'Recepcion y agenda',
  },
  patient: {
    title: 'Portal personal',
    subtitle: 'Servicios y seguimiento de salud',
    access: ['Solicitud de citas', 'Tratamientos y pedidos', 'Datos personales'],
    destination: 'Portal del paciente',
  },
};

const emptyForm = {
  document: '',
  typeId: 'CC',
  name: '',
  names: '',
  lastNames: '',
  email: '',
  phone: '',
  birthDate: '',
  eps: '',
  license: '',
  specialty: 'Medicina General',
  medicalType: 'general',
  sede: '',
  password: '',
};

const formFields = {
  doctor: [
    ['document', 'Documento', 'text'],
    ['name', 'Nombre completo', 'text'],
    ['email', 'Correo institucional', 'email'],
    ['phone', 'Telefono', 'tel'],
    ['license', 'Registro profesional', 'text'],
  ],
  secretary: [
    ['document', 'Documento', 'text'],
    ['name', 'Nombre completo', 'text'],
    ['email', 'Correo institucional', 'email'],
    ['phone', 'Telefono', 'tel'],
  ],
};

const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

export default function Administracion() {
  const { data, currentUser, addDoctor, addSecretary, registerPatient, updateUserRole } = useAppData();
  const [accountType, setAccountType] = useState('doctor');
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState(null);
  const stats = useMemo(
    () => ({
      doctors: data.users.filter((user) => user.role === 'doctor' && user.status === 'activo').length,
      secretaries: data.users.filter((user) => user.role === 'secretary' && user.status === 'activo').length,
      patients: data.users.filter((user) => user.role === 'patient' && user.status === 'activo').length,
    }),
    [data.users],
  );
  const ActiveRoleIcon = roleIcons[accountType];
  const experience = roleExperience[accountType];
  const previewName = accountType === 'patient'
    ? `${form.names} ${form.lastNames}`.trim()
    : form.name.trim();
  const requiredProfileFields = accountType === 'patient'
    ? [form.document, form.names, form.lastNames, form.email, form.phone, form.birthDate, form.eps]
    : [form.document, form.name, form.email, form.phone, accountType === 'doctor' ? form.license : true];
  const profileIsReady = requiredProfileFields.every(Boolean);
  const accessIsReady = form.password.length >= 7;
  const setValue = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const selectAccountType = (type) => {
    setAccountType(type);
    setForm(emptyForm);
    setMessage(null);
  };

  const submitAccount = async (event) => {
    event.preventDefault();
    const result = await (
      accountType === 'doctor'
        ? addDoctor(form)
        : accountType === 'secretary'
          ? addSecretary(form)
          : registerPatient(form, false));

    if (!result.ok) {
      setMessage({ type: 'error', text: result.message });
      return;
    }

    setMessage({
      type: 'success',
      text: `${roleLabels[accountType]} creado correctamente. Usuario: ${result.username || form.username || form.document} | Clave: ${form.password}`,
    });
    setForm(emptyForm);
  };

  const updateRole = async (userId, role) => {
    const result = await updateUserRole(userId, role);
    setMessage(
      result.ok
        ? { type: 'success', text: 'Rol actualizado y guardado. Las vistas relacionadas se sincronizaron.' }
        : { type: 'error', text: result.message },
    );
  };

  const renderProfessionalFields = () => (
    <>
      <div className="form-grid two">
        <label>
          Especialidad
          <select value={form.specialty} onChange={(event) => setValue('specialty', event.target.value)}>
            <option>Medicina General</option>
            <option>Pediatria</option>
            <option>Cardiologia</option>
          </select>
        </label>
        <label>
          Tipo de atencion
          <select value={form.medicalType} onChange={(event) => setValue('medicalType', event.target.value)}>
            <option value="general">General</option>
            <option value="especialista">Especialista</option>
          </select>
        </label>
      </div>
      <label>
        Sede asignada
        <select value={form.sede} onChange={(event) => setValue('sede', event.target.value)}>
          {data.sedes.map((site) => <option key={site.id} value={site.name}>{site.name}</option>)}
        </select>
      </label>
    </>
  );

  const renderPatientFields = () => (
    <>
      <div className="form-grid two">
        <label>
          Tipo ID
          <select value={form.typeId} onChange={(event) => setValue('typeId', event.target.value)}>
            <option>CC</option>
            <option>TI</option>
            <option>CE</option>
          </select>
        </label>
        <label>
          Documento
          <input value={form.document} onChange={(event) => setValue('document', event.target.value)} required />
        </label>
      </div>
      <div className="form-grid two">
        <label>
          Nombres
          <input value={form.names} onChange={(event) => setValue('names', event.target.value)} required />
        </label>
        <label>
          Apellidos
          <input value={form.lastNames} onChange={(event) => setValue('lastNames', event.target.value)} required />
        </label>
      </div>
      <div className="form-grid two">
        <label>
          Correo
          <input type="email" value={form.email} onChange={(event) => setValue('email', event.target.value)} required />
        </label>
        <label>
          Telefono
          <input value={form.phone} onChange={(event) => setValue('phone', event.target.value)} required />
        </label>
      </div>
      <div className="form-grid two">
        <label>
          EPS
          <input value={form.eps} onChange={(event) => setValue('eps', event.target.value)} required />
        </label>
        <label>
          Fecha de nacimiento
          <input type="date" value={form.birthDate} onChange={(event) => setValue('birthDate', event.target.value)} required />
        </label>
      </div>
    </>
  );

  return (
    <section className="page-content admin-layout">
      <header className="module-header admin-header">
        <div>
          <span className="eyebrow">Administracion y acceso</span>
          <h1>Gestiona el equipo del hospital</h1>
          <p>
            Crea cuentas listas para iniciar sesion y mantenlas disponibles de inmediato en citas,
            agendas, pacientes y paneles operativos.
          </p>
        </div>
        <div className="module-chip">
          <UserCog size={24} />
          Centro admin
        </div>
      </header>

      {message ? <p className={`form-message ${message.type}`} role="status">{message.text}</p> : null}

      <section className="admin-stat-grid" aria-label="Resumen de usuarios">
        <article className="admin-stat">
          <Stethoscope size={22} />
          <span>Medicos activos</span>
          <strong>{stats.doctors}</strong>
        </article>
        <article className="admin-stat">
          <ClipboardCheck size={22} />
          <span>Secretarias activas</span>
          <strong>{stats.secretaries}</strong>
        </article>
        <article className="admin-stat">
          <UserRound size={22} />
          <span>Pacientes registrados</span>
          <strong>{stats.patients}</strong>
        </article>
      </section>

      <section className="admin-create-layout">
        <article className="admin-account-card admin-create-card" aria-labelledby="create-account-title">
          <header className="admin-create-card-heading">
            <div>
              <span className="eyebrow">Nueva cuenta · Alta guiada</span>
              <h2 id="create-account-title">Agregar integrante</h2>
              <p>Prepara su perfil y habilita el acceso a las herramientas que necesita.</p>
            </div>
            <span className="admin-create-heading-icon"><UserPlus size={21} /></span>
          </header>

          <div className="admin-form-section-heading">
            <span>01</span><div><strong>Selecciona un perfil</strong><small>El acceso se adapta al rol asignado</small></div>
          </div>
          <div className="admin-role-switch" role="group" aria-label="Tipo de cuenta">
            {Object.entries(roleLabels)
              .filter(([role]) => role !== 'admin')
              .map(([role, label]) => {
                const Icon = roleIcons[role];
                return (
                  <button
                    key={role}
                    type="button"
                    className={accountType === role ? 'active' : ''}
                    aria-pressed={accountType === role}
                    onClick={() => selectAccountType(role)}
                  >
                    <span className="admin-role-icon"><Icon size={19} /></span>
                    <span className="admin-role-copy"><strong>{label}</strong><small>{roleExperience[role].title}</small></span>
                    {accountType === role ? <Check className="admin-role-check" size={17} /> : null}
                  </button>
                );
              })}
          </div>

          <form className="admin-form" onSubmit={submitAccount}>
            <div className="admin-form-section-heading">
              <span>02</span><div><strong>Datos del perfil</strong><small>Campos necesarios para activar la cuenta</small></div>
              <BadgeCheck size={19} />
            </div>
            {accountType === 'patient' ? (
              renderPatientFields()
            ) : (
              <>
                <div className="form-grid two admin-fields-grid">
                  {formFields[accountType].map(([field, label, type]) => (
                    <label className={field === 'license' ? 'admin-field-wide' : ''} key={field}>
                      {label}
                      <input type={type} value={form[field]} onChange={(event) => setValue(field, event.target.value)} required />
                    </label>
                  ))}
                </div>
                {accountType === 'doctor' ? renderProfessionalFields() : null}
              </>
            )}
            <label>
              <span className="label-with-icon"><KeyRound size={16} /> Contrasena de acceso <small>· minimo 7 caracteres</small></span>
              <input type="password" autoComplete="new-password" minLength={7} maxLength={30} value={form.password} onChange={(event) => setValue('password', event.target.value)} placeholder="Define una clave temporal segura" required />
            </label>
            <div className="admin-create-submit-row">
              <span><ShieldCheck size={17} /> La cuenta se habilita al guardar</span>
              <button className="btn btn-primary" type="submit">Crear {roleLabels[accountType].toLowerCase()} <ArrowRight size={18} /></button>
            </div>
          </form>
        </article>

        <aside className={`permissions-panel admin-priority-panel admin-live-panel admin-live-${accountType}`} aria-labelledby="priority-title">
          <div className="admin-live-topline"><span><Sparkles size={15} /> VISTA EN VIVO</span><span>Se actualiza al escribir</span></div>
          <div className="admin-live-profile">
            <span className="admin-live-avatar"><ActiveRoleIcon size={27} /></span>
            <div><span className="eyebrow">{experience.title}</span><h2 id="priority-title">{previewName || `Nuevo ${roleLabels[accountType].toLowerCase()}`}</h2><p>{experience.subtitle}</p></div>
          </div>

          <div className="admin-live-details">
            <div><span>Correo</span><strong>{form.email || 'Se agregara al completar el perfil'}</strong></div>
            <div><span>Documento</span><strong>{form.document || 'Pendiente de registro'}</strong></div>
            {accountType === 'doctor' ? <div><span>Sede</span><strong>{form.sede}</strong></div> : null}
          </div>

          <div className="admin-live-readiness">
            <span className={profileIsReady ? 'complete' : ''}><Check size={14} /> Perfil {profileIsReady ? 'completo' : 'por completar'}</span>
            <span className={accessIsReady ? 'complete' : ''}><KeyRound size={14} /> Acceso {accessIsReady ? 'listo' : 'por definir'}</span>
          </div>

          <div className="admin-live-access">
            <div className="admin-live-access-heading"><span>MODULOS HABILITADOS</span><ShieldCheck size={17} /></div>
            <ul>{experience.access.map((item) => <li key={item}><Check size={16} />{item}</li>)}</ul>
          </div>

          <footer className="admin-live-footer">
            <span><ActiveRoleIcon size={18} /><strong>{stats[accountType]}</strong> {roleLabels[accountType].toLowerCase()}{stats[accountType] === 1 ? '' : 's'} activos</span>
            <span><ArrowRight size={16} /> {experience.destination}</span>
          </footer>
        </aside>
      </section>

      <section id="admin-users" className="user-role-table admin-user-table" aria-labelledby="roles-title">
        <div className="section-intro compact">
          <span className="eyebrow">Directorio en tiempo real</span>
          <h2 id="roles-title">Usuarios y permisos</h2>
          <p>Los cambios realizados aqui se reflejan en los modulos vinculados sin volver a cargar la pagina.</p>
        </div>

        <div className="role-table">
          <div className="role-table-head">
            <span>Usuario</span>
            <span>Estado</span>
            <span>Rol</span>
            <span>Acceso</span>
          </div>
          {data.users.map((user) => {
            const RoleIcon = roleIcons[user.role] || ShieldCheck;
            return (
              <article className={user.role === 'admin' ? 'locked' : ''} key={user.id}>
                <div className="admin-user-cell">
                  <span className="admin-avatar">{getInitials(user.name)}</span>
                  <div>
                    <strong>{user.name}</strong>
                    <small>{user.email} | {user.document}</small>
                  </div>
                </div>
                <span className="status-badge">{user.status}</span>
                <select value={user.role} disabled={user.role === 'admin' || user.id === currentUser.id} onChange={(event) => updateRole(user.id, event.target.value)}>
                  <option value="doctor">Medico</option>
                  <option value="secretary">Secretaria</option>
                  <option value="patient">Paciente</option>
                  <option value="admin">Administrador</option>
                </select>
                <span className="lock-note">
                  <RoleIcon size={16} />
                  {user.role === 'admin' ? 'Protegido' : 'Actualizable'}
                </span>
              </article>
            );
          })}
        </div>
      </section>

      <section id="admin-audit" className="audit-trail" aria-labelledby="audit-title">
        <div className="section-intro compact">
          <span className="eyebrow">Trazabilidad</span>
          <h2 id="audit-title">Actividad administrativa reciente</h2>
        </div>
        {data.auditLog?.length ? (
          <div className="audit-list">
            {data.auditLog
              .slice()
              .reverse()
              .slice(0, 8)
              .map((entry) => (
                <article key={entry.id}>
                  <time>{new Date(entry.date).toLocaleString('es-CO')}</time>
                  <div>
                    <strong>{entry.user}</strong>
                    <span>{entry.action} - {entry.detail}</span>
                  </div>
                  <small>{entry.admin}</small>
                </article>
              ))}
          </div>
        ) : (
          <p className="empty-state">Todavia no hay movimientos administrativos registrados.</p>
        )}
      </section>
    </section>
  );
}
