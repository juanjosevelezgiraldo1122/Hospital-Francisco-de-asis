import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, LockKeyhole, Mail, MailCheck, ShieldCheck, UserPlus } from 'lucide-react';
import { useAppData } from '../store';

const emptyPatient = {
  typeId: 'CC', document: '', names: '', lastNames: '', email: '', phone: '',
  birthDate: '', eps: '', password: '', confirmPassword: '',
};

const emptySocialAccount = {
  username: '', typeId: 'CC', document: '', phone: '', password: '', confirmPassword: '',
};

const googleUsernameFromEmail = (email) => {
  const localPart = String(email || '').split('@')[0] || '';
  const normalized = localPart.toLowerCase().replace(/[^a-z0-9._-]/g, '_').replace(/^[._-]+|[._-]+$/g, '').slice(0, 32);
  return (normalized || 'usuario').padEnd(3, '_').slice(0, 32);
};

async function readResponse(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export default function Login() {
  const navigate = useNavigate();
  const { currentUser, acceptAuthenticatedUser } = useAppData();
  const [mode, setMode] = useState(() => new URLSearchParams(window.location.search).has('reset_token') ? 'reset' : 'login');
  const [access, setAccess] = useState({ identifier: '', password: '' });
  const [patient, setPatient] = useState(emptyPatient);
  const [socialAccount, setSocialAccount] = useState(emptySocialAccount);
  const [socialProfile, setSocialProfile] = useState(null);
  const [socialTicket, setSocialTicket] = useState('');
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get('reset_token') || '');
  const [resetEmail, setResetEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [resetPassword, setResetPassword] = useState({ password: '', confirmPassword: '' });
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaError, setCaptchaError] = useState('');
  const [providers, setProviders] = useState({ google: false, microsoft: false, credentials: false, databaseConfigured: false, passwordReset: false, smtpConfigured: false, captchaConfigured: false, turnstileSiteKey: '' });
  const [providersLoaded, setProvidersLoaded] = useState(false);
  const [message, setMessage] = useState(() => {
    const error = new URLSearchParams(window.location.search).get('oauth_error');
    if (!error) return '';
    return error === 'state'
      ? 'La verificación de seguridad venció o no coincide. Inicia el acceso nuevamente.'
      : 'No se pudo validar la cuenta con el proveedor. Intenta de nuevo.';
  });
  const [messageSuccess, setMessageSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const handledTicket = useRef('');
  const captchaContainer = useRef(null);
  const captchaWidget = useRef(null);

  useEffect(() => {
    fetch('/api/auth/providers')
      .then(readResponse)
      .then((result) => setProviders(result))
      .catch(() => setProviders({ google: false, microsoft: false, credentials: false, databaseConfigured: false, passwordReset: false, smtpConfigured: false, captchaConfigured: false, turnstileSiteKey: '' }))
      .finally(() => setProvidersLoaded(true));
  }, []);

  useEffect(() => {
    if (mode !== 'forgot' || !providers.turnstileSiteKey) return undefined;
    let cancelled = false;
    const renderWidget = () => {
      if (cancelled || !window.turnstile || !captchaContainer.current || captchaWidget.current !== null) return;
      captchaWidget.current = window.turnstile.render(captchaContainer.current, {
        sitekey: providers.turnstileSiteKey,
        theme: 'light',
        language: 'es',
        action: 'password_reset',
        callback: (token) => {
          setCaptchaToken(token);
          setCaptchaError('');
        },
        'expired-callback': () => setCaptchaToken(''),
        'error-callback': () => {
          setCaptchaToken('');
          setCaptchaError('No se pudo cargar la verificación. Intenta nuevamente.');
        },
      });
    };
    const handleScriptError = () => setCaptchaError('No se pudo cargar el CAPTCHA. Revisa tu conexión.');
    let script = document.getElementById('cloudflare-turnstile-script');
    if (window.turnstile) {
      renderWidget();
    } else {
      const appendScript = !script;
      if (!script) {
        script = document.createElement('script');
        script.id = 'cloudflare-turnstile-script';
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
      }
      script.addEventListener('load', renderWidget);
      script.addEventListener('error', handleScriptError);
      if (appendScript) document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      if (script) {
        script.removeEventListener('load', renderWidget);
        script.removeEventListener('error', handleScriptError);
      }
      if (captchaWidget.current !== null && window.turnstile) {
        window.turnstile.remove(captchaWidget.current);
        captchaWidget.current = null;
      }
    };
  }, [mode, providers.turnstileSiteKey]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('reset_token');
    if (!token) return;
    window.history.replaceState({}, '', '/login');
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('oauth_error');
    const ticket = params.get('oauth_ticket');
    if (oauthError) {
      window.history.replaceState({}, '', '/login');
      return;
    }
    if (!ticket || handledTicket.current === ticket) return;
    handledTicket.current = ticket;
    setBusy(true);
    fetch('/api/auth/oauth/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket }),
    })
      .then(async (response) => ({ response, body: await readResponse(response) }))
      .then(async ({ response, body }) => {
        if (!response.ok) throw new Error(body.error || 'No se pudo validar la identidad.');
        if (body.needsRegistration) {
          setSocialTicket(ticket);
          setSocialProfile(body.profile);
          if (body.profile?.provider === 'google') {
            setSocialAccount((current) => ({ ...current, username: body.profile.username || '' }));
          }
          setMode('socialSetup');
          window.history.replaceState({}, '', '/login');
          return;
        }
        const completion = await fetch('/api/auth/oauth/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticket }),
        });
        const completed = await readResponse(completion);
        if (!completion.ok) throw new Error(completed.error || 'No se pudo iniciar sesión.');
        acceptAuthenticatedUser(completed.user);
        window.history.replaceState({}, '', '/login');
        navigate(completed.user.role === 'secretary' ? '/secretaria' : '/', { replace: true });
      })
      .catch((error) => {
        setMessage(error.message || 'No se pudo validar la identidad.');
        window.history.replaceState({}, '', '/login');
      })
      .finally(() => setBusy(false));
  }, [acceptAuthenticatedUser, navigate]);

  if (currentUser) return <Navigate to={currentUser.role === 'secretary' ? '/secretaria' : '/'} replace />;

  const submitLogin = async (event) => {
    event.preventDefault();
    setMessage('');
    setBusy(true);
    try {
      const response = await fetch('/api/auth/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: access.identifier, password: access.password }),
      });
      const result = await readResponse(response);
      if (response.ok) {
        acceptAuthenticatedUser(result.user);
        navigate(result.user.role === 'secretary' ? '/secretaria' : '/', { replace: true });
        return;
      }
      setMessage(result.error || 'Credenciales incorrectas.');
    } catch {
      setMessage('No se pudo conectar con MySQL. Verifica el servicio e inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const submitForgotPassword = async (event) => {
    event.preventDefault();
    setMessage('');
    setMessageSuccess(false);
    if (!captchaToken) {
      setCaptchaError('Completa la verificación para continuar.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/auth/password/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, captchaToken }),
      });
      const result = await readResponse(response);
      if (!response.ok) throw new Error(result.error || 'No se pudo procesar la solicitud.');
      setForgotSent(true);
    } catch (error) {
      setMessage(error.message || 'No se pudo procesar la solicitud.');
    } finally {
      setBusy(false);
      if (captchaWidget.current !== null && window.turnstile) window.turnstile.reset(captchaWidget.current);
      setCaptchaToken('');
    }
  };

  const submitNewPassword = async (event) => {
    event.preventDefault();
    setMessage('');
    setMessageSuccess(false);
    if (resetPassword.password.length < 10 || resetPassword.password.length > 128) {
      setMessage('La contraseña debe tener entre 10 y 128 caracteres.');
      return;
    }
    if (resetPassword.password !== resetPassword.confirmPassword) {
      setMessage('La confirmación de contraseña no coincide.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, password: resetPassword.password }),
      });
      const result = await readResponse(response);
      if (!response.ok) throw new Error(result.error || 'No se pudo actualizar la contraseña.');
      setResetToken('');
      setResetPassword({ password: '', confirmPassword: '' });
      setMode('login');
      setMessage(result.message);
      setMessageSuccess(true);
    } catch (error) {
      setMessage(error.message || 'No se pudo actualizar la contraseña.');
    } finally {
      setBusy(false);
    }
  };

  const submitPatient = async (event) => {
    event.preventDefault();
    if (patient.password.length < 7 || patient.password.length > 20) {
      setMessage('La contraseña debe tener entre 7 y 20 caracteres.');
      return;
    }
    if (patient.password !== patient.confirmPassword) {
      setMessage('La confirmación de contraseña no coincide.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(patient) });
      const result = await readResponse(response);
      if (!response.ok) throw new Error(result.error || 'No se pudo crear la cuenta.');
      await acceptAuthenticatedUser(result.user);
      navigate('/');
    } catch (error) {
      setMessage(error.message || 'No se pudo crear la cuenta en MySQL.');
    } finally {
      setBusy(false);
    }
  };

  const submitSocialAccount = async (event) => {
    event.preventDefault();
    setMessage('');
    const username = socialProfile?.provider === 'google'
      ? (socialAccount.username || googleUsernameFromEmail(socialProfile.email))
      : socialAccount.username;
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
      setMessage('El usuario debe tener entre 3 y 32 caracteres: letras, números, punto, guion o guion bajo.');
      return;
    }
    if (socialAccount.password.length < 10 || socialAccount.password.length > 128) {
      setMessage('Crea una contraseña de al menos 10 caracteres.');
      return;
    }
    if (socialAccount.password !== socialAccount.confirmPassword) {
      setMessage('La confirmación de contraseña no coincide.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/auth/oauth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: socialTicket, ...socialAccount, username }),
      });
      const result = await readResponse(response);
      if (!response.ok) throw new Error(result.error || 'No se pudo completar el registro.');
      acceptAuthenticatedUser(result.user);
      navigate('/', { replace: true });
    } catch (error) {
      setMessage(error.message || 'No se pudo completar el registro.');
    } finally {
      setBusy(false);
    }
  };

  const setPatientValue = (field, value) => setPatient((current) => ({ ...current, [field]: value }));
  const setSocialValue = (field, value) => setSocialAccount((current) => ({ ...current, [field]: value }));
  const setModeValue = (nextMode) => {
    setMode(nextMode);
    setMessage('');
    setMessageSuccess(false);
    if (nextMode === 'forgot') setForgotSent(false);
    else {
      setCaptchaToken('');
      setCaptchaError('');
    }
  };

  const startProvider = async (provider) => {
    setMessage('');
    const available = providers[provider];
    if (available) {
      window.location.assign(`/api/auth/${provider}/start`);
      return;
    }
    setMessage(`${provider === 'google' ? 'Google' : 'Microsoft'} aún requiere configuración OAuth en el servidor.`);
  };

  const updateSocialAccount = (field, value) => setSocialValue(field, value);

  return (
    <main className="login-page">
      <section className="login-shell">
        <aside className="login-welcome">
          <img className="login-brand-logo" src="/hospital-francisco-de-asis-logo.png" alt="Hospital Francisco de Asís" />
          <span className="login-kicker">Salud · Humanidad · Servicio</span>
          <h1>Tu salud, en buenas manos.</h1>
          <p>Un espacio sencillo para gestionar tu atención, tus citas y el seguimiento de tus tratamientos.</p>
          <div className="login-trust"><ShieldCheck size={20} /><span>Atención conectada con el equipo del hospital</span></div>
        </aside>

        <section className="login-panel" aria-labelledby="login-title">
          <div className="login-panel-heading">
            <span className="eyebrow">Portal de servicios</span>
            <h2 id="login-title">{mode === 'socialSetup' ? 'Información adicional' : mode === 'forgot' ? 'Recupera tu acceso' : mode === 'reset' ? 'Crea una nueva contraseña' : mode === 'login' ? 'Bienvenido' : 'Crea tu cuenta'}</h2>
            <p>{mode === 'socialSetup'
              ? 'Tu identidad fue verificada. Crea las credenciales para tus próximos ingresos.'
              : mode === 'forgot'
                ? 'Te enviaremos un enlace seguro al correo asociado a tu cuenta.'
                : mode === 'reset'
                  ? 'Elige una contraseña segura para volver a ingresar.'
              : mode === 'login'
                ? 'Ingresa tus datos para continuar con tu atención.'
                : 'Regístrate para reservar citas y consultar tus servicios.'}</p>
          </div>

          {['login', 'patient'].includes(mode) ? (
            <div className="login-mode-switch" role="tablist" aria-label="Acceso al portal">
              <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => setModeValue('login')}>Iniciar sesión</button>
              <button type="button" role="tab" aria-selected={mode === 'patient'} className={mode === 'patient' ? 'active' : ''} onClick={() => setModeValue('patient')}>Registrarme</button>
            </div>
          ) : null}

          {message ? <p className={`form-message ${messageSuccess ? 'success' : 'error'}`} role={messageSuccess ? 'status' : 'alert'}>{message}</p> : null}

          {mode === 'login' ? (
            <>
              <div className="login-social-actions" aria-label="Iniciar sesión con otro proveedor">
                <button type="button" className="login-provider-button" onClick={() => startProvider('google')} disabled={busy}>
                  <span className="provider-google-mark" aria-hidden="true">G</span><span>Continuar con Google</span>
                </button>
                <button type="button" className="login-provider-button" onClick={() => startProvider('microsoft')} disabled={busy}>
                  <span className="provider-microsoft-mark" aria-hidden="true"><i /><i /><i /><i /></span><span>Continuar con Microsoft</span>
                </button>
              </div>
              <div className="login-divider"><span>o ingresa con tus credenciales</span></div>
              <form className="login-form" onSubmit={submitLogin}>
                <label>Usuario, documento o correo<input autoComplete="username" value={access.identifier} onChange={(event) => setAccess((current) => ({ ...current, identifier: event.target.value }))} required /></label>
                <label>Contraseña<input type="password" autoComplete="current-password" value={access.password} onChange={(event) => setAccess((current) => ({ ...current, password: event.target.value }))} required /></label>
                <button type="button" className="login-text-link" onClick={() => setModeValue('forgot')}>Olvidé mi contraseña</button>
                <button className="btn btn-primary full login-submit" type="submit" disabled={busy}>
                  <LockKeyhole size={18} /> {busy ? 'Verificando…' : 'Ingresar'} <ArrowRight size={17} />
                </button>
                <p className="login-assurance"><ShieldCheck size={16} /> Tu contraseña se valida de forma segura en el servidor.</p>
              </form>
            </>
          ) : mode === 'forgot' ? (
            <section className="password-recovery" aria-live="polite">
              {forgotSent ? (
                <div className="password-recovery-result">
                  <span className="password-recovery-icon"><MailCheck size={25} /></span>
                  <h3>Solicitud recibida</h3>
                  <p>Si existe una cuenta activa vinculada a ese correo, recibirás allí un enlace seguro. Revisa también la carpeta de correo no deseado.</p>
                  <button type="button" className="login-text-link login-back-link" onClick={() => setModeValue('login')}><ArrowLeft size={16} /> Volver al inicio de sesión</button>
                </div>
              ) : (
                <>
                  <div className="password-recovery-intro">
                    <span className="password-recovery-icon"><Mail size={23} /></span>
                    <p>Escribe únicamente el correo que está asociado a tu cuenta del hospital.</p>
                  </div>
                  {providersLoaded && !providers.passwordReset ? (
                    <div className="password-recovery-config" role="status">
                      <ShieldCheck size={18} />
                      <span>{!providers.databaseConfigured ? 'La base de datos del servidor no está disponible.' : `La recuperación aún no está habilitada. Falta configurar${!providers.smtpConfigured && !providers.captchaConfigured ? ' el correo SMTP y Cloudflare Turnstile' : !providers.smtpConfigured ? ' el correo SMTP' : ' Cloudflare Turnstile'} en el servidor.`}</span>
                    </div>
                  ) : null}
                  <form className="login-form" onSubmit={submitForgotPassword}>
                    <label>Correo electrónico registrado<input type="email" autoComplete="email" value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} placeholder="nombre@correo.com" required /></label>
                    {providers.turnstileSiteKey ? <div ref={captchaContainer} className="password-recovery-captcha" aria-label="Verificación CAPTCHA" /> : null}
                    {captchaError ? <p className="password-recovery-captcha-error" role="alert">{captchaError}</p> : null}
                    <button className="btn btn-primary full login-submit" type="submit" disabled={busy || (providersLoaded && (!providers.passwordReset || !captchaToken))}><Mail size={18} /> {busy ? 'Enviando…' : 'Enviar enlace seguro'} <ArrowRight size={17} /></button>
                    <button type="button" className="login-text-link login-back-link" onClick={() => setModeValue('login')}><ArrowLeft size={16} /> Volver al inicio de sesión</button>
                  </form>
                </>
              )}
            </section>
          ) : mode === 'reset' ? (
            <form className="login-form" onSubmit={submitNewPassword}>
              <label>Nueva contraseña<input type="password" autoComplete="new-password" minLength={10} maxLength={128} value={resetPassword.password} onChange={(event) => setResetPassword((current) => ({ ...current, password: event.target.value }))} required /></label>
              <label>Confirmar contraseña<input type="password" autoComplete="new-password" minLength={10} maxLength={128} value={resetPassword.confirmPassword} onChange={(event) => setResetPassword((current) => ({ ...current, confirmPassword: event.target.value }))} required /></label>
              <button className="btn btn-primary full login-submit" type="submit" disabled={busy}><LockKeyhole size={18} /> {busy ? 'Actualizando…' : 'Guardar nueva contraseña'} <ArrowRight size={17} /></button>
            </form>
          ) : mode === 'socialSetup' ? (
            <form className="login-form login-social-register-form" onSubmit={submitSocialAccount}>
              <div className="verified-identity">
                <span className="verified-identity-mark"><ShieldCheck size={18} /></span>
                <div><strong>{socialProfile?.name}</strong><span>{socialProfile?.email} · {socialProfile?.provider === 'google' ? 'Google verificado' : 'Microsoft verificado'}</span></div>
              </div>
              <label>Usuario<input autoComplete="username" minLength={3} maxLength={32} value={socialProfile?.provider === 'google' ? (socialAccount.username || googleUsernameFromEmail(socialProfile.email)) : socialAccount.username} onChange={(event) => updateSocialAccount('username', event.target.value)} readOnly={socialProfile?.provider === 'google'} aria-readonly={socialProfile?.provider === 'google'} required /></label>
              <div className="form-grid two">
                <label>Tipo de identificación<select value={socialAccount.typeId} onChange={(event) => updateSocialAccount('typeId', event.target.value)}><option value="CC">Cédula de ciudadanía</option><option value="TI">Tarjeta de identidad</option><option value="CE">Cédula de extranjería</option><option value="PA">Pasaporte</option><option value="PEP">PEP</option></select></label>
                <label>Número<input autoComplete="off" value={socialAccount.document} onChange={(event) => updateSocialAccount('document', event.target.value)} required /></label>
              </div>
              <label>Teléfono de contacto<input type="tel" autoComplete="tel" value={socialAccount.phone} onChange={(event) => updateSocialAccount('phone', event.target.value)} required /></label>
              <div className="form-grid two">
                <label>Contraseña<input type="password" autoComplete="new-password" minLength={10} maxLength={128} value={socialAccount.password} onChange={(event) => updateSocialAccount('password', event.target.value)} required /></label>
                <label>Confirmar contraseña<input type="password" autoComplete="new-password" minLength={10} maxLength={128} value={socialAccount.confirmPassword} onChange={(event) => updateSocialAccount('confirmPassword', event.target.value)} required /></label>
              </div>
              <button className="btn btn-primary full login-submit" type="submit" disabled={busy}><UserPlus size={18} /> {busy ? 'Creando cuenta…' : 'Crear acceso seguro'} <ArrowRight size={17} /></button>
              <p className="login-assurance"><ShieldCheck size={16} /> Tu clave se guarda protegida y no se comparte con {socialProfile?.provider === 'google' ? 'Google' : 'Microsoft'}.</p>
            </form>
          ) : (
            <form className="login-form login-register-form" onSubmit={submitPatient}>
              <div className="form-grid two">
                <label>Tipo de documento<select value={patient.typeId} onChange={(event) => setPatientValue('typeId', event.target.value)}><option>CC</option><option>TI</option><option>CE</option></select></label>
                <label>Documento<input autoComplete="off" value={patient.document} onChange={(event) => setPatientValue('document', event.target.value)} required /></label>
              </div>
              <div className="form-grid two">
                <label>Nombres<input autoComplete="given-name" value={patient.names} onChange={(event) => setPatientValue('names', event.target.value)} required /></label>
                <label>Apellidos<input autoComplete="family-name" value={patient.lastNames} onChange={(event) => setPatientValue('lastNames', event.target.value)} required /></label>
              </div>
              <label>Correo<input type="email" autoComplete="email" value={patient.email} onChange={(event) => setPatientValue('email', event.target.value)} required /></label>
              <div className="form-grid two">
                <label>Teléfono<input type="tel" autoComplete="tel" value={patient.phone} onChange={(event) => setPatientValue('phone', event.target.value)} required /></label>
                <label>EPS<input value={patient.eps} onChange={(event) => setPatientValue('eps', event.target.value)} required /></label>
              </div>
              <label>Fecha de nacimiento<input type="date" value={patient.birthDate} onChange={(event) => setPatientValue('birthDate', event.target.value)} required /></label>
              <div className="form-grid two">
                <label>Contraseña<input type="password" autoComplete="new-password" minLength={7} maxLength={20} value={patient.password} onChange={(event) => setPatientValue('password', event.target.value)} required /></label>
                <label>Confirmar contraseña<input type="password" autoComplete="new-password" minLength={7} maxLength={20} value={patient.confirmPassword} onChange={(event) => setPatientValue('confirmPassword', event.target.value)} required /></label>
              </div>
              <button className="btn btn-primary full login-submit" type="submit"><UserPlus size={18} /> Crear cuenta <ArrowRight size={17} /></button>
            </form>
          )}
        </section>
      </section>
    </main>
  );
}
