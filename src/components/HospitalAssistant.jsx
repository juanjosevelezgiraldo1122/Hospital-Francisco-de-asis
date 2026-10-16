import { useEffect, useRef, useState } from 'react';
import { Bot, CalendarDays, CircleHelp, MessageCircle, Pill, Send, ShieldCheck, Sparkles, X } from 'lucide-react';
import { getLocalAssistantAnswer } from '../assistantLogic';
import { useAppData } from '../store';

const welcomeMessage = {
  role: 'assistant',
  content: 'Hola. Puedo orientarte sobre citas, medicamentos y servicios. Las fechas de tus citas y el estado de tus pedidos se consultan en esta sesion sin enviarlos a Gemini.',
  sentToAI: false,
};

const promptsByRole = {
  patient: ['¿Cuándo es mi próxima cita?', '¿Cómo pido una cita?', '¿Cómo solicito medicamentos?', '¿Cómo va mi pedido?'],
  doctor: ['¿Cuáles son mis próximas citas?', '¿Cómo registro una prescripción?', '¿Qué sedes hay?'],
  secretary: ['¿Cuántas reservas pendientes hay hoy?', '¿Cómo creo una cita?', '¿Qué sedes hay?'],
  admin: ['¿Dónde actualizo el stock?', '¿Cómo es el proceso de envío?', '¿Qué medios de pago hay?'],
};

const roleLabels = { patient: 'Paciente', doctor: 'Equipo médico', secretary: 'Secretaría', admin: 'Administración' };

export default function HospitalAssistant() {
  const { currentUser, data } = useAppData();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState([welcomeMessage]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const messageListRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !messageListRef.current) return;
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [isOpen, isLoading, messages]);

  const sendMessage = async (value) => {
    const message = value.trim();
    if (!message || isLoading) return;
    setDraft('');
    setError('');

    const localAnswer = getLocalAssistantAnswer(message, currentUser, data);
    if (localAnswer) {
      setMessages((current) => [
        ...current,
        { role: 'user', content: message, sentToAI: false },
        { role: 'assistant', content: localAnswer, sentToAI: false },
      ]);
      return;
    }

    const safeHistory = messages
      .filter((item) => item.sentToAI && ['user', 'assistant'].includes(item.role))
      .slice(-6)
      .map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, { role: 'user', content: message, sentToAI: true }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, role: currentUser.role, history: safeHistory }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo completar la consulta.');
      setMessages((current) => [...current, { role: 'assistant', content: result.answer, sentToAI: true }]);
    } catch (requestError) {
      setError(requestError.message || 'No se pudo conectar con el asistente.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="hospital-assistant-root">
      {isOpen ? (
        <section className="hospital-assistant-panel" role="dialog" aria-modal="false" aria-labelledby="assistant-title">
          <header className="hospital-assistant-header">
            <span className="assistant-brand-icon"><Bot size={23} /></span>
            <div><h2 id="assistant-title">Asistente del hospital</h2><span>{roleLabels[currentUser.role]} · respuestas verificadas</span></div>
            <button type="button" className="assistant-close" onClick={() => setIsOpen(false)} aria-label="Cerrar asistente"><X size={20} /></button>
          </header>

          <div className="hospital-assistant-messages" ref={messageListRef} aria-live="polite">
            {messages.map((item, index) => (
              <article className={`assistant-message ${item.role}`} key={`${item.role}-${index}`}>
                {item.role === 'assistant' ? <span className="assistant-message-icon"><Sparkles size={15} /></span> : null}
                <p>{item.content}</p>
              </article>
            ))}
            {isLoading ? <article className="assistant-message assistant"><span className="assistant-message-icon"><Sparkles size={15} /></span><p className="assistant-thinking">Estoy buscando una respuesta confirmada...</p></article> : null}
          </div>

          {messages.length === 1 ? (
            <div className="assistant-prompts" aria-label="Preguntas sugeridas">
              <span>Prueba preguntar</span>
              {(promptsByRole[currentUser.role] || promptsByRole.patient).map((prompt) => {
                const Icon = /cita|reserva|agenda/i.test(prompt) ? CalendarDays : /medicamento|pedido|stock|env[ií]o/i.test(prompt) ? Pill : CircleHelp;
                return <button type="button" key={prompt} disabled={isLoading} onClick={() => sendMessage(prompt)}><Icon size={15} />{prompt}</button>;
              })}
            </div>
          ) : null}

          {error ? <p className="assistant-error" role="alert">{error}</p> : null}

          <form className="hospital-assistant-form" onSubmit={(event) => { event.preventDefault(); void sendMessage(draft); }}>
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(draft); } }} placeholder="Escribe tu pregunta" aria-label="Escribe tu pregunta para el asistente" rows={1} maxLength={1200} />
            <button type="submit" disabled={!draft.trim() || isLoading} aria-label="Enviar pregunta" title="Enviar pregunta"><Send size={18} /></button>
          </form>
          <div className="assistant-privacy-note"><ShieldCheck size={14} /><span>No escribas datos de salud, documentos, teléfonos o direcciones. Tus citas y pedidos se consultan localmente.</span></div>
        </section>
      ) : null}

      <button type="button" className="hospital-assistant-launcher" onClick={() => setIsOpen((open) => !open)} aria-label={isOpen ? 'Cerrar asistente' : 'Abrir asistente del hospital'} aria-expanded={isOpen} title="Asistente del hospital">
        {isOpen ? <X size={23} /> : <MessageCircle size={23} />}
        {!isOpen ? <span>Asistente</span> : null}
      </button>
    </div>
  );
}
