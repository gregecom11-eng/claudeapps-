import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { useAuth, AuthProvider } from "./lib/auth";
import { Login } from "./routes/Login";
import { Dashboard } from "./routes/Dashboard";
import { Rides } from "./routes/Rides";
import { RideDetail } from "./routes/RideDetail";
import { RideForm } from "./routes/RideForm";
import {
  ClientsStub,
  DriversStub,
  InvoicesStub,
  SettingsStub,
} from "./routes/Stub";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </AuthProvider>
  );
}

function Gate() {
  const { ready, session } = useAuth();
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
        <Route path="settings" element={<SettingsStub />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
