





HISTORIAS DE USUSARIO - SISTEMA MEDICO

HU01: Registro e inicio de sesión de paciente

Como paciente, quiero registrarme e iniciar sesión en el sistema para acceder a mis funcionalidades personalizadas.

Criterios de Aceptación:

El formulario de registro debe solicitar datos personales válidos (documento, correo, contraseña).

El sistema debe autenticar las credenciales y redirigir al panel del paciente.

Se debe mostrar un mensaje de error claro ante credenciales incorrectas.

HU02: Agendamiento de cita médica

Como paciente, quiero solicitar una cita seleccionando tipo de médico (general/especialista), médico, sede, fecha y hora para recibir atención médica.

Criterios de Aceptación:

El sistema debe desplegar solo sedes, especialistas y horarios disponibles.

No se debe permitir confirmar la reserva si falta seleccionar algún campo obligatorio.

Al completar el proceso, la cita debe quedar guardada en estado "Pendiente".

HU03: Control de citas simultáneas

Como sistema, quiero bloquear el agendamiento de múltiples citas activas al mismo tiempo para evitar duplicidades en el servicio.

Criterios de Aceptación:

Si el paciente ya tiene una cita activa en el mismo bloque horario, el sistema debe bloquear la transacción.

El sistema debe mostrar una alerta indicando que ya existe un agendamiento en dicho horario.

HU04: Cancelación de citas médicas

Como paciente, quiero cancelar una cita médica agendada para liberar el cupo si no puedo asistir.

Criterios de Aceptación:

El paciente debe ver un botón de cancelación en la lista de sus citas activas.

El sistema debe solicitar confirmación antes de procesar la cancelación.

El estado de la cita debe cambiar a "Cancelada" y liberar el horario en la agenda del médico.

HU05: Consulta de medicamentos asignados

Como paciente, quiero visualizar el listado de medicamentos recetados por el médico para llevar un control de mi tratamiento.

Criterios de Aceptación:

El módulo debe mostrar la dosis, frecuencia y duración del tratamiento recetado.

Solo deben ser visibles los medicamentos asociados a citas finalizadas del paciente.

Historias de Usuario: Médico

HU06: Visualización de agenda diaria

Como médico, quiero ver mi lista de pacientes organizados por día y hora para planificar mi jornada de atención.

Criterios de Aceptación:

La vista por defecto debe cargar las citas del día actual ordenadas cronológicamente.

Se deben visualizar los datos básicos del paciente y el estado de la cita (Pendiente, En curso, Finalizada, Cancelada).

HU07: Gestión del estado de la cita (Inicio)

Como médico, quiero marcar el inicio de la consulta médica para registrar la asistencia del paciente.

Criterios de Aceptación:

El médico debe contar con una opción para "Iniciar Cita".

El estado de la cita debe actualizarse en tiempo real a "En curso" e registrar la hora exacta de inicio.

HU08: Gestión del estado de la cita (Finalización)

Como médico, quiero marcar la finalización de la consulta médica para dar por completada la atención.

Criterios de Aceptación:

La opción de "Finalizar Cita" solo debe habilitarse si la cita está "En curso".

Al finalizar, el estado cambia a "Finalizada" y se habilita la edición del registro médico.

HU09: Prescripción de medicamentos

Como médico, quiero asignar medicamentos a un paciente durante o al cerrar la consulta para indicar su tratamiento.

Criterios de Aceptación:

El sistema debe permitir buscar y seleccionar medicamentos de un catálogo o ingresar nombre, dosis e indicaciones.

Los medicamentos guardados deben vincularse de inmediato al historial del paciente.

HU10: Ordenamiento de exámenes médicos

Como médico, quiero asignar exámenes diagnósticos al paciente para complementar su diagnóstico.

Criterios de Aceptación:

El formulario debe incluir la selección del tipo de examen y observaciones médicas.

La orden generada debe quedar asociada a la cita médica correspondiente.

preueba para push