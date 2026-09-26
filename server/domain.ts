import type { State, Order, Delivery, Scenario, Command, Envelope } from '../src/types.js';

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const id = () => crypto.randomUUID();
const iso = (now: number) => new Date(now).toISOString();
export const scenarios: Scenario[] = ['approved', 'declined', 'delayed', 'duplicate'];
function audit(
  s: State,
  orderId: string | undefined,
  title: string,
  detail: string,
  tone: 'success' | 'warning' | 'danger' | 'info',
  now: number,
  kind: 'order' | 'payment' | 'delivery' | 'incident' | 'note' = 'delivery',
) {
  s.audit.unshift({ id: id(), orderId, title, detail, tone, timestamp: iso(now), kind });
}
function deliver(s: State, o: Order, eventId: string, fail: boolean, now: number) {
  const already = s.processedEvents.includes(eventId);
  const result = already ? 'ignored' : fail ? 'failed' : 'processed';
  const d: Delivery = {
    id: id(),
    eventId,
    orderId: o.id,
    type: o.payment === 'approved' ? 'payment.succeeded' : 'payment.failed',
    result,
    httpStatus: fail && !already ? 503 : 200,
    timestamp: iso(now),
    attempt: s.deliveries.filter((e) => e.eventId === eventId).length + 1,
    reason: already
      ? 'Evento ya procesado: no se repite la operación.'
      : fail
        ? 'El receptor de notificaciones no respondió (503).'
        : o.payment === 'declined'
          ? 'Rechazo simulado: fondos insuficientes.'
          : 'Confirmación aplicada al pedido.',
    payload: {
      id: eventId,
      type: o.payment === 'approved' ? 'payment.succeeded' : 'payment.failed',
      data: { order_id: o.id, amount: o.amount, currency: 'DOP', status: o.payment },
      simulated: true,
    },
  };
  s.deliveries.unshift(d);
  if (!fail && !already) {
    s.processedEvents.push(eventId);
    o.status = o.payment === 'approved' ? 'confirmed' : 'failed';
    if (o.payment === 'approved') o.captures += 1;
  }
  audit(
    s,
    o.id,
    result === 'ignored'
      ? 'Duplicado descartado'
      : result === 'failed'
        ? 'Notificación sin entregar'
        : 'Notificación procesada',
    d.reason,
    result === 'ignored'
      ? 'info'
      : result === 'failed'
        ? 'warning'
        : o.payment === 'declined'
          ? 'danger'
          : 'success',
    now,
  );
  return d;
}
function makeIncident(
  s: State,
  o: Order,
  title: string,
  severity: 'high' | 'medium' | 'low',
  now: number,
) {
  const existing = s.incidents.find((i) => i.orderId === o.id && i.status !== 'resolved');
  if (existing) return existing;
  const i = {
    id: id(),
    number: Math.max(200, ...s.incidents.map((i) => i.number)) + 1,
    orderId: o.id,
    title,
    severity,
    status: 'open' as const,
    createdAt: iso(now),
    updatedAt: iso(now),
    notes: [],
  };
  s.incidents.unshift(i);
  audit(s, o.id, 'Incidencia abierta', title, 'warning', now, 'incident');
  return i;
}
export function createOrder(
  s: State,
  scenario: Scenario,
  now: number,
  customer = 'Mariana Rodríguez',
  amount = 349000,
  product = 'Auriculares Studio',
) {
  const o: Order = {
    id: id(),
    number: Math.max(1040, ...s.orders.map((o) => o.number)) + 1,
    customer,
    email: 'cliente@ejemplo.test',
    product,
    amount,
    currency: 'DOP',
    payment: scenario === 'declined' ? 'declined' : 'approved',
    status: 'pending',
    scenario,
    createdAt: iso(now),
    eventId: `evt_${id()}`,
    captures: 0,
  };
  s.orders.unshift(o);
  audit(s, o.id, 'Pedido creado', `${product} · Tienda Horizonte`, 'info', now, 'order');
  audit(
    s,
    o.id,
    o.payment === 'approved' ? 'Pago aprobado por el simulador' : 'Pago rechazado por el simulador',
    o.payment === 'approved'
      ? 'El proveedor ficticio confirma el pago.'
      : 'Fondos insuficientes en el escenario de prueba.',
    o.payment === 'approved' ? 'success' : 'danger',
    now + 150,
    'payment',
  );
  deliver(s, o, o.eventId, scenario === 'delayed', now + 300);
  if (scenario === 'duplicate') deliver(s, o, o.eventId, false, now + 600);
  if (scenario === 'delayed')
    makeIncident(s, o, 'Pago aprobado, pedido pendiente', 'high', now + 700);
  if (scenario === 'declined')
    makeIncident(s, o, 'Cliente necesita ayuda con un pago rechazado', 'medium', now + 700);
  return o;
}
export function seed(now = Date.now()): State {
  const s: State = {
    schema: 1,
    orders: [],
    deliveries: [],
    incidents: [],
    audit: [],
    processedEvents: [],
    requests: {},
    createdAt: iso(now),
  };
  const names = [
    'Valentina Cruz',
    'José Martínez',
    'Laura Méndez',
    'Carlos Peña',
    'Ana Castillo',
    'Luis Pérez',
    'Camila Santos',
    'Andrés Vargas',
    'Sofía Díaz',
    'Daniel Ramos',
    'Mariana Rodríguez',
    'Gabriel Torres',
  ];
  const products = [
    'Teclado mecánico',
    'Lámpara de escritorio',
    'Mochila Everyday',
    'Soporte para laptop',
    'Auriculares Studio',
    'Mouse inalámbrico',
  ];
  const amounts = [249000, 179000, 429000, 159000, 349000, 129000];
  for (let n = 0; n < 12; n++)
    createOrder(
      s,
      n === 10 ? 'delayed' : n === 9 ? 'declined' : n === 7 ? 'duplicate' : 'approved',
      now - (12 - n) * 45 * 60 * 1000,
      names[n],
      amounts[n % 6],
      products[n % 6],
    );
  return s;
}
function string(v: unknown, min: number, max: number, label: string) {
  if (typeof v !== 'string' || v.trim().length < min || v.trim().length > max)
    throw new AppError(400, `${label}: usa entre ${min} y ${max} caracteres.`);
  return v.trim();
}
export function validate(input: unknown): Command {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new AppError(400, 'Solicitud no válida.');
  const c = input as Record<string, unknown>;
  const requestId = string(c.requestId, 8, 100, 'Identificador');
  const type = c.type;
  if (type === 'simulate') {
    if (!scenarios.includes(c.scenario as Scenario))
      throw new AppError(400, 'Elige un escenario válido.');
    if (
      c.amount !== undefined &&
      (!Number.isSafeInteger(c.amount) || Number(c.amount) < 100 || Number(c.amount) > 100000000)
    )
      throw new AppError(400, 'El importe debe estar entre RD$1 y RD$1,000,000.');
    return {
      type,
      scenario: c.scenario as Scenario,
      customer: c.customer === undefined ? undefined : string(c.customer, 2, 60, 'Nombre'),
      amount: c.amount as number | undefined,
      requestId,
    };
  }
  if (type === 'retry' || type === 'duplicate')
    return { type, orderId: string(c.orderId, 8, 100, 'Pedido'), requestId };
  if (type === 'incident') {
    if (!['high', 'medium', 'low'].includes(String(c.severity)))
      throw new AppError(400, 'Prioridad no válida.');
    return {
      type,
      orderId: string(c.orderId, 8, 100, 'Pedido'),
      title: string(c.title, 5, 140, 'Título'),
      severity: c.severity as 'high' | 'medium' | 'low',
      requestId,
    };
  }
  if (type === 'status') {
    if (!['open', 'investigating', 'resolved'].includes(String(c.status)))
      throw new AppError(400, 'Estado no válido.');
    return {
      type,
      incidentId: string(c.incidentId, 8, 100, 'Incidencia'),
      status: c.status as 'open' | 'investigating' | 'resolved',
      requestId,
    };
  }
  if (type === 'note')
    return {
      type,
      incidentId: string(c.incidentId, 8, 100, 'Incidencia'),
      text: string(c.text, 1, 1200, 'Nota'),
      requestId,
    };
  if (type === 'reset') return { type, requestId };
  throw new AppError(400, 'Acción no reconocida.');
}
export function execute(
  input: State,
  c: Command,
  now = Date.now(),
): { state: State; result: NonNullable<Envelope['result']> } {
  const s = structuredClone(input);
  if (Object.hasOwn(s.requests, c.requestId)) {
    const saved = s.requests[c.requestId];
    return {
      state: s,
      result: saved.startsWith('{')
        ? JSON.parse(saved)
        : {
            orderId: saved.startsWith('action:') ? undefined : saved,
            message: 'Esta solicitud ya fue aplicada.',
          },
    };
  }
  if (c.type === 'reset') {
    const fresh = seed(now);
    const result = { message: 'Tu espacio de prueba está como nuevo.' };
    Object.defineProperty(fresh.requests, c.requestId, {
      value: JSON.stringify(result),
      enumerable: true,
      writable: true,
      configurable: true,
    });
    return { state: fresh, result };
  }
  if (s.orders.length >= 200 && c.type === 'simulate')
    throw new AppError(409, 'Llegaste a 200 pedidos de prueba. Reinicia la demo para continuar.');
  let result: NonNullable<Envelope['result']> = { message: 'Cambios guardados.' };
  if (c.type === 'simulate') {
    const o = createOrder(s, c.scenario, now, c.customer, c.amount);
    result = { orderId: o.id, message: 'Escenario ejecutado. Abre el pedido para investigar.' };
  } else if (c.type === 'retry' || c.type === 'duplicate' || c.type === 'incident') {
    const o = s.orders.find((o) => o.id === c.orderId);
    if (!o) throw new AppError(404, 'Pedido no encontrado.');
    result.orderId = o.id;
    if (c.type === 'retry') {
      if (o.status === 'confirmed') throw new AppError(409, 'Este pedido ya está confirmado.');
      if (o.payment === 'declined') {
        o.payment = 'approved';
        o.eventId = `evt_${id()}`;
        audit(
          s,
          o.id,
          'Nuevo intento de pago simulado',
          'El simulador aprueba un nuevo intento; no se modificó el evento rechazado.',
          'success',
          now,
          'payment',
        );
      }
      deliver(s, o, o.eventId, false, now + 100);
      result.message = 'Pedido confirmado. La incidencia queda lista para documentar y cerrar.';
    } else if (c.type === 'duplicate') {
      if (o.status !== 'confirmed')
        throw new AppError(409, 'Primero confirma el pedido para probar un duplicado.');
      deliver(s, o, o.eventId, false, now);
      result.message = 'Evento repetido descartado. El pago se aplica una sola vez.';
    } else {
      const i = makeIncident(s, o, c.title, c.severity, now);
      result = { orderId: o.id, incidentId: i.id, message: 'Incidencia disponible en tu bandeja.' };
    }
  } else {
    const i = s.incidents.find((i) => i.id === c.incidentId);
    if (!i) throw new AppError(404, 'Incidencia no encontrada.');
    result.incidentId = i.id;
    result.orderId = i.orderId;
    i.updatedAt = iso(now);
    if (c.type === 'note') {
      if (i.notes.length >= 100)
        throw new AppError(409, 'Esta incidencia alcanzó su límite de notas.');
      i.notes.push({ id: id(), text: c.text, timestamp: iso(now), author: 'Equipo de soporte' });
      audit(s, i.orderId, 'Nota añadida', `Caso NX-${i.number}`, 'info', now, 'note');
      result.message = 'Nota guardada.';
    } else {
      if (c.status === 'resolved') {
        if (!i.notes.length)
          throw new AppError(409, 'Añade una nota explicando la solución antes de cerrar el caso.');
        const o = s.orders.find((o) => o.id === i.orderId);
        if (o?.status === 'pending')
          throw new AppError(
            409,
            'El pedido sigue pendiente. Recupera la notificación antes de cerrar el caso.',
          );
      }
      i.status = c.status;
      audit(
        s,
        i.orderId,
        c.status === 'resolved'
          ? 'Incidencia resuelta'
          : c.status === 'investigating'
            ? 'Investigación iniciada'
            : 'Incidencia reabierta',
        `Caso NX-${i.number}`,
        c.status === 'resolved' ? 'success' : 'info',
        now,
        'incident',
      );
    }
  }
  Object.defineProperty(s.requests, c.requestId, {
    value: JSON.stringify(result),
    enumerable: true,
    writable: true,
    configurable: true,
  });
  if (s.deliveries.length > 1500 || s.audit.length > 3000 || Object.keys(s.requests).length > 2000)
    throw new AppError(409, 'Tu demo alcanzó el límite de actividad. Reiníciala para seguir.');
  return { state: s, result };
}
