import { useState } from 'react';
import { CalendarDays, Check, ClipboardList, Download, FileHeart, FileText, Pill, Search, ShieldCheck, UserRound } from 'lucide-react';
import { useAppData } from '../store';
import { downloadHospitalPdf, pdfFilename } from '../utils/hospitalPdf';

const today = new Date().toISOString().slice(0, 10);
const dateLabel = (date) => date ? new Date(`${date}T12:00:00`).toLocaleDateString('es-CO') : 'No registrada';
const categories = [
  { id: 'all', label: 'Todos' },
  { id: 'appointments', label: 'Citas' },
  { id: 'health', label: 'Salud' },
  { id: 'medicines', label: 'Medicamentos' },
  { id: 'account', label: 'Datos personales' },
];

export default function MisDocumentos() {
  const { currentUser, data } = useAppData();
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const appointments = data.appointments
    .filter((item) => item.patientId === currentUser.id)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const records = data.clinicalRecords
    .filter((item) => item.patientId === currentUser.id)
    .sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date));
  const prescriptions = data.prescriptions
    .filter((item) => item.patientId === currentUser.id)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const deliveries = data.deliveries
    .filter((item) => item.patientId === currentUser.id)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const patient = data.patients.find((item) => item.id === currentUser.id);

  const documents = [
    {
      id: 'next-appointments', category: 'appointments', categoryLabel: 'Citas', title: 'Próximas citas',
      description: 'Agenda vigente con profesional, sede, fecha y estado.', icon: CalendarDays,
      available: appointments.some((item) => item.date >= today && ['Pendiente', 'En curso'].includes(item.status)),
      sections: [{
        title: 'Agenda vigente',
        items: appointments
          .filter((item) => item.date >= today && ['Pendiente', 'En curso'].includes(item.status))
          .map((item) => `${dateLabel(item.date)} · ${item.time} · ${item.doctorName} · ${item.specialty || 'Especialidad no registrada'} · ${item.sede} · ${item.status}`),
      }],
    },
    {
      id: 'appointment-history', category: 'appointments', categoryLabel: 'Citas', title: 'Historial de citas',
      description: 'Relación de reservas y su estado, sin datos clínicos.', icon: ClipboardList,
      available: appointments.length > 0,
      sections: [{ title: 'Citas registradas', items: appointments.map((item) => `${dateLabel(item.date)} · ${item.time} · ${item.doctorName} · ${item.sede} · ${item.status}`) }],
    },
    {
      id: 'consultation-summary', category: 'health', categoryLabel: 'Salud', title: 'Resumen de consultas',
      description: 'Resumen personal de consultas registradas por tus profesionales.', icon: FileHeart,
      available: records.length > 0,
      sections: records.map((record) => ({
        title: `Consulta · ${dateLabel(record.date)}`,
        rows: [
          { label: 'Profesional', value: record.doctorName }, { label: 'Especialidad', value: record.specialty },
          { label: 'Motivo', value: record.reason }, { label: 'Síntomas', value: record.symptoms },
          { label: 'Diagnóstico', value: record.diagnosis }, { label: 'Observaciones', value: record.observations },
        ],
      })),
    },
    {
      id: 'prescriptions', category: 'medicines', categoryLabel: 'Medicamentos', title: 'Fórmulas e indicaciones',
      description: 'Medicamentos formulados e instrucciones guardadas por el profesional.', icon: Pill,
      available: prescriptions.length > 0,
      sections: prescriptions.map((item) => ({
        title: `${item.medicine} · ${dateLabel(item.date)}`,
        rows: [
          { label: 'Profesional', value: item.doctorName }, { label: 'Dosis', value: item.dose },
          { label: 'Frecuencia', value: item.frequency }, { label: 'Duración', value: item.duration },
        ],
      })),
    },
    {
      id: 'medication-orders', category: 'medicines', categoryLabel: 'Medicamentos', title: 'Pedidos de medicamentos',
      description: 'Detalle y seguimiento de solicitudes a domicilio.', icon: FileText,
      available: deliveries.length > 0,
      sections: deliveries.map((item) => ({
        title: `Pedido ${item.id}`,
        rows: [
          { label: 'Fecha', value: item.createdAt ? new Date(item.createdAt).toLocaleString('es-CO') : null },
          { label: 'Estado', value: item.orderStatus || item.status }, { label: 'Pago', value: item.paymentStatus || item.status },
          { label: 'Dirección', value: item.address }, { label: 'Notas de entrega', value: item.deliveryNotes },
        ],
        items: (item.items || []).map((medicine) => `${medicine.medicine} · ${medicine.quantity} unidad(es)`),
      })),
    },
    {
      id: 'personal-details', category: 'account', categoryLabel: 'Datos personales', title: 'Ficha personal',
      description: 'Copia de los datos de contacto registrados en tu cuenta.', icon: UserRound, available: true,
      sections: [{
        title: 'Información registrada',
        rows: [
          { label: 'Tipo y número de documento', value: `${currentUser.typeId || 'No registrado'} ${currentUser.document}` },
          { label: 'Teléfono', value: currentUser.phone }, { label: 'Correo', value: currentUser.email },
          { label: 'Dirección', value: patient?.address }, { label: 'EPS', value: patient?.eps },
        ],
      }],
    },
  ];

  const filteredDocuments = documents.filter((document) => {
    const matchesCategory = category === 'all' || document.category === category;
    const query = search.trim().toLocaleLowerCase('es');
    const matchesSearch = !query || `${document.title} ${document.description} ${document.categoryLabel}`.toLocaleLowerCase('es').includes(query);
    return matchesCategory && matchesSearch;
  });
  const availableCount = documents.filter((document) => document.available).length;

  const download = (document) => {
    downloadHospitalPdf({
      title: document.title,
      subtitle: 'Documento personal generado desde el portal del paciente',
      patient: currentUser,
      sections: document.sections,
      generatedBy: currentUser.name,
    }, pdfFilename(`hospital-fda-${document.id}-${currentUser.document}`));
  };

  return (
    <section className="page-content documents-page">
      <header className="documents-hero">
        <div className="documents-hero-copy">
          <span className="eyebrow">PORTAL DEL PACIENTE <span aria-hidden="true">/</span> ARCHIVO PERSONAL</span>
          <h1>Mis documentos</h1>
          <p>Consulta y descarga tus registros personales en un formato listo para guardar o imprimir.</p>
        </div>
        <div className="documents-hero-security"><ShieldCheck size={18} /><span>Acceso privado<br /><strong>{currentUser.name}</strong></span></div>
      </header>

      <div className="documents-overview" aria-label="Resumen de documentos">
        <div className="documents-overview-item"><span className="documents-overview-icon"><FileText size={18} /></span><span><strong>{documents.length}</strong><small>Tipos de documento</small></span></div>
        <span className="documents-overview-divider" />
        <div className="documents-overview-item"><span className="documents-overview-icon is-ready"><Check size={18} /></span><span><strong>{availableCount}</strong><small>Con información disponible</small></span></div>
        <p>Los PDF se preparan con la información vigente de tu cuenta.</p>
      </div>

      <section className="documents-library" aria-labelledby="documents-library-title">
        <div className="documents-library-heading">
          <div><span className="eyebrow">ARCHIVO PERSONAL</span><h2 id="documents-library-title">Biblioteca de documentos</h2></div>
          <span className="documents-result-count">{filteredDocuments.length} {filteredDocuments.length === 1 ? 'documento' : 'documentos'}</span>
        </div>

        <div className="documents-toolbar">
          <div className="documents-filters" aria-label="Filtrar documentos por categoría">
            {categories.map((item) => (
              <button key={item.id} type="button" aria-pressed={category === item.id} className={category === item.id ? 'is-active' : ''} onClick={() => setCategory(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <label className="documents-search">
            <Search size={17} aria-hidden="true" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar documento" aria-label="Buscar documento" />
          </label>
        </div>

        {filteredDocuments.length ? (
          <div className="documents-grid">
            {filteredDocuments.map((document) => {
              const Icon = document.icon;
              return (
                <article className={`document-card${document.available ? '' : ' is-empty'}`} key={document.id}>
                  <div className="document-card-top">
                    <span className="document-card-category">{document.categoryLabel}</span>
                    <span className="document-card-icon"><Icon size={20} /></span>
                  </div>
                  <h3>{document.title}</h3>
                  <p>{document.description}</p>
                  <div className={`document-card-status${document.available ? ' is-ready' : ''}`}>
                    <span aria-hidden="true" />{document.available ? 'Información disponible' : 'Aún sin registros'}
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={() => download(document)} disabled={!document.available}>
                    <Download size={16} />Descargar PDF
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="documents-empty-state"><Search size={22} /><strong>No encontramos documentos</strong><span>Prueba con otra búsqueda o categoría.</span></div>
        )}
      </section>
      <p className="documents-footnote">Estos archivos son copias informativas de los datos registrados y no reemplazan certificados oficiales ni indicaciones médicas.</p>
    </section>
  );
}
