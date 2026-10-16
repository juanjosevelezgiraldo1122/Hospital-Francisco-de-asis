export const roles = [
  { id: 101, name: 'paciente', label: 'Paciente' },
  { id: 201, name: 'medico', label: 'Medico' },
  { id: 301, name: 'secretaria', label: 'Secretaria' },
  { id: 401, name: 'administrador', label: 'Administrador' },
];

export const sedes = [
  {
    id: 1,
    name: 'Sede Norte',
    address: 'Calle 10 # 20-30',
    city: 'Medellin',
    phone: '6041234567',
  },
  {
    id: 2,
    name: 'Sede Campus Salud',
    address: 'Carrera 45 # 72-18',
    city: 'Medellin',
    phone: '6047654321',
  },
  {
    id: 3,
    name: 'Sede Bienestar U',
    address: 'Avenida Universidad # 14-22',
    city: 'Medellin',
    phone: '6047788990',
  },
];

export const specialties = [
  { id: 1, name: 'Medicina General', description: 'Atencion medica basica y de primer nivel' },
  { id: 2, name: 'Pediatria', description: 'Atencion especializada en ninos y adolescentes' },
  { id: 3, name: 'Cardiologia', description: 'Diagnostico y tratamiento de enfermedades del corazon' },
];

export const doctors = [
  {
    license: 'LIC-0001',
    name: 'Dr. Angel Rodriguez',
    type: 'general',
    specialty: 'Medicina General',
    sede: 'Sede Norte',
    status: 'activo',
  },
  {
    license: 'LIC-0002',
    name: 'Dra. Laura Restrepo',
    type: 'especialista',
    specialty: 'Pediatria',
    sede: 'Sede Campus Salud',
    status: 'activo',
  },
  {
    license: 'LIC-0003',
    name: 'Dr. Mateo Cardenas',
    type: 'especialista',
    specialty: 'Cardiologia',
    sede: 'Sede Bienestar U',
    status: 'activo',
  },
];

export const patients = [
  {
    id: 1,
    document: '1001234567',
    typeId: 'CC',
    name: 'Ana Perez',
    email: 'ana.perez@correo.com',
    phone: '3001234567',
    eps: 'Sura',
    address: 'Calle 41 # 21-10',
    birthDate: '2001-04-12',
    status: 'activo',
  },
  {
    id: 2,
    document: '1007654321',
    typeId: 'CC',
    name: 'Carlos Marin',
    email: 'carlos.marin@correo.com',
    phone: '3017654321',
    eps: 'Nueva EPS',
    address: 'Carrera 52 # 18-44',
    birthDate: '1998-11-08',
    status: 'activo',
  },
  {
    id: 3,
    document: '1014567890',
    typeId: 'CC',
    name: 'Sofia Alvarez',
    email: 'sofia.alvarez@correo.com',
    phone: '3024567890',
    eps: 'Sanitas',
    address: 'Circular 3 # 70-21',
    birthDate: '2017-06-19',
    status: 'activo',
  },
];

export const appointments = [
  {
    id: 1201,
    patientId: 1,
    patientName: 'Ana Perez',
    document: '1001234567',
    doctorLicense: 'LIC-0001',
    doctorName: 'Dr. Angel Rodriguez',
    specialty: 'Medicina General',
    sede: 'Sede Norte',
    date: '2026-09-18',
    time: '09:00',
    attentionType: 'medicina general',
    reason: 'Control general y revision de signos vitales',
    status: 'Pendiente',
    managedBy: 'Paciente',
  },
  {
    id: 1202,
    patientId: 2,
    patientName: 'Carlos Marin',
    document: '1007654321',
    doctorLicense: 'LIC-0003',
    doctorName: 'Dr. Mateo Cardenas',
    specialty: 'Cardiologia',
    sede: 'Sede Bienestar U',
    date: '2026-09-18',
    time: '10:30',
    attentionType: 'especialista',
    reason: 'Seguimiento cardiologico',
    status: 'En curso',
    managedBy: 'Secretaria',
    startTime: '2026-09-18 10:31',
  },
  {
    id: 1203,
    patientId: 1,
    patientName: 'Ana Perez',
    document: '1001234567',
    doctorLicense: 'LIC-0002',
    doctorName: 'Dra. Laura Restrepo',
    specialty: 'Pediatria',
    sede: 'Sede Campus Salud',
    date: '2026-09-12',
    time: '14:00',
    attentionType: 'especialista',
    reason: 'Consulta finalizada con tratamiento',
    status: 'Finalizada',
    managedBy: 'Paciente',
    startTime: '2026-09-12 14:02',
    endTime: '2026-09-12 14:37',
  },
  {
    id: 1204,
    patientId: 3,
    patientName: 'Sofia Alvarez',
    document: '1014567890',
    doctorLicense: 'LIC-0002',
    doctorName: 'Dra. Laura Restrepo',
    specialty: 'Pediatria',
    sede: 'Sede Campus Salud',
    date: '2026-09-18',
    time: '11:15',
    attentionType: 'especialista',
    reason: 'Fiebre y control pediatrico',
    status: 'Cancelada',
    managedBy: 'Medico',
    cancellationLink: 'https://sistema-medico-u.local/reagendar/1204',
  },
];

export const availableTimes = ['08:00', '09:00', '10:30', '11:15', '14:00', '15:30'];

export const medicationCatalog = [
  {
    id: 1,
    name: 'Acetaminofen 500 mg',
    code: 'MED-AC500',
    company: 'Farmalab',
    description: 'Analgesico y antipiretico',
  },
  {
    id: 2,
    name: 'Loratadina 10 mg',
    code: 'MED-LOR10',
    company: 'BioSalud',
    description: 'Antihistaminico',
  },
  {
    id: 3,
    name: 'Losartan 50 mg',
    code: 'MED-LOS50',
    company: 'Cardiofarma',
    description: 'Antihipertensivo',
  },
];

export const prescriptions = [
  {
    appointmentId: 1203,
    patientDocument: '1001234567',
    patientName: 'Ana Perez',
    doctorName: 'Dra. Laura Restrepo',
    date: '2026-09-12',
    status: 'Finalizada',
    diagnosis: 'Cuadro respiratorio leve sin signos de alarma.',
    medicine: 'Acetaminofen 500 mg',
    dose: '1 tableta',
    frequency: 'Cada 8 horas',
    duration: '3 dias',
    shippable: true,
  },
  {
    appointmentId: 1203,
    patientDocument: '1001234567',
    patientName: 'Ana Perez',
    doctorName: 'Dra. Laura Restrepo',
    date: '2026-09-12',
    status: 'Finalizada',
    diagnosis: 'Cuadro respiratorio leve sin signos de alarma.',
    medicine: 'Loratadina 10 mg',
    dose: '1 tableta',
    frequency: 'Cada 24 horas',
    duration: '5 dias',
    shippable: true,
  },
];

export const roleUsers = [
  {
    document: '1001234567',
    name: 'Ana Perez',
    email: 'ana.perez@correo.com',
    role: 'paciente',
    status: 'activo',
    locked: true,
  },
  {
    document: '2010001112',
    name: 'Angel Rodriguez',
    email: 'angel.rodriguez@medicou.edu',
    role: 'medico',
    status: 'activo',
    locked: false,
  },
  {
    document: '3010002223',
    name: 'Marta Gomez',
    email: 'marta.gomez@medicou.edu',
    role: 'secretaria',
    status: 'activo',
    locked: false,
  },
  {
    document: '4010003334',
    name: 'Rafael Torres',
    email: 'rafael.torres@medicou.edu',
    role: 'administrador',
    status: 'activo',
    locked: false,
  },
];

export const roleHistory = [
  {
    date: '2026-09-18 08:20',
    user: 'Marta Gomez',
    before: 'Sin rol',
    after: 'secretaria',
    admin: 'Rafael Torres',
  },
  {
    date: '2026-09-17 16:45',
    user: 'Angel Rodriguez',
    before: 'Sin rol',
    after: 'medico',
    admin: 'Rafael Torres',
  },
];

export const kpis = [
  { label: 'Citas activas', value: '44', detail: 'Pendientes y en curso' },
  { label: 'Pacientes registrados', value: '1.248', detail: '97% con ficha completa' },
  { label: 'Agenda medica', value: '92%', detail: 'Cobertura del dia' },
  { label: 'Envios', value: '18', detail: 'Medicamentos a domicilio' },
];

export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const passwordHint =
  'Usa de 7 a 20 caracteres con letras y numeros. No se aceptan contrasenas mas largas.';
