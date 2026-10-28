import { getAuthenticatedUser } from './auth.js';
import { pool } from './db.js';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

const sendJson = (response, status, body) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
};
const fail = (status, message) => Object.assign(new Error(message), { status });
const dbId = (id) => Number(String(id || '').replace(/^PAT-DB-/, ''));
const name = (row, prefix = '') => [row[`${prefix}NOMBRE_1`], row[`${prefix}NOMBRE_2`], row[`${prefix}APELLIDO_1`], row[`${prefix}APELLIDO_2`]].filter(Boolean).join(' ');
const date = (value) => value instanceof Date ? value.toISOString().slice(0, 10) : value;
const requestBody = async (request) => {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 50000) throw fail(413, 'La solicitud es demasiado grande.');
  }
  try { return JSON.parse(raw || '{}'); } catch { throw fail(400, 'El formato de datos no es válido.'); }
};
const passwordHash = async (password) => {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64url')}$${Buffer.from(hash).toString('base64url')}`;
};

async function getRoleId(connection, roleName) {
  const [[role]] = await connection.execute(
    'SELECT ID_ROL FROM rol WHERE LOWER(NOMBRE)=? LIMIT 1',
    [roleName],
  );
  if (!role) throw fail(409, `El rol ${roleName} no está configurado en la base de datos.`);
  return Number(role.ID_ROL);
}

async function transaction(type, fn) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.execute('INSERT INTO sync_event (EVENT_TYPE) VALUES (?)', [type]);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

const requireRole = (user, ...roles) => {
  if (!user) throw fail(401, 'Inicia sesión para continuar.');
  if (!roles.includes(user.role)) throw fail(403, 'Tu cuenta no tiene permiso para esta acción.');
};

export async function readState(user) {
  const [sites] = await pool.query('SELECT ID_SEDE,NOMBRE,DIRECCION,CIUDAD,TELEFONO FROM sede WHERE ACTIVA=1 ORDER BY NOMBRE');
  const [specialties] = await pool.query('SELECT ID_ESPECIALIDAD,NOMBRE,DESCRIPCION FROM especialidad WHERE ACTIVA=1 ORDER BY NOMBRE');
  const [doctorRows] = await pool.query(`SELECT u.*,m.NUMERO_LICENCIA,m.TIPO_MEDICO,e.NOMBRE AS ESPECIALIDAD,s.NOMBRE AS SEDE
    FROM medico m JOIN usuario u ON u.ID_USUARIO=m.ID_USUARIO JOIN especialidad e ON e.ID_ESPECIALIDAD=m.ID_ESPECIALIDAD
    JOIN sede s ON s.ID_SEDE=m.ID_SEDE_PRINCIPAL WHERE u.ESTADO='activo' ORDER BY u.APELLIDO_1,u.NOMBRE_1`);
  let patientsSql = `SELECT u.*,p.EPS FROM paciente p JOIN usuario u ON u.ID_USUARIO=p.ID_USUARIO`;
  const patientArgs = [];
  if (user.role === 'patient') { patientsSql += ' WHERE u.ID_USUARIO=?'; patientArgs.push(user.databaseId); }
  if (user.role === 'doctor') { patientsSql += ' WHERE EXISTS (SELECT 1 FROM cita c JOIN medico m ON m.NUMERO_LICENCIA=c.NUMERO_LICENCIA WHERE c.ID_PACIENTE=u.ID_USUARIO AND m.ID_USUARIO=?)'; patientArgs.push(user.databaseId); }
  const [patientRows] = await pool.execute(patientsSql, patientArgs);
  const patientView = (row) => ({ id: `PAT-DB-${row.ID_USUARIO}`, databaseId: Number(row.ID_USUARIO), document: row.NUMERO_DOCUMENTO, typeId: row.TIPO_DOCUMENTO, name: name(row), email: row.EMAIL, phone: row.TELEFONO || '', address: row.DIRECCION || '', birthDate: date(row.FECHA_NACIMIENTO) || '', eps: row.EPS || '', status: row.ESTADO });
  const [appointmentsRows] = await pool.execute(`SELECT c.*,p.NUMERO_DOCUMENTO AS PAT_DOC,p.NOMBRE_1 AS PN1,p.NOMBRE_2 AS PN2,p.APELLIDO_1 AS PA1,p.APELLIDO_2 AS PA2,
    m.ID_USUARIO AS DOC_ID,du.NOMBRE_1 AS DN1,du.NOMBRE_2 AS DN2,du.APELLIDO_1 AS DA1,du.APELLIDO_2 AS DA2,e.NOMBRE AS ESPECIALIDAD,s.NOMBRE AS SEDE
    FROM cita c JOIN usuario p ON p.ID_USUARIO=c.ID_PACIENTE JOIN medico m ON m.NUMERO_LICENCIA=c.NUMERO_LICENCIA JOIN usuario du ON du.ID_USUARIO=m.ID_USUARIO
    JOIN especialidad e ON e.ID_ESPECIALIDAD=m.ID_ESPECIALIDAD JOIN sede s ON s.ID_SEDE=c.ID_SEDE
    WHERE (?='admin' OR ?='secretary' OR (?='patient' AND c.ID_PACIENTE=?) OR (?='doctor' AND m.ID_USUARIO=?)) ORDER BY c.FECHA_CITA DESC,c.HORA_CITA DESC`,
  [user.role,user.role,user.role,user.databaseId,user.role,user.databaseId]);
  const appointments = appointmentsRows.map((r) => ({ id: String(r.ID_CITA), patientId: `PAT-DB-${r.ID_PACIENTE}`, patientDocument: r.PAT_DOC, patientName: [r.PN1,r.PN2,r.PA1,r.PA2].filter(Boolean).join(' '), doctorId: `PAT-DB-${r.DOC_ID}`, doctorName: [r.DN1,r.DN2,r.DA1,r.DA2].filter(Boolean).join(' '), specialty: r.ESPECIALIDAD, sede: r.SEDE, sedeId: Number(r.ID_SEDE), date: date(r.FECHA_CITA), time: String(r.HORA_CITA).slice(0,5), attentionType: r.TIPO_ATENCION, reason: r.MOTIVO || '', status: r.ESTADO, startTime: r.INICIO_EN || '', endTime: r.FINALIZACION_EN || '' }));
  const [recordsRows] = await pool.execute(`SELECT h.*,c.FECHA_CITA,c.HORA_CITA,c.MOTIVO,p.NUMERO_DOCUMENTO,p.NOMBRE_1 AS PN1,p.NOMBRE_2 AS PN2,p.APELLIDO_1 AS PA1,p.APELLIDO_2 AS PA2,
    m.ID_USUARIO AS DOC_ID,du.NOMBRE_1 AS DN1,du.APELLIDO_1 AS DA1,e.NOMBRE AS ESPECIALIDAD,s.NOMBRE AS SEDE
    FROM historial_clinico h JOIN cita c ON c.ID_CITA=h.ID_CITA JOIN usuario p ON p.ID_USUARIO=h.ID_PACIENTE
    JOIN medico m ON m.NUMERO_LICENCIA=h.NUMERO_LICENCIA JOIN usuario du ON du.ID_USUARIO=m.ID_USUARIO
    JOIN especialidad e ON e.ID_ESPECIALIDAD=m.ID_ESPECIALIDAD JOIN sede s ON s.ID_SEDE=c.ID_SEDE
    WHERE (?='doctor' AND m.ID_USUARIO=?) OR (?='patient' AND h.ID_PACIENTE=? AND c.ESTADO='Finalizada') ORDER BY h.REGISTRADO_EN DESC`,
  [user.role,user.databaseId,user.role,user.databaseId]);
  const records = recordsRows.map((r) => ({ id:String(r.ID_HISTORIAL), appointmentId:String(r.ID_CITA), patientId:`PAT-DB-${r.ID_PACIENTE}`, patientDocument:r.NUMERO_DOCUMENTO, patientName:[r.PN1,r.PN2,r.PA1,r.PA2].filter(Boolean).join(' '), doctorId:`PAT-DB-${r.DOC_ID}`, doctorName:[r.DN1,r.DA1].filter(Boolean).join(' '), specialty:r.ESPECIALIDAD, sede:r.SEDE, date:date(r.FECHA_CITA), time:String(r.HORA_CITA).slice(0,5), reason:r.MOTIVO||'', symptoms:r.SINTOMAS||'', diagnosis:r.DIAGNOSTICO||'', observations:r.OBSERVACIONES||'' }));
  const [prescriptionRows] = await pool.execute(`SELECT pr.*,med.NOMBRE AS MEDICAMENTO,h.ID_CITA,c.FECHA_CITA,m.ID_USUARIO AS DOC_ID,
    du.NOMBRE_1 AS DN1,du.APELLIDO_1 AS DA1,p.NOMBRE_1 AS PN1,p.APELLIDO_1 AS PA1
    FROM prescripcion pr JOIN medicamento med ON med.ID_MEDICAMENTO=pr.ID_MEDICAMENTO JOIN historial_clinico h ON h.ID_HISTORIAL=pr.ID_HISTORIAL
    JOIN cita c ON c.ID_CITA=h.ID_CITA JOIN medico m ON m.NUMERO_LICENCIA=c.NUMERO_LICENCIA JOIN usuario du ON du.ID_USUARIO=m.ID_USUARIO JOIN usuario p ON p.ID_USUARIO=pr.ID_PACIENTE
    WHERE (?='doctor' AND m.ID_USUARIO=?) OR (?='patient' AND pr.ID_PACIENTE=?)`,[user.role,user.databaseId,user.role,user.databaseId]);
  const prescriptions = prescriptionRows.map((r) => ({ id:String(r.ID_PRESCRIPCION), recordId:String(r.ID_HISTORIAL), appointmentId:String(r.ID_CITA), patientId:`PAT-DB-${r.ID_PACIENTE}`, patientName:`${r.PN1} ${r.PA1}`, doctorId:`PAT-DB-${r.DOC_ID}`, doctorName:`${r.DN1} ${r.DA1}`, medicineId:String(r.ID_MEDICAMENTO), medicine:r.MEDICAMENTO, dose:r.DOSIS, frequency:r.FRECUENCIA, duration:r.DURACION, indications:r.INDICACIONES||'', date:date(r.FECHA_CITA) }));
  const [meds] = await pool.query(`SELECT m.ID_MEDICAMENTO,m.NOMBRE,m.CODIGO,m.DESCRIPCION,m.FABRICANTE,m.ACTIVO,i.EXISTENCIAS FROM medicamento m LEFT JOIN inventario_medicamento i ON i.ID_MEDICAMENTO=m.ID_MEDICAMENTO ORDER BY m.NOMBRE`);
  let orderSql = `SELECT se.*,u.NOMBRE_1,u.APELLIDO_1,u.NUMERO_DOCUMENTO FROM solicitud_envio se JOIN usuario u ON u.ID_USUARIO=se.ID_PACIENTE`;
  const args=[];
  if(user.role==='patient'){orderSql+=' WHERE se.ID_PACIENTE=?';args.push(user.databaseId)}
  if(user.role==='doctor'){orderSql+=' WHERE 1=0'}
  orderSql+=' ORDER BY se.SOLICITADO_EN DESC';
  const [orders]=await pool.execute(orderSql,args);
  const deliveries=[];
  for(const r of orders){
    const [items]=await pool.execute(`SELECT ds.ID_PRESCRIPCION,ds.CANTIDAD,med.NOMBRE AS MEDICAMENTO
      FROM detalle_solicitud ds JOIN prescripcion pr ON pr.ID_PRESCRIPCION=ds.ID_PRESCRIPCION
      JOIN medicamento med ON med.ID_MEDICAMENTO=pr.ID_MEDICAMENTO WHERE ds.ID_SOLICITUD=?`,[r.ID_SOLICITUD]);
    const [history]=await pool.execute('SELECT ESTADO_ANTERIOR,ESTADO_NUEVO,NOTA,CREADO_EN FROM historial_estado_envio WHERE ID_SOLICITUD=? ORDER BY CREADO_EN',[r.ID_SOLICITUD]);
    deliveries.push({id:String(r.ID_SOLICITUD),patientId:`PAT-DB-${r.ID_PACIENTE}`,patientName:`${r.NOMBRE_1} ${r.APELLIDO_1}`,patientDocument:r.NUMERO_DOCUMENTO,address:r.DIRECCION_ENTREGA,phone:r.TELEFONO_CONTACTO,email:r.EMAIL_CONTACTO||'',deliveryNotes:r.NOTAS_ENTREGA||'',paymentMethod:r.METODO_PAGO,paymentStatus:r.ESTADO_PAGO,status:r.ESTADO_PAGO==='Pagado'?'Pago confirmado':r.ESTADO_PAGO,orderStatus:r.ESTADO_ENVIO,transactionCode:r.REFERENCIA_PAGO||'',prescriptionIds:items.map(i=>String(i.ID_PRESCRIPCION)),items:items.map(i=>({prescriptionId:String(i.ID_PRESCRIPCION),medicine:i.MEDICAMENTO,quantity:Number(i.CANTIDAD)})),history,createdAt:r.SOLICITADO_EN});
  }
  let users=[];
  if(user.role==='admin'){const [rows]=await pool.query(`SELECT u.*,r.NOMBRE AS ROL,p.EPS,m.NUMERO_LICENCIA,m.TIPO_MEDICO,e.NOMBRE AS ESPECIALIDAD,s.NOMBRE AS SEDE FROM usuario u JOIN rol r ON r.ID_ROL=u.ID_ROL LEFT JOIN paciente p ON p.ID_USUARIO=u.ID_USUARIO LEFT JOIN medico m ON m.ID_USUARIO=u.ID_USUARIO LEFT JOIN especialidad e ON e.ID_ESPECIALIDAD=m.ID_ESPECIALIDAD LEFT JOIN sede s ON s.ID_SEDE=m.ID_SEDE_PRINCIPAL ORDER BY u.CREADO_EN DESC`); users=rows.map(r=>({...patientView(r),role:({paciente:'patient',medico:'doctor',secretaria:'secretary',administrador:'admin'})[String(r.ROL).toLowerCase()],username:r.USUARIO_LOGIN||r.NUMERO_DOCUMENTO,license:r.NUMERO_LICENCIA||'',specialty:r.ESPECIALIDAD||'',medicalType:r.TIPO_MEDICO||'',sede:r.SEDE||''}));}
  return {users,patients:patientRows.map(patientView),doctors:doctorRows.map(r=>({id:`PAT-DB-${r.ID_USUARIO}`,databaseId:Number(r.ID_USUARIO),name:name(r),status:r.ESTADO,license:r.NUMERO_LICENCIA,specialty:r.ESPECIALIDAD,medicalType:r.TIPO_MEDICO,sede:r.SEDE})),appointments,clinicalRecords:records,prescriptions,deliveries,medications:meds.filter(r=>r.ACTIVO).map(r=>r.NOMBRE),inventory:meds.map(r=>({medicine:r.NOMBRE,medicationId:Number(r.ID_MEDICAMENTO),stock:Number(r.EXISTENCIAS),updatedAt:null})),sedes:sites.map(r=>({id:Number(r.ID_SEDE),name:r.NOMBRE,address:r.DIRECCION||'',city:r.CIUDAD||'',phone:r.TELEFONO||''})),specialties:specialties.map(r=>({id:Number(r.ID_ESPECIALIDAD),name:r.NOMBRE,description:r.DESCRIPCION||''})),auditLog:[]};
}

export async function handleLiveDataRequest(request, response, url) {
  if (!url.pathname.startsWith('/api/state') && !url.pathname.startsWith('/api/events') && !url.pathname.startsWith('/api/appointments') && !url.pathname.startsWith('/api/clinical-records') && !url.pathname.startsWith('/api/deliveries') && !url.pathname.startsWith('/api/admin/')) return false;
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) { sendJson(response, 401, { error: 'Inicia sesión para continuar.' }); return true; }
    if (url.pathname === '/api/state' && request.method === 'GET') {
      sendJson(response, 200, { data: await readState(user) });
      return true;
    }
    if (url.pathname === '/api/events' && request.method === 'GET') {
      let last = Number(request.headers['last-event-id'] || 0);
      if (!last) { const [[row]] = await pool.query('SELECT COALESCE(MAX(ID_EVENT),0) AS id FROM sync_event'); last=Number(row.id); }
      response.writeHead(200,{ 'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform',Connection:'keep-alive','X-Accel-Buffering':'no' });
      response.write(': connected\n\n');
      const timer=setInterval(async()=>{try{const [rows]=await pool.execute('SELECT ID_EVENT,EVENT_TYPE FROM sync_event WHERE ID_EVENT>? ORDER BY ID_EVENT LIMIT 100',[last]);for(const row of rows){last=Number(row.ID_EVENT);response.write(`id: ${last}\nevent: change\ndata: ${JSON.stringify({type:row.EVENT_TYPE})}\n\n`);}}catch{if(!response.destroyed)response.write('event: error\ndata: {}\n\n');}},1000);
      response.on('close',()=>clearInterval(timer));
      return true;
    }
    if (url.pathname === '/api/auth/register') return false;

    if (url.pathname === '/api/admin/users' && request.method === 'POST') {
      requireRole(user, 'admin');
      const body = await requestBody(request);
      const role = ({ doctor: 'medico', secretary: 'secretaria', patient: 'paciente' })[body.role];
      if (!role) throw fail(400, 'Rol inválido.');
      const typeId = String(body.typeId || 'CC').trim().toUpperCase();
      const document = String(body.document || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const phone = String(body.phone || '').trim();
      const fullName = String(body.name || '').trim().split(/\s+/).filter(Boolean);
      const rawNames = role === 'paciente' ? String(body.names || '').trim().split(/\s+/) : fullName.slice(0, -1);
      const rawLastNames = role === 'paciente' ? String(body.lastNames || '').trim().split(/\s+/) : fullName.slice(-1);
      const firstName = rawNames.shift() || '';
      const secondName = rawNames.join(' ') || null;
      const lastName = rawLastNames.shift() || '';
      const secondLastName = rawLastNames.join(' ') || null;
      const password = String(body.password || '');
      if (!firstName || !lastName || !document || !/^\S+@\S+\.\S+$/.test(email) || password.length < 7) throw fail(400, 'Completa los datos requeridos; la contraseña requiere mínimo 7 caracteres.');
      const result = await transaction('user.created', async (connection) => {
        const roleId = await getRoleId(connection, role);
        const [created] = await connection.execute(`INSERT INTO usuario (TIPO_DOCUMENTO,NUMERO_DOCUMENTO,NOMBRE_1,NOMBRE_2,APELLIDO_1,APELLIDO_2,EMAIL,USUARIO_LOGIN,PASSWORD_HASH,TELEFONO,FECHA_NACIMIENTO,ID_ROL)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [typeId, document, firstName, secondName, lastName, secondLastName, email, String(body.username || document).slice(0,32), await passwordHash(password), phone || null, body.birthDate || null, roleId]);
        const newId = created.insertId;
        if (role === 'paciente') await connection.execute('INSERT INTO paciente (ID_USUARIO,EPS,CREADO_POR) VALUES (?,?,?)', [newId, body.eps || null, user.databaseId]);
        if (role === 'medico') {
          const [[specialty]] = await connection.execute('SELECT ID_ESPECIALIDAD FROM especialidad WHERE ID_ESPECIALIDAD=? OR NOMBRE=? LIMIT 1', [body.specialtyId || 0, body.specialty || '']);
          const [[site]] = await connection.execute('SELECT ID_SEDE FROM sede WHERE ID_SEDE=? OR NOMBRE=? LIMIT 1', [body.siteId || 0, body.sede || '']);
          if (!specialty || !site || !body.license) throw fail(400, 'El médico requiere licencia, especialidad y sede existentes.');
          await connection.execute('INSERT INTO medico (NUMERO_LICENCIA,ID_USUARIO,TIPO_MEDICO,ID_ESPECIALIDAD,ID_SEDE_PRINCIPAL) VALUES (?,?,?,?,?)', [body.license,newId,body.medicalType === 'general' ? 'general' : 'especialista',specialty.ID_ESPECIALIDAD,site.ID_SEDE]);
        }
        if (role === 'secretaria') {
          const [[site]] = await connection.execute('SELECT ID_SEDE FROM sede WHERE ID_SEDE=? OR NOMBRE=? LIMIT 1', [body.siteId || 0, body.sede || '']);
          if (!site) throw fail(400, 'La secretaria requiere una sede existente.');
          await connection.execute('INSERT INTO secretaria (ID_USUARIO,ID_SEDE) VALUES (?,?)', [newId,site.ID_SEDE]);
        }
        return Number(newId);
      });
      sendJson(response, 201, { id: `PAT-DB-${result}`, username: body.username || document });
      return true;
    }

    const roleUserId=url.pathname.match(/^\/api\/admin\/users\/(\d+)\/role$/)?.[1];
    if(roleUserId&&request.method==='PATCH'){
      requireRole(user,'admin');const body=await requestBody(request);const roleName=({patient:'paciente',doctor:'medico',secretary:'secretaria'})[body.role];if(!roleName)throw fail(400,'Rol no permitido.');
      await transaction('user.role.updated',async(connection)=>{
        const roleId=await getRoleId(connection,roleName);
        const adminRoleId=await getRoleId(connection,'administrador');
        const [[target]]=await connection.execute('SELECT ID_USUARIO,NUMERO_DOCUMENTO,ID_ROL FROM usuario WHERE ID_USUARIO=? FOR UPDATE',[roleUserId]);if(!target)throw fail(404,'Cuenta no encontrada.');if(Number(target.ID_ROL)===adminRoleId)throw fail(403,'No se puede cambiar la cuenta administradora.');
        if(body.role==='patient') await connection.execute('INSERT IGNORE INTO paciente (ID_USUARIO) VALUES (?)',[roleUserId]);
        if(body.role==='doctor'){
          const [[specialty]]=await connection.execute("SELECT ID_ESPECIALIDAD FROM especialidad WHERE ACTIVA=1 ORDER BY ID_ESPECIALIDAD LIMIT 1");const [[site]]=await connection.execute('SELECT ID_SEDE FROM sede WHERE ACTIVA=1 ORDER BY ID_SEDE LIMIT 1');if(!specialty||!site)throw fail(409,'Registra primero una especialidad y una sede activas.');
          await connection.execute('INSERT IGNORE INTO medico (NUMERO_LICENCIA,ID_USUARIO,TIPO_MEDICO,ID_ESPECIALIDAD,ID_SEDE_PRINCIPAL) VALUES (?,?,?,?,?)',[`LIC-${target.NUMERO_DOCUMENTO}`,roleUserId,'general',specialty.ID_ESPECIALIDAD,site.ID_SEDE]);
        }
        if(body.role==='secretary'){const [[site]]=await connection.execute('SELECT ID_SEDE FROM sede WHERE ACTIVA=1 ORDER BY ID_SEDE LIMIT 1');if(!site)throw fail(409,'Registra primero una sede activa.');await connection.execute('INSERT IGNORE INTO secretaria (ID_USUARIO,ID_SEDE) VALUES (?,?)',[roleUserId,site.ID_SEDE]);}
        await connection.execute('UPDATE usuario SET ID_ROL=? WHERE ID_USUARIO=?',[roleId,roleUserId]);
      });sendJson(response,200,{ok:true});return true;
    }

    const userId=url.pathname.match(/^\/api\/admin\/users\/(\d+)$/)?.[1];
    if(userId&&request.method==='PATCH'){
      requireRole(user,'admin');const body=await requestBody(request);
      const allowed={TELEFONO:String(body.phone||'').slice(0,30)||null,EMAIL:String(body.email||'').trim().toLowerCase()||null};
      await transaction('user.updated',async(connection)=>{const adminRoleId=await getRoleId(connection,'administrador');const [result]=await connection.execute('UPDATE usuario SET TELEFONO=?,EMAIL=? WHERE ID_USUARIO=? AND ID_ROL<>?',[allowed.TELEFONO,allowed.EMAIL,userId,adminRoleId]);if(!result.affectedRows)throw fail(404,'Cuenta no encontrada o protegida.');});sendJson(response,200,{ok:true});return true;
    }

    if (url.pathname === '/api/appointments' && request.method === 'POST') {
      requireRole(user, 'patient', 'secretary', 'admin');
      const body = await requestBody(request);
      const patientId = user.role === 'patient' ? user.databaseId : dbId(body.patientId);
      const doctorId = dbId(body.doctorId);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.date || '')) || !/^\d{2}:\d{2}$/.test(String(body.time || '')) || !/^\S/.test(String(body.reason || ''))) throw fail(400, 'Fecha, hora y motivo deben tener un formato válido.');
      const result = await transaction('appointment.created', async (connection) => {
        const [[patient]] = await connection.execute(`SELECT u.ID_USUARIO FROM usuario u JOIN paciente p ON p.ID_USUARIO=u.ID_USUARIO WHERE u.ID_USUARIO=? AND u.ESTADO='activo' FOR UPDATE`, [patientId]);
        const [[doctor]] = await connection.execute(`SELECT m.NUMERO_LICENCIA FROM medico m JOIN usuario u ON u.ID_USUARIO=m.ID_USUARIO WHERE m.ID_USUARIO=? AND u.ESTADO='activo' FOR UPDATE`, [doctorId]);
        const [[site]] = await connection.execute('SELECT ID_SEDE FROM sede WHERE (ID_SEDE=? OR NOMBRE=?) AND ACTIVA=1 LIMIT 1', [body.sedeId || 0, body.sede || '']);
        if (!patient || !doctor || !site) throw fail(400, 'Paciente, médico o sede no están disponibles.');
        const [[current]] = await connection.execute('SELECT CURRENT_DATE AS HOY', []);
        if (body.date < String(current.HOY).slice(0,10)) throw fail(400, 'No puedes reservar una cita en una fecha pasada.');
        const [overlap] = await connection.execute(`SELECT ID_CITA FROM cita WHERE FECHA_CITA=? AND HORA_CITA=? AND ESTADO IN ('Pendiente','En curso') AND (ID_PACIENTE=? OR NUMERO_LICENCIA=?) FOR UPDATE`, [body.date,`${body.time}:00`,patientId,doctor.NUMERO_LICENCIA]);
        if (overlap.length) throw fail(409, 'El paciente o médico ya tiene una cita en ese horario.');
        const [insert] = await connection.execute(`INSERT INTO cita (ID_PACIENTE,NUMERO_LICENCIA,ID_SEDE,GESTIONADA_POR,FECHA_CITA,HORA_CITA,TIPO_ATENCION,MOTIVO) VALUES (?,?,?,?,?,?,?,?)`, [patientId,doctor.NUMERO_LICENCIA,site.ID_SEDE,user.role==='patient'?null:user.databaseId,body.date,`${body.time}:00`,body.attentionType==='general'?'general':'especialista',String(body.reason).slice(0,500)]);
        return insert.insertId;
      });
      sendJson(response, 201, { id: String(result) });
      return true;
    }

    const appointmentId = url.pathname.match(/^\/api\/appointments\/(\d+)$/)?.[1];
    if (appointmentId && request.method === 'PATCH') {
      const body = await requestBody(request);
      await transaction('appointment.updated', async (connection) => {
        const [[appointment]] = await connection.execute(`SELECT c.*,m.ID_USUARIO AS DOC_ID FROM cita c JOIN medico m ON m.NUMERO_LICENCIA=c.NUMERO_LICENCIA WHERE c.ID_CITA=? FOR UPDATE`, [appointmentId]);
        if (!appointment) throw fail(404,'Cita no encontrada.');
        if (body.date && body.time && !body.status) {
          requireRole(user,'secretary','admin');
          if (appointment.ESTADO !== 'Pendiente' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || !/^\d{2}:\d{2}$/.test(body.time)) throw fail(409,'Solo puedes reprogramar citas pendientes con fecha y hora válidas.');
          await connection.execute('SELECT ID_USUARIO FROM usuario WHERE ID_USUARIO=? FOR UPDATE',[appointment.ID_PACIENTE]);
          await connection.execute('SELECT ID_USUARIO FROM usuario WHERE ID_USUARIO=? FOR UPDATE',[appointment.DOC_ID]);
          const [overlap] = await connection.execute(`SELECT ID_CITA FROM cita WHERE ID_CITA<>? AND FECHA_CITA=? AND HORA_CITA=? AND ESTADO IN ('Pendiente','En curso') AND (ID_PACIENTE=? OR NUMERO_LICENCIA=?) FOR UPDATE`, [appointmentId,body.date,`${body.time}:00`,appointment.ID_PACIENTE,appointment.NUMERO_LICENCIA]);
          if (overlap.length) throw fail(409,'El paciente o médico ya tiene una cita en ese horario.');
          const [updated] = await connection.execute('UPDATE cita SET FECHA_CITA=?,HORA_CITA=? WHERE ID_CITA=? AND ESTADO=\'Pendiente\'', [body.date,`${body.time}:00`,appointmentId]);
          if (!updated.affectedRows) throw fail(409,'La cita ya no está disponible para reprogramar.');
          return;
        }
        const next = body.status;
        if (user.role==='patient') {
          if (String(appointment.ID_PACIENTE)!==String(user.databaseId)||next!=='Cancelada'||appointment.ESTADO!=='Pendiente') throw fail(403,'No puedes modificar esta cita.');
        } else if (user.role==='doctor') {
          if (Number(appointment.DOC_ID)!==user.databaseId||next!=='En curso'||appointment.ESTADO!=='Pendiente') throw fail(403,'Solo puedes iniciar una cita pendiente que esté asignada a tu cuenta.');
        } else {
          requireRole(user,'secretary','admin');
          if (next!=='Cancelada'||appointment.ESTADO!=='Pendiente') throw fail(403,'Secretaría y administración solo pueden cancelar citas pendientes.');
        }
        if (!['En curso','Cancelada'].includes(next)) throw fail(400,'Cambio de estado no válido.');
        await connection.execute('UPDATE cita SET ESTADO=?,INICIO_EN=IF(?=\'En curso\',NOW(3),INICIO_EN),CANCELACION_EN=IF(?=\'Cancelada\',NOW(3),CANCELACION_EN),CANCELADA_POR=IF(?=\'Cancelada\',?,CANCELADA_POR) WHERE ID_CITA=?', [next,next,next,next,user.databaseId,appointmentId]);
      });
      sendJson(response,200,{ok:true});
      return true;
    }

    if (url.pathname === '/api/clinical-records' && request.method === 'POST') {
      requireRole(user,'doctor');
      const body=await requestBody(request);
      const result=await transaction('clinical-record.saved',async(connection)=>{
        const [[appointment]]=await connection.execute(`SELECT c.ID_CITA,c.ID_PACIENTE,c.NUMERO_LICENCIA,c.ESTADO FROM cita c JOIN medico m ON m.NUMERO_LICENCIA=c.NUMERO_LICENCIA WHERE c.ID_CITA=? AND m.ID_USUARIO=? FOR UPDATE`,[body.appointmentId,user.databaseId]);
        if(!appointment||appointment.ESTADO!=='En curso') throw fail(409,'Solo puedes registrar tu consulta que está en curso.');
        const [insert]=await connection.execute('INSERT INTO historial_clinico (ID_CITA,ID_PACIENTE,NUMERO_LICENCIA,SINTOMAS,DIAGNOSTICO,OBSERVACIONES) VALUES (?,?,?,?,?,?)',[appointment.ID_CITA,appointment.ID_PACIENTE,appointment.NUMERO_LICENCIA,String(body.symptoms||'').slice(0,4000),String(body.diagnosis||'').slice(0,4000),String(body.observations||'').slice(0,8000)]);
        for(const prescription of body.prescriptions||[]){
          const [[medicine]]=await connection.execute('SELECT ID_MEDICAMENTO FROM medicamento WHERE (ID_MEDICAMENTO=? OR NOMBRE=?) AND ACTIVO=1 LIMIT 1',[prescription.medicineId||0,prescription.medicine||'']);
          if(!medicine) throw fail(400,`Medicamento no disponible: ${prescription.medicine||''}`);
          await connection.execute('INSERT INTO prescripcion (ID_HISTORIAL,ID_PACIENTE,ID_MEDICAMENTO,DOSIS,FRECUENCIA,DURACION,INDICACIONES) VALUES (?,?,?,?,?,?,?)',[insert.insertId,appointment.ID_PACIENTE,medicine.ID_MEDICAMENTO,String(prescription.dose||'').slice(0,100),String(prescription.frequency||'').slice(0,100),String(prescription.duration||'').slice(0,100),String(prescription.indications||'').slice(0,500)||null]);
        }
        await connection.execute('UPDATE cita SET ESTADO=\'Finalizada\',FINALIZACION_EN=NOW(3) WHERE ID_CITA=?',[appointment.ID_CITA]);
        return insert.insertId;
      });
      sendJson(response,201,{id:String(result)});
      return true;
    }

    if (url.pathname === '/api/admin/medications' && request.method === 'POST') {
      requireRole(user,'admin');
      const body=await requestBody(request);
      const medicine=String(body.name||'').trim();
      if(medicine.length<3) throw fail(400,'Escribe un nombre válido para el medicamento.');
      const result=await transaction('medication.created',async(connection)=>{
        const [insert]=await connection.execute('INSERT INTO medicamento (NOMBRE,CODIGO,DESCRIPCION,FABRICANTE) VALUES (?,?,?,?)',[medicine,String(body.code||'').slice(0,40)||null,String(body.description||'').slice(0,500)||null,String(body.company||'').slice(0,120)||null]);
        await connection.execute('INSERT INTO inventario_medicamento (ID_MEDICAMENTO,EXISTENCIAS,ACTUALIZADO_POR) VALUES (?,?,?)',[insert.insertId,Math.max(0,Number(body.stock)||0),user.databaseId]);
        return insert.insertId;
      });
      sendJson(response,201,{id:String(result)});
      return true;
    }

    const stockId=url.pathname.match(/^\/api\/admin\/medications\/(\d+)\/stock$/)?.[1];
    if(stockId&&request.method==='PATCH'){
      requireRole(user,'admin');const body=await requestBody(request);const amount=Number(body.stock);
      if(!Number.isSafeInteger(amount)||amount<0) throw fail(400,'El stock debe ser un entero no negativo.');
      await transaction('medication.stock.updated',async(connection)=>{
        const [[row]]=await connection.execute('SELECT EXISTENCIAS FROM inventario_medicamento WHERE ID_MEDICAMENTO=? FOR UPDATE',[stockId]);
        if(!row) throw fail(404,'Medicamento no encontrado.');
        const before=Number(row.EXISTENCIAS);await connection.execute('UPDATE inventario_medicamento SET EXISTENCIAS=?,ACTUALIZADO_POR=? WHERE ID_MEDICAMENTO=?',[amount,user.databaseId,stockId]);
        if(before!==amount) await connection.execute(`INSERT INTO movimiento_inventario (ID_MEDICAMENTO,ID_USUARIO,TIPO,CAMBIO,EXISTENCIAS_ANTES,EXISTENCIAS_DESPUES,MOTIVO) VALUES (?,?,'ajuste',?,?,?,?)`,[stockId,user.databaseId,amount-before,before,amount,String(body.reason||'Ajuste administrativo').slice(0,255)]);
      });
      sendJson(response,200,{ok:true});return true;
    }

    if(url.pathname==='/api/deliveries'&&request.method==='POST'){
      requireRole(user,'patient');const body=await requestBody(request);const ids=[...new Set((body.prescriptionIds||[]).map((value)=>Number(String(value).replace(/\D/g,''))).filter(Number.isInteger))];
      if(!ids.length||!body.address||!body.phone)throw fail(400,'Incluye dirección, teléfono y al menos una fórmula.');
      const result=await transaction('delivery.created',async(connection)=>{
        const [prescriptions]=await connection.query(`SELECT ID_PRESCRIPCION,ID_MEDICAMENTO FROM prescripcion WHERE ID_PACIENTE=? AND ID_PRESCRIPCION IN (${ids.map(()=>'?').join(',')}) FOR UPDATE`,[user.databaseId,...ids]);
        if(prescriptions.length!==ids.length)throw fail(400,'La fórmula no corresponde a tu cuenta.');
      const email=String(body.email||'').trim().toLowerCase();
      if(!/^\S+@\S+\.\S+$/.test(email))throw fail(400,'Ingresa un correo de contacto válido.');
      const [created]=await connection.execute('INSERT INTO solicitud_envio (ID_PACIENTE,DIRECCION_ENTREGA,TELEFONO_CONTACTO,EMAIL_CONTACTO,NOTAS_ENTREGA,METODO_PAGO) VALUES (?,?,?,?,?,?)',[user.databaseId,String(body.address).trim().slice(0,255),String(body.phone).trim().slice(0,30),email,String(body.deliveryNotes||'').trim().slice(0,500)||null,body.paymentMethod==='contra_entrega'?'contra_entrega':'en_linea']);
        for(const p of prescriptions){const [[stock]]=await connection.execute('SELECT EXISTENCIAS FROM inventario_medicamento WHERE ID_MEDICAMENTO=? FOR UPDATE',[p.ID_MEDICAMENTO]);if(!stock||Number(stock.EXISTENCIAS)<1)throw fail(409,'No hay stock suficiente.');const before=Number(stock.EXISTENCIAS);await connection.execute('UPDATE inventario_medicamento SET EXISTENCIAS=EXISTENCIAS-1 WHERE ID_MEDICAMENTO=?',[p.ID_MEDICAMENTO]);await connection.execute('INSERT INTO detalle_solicitud (ID_SOLICITUD,ID_PACIENTE,ID_PRESCRIPCION,CANTIDAD) VALUES (?,?,?,1)',[created.insertId,user.databaseId,p.ID_PRESCRIPCION]);await connection.execute(`INSERT INTO movimiento_inventario (ID_MEDICAMENTO,ID_USUARIO,ID_SOLICITUD,TIPO,CAMBIO,EXISTENCIAS_ANTES,EXISTENCIAS_DESPUES,MOTIVO) VALUES (?,?,?,'reserva',-1,?,?,?)`,[p.ID_MEDICAMENTO,user.databaseId,created.insertId,before,before-1,'Reserva por solicitud']);}
      await connection.execute('INSERT INTO historial_estado_envio (ID_SOLICITUD,ID_USUARIO,ESTADO_ANTERIOR,ESTADO_NUEVO,NOTA) VALUES (?,?,NULL,\'Recibido\',?)',[created.insertId,user.databaseId,'Pedido creado']);return created.insertId;
      });
      sendJson(response,201,{id:String(result)});return true;
    }

    const payId=url.pathname.match(/^\/api\/deliveries\/(\d+)\/pay$/)?.[1];
    if(payId&&request.method==='POST'){
      requireRole(user,'patient');await transaction('delivery.paid',async(connection)=>{const [[order]]=await connection.execute('SELECT ID_PACIENTE,ESTADO_PAGO FROM solicitud_envio WHERE ID_SOLICITUD=? FOR UPDATE',[payId]);if(!order||Number(order.ID_PACIENTE)!==user.databaseId)throw fail(404,'Pedido no encontrado.');if(order.ESTADO_PAGO!=='Pendiente')throw fail(409,'El pago ya fue procesado.');await connection.execute('UPDATE solicitud_envio SET ESTADO_PAGO=\'Pagado\',REFERENCIA_PAGO=? WHERE ID_SOLICITUD=?',[`DEMO-${Date.now()}`,payId]);});sendJson(response,200,{ok:true});return true;
    }

    const orderStatusId=url.pathname.match(/^\/api\/admin\/deliveries\/(\d+)\/status$/)?.[1];
    if(orderStatusId&&request.method==='PATCH'){
      requireRole(user,'admin');const body=await requestBody(request);const next=String(body.status||'');if(!['Preparando','Enviado','Entregado','Cancelado'].includes(next))throw fail(400,'Estado de envío inválido.');
      await transaction('delivery.status.updated',async(connection)=>{
        const [[order]]=await connection.execute('SELECT ESTADO_ENVIO,ID_PACIENTE FROM solicitud_envio WHERE ID_SOLICITUD=? FOR UPDATE',[orderStatusId]);
        if(!order)throw fail(404,'Pedido no encontrado.');
        const previous=order.ESTADO_ENVIO;
        const allowed={Recibido:['Preparando','Cancelado'],Preparando:['Enviado','Cancelado'],Enviado:['Entregado']};
        if(!allowed[previous]?.includes(next))throw fail(409,'Transición de estado inválida.');
        if(next==='Cancelado'){
          const [items]=await connection.execute(`SELECT ds.CANTIDAD,pr.ID_MEDICAMENTO FROM detalle_solicitud ds JOIN prescripcion pr ON pr.ID_PRESCRIPCION=ds.ID_PRESCRIPCION WHERE ds.ID_SOLICITUD=?`,[orderStatusId]);
          for(const item of items){
            const [[stock]]=await connection.execute('SELECT EXISTENCIAS FROM inventario_medicamento WHERE ID_MEDICAMENTO=? FOR UPDATE',[item.ID_MEDICAMENTO]);
            const before=Number(stock?.EXISTENCIAS||0);const amount=Number(item.CANTIDAD);
            await connection.execute('UPDATE inventario_medicamento SET EXISTENCIAS=EXISTENCIAS+? WHERE ID_MEDICAMENTO=?',[amount,item.ID_MEDICAMENTO]);
            await connection.execute(`INSERT INTO movimiento_inventario (ID_MEDICAMENTO,ID_USUARIO,ID_SOLICITUD,TIPO,CAMBIO,EXISTENCIAS_ANTES,EXISTENCIAS_DESPUES,MOTIVO) VALUES (?,?,?,'devolucion',?,?,?,?)`,[item.ID_MEDICAMENTO,user.databaseId,orderStatusId,amount,before,before+amount,'Pedido cancelado; devolución al inventario']);
          }
        }
        await connection.execute('UPDATE solicitud_envio SET ESTADO_ENVIO=? WHERE ID_SOLICITUD=?',[next,orderStatusId]);
        await connection.execute('INSERT INTO historial_estado_envio (ID_SOLICITUD,ID_USUARIO,ESTADO_ANTERIOR,ESTADO_NUEVO,NOTA) VALUES (?,?,?,?,?)',[orderStatusId,user.databaseId,previous,next,String(body.note||'').slice(0,500)||null]);
      });sendJson(response,200,{ok:true});return true;
    }
    sendJson(response, 404, { error: 'Ruta de datos no encontrada.' });
  } catch (error) {
    if (!error.status) console.error('Live data request failed', {
      route: url.pathname,
      code: error.code || error.name || 'DatabaseError',
      sqlState: error.sqlState || undefined,
      message: error.sqlMessage || error.message || 'Unknown error',
    });
    sendJson(response, error.status || 500, { error: error.status ? error.message : 'No se pudieron consultar los datos en MySQL.' });
  }
  return true;
}
