"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, CalendarPlus, CreditCard, Link2, Star, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { SlotPicker } from "@/components/booking/slot-picker";
import { formatHm, formatYmd } from "@/lib/time";
import { cancelAppointmentAction, rescheduleAppointmentAction } from "@/server/appointments/actions";
import { claimAppointmentAction } from "@/server/customers/actions";

export interface ManageProps {
  appointment: {
    id: string;
    token: string;
    status: string;
    durationMinutes: number;
    pricingServiceId: string;
    technicianId: string | null;
    amountPaid: number;
    total: number;
    hasReview: boolean;
    canChange: boolean;
    claimable: boolean;
  };
  settings: { today: string; maxAdvanceDays: number; cancellationWindowHours: number; phone: string; cancellationPolicy: string; onlinePayments: boolean };
}

const CLOSED = ["CANCELLED", "COMPLETED", "NO_SHOW"];

export function AppointmentManager({ appointment: a, settings }: ManageProps) {
  const router = useRouter();
  const [rescheduleOpen, setRescheduleOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [slot, setSlot] = React.useState<{ date: string | null; time: string | null }>({ date: null, time: null });
  const [reason, setReason] = React.useState("");
  const [pending, start] = React.useTransition();
  const token = encodeURIComponent(a.token);
  const owes = a.total - a.amountPaid > 0 && !CLOSED.includes(a.status);
  const exclude = React.useMemo(() => ({ id: a.id, token: a.token }), [a.id, a.token]);

  function reschedule() {
    if (!slot.date || !slot.time) return;
    start(async () => {
      const res = await rescheduleAppointmentAction({ appointmentId: a.id, token: a.token, date: slot.date, time: slot.time });
      if (res.ok) {
        toast.success(res.message ?? "Rescheduled");
        setRescheduleOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function cancel() {
    start(async () => {
      const res = await cancelAppointmentAction({ appointmentId: a.id, token: a.token, reason: reason || null });
      if (res.ok) {
        toast.success(res.message ?? "Cancelled");
        setCancelOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function claim() {
    start(async () => {
      const res = await claimAppointmentAction({ token: a.token });
      if (res.ok) {
        toast.success(res.message ?? "Added to your account");
        router.push(`/dashboard/appointments/${a.id}`);
      } else toast.error(res.error);
    });
  }

  return (
    <div className="grid gap-3">
      {owes && settings.onlinePayments && (
        <Button asChild size="lg">
          <Link href={`/checkout/${a.id}?t=${token}${a.amountPaid > 0 ? "&type=BALANCE" : ""}`}>
            <CreditCard aria-hidden /> {a.amountPaid > 0 ? "Pay remaining balance" : "Pay deposit"}
          </Link>
        </Button>
      )}
      {a.status === "COMPLETED" && !a.hasReview && (
        <Button asChild size="lg">
          <Link href={`/reviews?appointment=${a.id}&t=${token}#write`}>
            <Star aria-hidden /> Leave a review
          </Link>
        </Button>
      )}
      {!CLOSED.includes(a.status) && (
        <Button asChild variant="outline">
          <a href={`/api/appointments/${a.id}/ics?t=${token}`}>
            <CalendarPlus aria-hidden /> Add to calendar
          </a>
        </Button>
      )}
      {a.canChange && (
        <>
          <Button variant="outline" onClick={() => setRescheduleOpen(true)}>
            <CalendarClock aria-hidden /> Reschedule
          </Button>
          <Button variant="ghost" className="text-red-300 hover:text-red-200" onClick={() => setCancelOpen(true)}>
            <XCircle aria-hidden /> Cancel appointment
          </Button>
        </>
      )}
      {!a.canChange && !CLOSED.includes(a.status) && (
        <p className="text-xs text-muted-foreground">
          Online changes close {settings.cancellationWindowHours} hours before your appointment. Call {settings.phone} for help.
        </p>
      )}
      {a.claimable && (
        <Button variant="subtle" onClick={claim} loading={pending}>
          <Link2 aria-hidden /> Add to my account
        </Button>
      )}

      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Choose a new time</DialogTitle>
            <DialogDescription>Only open times are shown. Your deposit carries over.</DialogDescription>
          </DialogHeader>
          {rescheduleOpen && (
            <SlotPicker
              serviceId={a.pricingServiceId}
              duration={a.durationMinutes}
              technicianId={null}
              today={settings.today}
              maxAdvanceDays={settings.maxAdvanceDays}
              value={slot}
              onChange={setSlot}
              exclude={exclude}
            />
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRescheduleOpen(false)}>
              Keep current time
            </Button>
            <Button onClick={reschedule} disabled={!slot.date || !slot.time} loading={pending}>
              {slot.date && slot.time ? `Move to ${formatYmd(slot.date)} · ${formatHm(slot.time)}` : "Select a time"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this appointment?</DialogTitle>
            <DialogDescription>{settings.cancellationPolicy}</DialogDescription>
          </DialogHeader>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Reason (optional)</span>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </label>
          {a.amountPaid > 0 && <p className="text-sm text-muted-foreground">Online payments for this booking will be refunded to the original payment method.</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Keep appointment
            </Button>
            <Button variant="destructive" onClick={cancel} loading={pending}>
              Cancel appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
