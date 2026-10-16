import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, CreditCard, LockKeyhole, PackageCheck, ShieldCheck } from 'lucide-react';
import { useAppData } from '../store';

const money = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const deliveryCost = 8900;

export default function PasarelaPago() {
  const { deliveryId } = useParams();
  const { data, payDelivery } = useAppData();
  const delivery = data.deliveries.find((item) => item.id === deliveryId);
  const [payment, setPayment] = useState({
    holder: '',
    document: '',
    cardNumber: '',
    expiry: '',
    cvv: '',
    provider: 'Tarjeta debito o credito',
  });
  const [message, setMessage] = useState('');

  const deliveryPrescriptions = useMemo(() => {
    if (!delivery) return [];
    if (delivery.items?.length) return delivery.items;
    return delivery.prescriptionIds.map((prescriptionId) => {
      const stored = data.prescriptions.find((item) => item.id === prescriptionId);
      return stored || { id: prescriptionId, medicine: prescriptionId.split('-').slice(1).join('-') };
    });
  }, [data.prescriptions, delivery]);

  const updatePayment = (field, value) => {
    setPayment((current) => ({ ...current, [field]: value }));
    setMessage('');
  };

  const submitPayment = (event) => {
    event.preventDefault();
    if (!delivery || delivery.status === 'Pago confirmado') return;

    const cleanCard = payment.cardNumber.replace(/\D/g, '');
    payDelivery(delivery.id, {
      paymentProvider: payment.provider,
      transactionCode: `SMU-${Date.now().toString().slice(-8)}`,
      payerName: payment.holder,
      payerDocument: payment.document,
      cardLast4: cleanCard.slice(-4),
      amount: deliveryCost,
    });
    setMessage('Pago confirmado. El domicilio queda listo para preparacion y despacho.');
  };

  if (!delivery) {
    return (
      <section className="page-content payment-layout">
        <div className="empty-state">
          No se encontro la solicitud de domicilio. Vuelve a medicamentos y crea una nueva entrega.
        </div>
        <Link className="btn btn-secondary" to="/medicamentos">
          <ArrowLeft size={18} />
          Volver a medicamentos
        </Link>
      </section>
    );
  }

  const paid = delivery.status === 'Pago confirmado';

  return (
    <section className="page-content payment-layout">
      <header className="module-header">
        <div>
          <span className="eyebrow">Pasarela de pago</span>
          <h1>Confirma el domicilio de medicamentos</h1>
          <p>
            Revisa la direccion, medicamentos seleccionados y registra el pago para que farmacia pueda
            preparar la entrega.
          </p>
        </div>
        <div className="module-chip">
          <ShieldCheck size={24} />
          Transaccion segura
        </div>
      </header>

      {message ? <p className="form-message success">{message}</p> : null}

      <div className="payment-grid">
        <section className="payment-card" aria-labelledby="payment-title">
          <div className="section-intro compact">
            <span className="eyebrow">Datos de pago</span>
            <h2 id="payment-title">{paid ? 'Pago registrado' : 'Tarjeta autorizada'}</h2>
          </div>

          {paid ? (
            <div className="payment-confirmed">
              <BadgeCheck size={38} />
              <div>
                <strong>{delivery.transactionCode || 'Transaccion aprobada'}</strong>
                <span>Estado: {delivery.status}</span>
                <span>Terminada en {delivery.cardLast4 ? `**** ${delivery.cardLast4}` : 'metodo registrado'}</span>
              </div>
            </div>
          ) : (
            <form className="payment-form" onSubmit={submitPayment}>
              <label>
                Nombre del titular
                <input
                  value={payment.holder}
                  onChange={(event) => updatePayment('holder', event.target.value)}
                  required
                />
              </label>
              <label>
                Documento
                <input
                  value={payment.document}
                  onChange={(event) => updatePayment('document', event.target.value)}
                  required
                />
              </label>
              <label className="wide">
                Numero de tarjeta
                <input
                  inputMode="numeric"
                  maxLength="19"
                  value={payment.cardNumber}
                  onChange={(event) => updatePayment('cardNumber', event.target.value)}
                  placeholder="4111 1111 1111 1111"
                  required
                />
              </label>
              <label>
                Vencimiento
                <input
                  value={payment.expiry}
                  onChange={(event) => updatePayment('expiry', event.target.value)}
                  placeholder="MM/AA"
                  required
                />
              </label>
              <label>
                CVV
                <input
                  inputMode="numeric"
                  maxLength="4"
                  value={payment.cvv}
                  onChange={(event) => updatePayment('cvv', event.target.value)}
                  required
                />
              </label>
              <button className="btn btn-primary full wide" type="submit">
                <CreditCard size={18} />
                Pagar {money.format(deliveryCost)}
              </button>
            </form>
          )}
        </section>

        <aside className="payment-summary" aria-labelledby="summary-title">
          <LockKeyhole size={28} />
          <div className="section-intro compact">
            <span className="eyebrow">Resumen</span>
            <h2 id="summary-title">Solicitud {delivery.id}</h2>
          </div>
          <dl>
            <div>
              <dt>Paciente</dt>
              <dd>{delivery.patientName}</dd>
            </div>
            <div>
              <dt>Direccion</dt>
              <dd>{delivery.address}</dd>
            </div>
            <div>
              <dt>Contacto</dt>
              <dd>{delivery.patientPhone || 'Sin telefono'} · {delivery.patientEmail || 'Sin correo'}</dd>
            </div>
            {delivery.deliveryNotes ? <div><dt>Indicaciones</dt><dd>{delivery.deliveryNotes}</dd></div> : null}
            <div>
              <dt>Medicamentos</dt>
              <dd>{deliveryPrescriptions.length || delivery.prescriptionIds.length}</dd>
            </div>
            <div>
              <dt>Total domicilio</dt>
              <dd>{money.format(delivery.amount || deliveryCost)}</dd>
            </div>
          </dl>
          <div className="payment-meds">
            {deliveryPrescriptions.map((item) => (
              <span key={item.id || item.medicine}>
                <PackageCheck size={16} />
                {item.medicine}
              </span>
            ))}
          </div>
          <Link className="btn btn-secondary full" to="/medicamentos">
            <ArrowLeft size={18} />
            Volver a medicamentos
          </Link>
        </aside>
      </div>
    </section>
  );
}
