// Hand-written types that mirror supabase/schema.sql.
// We intentionally don't use `supabase gen types` so the user doesn't need
// the CLI. Keep this file in sync with the schema.

export type UserRole = "owner" | "driver" | "client";

export type RideStatus =
  | "requested"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "paid"
  | "overdue"
  | "void";

export type BillingTerms =
  | "cash"
  | "card"
  | "zelle"
  | "net_15"
  | "net_30"
  | "company_billing";

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  created_at: string;
};

export type Client = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  default_billing: BillingTerms | null;
  preferences: Record<string, unknown>;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Driver = {
  id: string;
  profile_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  license_no: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
};

export type Vehicle = {
  id: string;
  display_name: string;
  year: number | null;
  make: string | null;
  model: string | null;
  color: string | null;
  plate: string | null;
  capacity: number | null;
  active: boolean;
  notes: string | null;
  created_at: string;
};

export type Ride = {
  id: string;
  status: RideStatus;
  source: string;

  client_id: string | null;
  passenger_name: string;
  passenger_phone: string | null;

  pickup_at: string;
  pickup_address: string;
  dropoff_address: string | null;

  flight_airline: string | null;
  flight_number: string | null;
  flight_airport: string | null;
  flight_terminal: string | null;
  flight_status: string | null;

  driver_id: string | null;
  vehicle_id: string | null;

  fare_cents: number;
  gratuity_cents: number;
  parking_cents: number;
  total_cents: number;
  billing_terms: BillingTerms | null;

  notes: string | null;

  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type RideInsert = Omit<
  Ride,
  | "id"
  | "total_cents"
  | "created_at"
  | "updated_at"
  | "created_by"
> & { id?: string };

export type Invoice = {
  id: string;
  ride_id: string | null;
  number: string | null;
  amount_cents: number;
  terms: BillingTerms | null;
  due_date: string | null;
  status: InvoiceStatus;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
};

export type ActivityEvent = {
  id: number;
  ride_id: string | null;
  source: string;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};
