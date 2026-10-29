"use client";

import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  CreditCard,
  Download,
  CalendarSearch,
  Filter,
  LayoutGrid,
  List,
  LogOut,
  Menu,
  Move,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  Settings,
  Trash2,
  Users,
  ZoomIn,
} from "lucide-react";
import {
  CSSProperties,
  FormEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";

type User = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  mustChangePassword?: boolean;
};
type Reservation = {
  id: string;
  clientName: string;
  phone: string;
  courtId: string;
  courtName: string;
  bookingTypeId: string;
  bookingType: string;
  startsAt: string;
  endsAt: string;
  status: string;
  color: string;
  notes: string;
  paymentMode: string;
  listPrice: number;
  finalPrice: number;
  paid: number;
  balance: number;
  seriesId?: string | null;
  version: number;
  createdByName: string;
  coverage: { id: string; name: string }[];
};
type Payment = {
  id: string;
  reservationId?: string | null;
  seriesId?: string | null;
  period?: string | null;
  amount: number;
  method: string;
  paidAt: string;
  notes: string;
};
type WorkLog = {
  id: string;
  reservationId?: string | null;
  staffId: string;
  staffName: string;
  startsAt: string;
  endsAt: string;
  functionName: string;
  notes: string;
};
type DashboardData = {
  user: User;
  staff: { id: string; name: string; active: boolean }[];
  reservations: Reservation[];
  subscriptions: { seriesId: string; clientName: string }[];
  payments: Payment[];
  workLogs: WorkLog[];
  summary: {
    expected: number;
    collected: number;
    pending: number;
    discounts: number;
    reservedHours: number;
    staffHours: number;
  };
};
type PendingMove = {
  reservationId: string;
  startsAt: string;
  endsAt: string;
  version: number;
};
type MutationResult = {
  error?: string;
  reservation: Reservation;
  createdCount?: number;
  skipped?: string[];
  deleted?: number;
};

const courtOptions = [
  { id: "court-main", name: "Cancha 7 sintético", price: 40000 },
  { id: "court-multi", name: "Cancha multideporte (fútbol 5)", price: 25000 },
];
const typeOptions = [
  ["type-rental", "Turno no recurrente", "#F8E7A1"],
  ["type-fixed", "Turno fijo", "#BFD7F2"],
  ["type-birthday", "Cumpleañito", "#F6C4D8"],
  ["type-tournament", "Torneo Madryn Norte", "#A8D5A2"],
  ["type-tournament-external", "Torneo ajeno", "#BFE7F4"],
  ["type-training", "Club / escuela Madryn Norte", "#CBE8C8"],
  ["type-event", "Evento especial", "#DDD0F2"],
  ["type-block", "Horario bloqueado", "#F4B7B2"],
  ["type-other", "Otro", "#F7D7B5"],
] as const;
const colorChoices = typeOptions.map(([, name, color]) => ({ name, color }));
const navItems = [
  ["agenda", "Agenda", CalendarDays],
  ["reservas", "Reservas", Clock3],
  ["cobros", "Cobros", CreditCard],
  ["personal", "Personal", Users],
  ["reportes", "Reportes", BarChart3],
  ["config", "Configuración", Settings],
] as const;
const startHour = 9;
const hours = Array.from(
  { length: 30 },
  (_, index) =>
    `${String(startHour + Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`,
);
const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});
const dateTime = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}
function mondayOf(date = new Date()) {
  const noon = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12),
  );
  const day = noon.getUTCDay() || 7;
  noon.setUTCDate(noon.getUTCDate() - day + 1);
  return dateKey(noon);
}
function mondayForKey(value: string) {
  return mondayOf(new Date(`${value}T12:00:00Z`));
}
function toIso(date: string, time: string) {
  return new Date(`${date}T${time}:00-03:00`).toISOString();
}
function localParts(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

export default function DashboardApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [view, setView] = useState("agenda");
  const [menuOpen, setMenuOpen] = useState(false);
  const [weekStart, setWeekStart] = useState("2026-10-05");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [courtFilter, setCourtFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [workOpen, setWorkOpen] = useState(false);
  const [dragged, setDragged] = useState<Reservation | null>(null);
  const [pendingMoves, setPendingMoves] = useState<PendingMove[]>([]);
  const [savingMoves, setSavingMoves] = useState(false);
  const [slotDraft, setSlotDraft] = useState({
    date: weekStart,
    time: "20:00",
  });
  const [editing, setEditing] = useState<Reservation | null>(null);
  const [moveTarget, setMoveTarget] = useState<Reservation | null>(null);
  const changeWeek = (value: string) => {
    if (
      pendingMoves.length &&
      !window.confirm(
        "Hay movimientos sin guardar. ¿Querés descartarlos y cambiar de semana?",
      )
    )
      return;
    setPendingMoves([]);
    setWeekStart(value);
    setSlotDraft({ date: value, time: "20:00" });
  };

  const loadData = useCallback(
    async (activeUser?: User | null) => {
      if (!(activeUser ?? user)) return;
      setLoading(true);
      const from = new Date(`${weekStart}T00:00:00-03:00`).toISOString();
      const to = new Date(
        `${addDays(weekStart, 7)}T00:00:00-03:00`,
      ).toISOString();
      const response = await fetch(
        `/api/dashboard?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      if (response.status === 401) {
        setUser(null);
        setData(null);
        setLoading(false);
        return;
      }
      const payload = (await response.json()) as DashboardData & {
        error?: string;
      };
      if (!response.ok)
        toast.error(payload.error ?? "No se pudo cargar la agenda");
      else setData(payload);
      setLoading(false);
    },
    [user, weekStart],
  );

  // The initial session check intentionally runs once; later refreshes are handled below.
  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (response) => {
        if (response.ok) {
          const payload = (await response.json()) as { user: User };
          setUser(payload.user);
          await loadData(payload.user);
        }
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!user || !authChecked) return;
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [weekStart, authChecked, user, loadData]);

  useEffect(() => {
    const context =
      typeof document === "undefined"
        ? undefined
        : (
            document as Document & {
              modelContext?: {
                registerTool: (
                  tool: unknown,
                  options?: { signal?: AbortSignal },
                ) => void | Promise<void>;
              };
            }
          ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: "create_booking",
          title: "Crear reserva",
          description:
            "Crea una reserva validando intervalos de 30 minutos y disponibilidad.",
          inputSchema: {
            type: "object",
            properties: {
              clientName: { type: "string" },
              courtId: { type: "string", enum: ["court-main", "court-multi"] },
              startsAt: { type: "string" },
              endsAt: { type: "string" },
            },
            required: ["clientName", "courtId", "startsAt", "endsAt"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: async (input: Record<string, string>) => {
            const response = await fetch("/api/reservations", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                ...input,
                bookingTypeId: "type-rental",
                status: "pendiente",
              }),
            });
            const result = (await response.json()) as MutationResult;
            if (!response.ok) throw new Error(result.error);
            await loadData();
            return { id: result.reservation.id, status: "pendiente" };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);
    return () => lifecycle.abort();
  }, [loadData]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const key = addDays(weekStart, index);
        const date = new Date(`${key}T12:00:00Z`);
        return {
          key,
          short: new Intl.DateTimeFormat("es-AR", { weekday: "short" })
            .format(date)
            .replace(".", ""),
          label: new Intl.DateTimeFormat("es-AR", {
            day: "numeric",
            month: "short",
          })
            .format(date)
            .replace(".", ""),
        };
      }),
    [weekStart],
  );
  const visualReservations = useMemo(
    () =>
      (data?.reservations ?? []).map((reservation) => {
        const move = [...pendingMoves]
          .reverse()
          .find((item) => item.reservationId === reservation.id);
        return move
          ? { ...reservation, startsAt: move.startsAt, endsAt: move.endsAt }
          : reservation;
      }),
    [data, pendingMoves],
  );
  const visible = useMemo(
    () =>
      visualReservations.filter(
        (item) =>
          (courtFilter === "all" || item.courtId === courtFilter) &&
          (staffFilter === "all" ||
            (staffFilter === "unassigned"
              ? !item.coverage?.length
              : item.coverage?.some((person) => person.id === staffFilter))) &&
          `${item.clientName} ${item.phone} ${item.courtName}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [visualReservations, query, courtFilter, staffFilter],
  );

  if (!authChecked)
    return <div className="loading-screen">Cargando turnero…</div>;
  if (!user)
    return (
      <LoginScreen
        onLogin={(loggedUser) => {
          setUser(loggedUser);
          setAuthChecked(true);
          void loadData(loggedUser);
        }}
      />
    );

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setData(null);
  };
  const moveReservation = (
    reservation: Reservation,
    day: string,
    time: string,
    copy = false,
  ) => {
    const startsAt = toIso(day, time);
    const duration =
      Date.parse(reservation.endsAt) - Date.parse(reservation.startsAt);
    const endsAt = new Date(Date.parse(startsAt) + duration).toISOString();
    if (startsAt === reservation.startsAt && !copy) return;
    const conflict = visualReservations.some(
      (item) =>
        (copy || item.id !== reservation.id) &&
        item.courtId === reservation.courtId &&
        item.status !== "cancelado" &&
        Date.parse(item.startsAt) < Date.parse(endsAt) &&
        Date.parse(item.endsAt) > Date.parse(startsAt),
    );
    if (conflict) {
      toast.error("Ese horario ya está ocupado en la misma cancha.");
      return;
    }
    if (copy) {
      if (
        !window.confirm(
          `¿Copiar ${reservation.clientName} al ${day} a las ${time}?`,
        )
      )
        return;
      void (async () => {
        try {
          const response = await fetch("/api/reservations", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              clientName: reservation.clientName,
              phone: reservation.phone,
              courtId: reservation.courtId,
              bookingTypeId: reservation.bookingTypeId,
              startsAt,
              endsAt,
              status: reservation.status,
              color: reservation.color,
              notes: reservation.notes,
              paymentMode: reservation.paymentMode,
              listPrice: reservation.listPrice,
              repeatWeekly: false,
            }),
          });
          const result = (await response.json()) as MutationResult;
          if (!response.ok) throw new Error(result.error);
          toast.success("Reserva copiada");
          await loadData();
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "No se pudo copiar la reserva",
          );
        }
      })();
      return;
    }
    setMoveTarget(null);
    setPendingMoves((current) => [
      ...current,
      {
        reservationId: reservation.id,
        startsAt,
        endsAt,
        version: reservation.version,
      },
    ]);
    toast.message("Movimiento preparado", {
      description: "Podés deshacerlo o guardar los cambios.",
    });
  };
  const undoMove = () => setPendingMoves((current) => current.slice(0, -1));
  const saveMoves = async () => {
    if (
      !pendingMoves.length ||
      !window.confirm(
        `¿Confirmás guardar ${new Set(pendingMoves.map((item) => item.reservationId)).size} cambio(s) en la agenda?`,
      )
    )
      return;
    const latest = new Map<string, PendingMove>();
    for (const move of pendingMoves) latest.set(move.reservationId, move);
    setSavingMoves(true);
    try {
      for (const move of latest.values()) {
        const response = await fetch(
          `/api/reservations/${move.reservationId}`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              startsAt: move.startsAt,
              endsAt: move.endsAt,
              version: move.version,
            }),
          },
        );
        const result = (await response.json()) as MutationResult;
        if (!response.ok) throw new Error(result.error);
      }
      setPendingMoves([]);
      toast.success("Cambios guardados");
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudieron guardar los movimientos.",
      );
      await loadData();
      setPendingMoves([]);
    } finally {
      setSavingMoves(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--app-bg)] text-slate-950">
      <Toaster richColors position="top-right" />
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">MN</div>
          <div>
            <strong>Madryn Norte</strong>
            <span>Gestión del complejo</span>
          </div>
        </div>
        <nav className="nav-list" aria-label="Secciones principales">
          {navItems.map(([id, label, Icon]) => (
            <button
              key={id}
              className={`nav-item ${view === id ? "nav-item-active" : ""}`}
              onClick={() => {
                setView(id);
                setMenuOpen(false);
              }}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="avatar">
            {user.displayName
              .split(" ")
              .map((word) => word[0])
              .join("")
              .slice(0, 2)}
          </div>
          <div className="user-meta">
            <strong>{user.displayName}</strong>
            <span>{user.role}</span>
          </div>
          <button onClick={logout} aria-label="Cerrar sesión">
            <LogOut />
          </button>
        </div>
      </aside>
      <section className="app-shell">
        <header className="topbar">
          <button
            className="menu-button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Abrir menú"
          >
            <Menu />
          </button>
          <div>
            <p className="eyebrow">
              {navItems.find(([id]) => id === view)?.[1]}
            </p>
            <h1>
              {view === "agenda"
                ? "Turnos del complejo"
                : navItems.find(([id]) => id === view)?.[1]}
            </h1>
          </div>
          <div className="topbar-actions">
            <label className="search-field">
              <Search aria-hidden="true" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar cliente o equipo"
                aria-label="Buscar cliente o equipo"
              />
            </label>
            {view === "agenda" && (
              <NewReservationDialog
                open={createOpen}
                setOpen={setCreateOpen}
                defaultDate={slotDraft.date}
                defaultTime={slotDraft.time}
                onSaved={loadData}
              />
            )}
          </div>
        </header>
        {user.mustChangePassword && (
          <div className="notice">
            Tu cuenta usa una contraseña temporal. Cambiala desde Configuración.
          </div>
        )}
        {view === "agenda" && (
          <AgendaView
            days={days}
            reservations={visible}
            loading={loading}
            weekStart={weekStart}
            setWeekStart={changeWeek}
            courtFilter={courtFilter}
            setCourtFilter={setCourtFilter}
            staffFilter={staffFilter}
            setStaffFilter={setStaffFilter}
            staff={data?.staff ?? []}
            dragged={dragged}
            setDragged={setDragged}
            onDropReservation={moveReservation}
            onCreateAt={(date, time) => {
              setSlotDraft({ date, time });
              setCreateOpen(true);
            }}
            onEditReservation={setEditing}
            pendingCount={pendingMoves.length}
            onUndo={undoMove}
            onSave={saveMoves}
            savingMoves={savingMoves}
            moveTarget={moveTarget}
            onCancelMove={() => setMoveTarget(null)}
          />
        )}
        {view === "reservas" && <ReservationsView reservations={visible} />}
        {view === "cobros" && (
          <PaymentsView
            data={data}
            open={paymentOpen}
            setOpen={setPaymentOpen}
            onSaved={loadData}
          />
        )}
        {view === "personal" && (
          <StaffView
            data={data}
            open={workOpen}
            setOpen={setWorkOpen}
            onSaved={loadData}
          />
        )}
        {view === "reportes" && <ReportsView data={data} />}
        {view === "config" && (
          <ConfigView
            user={user}
            onPasswordChanged={() =>
              setUser({ ...user, mustChangePassword: false })
            }
          />
        )}
        <EditReservationDialog
          reservation={editing}
          setReservation={setEditing}
          onSaved={loadData}
          onMove={(reservation) => {
            setEditing(null);
            setMoveTarget(reservation);
            toast.message("Tocá el horario de destino en la agenda");
          }}
        />
      </section>
    </main>
  );
}

function LoginScreen({ onLogin }: { onLogin: (user: User) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
        }),
      });
      const payload = (await response.json()) as { user: User; error?: string };
      if (!response.ok) setError(payload.error ?? "No se pudo ingresar");
      else onLogin(payload.user);
    } catch {
      setError(
        "No se pudo conectar con el servidor. Actualizá la página e intentá nuevamente.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="brand-mark">MN</div>
          <div>
            <strong>Madryn Norte</strong>
            <span>Turnos, cobros y personal</span>
          </div>
        </div>
        <div>
          <p className="eyebrow">Acceso al sistema</p>
          <h1>Ingresá a la gestión</h1>
          <p className="login-copy">
            La información queda sincronizada para todo el equipo.
          </p>
        </div>
        <form onSubmit={submit} className="login-form">
          <label>
            Usuario
            <Input
              name="username"
              defaultValue="admin"
              autoComplete="username"
              required
            />
          </label>
          <label>
            Contraseña
            <Input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <Button disabled={busy} size="lg">
            {busy ? "Ingresando…" : "Ingresar"}
          </Button>
        </form>
      </section>
    </main>
  );
}

function AgendaView({
  days,
  reservations,
  loading,
  weekStart,
  setWeekStart,
  courtFilter,
  setCourtFilter,
  staffFilter,
  setStaffFilter,
  staff,
  dragged,
  setDragged,
  onDropReservation,
  onCreateAt,
  onEditReservation,
  pendingCount,
  onUndo,
  onSave,
  savingMoves,
  moveTarget,
  onCancelMove,
}: {
  days: { key: string; short: string; label: string }[];
  reservations: Reservation[];
  loading: boolean;
  weekStart: string;
  setWeekStart: (value: string) => void;
  courtFilter: string;
  setCourtFilter: (value: string) => void;
  staffFilter: string;
  setStaffFilter: (value: string) => void;
  staff: { id: string; name: string; active: boolean }[];
  dragged: Reservation | null;
  setDragged: (value: Reservation | null) => void;
  onDropReservation: (
    reservation: Reservation,
    day: string,
    time: string,
    copy?: boolean,
  ) => void;
  onCreateAt: (date: string, time: string) => void;
  onEditReservation: (reservation: Reservation) => void;
  pendingCount: number;
  onUndo: () => void;
  onSave: () => void;
  savingMoves: boolean;
  moveTarget: Reservation | null;
  onCancelMove: () => void;
}) {
  const [mobileDay, setMobileDay] = useState(days[0]?.key ?? weekStart);
  const [compactOnly, setCompactOnly] = useState(false);
  const [zoom, setZoom] = useState(42);
  const [mobileWeek, setMobileWeek] = useState(true);
  const [touchDraggingId, setTouchDraggingId] = useState<string | null>(null);
  const [touchDropKey, setTouchDropKey] = useState<string | null>(null);
  const suppressBookingClick = useRef(false);
  const pointerDrag = useRef<Reservation | null>(null);
  const slotAtPoint = (x: number, y: number) => {
    const element = document.elementFromPoint(x, y);
    const column = element?.closest<HTMLElement>(".day-column[data-day]");
    const row = column
      ? Math.floor((y - column.getBoundingClientRect().top) / zoom)
      : -1;
    const day = column?.dataset.day;
    const time = hours[row];
    return day && time ? { day, time } : null;
  };
  const startBookingPointer = (
    event: ReactPointerEvent<HTMLSpanElement>,
    reservation: Reservation,
  ) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerDrag.current = reservation;
    suppressBookingClick.current = true;
    setTouchDraggingId(reservation.id);
  };
  const moveBookingPointer = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (!pointerDrag.current) return;
    const target = slotAtPoint(event.clientX, event.clientY);
    setTouchDropKey(target ? `${target.day}-${target.time}` : null);
  };
  const endBookingPointer = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const reservation = pointerDrag.current;
    if (!reservation) return;
    if (event.type !== "pointercancel") {
      const target = slotAtPoint(event.clientX, event.clientY);
      if (target)
        onDropReservation(reservation, target.day, target.time, event.altKey);
    }
    window.setTimeout(() => (suppressBookingClick.current = false), 300);
    pointerDrag.current = null;
    setDragged(null);
    setTouchDraggingId(null);
    setTouchDropKey(null);
  };
  const jumpToDate = (value: string) => {
    if (!value) return;
    setMobileDay(value);
    setWeekStart(mondayForKey(value));
  };
  const activeMobileDay = days.some((day) => day.key === mobileDay)
    ? mobileDay
    : (days[0]?.key ?? weekStart);
  return (
    <>
      <div className="toolbar">
        <div className="week-picker">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            aria-label="Semana anterior"
          >
            <ChevronLeft />
          </Button>
          <div>
            <strong>
              {days[0].label} al {days[6].label}
            </strong>
            <span>Agenda semanal · {reservations.length} turnos</span>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            aria-label="Semana siguiente"
          >
            <ChevronRight />
          </Button>
          <Button variant="outline" onClick={() => setWeekStart(mondayOf())}>
            Hoy
          </Button>
        </div>
        <label className="date-jump">
          <CalendarSearch />
          <span>Ir a fecha</span>
          <Input
            type="date"
            value={activeMobileDay}
            onChange={(event) => jumpToDate(event.target.value)}
            aria-label="Buscar una fecha"
          />
        </label>
        <div className="toolbar-right">
          <div className="view-toggle">
            <Button
              variant={compactOnly ? "outline" : "default"}
              size="sm"
              onClick={() => setCompactOnly(false)}
            >
              <LayoutGrid /> Calendario
            </Button>
            <Button
              variant={compactOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setCompactOnly(true)}
            >
              <List /> Solo turnos
            </Button>
          </div>
          {!compactOnly && (
            <div className="mobile-view-toggle" aria-label="Vista móvil">
              <Button
                variant={mobileWeek ? "default" : "outline"}
                size="sm"
                onClick={() => setMobileWeek(true)}
              >
                Semana
              </Button>
              <Button
                variant={mobileWeek ? "outline" : "default"}
                size="sm"
                onClick={() => setMobileWeek(false)}
              >
                Día
              </Button>
            </div>
          )}
          {!compactOnly && (
            <label className="zoom-control">
              <button
                type="button"
                onClick={() => setZoom((value) => Math.max(12, value - 4))}
                aria-label="Alejar calendario"
              >
                <Minus />
              </button>
              <ZoomIn />
              <input
                type="range"
                min="12"
                max="86"
                step="2"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                aria-label="Zoom del calendario"
              />
              <button
                type="button"
                onClick={() => setZoom((value) => Math.min(86, value + 4))}
                aria-label="Acercar calendario"
              >
                <Plus />
              </button>
            </label>
          )}
          <Filter className="filter-icon" />
          <NativeSelect
            value={courtFilter}
            onChange={(event) => setCourtFilter(event.target.value)}
          >
            <NativeSelectOption value="all">
              Todas las canchas
            </NativeSelectOption>
            {courtOptions.map((court) => (
              <NativeSelectOption value={court.id} key={court.id}>
                {court.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <div className="court-legend" aria-label="Referencia de canchas">
            <span className="court-main-key">Cancha 7</span>
            <span className="court-multi-key">Fútbol 5</span>
          </div>
          <NativeSelect
            value={staffFilter}
            onChange={(event) => setStaffFilter(event.target.value)}
            aria-label="Filtrar por personal"
          >
            <NativeSelectOption value="all">
              Todo el personal
            </NativeSelectOption>
            <NativeSelectOption value="unassigned">
              Sin cobertura asignada
            </NativeSelectOption>
            {staff.map((person) => (
              <NativeSelectOption key={person.id} value={person.id}>
                {person.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {pendingCount > 0 && (
            <div className="pending-actions">
              <span>{pendingCount} cambio(s) sin guardar</span>
              <Button variant="outline" size="sm" onClick={onUndo}>
                <RotateCcw /> Deshacer
              </Button>
              <Button size="sm" onClick={onSave} disabled={savingMoves}>
                <Save /> {savingMoves ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>
          )}
        </div>
      </div>
      <div className="agenda-help">
        {moveTarget ? (
          <>
            <strong>
              Moviendo: {moveTarget.clientName}. Tocá el horario de destino.
            </strong>
            <Button size="sm" variant="outline" onClick={onCancelMove}>
              Cancelar movimiento
            </Button>
          </>
        ) : (
          <span>
            Deslizá para recorrer la agenda. Abrí un turno para moverlo o
            copiarlo. En PC: Alt + arrastrar copia.
          </span>
        )}
      </div>
      {!compactOnly && !mobileWeek && (
        <div className="mobile-days" aria-label="Días de la semana">
          {days.map((day) => (
            <button
              type="button"
              key={day.key}
              className={activeMobileDay === day.key ? "selected" : ""}
              aria-pressed={activeMobileDay === day.key}
              onClick={() => setMobileDay(day.key)}
            >
              <span>{day.short}</span>
              <strong>{day.label.split(" ")[0]}</strong>
            </button>
          ))}
        </div>
      )}
      {compactOnly ? (
        <section className="compact-agenda" aria-busy={loading}>
          {days.map((day) => {
            const dayReservations = reservations
              .filter((item) => localParts(item.startsAt).date === day.key)
              .sort((a, b) =>
                a.courtId === b.courtId
                  ? Date.parse(a.startsAt) - Date.parse(b.startsAt)
                  : a.courtId === "court-main"
                    ? -1
                    : 1,
              );
            return (
              <article key={day.key} className="compact-day">
                <header>
                  <strong>
                    {day.short} {day.label}
                  </strong>
                  <span>{dayReservations.length} turnos</span>
                </header>
                {dayReservations.length ? (
                  dayReservations.map((item) => {
                    const parts = localParts(item.startsAt);
                    return (
                      <button
                        key={item.id}
                        className={`compact-booking status-${item.status}`}
                        onClick={() => onEditReservation(item)}
                      >
                        <i style={{ background: item.color }} />
                        <span>
                          <strong>
                            {parts.time} · {item.clientName}
                          </strong>
                          <small>
                            {item.courtName} · {item.status} · cargó{" "}
                            {item.createdByName}
                          </small>
                          <small>
                            Cubre:{" "}
                            {item.coverage
                              ?.map((person) => person.name)
                              .join(", ") || "Sin asignar"}
                          </small>
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <p>Sin reservas</p>
                )}
              </article>
            );
          })}
        </section>
      ) : (
        <section
          className={`schedule-card ${mobileWeek ? "mobile-week" : "mobile-day"}`}
          aria-busy={loading}
          data-density={zoom < 26 ? "compact" : "normal"}
          style={
            {
              "--slot-height": `${zoom}px`,
              "--day-width": `${Math.round(zoom * 3)}px`,
            } as CSSProperties
          }
        >
          <div className="schedule-grid">
            <div className="corner-cell">Hora</div>
            {days.map((day, index) => (
              <div
                className={`day-header ${index === 0 ? "today" : ""} ${activeMobileDay === day.key ? "mobile-active" : ""}`}
                key={day.key}
                data-day={day.key}
              >
                <span>{day.short}</span>
                <strong>{day.label}</strong>
              </div>
            ))}
            <div className="time-column">
              {hours.map((hour) => (
                <div key={hour}>{hour}</div>
              ))}
            </div>
            {days.map((day, dayIndex) => (
              <div
                className={`day-column ${dayIndex === 0 ? "today-column" : ""} ${activeMobileDay === day.key ? "mobile-active" : ""}`}
                key={day.key}
                data-day={day.key}
              >
                {hours.map((hour) => (
                  <button
                    className="slot"
                    key={hour}
                    data-drop-day={day.key}
                    data-drop-time={hour}
                    data-touch-target={
                      touchDropKey === `${day.key}-${hour}` ? "true" : undefined
                    }
                    onClick={() =>
                      moveTarget
                        ? onDropReservation(moveTarget, day.key, hour)
                        : onCreateAt(day.key, hour)
                    }
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (dragged)
                        void onDropReservation(
                          dragged,
                          day.key,
                          hour,
                          event.altKey,
                        );
                      setDragged(null);
                    }}
                    aria-label={`Crear o mover reserva el ${day.short} a las ${hour}`}
                  />
                ))}
                {reservations
                  .filter((item) => localParts(item.startsAt).date === day.key)
                  .sort((a, b) =>
                    a.courtId === b.courtId
                      ? Date.parse(a.startsAt) - Date.parse(b.startsAt)
                      : a.courtId === "court-main"
                        ? 1
                        : -1,
                  )
                  .map((item) => {
                    const parts = localParts(item.startsAt);
                    const [hour, minute] = parts.time.split(":").map(Number);
                    const start = (hour - startHour) * 2 + minute / 30;
                    const span =
                      (Date.parse(item.endsAt) - Date.parse(item.startsAt)) /
                      1800000;
                    return (
                      <button
                        draggable
                        onClick={() => {
                          if (suppressBookingClick.current) return;
                          onEditReservation(item);
                        }}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "copyMove";
                          event.dataTransfer.setData("text/plain", item.id);
                          setDragged(item);
                        }}
                        onDragEnd={() => setDragged(null)}
                        onContextMenu={(event) => event.preventDefault()}
                        key={item.id}
                        className={`booking court-${item.courtId === "court-main" ? "main" : "multi"} status-${item.status} ${touchDraggingId === item.id ? "touch-dragging" : ""}`}
                        style={{
                          top: `calc(${start} * var(--slot-height) + 5px)`,
                          height: `calc(${span} * var(--slot-height) - 9px)`,
                          background: item.color,
                          zIndex: item.courtId === "court-main" ? 5 : 4,
                        }}
                      >
                        <span
                          className="booking-drag-handle"
                          role="button"
                          aria-label={`Arrastrar ${item.clientName}`}
                          tabIndex={-1}
                          onClick={(event) => event.stopPropagation()}
                          onPointerDown={(event) =>
                            startBookingPointer(event, item)
                          }
                          onPointerMove={moveBookingPointer}
                          onPointerUp={endBookingPointer}
                          onPointerCancel={endBookingPointer}
                        >
                          <Move />
                        </span>
                        <strong>{item.clientName}</strong>
                        <small className="booking-people">
                          Cargó: {item.createdByName}
                        </small>
                        <small className="booking-people">
                          Cubre:{" "}
                          {item.coverage
                            ?.map((person) => person.name)
                            .join(", ") || "Sin asignar"}
                        </small>
                        <span>
                          {parts.time} · {item.courtName}
                        </span>
                        <span>
                          {item.paymentMode === "mensual"
                            ? "Abono mensual"
                            : item.balance > 0
                              ? `Saldo ${money.format(item.balance)}`
                              : item.status}
                        </span>
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function NewReservationDialog({
  open,
  setOpen,
  defaultDate,
  defaultTime,
  onSaved,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
  defaultDate: string;
  defaultTime: string;
  onSaved: () => Promise<void>;
}) {
  const [paymentMode, setPaymentMode] = useState("por_encuentro");
  const [courtId, setCourtId] = useState("court-main");
  const [bookingTypeId, setBookingTypeId] = useState("type-rental");
  const selectedType =
    typeOptions.find(([id]) => id === bookingTypeId) ?? typeOptions[0];
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = String(form.get("date"));
    const time = String(form.get("time"));
    const duration = Number(form.get("duration"));
    const type =
      typeOptions.find(([id]) => id === form.get("bookingTypeId")) ??
      typeOptions[0];
    const startsAt = toIso(date, time);
    const endsAt = new Date(
      Date.parse(startsAt) + duration * 60000,
    ).toISOString();
    const body = Object.fromEntries(form.entries());
    const response = await fetch("/api/reservations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...body,
        startsAt,
        endsAt,
        color: body.color || type[2],
        repeatWeekly: bookingTypeId === "type-fixed",
      }),
    });
    const result = (await response.json()) as MutationResult;
    if (!response.ok) toast.error(result.error);
    else {
      const createdCount = Number(result.createdCount ?? 1);
      const skippedCount = Array.isArray(result.skipped)
        ? result.skipped.length
        : 0;
      toast.success(
        createdCount > 1
          ? `${createdCount} turnos fijos creados`
          : "Reserva creada",
        skippedCount
          ? { description: `${skippedCount} fechas ocupadas fueron omitidas.` }
          : undefined,
      );
      setOpen(false);
      await onSaved();
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setPaymentMode("por_encuentro");
          setCourtId("court-main");
          setBookingTypeId("type-rental");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="new-booking" onClick={() => setOpen(true)}>
          <Plus /> Nueva reserva
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva reserva</DialogTitle>
          <DialogDescription>
            La disponibilidad se valida nuevamente al guardar para evitar
            superposiciones.
          </DialogDescription>
        </DialogHeader>
        <form
          key={`${defaultDate}-${defaultTime}`}
          className="form-grid"
          onSubmit={submit}
        >
          <label className="span-2">
            Cliente, equipo o institución
            <Input name="clientName" required />
          </label>
          <label>
            Teléfono
            <Input name="phone" inputMode="tel" />
          </label>
          <label>
            Cancha
            <NativeSelect
              name="courtId"
              value={courtId}
              onChange={(event) => setCourtId(event.target.value)}
              className="w-full"
            >
              {courtOptions.map((court) => (
                <NativeSelectOption key={court.id} value={court.id}>
                  {court.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <label>
            Fecha
            <Input
              name="date"
              type="date"
              defaultValue={defaultDate}
              required
            />
          </label>
          <label>
            Hora
            <Input
              name="time"
              type="time"
              defaultValue={defaultTime}
              step="1800"
              required
            />
          </label>
          <label>
            Duración
            <NativeSelect name="duration" defaultValue="60" className="w-full">
              {[30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 360, 480].map(
                (minutes) => (
                  <NativeSelectOption value={minutes} key={minutes}>
                    {minutes < 60 ? "30 min" : `${minutes / 60} h`}
                  </NativeSelectOption>
                ),
              )}
            </NativeSelect>
          </label>
          <label>
            Tipo
            <NativeSelect
              name="bookingTypeId"
              value={bookingTypeId}
              onChange={(event) => setBookingTypeId(event.target.value)}
              className="w-full"
            >
              {typeOptions.map(([id, name]) => (
                <NativeSelectOption value={id} key={id}>
                  {name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          {bookingTypeId === "type-fixed" && (
            <label className="span-2 recurrence-field">
              Repetir semanalmente hasta
              <Input
                name="repeatUntil"
                type="date"
                defaultValue={addDays(defaultDate, 364)}
                min={defaultDate}
                required
              />
              <small>
                Se cargará automáticamente el mismo día y horario durante un
                año. Las fechas ya ocupadas se omiten.
              </small>
            </label>
          )}
          <label>
            Estado
            <NativeSelect name="status" className="w-full">
              <NativeSelectOption value="pendiente">
                Pendiente
              </NativeSelectOption>
              <NativeSelectOption value="confirmado">
                Confirmado
              </NativeSelectOption>
              <NativeSelectOption value="cancelado">
                Cancelado
              </NativeSelectOption>
            </NativeSelect>
          </label>
          <label>
            Modalidad de pago
            <NativeSelect
              name="paymentMode"
              value={paymentMode}
              onChange={(event) => setPaymentMode(event.target.value)}
              className="w-full"
            >
              <NativeSelectOption value="por_encuentro">
                Por encuentro
              </NativeSelectOption>
              <NativeSelectOption value="mensual">
                Abono mensual
              </NativeSelectOption>
              <NativeSelectOption value="bonificado">
                Bonificado
              </NativeSelectOption>
            </NativeSelect>
          </label>
          <label>
            Precio del turno
            <Input
              key={`${courtId}-${paymentMode}`}
              name="listPrice"
              type="number"
              min="0"
              step="100"
              defaultValue={
                courtOptions.find((court) => court.id === courtId)?.price ?? 0
              }
              disabled={paymentMode === "mensual"}
            />
            {paymentMode === "mensual" && (
              <small>
                El abono se registra después en Cobros, sin modificar la agenda.
              </small>
            )}
          </label>
          <ColorField key={bookingTypeId} defaultValue={selectedType[2]} />
          <label>
            Descuento
            <NativeSelect name="discountType" className="w-full">
              <NativeSelectOption value="none">
                Sin descuento
              </NativeSelectOption>
              <NativeSelectOption value="amount">Importe</NativeSelectOption>
              <NativeSelectOption value="percent">
                Porcentaje
              </NativeSelectOption>
            </NativeSelect>
          </label>
          <label>
            Valor del descuento
            <Input
              name="discountValue"
              type="number"
              min="0"
              defaultValue="0"
            />
          </label>
          <label>
            Motivo
            <Input name="discountReason" />
          </label>
          <label className="span-2">
            Observaciones
            <Input name="notes" />
          </label>
          <div className="form-actions span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit">Guardar reserva</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ColorField({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue.toUpperCase());
  return (
    <fieldset className="color-picker">
      <legend>Color</legend>
      <input type="hidden" name="color" value={value} />
      <div className="color-swatches">
        {colorChoices.map((choice) => (
          <button
            key={`${choice.name}-${choice.color}`}
            type="button"
            className={`color-swatch ${value === choice.color ? "selected" : ""}`}
            onClick={() => setValue(choice.color)}
            title={choice.name}
            aria-label={`Usar color de ${choice.name}`}
            aria-pressed={value === choice.color}
          >
            <span style={{ backgroundColor: choice.color }} />
          </button>
        ))}
        <label className="custom-color" title="Elegir otro color">
          <input
            type="color"
            value={value}
            onChange={(event) => setValue(event.target.value.toUpperCase())}
            aria-label="Elegir otro color"
          />
          <span>Otro</span>
        </label>
      </div>
    </fieldset>
  );
}

function EditReservationDialog({
  reservation,
  setReservation,
  onSaved,
  onMove,
}: {
  reservation: Reservation | null;
  setReservation: (value: Reservation | null) => void;
  onSaved: () => Promise<void>;
  onMove: (reservation: Reservation) => void;
}) {
  if (!reservation) return null;
  return (
    <EditReservationForm
      key={reservation.id}
      reservation={reservation}
      setReservation={setReservation}
      onSaved={onSaved}
      onMove={onMove}
    />
  );
}

function EditReservationForm({
  reservation,
  setReservation,
  onSaved,
  onMove,
}: {
  reservation: Reservation;
  setReservation: (value: Reservation | null) => void;
  onSaved: () => Promise<void>;
  onMove: (reservation: Reservation) => void;
}) {
  const [paymentMode, setPaymentMode] = useState(reservation.paymentMode);
  const parts = localParts(reservation.startsAt);
  const duration =
    (Date.parse(reservation.endsAt) - Date.parse(reservation.startsAt)) / 60000;
  const [copyDate, setCopyDate] = useState(addDays(parts.date, 7));
  const [copyTime, setCopyTime] = useState(parts.time);
  const [actionBusy, setActionBusy] = useState(false);
  const [deleteChoicesOpen, setDeleteChoicesOpen] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const isRecurring =
    reservation.bookingTypeId === "type-fixed" && Boolean(reservation.seriesId);

  const copyReservation = async () => {
    setActionBusy(true);
    const startsAt = toIso(copyDate, copyTime);
    const endsAt = new Date(
      Date.parse(startsAt) + duration * 60000,
    ).toISOString();
    const response = await fetch("/api/reservations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientName: reservation.clientName,
        phone: reservation.phone,
        courtId: reservation.courtId,
        bookingTypeId: reservation.bookingTypeId,
        startsAt,
        endsAt,
        status: reservation.status,
        color: reservation.color,
        notes: reservation.notes,
        paymentMode: reservation.paymentMode,
        listPrice: reservation.listPrice,
        repeatWeekly: false,
      }),
    });
    const result = (await response.json()) as MutationResult;
    setActionBusy(false);
    if (!response.ok) toast.error(result.error);
    else {
      toast.success("Reserva copiada", {
        description: `${copyDate} a las ${copyTime}`,
      });
      setReservation(null);
      await onSaved();
    }
  };

  const deleteReservation = async (scope: "one" | "series") => {
    const message =
      scope === "series"
        ? "¿Eliminar todos los turnos de esta recurrencia?"
        : "¿Eliminar solamente esta reserva?";
    if (!window.confirm(message)) return;
    setActionBusy(true);
    const response = await fetch(
      `/api/reservations/${reservation.id}?scope=${scope}`,
      { method: "DELETE" },
    );
    const result = (await response.json()) as MutationResult;
    setActionBusy(false);
    if (!response.ok) toast.error(result.error);
    else {
      toast.success(
        scope === "series"
          ? `${result.deleted} turnos eliminados`
          : "Reserva eliminada",
      );
      setReservation(null);
      await onSaved();
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = String(form.get("date"));
    const time = String(form.get("time"));
    const minutes = Number(form.get("duration"));
    const startsAt = toIso(date, time);
    const endsAt = new Date(
      Date.parse(startsAt) + minutes * 60000,
    ).toISOString();
    const body = Object.fromEntries(form.entries());
    const response = await fetch(`/api/reservations/${reservation.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...body,
        startsAt,
        endsAt,
        version: reservation.version,
        finalPrice: body.listPrice,
      }),
    });
    const result = (await response.json()) as MutationResult;
    if (!response.ok) toast.error(result.error);
    else {
      toast.success("Reserva actualizada");
      setReservation(null);
      await onSaved();
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) setReservation(null);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar reserva</DialogTitle>
          <DialogDescription>
            Creada por {reservation.createdByName}. Podés cambiar el horario, la
            cancha y el color.
          </DialogDescription>
        </DialogHeader>
        <div className="reservation-quick-actions">
          <Button
            type="button"
            variant="outline"
            onClick={() => onMove(reservation)}
          >
            <Move /> Mover
          </Button>
          <Button
            type="button"
            variant={showCopy ? "default" : "outline"}
            onClick={() => setShowCopy(!showCopy)}
          >
            <Copy /> Copiar
          </Button>
          <a className="button-link secondary" href="#reservation-coverage">
            Personal
          </a>
        </div>
        {showCopy && (
          <section className="copy-panel">
            <div className="copy-panel-title">
              <Copy />
              <strong>Copiar a otra fecha y hora</strong>
            </div>
            <label>
              Fecha
              <Input
                type="date"
                value={copyDate}
                onChange={(event) => setCopyDate(event.target.value)}
              />
            </label>
            <label>
              Hora
              <Input
                type="time"
                step="1800"
                value={copyTime}
                onChange={(event) => setCopyTime(event.target.value)}
              />
            </label>
            <Button
              type="button"
              onClick={copyReservation}
              disabled={actionBusy || !copyDate || !copyTime}
            >
              Crear copia
            </Button>
          </section>
        )}
        <form key={reservation.id} className="form-grid" onSubmit={submit}>
          <label className="span-2">
            Cliente, equipo o institución
            <Input
              name="clientName"
              defaultValue={reservation.clientName}
              required
            />
          </label>
          <label>
            Teléfono
            <Input name="phone" defaultValue={reservation.phone} />
          </label>
          <label>
            Cancha
            <NativeSelect
              name="courtId"
              defaultValue={reservation.courtId}
              className="w-full"
            >
              {courtOptions.map((court) => (
                <NativeSelectOption key={court.id} value={court.id}>
                  {court.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <label>
            Fecha
            <Input name="date" type="date" defaultValue={parts.date} required />
          </label>
          <label>
            Hora
            <Input
              name="time"
              type="time"
              defaultValue={parts.time}
              step="1800"
              required
            />
          </label>
          <label>
            Duración
            <NativeSelect
              name="duration"
              defaultValue={String(duration)}
              className="w-full"
            >
              {[30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 360, 480].map(
                (minutes) => (
                  <NativeSelectOption value={minutes} key={minutes}>
                    {minutes < 60 ? "30 min" : `${minutes / 60} h`}
                  </NativeSelectOption>
                ),
              )}
            </NativeSelect>
          </label>
          <label>
            Estado
            <NativeSelect
              name="status"
              defaultValue={reservation.status}
              className="w-full"
            >
              <NativeSelectOption value="pendiente">
                Pendiente
              </NativeSelectOption>
              <NativeSelectOption value="confirmado">
                Confirmado
              </NativeSelectOption>
              <NativeSelectOption value="cancelado">
                Cancelado
              </NativeSelectOption>
            </NativeSelect>
          </label>
          <label>
            Modalidad de pago
            <NativeSelect
              name="paymentMode"
              value={paymentMode}
              onChange={(event) => setPaymentMode(event.target.value)}
              className="w-full"
            >
              <NativeSelectOption value="por_encuentro">
                Por encuentro
              </NativeSelectOption>
              <NativeSelectOption value="mensual">
                Abono mensual
              </NativeSelectOption>
              <NativeSelectOption value="bonificado">
                Bonificado
              </NativeSelectOption>
            </NativeSelect>
          </label>
          <label>
            Precio del turno
            <Input
              name="listPrice"
              type="number"
              min="0"
              step="100"
              defaultValue={reservation.listPrice}
              disabled={paymentMode === "mensual"}
            />
            {paymentMode === "mensual" && (
              <small>El pago mensual se agrega en Cobros.</small>
            )}
          </label>
          <ColorField defaultValue={reservation.color} />
          <label className="span-2">
            Observaciones
            <Input name="notes" defaultValue={reservation.notes} />
          </label>
          <section className="copy-panel span-2" hidden>
            <div className="copy-panel-title">
              <Copy />
              <div>
                <strong>Copiar reserva</strong>
                <span>Elegí la fecha y hora de la nueva copia.</span>
              </div>
            </div>
            <label>
              Fecha de la copia
              <Input
                type="date"
                value={copyDate}
                onChange={(event) => setCopyDate(event.target.value)}
              />
            </label>
            <label>
              Hora
              <Input
                type="time"
                step="1800"
                value={copyTime}
                onChange={(event) => setCopyTime(event.target.value)}
              />
            </label>
            <Button
              type="button"
              variant="outline"
              onClick={copyReservation}
              disabled={actionBusy || !copyDate || !copyTime}
            >
              <Copy /> Crear copia
            </Button>
          </section>
          {deleteChoicesOpen && isRecurring && (
            <section className="delete-choice-panel span-2">
              <strong>Este turno pertenece a una recurrencia</strong>
              <span>¿Qué querés eliminar?</span>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => deleteReservation("one")}
                  disabled={actionBusy}
                >
                  Solo este día
                </Button>
                <Button
                  type="button"
                  className="danger-button"
                  onClick={() => deleteReservation("series")}
                  disabled={actionBusy}
                >
                  Toda la recurrencia
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDeleteChoicesOpen(false)}
                >
                  Cancelar
                </Button>
              </div>
            </section>
          )}
          <div className="form-actions span-2">
            <Button
              type="button"
              variant="outline"
              className="delete-button"
              disabled={actionBusy}
              onClick={() => {
                if (isRecurring) setDeleteChoicesOpen(true);
                else void deleteReservation("one");
              }}
            >
              <Trash2 /> Eliminar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReservation(null)}
            >
              Cerrar
            </Button>
            <Button type="submit">Guardar cambios</Button>
          </div>
        </form>
        <ReservationCoverage reservation={reservation} onSaved={onSaved} />
        <p className="reservation-author">
          Reserva cargada por <strong>{reservation.createdByName}</strong>
        </p>
      </DialogContent>
    </Dialog>
  );
}

function StaffSelector({
  people,
  onAdded,
}: {
  people: { id: string; name: string }[];
  onAdded?: () => void;
}) {
  const [selected, setSelected] = useState("");
  const [manual, setManual] = useState(false);
  const [name, setName] = useState("");
  const [added, setAdded] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const choices = Array.from(
    new Map(
      [...people, ...added].map((person) => [person.id, person]),
    ).values(),
  );
  const add = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/staff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = (await response.json()) as {
        person: { id: string; name: string };
        error?: string;
      };
      if (!response.ok) throw new Error(result.error);
      setAdded((current) => [...current, result.person]);
      setSelected(result.person.id);
      setManual(false);
      setName("");
      onAdded?.();
      toast.success("Persona agregada");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo agregar la persona",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="staff-selector">
      <NativeSelect
        name="staffId"
        value={selected}
        required
        onChange={(event) => {
          if (event.target.value === "__other") {
            setManual(true);
            setSelected("");
          } else {
            setSelected(event.target.value);
            setManual(false);
          }
        }}
        aria-label="Seleccionar persona"
      >
        <NativeSelectOption value="" disabled>
          Elegir persona
        </NativeSelectOption>
        {choices.map((person) => (
          <NativeSelectOption key={person.id} value={person.id}>
            {person.name}
          </NativeSelectOption>
        ))}
        <NativeSelectOption value="__other">
          Otro · agregar persona
        </NativeSelectOption>
      </NativeSelect>
      {manual && (
        <div className="manual-staff">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nombre de la persona"
            aria-label="Nombre de otra persona"
            maxLength={80}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void add();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            disabled={busy || !name.trim()}
            onClick={() => void add()}
          >
            {busy ? "Agregando…" : "Agregar persona"}
          </Button>
        </div>
      )}
    </div>
  );
}

function ReservationCoverage({
  reservation,
  onSaved,
}: {
  reservation: Reservation;
  onSaved: () => Promise<void>;
}) {
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/work-logs?reservationId=${encodeURIComponent(reservation.id)}`,
      );
      const result = (await response.json()) as {
        error?: string;
        workLogs: WorkLog[];
        staff: { id: string; name: string }[];
      };
      if (!response.ok) throw new Error(result.error);
      setLogs(result.workLogs);
      setPeople(result.staff);
      setError("");
    } catch {
      setError("No se pudo cargar el personal. Reintentá abriendo la reserva.");
    }
  }, [reservation.id]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const start = localParts(reservation.startsAt);
  const end = localParts(reservation.endsAt);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    try {
      const response = await fetch("/api/work-logs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reservationId: reservation.id,
          staffId: values.get("staffId"),
          startsAt: new Date(
            `${values.get("startsAt")}:00-03:00`,
          ).toISOString(),
          endsAt: new Date(`${values.get("endsAt")}:00-03:00`).toISOString(),
          functionName: values.get("functionName"),
          notes: values.get("notes"),
        }),
      });
      const result = (await response.json()) as MutationResult;
      if (!response.ok) throw new Error(result.error);
      toast.success("Cobertura registrada en horas de personal");
      await load();
      await onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo registrar la cobertura",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section id="reservation-coverage" className="coverage-panel">
      <h3>Personal que cubrió el turno</h3>
      <p>
        Agregá una o varias personas, antes o después del turno. Cada registro
        suma sus horas en Personal.
      </p>
      {error && <p role="alert">{error}</p>}
      {logs.map((log) => (
        <div key={log.id} className="coverage-row">
          <strong>{log.staffName}</strong>
          <span>
            {dateTime.format(new Date(log.startsAt))} →{" "}
            {dateTime.format(new Date(log.endsAt))}
          </span>
          <small>
            {log.functionName} ·{" "}
            {(
              (Date.parse(log.endsAt) - Date.parse(log.startsAt)) /
              3600000
            ).toFixed(1)}{" "}
            h
          </small>
        </div>
      ))}
      <form className="form-grid" onSubmit={submit}>
        <label>
          Persona
          <StaffSelector people={people} onAdded={() => void load()} />
        </label>
        <label>
          Función
          <NativeSelect name="functionName">
            <NativeSelectOption>Atención de cancha</NativeSelectOption>
            <NativeSelectOption>Buffet</NativeSelectOption>
            <NativeSelectOption>Organización de torneo</NativeSelectOption>
            <NativeSelectOption>Limpieza o cierre</NativeSelectOption>
            <NativeSelectOption>Otra</NativeSelectOption>
          </NativeSelect>
        </label>
        <label>
          Entrada
          <Input
            name="startsAt"
            type="datetime-local"
            defaultValue={`${start.date}T${start.time}`}
            required
          />
        </label>
        <label>
          Salida
          <Input
            name="endsAt"
            type="datetime-local"
            defaultValue={`${end.date}T${end.time}`}
            required
          />
        </label>
        <label className="span-2">
          Observaciones
          <Input name="notes" />
        </label>
        <Button
          className="span-2"
          type="submit"
          disabled={busy || !people.length}
        >
          {busy ? "Guardando…" : "Agregar persona y horas"}
        </Button>
      </form>
    </section>
  );
}

function ReservationsView({ reservations }: { reservations: Reservation[] }) {
  return (
    <section className="content-card">
      <div className="section-heading">
        <div>
          <h2>Reservas</h2>
          <p>Vista ordenada de turnos, cobros y saldos.</p>
        </div>
        <a className="button-link" href="/api/export?kind=reservations">
          <Download /> Exportar Excel
        </a>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Fecha y hora</TableHead>
            <TableHead>Cancha</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Cargado por</TableHead>
            <TableHead>Importe</TableHead>
            <TableHead>Saldo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reservations.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <span
                  className="color-dot"
                  style={{ background: item.color }}
                />
                <strong>{item.clientName}</strong>
                <small>{item.bookingType}</small>
              </TableCell>
              <TableCell>{dateTime.format(new Date(item.startsAt))}</TableCell>
              <TableCell>{item.courtName}</TableCell>
              <TableCell>
                <span className={`status-chip status-${item.status}`}>
                  {item.status}
                </span>
              </TableCell>
              <TableCell>{item.createdByName}</TableCell>
              <TableCell>
                {item.paymentMode === "mensual"
                  ? "Abono"
                  : money.format(item.finalPrice)}
              </TableCell>
              <TableCell>
                {item.paymentMode === "mensual"
                  ? "—"
                  : money.format(item.balance)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

function PaymentsView({
  data,
  open,
  setOpen,
  onSaved,
}: {
  data: DashboardData | null;
  open: boolean;
  setOpen: (value: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [paymentKind, setPaymentKind] = useState("turno");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    const response = await fetch("/api/payments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...body,
        paidAt: new Date(String(body.paidAt)).toISOString(),
      }),
    });
    const result = (await response.json()) as MutationResult;
    if (!response.ok) toast.error(result.error);
    else {
      toast.success("Cobro registrado");
      setOpen(false);
      await onSaved();
    }
  };
  return (
    <>
      <div className="metric-grid">
        <Metric
          label="Cobrado"
          value={money.format(data?.summary.collected ?? 0)}
          tone="green"
        />
        <Metric
          label="Previsto por turnos"
          value={money.format(data?.summary.expected ?? 0)}
        />
        <Metric
          label="Pendiente por turnos"
          value={money.format(data?.summary.pending ?? 0)}
          tone="amber"
        />
        <Metric
          label="Descuentos"
          value={money.format(data?.summary.discounts ?? 0)}
        />
      </div>
      <section className="content-card">
        <div className="section-heading">
          <div>
            <h2>Cobros de la semana</h2>
            <p>
              Los abonos mensuales se agregan una sola vez y no modifican la
              agenda.
            </p>
          </div>
          <div className="heading-actions">
            <a
              className="button-link secondary"
              href="/api/export?kind=payments"
            >
              <Download /> Exportar
            </a>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus /> Agregar pago
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Agregar pago</DialogTitle>
                  <DialogDescription>
                    Podés cobrar un turno individual o registrar un abono
                    mensual separado.
                  </DialogDescription>
                </DialogHeader>
                <form className="form-grid" onSubmit={submit}>
                  <label className="span-2">
                    Tipo de pago
                    <NativeSelect
                      value={paymentKind}
                      onChange={(event) => setPaymentKind(event.target.value)}
                      className="w-full"
                    >
                      <NativeSelectOption value="turno">
                        Pago de un turno
                      </NativeSelectOption>
                      <NativeSelectOption value="abono">
                        Abono mensual
                      </NativeSelectOption>
                    </NativeSelect>
                  </label>
                  {paymentKind === "turno" ? (
                    <label className="span-2">
                      Reserva
                      <NativeSelect name="reservationId" className="w-full">
                        {data?.reservations
                          .filter(
                            (item) =>
                              item.paymentMode !== "mensual" &&
                              item.status !== "cancelado",
                          )
                          .map((item) => (
                            <NativeSelectOption key={item.id} value={item.id}>
                              {item.clientName} · saldo{" "}
                              {money.format(item.balance)}
                            </NativeSelectOption>
                          ))}
                      </NativeSelect>
                    </label>
                  ) : (
                    <>
                      <label>
                        Abonado
                        <NativeSelect name="seriesId" className="w-full">
                          {data?.subscriptions.map((item) => (
                            <NativeSelectOption
                              key={item.seriesId}
                              value={item.seriesId}
                            >
                              {item.clientName}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </label>
                      <label>
                        Período
                        <Input
                          name="period"
                          type="month"
                          defaultValue="2026-10"
                          required
                        />
                      </label>
                    </>
                  )}
                  <label>
                    Importe
                    <Input name="amount" type="number" min="1" required />
                  </label>
                  <label>
                    Medio
                    <NativeSelect name="method" className="w-full">
                      <NativeSelectOption value="efectivo">
                        Efectivo
                      </NativeSelectOption>
                      <NativeSelectOption value="transferencia">
                        Transferencia
                      </NativeSelectOption>
                      <NativeSelectOption value="mercado_pago">
                        Mercado Pago
                      </NativeSelectOption>
                      <NativeSelectOption value="otro">Otro</NativeSelectOption>
                    </NativeSelect>
                  </label>
                  <label className="span-2">
                    Fecha
                    <Input
                      name="paidAt"
                      type="datetime-local"
                      defaultValue="2026-10-04T12:00"
                      required
                    />
                  </label>
                  <label className="span-2">
                    Observaciones
                    <Input name="notes" />
                  </label>
                  <Button className="span-2" type="submit">
                    Guardar pago
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Reserva / abono</TableHead>
              <TableHead>Medio</TableHead>
              <TableHead>Notas</TableHead>
              <TableHead>Importe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.payments.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{dateTime.format(new Date(item.paidAt))}</TableCell>
                <TableCell>
                  {data.reservations.find(
                    (reservation) => reservation.id === item.reservationId,
                  )?.clientName ??
                    `${data.subscriptions.find((subscription) => subscription.seriesId === item.seriesId)?.clientName ?? "Abono"} ${item.period ?? ""}`}
                </TableCell>
                <TableCell>{item.method.replaceAll("_", " ")}</TableCell>
                <TableCell>{item.notes}</TableCell>
                <TableCell>
                  <strong>{money.format(item.amount)}</strong>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </>
  );
}

function StaffView({
  data,
  open,
  setOpen,
  onSaved,
}: {
  data: DashboardData | null;
  open: boolean;
  setOpen: (value: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    const response = await fetch("/api/work-logs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...body,
        startsAt: new Date(String(body.startsAt)).toISOString(),
        endsAt: new Date(String(body.endsAt)).toISOString(),
      }),
    });
    const result = (await response.json()) as MutationResult;
    if (!response.ok) toast.error(result.error);
    else {
      toast.success("Horas registradas");
      setOpen(false);
      await onSaved();
    }
  };
  return (
    <>
      <div className="metric-grid">
        <Metric
          label="Horas cargadas"
          value={`${data?.summary.staffHours ?? 0} h`}
          tone="green"
        />
        <Metric label="Personas activas" value="4" />
        <Metric
          label="Turnos con personal"
          value={String(
            new Set(
              data?.workLogs.map((item) => item.reservationId).filter(Boolean),
            ).size,
          )}
        />
        <Metric
          label="Horas reservadas"
          value={`${data?.summary.reservedHours ?? 0} h`}
        />
      </div>
      <section className="content-card">
        <div className="section-heading">
          <div>
            <h2>Horas de personal</h2>
            <p>
              Entrada y salida reales, incluso fuera del horario de la reserva.
            </p>
          </div>
          <div className="heading-actions">
            <a className="button-link secondary" href="/api/export?kind=staff">
              <Download /> Exportar
            </a>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus /> Cargar horas
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cargar horas trabajadas</DialogTitle>
                  <DialogDescription>
                    La duración se calcula con la entrada y salida reales.
                  </DialogDescription>
                </DialogHeader>
                <form className="form-grid" onSubmit={submit}>
                  <label>
                    Persona
                    <StaffSelector
                      people={(data?.staff ?? []).filter(
                        (person) => person.active,
                      )}
                      onAdded={() => void onSaved()}
                    />
                  </label>
                  <label>
                    Función
                    <NativeSelect name="functionName" className="w-full">
                      {[
                        "Atención de cancha",
                        "Organización de torneo",
                        "Atención de cumpleaños",
                        "Atención de buffet",
                        "Limpieza o cierre",
                        "Otra",
                      ].map((name) => (
                        <NativeSelectOption key={name}>
                          {name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </label>
                  <label>
                    Entrada
                    <Input
                      name="startsAt"
                      type="datetime-local"
                      defaultValue="2026-10-09T18:30"
                      required
                    />
                  </label>
                  <label>
                    Salida
                    <Input
                      name="endsAt"
                      type="datetime-local"
                      defaultValue="2026-10-09T22:30"
                      required
                    />
                  </label>
                  <label className="span-2">
                    Reserva opcional
                    <NativeSelect name="reservationId" className="w-full">
                      <NativeSelectOption value="">
                        Sin reserva asociada
                      </NativeSelectOption>
                      {data?.reservations.map((item) => (
                        <NativeSelectOption key={item.id} value={item.id}>
                          {item.clientName}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </label>
                  <label className="span-2">
                    Observaciones
                    <Input name="notes" />
                  </label>
                  <Button className="span-2">Guardar horas</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Persona</TableHead>
              <TableHead>Entrada</TableHead>
              <TableHead>Salida</TableHead>
              <TableHead>Horas</TableHead>
              <TableHead>Función</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.workLogs.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <strong>{item.staffName}</strong>
                </TableCell>
                <TableCell>
                  {dateTime.format(new Date(item.startsAt))}
                </TableCell>
                <TableCell>{dateTime.format(new Date(item.endsAt))}</TableCell>
                <TableCell>
                  {(
                    (Date.parse(item.endsAt) - Date.parse(item.startsAt)) /
                    3600000
                  ).toFixed(1)}
                </TableCell>
                <TableCell>{item.functionName}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </>
  );
}

function ReportsView({ data }: { data: DashboardData | null }) {
  return (
    <>
      <div className="metric-grid">
        <Metric
          label="Ingresos previstos"
          value={money.format(data?.summary.expected ?? 0)}
        />
        <Metric
          label="Ingresos cobrados"
          value={money.format(data?.summary.collected ?? 0)}
          tone="green"
        />
        <Metric
          label="Saldos pendientes"
          value={money.format(data?.summary.pending ?? 0)}
          tone="amber"
        />
        <Metric
          label="Ocupación estimada"
          value={`${Math.min(100, Math.round(((data?.summary.reservedHours ?? 0) / (7 * 15 * 2)) * 100))}%`}
        />
      </div>
      <section className="report-grid">
        <article className="content-card">
          <h2>Ingresos</h2>
          <p>Exportá el detalle para continuar el análisis en Excel.</p>
          <div className="download-stack">
            <a className="button-link" href="/api/export?kind=payments">
              <Download /> Cobros y abonos
            </a>
            <a
              className="button-link secondary"
              href="/api/export?kind=reservations"
            >
              <Download /> Reservas e importes
            </a>
          </div>
        </article>
        <article className="content-card">
          <h2>Personal</h2>
          <p>Incluye buffet, preparación y horas adicionales.</p>
          <div className="download-stack">
            <a className="button-link" href="/api/export?kind=staff">
              <Download /> Horas de personal
            </a>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> Imprimir / guardar PDF
            </Button>
          </div>
        </article>
      </section>
    </>
  );
}
function ConfigView({
  user,
  onPasswordChanged,
}: {
  user: User;
  onPasswordChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const form = event.currentTarget;
    const values = new FormData(form);
    const currentPassword = String(values.get("currentPassword"));
    const newPassword = String(values.get("newPassword"));
    const confirmation = String(values.get("confirmation"));
    if (newPassword !== confirmation) {
      toast.error("La confirmación no coincide");
      setBusy(false);
      return;
    }
    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const result = (await response.json()) as MutationResult;
    setBusy(false);
    if (!response.ok) toast.error(result.error);
    else {
      toast.success("Contraseña actualizada");
      form.reset();
      onPasswordChanged();
    }
  };
  return (
    <section className="report-grid">
      <article className="content-card">
        <h2>Seguridad de {user.displayName}</h2>
        <p>La nueva clave cierra las demás sesiones de este usuario.</p>
        <form className="form-grid config-password" onSubmit={submit}>
          <label className="span-2">
            Contraseña actual
            <Input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <label className="span-2">
            Nueva contraseña
            <Input
              name="newPassword"
              type="password"
              minLength={10}
              autoComplete="new-password"
              required
            />
          </label>
          <label className="span-2">
            Repetir nueva contraseña
            <Input
              name="confirmation"
              type="password"
              minLength={10}
              autoComplete="new-password"
              required
            />
          </label>
          <small className="span-2">
            Mínimo 10 caracteres, con mayúscula, minúscula y número.
          </small>
          <Button className="span-2" disabled={busy}>
            {busy ? "Actualizando…" : "Cambiar contraseña"}
          </Button>
        </form>
      </article>
      {user.role === "administrador" && (
        <article className="content-card">
          <h2>Administradores</h2>
          <p>Los roles se aplican en el servidor.</p>
          <ul className="config-list">
            <li>
              <strong>Javier · javier</strong>
              <span>Administrador</span>
            </li>
            <li>
              <strong>Yani · yani</strong>
              <span>Administrador</span>
            </li>
            <li>
              <strong>Ezequiel · ezequiel</strong>
              <span>Administrador</span>
            </li>
          </ul>
        </article>
      )}
      <article className="content-card">
        <h2>Configuración operativa</h2>
        <ul className="config-list">
          <li>
            <strong>Canchas</strong>
            <span>
              Cancha 7 sintético ($40.000) y multideporte, fútbol 5 ($25.000)
            </span>
          </li>
          <li>
            <strong>Intervalos</strong>
            <span>30 minutos</span>
          </li>
          <li>
            <strong>Colores</strong>
            <span>Predefinidos por actividad y ajustables manualmente</span>
          </li>
          <li>
            <strong>Medios de pago</strong>
            <span>Efectivo, transferencia, Mercado Pago</span>
          </li>
          <li>
            <strong>Historial</strong>
            <span>Reservas, cobros y horas</span>
          </li>
        </ul>
      </article>
    </section>
  );
}
function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
