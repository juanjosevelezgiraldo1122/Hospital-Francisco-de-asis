import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  Clock3,
  CreditCard,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  Pill,
  Search,
  Truck,
} from 'lucide-react';
import { useAppData } from '../store';

const prescriptionKey = (prescription) =>
  prescription.id || `${prescription.appointmentId}-${prescription.medicine}`;

export default function Medicamentos() {
  const navigate = useNavigate();
  const { currentUser, data, createDelivery } = useAppData();
  const isPatient = currentUser.role === 'patient';
  const prescriptionItems = useMemo(() => {
    if (!isPatient) return data.prescriptions;
    return data.prescriptions.filter((item) => item.patientId === currentUser.id);
  }, [currentUser.id, isPatient, data.prescriptions]);
  const [selected, setSelected] = useState([]);
  const [medicineQuery, setMedicineQuery] = useState('');
  const [delivery, setDelivery] = useState({
    address: currentUser.address || '',
    phone: currentUser.phone || '',
    email: currentUser.email || '',
    deliveryNotes: '',
    payment: 'en_linea',
  });
  const [confirmed, setConfirmed] = useState('');
  const [error, setError] = useState('');

  const stockFor = (medicine) => data.inventory.find((item) => item.medicine === medicine)?.stock || 0;
  const selectedPrescriptions = prescriptionItems.filter((prescription) =>
    selected.includes(prescriptionKey(prescription)) && stockFor(prescription.medicine) > 0,
  );
  const availableCount = prescriptionItems.filter((prescription) => stockFor(prescription.medicine) > 0).length;
  const visiblePrescriptions = prescriptionItems.filter((prescription) =>
    `${prescription.medicine} ${prescription.dose || ''} ${prescription.doctorName || ''}`
      .toLocaleLowerCase()
      .includes(medicineQuery.trim().toLocaleLowerCase()),
  );

  const toggleMedicine = (prescription) => {
    const key = prescriptionKey(prescription);
    setSelected((current) => current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key]);
    setConfirmed('');
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isPatient || !selectedPrescriptions.length) return;

    const result = await createDelivery({
      address: delivery.address,
      phone: delivery.phone,
      email: delivery.email,
      deliveryNotes: delivery.deliveryNotes,
      paymentMethod: delivery.payment,
      items: selectedPrescriptions.map((prescription) => ({
        prescriptionId: prescriptionKey(prescription),
        medicine: prescription.medicine,
        dose: prescription.dose,
        frequency: prescription.frequency,
        duration: prescription.duration,
        doctorName: prescription.doctorName,
        quantity: 1,
      })),
    });
    if (!result.ok) {
      setError(result.message);
      return;
    }

    if (delivery.payment === 'en_linea') {
      navigate(`/pago/${result.delivery.id}`);
      return;
    }

    setConfirmed(`Solicitud ${result.delivery.id} registrada. Puedes consultar su avance desde tu panel.`);
    setSelected([]);
  };

  return (
    <section className="page-content medicine-page">
      <header className="medicine-page-header">
        <div>
          <span className="medicine-kicker"><Pill size={16} /> Portal de salud / Farmacia</span>
          <h1>Medicamentos</h1>
          <p>Consulta tus tratamientos prescritos y organiza la entrega de los que necesitas.</p>
        </div>
        <span className="medicine-view-label">
          {isPatient ? 'Plan de tratamiento' : 'Vista de prescripciones'}
        </span>
      </header>

      <section className="medicine-overview" aria-label="Resumen de tratamientos">
        <div className="medicine-overview-item">
          <span>Tratamientos</span>
          <strong>{prescriptionItems.length}</strong>
          <small>prescripciones registradas</small>
        </div>
        <div className="medicine-overview-item">
          <span>Con disponibilidad</span>
          <strong>{availableCount}</strong>
          <small>con inventario para solicitar</small>
        </div>
        <div className="medicine-overview-item medicine-overview-accent">
          <span>{isPatient ? 'En tu solicitud' : 'Tipo de vista'}</span>
          <strong>{isPatient ? selectedPrescriptions.length : 'Clínica'}</strong>
          <small>{isPatient ? 'medicamentos seleccionados' : 'seguimiento de tratamientos'}</small>
        </div>
      </section>

      <div className="medicine-workspace">
        <section className="medicine-prescriptions" aria-labelledby="prescriptions-title">
          <div className="medicine-section-heading">
            <div>
              <span className="medicine-section-label">Tratamientos</span>
              <h2 id="prescriptions-title">Tus prescripciones</h2>
            </div>
            <span className="medicine-count">{prescriptionItems.length}</span>
          </div>

          <label className="medicine-search">
            <Search size={18} aria-hidden="true" />
            <input
              value={medicineQuery}
              onChange={(event) => setMedicineQuery(event.target.value)}
              placeholder="Buscar por medicamento o médico"
              aria-label="Buscar por medicamento o médico"
            />
          </label>

          {visiblePrescriptions.length ? (
            <div className="medicine-prescription-list">
              {visiblePrescriptions.map((prescription) => {
                const key = prescriptionKey(prescription);
                const stock = stockFor(prescription.medicine);
                const isSelected = selected.includes(key);
                return (
                  <article className={`medicine-prescription${isSelected ? ' is-selected' : ''}`} key={key}>
                    <label className="medicine-prescription-select">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!isPatient || !stock}
                        onChange={() => toggleMedicine(prescription)}
                        aria-label={`Incluir ${prescription.medicine} en la solicitud`}
                      />
                      <span className="medicine-checkmark"><Check size={14} /></span>
                      <span className="medicine-drug-icon"><Pill size={19} /></span>
                      <span className="medicine-prescription-content">
                        <span className="medicine-prescription-topline">
                          <strong>{prescription.medicine}</strong>
                          <span className={`medicine-stock${stock ? '' : ' is-empty'}`}>
                            <span />{stock ? `${stock} disponibles` : 'Agotado'}
                          </span>
                        </span>
                        <span className="medicine-diagnosis">
                          {prescription.diagnosis || 'Tratamiento asociado a una cita finalizada.'}
                        </span>
                        <span className="medicine-dose-grid">
                          <span><small>Dosis</small><strong>{prescription.dose || 'No registrada'}</strong></span>
                          <span><small>Frecuencia</small><strong>{prescription.frequency || 'No registrada'}</strong></span>
                          <span><small>Duración</small><strong>{prescription.duration || 'No registrada'}</strong></span>
                        </span>
                        <span className="medicine-prescription-meta">
                          <span><Clock3 size={14} /> {prescription.date || prescription.createdAt || 'Registro clínico'}</span>
                          {prescription.doctorName ? <span>{prescription.doctorName}</span> : null}
                        </span>
                      </span>
                    </label>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="medicine-empty-state">
              <span><Pill size={23} /></span>
              <strong>{prescriptionItems.length ? 'No encontramos coincidencias' : 'Aún no hay tratamientos'}</strong>
              <p>{prescriptionItems.length
                ? 'Prueba con otro nombre de medicamento o médico.'
                : 'Las prescripciones aparecerán aquí cuando estén disponibles.'}</p>
            </div>
          )}
        </section>

        <aside className="medicine-order-panel" aria-labelledby="delivery-title">
          <div className="medicine-order-heading">
            <span className="medicine-order-icon"><Truck size={21} /></span>
            <div>
              <span className="medicine-section-label">Entrega</span>
              <h2 id="delivery-title">Solicitar domicilio</h2>
            </div>
          </div>

          {isPatient ? (
            <form className="medicine-order-form" onSubmit={handleSubmit}>
              <div className="medicine-contact-grid">
                <label>
                  <span><Phone size={14} /> Teléfono</span>
                  <input
                    value={delivery.phone}
                    onChange={(event) => setDelivery((current) => ({ ...current, phone: event.target.value }))}
                    autoComplete="tel"
                    required
                  />
                </label>
                <label>
                  <span><Mail size={14} /> Correo</span>
                  <input
                    type="email"
                    value={delivery.email}
                    onChange={(event) => setDelivery((current) => ({ ...current, email: event.target.value }))}
                    autoComplete="email"
                    required
                  />
                </label>
              </div>
              <label>
                <span><MapPin size={14} /> Dirección de entrega</span>
                <input
                  value={delivery.address}
                  onChange={(event) => setDelivery((current) => ({ ...current, address: event.target.value }))}
                  autoComplete="street-address"
                  required
                />
              </label>
              <label>
                Indicaciones <small className="medicine-optional">Opcional</small>
                <textarea
                  value={delivery.deliveryNotes}
                  onChange={(event) => setDelivery((current) => ({ ...current, deliveryNotes: event.target.value }))}
                  placeholder="Barrio, portería u horario preferido"
                  rows={2}
                />
              </label>
              <label>
                <span><CreditCard size={14} /> Método de pago</span>
                <select
                  value={delivery.payment}
                  onChange={(event) => setDelivery((current) => ({ ...current, payment: event.target.value }))}
                >
                  <option value="en_linea">Pago en línea</option>
                  <option value="contra_entrega">Contra entrega</option>
                </select>
              </label>

              <div className="medicine-order-summary" aria-live="polite">
                <div><span>Medicamentos</span><strong>{selectedPrescriptions.length}</strong></div>
                {selectedPrescriptions.length ? (
                  <ul>
                    {selectedPrescriptions.map((item) => (
                      <li key={prescriptionKey(item)}><Check size={14} /> {item.medicine}</li>
                    ))}
                  </ul>
                ) : (
                  <p>Selecciona los tratamientos que deseas recibir.</p>
                )}
              </div>

              {error ? <p className="form-message error" role="alert">{error}</p> : null}
              {confirmed ? <p className="form-message success" role="status">{confirmed}</p> : null}

              <button className="btn btn-primary full medicine-submit" type="submit" disabled={!selectedPrescriptions.length}>
                <PackageCheck size={18} />
                Continuar con la solicitud
              </button>
            </form>
          ) : (
            <div className="medicine-clinical-note">
              <PackageCheck size={20} />
              <p>El domicilio de medicamentos se solicita desde la cuenta del paciente.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
