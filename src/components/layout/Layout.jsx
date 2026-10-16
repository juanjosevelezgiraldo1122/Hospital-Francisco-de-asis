import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Calendar,
  ClipboardCheck,
  FileText,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Pill,
  Files,
  Stethoscope,
  UserCircle,
  UserCog,
  X,
} from 'lucide-react';
import { useAppData } from '../../store';
import HospitalAssistant from '../HospitalAssistant';

const navItems = [
  { path: '/', icon: Home, label: 'Home', roles: ['admin', 'doctor', 'patient'] },
  { path: '/dashboard', icon: LayoutDashboard, label: 'Panel', roles: ['admin', 'patient'] },
  { path: '/doctores', icon: Stethoscope, label: 'Panel medico', roles: ['doctor'] },
  { path: '/citas', icon: Calendar, label: 'Citas', roles: ['patient'] },
  { path: '/mis-documentos', icon: Files, label: 'Mis documentos', roles: ['patient'] },
  { path: '/historia-clinica', icon: FileText, label: 'Historial', roles: ['doctor'] },
  { path: '/medicamentos', icon: Pill, label: 'Medicamentos', roles: ['doctor', 'patient'] },
  { path: '/panel-medicamentos', icon: Pill, label: 'Panel medicamentos', roles: ['admin'] },
  { path: '/secretaria', icon: ClipboardCheck, label: 'Panel secretaria', roles: ['admin', 'secretary'] },
  { path: '/administracion', icon: UserCog, label: 'Panel admin', roles: ['admin'] },
  { path: '/perfil', icon: UserCircle, label: 'Perfil', roles: ['admin', 'doctor', 'patient', 'secretary'] },
];

const roleLabel = {
  admin: 'Administrador',
  doctor: 'Medico',
  patient: 'Paciente',
  secretary: 'Secretaria',
};

export const Navbar = () => {
  const { currentUser, logout } = useAppData();
  const navigate = useNavigate();
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const visibleItems = navItems.filter((item) => item.roles.includes(currentUser.role));

  return (
    <nav className={`navbar sidebar-nav${isSidebarPinned ? ' is-pinned' : ''}`}>
      <div className="navbar-container">
        <div className="sidebar-top">
          <Link to="/" className="navbar-brand">
            <img className="brand-logo" src="/hospital-francisco-de-asis-logo.png" alt="" />
            <span className="brand-text">Hospital Francisco de Asís</span>
          </Link>
          <button
            type="button"
            className="sidebar-toggle"
            aria-label={isSidebarPinned ? 'Contraer navegacion' : 'Mantener navegacion abierta'}
            aria-expanded={isSidebarPinned}
            onClick={(event) => {
              setIsSidebarPinned((isOpen) => !isOpen);
              if (isSidebarPinned) event.currentTarget.blur();
            }}
            title={isSidebarPinned ? 'Contraer navegacion' : 'Mantener navegacion abierta'}
          >
            {isSidebarPinned ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <div className="navbar-center">
          <ul className="nav-menu">
            {visibleItems.map((item) => (
              <li key={item.path} className="nav-item">
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                  onClick={(event) => {
                    setIsSidebarPinned(false);
                    event.currentTarget.blur();
                  }}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        <div className="navbar-right">
          <div className="user-menu">
            <Link to="/perfil" className="user-info">
              <UserCircle size={28} />
              <div className="user-details">
                <span className="user-name">{currentUser.name}</span>
                <span className="user-role">{roleLabel[currentUser.role]}</span>
              </div>
            </Link>
            <button
              type="button"
              className="sidebar-logout"
              aria-label="Cerrar sesion"
              title="Cerrar sesion"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              <LogOut size={19} />
              <span>Cerrar sesion</span>
            </button>
          </div>
        </div>

        <button
          type="button"
          className="mobile-menu-btn"
          aria-label="Abrir navegacion"
          onClick={() => setIsSidebarPinned(true)}
        >
          <Menu size={28} />
        </button>
      </div>
    </nav>
  );
};

const RouteHashScroller = () => {
  const { hash, pathname } = useLocation();

  useEffect(() => {
    if (!hash) return undefined;
    const targetId = decodeURIComponent(hash.slice(1));
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hash, pathname]);

  return null;
};

export const Footer = () => (
  <footer className="footer">
    <div className="footer-content">
      <span>Hospital Francisco de Asís - datos creados en la pagina y guardados localmente.</span>
      <span>Salud, humanidad y servicio - agenda, historia clinica y tratamiento.</span>
    </div>
  </footer>
);

export const Layout = () => (
  <div className="app-shell">
    <RouteHashScroller />
    <Navbar />
    <main className="main-content">
      <Outlet />
    </main>
    <HospitalAssistant />
    <Footer />
  </div>
);
