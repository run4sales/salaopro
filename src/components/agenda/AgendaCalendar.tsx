import { useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer, View, SlotInfo } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { STATUS_COLORS, STATUS_LABELS, normalizeStatus } from "@/lib/appointmentStatus";

const locales = { "pt-BR": ptBR };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek: (d: Date) => startOfWeek(d, { locale: ptBR }), getDay, locales });

const MESSAGES = {
  date: "Data", time: "Hora", event: "Evento", allDay: "Dia inteiro",
  week: "Semana", work_week: "Semana útil", day: "Dia", month: "Mês",
  previous: "Anterior", next: "Próximo", yesterday: "Ontem", tomorrow: "Amanhã",
  today: "Hoje", agenda: "Lista", noEventsInRange: "Sem agendamentos no período",
  showMore: (n: number) => `+ ver mais (${n})`,
};

const toFullDayRange = (start: Date, end: Date) => {
  const startDate = new Date(start);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(end);
  endDate.setHours(23, 59, 59, 999);

  return { start: startDate, end: endDate };
};

export interface AgendaEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  status: string;
  raw: any;
}

interface Props {
  events: AgendaEvent[];
  onSelectSlot: (slot: SlotInfo) => void;
  onSelectEvent: (event: AgendaEvent) => void;
  onRangeChange?: (range: { start: Date; end: Date }) => void;
}

export function AgendaCalendar({ events, onSelectSlot, onSelectEvent, onRangeChange }: Props) {
  const [view, setView] = useState<View>("week");
  const [date, setDate] = useState<Date>(new Date());

  const eventPropGetter = useMemo(
    () => (event: AgendaEvent) => {
      const c = STATUS_COLORS[normalizeStatus(event.status)] ?? STATUS_COLORS.scheduled;
      return {
        style: {
          backgroundColor: c.bg,
          color: c.fg,
          border: `1px solid ${c.border}`,
          borderLeft: `4px solid ${c.border}`,
          borderRadius: 6,
          padding: "2px 6px",
          fontSize: 12,
          fontWeight: 500,
        },
      };
    },
    []
  );

  return (
    <div className="rounded-md border bg-card p-3 [&_.rbc-toolbar-label]:font-semibold [&_.rbc-toolbar-label]:capitalize [&_.rbc-today]:bg-primary/5 [&_.rbc-btn-group_button]:!border-border [&_.rbc-btn-group_button.rbc-active]:!bg-primary [&_.rbc-btn-group_button.rbc-active]:!text-primary-foreground [&_.rbc-header]:py-2 [&_.rbc-header]:text-xs [&_.rbc-header]:uppercase [&_.rbc-header]:tracking-wider [&_.rbc-time-view]:border-border [&_.rbc-month-view]:border-border [&_.rbc-event]:!shadow-sm">
      <Calendar
        localizer={localizer}
        events={events}
        view={view}
        date={date}
        onView={setView}
        onNavigate={setDate}
        views={["month", "week", "day", "agenda"]}
        defaultView="week"
        culture="pt-BR"
        messages={MESSAGES}
        selectable
        onSelectSlot={onSelectSlot}
        onSelectEvent={(e) => onSelectEvent(e as AgendaEvent)}
        onDrillDown={(d) => { setDate(d); setView("day"); }}
        onRangeChange={(range: any) => {
          if (Array.isArray(range) && range.length > 0) {
            onRangeChange?.(toFullDayRange(range[0], range[range.length - 1]));
          } else if (range?.start && range?.end) {
            onRangeChange?.(toFullDayRange(range.start, range.end));
          }
        }}
        style={{ height: 680 }}
        tooltipAccessor={(e: any) => `${e.title} — ${STATUS_LABELS[normalizeStatus(e.status)] ?? ""}`}
        step={30}
        timeslots={2}
      />
    </div>
  );
}
