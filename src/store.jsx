import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { formatColombianAddress } from '../shared/colombianAddress';

const emptyData = {
  users: [], patients: [], doctors: [], appointments: [], bookedSlots: [], clinicalRecords: [],
  prescriptions: [], deliveries: [], medications: [], inventory: [], sedes: [], specialties: [], auditLog: [],
};
const AppDataContext = createContext(null);
const databaseId = (value) => Number(String(value || '').replace(/^PAT-DB-/, ''));

export function AppDataProvider({ children }) {
  const [data, setData] = useState(emptyData);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshData = useCallback(async () => {
    const response = await fetch('/api/state', { credentials: 'same-origin', cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudieron consultar los datos de MySQL.');
    setData({ ...emptyData, ...result.data });
    return result.data;
  }, []);

  const acceptAuthenticatedUser = useCallback(async (profile) => {
    setCurrentUser(profile);
    setData(emptyData);
    await refreshData();
  }, [refreshData]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
        const result = await response.json();
        if (!active || !result.user) return;
        setCurrentUser(result.user);
        const stateResponse = await fetch('/api/state', { credentials: 'same-origin', cache: 'no-store' });
        const state = await stateResponse.json();
        if (!active) return;
        if (stateResponse.ok) setData({ ...emptyData, ...state.data });
        else setCurrentUser(null);
      } catch {
        if (active) setCurrentUser(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!currentUser) return undefined;
    const events = new EventSource('/api/events');
    events.addEventListener('change', () => { refreshData().catch(() => {}); });
    return () => events.close();
  }, [currentUser, refreshData]);

  const mutate = useCallback(async (path, body = {}, method = 'POST') => {
    try {
      const response = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) return { ok: false, message: result.error || 'No se pudo guardar en MySQL.' };
      await refreshData();
      return { ok: true, ...result };
    } catch {
      return { ok: false, message: 'No se pudo conectar con MySQL.' };
    }
  }, [refreshData]);

  const login = useCallback(async (identifier, password) => {
    try {
      const response = await fetch('/api/auth/credentials', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ identifier, password }),
      });
      const result = await response.json();
      if (!response.ok) return { ok: false, message: result.error || 'Credenciales incorrectas.' };
      await acceptAuthenticatedUser(result.user);
      return { ok: true, user: result.user };
    } catch {
      return { ok: false, message: 'No se pudo conectar con MySQL.' };
    }
  }, [acceptAuthenticatedUser]);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    setCurrentUser(null);
    setData(emptyData);
  }, []);

  const registerPatient = async (form, autoLogin = true) => {
    if (autoLogin) {
      try {
        const response = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(form) });
        const result = await response.json();
        if (!response.ok) return { ok: false, message: result.error || 'No se pudo registrar el paciente.' };
        await acceptAuthenticatedUser(result.user);
        return { ok: true, user: result.user };
      } catch { return { ok: false, message: 'No se pudo conectar con MySQL.' }; }
    }
    const result = await mutate('/api/admin/users', { ...form, role: 'patient' });
    return result.ok ? { ...result, username: form.username || form.document } : result;
  };

  const addDoctor = async (form) => {
    const result = await mutate('/api/admin/users', { ...form, role: 'doctor' });
    return result.ok ? { ...result, username: form.username || form.document } : result;
  };
  const addSecretary = async (form) => {
    const result = await mutate('/api/admin/users', { ...form, role: 'secretary' });
    return result.ok ? { ...result, username: form.username || form.document } : result;
  };
  const registerPatientBySecretary = async (form) => {
    const result = await mutate('/api/admin/users', { ...form, role: 'patient' });
    if (!result.ok) return result;
    const patient = data.patients.find((item) => item.document === form.document);
    return { ...result, patient: patient || { id: result.id, document: form.document, name: `${form.names} ${form.lastNames}`.trim() } };
  };

  const updateUserRole = (userId, role) => mutate(`/api/admin/users/${databaseId(userId)}/role`, { role }, 'PATCH');
  const updateDoctor = (doctorId, changes) => mutate(`/api/admin/users/${databaseId(doctorId)}`, changes, 'PATCH');
  const updateUserAddress = async (userId, addressParts) => {
    const address = formatColombianAddress(addressParts);
    if (!address) return { ok: false, message: 'Completa los componentes de la dirección.' };
    const result = await mutate('/api/auth/profile/address', { addressParts }, 'PATCH');
    if (result.ok && currentUser) setCurrentUser((previous) => ({ ...previous, address, addressParts }));
    return result.ok ? { ...result, address } : result;
  };
  const updateUserProfile = async (changes) => {
    const result = await mutate('/api/auth/profile', changes, 'PATCH');
    if (result.ok && result.user) setCurrentUser(result.user);
    return result;
  };

  const createAppointment = (form) => mutate('/api/appointments', { ...form, patientId: currentUser?.id });
  const createAppointmentForSecretary = (form) => mutate('/api/appointments', form);
  const rescheduleAppointment = (appointmentId, changes) => mutate(`/api/appointments/${appointmentId}`, changes, 'PATCH');
  const updateAppointment = (appointmentId, changes) => mutate(`/api/appointments/${appointmentId}`, changes, 'PATCH');
  const startAppointment = (appointmentId) => mutate(`/api/appointments/${appointmentId}`, { status: 'En curso' }, 'PATCH');
  const saveClinicalRecord = (form) => mutate('/api/clinical-records', form);
  const payDelivery = (deliveryId, payment) => mutate(`/api/deliveries/${deliveryId}/pay`, payment);
  const updateInventoryStock = (medicine, stock) => {
    const item = data.inventory.find((entry) => entry.medicine === medicine);
    return item ? mutate(`/api/admin/medications/${item.medicationId}/stock`, { stock }, 'PATCH') : Promise.resolve({ ok: false, message: 'Medicamento no encontrado en MySQL.' });
  };
  const addMedication = (name) => mutate('/api/admin/medications', { name });
  const updateDeliveryStatus = (deliveryId, status) => mutate(`/api/admin/deliveries/${deliveryId}/status`, { status }, 'PATCH');
  const createDelivery = async (form) => {
    const result = await mutate('/api/deliveries', { ...form, prescriptionIds: (form.items || []).map((item) => item.prescriptionId) });
    return result.ok ? { ...result, delivery: { id: result.id } } : result;
  };

  return (
    <AppDataContext.Provider value={{
      data, currentUser, loading, isAuthenticated: Boolean(currentUser), login, logout,
      acceptAuthenticatedUser, refreshData, registerPatient, updateUserAddress, updateUserProfile, addDoctor,
      addSecretary, updateUserRole, updateDoctor, createAppointment, createAppointmentForSecretary,
      rescheduleAppointment, registerPatientBySecretary, updateAppointment, startAppointment,
      saveClinicalRecord, createDelivery, payDelivery, updateInventoryStock, addMedication,
      updateDeliveryStatus, resetData: logout,
    }}>
      {children}
    </AppDataContext.Provider>
  );
}

export const useAppData = () => {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData debe usarse dentro de AppDataProvider');
  return context;
};
