import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/comoon/ProtectedRoute';
import { Layout } from './components/layout/Layout';
import { AppDataProvider } from './store';
import Administracion from './pages/Administracion';
import Citas from './pages/Citas';
import Dashboard from './pages/Dashboard';
import Doctores from './pages/Doctores';
import HistoriaClinica from './pages/HistoriaClinica';
import Home from './pages/Home';
import Login from './pages/Login';
import Medicamentos from './pages/Medicamentos';
import MisDocumentos from './pages/MisDocumentos';
import PanelMedicamentos from './pages/PanelMedicamentos';
import PasarelaPago from './pages/PasarelaPago';
import Perfil from './pages/Perfil';
import Secretaria from './pages/Secretaria';

function App() {
  return (
    <AppDataProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="dashboard" element={<ProtectedRoute allowedRoles={['admin', 'patient']} />}>
              <Route index element={<Dashboard />} />
            </Route>
            <Route path="citas" element={<ProtectedRoute allowedRoles={['patient']} />}>
              <Route index element={<Citas />} />
            </Route>
            <Route path="mis-documentos" element={<ProtectedRoute allowedRoles={['patient']} />}>
              <Route index element={<MisDocumentos />} />
            </Route>
            <Route path="medicamentos" element={<ProtectedRoute allowedRoles={['patient', 'doctor']} />}>
              <Route index element={<Medicamentos />} />
            </Route>
            <Route path="panel-medicamentos" element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route index element={<PanelMedicamentos />} />
            </Route>
            <Route path="pago/:deliveryId" element={<ProtectedRoute allowedRoles={['patient']} />}>
              <Route index element={<PasarelaPago />} />
            </Route>
            <Route path="doctores" element={<ProtectedRoute allowedRoles={['doctor']} />}>
              <Route index element={<Doctores />} />
            </Route>
            <Route path="pacientes" element={<ProtectedRoute allowedRoles={['doctor']} />}>
              <Route index element={<Navigate to="/doctores" replace />} />
            </Route>
            <Route path="historia-clinica" element={<ProtectedRoute allowedRoles={['doctor']} />}>
              <Route index element={<HistoriaClinica />} />
            </Route>
            <Route path="secretaria" element={<ProtectedRoute allowedRoles={['admin', 'secretary']} />}>
              <Route index element={<Secretaria />} />
            </Route>
            <Route path="administracion" element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route index element={<Administracion />} />
            </Route>
            <Route path="perfil" element={<ProtectedRoute />}>
              <Route index element={<Perfil />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </AppDataProvider>
  );
}

export default App;
