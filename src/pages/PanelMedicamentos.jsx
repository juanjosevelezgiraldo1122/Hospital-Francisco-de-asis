import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  PackageCheck,
  PackageSearch,
  Pill,
  Plus,
  Search,
  Save,
} from 'lucide-react';
import { useAppData } from '../store';

const orderStatuses = ['Todos', 'Recibido', 'Preparando', 'Enviado', 'Entregado', 'Cancelado'];

export default function PanelMedicamentos() {
  const { data, updateInventoryStock, addMedication, updateDeliveryStatus } = useAppData();
  const [inventoryDraft, setInventoryDraft] = useState({});
  const [inventoryQuery, setInventoryQuery] = useState('');
  const [orderQuery, setOrderQuery] = useState('');
  const [orderFilter, setOrderFilter] = useState('Todos');
  const [newMedicine, setNewMedicine] = useState('');
  const [message, setMessage] = useState(null);

  useEffect(() => {
    setInventoryDraft(Object.fromEntries(data.inventory.map((item) => [item.medicine, item.stock])));
  }, [data.inventory]);

  const visibleInventory = useMemo(() => {
    const query = inventoryQuery.trim().toLocaleLowerCase();
    return data.inventory.filter((item) => item.medicine.toLocaleLowerCase().includes(query));
  }, [data.inventory, inventoryQuery]);

  const visibleOrders = useMemo(() => {
    const query = orderQuery.trim().toLocaleLowerCase();
    return data.deliveries.filter((order) => {
      const matchesStatus = orderFilter === 'Todos' || (order.orderStatus || 'Recibido') === orderFilter;
      const items = (order.items || []).map((item) => item.medicine).join(' ');
      const matchesQuery = !query || `${items} ${order.prescriptionIds?.join(' ') || ''} ${order.patientName} ${order.patientDocument} ${order.id}`
        .toLocaleLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    }).slice().reverse();
  }, [data.deliveries, orderFilter, orderQuery]);

  const availableUnits = data.inventory.reduce((total, item) => total + item.stock, 0);

  const saveStock = (medicine) => {
    const result = updateInventoryStock(medicine, inventoryDraft[medicine]);
    setMessage(result.ok
      ? { type: 'success', text: `Existencias de ${medicine} actualizadas.` }
      : { type: 'error', text: result.message });
  };

  const submitMedicine = (event) => {
    event.preventDefault();
    const result = addMedication(newMedicine);
    if (!result.ok) {
      setMessage({ type: 'error', text: result.message });
      return;
    }
    setNewMedicine('');
    setInventoryQuery('');
    setMessage({ type: 'success', text: `${result.medicine} ya esta disponible para inventario y prescripcion.` });
  };

  const changeOrderStatus = (orderId, status) => {
    const result = updateDeliveryStatus(orderId, status);
    setMessage(result.ok
      ? { type: 'success', text: 'Estado del pedido actualizado.' }
      : { type: 'error', text: result.message });
  };

  return (
    <section className="page-content medication-admin-layout">
      <header className="module-header medication-admin-header">
        <div>
          <span className="eyebrow">Farmacia · Control administrativo</span>
          <h1>Panel medicamentos</h1>
          <p>Administra el catalogo, las existencias y el seguimiento de solicitudes en un solo lugar.</p>
        </div>
        <div className="module-chip"><Pill size={22} />{data.medications.length} medicamentos</div>
      </header>

      <section className="medication-admin-summary" aria-label="Resumen de farmacia">
        <article><span>Catalogo activo</span><strong>{data.medications.length}</strong><small>medicamentos disponibles para el equipo clinico</small></article>
        <article><span>Existencias actuales</span><strong>{availableUnits.toLocaleString('es-CO')}</strong><small>unidades segun el inventario registrado</small></article>
        <article><span>Pedidos por gestionar</span><strong>{data.deliveries.filter((item) => !['Entregado', 'Cancelado'].includes(item.orderStatus)).length}</strong><small>solicitudes aun no cerradas</small></article>
      </section>

      {message ? <p className={`form-message ${message.type}`} role="status">{message.type === 'success' ? <CheckCircle2 size={17} /> : null}{message.text}</p> : null}

      <section id="admin-stock" className="medication-catalog-panel" aria-labelledby="catalog-title">
        <header className="medication-admin-section-heading">
          <div className="section-intro compact">
            <span className="eyebrow">Catalogo y stock</span>
            <h2 id="catalog-title">Medicamentos disponibles</h2>
            <p>El stock inicial de cada medicamento nuevo es cero y solo el administrador puede modificarlo.</p>
          </div>
          <label className="search-box medication-admin-search">
            <Search size={18} />
            <input value={inventoryQuery} onChange={(event) => setInventoryQuery(event.target.value)} placeholder="Buscar medicamento" aria-label="Buscar en el catalogo de medicamentos" />
          </label>
        </header>

        <form className="medication-add-form" onSubmit={submitMedicine}>
          <label htmlFor="new-medicine-name">Agregar al catalogo</label>
          <div>
            <input id="new-medicine-name" value={newMedicine} onChange={(event) => setNewMedicine(event.target.value)} placeholder="Nombre y concentracion, por ejemplo: Acetaminofen 500 mg" required />
            <button className="btn btn-primary" type="submit"><Plus size={17} />Agregar medicamento</button>
          </div>
        </form>

        {visibleInventory.length ? (
          <div className="medication-inventory-grid">
            {visibleInventory.map((item) => (
              <article className="medication-inventory-item" key={item.medicine}>
                <div className="medication-inventory-name"><span><Pill size={19} /></span><strong>{item.medicine}</strong></div>
                <label>Unidades en stock<input type="number" min="0" step="1" value={inventoryDraft[item.medicine] ?? item.stock} onChange={(event) => setInventoryDraft((current) => ({ ...current, [item.medicine]: event.target.value }))} /></label>
                <button className="btn btn-secondary" type="button" onClick={() => saveStock(item.medicine)}><Save size={16} />Guardar stock</button>
              </article>
            ))}
          </div>
        ) : <p className="empty-state">No hay medicamentos que coincidan con la busqueda.</p>}
      </section>

      <section id="medication-orders" className="medication-orders-panel" aria-labelledby="medication-orders-title">
        <header className="medication-admin-section-heading">
          <div className="section-intro compact">
            <span className="eyebrow">Farmacia y domicilios</span>
            <h2 id="medication-orders-title">Seguimiento de pedidos</h2>
            <p>{data.deliveries.length} solicitudes con informacion del paciente y direccion de entrega.</p>
          </div>
          <div className="medication-order-filters">
            <label className="search-box"><Search size={18} /><input value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} placeholder="Buscar medicamento o paciente" aria-label="Buscar pedidos por medicamento o paciente" /></label>
            <label className="order-status-filter">Estado<select value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)}>{orderStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
          </div>
        </header>

        {visibleOrders.length ? (
          <div className="admin-order-list">
            {visibleOrders.map((order) => (
              <article key={order.id}>
                <header>
                  <div><PackageSearch size={20} /><strong>{order.id}</strong></div>
                  <select value={order.orderStatus || 'Recibido'} disabled={['Entregado', 'Cancelado'].includes(order.orderStatus)} onChange={(event) => changeOrderStatus(order.id, event.target.value)} aria-label={`Estado de ${order.id}`}>
                    {orderStatuses.slice(1).map((status) => <option key={status}>{status}</option>)}
                  </select>
                </header>
                <dl>
                  <div><dt>Cliente</dt><dd>{order.patientName} · {order.patientDocument || 'Documento no disponible'}</dd></div>
                  <div><dt>Contacto</dt><dd>{order.patientPhone || 'Sin telefono'} · {order.patientEmail || 'Sin correo'}</dd></div>
                  <div><dt>Entrega</dt><dd>{order.address}{order.deliveryNotes ? ` · ${order.deliveryNotes}` : ''}</dd></div>
                  <div><dt>Pago</dt><dd>{order.paymentStatus || order.status} · {order.paymentMethod === 'en_linea' ? 'En linea' : 'Contra entrega'}</dd></div>
                  <div><dt>Fecha</dt><dd>{new Date(order.createdAt).toLocaleString('es-CO')}</dd></div>
                </dl>
                <div className="admin-order-items">
                  {(order.items || []).map((item, index) => <span key={`${item.medicine}-${index}`}><PackageCheck size={15} />{item.medicine} × {item.quantity}</span>)}
                  {!(order.items || []).length ? order.prescriptionIds?.map((item) => <span key={item}><PackageCheck size={15} />{item}</span>) : null}
                </div>
              </article>
            ))}
          </div>
        ) : <p className="empty-state">{data.deliveries.length ? 'No hay pedidos que coincidan con estos filtros.' : 'Los pedidos de los pacientes apareceran aqui en tiempo real.'}</p>}
      </section>
    </section>
  );
}
