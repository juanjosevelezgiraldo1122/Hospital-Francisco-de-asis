import { useState } from 'react';
import { CalendarDays, Check, KeyRound, LogOut, MapPin, Pencil, ShieldCheck, UserCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { emptyAddressParts, formatColombianAddress, normalizeAddressParts } from '../../shared/colombianAddress';
import { useAppData } from '../store';

const streetTypes = [
  ['CL', 'Calle'], ['CR', 'Carrera'], ['AV', 'Avenida'], ['AC', 'Avenida Calle'],
  ['AK', 'Avenida Carrera'], ['DG', 'Diagonal'], ['TV', 'Transversal'],
  ['AUT', 'Autopista'], ['CIRC', 'Circular'], ['VIA', 'Vía'],
];
const quadrants = [['', 'Sin orientación'], ['N', 'Norte'], ['S', 'Sur'], ['E', 'Este'], ['O', 'Oeste']];

export default function Perfil() {
  const navigate = useNavigate();
  const { currentUser, data, logout, updateUserAddress } = useAppData();
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressDraft, setAddressDraft] = useState(() => ({ ...emptyAddressParts, ...(currentUser?.addressParts || {}) }));
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressMessage, setAddressMessage] = useState('');
  const [addressError, setAddressError] = useState(false);
  const roleLabels = { admin: 'Administrador', doctor: 'Médico', patient: 'Paciente', secretary: 'Secretaria' };
  const role = roleLabels[currentUser.role] || currentUser.role;
  const relatedRecord = currentUser.role === 'patient'
    ? data.patients.find((patient) => patient.id === currentUser.id || patient.document === currentUser.document)
    : currentUser.role === 'doctor'
      ? data.doctors.find((doctor) => doctor.id === currentUser.id || doctor.document === currentUser.document)
      : null;
  const profile = { ...relatedRecord, ...currentUser };
  const formattedAddress = profile.address || formatColombianAddress(profile.addressParts);
  const personalFields = [
    ['Documento', [profile.typeId, profile.document].filter(Boolean).join(' ')],
    ['Correo electrónico', profile.email],
    ['Teléfono', profile.phone],
    ['Fecha de nacimiento', profile.birthDate],
    ['EPS', profile.eps],
    ['Especialidad', profile.specialty],
    ['Registro profesional', profile.license],
    ['Sede', profile.sede],
  ].filter(([, value]) => value);

  const setAddressValue = (field, value) => setAddressDraft((current) => ({ ...current, [field]: value }));
  const startAddressEdit = () => {
    setAddressDraft({ ...emptyAddressParts, ...(profile.addressParts || {}) });
    setAddressMessage('');
    setAddressError(false);
    setEditingAddress(true);
  };
  const cancelAddressEdit = () => {
    setEditingAddress(false);
    setAddressMessage('');
  };

  const saveAddress = async (event) => {
    event.preventDefault();
    const parts = normalizeAddressParts(addressDraft);
    if (!parts.streetNumber || !parts.crossNumber || !parts.plateNumber || !parts.municipality || !parts.department) {
      setAddressMessage('Completa los números de vía y placa, el municipio y el departamento.');
      setAddressError(true);
      return;
    }
    const address = formatColombianAddress(parts);
    if (address.length > 255) {
      setAddressMessage('La dirección completa debe tener máximo 255 caracteres.');
      setAddressError(true);
      return;
    }

    setSavingAddress(true);
    setAddressMessage('');
    setAddressError(false);
    try {
      const updated = await updateUserAddress(currentUser.id, parts);
      if (!updated.ok) throw new Error(updated.message);
      setEditingAddress(false);
      setAddressMessage('Dirección guardada.');
    } catch (error) {
      setAddressError(true);
      setAddressMessage(error.message || 'No se pudo guardar la dirección.');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    logout();
    navigate('/login');
  };

  return (
    <section className="page-content profile-layout">
      <header className="profile-cover">
        <div className="profile-avatar"><UserCircle size={58} /></div>
        <div>
          <span className="eyebrow">Perfil activo</span>
          <h1>{currentUser.name}</h1>
          <p>{role}</p>
        </div>
        <button type="button" className="btn btn-secondary profile-logout" onClick={handleLogout}>
          <LogOut size={18} /> Cerrar sesión
        </button>
      </header>

      <section className="profile-grid">
        <article id="profile-personal" className="profile-personal">
          <div className="profile-personal-heading">
            <UserCircle size={24} />
            <div><span className="eyebrow">Información de la cuenta</span><h2>Datos personales</h2></div>
          </div>
          {personalFields.length ? (
            <dl className="profile-facts">
              {personalFields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl>
          ) : <p>No hay datos personales adicionales registrados.</p>}

          <section className="profile-address-section" aria-labelledby="profile-address-title">
            <div className="profile-address-heading">
              <div className="profile-address-title">
                <MapPin size={20} />
                <div><span className="eyebrow">Ubicación de contacto</span><h3 id="profile-address-title">Dirección</h3></div>
              </div>
              {!editingAddress ? (
                <button type="button" className="btn btn-secondary profile-address-edit" onClick={startAddressEdit}>
                  <Pencil size={16} /> {formattedAddress ? 'Editar' : 'Agregar dirección'}
                </button>
              ) : null}
            </div>

            {editingAddress ? (
              <form className="profile-address-form" onSubmit={saveAddress}>
                <div className="form-grid two">
                  <label>Tipo de vía
                    <select value={addressDraft.streetType} onChange={(event) => setAddressValue('streetType', event.target.value)}>
                      {streetTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label>Número de vía<input inputMode="numeric" maxLength={5} value={addressDraft.streetNumber} onChange={(event) => setAddressValue('streetNumber', event.target.value.replace(/\D/g, ''))} placeholder="Ej. 10" required /></label>
                  <label>Letra de vía<input maxLength={4} value={addressDraft.streetLetter} onChange={(event) => setAddressValue('streetLetter', event.target.value.toUpperCase())} placeholder="Opcional" /></label>
                  <label className="address-bis-toggle"><input type="checkbox" checked={addressDraft.streetBis} onChange={(event) => setAddressValue('streetBis', event.target.checked)} /> Vía BIS</label>
                  <label>Orientación de vía
                    <select value={addressDraft.streetQuadrant} onChange={(event) => setAddressValue('streetQuadrant', event.target.value)}>
                      {quadrants.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label>Número de cruce<input inputMode="numeric" maxLength={5} value={addressDraft.crossNumber} onChange={(event) => setAddressValue('crossNumber', event.target.value.replace(/\D/g, ''))} placeholder="Ej. 5" required /></label>
                  <label>Letra de cruce<input maxLength={4} value={addressDraft.crossLetter} onChange={(event) => setAddressValue('crossLetter', event.target.value.toUpperCase())} placeholder="Opcional" /></label>
                  <label>Orientación del cruce
                    <select value={addressDraft.crossQuadrant} onChange={(event) => setAddressValue('crossQuadrant', event.target.value)}>
                      {quadrants.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label>Número de placa<input inputMode="numeric" maxLength={5} value={addressDraft.plateNumber} onChange={(event) => setAddressValue('plateNumber', event.target.value.replace(/\D/g, ''))} placeholder="Ej. 20" required /></label>
                  <label>Complemento<input maxLength={120} value={addressDraft.complement} onChange={(event) => setAddressValue('complement', event.target.value)} placeholder="Apto, torre, interior o casa" /></label>
                  <label>Barrio<input maxLength={100} value={addressDraft.neighborhood} onChange={(event) => setAddressValue('neighborhood', event.target.value)} /></label>
                  <label>Municipio o ciudad<input maxLength={100} value={addressDraft.municipality} onChange={(event) => setAddressValue('municipality', event.target.value)} required /></label>
                  <label>Departamento<input maxLength={100} value={addressDraft.department} onChange={(event) => setAddressValue('department', event.target.value)} required /></label>
                </div>
                <p className="profile-address-preview"><strong>Vista previa</strong><span>{formatColombianAddress(addressDraft) || 'La dirección aparecerá aquí mientras completas los datos.'}</span></p>
                {addressMessage ? <p className={`profile-address-message ${addressError ? 'error' : 'success'}`} role={addressError ? 'alert' : 'status'}>{addressMessage}</p> : null}
                <div className="profile-address-actions">
                  <button type="button" className="btn btn-secondary" onClick={cancelAddressEdit} disabled={savingAddress}><X size={16} /> Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={savingAddress}><Check size={16} /> {savingAddress ? 'Guardando…' : 'Guardar dirección'}</button>
                </div>
              </form>
            ) : (
              <>
                <p className={`profile-address-value ${formattedAddress ? '' : 'empty'}`}>{formattedAddress || 'Aún no has agregado una dirección.'}</p>
                {addressMessage ? <p className={`profile-address-message ${addressError ? 'error' : 'success'}`} role="status">{addressMessage}</p> : null}
              </>
            )}
          </section>
        </article>

        <article className="profile-summary">
          <ShieldCheck size={30} />
          <h2>Sesión protegida</h2>
          <p>La dirección se guarda en tu perfil y solo es editable desde tu cuenta.</p>
        </article>

        <article className="profile-summary">
          <CalendarDays size={30} />
          <h2>Destino por rol</h2>
          <p>Paciente entra a citas, médico a agenda diaria, secretaria a gestión asistida y administrador a roles.</p>
        </article>

        <article className="profile-summary wide">
          <KeyRound size={30} />
          <h2>Permisos asociados</h2>
          <div className="permission-chips">
            {['Consultar agenda y citas asignadas', 'Acceder solo a módulos permitidos por rol', 'Cerrar sesión desde cualquier vista', 'Mantener datos de acceso protegidos'].map((permission) => (
              <span key={permission}>{permission}</span>
            ))}
          </div>
        </article>
      </section>
    </section>
  );
}
