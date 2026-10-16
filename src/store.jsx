import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { formatColombianAddress } from '../shared/colombianAddress';

const DATA_KEY = 'smu-data-v3';
const SESSION_KEY = 'smu-session-v3';

export const seedCredentials = {
  admin: { user: 'admin.smu', password: 'AdminSMU#2026' },
  doctor: { user: 'DOC-0001', password: 'MedicoSMU#2026' },
  secretary: { user: 'SEC-0001', password: 'SecretariaSMU#2026' },
  patient: { user: 'PAC-0001', password: 'PacienteSMU#2026' },
};

const medicationCatalog = [
  'Acetaminofen 500 mg',
  'Ibuprofeno 400 mg',
  'Loratadina 10 mg',
  'Amoxicilina 500 mg',
  'Omeprazol 20 mg',
  'Losartan 50 mg',
  'Metformina 850 mg',
  'Salbutamol inhalador',
  'Cetirizina 10 mg',
  'Naproxeno 250 mg',
  'Suero oral',
  'Dolex Gripa',
  'Azitromicina 500 mg',
  'Cefalexina 500 mg',
  'Ciprofloxacino 500 mg',
  'Diclofenaco 50 mg',
  'Acido acetilsalicilico 100 mg',
  'Amlodipino 5 mg',
  'Enalapril 10 mg',
  'Atorvastatina 20 mg',
  'Insulina glargina 100 UI/ml',
  'Levotiroxina 50 mcg',
  'Prednisolona 5 mg',
  'Aciclovir 400 mg',
  'Metronidazol 500 mg',
  'Hidroxido de aluminio suspension',
  'Budesonida inhalador',
  'Vitamina D3 1000 UI',
];

const initialData = {
  users: [
    {
      id: 'ADM-0001',
      role: 'admin',
      username: seedCredentials.admin.user,
      password: seedCredentials.admin.password,
      document: 'ADM-0001',
      name: 'Administrador Hospital Francisco de Asís',
      email: 'admin@sistemamedicou.local',
      phone: '0000000000',
      status: 'activo',
    },
    {
      id: 'DOC-0001',
      role: 'doctor',
      username: seedCredentials.doctor.user,
      password: seedCredentials.doctor.password,
      document: 'DOC-0001',
      name: 'Medico General Hospital Francisco de Asís',
      email: 'medico@sistemamedicou.local',
      phone: '3000000001',
      status: 'activo',
      license: 'LIC-SMU-001',
      specialty: 'Medicina General',
      medicalType: 'general',
      sede: 'Sede Norte',
    },
    {
      id: 'SEC-0001',
      role: 'secretary',
      username: seedCredentials.secretary.user,
      password: seedCredentials.secretary.password,
      document: 'SEC-0001',
      name: 'Secretaria Hospital Francisco de Asís',
      email: 'secretaria@sistemamedicou.local',
      phone: '3000000002',
      status: 'activo',
    },
    {
      id: 'PAT-PAC-0001',
      role: 'patient',
      username: seedCredentials.patient.user,
      password: seedCredentials.patient.password,
      document: 'PAC-0001',
      name: 'Paciente de Demostracion',
      email: 'paciente.demo@hospital.local',
      phone: '3000000003',
      status: 'activo',
    },
  ],
  patients: [
    {
      id: 'PAT-PAC-0001',
      document: 'PAC-0001',
      typeId: 'CC',
      name: 'Paciente de Demostracion',
      email: 'paciente.demo@hospital.local',
      phone: '3000000003',
      address: 'Direccion de demostracion',
      birthDate: '1995-01-01',
      eps: 'EPS de demostracion',
      status: 'activo',
    },
  ],
  doctors: [
    {
      id: 'DOC-0001',
      document: 'DOC-0001',
      name: 'Medico General Hospital Francisco de Asís',
      email: 'medico@sistemamedicou.local',
      phone: '3000000001',
      license: 'LIC-SMU-001',
      specialty: 'Medicina General',
      medicalType: 'general',
      sede: 'Sede Norte',
      status: 'activo',
    },
  ],
  appointments: [],
  clinicalRecords: [],
  prescriptions: [],
  deliveries: [],
  medications: medicationCatalog,
  inventory: medicationCatalog.map((medicine) => ({ medicine, stock: 0, updatedAt: null })),
  auditLog: [],
};

const AppDataContext = createContext(null);

const id = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const hasDuplicateUser = (users, form) =>
  users.some(
    (user) =>
      user.document?.toLowerCase() === form.document?.trim().toLowerCase() ||
      user.email?.toLowerCase() === form.email?.trim().toLowerCase(),
  );

const mergeStoredData = (stored = {}) => {
  const storedUsers = (stored.users || []).map((user) => {
    const seed = initialData.users.find((item) => item.id === user.id);
    return seed ? { ...user, name: seed.name } : user;
  });
  const storedDoctors = (stored.doctors || initialData.doctors).map((doctor) => {
    const seed = initialData.doctors.find((item) => item.id === doctor.id);
    return seed ? { ...doctor, name: seed.name } : doctor;
  });
  const storedInventory = stored.inventory || [];
  const medications = [...new Set([
    ...initialData.medications,
    ...(stored.medications || []),
    ...storedInventory.map((item) => item.medicine).filter(Boolean),
  ])];
  const inventory = medications.map((medicine) => {
    const storedItem = storedInventory.find((item) => item.medicine === medicine);
    return {
      ...(storedItem || {}),
      medicine,
      stock: Math.max(0, Number(storedItem?.stock) || 0),
      updatedAt: storedItem?.updatedAt || null,
    };
  });
  return {
    ...initialData,
    ...stored,
    users: [
      ...initialData.users.filter((seed) => !storedUsers.some((user) => user.id === seed.id)),
      ...storedUsers,
    ],
    patients: [
      ...initialData.patients.filter((seed) => !(stored.patients || []).some((patient) => patient.id === seed.id)),
      ...(stored.patients || []),
    ],
    doctors: storedDoctors,
    medications,
    inventory,
    deliveries: stored.deliveries || [],
    auditLog: stored.auditLog || [],
  };
};

const readJson = (key, fallback) => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
};

export function AppDataProvider({ children }) {
  const [data, setData] = useState(() => {
    return mergeStoredData(readJson(DATA_KEY, {}));
  });
  const [session, setSession] = useState(() => readJson(SESSION_KEY, null));

  useEffect(() => {
    const serializedData = JSON.stringify(data);
    if (localStorage.getItem(DATA_KEY) !== serializedData) {
      localStorage.setItem(DATA_KEY, serializedData);
    }
  }, [data]);

  useEffect(() => {
    const syncData = (event) => {
      if (event.key && event.key !== DATA_KEY) return;
      const nextData = readJson(DATA_KEY, null);
      if (nextData) setData(mergeStoredData(nextData));
    };

    window.addEventListener('storage', syncData);
    return () => {
      window.removeEventListener('storage', syncData);
    };
  }, []);

  useEffect(() => {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      localStorage.setItem('medical-auth', 'true');
      localStorage.setItem('medical-user', session.name);
      localStorage.setItem('medical-role', session.role);
    } else {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem('medical-auth');
      localStorage.removeItem('medical-user');
      localStorage.removeItem('medical-role');
    }
  }, [session]);

  const currentUser = useMemo(
    () => data.users.find((user) => user.id === session?.id) || null,
    [data.users, session],
  );

  const login = (identifier, password) => {
    const clean = identifier.trim().toLowerCase();
    const user = data.users.find((item) => {
      const identifiers = [item.username, item.document, item.email].filter(Boolean);
      return identifiers.some((value) => value.toLowerCase() === clean) && item.password === password;
    });

    if (!user) return { ok: false, message: 'Credenciales incorrectas.' };
    if (user.status !== 'activo') return { ok: false, message: 'Cuenta inactiva.' };

    setSession({ id: user.id, role: user.role, name: user.name });
    return { ok: true, user };
  };

  const logout = () => setSession(null);

  const acceptAuthenticatedUser = (profile) => {
    const user = { ...profile, role: profile.role || 'patient', status: profile.status || 'activo', password: null };
    const patient = {
      id: user.id,
      document: user.document,
      typeId: user.typeId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address || '',
      addressParts: user.addressParts || undefined,
      birthDate: '',
      eps: '',
      status: user.status,
    };
    setData((current) => ({
      ...current,
      users: current.users.some((item) => item.id === user.id)
        ? current.users.map((item) => item.id === user.id ? { ...item, ...user } : item)
        : [...current.users, user],
      patients: current.patients.some((item) => item.id === patient.id)
        ? current.patients.map((item) => item.id === patient.id ? { ...item, ...patient } : item)
        : [...current.patients, patient],
    }));
    setSession({ id: user.id, role: user.role, name: user.name });
  };

  const registerPatient = (form, autoLogin = true) => {
    const repeated = hasDuplicateUser(data.users, form);
    if (repeated) return { ok: false, message: 'Documento o correo ya registrado.' };

    const patient = {
      id: `PAT-${form.document}`,
      document: form.document,
      typeId: form.typeId,
      name: `${form.names} ${form.lastNames}`.trim(),
      email: form.email,
      phone: form.phone,
      address: '',
      addressParts: undefined,
      birthDate: form.birthDate,
      eps: form.eps,
      status: 'activo',
    };
    const user = {
      ...patient,
      role: 'patient',
      username: form.document,
      password: form.password,
    };

    setData((current) => ({
      ...current,
      users: [...current.users, user],
      patients: [...current.patients, patient],
      auditLog: [
        ...(current.auditLog || []),
        {
          id: id('AUD'),
          action: 'Cuenta creada',
          detail: 'Paciente registrado',
          user: patient.name,
          after: 'Paciente',
          admin: autoLogin ? 'Autorregistro' : currentUser?.name || 'Administrador',
          date: new Date().toISOString(),
        },
      ],
    }));
    if (autoLogin) setSession({ id: user.id, role: user.role, name: user.name });
    return { ok: true, user };
  };

  const updateUserAddress = (userId, addressParts) => {
    const address = formatColombianAddress(addressParts);
    if (!address) return { ok: false, message: 'Completa los componentes de la dirección.' };

    setData((current) => ({
      ...current,
      users: current.users.map((user) => user.id === userId ? { ...user, address, addressParts } : user),
      patients: current.patients.map((patient) => patient.id === userId ? { ...patient, address, addressParts } : patient),
      doctors: current.doctors.map((doctor) => doctor.id === userId ? { ...doctor, address, addressParts } : doctor),
    }));
    return { ok: true, address };
  };

  const addDoctor = (form) => {
    const repeated = hasDuplicateUser(data.users, form);
    if (repeated) return { ok: false, message: 'Documento o correo ya registrado.' };

    const doctor = {
      id: `DOC-${form.document}`,
      document: form.document,
      name: form.name,
      email: form.email,
      phone: form.phone,
      license: form.license,
      specialty: form.specialty,
      medicalType: form.medicalType,
      sede: form.sede,
      status: 'activo',
    };
    const user = {
      ...doctor,
      role: 'doctor',
      username: form.document,
      password: form.password,
    };

    setData((current) => ({
      ...current,
      doctors: [...current.doctors, doctor],
      users: [...current.users, user],
      auditLog: [
        ...(current.auditLog || []),
        {
          id: id('AUD'),
          action: 'Cuenta creada',
          detail: 'Medico agregado al directorio',
          user: doctor.name,
          after: 'Medico',
          admin: currentUser?.name || 'Administrador',
          date: new Date().toISOString(),
        },
      ],
    }));
    return { ok: true, user };
  };

  const addSecretary = (form) => {
    const repeated = hasDuplicateUser(data.users, form);
    if (repeated) return { ok: false, message: 'Documento o correo ya registrado.' };

    const user = {
      id: `SEC-${form.document}`,
      role: 'secretary',
      username: form.document,
      password: form.password,
      document: form.document,
      name: form.name,
      email: form.email,
      phone: form.phone,
      status: 'activo',
    };

    setData((current) => ({
      ...current,
      users: [...current.users, user],
      auditLog: [
        ...(current.auditLog || []),
        {
          id: id('AUD'),
          action: 'Cuenta creada',
          detail: 'Secretaria agregada al equipo operativo',
          user: user.name,
          after: 'Secretaria',
          admin: currentUser?.name || 'Administrador',
          date: new Date().toISOString(),
        },
      ],
    }));
    return { ok: true, user };
  };

  const updateUserRole = (userId, role) => {
    const allowedRoles = ['doctor', 'secretary', 'patient'];
    const target = data.users.find((user) => user.id === userId);
    if (!target || target.role === 'admin') return { ok: false, message: 'La cuenta administradora está protegida.' };
    if (!allowedRoles.includes(role)) return { ok: false, message: 'Selecciona un rol válido.' };

    const roleName = { doctor: 'Medico', secretary: 'Secretaria', patient: 'Paciente' }[role];
    setData((current) => {
      const updatedUser = { ...target, role };
      let doctors = current.doctors;
      let patients = current.patients;

      if (role === 'doctor' && !doctors.some((doctor) => doctor.id === target.id)) {
        doctors = [
          ...doctors,
          {
            id: target.id,
            document: target.document,
            name: target.name,
            email: target.email,
            phone: target.phone,
            license: target.license || `LIC-${target.document}`,
            specialty: target.specialty || 'Medicina General',
            medicalType: target.medicalType || 'general',
            sede: target.sede || 'Sede Norte',
            status: target.status || 'activo',
          },
        ];
      }

      if (role !== 'doctor') doctors = doctors.filter((doctor) => doctor.id !== target.id);
      if (role === 'patient' && !patients.some((patient) => patient.id === target.id)) {
        patients = [
          ...patients,
          {
            id: target.id,
            document: target.document,
            typeId: target.typeId || 'CC',
            name: target.name,
            email: target.email,
            phone: target.phone,
            address: target.address || '',
            birthDate: target.birthDate || '',
            eps: target.eps || '',
            status: target.status || 'activo',
          },
        ];
      }
      if (role !== 'patient') patients = patients.filter((patient) => patient.id !== target.id);

      return {
        ...current,
        users: current.users.map((user) => (user.id === userId ? updatedUser : user)),
        doctors,
        patients,
        auditLog: [
          ...(current.auditLog || []),
          {
            id: id('AUD'),
            action: 'Rol actualizado',
            detail: `${target.role} a ${roleName}`,
            user: target.name,
            before: target.role,
            after: roleName,
            admin: currentUser?.name || 'Administrador',
            date: new Date().toISOString(),
          },
        ],
      };
    });
    return { ok: true };
  };

  const updateDoctor = (doctorId, changes) => {
    setData((current) => ({
      ...current,
      doctors: current.doctors.map((doctor) =>
        doctor.id === doctorId ? { ...doctor, ...changes } : doctor,
      ),
      users: current.users.map((user) => (user.id === doctorId ? { ...user, ...changes } : user)),
    }));
  };

  const createAppointment = (form) => {
    const doctor = data.doctors.find((item) => item.id === form.doctorId);
    if (!doctor) return { ok: false, message: 'Selecciona un medico.' };

    const doctorBusy = data.appointments.some(
      (appointment) =>
        appointment.doctorId === form.doctorId &&
        appointment.date === form.date &&
        appointment.time === form.time &&
        ['Pendiente', 'En curso'].includes(appointment.status),
    );
    if (doctorBusy) return { ok: false, message: 'No hay disponibilidad: el medico esta ocupado a esa hora.' };

    const patientBusy = data.appointments.some(
      (appointment) =>
        appointment.patientId === currentUser.id &&
        appointment.date === form.date &&
        appointment.time === form.time &&
        ['Pendiente', 'En curso'].includes(appointment.status),
    );
    if (patientBusy) return { ok: false, message: 'Ya tienes una cita activa en ese horario.' };

    const appointment = {
      id: id('CITA'),
      patientId: currentUser.id,
      patientDocument: currentUser.document,
      patientName: currentUser.name,
      doctorId: doctor.id,
      doctorDocument: doctor.document,
      doctorName: doctor.name,
      specialty: doctor.specialty,
      attentionType: form.attentionType,
      sede: form.sede,
      date: form.date,
      time: form.time,
      reason: form.reason,
      status: 'Pendiente',
      createdAt: new Date().toISOString(),
    };
    setData((current) => ({ ...current, appointments: [...current.appointments, appointment] }));
    return { ok: true };
  };

  const createAppointmentForSecretary = (form) => {
    if (!['secretary', 'admin'].includes(currentUser.role)) {
      return { ok: false, message: 'No tienes permisos para crear citas asistidas.' };
    }
    const patient = data.patients.find((item) => item.id === form.patientId);
    const doctor = data.doctors.find((item) => item.id === form.doctorId);
    if (!patient) return { ok: false, message: 'Selecciona un paciente registrado.' };
    if (!doctor) return { ok: false, message: 'Selecciona un medico.' };

    const doctorBusy = data.appointments.some(
      (appointment) =>
        appointment.doctorId === doctor.id &&
        appointment.date === form.date &&
        appointment.time === form.time &&
        ['Pendiente', 'En curso'].includes(appointment.status),
    );
    if (doctorBusy) return { ok: false, message: 'No hay disponibilidad para ese medico en ese horario.' };

    const patientBusy = data.appointments.some(
      (appointment) =>
        appointment.patientId === patient.id &&
        appointment.date === form.date &&
        appointment.time === form.time &&
        ['Pendiente', 'En curso'].includes(appointment.status),
    );
    if (patientBusy) return { ok: false, message: 'El paciente ya tiene una cita activa en ese horario.' };

    const appointment = {
      id: id('CITA'),
      patientId: patient.id,
      patientDocument: patient.document,
      patientName: patient.name,
      doctorId: doctor.id,
      doctorDocument: doctor.document,
      doctorName: doctor.name,
      specialty: doctor.specialty,
      attentionType: form.attentionType,
      sede: form.sede,
      date: form.date,
      time: form.time,
      reason: form.reason,
      status: 'Pendiente',
      managedBy: currentUser.name,
      createdBy: currentUser.id,
      createdAt: new Date().toISOString(),
    };
    setData((current) => ({ ...current, appointments: [...current.appointments, appointment] }));
    return { ok: true, appointment };
  };

  const rescheduleAppointment = (appointmentId, changes) => {
    const existing = data.appointments.find((item) => item.id === appointmentId);
    if (!existing) return { ok: false, message: 'No se encontro la cita.' };
    const doctorId = changes.doctorId || existing.doctorId;
    const doctor = data.doctors.find((item) => item.id === doctorId);
    if (!doctor) return { ok: false, message: 'Selecciona un medico valido.' };

    const doctorBusy = data.appointments.some(
      (appointment) =>
        appointment.id !== appointmentId &&
        appointment.doctorId === doctorId &&
        appointment.date === changes.date &&
        appointment.time === changes.time &&
        ['Pendiente', 'En curso'].includes(appointment.status),
    );
    if (doctorBusy) return { ok: false, message: 'El nuevo horario ya esta ocupado.' };

    setData((current) => ({
      ...current,
      appointments: current.appointments.map((appointment) =>
        appointment.id === appointmentId
          ? {
              ...appointment,
              ...changes,
              doctorId,
              doctorDocument: doctor.document,
              doctorName: doctor.name,
              specialty: doctor.specialty,
              managedBy: currentUser.name,
              updatedAt: new Date().toISOString(),
            }
          : appointment,
      ),
    }));
    return { ok: true };
  };

  const registerPatientBySecretary = (form) => {
    const repeated = hasDuplicateUser(data.users, form);
    if (repeated) return { ok: false, message: 'Documento o correo ya registrado.' };

    const patient = {
      id: `PAT-${form.document}`,
      document: form.document,
      typeId: form.typeId,
      name: `${form.names} ${form.lastNames}`.trim(),
      email: form.email,
      phone: form.phone,
      address: form.address || '',
      birthDate: form.birthDate,
      eps: form.eps,
      status: 'activo',
    };
    const user = {
      ...patient,
      role: 'patient',
      username: form.document,
      password: `${form.document}SMU#2026`,
    };
    setData((current) => ({
      ...current,
      users: [...current.users, user],
      patients: [...current.patients, patient],
      auditLog: [
        ...(current.auditLog || []),
        {
          id: id('AUD'),
          action: 'Cuenta creada',
          detail: 'Paciente registrado por secretaria',
          user: patient.name,
          after: 'Paciente',
          admin: currentUser?.name || 'Secretaria',
          date: new Date().toISOString(),
        },
      ],
    }));
    return { ok: true, patient };
  };

  const updateAppointment = (appointmentId, changes) => {
    setData((current) => ({
      ...current,
      appointments: current.appointments.map((appointment) =>
        appointment.id === appointmentId ? { ...appointment, ...changes } : appointment,
      ),
    }));
  };

  const startAppointment = (appointmentId) => {
    const appointment = data.appointments.find((item) => item.id === appointmentId);
    if (!appointment) return { ok: false, message: 'No se encontro la cita.' };
    if (appointment.status !== 'Pendiente') {
      return { ok: false, message: 'Solo se pueden iniciar citas pendientes.' };
    }

    const startTime = new Date().toISOString();
    setData((current) => ({
      ...current,
      appointments: current.appointments.map((item) =>
        item.id === appointmentId ? { ...item, status: 'En curso', startTime } : item,
      ),
    }));
    return { ok: true };
  };

  const saveClinicalRecord = (form) => {
    const appointment = data.appointments.find((item) => item.id === form.appointmentId);
    if (!appointment) return { ok: false, message: 'Selecciona una cita valida.' };
    if (appointment.status !== 'En curso') {
      return { ok: false, message: 'La cita debe estar en curso para guardar el historial.' };
    }
    const recordId = id('HIST');
    const record = {
      id: recordId,
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      patientDocument: appointment.patientDocument,
      patientName: appointment.patientName,
      doctorId: currentUser.id,
      doctorName: currentUser.name,
      specialty: appointment.specialty,
      reason: appointment.reason,
      sede: appointment.sede,
      symptoms: form.symptoms,
      diagnosis: form.diagnosis,
      observations: form.observations,
      date: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    };
    const prescriptions = (form.prescriptions || []).map((item) => ({
      id: id('RX'),
      recordId,
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      patientDocument: appointment.patientDocument,
        patientName: appointment.patientName,
        doctorId: currentUser.id,
        doctorName: currentUser.name,
        date: record.date,
        medicine: item.medicine,
      dose: item.dose,
      frequency: item.frequency,
      duration: item.duration,
    }));

    setData((current) => ({
      ...current,
      clinicalRecords: [...current.clinicalRecords, record],
      prescriptions: [...current.prescriptions, ...prescriptions],
      appointments: current.appointments.map((item) =>
        item.id === appointment.id
          ? { ...item, status: 'Finalizada', endTime: new Date().toISOString() }
          : item,
      ),
    }));
    return { ok: true };
  };

  const payDelivery = (deliveryId, payment) => {
    setData((current) => ({
      ...current,
      deliveries: current.deliveries.map((delivery) =>
        delivery.id === deliveryId
          ? { ...delivery, ...payment, status: 'Pago confirmado', paymentStatus: 'Pagado', paidAt: new Date().toISOString() }
          : delivery,
      ),
    }));
  };

  const updateInventoryStock = (medicine, stock) => {
    if (currentUser?.role !== 'admin') return { ok: false, message: 'Solo el administrador puede modificar el inventario.' };
    const quantity = Number(stock);
    if (!Number.isInteger(quantity) || quantity < 0) return { ok: false, message: 'El stock debe ser un numero entero igual o mayor que cero.' };

    setData((current) => ({
      ...current,
      inventory: current.inventory.map((item) =>
        item.medicine === medicine ? { ...item, stock: quantity, updatedAt: new Date().toISOString() } : item,
      ),
      auditLog: [
        ...(current.auditLog || []),
        {
          id: id('AUD'), action: 'Inventario actualizado', detail: `${medicine}: ${quantity} unidades`,
          user: medicine, after: `${quantity} unidades`, admin: currentUser.name, date: new Date().toISOString(),
        },
      ],
    }));
    return { ok: true };
  };

  const addMedication = (name) => {
    if (currentUser?.role !== 'admin') return { ok: false, message: 'Solo el administrador puede agregar medicamentos.' };
    const medicine = String(name || '').trim().replace(/\s+/g, ' ');
    if (medicine.length < 3) return { ok: false, message: 'Escribe un nombre de medicamento valido.' };
    if (data.medications.some((item) => item.toLocaleLowerCase() === medicine.toLocaleLowerCase())) {
      return { ok: false, message: 'Ese medicamento ya existe en el catalogo.' };
    }

    setData((current) => ({
      ...current,
      medications: [...current.medications, medicine],
      inventory: [...current.inventory, { medicine, stock: 0, updatedAt: null }],
      auditLog: [
        ...(current.auditLog || []),
        {
          id: id('AUD'), action: 'Medicamento agregado', detail: `${medicine} agregado al catalogo`,
          user: medicine, after: 'Stock inicial: 0', admin: currentUser.name, date: new Date().toISOString(),
        },
      ],
    }));
    return { ok: true, medicine };
  };

  const updateDeliveryStatus = (deliveryId, orderStatus) => {
    if (currentUser?.role !== 'admin') return { ok: false, message: 'Solo el administrador puede gestionar pedidos.' };
    const validStatuses = ['Recibido', 'Preparando', 'Enviado', 'Entregado', 'Cancelado'];
    const delivery = data.deliveries.find((item) => item.id === deliveryId);
    if (!delivery || !validStatuses.includes(orderStatus)) return { ok: false, message: 'No se pudo actualizar el estado del pedido.' };
    if (delivery.orderStatus === 'Cancelado' || delivery.orderStatus === 'Entregado') {
      return { ok: false, message: 'El pedido ya tiene un estado final.' };
    }

    setData((current) => ({
      ...current,
      deliveries: current.deliveries.map((item) =>
        item.id === deliveryId
          ? { ...item, orderStatus, stockRestocked: orderStatus === 'Cancelado' || item.stockRestocked, status: item.paymentStatus || item.status, updatedAt: new Date().toISOString(), ...(orderStatus === 'Entregado' ? { deliveredAt: new Date().toISOString() } : {}) }
          : item,
      ),
      inventory: orderStatus === 'Cancelado' && !delivery.stockRestocked
        ? current.inventory.map((stockItem) => {
            const returnedQuantity = (delivery.items || []).filter((item) => item.medicine === stockItem.medicine).reduce((total, item) => total + item.quantity, 0);
            return returnedQuantity ? { ...stockItem, stock: stockItem.stock + returnedQuantity } : stockItem;
          })
        : current.inventory,
    }));
    return { ok: true };
  };

  const createDelivery = (form) => {
    if (currentUser?.role !== 'patient') return { ok: false, message: 'Solo un paciente puede solicitar medicamentos.' };
    const items = (form.items || []).filter((item) => item.medicine && Number(item.quantity) > 0);
    if (!items.length) return { ok: false, message: 'Selecciona al menos un medicamento.' };

    const quantities = items.reduce((totals, item) => {
      totals[item.medicine] = (totals[item.medicine] || 0) + Number(item.quantity);
      return totals;
    }, {});
    const unavailable = Object.entries(quantities).find(([medicine, quantity]) => {
      const stock = data.inventory.find((item) => item.medicine === medicine)?.stock || 0;
      return quantity > stock;
    });
    if (unavailable) return { ok: false, message: `Stock insuficiente para ${unavailable[0]}. Ajusta la seleccion o consulta disponibilidad.` };

    const timestamp = new Date().toISOString();
    const delivery = {
      id: id('PED'),
      patientId: currentUser.id,
      patientName: currentUser.name,
      patientDocument: currentUser.document,
      patientEmail: form.email || currentUser.email,
      patientPhone: form.phone || currentUser.phone,
      address: form.address,
      deliveryNotes: form.deliveryNotes || '',
      paymentMethod: form.paymentMethod,
      paymentStatus: form.paymentMethod === 'en_linea' ? 'Pendiente de pago' : 'Pago contra entrega',
      prescriptionIds: items.map((item) => item.prescriptionId),
      items,
      orderStatus: 'Recibido',
      status: form.paymentMethod === 'en_linea' ? 'Pendiente de pago' : 'Pago contra entrega',
      createdAt: timestamp,
    };

    setData((current) => ({
      ...current,
      inventory: current.inventory.map((item) => ({ ...item, stock: item.stock - (quantities[item.medicine] || 0) })),
      deliveries: [...current.deliveries, delivery],
    }));
    return { ok: true, delivery };
  };

  const resetData = () => {
    setData(initialData);
    setSession(null);
  };

  return (
    <AppDataContext.Provider
      value={{
        data,
        currentUser,
        isAuthenticated: Boolean(currentUser),
        login,
        logout,
        acceptAuthenticatedUser,
        updateUserAddress,
        registerPatient,
        addDoctor,
        addSecretary,
        updateUserRole,
        updateDoctor,
        createAppointment,
        createAppointmentForSecretary,
        rescheduleAppointment,
        registerPatientBySecretary,
        updateAppointment,
        startAppointment,
        saveClinicalRecord,
        createDelivery,
        payDelivery,
        updateInventoryStock,
        addMedication,
        updateDeliveryStatus,
        resetData,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export const useAppData = () => {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData debe usarse dentro de AppDataProvider');
  return context;
};
