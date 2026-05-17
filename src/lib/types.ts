// Hand-written types that mirror supabase/schema.sql.
// We intentionally don't use `supabase gen types` so the user doesn't need
// the CLI. Keep this file in sync with the schema.

export type UserRole = "owner" | "driver" | "client";

export type RideStatus =
  | "requested"
  | "scheduled"
  | "on_the_way"
  | "arrived"
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
  | "company_billing"
  | "affiliate"
  | "invoice"
  | "net30";

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
  profile_id: string | null;
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
  available?: boolean;
  default_vehicle_id?: string | null;
  last_seen_at?: string | null;
  notes: string | null;
  created_at: string;
  // Added in migration 17_owner_commission.sql. Optional so the type
  // stays compatible if the migration hasn't been applied yet.
  is_owner?: boolean;
  commission_rate_bps?: number;
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
  driver_notes?: string | null;

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

export type RideExtra = {
  id: string;
  ride_id: string;
  description: string;
  amount_cents: number;
  added_by: string | null;
  added_at: string;
};

export type NotificationKind =
  | "ride_created"
  | "ride_assigned"
  | "ride_status_changed"
  | "ride_cancelled"
  | "pickup_reminder";

export type NotificationStatus = "pending" | "sent" | "failed" | "skipped";

export type NotificationPref = {
  user_id: string;
  kind: NotificationKind;
  enabled: boolean;
};

export type QuietHours = {
  user_id: string;
  start_local: string; // "HH:MM:SS"
  end_local: string;
  tz: string;
  updated_at?: string;
};

export type NotificationInboxRow = {
  id: string;
  kind: NotificationKind;
  status: NotificationStatus;
  scheduled_for: string;
  sent_at: string | null;
  created_at: string;
  attempts: number;
  last_error: string | null;
  recipients: Array<{ user_id?: string; role?: string }>;
  payload: {
    title: string;
    body: string;
    url?: string;
    tag?: string;
    urgency?: "very-low" | "low" | "normal" | "high";
  };
  ride_id: string | null;
  passenger_name: string | null;
  pickup_at: string | null;
  pickup_address: string | null;
  dropoff_address: string | null;
};

// ── Expenses (migration 18_expenses.sql) ───────────────────────────

export type FixedExpenseCategory =
  | "insurance"
  | "lease"
  | "phone"
  | "software"
  | "rent"
  | "subscription"
  | "other";

export type FixedExpenseCadence = "weekly" | "monthly" | "annual";

export type ExpenseFixed = {
  id: string;
  category: FixedExpenseCategory;
  label: string;
  amount_cents: number;
  cadence: FixedExpenseCadence;
  effective_from: string; // YYYY-MM-DD
  effective_to: string | null;
  vehicle_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RideCostCategory =
  | "gas"
  | "tolls"
  | "parking"
  | "amenities"
  | "tip_out"
  | "other";

export type RideCost = {
  id: string;
  ride_id: string;
  category: RideCostCategory;
  estimated_cents: number;
  actual_cents: number | null;
  note: string | null;
  added_by: string | null;
  added_at: string;
  confirmed_at: string | null;
};

export type MaintenanceCategory =
  | "oil"
  | "tires"
  | "brakes"
  | "detailing"
  | "registration"
  | "smog"
  | "repair"
  | "other";

export type VehicleMaintenance = {
  id: string;
  vehicle_id: string;
  category: MaintenanceCategory;
  label: string;
  amount_cents: number;
  serviced_at: string; // YYYY-MM-DD
  odometer_at_service: number | null;
  service_interval_days: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
