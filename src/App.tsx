import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ClientShell } from "./components/ClientShell";
import { DriverShell } from "./components/DriverShell";
import { useAuth, AuthProvider } from "./lib/auth";
import { Book } from "./routes/Book";
import { Client } from "./routes/Client";
import { Login } from "./routes/Login";
import { Dashboard } from "./routes/Dashboard";
import { Driver, DriverPast, DriverProfile } from "./routes/Driver";
import { Rides } from "./routes/Rides";
import { RideDetail } from "./routes/RideDetail";
import { RideForm } from "./routes/RideForm";
import {
  ClientsStub,
  DriversStub,
  InvoicesStub,
} from "./routes/Stub";
import { Settings } from "./routes/Settings";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public: anyone (no auth) can land on /book */}
          <Route path="/book" element={<Book />} />
          {/* Everything else goes through the auth + role gate */}
          <Route path="/*" element={<Gate />} />
        </Routes>
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
        <Route path="clients" element={<ClientsStub />} />
        <Route path="drivers" element={<DriversStub />} />
        <Route path="invoices" element={<InvoicesStub />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
