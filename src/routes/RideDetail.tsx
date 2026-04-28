import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getRide, updateRideStatus } from "../lib/api";
import { fmtDateTime, fmtMoney } from "../lib/format";
import { StatusBadge } from "../components/StatusBadge";
import type { Ride, RideStatus } from "../lib/types";

export function RideDetail() {
  const { id } = useParams<{ id: string }>();
  const [ride, setRide] = useState<Ride | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getRide(id)
      .then(setRide)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load"),
      );
  }, [id]);

  const setStatus = async (status: RideStatus) => {
    if (!ride) return;
    try {
      await updateRideStatus(ride.id, status);
      setRide({ ...ride, status });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  if (error) return <div className="card text-danger">{error}</div>;
  if (!ride) return <div className="text-muted">Loading…</div>;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {ride.passenger_name}
          </h1>
          <div className="text-sm text-muted tabular">
            {fmtDateTime(ride.pickup_at)}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={ride.status} />
          <Link
            to={`/rides/${ride.id}/edit`}
            className="btn btn-ghost text-xs"
          >
            Edit
          </Link>
        </div>
      </header>

      <section className="card space-y-2">
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
          Route
        </h2>
        <div className="text-sm">
          <div>
            <span className="text-muted">Pickup:</span> {ride.pickup_address}
          </div>
          {ride.dropoff_address ? (
            <div>
              <span className="text-muted">Drop-off:</span>{" "}
              {ride.dropoff_address}
            </div>
          ) : null}
        </div>
      </section>

      {ride.flight_number || ride.flight_airline ? (
        <section className="card space-y-2">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Flight
          </h2>
          <div className="text-sm tabular">
            {ride.flight_airline ?? ""} {ride.flight_number ?? ""}
            {ride.flight_airport ? ` · ${ride.flight_airport}` : ""}
            {ride.flight_terminal ? ` T${ride.flight_terminal}` : ""}
            {ride.flight_status ? ` · ${ride.flight_status}` : ""}
          </div>
        </section>
      ) : null}

      <section className="card space-y-2">
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
          Billing
        </h2>
        <div className="grid grid-cols-2 gap-2 text-sm tabular">
          <div className="text-muted">Fare</div>
          <div className="text-right">{fmtMoney(ride.fare_cents)}</div>
          <div className="text-muted">Gratuity</div>
          <div className="text-right">{fmtMoney(ride.gratuity_cents)}</div>
          <div className="text-muted">Parking</div>
          <div className="text-right">{fmtMoney(ride.parking_cents)}</div>
          <div className="font-medium">Total</div>
          <div className="text-right font-medium">
            {fmtMoney(ride.total_cents)}
          </div>
          {ride.billing_terms ? (
            <>
              <div className="text-muted">Terms</div>
              <div className="text-right">{ride.billing_terms}</div>
            </>
          ) : null}
        </div>
      </section>

      {ride.notes ? (
        <section className="card space-y-2">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Notes
          </h2>
          <p className="text-sm whitespace-pre-wrap">{ride.notes}</p>
        </section>
      ) : null}

      <section className="flex flex-wrap gap-2">
        {ride.status !== "in_progress" ? (
          <button
            className="btn btn-ghost"
            onClick={() => setStatus("in_progress")}
          >
            Mark in progress
          </button>
        ) : null}
        {ride.status !== "completed" ? (
          <button
            className="btn btn-ghost"
            onClick={() => setStatus("completed")}
          >
            Mark completed
          </button>
        ) : null}
        {ride.status !== "cancelled" ? (
          <button
            className="btn btn-danger"
            onClick={() => setStatus("cancelled")}
          >
            Cancel ride
          </button>
        ) : null}
      </section>
    </div>
  );
}
