import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ClientShell } from "./components/ClientShell";
import { DriverShell } from "./components/DriverShell";
import { Notify } from "./components/Notify";
import { useAuth, AuthProvider } from "./lib/auth";
import { Book } from "./routes/Book";
import { Calendar } from "./routes/Calendar";
import { Client } from "./routes/Client";
import { Clients } from "./routes/Clients";
import { Drivers } from "./routes/Drivers";
import { Earnings } from "./routes/Earnings";
import { Install } from "./routes/Install";
import { Login } from "./routes/Login";
import { Dashboard } from "./routes/Dashboard";
import { Driver, DriverPast, DriverProfile } from "./routes/Driver";
import { DriverUpcoming } from "./routes/DriverUpcoming";
import { Rides } from "./routes/Rides";
import { RideDetail } from "./routes/RideDetail";
import { RideForm } from "./routes/RideForm";
import { Settings } from "./routes/Settings";
import { Vapid } from "./routes/Vapid";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public: anyone (no auth) can land on /book, /install, /vapid */}
          <Route path="/book" element={<Book />} />
          <Route path="/install" element={<Install />} />
          <Route path="/vapid" element={<Vapid />} />
          {/* Everything else goes through the auth + role gate */}
          <Route path="/*" element={<Gate />} />
        </Routes>
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
    return (
      <Routes>
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
      <Routes>
        <Route element={<DriverShell />}>
          <Route index element={<Driver />} />
          <Route path="upcoming" element={<DriverUpcoming />} />
          <Route path="past" element={<DriverPast />} />
          <Route path="profile" element={<DriverProfile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  if (role === "client") {
    return (
      <Routes>
        <Route element={<ClientShell />}>
          <Route index element={<Client />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  return (
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
  );
}
