import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ClientShell } from "./components/ClientShell";
import { DriverShell } from "./components/DriverShell";
import { Notify } from "./components/Notify";
import { useAuth, AuthProvider } from "./lib/auth";
import { Login } from "./routes/Login";

const Landing = lazy(() =>
  import("./routes/Landing").then((m) => ({ default: m.Landing })),
);

const Book = lazy(() => import("./routes/Book").then((m) => ({ default: m.Book })));
const Calendar = lazy(() =>
  import("./routes/Calendar").then((m) => ({ default: m.Calendar })),
);
const Client = lazy(() => import("./routes/Client").then((m) => ({ default: m.Client })));
const ClientAccount = lazy(() =>
  import("./routes/ClientAccount").then((m) => ({ default: m.ClientAccount })),
);
const ClientTripDetail = lazy(() =>
  import("./routes/ClientTripDetail").then((m) => ({ default: m.ClientTripDetail })),
);
const ClientTrips = lazy(() =>
  import("./routes/ClientTrips").then((m) => ({ default: m.ClientTrips })),
);
const Clients = lazy(() =>
  import("./routes/Clients").then((m) => ({ default: m.Clients })),
);
const Drivers = lazy(() =>
  import("./routes/Drivers").then((m) => ({ default: m.Drivers })),
);
const Earnings = lazy(() =>
  import("./routes/Earnings").then((m) => ({ default: m.Earnings })),
);
const Install = lazy(() =>
  import("./routes/Install").then((m) => ({ default: m.Install })),
);
const Dashboard = lazy(() =>
  import("./routes/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const Driver = lazy(() =>
  import("./routes/Driver").then((m) => ({ default: m.Driver })),
);
const DriverPast = lazy(() =>
  import("./routes/Driver").then((m) => ({ default: m.DriverPast })),
);
const DriverProfile = lazy(() =>
  import("./routes/Driver").then((m) => ({ default: m.DriverProfile })),
);
const DriverUpcoming = lazy(() =>
  import("./routes/DriverUpcoming").then((m) => ({ default: m.DriverUpcoming })),
);
const Rides = lazy(() => import("./routes/Rides").then((m) => ({ default: m.Rides })));
const RideDetail = lazy(() =>
  import("./routes/RideDetail").then((m) => ({ default: m.RideDetail })),
);
const RideForm = lazy(() =>
  import("./routes/RideForm").then((m) => ({ default: m.RideForm })),
);
const Settings = lazy(() =>
  import("./routes/Settings").then((m) => ({ default: m.Settings })),
);
const Vapid = lazy(() => import("./routes/Vapid").then((m) => ({ default: m.Vapid })));

function RouteFallback() {
  return (
    <div className="min-h-full flex items-center justify-center text-muted">
      Loading…
    </div>
  );
}

// Push payloads use /rides/:id; alias it so taps from notifications land
// on the right ride sheet (Driver.tsx auto-opens when it sees ?ride=).
function DriverRideRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/?ride=${id ?? ""}`} replace />;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Public: anyone (no auth) can land on /book, /install, /vapid */}
            <Route path="/book" element={<Book />} />
            <Route path="/install" element={<Install />} />
            <Route path="/vapid" element={<Vapid />} />
            {/* Everything else goes through the auth + role gate */}
            <Route path="/*" element={<Gate />} />
          </Routes>
        </Suspense>
        <Notify />
      </BrowserRouter>
    </AuthProvider>
  );
}

function Gate() {
  const { ready, session, profile } = useAuth();
  if (!ready) {
    return (
      <div className="min-h-full flex items-center justify-center text-muted">
        Loading…
      </div>
    );
  }
  if (!session) {
    // Public marketing landing at `/`; everything else falls through
    // to the login screen so deep links still funnel into auth.
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  // Role-based shells:
  //   driver → DriverShell (today / past / profile)
  //   client → ClientShell (your account home)
  //   anything else (owner) → AppShell (full ops dashboard)
  const role = profile?.role;

  if (role === "driver") {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<DriverShell />}>
            <Route index element={<Driver />} />
            <Route path="upcoming" element={<DriverUpcoming />} />
            <Route path="past" element={<DriverPast />} />
            <Route path="profile" element={<DriverProfile />} />
            {/* Push payloads use /rides/:id; alias it so taps from
                notifications land on the right ride sheet. */}
            <Route path="rides/:id" element={<DriverRideRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    );
  }

  if (role === "client") {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<ClientShell />}>
            <Route index element={<Client />} />
            <Route path="trips" element={<ClientTrips />} />
            <Route path="trips/:id" element={<ClientTripDetail />} />
            {/* Push notifications deep-link to /rides/:id; alias it to the
                client trip detail so taps from a push land in the right
                place instead of bouncing through the gate. */}
            <Route path="rides/:id" element={<ClientTripDetail />} />
            <Route path="account" element={<ClientAccount />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="rides" element={<Rides />} />
          <Route path="rides/new" element={<RideForm />} />
          <Route path="rides/:id" element={<RideDetail />} />
          <Route path="rides/:id/edit" element={<RideForm />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="clients" element={<Clients />} />
          <Route path="drivers" element={<Drivers />} />
          <Route path="earnings" element={<Earnings />} />
          <Route path="invoices" element={<Navigate to="/earnings" replace />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
