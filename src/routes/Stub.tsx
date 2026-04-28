// Placeholder routes for areas we'll build out next (Clients, Drivers,
// Invoices, Settings). They render so navigation works end-to-end.

export function ClientsStub() {
  return <Stub title="Clients" />;
}
export function DriversStub() {
  return <Stub title="Drivers" />;
}
export function InvoicesStub() {
  return <Stub title="Invoices" />;
}
export function SettingsStub() {
  return <Stub title="Settings" />;
}

function Stub({ title }: { title: string }) {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted">
        Coming next phase. Hand me your Claude artifact when ready and I'll
        build this screen.
      </p>
    </div>
  );
}
