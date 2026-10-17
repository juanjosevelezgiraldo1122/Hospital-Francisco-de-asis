import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Home, PackageCheck, Pill, Search, Truck } from 'lucide-react';
import { useAppData } from '../store';

const prescriptionKey = (prescription) =>
  prescription.id || `${prescription.appointmentId}-${prescription.medicine}`;

export default function Medicamentos() {
  const navigate = useNavigate();
  const { currentUser, data, createDelivery } = useAppData();
  const prescriptionItems = useMemo(() => {
    const realPrescriptions =
      currentUser.role === 'patient'
        ? data.prescriptions.filter((item) => item.patientId === currentUser.id)
        : data.prescriptions;

    return realPrescriptions;
  }, [currentUser.id, currentUser.role, data.prescriptions]);
  const [selected, setSelected] = useState(null);
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

  const selectedKeys = selected || prescriptionItems
    .filter((prescription) => (data.inventory.find((item) => item.medicine === prescription.medicine)?.stock || 0) > 0)
    .map(prescriptionKey);
  const stockFor = (medicine) => data.inventory.find((item) => item.medicine === medicine)?.stock || 0;

  const toggleMedicine = (prescription) => {
    const key = prescriptionKey(prescription);
    setSelected((current) =>
      (current || selectedKeys).includes(key)
        ? (current || selectedKeys).filter((item) => item !== key)
        : [...(current || selectedKeys), key],
    );
    setConfirmed('');
    setError('');
  };

  const selectedPrescriptions = prescriptionItems.filter((prescription) =>
    selectedKeys.includes(prescriptionKey(prescription)) && stockFor(prescription.medicine) > 0,
  );
  const visiblePrescriptions = prescriptionItems.filter((prescription) =>
    `${prescription.medicine} ${prescription.dose || ''} ${prescription.doctorName || ''}`.toLocaleLowerCase().includes(medicineQuery.trim().toLocaleLowerCase()),
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (currentUser.role !== 'patient') return;

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
    <section className="page-content medicine-layout">
      <header className="module-header medicine-header">
        <div>
          <span className="eyebrow">Paciente - tratamiento</span>
          <h1>Medicamentos prescritos y solicitud de domicilio</h1>
          <p>
            Solo se muestran tratamientos asociados a citas finalizadas, con dosis, frecuencia,
            duracion y medico responsable.
          </p>
        </div>
        <div className="module-chip">
          <Pill size={24} />
          HU05 - HU08
        </div>
      </header>

      <section className="medicine-board">
        <div className="treatment-list" aria-labelledby="treatments-title">
          <div className="section-intro compact">
            <span className="eyebrow">Tratamientos</span>
            <h2 id="treatments-title">Citas finalizadas</h2>
          </div>
          <label className="search-box medication-list-search"><Search size={18} /><input value={medicineQuery} onChange={(event) => setMedicineQuery(event.target.value)} placeholder="Buscar medicamento" aria-label="Buscar medicamento prescrito" /></label>

          {visiblePrescriptions.length ? visiblePrescriptions.map((prescription) => (
            <article className="treatment-card" key={prescriptionKey(prescription)}>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={selectedKeys.includes(prescriptionKey(prescription))}
                  disabled={!stockFor(prescription.medicine)}
                  onChange={() => toggleMedicine(prescription)}
                />
                <span />
              </label>
              <div>
                <strong>{prescription.medicine}</strong>
                <p>{prescription.diagnosis || 'Tratamiento asociado a una cita finalizada.'}</p>
                <span className={`stock-indicator${stockFor(prescription.medicine) ? '' : ' unavailable'}`}>
                  {stockFor(prescription.medicine) ? `${stockFor(prescription.medicine)} disponibles` : 'Agotado'}
                </span>
                <dl>
                  <div>
                    <dt>Dosis</dt>
                    <dd>{prescription.dose}</dd>
                  </div>
                  <div>
                    <dt>Frecuencia</dt>
                    <dd>{prescription.frequency}</dd>
                  </div>
                  <div>
                    <dt>Duracion</dt>
                    <dd>{prescription.duration}</dd>
                  </div>
                </dl>
              </div>
              <small>
                {prescription.date || prescription.createdAt || 'Registro clinico'}
                <br />
                {prescription.doctorName}
              </small>
            </article>
          )) : <p className="empty-state">{prescriptionItems.length ? 'No hay medicamentos que coincidan con la busqueda.' : 'Aun no hay tratamientos para mostrar.'}</p>}
        </div>

        <aside className="delivery-panel" aria-labelledby="delivery-title">
          <div className="delivery-icon">
            <Truck size={30} />
          </div>
          <div className="section-intro compact">
            <span className="eyebrow">Domicilio</span>
            <h2 id="delivery-title">Solicitud de envio</h2>
          </div>

          {currentUser.role === 'patient' ? (
            <>
              <form className="delivery-form" onSubmit={handleSubmit}>
                <div className="form-grid two">
                  <label>
                    Telefono de contacto
                    <input value={delivery.phone} onChange={(event) => setDelivery((current) => ({ ...current, phone: event.target.value }))} required />
                  </label>
                  <label>
                    Correo de contacto
                    <input type="email" value={delivery.email} onChange={(event) => setDelivery((current) => ({ ...current, email: event.target.value }))} required />
                  </label>
                </div>
                <label>
                  Direccion de entrega
                  <input
                    value={delivery.address}
                    onChange={(event) =>
                      setDelivery((current) => ({ ...current, address: event.target.value }))
                    }
                    required
                  />
                </label>
                <label>
                  Indicaciones para la entrega
                  <textarea value={delivery.deliveryNotes} onChange={(event) => setDelivery((current) => ({ ...current, deliveryNotes: event.target.value }))} placeholder="Barrio, porteria u horario preferido" />
                </label>
                <label>
                  Metodo de pago
                  <select
                    value={delivery.payment}
                    onChange={(event) =>
                      setDelivery((current) => ({ ...current, payment: event.target.value }))
                    }
                  >
                    <option value="en_linea">Pago en linea</option>
                    <option value="contra_entrega">Contra entrega</option>
                  </select>
                </label>

                <div className="delivery-summary">
                  <strong>Resumen previo</strong>
                  {selectedPrescriptions.length ? (
                    selectedPrescriptions.map((item) => <span key={prescriptionKey(item)}>{item.medicine}</span>)
                  ) : (
                    <span>Selecciona al menos un medicamento.</span>
                  )}
                  <span>{delivery.address}</span>
                  <span>{delivery.phone} · {delivery.email}</span>
                  <span>{delivery.payment === 'en_linea' ? 'Pago en linea' : 'Pago contra entrega'}</span>
                </div>

                {error ? <p className="form-message error">{error}</p> : null}

                <button className="btn btn-primary full" type="submit" disabled={!selectedPrescriptions.length}>
                  <PackageCheck size={18} />
                  Confirmar solicitud
                </button>
              </form>

              {confirmed ? <p className="form-message success">{confirmed}</p> : null}
            </>
          ) : (
            <p className="empty-state">El medico puede revisar tratamientos; el domicilio lo confirma el paciente.</p>
          )}
        </aside>
      </section>

      <section className="medicine-rules">
        <article>
          <Home size={22} />
          <strong>Direccion editable</strong>
          <span>El paciente puede actualizarla antes de confirmar.</span>
        </article>
        <article>
          <CreditCard size={22} />
          <strong>Pago permitido</strong>
          <span>En linea o contra entrega, como define la BD.</span>
        </article>
        <article>
          <Pill size={22} />
          <strong>Solo finalizadas</strong>
          <span>No se listan medicamentos de citas pendientes o en curso.</span>
        </article>
      </section>
    </section>
  );
}


