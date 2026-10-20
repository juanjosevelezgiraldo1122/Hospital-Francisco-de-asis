import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Boxes,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileClock,
  FileHeart,
  HeartHandshake,
  History,
  PackageCheck,
  Pill,
  SearchCheck,
  ShieldCheck,
  Stethoscope,
  UserRound,
  UserPlus,
  UserCheck,
  UsersRound,
} from 'lucide-react';
import { useAppData } from '../store';

const roleCopy = {
  admin: 'Administra el equipo, las existencias y la operación del hospital.',
  doctor: 'Consulta tu agenda, acompaña a tus pacientes y registra cada atención.',
  patient: 'Encuentra tus citas, tratamientos y solicitudes desde un solo lugar.',
  secretary: 'Gestiona la agenda y acompaña a cada paciente durante su atención.',
};

const shortcutsByRole = {
  admin: [
    { to: '/administracion#admin-users', icon: UsersRound, title: 'Equipo y permisos', text: 'Gestiona el acceso del personal y los pacientes.' },
    { to: '/secretaria', icon: CalendarDays, title: 'Agenda de citas', text: 'Revisa reservas y disponibilidad.' },
    { to: '/dashboard', icon: ClipboardList, title: 'Resumen de actividad', text: 'Consulta el panorama general del hospital.' },
  ],
  doctor: [
    { to: '/doctores', icon: Stethoscope, title: 'Mi agenda', text: 'Citas y pacientes de la jornada.' },
    { to: '/historia-clinica', icon: FileHeart, title: 'Historias clínicas', text: 'Consulta los registros médicos.' },
    { to: '/medicamentos', icon: Pill, title: 'Tratamientos', text: 'Revisa medicamentos prescritos.' },
  ],
  patient: [
    { to: '/citas', icon: CalendarDays, title: 'Solicitar una cita', text: 'Encuentra disponibilidad y reserva.' },
    { to: '/medicamentos', icon: Pill, title: 'Mis medicamentos', text: 'Consulta tus fórmulas y domicilios.' },
    { to: '/dashboard', icon: PackageCheck, title: 'Mis solicitudes', text: 'Revisa el estado de tus pedidos.' },
  ],
  secretary: [
    { to: '/secretaria', icon: CalendarDays, title: 'Agenda de citas', text: 'Consulta la operación diaria de recepción.' },
    { to: '/secretaria?accion=registrar-paciente', icon: UserPlus, title: 'Registrar paciente', text: 'Abre una ficha desde recepción.' },
    { to: '/secretaria?accion=nueva-cita', icon: CalendarDays, title: 'Nueva cita', text: 'Abre la reserva asistida desde recepción.' },
  ],
};

const relatedLinksByRole = {
  admin: [
    { to: '/panel-medicamentos#admin-stock', icon: Boxes, title: 'Panel medicamentos', text: 'Gestiona el catalogo y las existencias.' },
    { to: '/panel-medicamentos#medication-orders', icon: PackageCheck, title: 'Pedidos de farmacia', text: 'Consulta datos de entrega y actualiza su estado.' },
    { to: '/administracion#admin-audit', icon: FileClock, title: 'Trazabilidad', text: 'Revisa los cambios recientes del sistema.' },
  ],
  doctor: [
    { to: '/pacientes', icon: UsersRound, title: 'Directorio de pacientes', text: 'Consulta las fichas disponibles para atención.' },
    { to: '/perfil#profile-personal', icon: UserRound, title: 'Perfil profesional', text: 'Revisa tus datos y sede asignada.' },
    { to: '/historia-clinica#recent-history', icon: History, title: 'Registros recientes', text: 'Abre los dos historiales más recientes.' },
  ],
  patient: [
    { to: '/perfil#profile-personal', icon: UserRound, title: 'Mis datos personales', text: 'Consulta tu información de contacto registrada.' },
    { to: '/citas#appointments-list', icon: CalendarDays, title: 'Citas reservadas', text: 'Revisa fechas, profesionales y sedes.' },
    { to: '/citas#appointment-summary', icon: ClipboardList, title: 'Antes de tu consulta', text: 'Consulta los datos que debes confirmar al reservar.' },
  ],
  secretary: [
    { to: '/secretaria#reservations', icon: SearchCheck, title: 'Reservas de citas', text: 'Consulta cambios y estados de la agenda.' },
    { to: '/secretaria#secretary-kpis', icon: ClipboardList, title: 'Resumen de hoy', text: 'Revisa pendientes y citas en curso.' },
    { to: '/secretaria#secretary-patients', icon: UserCheck, title: 'Pacientes disponibles', text: 'Abre fichas completas desde recepción.' },
  ],
};

const informationSlides = [
  {
    image: '/home-carousel/atencion-integral.png',
    imageAlt: 'Personal asistencial trasladando a un paciente por un corredor hospitalario',
    eyebrow: 'Atención integral',
    title: 'Cuidado que acompaña cada etapa',
    text: 'La coordinación entre servicios ayuda a dar continuidad desde el ingreso hasta el seguimiento de cada paciente.',
  },
  {
    image: '/home-carousel/equipo-asistencial.png',
    imageAlt: 'Equipo de profesionales de salud caminando por un pasillo clinico',
    eyebrow: 'Equipo asistencial',
    title: 'Personas trabajando por tu bienestar',
    text: 'La atencion se construye con escucha, trabajo en equipo e informacion clara para cada persona.',
  },
  {
    image: '/home-carousel/investigacion-clinica.png',
    imageAlt: 'Profesionales de laboratorio colaborando en un espacio de analisis clinico',
    eyebrow: 'Conocimiento clínico',
    title: 'Cada detalle aporta a una mejor atención',
    text: 'La observación cuidadosa y el análisis responsable de la información orientan decisiones oportunas.',
  },
  {
    image: '/home-carousel/farmacia.png',
    imageAlt: 'Profesional de farmacia organizando medicamentos',
    eyebrow: 'Farmacia y tratamientos',
    title: 'Acompañamiento para continuar tu tratamiento',
    text: 'Consulta las formulas registradas y revisa en el portal el estado de tus solicitudes de medicamentos.',
  },
  {
    image: '/home-carousel/infraestructura.png',
    imageAlt: 'Edificio de una institucion hospitalaria',
    eyebrow: 'Nuestro hospital',
    title: 'Un espacio para cuidar y servir',
    text: 'Conoce los servicios, los equipos y la atencion disponibles desde los accesos de tu perfil.',
  },
];

const heroVideoUrl = 'https://d8j0ntlcm91z4.cloudfront.net/user_3K5kSdIFzHH8pXqPmBa9yAIvE4k/hf_20261001_115030_d0e40a7c-ce4a-4a53-b9f8-9245bca473d9.mp4';

export default function Home() {
  const { currentUser } = useAppData();
  return currentUser ? <AuthenticatedHome /> : <PublicHome />;
}

function PublicHome() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const slide = informationSlides[activeSlide];

  useEffect(() => {
    if (carouselPaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const interval = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % informationSlides.length);
    }, 6500);
    return () => window.clearInterval(interval);
  }, [carouselPaused]);

  const showSlide = (direction) => {
    setActiveSlide((current) => (current + direction + informationSlides.length) % informationSlides.length);
  };

  return (
    <section className="home-portal home-public">
      <header className="hospital-hero home-public-hero">
        <video className="hero-video" autoPlay muted loop playsInline preload="metadata" poster="/home-carousel/infraestructura.png" aria-hidden="true">
          <source src={heroVideoUrl} type="video/mp4" />
        </video>
        <div className="hero-video-overlay" aria-hidden="true" />
        <div className="home-public-hero-content">
          <span className="home-public-eyebrow"><HeartHandshake size={17} /> Salud · Humanidad · Servicio</span>
          <h1>Una atención cercana, también desde aquí.</h1>
          <p>Conoce los servicios del Hospital Francisco de Asís y gestiona tu atención desde un portal sencillo y seguro.</p>
          <div className="home-public-actions">
            <Link to="/citas" className="home-public-primary"><CalendarDays size={18} /> Solicitar una cita</Link>
            <Link to="/login" className="home-public-secondary">Entrar al portal <ArrowUpRight size={17} /></Link>
          </div>
          <span className="home-public-secure"><ShieldCheck size={15} /> Tus gestiones personales requieren iniciar sesión.</span>
        </div>
        <div className="home-public-scroll" aria-hidden="true"><span /> Descubre el portal</div>
      </header>

      <div className="page-content home-public-content">
        <section className="home-public-services" id="servicios" aria-labelledby="public-services-title">
          <header className="home-public-section-heading">
            <div>
              <span className="eyebrow">Servicios digitales</span>
              <h2 id="public-services-title">Tu atención, más cerca</h2>
            </div>
            <p>Explora los servicios disponibles. Para iniciar una gestión, ingresa a tu cuenta o crea una.</p>
          </header>
          <div className="home-public-service-grid">
            <Link to="/citas" className="home-public-service">
              <img src="/home-carousel/atencion-integral.png" alt="Equipo asistencial acompañando a un paciente" />
              <span className="home-public-service-content">
                <span className="home-public-service-icon"><CalendarDays size={20} /></span>
                <strong>Citas médicas</strong>
                <span>Consulta disponibilidad y solicita una cita con el equipo asistencial.</span>
                <span className="home-public-service-action">Acceder al servicio <ArrowUpRight size={16} /></span>
              </span>
            </Link>
            <Link to="/medicamentos" className="home-public-service">
              <img src="/home-carousel/farmacia.png" alt="Profesional de farmacia organizando medicamentos" />
              <span className="home-public-service-content">
                <span className="home-public-service-icon"><Pill size={20} /></span>
                <strong>Medicamentos</strong>
                <span>Revisa las prescripciones y gestiona solicitudes de domicilio.</span>
                <span className="home-public-service-action">Acceder al servicio <ArrowUpRight size={16} /></span>
              </span>
            </Link>
            <Link to="/mis-documentos" className="home-public-service">
              <img src="/home-carousel/investigacion-clinica.png" alt="Profesionales revisando información clínica" />
              <span className="home-public-service-content">
                <span className="home-public-service-icon"><FileHeart size={20} /></span>
                <strong>Mis documentos</strong>
                <span>Consulta y genera documentos relacionados con tu atención.</span>
                <span className="home-public-service-action">Acceder al servicio <ArrowUpRight size={16} /></span>
              </span>
            </Link>
          </div>
        </section>

        <section
          className="home-information-carousel home-public-carousel"
          id="atencion"
          aria-label="Conoce el hospital"
          aria-roledescription="carrusel"
          onPointerEnter={() => setCarouselPaused(true)}
          onPointerLeave={() => setCarouselPaused(false)}
          onFocusCapture={() => setCarouselPaused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setCarouselPaused(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') { event.preventDefault(); showSlide(1); }
            if (event.key === 'ArrowLeft') { event.preventDefault(); showSlide(-1); }
          }}
        >
          <img className="home-information-image" key={slide.image} src={slide.image} alt={slide.imageAlt} />
          <div className="home-information-overlay" aria-hidden="true" />
          <div className="home-information-copy" aria-live={carouselPaused ? 'polite' : 'off'}>
            <span className="eyebrow">{slide.eyebrow}</span>
            <h2>{slide.title}</h2>
            <p>{slide.text}</p>
          </div>
          <button type="button" className="home-carousel-arrow previous" aria-label="Información anterior" onClick={() => showSlide(-1)}><ChevronLeft size={23} /></button>
          <button type="button" className="home-carousel-arrow next" aria-label="Siguiente información" onClick={() => showSlide(1)}><ChevronRight size={23} /></button>
          <div className="home-carousel-indicators" role="group" aria-label="Seleccionar información">
            {informationSlides.map((item, index) => (
              <button key={item.eyebrow} type="button" className={index === activeSlide ? 'active' : ''} aria-label={`Mostrar información ${index + 1}: ${item.eyebrow}`} onClick={() => setActiveSlide(index)} />
            ))}
          </div>
        </section>

        <section className="home-public-access" id="farmacia" aria-labelledby="public-access-title">
          <div className="home-public-access-heading">
            <span className="eyebrow">Un portal pensado para acompañarte</span>
            <h2 id="public-access-title">Empieza por lo que necesitas</h2>
          </div>
          <div className="home-public-steps">
            <article><span>01</span><div><strong>Explora</strong><p>Conoce los servicios y elige la gestión que necesitas.</p></div></article>
            <article><span>02</span><div><strong>Identifícate</strong><p>Inicia sesión para proteger tu información personal.</p></div></article>
            <article><span>03</span><div><strong>Continúa</strong><p>Completa tu solicitud y consulta su estado desde tu cuenta.</p></div></article>
          </div>
          <Link to="/login" className="home-public-access-link">Ingresar o crear una cuenta <ArrowUpRight size={17} /></Link>
        </section>
      </div>
    </section>
  );
}

function AuthenticatedHome() {
  const { currentUser } = useAppData();
  const [activeSlide, setActiveSlide] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const shortcuts = shortcutsByRole[currentUser.role] || shortcutsByRole.patient;
  const relatedLinks = relatedLinksByRole[currentUser.role] || relatedLinksByRole.patient;
  const slide = informationSlides[activeSlide];

  useEffect(() => {
    if (carouselPaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const interval = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % informationSlides.length);
    }, 6500);
    return () => window.clearInterval(interval);
  }, [carouselPaused]);

  const showSlide = (direction) => {
    setActiveSlide((current) => (current + direction + informationSlides.length) % informationSlides.length);
  };

  return (
    <section className="home-portal">
      <header className="hospital-hero home-hero-compact">
        <video className="hero-video" autoPlay muted loop playsInline preload="metadata" poster="/hospital-hero.svg" aria-hidden="true">
          <source src={heroVideoUrl} type="video/mp4" />
        </video>
        <div className="hero-video-overlay" aria-hidden="true" />
        <div className="home-hero-content">
          <span className="eyebrow">Hospital Francisco de Asís · Salud, humanidad y servicio</span>
          <h1>Te acompañamos en cada paso de tu atención</h1>
          <p>{roleCopy[currentUser.role]}</p>
        </div>
        <aside className="home-session">
          <ShieldCheck size={22} />
          <span>Bienvenido</span>
          <strong>{currentUser.name}</strong>
        </aside>
      </header>

      <div className="page-content home-portal-content">
        <section className="home-services" aria-labelledby="services-title">
          <div className="home-section-heading">
            <div>
              <span className="eyebrow">Accesos directos</span>
              <h2 id="services-title">Servicios a un clic</h2>
            </div>
            <span>Tu espacio de atención, organizado para ti</span>
          </div>
          <div className="home-service-grid">
            {shortcuts.map((item, index) => (
              <Link to={item.to} className="home-service" key={item.title}>
                <span className="home-service-top">
                  <span className="home-service-icon"><item.icon size={23} /></span>
                  <span className="home-service-index">0{index + 1}</span>
                </span>
                <span className="home-service-copy"><strong>{item.title}</strong><span>{item.text}</span></span>
                <span className="home-service-action">Abrir servicio <ArrowUpRight size={17} /></span>
              </Link>
            ))}
          </div>
        </section>

        <section
          className="home-information-carousel"
          aria-label="Informacion del hospital"
          aria-roledescription="carrusel"
          onPointerEnter={() => setCarouselPaused(true)}
          onPointerLeave={() => setCarouselPaused(false)}
          onFocusCapture={() => setCarouselPaused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setCarouselPaused(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') {
              event.preventDefault();
              showSlide(1);
            }
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              showSlide(-1);
            }
          }}
        >
          <img className="home-information-image" key={slide.image} src={slide.image} alt={slide.imageAlt} />
          <div className="home-information-overlay" aria-hidden="true" />
          <div className="home-information-copy" aria-live={carouselPaused ? 'polite' : 'off'}>
            <span className="eyebrow">{slide.eyebrow}</span>
            <h2>{slide.title}</h2>
            <p>{slide.text}</p>
          </div>
          <button type="button" className="home-carousel-arrow previous" aria-label="Información anterior" onClick={() => showSlide(-1)}>
            <ChevronLeft size={23} />
          </button>
          <button type="button" className="home-carousel-arrow next" aria-label="Siguiente información" onClick={() => showSlide(1)}>
            <ChevronRight size={23} />
          </button>
          <div className="home-carousel-indicators" role="group" aria-label="Seleccionar información">
            {informationSlides.map((item, index) => (
              <button
                key={item.eyebrow}
                type="button"
                className={index === activeSlide ? 'active' : ''}
                aria-label={`Mostrar informacion ${index + 1}: ${item.eyebrow}`}
                onClick={() => setActiveSlide(index)}
              />
            ))}
          </div>
        </section>

        <section className="home-care-band">
          <div className="home-care-icon"><HeartHandshake size={26} /></div>
          <div>
            <span className="eyebrow">Atención conectada</span>
            <h2>Información clara, en el momento que la necesitas</h2>
            <p>Las citas, las historias clínicas, los tratamientos y los domicilios se actualizan desde sus módulos correspondientes.</p>
          </div>
          <Link to={currentUser.role === 'admin' ? '/administracion' : currentUser.role === 'doctor' ? '/historia-clinica' : currentUser.role === 'secretary' ? '/secretaria' : '/dashboard'} className="home-care-link">
            Ver mi espacio <span aria-hidden="true">→</span>
          </Link>
        </section>

        <section className="home-visit-section" aria-labelledby="home-visit-title">
          <header className="home-visit-heading">
            <span className="eyebrow">Gestiones relacionadas</span>
            <h2 id="home-visit-title">Continúa tu atención</h2>
          </header>
          <div className="home-visit-band">
            {relatedLinks.map((item) => (
              <Link to={item.to} className="home-visit-link" key={item.title}>
                <span className="home-visit-icon"><item.icon size={34} strokeWidth={2.2} /></span>
                <strong>{item.title}</strong>
                <span className="home-visit-description">{item.text}</span>
                <span className="home-visit-action">Visitar <ArrowUpRight size={17} /></span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
