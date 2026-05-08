import { useEffect } from "react";
import { supabase } from "./supabase";

// Subscribe to ride changes (insert / update / delete). Fires onChange
// whenever any ride visible to the current user changes. RLS already
// scopes what they can see, so realtime payloads are pre-filtered to
// rows the user has SELECT permission on.
//
// Use it in any view that wants to stay live (Today, Driver day, Calendar).

export function useRideRealtime(onChange: () => void): void {
  useEffect(() => {
    const channel = supabase
      .channel("rides-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rides" },
        () => onChange(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// Subscribe to events (the activity feed).
export function useEventsRealtime(onChange: () => void): void {
  useEffect(() => {
    const channel = supabase
      .channel("events-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "events" },
        () => onChange(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// Subscribe to ride_extras for the active ride (in the Driver sheet
// + RideDetail extras card).
export function useRideExtrasRealtime(
  rideId: string | null,
  onChange: () => void,
): void {
  useEffect(() => {
    if (!rideId) return;
    const channel = supabase
      .channel(`extras-${rideId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ride_extras",
          filter: `ride_id=eq.${rideId}`,
        },
        () => onChange(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideId]);
}
