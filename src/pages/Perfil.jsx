import { useState } from 'react';
import { CalendarDays, Check, LockKeyhole, LogOut, Mail, MapPin, Pencil, Phone, Save, UserCircle, X } from 'lucide-react';
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
  const { currentUser, data, logout, updateUserAddress, updateUserProfile } = useAppData();
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState(false);
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

  const startProfileEdit = () => {
    const nameParts = String(profile.name || '').trim().split(/\s+/);
    setProfileDraft({
      firstName: profile.firstName || nameParts[0] || '',
      middleName: profile.middleName || '',
      lastName: profile.lastName || nameParts[1] || '',
      secondLastName: profile.secondLastName || '',
      email: profile.email || '',
      phone: profile.phone || '',
      birthDate: profile.birthDate || '',
      eps: profile.eps || '',
    });
    setProfileMessage('');
    setProfileError(false);
    setEditingProfile(true);
  };
  const setProfileValue = (field, value) => setProfileDraft((current) => ({ ...current, [field]: value }));
  const cancelProfileEdit = () => {
    setEditingProfile(false);
    setProfileMessage('');
  };
  const saveProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    setProfileMessage('');
    setProfileError(false);
    try {
      const result = await updateUserProfile(profileDraft);
      if (!result.ok) throw new Error(result.message);
      setEditingProfile(false);
      setProfileMessage('Tus datos personales se guardaron correctamente.');
    } catch (error) {
      setProfileError(true);
      setProfileMessage(error.message || 'No se pudieron guardar los cambios.');
    } finally {
      setSavingProfile(false);
    }
  };

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
          <span className="eyebrow">Mi cuenta</span>
          <h1>{currentUser.name}</h1>
          <p className="profile-role-badge">{role}</p>
        </div>
        <button type="button" className="btn btn-secondary profile-logout" onClick={handleLogout}>
          <LogOut size={18} /> Cerrar sesión
        </button>
      </header>

      <section className="profile-grid">
        <article id="profile-personal" className="profile-personal">
          <div className="profile-personal-heading">
            <div className="profile-section-icon"><UserCircle size={22} /></div>
            <div className="profile-personal-title"><span className="eyebrow">Información de la cuenta</span><h2>Datos personales</h2><p>Tu información de contacto y datos básicos.</p></div>
            {!editingProfile ? <button type="button" className="btn btn-secondary profile-address-edit" onClick={startProfileEdit}><Pencil size={16} /> Editar datos</button> : null}
          </div>
          {editingProfile ? (
            <form className="profile-edit-form" onSubmit={saveProfile}>
              <div className="profile-form-section-title"><span>Información editable</span><small>Los cambios se guardan en tu cuenta.</small></div>
              <div className="form-grid two">
                <label>Primer nombre<input autoComplete="given-name" maxLength={60} value={profileDraft.firstName} onChange={(event) => setProfileValue('firstName', event.target.value)} required /></label>
                <label>Segundo nombre <span className="profile-optional">Opcional</span><input autoComplete="additional-name" maxLength={60} value={profileDraft.middleName} onChange={(event) => setProfileValue('middleName', event.target.value)} /></label>
                <label>Primer apellido<input autoComplete="family-name" maxLength={60} value={profileDraft.lastName} onChange={(event) => setProfileValue('lastName', event.target.value)} required /></label>
                <label>Segundo apellido <span className="profile-optional">Opcional</span><input maxLength={60} value={profileDraft.secondLastName} onChange={(event) => setProfileValue('secondLastName', event.target.value)} /></label>
                <label className="profile-field-wide">Correo electrónico<input type="email" autoComplete="email" maxLength={254} value={profileDraft.email} onChange={(event) => setProfileValue('email', event.target.value)} required /></label>
                <label>Teléfono<input type="tel" autoComplete="tel" maxLength={24} value={profileDraft.phone} onChange={(event) => setProfileValue('phone', event.target.value)} /></label>
                <label>Fecha de nacimiento<input type="date" autoComplete="bday" value={profileDraft.birthDate} onChange={(event) => setProfileValue('birthDate', event.target.value)} /></label>
                {currentUser.role === 'patient' ? <label className="profile-field-wide">EPS<input maxLength={120} value={profileDraft.eps} onChange={(event) => setProfileValue('eps', event.target.value)} /></label> : null}
              </div>
              <div className="profile-locked-info"><LockKeyhole size={17} /><span><strong>Identidad protegida</strong>Documento, usuario y rol no se modifican desde esta pantalla.</span><span className="profile-locked-value">{[profile.typeId, profile.document].filter(Boolean).join(' ') || profile.username}</span></div>
              {profileMessage ? <p className={`profile-address-message ${profileError ? 'error' : 'success'}`} role={profileError ? 'alert' : 'status'}>{profileMessage}</p> : null}
              <div className="profile-address-actions">
                <button type="button" className="btn btn-secondary" onClick={cancelProfileEdit} disabled={savingProfile}><X size={16} /> Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={savingProfile}><Save size={16} /> {savingProfile ? 'Guardando…' : 'Guardar cambios'}</button>
              </div>
            </form>
          ) : personalFields.length ? (
            <>
            <dl className="profile-facts">
              {personalFields.map(([label, value]) => {
                const Icon = label === 'Correo electrónico' ? Mail : label === 'Teléfono' ? Phone : label === 'Fecha de nacimiento' ? CalendarDays : null;
                return <div key={label}><dt>{Icon ? <Icon size={15} /> : null}{label}</dt><dd>{value}</dd></div>;
              })}
            </dl>
            <div className="profile-identity-note"><LockKeyhole size={16} /><span>Documento, usuario y rol están protegidos.</span></div>
            {profileMessage ? <p className="profile-address-message success" role="status">{profileMessage}</p> : null}
            </>
          ) : <p>No hay datos personales adicionales registrados.</p>}
        </article>

        <article className="profile-contact-card">
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
      </section>
    </section>
  );
}
