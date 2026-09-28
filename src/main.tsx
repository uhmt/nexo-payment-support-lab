import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Code2,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileJson,
  FlaskConical,
  LayoutDashboard,
  LifeBuoy,
  Link2,
  LoaderCircle,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Package,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  TriangleAlert,
  Webhook,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import type { State, Order, Scenario, Incident, Command, Envelope, Delivery } from './types';
import './style.css';

type View = 'overview' | 'orders' | 'simulator' | 'incidents' | 'activity' | 'guide';
type CommandInput = Command extends infer C
  ? C extends Command
    ? Omit<C, 'requestId'>
    : never
  : never;
const money = (n: number) =>
  new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    maximumFractionDigits: 2,
  }).format(n / 100);
const time = (s: string) =>
  new Intl.DateTimeFormat('es-DO', { hour: '2-digit', minute: '2-digit', hour12: false }).format(
    new Date(s),
  );
const date = (s: string) =>
  new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(s));
const initials = (s: string) =>
  s
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');
const labels = {
  confirmed: 'Confirmado',
  pending: 'Pendiente',
  failed: 'Fallido',
  approved: 'Aprobado',
  declined: 'Rechazado',
  open: 'Abierta',
  investigating: 'En investigación',
  resolved: 'Resuelta',
  processed: 'Procesado',
  ignored: 'Duplicado ignorado',
};
const scenarioData: Record<
  Scenario,
  {
    title: string;
    tag: string;
    description: string;
    icon: typeof Check;
    className: string;
    action: string;
    lesson: string;
  }
> = {
  approved: {
    title: 'Todo en orden',
    tag: 'EL PUNTO DE PARTIDA',
    description:
      'El pago se aprueba y la confirmación llega al pedido. Conoce el recorrido completo.',
    icon: CheckCircle2,
    className: 'green',
    action: 'Simular pago aprobado',
    lesson: 'El proveedor confirma el pago, el evento se procesa y el pedido queda confirmado.',
  },
  declined: {
    title: 'Pago rechazado',
    tag: 'ESCENARIO 01',
    description: 'El cliente no logra pagar. Investiga el rechazo y prueba un nuevo intento.',
    icon: CreditCard,
    className: 'red',
    action: 'Simular rechazo',
    lesson:
      'El rechazo pertenece al intento original. Un nuevo intento genera un evento nuevo y conserva el historial.',
  },
  delayed: {
    title: 'La conexión perdida',
    tag: 'ESCENARIO 02',
    description: 'El pago fue aprobado, pero el pedido sigue pendiente. Una notificación no llegó.',
    icon: Webhook,
    className: 'amber',
    action: 'Simular notificación fallida',
    lesson:
      'El estado del pago y el del pedido pueden diferir. Recuperar la notificación sincroniza ambos sin cobrar de nuevo.',
  },
  duplicate: {
    title: 'Dos eventos. Un pago.',
    tag: 'ESCENARIO 03',
    description:
      'La misma confirmación llega dos veces. Comprueba que el pedido se procesa una sola vez.',
    icon: Copy,
    className: 'purple',
    action: 'Simular duplicado',
    lesson:
      'El identificador del evento permite reconocer un duplicado. Se registra la entrega, pero no se repite su efecto.',
  },
};

function Badge({ status }: { status: string }) {
  return (
    <span className={`badge ${status}`}>
      <span />
      {(labels as Record<string, string>)[status] || status}
    </span>
  );
}
function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Search size={28} />
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = prevOverflow;
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Cerrar" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function App() {
  const [data, setData] = useState<Envelope | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [view, setView] = useState<View>(() => {
    const v = location.hash.slice(1);
    return ['overview', 'orders', 'simulator', 'incidents', 'activity', 'guide'].includes(v)
      ? (v as View)
      : 'overview';
  });
  const [query, setQuery] = useState(''),
    [statusFilter, setStatusFilter] = useState('all'),
    [sort, setSort] = useState('recent'),
    [period, setPeriod] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null),
    [incidentId, setIncidentId] = useState<string | null>(null),
    [newIncident, setNewIncident] = useState<string | null>(null),
    [reset, setReset] = useState(false),
    [mobile, setMobile] = useState(false),
    [lastRun, setLastRun] = useState<string | null>(null);
  const [amount, setAmount] = useState('3490'),
    [customer, setCustomer] = useState('Mariana Rodríguez');
  const [payload, setPayload] = useState<Delivery | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const requestLock = useRef(false);
  const mounted = useRef(true);
  const go = (v: View) => {
    setView(v);
    location.hash = v;
    setQuery('');
    setStatusFilter('all');
    setMobile(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const load = useCallback(async () => {
    setError('');
    try {
      const r = await fetch('/api/state', { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo cargar la demo.');
      if (mounted.current) setData((prev) => (!prev || d.version >= prev.version ? d : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo conectar.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    load();
    const hash = () => {
      const v = location.hash.slice(1);
      if (['overview', 'orders', 'simulator', 'incidents', 'activity', 'guide'].includes(v)) {
        setView(v as View);
        setQuery('');
        setStatusFilter('all');
      }
    };
    window.addEventListener('hashchange', hash);
    return () => {
      mounted.current = false;
      window.removeEventListener('hashchange', hash);
    };
  }, [load]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  async function command(c: CommandInput) {
    if (!data || requestLock.current) return;
    requestLock.current = true;
    setBusy(true);
    const body = JSON.stringify({ ...c, requestId: crypto.randomUUID() });
    try {
      let response: Response;
      try {
        response = await fetch('/api/commands', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': data.csrf },
          body,
        });
      } catch {
        response = await fetch('/api/commands', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': data.csrf },
          body,
        });
      }
      const next = await response.json();
      if (!response.ok) throw new Error(next.error || 'No se pudo guardar.');
      setData((prev) => (!prev || next.version >= prev.version ? next : prev));
      setToast({ text: next.result?.message || 'Cambios guardados.' });
      return next as Envelope;
    } catch (e) {
      setToast({
        text: e instanceof Error ? e.message : 'No se pudo conectar. Vuelve a intentarlo.',
        error: true,
      });
    } finally {
      requestLock.current = false;
      setBusy(false);
    }
  }
  const closeOrder = useCallback(() => setSelectedId(null), []);
  const closeIncident = useCallback(() => setIncidentId(null), []);
  const closeNew = useCallback(() => setNewIncident(null), []);
  const closeReset = useCallback(() => setReset(false), []);
  const closePayload = useCallback(() => {
    setSelectedId(payload?.orderId || null);
    setPayload(null);
  }, [payload]);
  const state = data?.state;
  const orders = state?.orders || [];
  const incidents = state?.incidents || [];
  const active = incidents.filter((i) => i.status !== 'resolved');
  const selected = orders.find((o) => o.id === selectedId);
  const selectedIncident = incidents.find((i) => i.id === incidentId);
  const filtered = useMemo(
    () =>
      orders
        .filter(
          (o) =>
            (period === 'all' || Date.now() - new Date(o.createdAt).getTime() < 3600000 * 3) &&
            (statusFilter === 'all' || o.status === statusFilter) &&
            `${o.number} ${o.customer} ${o.product}`.toLowerCase().includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === 'amount'
            ? b.amount - a.amount
            : sort === 'oldest'
              ? a.createdAt.localeCompare(b.createdAt)
              : b.createdAt.localeCompare(a.createdAt),
        ),
    [orders, period, statusFilter, query, sort],
  );
  const scope = orders.filter(
    (o) => period === 'all' || Date.now() - new Date(o.createdAt).getTime() < 3600000 * 3,
  );
  const confirmed = scope.filter((o) => o.status === 'confirmed'),
    pending = scope.filter((o) => o.status === 'pending');
  const approved = scope.filter((o) => o.payment === 'approved');
  const recommended =
    orders.find((o) => o.status === 'pending') || orders.find((o) => o.status === 'failed');
  const nav = [
    { id: 'overview', name: 'Resumen', icon: LayoutDashboard },
    { id: 'orders', name: 'Pedidos', icon: Package },
    { id: 'incidents', name: 'Incidencias', icon: LifeBuoy },
    { id: 'activity', name: 'Actividad', icon: Activity },
  ] as const;
  const navButton = (id: View, name: string, Icon: typeof Check, count?: number) => (
    <button key={id} className={`nav-item ${view === id ? 'selected' : ''}`} onClick={() => go(id)}>
      <Icon size={19} />
      <span>{name}</span>
      {!!count && <b>{count}</b>}
    </button>
  );
  const exportOrders = () => {
    const cell = (v: string) => `"${(/^[=+@-]/.test(v) ? "'" : '') + v.replaceAll('"', '""')}"`;
    const csv =
      '\uFEFF' +
      [
        'Pedido,Cliente,Producto,Importe DOP,Estado,Pago,Fecha',
        ...filtered.map((o) =>
          [
            o.number,
            cell(o.customer),
            cell(o.product),
            (o.amount / 100).toFixed(2),
            labels[o.status],
            labels[o.payment],
            o.createdAt,
          ].join(','),
        ),
      ].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nexo-pedidos.csv';
    a.click();
    URL.revokeObjectURL(url);
    setToast({ text: 'Pedidos exportados a CSV.' });
  };
  const table = (list: Order[]) =>
    list.length ? (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Pedido / cliente</th>
              <th>Producto</th>
              <th>Importe</th>
              <th>Estado</th>
              <th>Creado</th>
              <th>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((o, n) => (
              <tr key={o.id}>
                <td>
                  <button
                    className="customer-cell"
                    onClick={() => setSelectedId(o.id)}
                    aria-label={`Abrir pedido ${o.number} de ${o.customer}`}
                  >
                    <span className={`avatar avatar-${n % 5}`}>{initials(o.customer)}</span>
                    <span>
                      <strong>{o.customer}</strong>
                      <small>NX-{o.number}</small>
                    </span>
                  </button>
                </td>
                <td className="product-cell">{o.product}</td>
                <td className="amount">{money(o.amount)}</td>
                <td>
                  <Badge status={o.status} />
                </td>
                <td className="muted nowrap">{time(o.createdAt)}</td>
                <td>
                  <button
                    className="row-arrow"
                    aria-label={`Ver pedido NX-${o.number}`}
                    onClick={() => setSelectedId(o.id)}
                  >
                    <ArrowUpRight size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty
        title="No encontramos pedidos"
        detail="Prueba otro nombre, número de pedido o filtro."
        action={
          <button
            className="button secondary"
            onClick={() => {
              setQuery('');
              setStatusFilter('all');
              setPeriod('all');
            }}
          >
            Limpiar filtros
          </button>
        }
      />
    );
  if (loading)
    return (
      <div className="boot">
        <div className="brand-symbol">n</div>
        <h1>Nexo</h1>
        <LoaderCircle className="spin" />
        <p>Preparando tu laboratorio…</p>
      </div>
    );
  if (!state)
    return (
      <div className="boot">
        <TriangleAlert size={36} />
        <h1>No pudimos abrir Nexo</h1>
        <p>{error}</p>
        <button
          className="button primary"
          onClick={() => {
            setLoading(true);
            load();
          }}
        >
          Volver a intentar
        </button>
      </div>
    );
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Saltar al contenido
      </a>
      {mobile && (
        <button
          className="mobile-shade"
          aria-label="Cerrar menú"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? 'is-open' : ''}`}>
        <button className="brand" onClick={() => go('overview')} aria-label="Nexo, inicio">
          <span className="brand-symbol">n</span>
          <span>
            nexo<span className="brand-dot">.</span>
          </span>
        </button>
        <div className="workspace">
          <span className="shop-icon">
            <Package size={20} />
          </span>
          <span>
            <strong>Tienda Horizonte</strong>
            <small>Espacio de demostración</small>
          </span>
          <ChevronDown size={14} />
        </div>
        <p className="nav-label">OPERACIONES</p>
        <nav aria-label="Navegación principal">
          {nav.map((n) =>
            navButton(n.id, n.name, n.icon, n.id === 'incidents' ? active.length : undefined),
          )}
          <p className="nav-label lab-label">LABORATORIO</p>
          {navButton('simulator', 'Simulador', FlaskConical)}
          {navButton('guide', 'Cómo funciona', BookOpen)}
        </nav>
        <div className="sidebar-bottom">
          <div className="sandbox-card">
            <span className="sandbox-icon">
              <ShieldCheck size={19} />
            </span>
            <strong>Un espacio para explorar.</strong>
            <p>Datos ficticios. Ningún cobro real. Todos los escenarios son tuyos.</p>
            <button onClick={() => setReset(true)}>
              <RotateCcw size={14} /> Reiniciar demo
            </button>
          </div>
          <div className="creator">
            <span className="avatar avatar-3">DG</span>
            <span>
              <strong>Diego García</strong>
              <small>Proyecto de portafolio</small>
            </span>
            <Code2 size={16} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-toggle"
              onClick={() => setMobile(true)}
              aria-label="Abrir menú"
            >
              <Menu size={20} />
            </button>
            <span>Espacio de trabajo</span>
            <ChevronRight size={14} />
            <strong>
              {view === 'simulator'
                ? 'Simulador'
                : view === 'guide'
                  ? 'Cómo funciona'
                  : nav.find((n) => n.id === view)?.name}
            </strong>
          </div>
          <div className="top-actions">
            <span className="demo-pill">
              <span /> Modo demo
            </span>
            <button
              className="icon-button"
              aria-label="Actualizar datos"
              onClick={load}
              disabled={busy}
            >
              <RefreshCw size={17} />
            </button>
            <span className="avatar user-avatar">DG</span>
          </div>
        </header>
        <main id="main" className="main-content">
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button onClick={load}>Reintentar</button>
            </div>
          )}
          {(view === 'overview' || view === 'orders') && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">
                    {view === 'overview' ? 'CLARIDAD EN CADA TRANSACCIÓN' : 'DEL PAGO AL PEDIDO'}
                  </p>
                  <h1>
                    {view === 'overview' ? 'Centro de operaciones' : 'Tus pedidos, conectados.'}
                  </h1>
                  <p>
                    {view === 'overview'
                      ? 'El panorama completo. La próxima acción, clara.'
                      : 'Busca un pedido y sigue la historia detrás de cada transacción.'}
                  </p>
                </div>
                <button className="button primary" onClick={() => go('simulator')}>
                  <Plus size={17} /> Simular un pedido
                </button>
              </div>
              <div className="period-line">
                <div>
                  <span className="live-dot" /> Datos de tu sesión{' '}
                  <span className="period-divider">/</span>
                  <span>Moneda DOP</span>
                </div>
                <label className="select-inline">
                  <Clock3 size={14} />
                  <select
                    aria-label="Período de pedidos"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                  >
                    <option value="all">Toda la sesión</option>
                    <option value="recent">Últimas 3 horas</option>
                  </select>
                </label>
              </div>
              <section className="metrics" aria-label="Indicadores de pedidos">
                <Metric
                  title="Pagos aprobados"
                  value={money(approved.reduce((s, o) => s + o.amount, 0))}
                  icon={CreditCard}
                  note={`${approved.length} de ${scope.length} pagos`}
                  tone="green"
                  spark={[2, 4, 3, 6, 5, 7, 8]}
                />
                <Metric
                  title="Pedidos confirmados"
                  value={String(confirmed.length).padStart(2, '0')}
                  icon={CheckCircle2}
                  note={`${scope.length ? Math.round((confirmed.length / scope.length) * 100) : 0}% de los pedidos`}
                  tone="blue"
                  spark={[4, 3, 5, 4, 7, 6, 8]}
                />
                <Metric
                  title="Por sincronizar"
                  value={String(pending.length).padStart(2, '0')}
                  icon={Webhook}
                  note={
                    pending.length ? 'Pago aprobado, pedido pendiente' : 'Todo está sincronizado'
                  }
                  tone="amber"
                />
                <Metric
                  title="Incidencias activas"
                  value={String(active.length).padStart(2, '0')}
                  icon={LifeBuoy}
                  note={`${incidents.filter((i) => i.status === 'resolved').length} resueltas en esta sesión`}
                  tone="purple"
                />
              </section>
              {view === 'overview' && (
                <div className="overview-grid">
                  <section className="panel chart-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>El pulso de tus pagos</h2>
                        <p>Importe aprobado por hora · últimas 12 horas</p>
                      </div>
                      <span className="legend">
                        <span /> Aprobados
                      </span>
                    </div>
                    <PaymentChart orders={orders} />
                    <div className="chart-footer">
                      <span>
                        <ShieldCheck size={15} /> Datos del simulador
                      </span>
                      <strong>
                        {money(
                          orders
                            .filter(
                              (o) =>
                                o.payment === 'approved' &&
                                Date.now() - new Date(o.createdAt).getTime() < 12 * 3600000,
                            )
                            .reduce((a, o) => a + o.amount, 0),
                        )}
                        <span> / últimas 12 h</span>
                      </strong>
                    </div>
                  </section>
                  <section className="attention-card">
                    <div className="attention-top">
                      <span>
                        <Zap size={16} /> TU SIGUIENTE PASO
                      </span>
                      <span className="attention-orbit">
                        <Link2 size={26} />
                      </span>
                    </div>
                    {recommended ? (
                      <>
                        <span className="mini-badge">CASO PARA INVESTIGAR</span>
                        <h2>
                          {recommended.status === 'pending'
                            ? 'El pago llegó.\nEl pedido, todavía no.'
                            : 'Un rechazo también\ncuenta una historia.'}
                        </h2>
                        <p>
                          {recommended.status === 'pending'
                            ? 'Una notificación falló. Sigue el recorrido del pago y conecta las piezas.'
                            : 'Revisa la respuesta del proveedor y prueba un nuevo intento simulado.'}
                        </p>
                        <button
                          className="button attention-button"
                          onClick={() => setSelectedId(recommended.id)}
                        >
                          Investigar NX-{recommended.number}
                          <ArrowRight size={17} />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="mini-badge">TODO EN ORDEN</span>
                        <h2>Cada pieza\nen su lugar.</h2>
                        <p>
                          No hay pedidos pendientes ni fallidos. Pon el sistema a prueba con otro
                          escenario.
                        </p>
                        <button className="button attention-button" onClick={() => go('simulator')}>
                          Abrir el simulador
                          <ArrowRight size={17} />
                        </button>
                      </>
                    )}
                  </section>
                </div>
              )}
              <section className="panel orders-panel">
                <div className="panel-heading">
                  <div>
                    <h2>
                      {view === 'overview' ? 'Pedidos recientes' : 'Todos los pedidos'}{' '}
                      <span className="count-label">{filtered.length}</span>
                    </h2>
                    <p>Una sola vista para entender qué necesita atención.</p>
                  </div>
                  <button className="button ghost small" onClick={exportOrders}>
                    <Download size={15} /> Exportar
                  </button>
                </div>
                <div className="table-toolbar">
                  <div className="filter-tabs" aria-label="Filtrar pedidos">
                    {[
                      ['all', 'Todos'],
                      ['pending', 'Pendientes'],
                      ['failed', 'Fallidos'],
                      ['confirmed', 'Confirmados'],
                    ].map(([v, l]) => (
                      <button
                        key={v}
                        className={statusFilter === v ? 'active' : ''}
                        onClick={() => setStatusFilter(v)}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  <div className="search-control">
                    <Search size={16} />
                    <input
                      ref={searchRef}
                      placeholder="Buscar pedido o cliente"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      aria-label="Buscar pedido o cliente"
                    />
                    <kbd>/</kbd>
                  </div>
                  {view === 'orders' && (
                    <select
                      className="sort-select"
                      aria-label="Ordenar pedidos"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="recent">Más recientes</option>
                      <option value="oldest">Más antiguos</option>
                      <option value="amount">Mayor importe</option>
                    </select>
                  )}
                </div>
                {table(view === 'overview' ? filtered.slice(0, 6) : filtered)}
                <div className="table-footer">
                  <span>
                    {view === 'overview' ? Math.min(filtered.length, 6) : filtered.length} de{' '}
                    {filtered.length} pedidos
                  </span>
                  {view === 'overview' && (
                    <button onClick={() => go('orders')}>
                      Ver todos los pedidos
                      <ArrowRight size={15} />
                    </button>
                  )}
                </div>
              </section>
            </>
          )}
          {view === 'simulator' && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">ROMPE ALGO. ENTIÉNDELO. RESUÉLVELO.</p>
                  <h1>Tu laboratorio de pagos.</h1>
                  <p>Cuatro escenarios. Un entorno seguro para descubrir cómo funciona todo.</p>
                </div>
                <span className="label-outline">
                  <FlaskConical size={16} /> 100% simulado
                </span>
              </div>
              <div className="simulator-intro">
                <div className="intro-symbol">
                  <Webhook size={32} />
                </div>
                <div>
                  <h2>La mejor forma de entender un fallo es verlo pasar.</h2>
                  <p>
                    Cada escenario crea un pedido real en esta demo, registra sus eventos y conserva
                    el resultado en tu sesión.
                  </p>
                </div>
                <span className="intro-number">01 — 04</span>
              </div>
              <section className="simulation-settings">
                <div>
                  <h3>Personaliza tu prueba</h3>
                  <p>Usa únicamente datos ficticios.</p>
                </div>
                <label>
                  Cliente de prueba
                  <input
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    maxLength={60}
                  />
                </label>
                <label>
                  Importe en RD$
                  <input
                    type="number"
                    min="1"
                    max="1000000"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
              </section>
              <div className="scenario-grid">
                {Object.entries(scenarioData).map(([key, s]) => (
                  <article className={`scenario-card ${s.className}`} key={key}>
                    <div className="scenario-top">
                      <span className="scenario-icon">
                        <s.icon size={24} />
                      </span>
                      <span>{s.tag}</span>
                    </div>
                    <h2>{s.title}</h2>
                    <p>{s.description}</p>
                    <div className="scenario-route">
                      <span>Pedido</span>
                      <ChevronRight size={13} />
                      <span>Pago</span>
                      <ChevronRight size={13} />
                      <span>
                        {key === 'delayed'
                          ? '503'
                          : key === 'declined'
                            ? 'Rechazo'
                            : key === 'duplicate'
                              ? '×2 → ×1'
                              : '200 OK'}
                      </span>
                    </div>
                    <button
                      className="button scenario-button"
                      disabled={busy}
                      onClick={async () => {
                        const parsed = Number(amount);
                        if (
                          !customer.trim() ||
                          !Number.isFinite(parsed) ||
                          parsed < 1 ||
                          parsed > 1000000
                        ) {
                          setToast({
                            text: 'Indica un nombre y un importe entre RD$1 y RD$1,000,000.',
                            error: true,
                          });
                          return;
                        }
                        const r = await command({
                          type: 'simulate',
                          scenario: key as Scenario,
                          customer: customer.trim(),
                          amount: Math.round(parsed * 100),
                        });
                        if (r?.result?.orderId) setLastRun(r.result.orderId);
                      }}
                    >
                      {busy ? <LoaderCircle className="spin" size={16} /> : <Play size={15} />}{' '}
                      {s.action}
                    </button>
                  </article>
                ))}
              </div>
              {lastRun && orders.find((o) => o.id === lastRun) && (
                <div className="simulation-result" role="status">
                  <CheckCircle2 size={24} />
                  <div>
                    <h3>Tu escenario ya está en marcha.</h3>
                    <p>{scenarioData[orders.find((o) => o.id === lastRun)!.scenario].lesson}</p>
                  </div>
                  <button className="button primary" onClick={() => setSelectedId(lastRun)}>
                    Ver resultado
                    <ArrowUpRight size={16} />
                  </button>
                </div>
              )}
              <div className="learning-note">
                <BookOpen size={18} />
                <p>
                  <strong>Una idea para explorar:</strong> ejecuta «La conexión perdida», recupera
                  la notificación desde el pedido y después envía un duplicado. El pago debe seguir
                  aplicándose una sola vez.
                </p>
              </div>
            </>
          )}
          {view === 'incidents' && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">DE LA PREGUNTA A LA SOLUCIÓN</p>
                  <h1>Incidencias</h1>
                  <p>Investiga con contexto. Documenta lo aprendido. Cierra el círculo.</p>
                </div>
                <span className="label-outline">
                  <LifeBuoy size={16} /> {active.length} activas
                </span>
              </div>
              <div className="incident-summary">
                <div>
                  <span className="incident-dot open" />
                  <strong>{incidents.filter((i) => i.status === 'open').length}</strong>
                  <span>Abiertas</span>
                </div>
                <div>
                  <span className="incident-dot investigating" />
                  <strong>{incidents.filter((i) => i.status === 'investigating').length}</strong>
                  <span>En investigación</span>
                </div>
                <div>
                  <span className="incident-dot resolved" />
                  <strong>{incidents.filter((i) => i.status === 'resolved').length}</strong>
                  <span>Resueltas</span>
                </div>
              </div>
              <section className="panel">
                <div className="table-toolbar">
                  <div className="filter-tabs">
                    {[
                      ['all', 'Todas'],
                      ['open', 'Abiertas'],
                      ['investigating', 'En investigación'],
                      ['resolved', 'Resueltas'],
                    ].map(([v, l]) => (
                      <button
                        key={v}
                        className={statusFilter === v ? 'active' : ''}
                        onClick={() => setStatusFilter(v)}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  <div className="search-control">
                    <Search size={16} />
                    <input
                      ref={searchRef}
                      aria-label="Buscar incidencias"
                      placeholder="Buscar una incidencia"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                </div>
                <div className="incident-list">
                  {incidents
                    .filter(
                      (i) =>
                        (statusFilter === 'all' || i.status === statusFilter) &&
                        `${i.title} ${i.number}`.toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((i) => (
                      <button
                        key={i.id}
                        className="incident-row"
                        onClick={() => setIncidentId(i.id)}
                      >
                        <span className={`case-icon ${i.severity}`}>
                          <LifeBuoy size={20} />
                        </span>
                        <div className="case-main">
                          <span className="case-meta">
                            CASO NX-{i.number}
                            <span>·</span>Pedido NX-{orders.find((o) => o.id === i.orderId)?.number}
                          </span>
                          <h3>{i.title}</h3>
                          <p>
                            <MessageSquare size={13} />
                            {i.notes.length} notas <span>·</span> {date(i.updatedAt)}
                          </p>
                        </div>
                        <span className={`priority ${i.severity}`}>
                          {i.severity === 'high'
                            ? 'Alta'
                            : i.severity === 'medium'
                              ? 'Media'
                              : 'Baja'}
                        </span>
                        <Badge status={i.status} />
                        <ChevronRight className="case-arrow" size={18} />
                      </button>
                    ))}
                  {!incidents.some(
                    (i) =>
                      (statusFilter === 'all' || i.status === statusFilter) &&
                      `${i.title} ${i.number}`.toLowerCase().includes(query.toLowerCase()),
                  ) && (
                    <Empty
                      title="Tu bandeja está despejada"
                      detail="No hay incidencias que coincidan con estos filtros. Puedes abrir un caso desde cualquier pedido."
                    />
                  )}
                </div>
              </section>
            </>
          )}
          {view === 'activity' && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">NINGUNA PIEZA SE PIERDE</p>
                  <h1>Actividad del sistema</h1>
                  <p>La historia completa de tus pedidos, notificaciones y decisiones.</p>
                </div>
                <span className="label-outline">
                  <Activity size={16} />
                  {state.audit.length} eventos
                </span>
              </div>
              <section className="panel">
                <div className="table-toolbar">
                  <div className="filter-tabs">
                    {[
                      ['all', 'Todo'],
                      ['delivery', 'Notificaciones'],
                      ['payment', 'Pagos'],
                      ['incident', 'Incidencias'],
                    ].map(([v, l]) => (
                      <button
                        key={v}
                        className={statusFilter === v ? 'active' : ''}
                        onClick={() => setStatusFilter(v)}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  <div className="search-control">
                    <Search size={16} />
                    <input
                      ref={searchRef}
                      aria-label="Buscar actividad"
                      placeholder="Buscar en el historial"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                </div>
                <div className="audit-list">
                  {state.audit
                    .filter(
                      (e) =>
                        (statusFilter === 'all' || e.kind === statusFilter) &&
                        `${e.title} ${e.detail}`.toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((e) => (
                      <div className="audit-row" key={e.id}>
                        <span className={`audit-icon ${e.tone}`}>
                          {e.tone === 'success' ? (
                            <Check size={16} />
                          ) : e.tone === 'danger' ? (
                            <X size={16} />
                          ) : e.tone === 'warning' ? (
                            <TriangleAlert size={16} />
                          ) : (
                            <Activity size={16} />
                          )}
                        </span>
                        <div>
                          <strong>{e.title}</strong>
                          <p>{e.detail}</p>
                        </div>
                        <time>{date(e.timestamp)}</time>
                        {e.orderId && (
                          <button
                            className="row-arrow"
                            aria-label={`Abrir pedido de ${e.title}`}
                            onClick={() => setSelectedId(e.orderId!)}
                          >
                            <ArrowUpRight size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  {!state.audit.some(
                    (e) =>
                      (statusFilter === 'all' || e.kind === statusFilter) &&
                      `${e.title} ${e.detail}`.toLowerCase().includes(query.toLowerCase()),
                  ) && (
                    <Empty
                      title="Sin eventos en esta búsqueda"
                      detail="Prueba otro término o selecciona Todo."
                    />
                  )}
                </div>
              </section>
            </>
          )}
          {view === 'guide' && <Guide onStart={() => go('simulator')} />}
          <footer className="app-footer">
            <span>
              <span className="footer-mark">n</span>Nexo <span>Payment Support Lab</span>
            </span>
            <span>Diseñado para aprender. Construido para explorar.</span>
            <a
              href="https://github.com/uhmt/nexo-payment-support-lab"
              target="_blank"
              rel="noreferrer"
            >
              Por Diego García
              <ArrowUpRight size={13} />
            </a>
          </footer>
        </main>
      </div>
      {toast && (
        <div
          role={toast.error ? 'alert' : 'status'}
          className={`toast ${toast.error ? 'error' : ''}`}
        >
          {toast.error ? <TriangleAlert size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.text}</span>
          <button aria-label="Cerrar aviso" onClick={() => setToast(null)}>
            <X size={16} />
          </button>
        </div>
      )}
      {selected && (
        <Modal title={`Pedido NX-${selected.number}`} onClose={closeOrder} wide>
          <OrderDetail
            order={selected}
            state={state}
            busy={busy}
            command={command}
            onPayload={(d) => {
              setSelectedId(null);
              setPayload(d);
            }}
            onIncident={(id) => {
              setSelectedId(null);
              setIncidentId(id);
            }}
            onNewIncident={() => {
              setNewIncident(selected.id);
              setSelectedId(null);
            }}
          />
        </Modal>
      )}
      {selectedIncident && (
        <Modal title={`Incidencia NX-${selectedIncident.number}`} onClose={closeIncident} wide>
          <IncidentDetail
            incident={selectedIncident}
            order={orders.find((o) => o.id === selectedIncident.orderId)!}
            busy={busy}
            command={command}
            onOrder={() => {
              setSelectedId(selectedIncident.orderId);
              setIncidentId(null);
            }}
          />
        </Modal>
      )}
      {newIncident && (
        <Modal title="Abrir una incidencia" onClose={closeNew}>
          <IncidentForm
            busy={busy}
            onSubmit={async (title, severity) => {
              const r = await command({ type: 'incident', orderId: newIncident, title, severity });
              if (r?.result?.incidentId) {
                setNewIncident(null);
                setIncidentId(r.result.incidentId);
              }
            }}
          />
        </Modal>
      )}
      {reset && (
        <Modal title="¿Reiniciar tu demo?" onClose={closeReset}>
          <div className="modal-body">
            <div className="reset-icon">
              <RotateCcw size={30} />
            </div>
            <p>
              Se reemplazarán los pedidos, eventos, incidencias y notas de esta sesión por los
              ejemplos iniciales. Otras sesiones no se verán afectadas.
            </p>
            <div className="modal-actions">
              <button className="button secondary" onClick={closeReset}>
                Conservar mis datos
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={async () => {
                  const r = await command({ type: 'reset' });
                  if (r) {
                    setReset(false);
                    setLastRun(null);
                    go('overview');
                  }
                }}
              >
                {busy ? <LoaderCircle className="spin" size={16} /> : <RotateCcw size={16} />}
                Reiniciar
              </button>
            </div>
          </div>
        </Modal>
      )}
      {payload && (
        <Modal title="Evento de pago · JSON" onClose={closePayload}>
          <div className="modal-body">
            <div className="payload-header">
              <Badge status={payload.result} />
              <span>
                HTTP {payload.httpStatus} · intento {payload.attempt}
              </span>
            </div>
            <pre className="json-block">{JSON.stringify(payload.payload, null, 2)}</pre>
            <button
              className="button secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(JSON.stringify(payload.payload, null, 2));
                  setToast({ text: 'JSON copiado.' });
                } catch {
                  setToast({
                    text: 'No se pudo copiar. Puedes seleccionar el texto del evento.',
                    error: true,
                  });
                }
              }}
            >
              <Copy size={16} />
              Copiar JSON
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Metric({
  title,
  value,
  icon: Icon,
  note,
  tone,
}: {
  title: string;
  value: string;
  icon: typeof Check;
  note: string;
  tone: string;
  spark?: number[];
}) {
  return (
    <article className={`metric ${tone}`}>
      <div className="metric-top">
        <span>{title}</span>
        <Icon size={18} />
      </div>
      <strong>{value}</strong>
      <p>
        <span />
        {note}
      </p>
    </article>
  );
}

function PaymentChart({ orders }: { orders: Order[] }) {
  const now = Date.now();
  const points = Array.from({ length: 12 }, (_, i) => {
    const end = now - (11 - i) * 3600000;
    return orders
      .filter(
        (o) =>
          o.payment === 'approved' &&
          new Date(o.createdAt).getTime() > end - 3600000 &&
          new Date(o.createdAt).getTime() <= end,
      )
      .reduce((s, o) => s + o.amount / 100, 0);
  });
  const max = Math.max(...points, 1000);
  const coords = points.map((v, i) => [52 + i * 45, 166 - (v / max) * 128]);
  const path = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
  return (
    <div className="chart">
      <svg
        viewBox="0 0 585 207"
        role="img"
        aria-label={`Importe aprobado por hora, últimas 12 horas: ${points.map((n) => `RD$ ${n}`).join(', ')}`}
      >
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#66dfc1" stopOpacity=".22" />
            <stop offset="100%" stopColor="#66dfc1" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line
              x1="48"
              x2="560"
              y1={38 + i * 43}
              y2={38 + i * 43}
              stroke="#26303d"
              strokeDasharray="3 5"
            />
            <text x="0" y={42 + i * 43} fill="#718093" fontSize="10">
              {Math.round(((max * (1 - i / 3)) / 1000) * 10) / 10}k
            </text>
          </g>
        ))}
        <path d={`${path} L547,168 L52,168 Z`} fill="url(#chart-fill)" />
        <path d={path} fill="none" stroke="#72e7c9" strokeWidth="2.5" strokeLinejoin="round" />
        {coords.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="3" fill="#72e7c9">
              <title>{money(points[i] * 100)}</title>
            </circle>
            {i % 2 === 0 && (
              <text x={x} y="195" textAnchor="middle" fill="#718093" fontSize="10">
                {new Date(now - (11 - i) * 3600000).getHours().toString().padStart(2, '0')}:00
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function OrderDetail({
  order: o,
  state,
  busy,
  command,
  onPayload,
  onIncident,
  onNewIncident,
}: {
  order: Order;
  state: State;
  busy: boolean;
  command: (c: CommandInput) => Promise<Envelope | undefined>;
  onPayload: (d: Delivery) => void;
  onIncident: (id: string) => void;
  onNewIncident: () => void;
}) {
  const deliveries = state.deliveries.filter((d) => d.orderId === o.id);
  const trail = state.audit
    .filter((e) => e.orderId === o.id)
    .slice()
    .reverse();
  const related = state.incidents.filter((i) => i.orderId === o.id);
  return (
    <div className="modal-body order-detail">
      <div className="detail-identity">
        <span className="avatar large avatar-2">{initials(o.customer)}</span>
        <div>
          <h3>{o.customer}</h3>
          <p>
            {o.product} · {date(o.createdAt)}
          </p>
        </div>
        <strong>{money(o.amount)}</strong>
      </div>
      <div className="detail-states">
        <div>
          <span>Estado del pago</span>
          <Badge status={o.payment} />
        </div>
        <div>
          <span>Estado del pedido</span>
          <Badge status={o.status} />
        </div>
        <div>
          <span>Pagos aplicados</span>
          <strong>
            {o.captures.toString().padStart(2, '0')}
            <small> / una vez por pago</small>
          </strong>
        </div>
      </div>
      <div
        className={`diagnosis ${o.status === 'pending' ? 'warning' : o.status === 'failed' ? 'danger' : 'success'}`}
      >
        <span>
          {o.status === 'confirmed' ? <ShieldCheck size={22} /> : <TriangleAlert size={22} />}
        </span>
        <div>
          <h3>
            {o.status === 'pending'
              ? 'Encontramos la diferencia.'
              : o.status === 'failed'
                ? 'El proveedor rechazó este intento.'
                : 'Pago y pedido sincronizados.'}
          </h3>
          <p>
            {o.status === 'pending'
              ? 'El pago fue aprobado, pero el receptor devolvió un 503. Puedes recuperar la notificación para confirmar el pedido sin generar otro pago.'
              : o.status === 'failed'
                ? 'Este escenario simula fondos insuficientes. Puedes crear un nuevo intento aprobado para explorar la recuperación.'
                : 'El evento de confirmación se aplicó correctamente. Si llega otra vez, Nexo reconoce su identificador y evita repetir la operación.'}
          </p>
        </div>
      </div>
      <div className="detail-actions">
        {o.status !== 'confirmed' ? (
          <button
            className="button primary"
            disabled={busy}
            onClick={() => command({ type: 'retry', orderId: o.id })}
          >
            {busy ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}{' '}
            {o.status === 'pending' ? 'Recuperar notificación' : 'Simular nuevo pago aprobado'}
          </button>
        ) : (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => command({ type: 'duplicate', orderId: o.id })}
          >
            <Copy size={16} />
            Reenviar evento duplicado
          </button>
        )}
        <button
          className="button ghost"
          onClick={
            related.some((i) => i.status !== 'resolved')
              ? () => onIncident(related.find((i) => i.status !== 'resolved')!.id)
              : onNewIncident
          }
        >
          <LifeBuoy size={16} />
          {related.some((i) => i.status !== 'resolved')
            ? 'Abrir incidencia vinculada'
            : 'Crear incidencia'}
        </button>
      </div>
      <div className="detail-columns">
        <section>
          <h3 className="section-title">
            <Activity size={17} />
            Línea de tiempo
          </h3>
          <ol className="timeline">
            {trail.map((e) => (
              <li key={e.id} className={e.tone}>
                <span className="timeline-dot" />
                <div>
                  <strong>{e.title}</strong>
                  <p>{e.detail}</p>
                  <time>{time(e.timestamp)}</time>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section>
          <h3 className="section-title">
            <Webhook size={17} />
            Entregas del evento <span>{deliveries.length}</span>
          </h3>
          <div className="delivery-list">
            {deliveries.map((d) => (
              <button key={d.id} className="delivery-card" onClick={() => onPayload(d)}>
                <div>
                  <span className={`http-code ${d.httpStatus === 200 ? 'ok' : 'fail'}`}>
                    {d.httpStatus}
                  </span>
                  <span>Intento {d.attempt}</span>
                  <FileJson size={15} />
                </div>
                <strong>
                  {d.result === 'failed'
                    ? 'Entrega fallida'
                    : d.result === 'ignored'
                      ? 'Duplicado ignorado'
                      : 'Entrega procesada'}
                </strong>
                <p>{d.reason}</p>
                <code>{d.eventId.slice(0, 19)}…</code>
              </button>
            ))}
          </div>
          <div className="explanation">
            <BookOpen size={16} />
            <p>
              <strong>¿Qué es un webhook?</strong> Una notificación que un servicio envía a otro
              cuando ocurre un evento, como la aprobación de un pago.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function IncidentDetail({
  incident: i,
  order,
  busy,
  command,
  onOrder,
}: {
  incident: Incident;
  order: Order;
  busy: boolean;
  command: (c: CommandInput) => Promise<Envelope | undefined>;
  onOrder: () => void;
}) {
  const [note, setNote] = useState('');
  return (
    <div className="modal-body">
      <div className="incident-detail-top">
        <Badge status={i.status} />
        <span className={`priority ${i.severity}`}>
          Prioridad {i.severity === 'high' ? 'alta' : i.severity === 'medium' ? 'media' : 'baja'}
        </span>
      </div>
      <h2 className="incident-title">{i.title}</h2>
      <button className="linked-order" onClick={onOrder}>
        <Package size={19} />
        <span>
          Pedido NX-{order.number}
          <small>
            {order.customer} · {money(order.amount)}
          </small>
        </span>
        <Badge status={order.status} />
        <ArrowUpRight size={18} />
      </button>
      <div className="incident-control">
        <label>
          Estado del caso
          <select
            value={i.status}
            disabled={busy}
            onChange={(e) =>
              command({
                type: 'status',
                incidentId: i.id,
                status: e.target.value as Incident['status'],
              })
            }
          >
            <option value="open">Abierta</option>
            <option value="investigating">En investigación</option>
            <option value="resolved">Resuelta</option>
          </select>
        </label>
        <p>
          Para resolver una incidencia, documenta la solución en una nota. Si hay una notificación
          pendiente, recupérala desde el pedido.
        </p>
      </div>
      <h3 className="section-title">
        <MessageSquare size={18} />
        Notas del caso <span>{i.notes.length}</span>
      </h3>
      {i.notes.length ? (
        <div className="notes">
          {i.notes.map((n) => (
            <article key={n.id}>
              <div>
                <span className="avatar avatar-3">DG</span>
                <strong>{n.author}</strong>
                <time>{date(n.timestamp)}</time>
              </div>
              <p>{n.text}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="notes-empty">
          Todavía no hay notas. Deja el contexto que ayudaría al siguiente compañero.
        </div>
      )}
      <form
        className="note-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!note.trim()) return;
          const r = await command({ type: 'note', incidentId: i.id, text: note });
          if (r) setNote('');
        }}
      >
        <label htmlFor="case-note">Añadir una nota</label>
        <textarea
          id="case-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1200}
          placeholder="¿Qué encontraste? ¿Qué acción tomaste? ¿Cuál fue el resultado?"
          required
        />
        <div>
          <span>{note.length}/1200 · solo datos ficticios</span>
          <button className="button primary" disabled={busy || !note.trim()}>
            {busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />}Guardar nota
          </button>
        </div>
      </form>
    </div>
  );
}
function IncidentForm({
  onSubmit,
  busy,
}: {
  onSubmit: (title: string, severity: 'high' | 'medium' | 'low') => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState(''),
    [severity, setSeverity] = useState<'high' | 'medium' | 'low'>('medium');
  return (
    <form
      className="modal-body incident-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(title, severity);
      }}
    >
      <label>
        ¿Qué necesita atención?
        <input
          required
          minLength={5}
          maxLength={140}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Describe brevemente el problema"
        />
      </label>
      <label>
        Prioridad
        <select value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)}>
          <option value="low">Baja</option>
          <option value="medium">Media</option>
          <option value="high">Alta</option>
        </select>
      </label>
      <p>El caso se vinculará al pedido y conservará su historial de investigación.</p>
      <button className="button primary" disabled={busy || title.trim().length < 5}>
        <Plus size={16} />
        Crear incidencia
      </button>
    </form>
  );
}
function Guide({ onStart }: { onStart: () => void }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CONSTRUIR TAMBIÉN ES ENTENDER</p>
          <h1>Detrás de Nexo.</h1>
          <p>Un laboratorio de desarrollo, pagos y soporte. Con cada pieza a la vista.</p>
        </div>
      </div>
      <div className="guide-hero">
        <span className="brand-symbol">n</span>
        <h2>
          Un pago no termina
          <br />
          cuando se aprueba.
        </h2>
        <p>
          También tiene que llegar al pedido, reflejarse en el sistema y tener una explicación
          cuando algo falla. Nexo convierte ese recorrido en una experiencia que puedes explorar.
        </p>
        <button className="button primary" onClick={onStart}>
          Probar un escenario
          <ArrowRight size={17} />
        </button>
      </div>
      <div className="guide-grid">
        <article className="panel guide-card">
          <span className="guide-number">01</span>
          <h3>El pedido</h3>
          <p>
            El cliente ficticio inicia una compra. Guardamos el importe en centavos para evitar
            errores de precisión con el dinero.
          </p>
        </article>
        <article className="panel guide-card">
          <span className="guide-number">02</span>
          <h3>El evento</h3>
          <p>
            El proveedor simulado genera un evento de pago. Su entrega puede funcionar, fallar o
            llegar repetida.
          </p>
        </article>
        <article className="panel guide-card">
          <span className="guide-number">03</span>
          <h3>La solución</h3>
          <p>
            Investigas el historial, recuperas la notificación y documentas la respuesta. Un
            identificador único evita procesar el mismo evento dos veces.
          </p>
        </article>
      </div>
      <section className="panel architecture">
        <div className="panel-heading">
          <div>
            <h2>Pequeña por fuera. Conectada por dentro.</h2>
            <p>Las capas de esta aplicación.</p>
          </div>
          <Code2 size={23} />
        </div>
        <div className="architecture-flow">
          <div>
            <span>INTERFAZ</span>
            <strong>React + TypeScript</strong>
            <p>Pedidos, escenarios e incidencias.</p>
          </div>
          <ArrowRight />
          <div>
            <span>LÓGICA</span>
            <strong>API HTTP</strong>
            <p>Validación, estados e idempotencia.</p>
          </div>
          <ArrowRight />
          <div>
            <span>PERSISTENCIA</span>
            <strong>SQLite / Cloudflare D1</strong>
            <p>Sesiones aisladas y cambios guardados.</p>
          </div>
        </div>
      </section>
      <div className="guide-grid two">
        <article className="panel guide-card">
          <ShieldCheck size={26} />
          <h3>Una demo con límites claros.</h3>
          <p>
            Todos los pagos y clientes son ficticios. No conecta con bancos, no procesa tarjetas ni
            realiza cobros. Tu sesión tiene sus propios datos y puedes reiniciarla cuando quieras.
          </p>
        </article>
        <article className="panel guide-card">
          <BookOpen size={26} />
          <h3>Un proyecto para seguir creciendo.</h3>
          <p>
            Construido por Diego García con asistencia de IA como proyecto de aprendizaje. Conecta
            su experiencia en atención bancaria con el desarrollo de aplicaciones y la investigación
            de incidencias.
          </p>
          <a href="https://github.com/uhmt" target="_blank" rel="noreferrer">
            Perfil de GitHub
            <ArrowUpRight size={15} />
          </a>
        </article>
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
