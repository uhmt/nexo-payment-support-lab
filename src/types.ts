export type Scenario = 'approved' | 'declined' | 'delayed' | 'duplicate';
export type PaymentStatus = 'approved' | 'declined';
export type OrderStatus = 'confirmed' | 'pending' | 'failed';
export type Severity = 'high' | 'medium' | 'low';
export type IncidentStatus = 'open' | 'investigating' | 'resolved';
export interface Order {
  id: string;
  number: number;
  customer: string;
  email: string;
  product: string;
  amount: number;
  currency: 'DOP';
  payment: PaymentStatus;
  status: OrderStatus;
  scenario: Scenario;
  createdAt: string;
  eventId: string;
  captures: number;
}
export interface Delivery {
  id: string;
  eventId: string;
  orderId: string;
  type: string;
  result: 'processed' | 'failed' | 'ignored';
  httpStatus: number;
  timestamp: string;
  attempt: number;
  reason: string;
  payload: Record<string, unknown>;
}
export interface Note {
  id: string;
  text: string;
  timestamp: string;
  author: string;
}
export interface Incident {
  id: string;
  number: number;
  orderId: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  createdAt: string;
  updatedAt: string;
  notes: Note[];
}
export interface Audit {
  id: string;
  orderId?: string;
  kind: 'order' | 'payment' | 'delivery' | 'incident' | 'note';
  title: string;
  detail: string;
  timestamp: string;
  tone: 'success' | 'warning' | 'danger' | 'info';
}
export interface State {
  schema: 1;
  orders: Order[];
  deliveries: Delivery[];
  incidents: Incident[];
  audit: Audit[];
  processedEvents: string[];
  requests: Record<string, string>;
  createdAt: string;
}
export interface Envelope {
  state: State;
  version: number;
  csrf: string;
  result?: { orderId?: string; incidentId?: string; message: string };
}
export type Command =
  | { type: 'simulate'; scenario: Scenario; customer?: string; amount?: number; requestId: string }
  | { type: 'retry'; orderId: string; requestId: string }
  | { type: 'duplicate'; orderId: string; requestId: string }
  | { type: 'incident'; orderId: string; title: string; severity: Severity; requestId: string }
  | { type: 'status'; incidentId: string; status: IncidentStatus; requestId: string }
  | { type: 'note'; incidentId: string; text: string; requestId: string }
  | { type: 'reset'; requestId: string };
