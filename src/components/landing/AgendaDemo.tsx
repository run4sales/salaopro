import { useState } from 'react';
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { AgendaEvent } from '@/components/agenda/AgendaCalendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { PROFESSIONAL_CALENDAR_COLORS } from '@/lib/professionalCalendarColors';

const demoDate = new Date(2026, 9, 12, 12);
const localizer = dateFnsLocalizer({ format, parse, startOfWeek: (day: Date) => startOfWeek(day, { locale: ptBR }), getDay, locales: { 'pt-BR': ptBR } });
const events: AgendaEvent[] = [
  { id: 'demo-1', title: 'Cliente exemplo 1 · Corte · Profissional A', start: new Date(2026, 9, 12, 9), end: new Date(2026, 9, 12, 10), status: 'scheduled', professionalColor: PROFESSIONAL_CALENDAR_COLORS[0], raw: {} },
  { id: 'demo-2', title: 'Cliente exemplo 2 · Coloração · Profissional B', start: new Date(2026, 9, 12, 10, 30), end: new Date(2026, 9, 12, 12), status: 'confirmed', professionalColor: PROFESSIONAL_CALENDAR_COLORS[2], raw: {} },
  { id: 'demo-3', title: 'Intervalo · Profissional A', start: new Date(2026, 9, 12, 12), end: new Date(2026, 9, 12, 13), status: 'blocked', type: 'block', raw: {} },
  { id: 'demo-4', title: 'Cliente exemplo 3 · Escova · Profissional A', start: new Date(2026, 9, 12, 14), end: new Date(2026, 9, 12, 15), status: 'scheduled', professionalColor: PROFESSIONAL_CALENDAR_COLORS[0], raw: {} },
];

export default function AgendaDemo() {
  const [view, setView] = useState<View>('day');
  const [date, setDate] = useState(demoDate);
  const [selection, setSelection] = useState('Selecione um atendimento para ver seu resumo.');
  return <div className="landing-agenda-demo">
    <div className="rounded-lg border bg-card p-3"><Calendar localizer={localizer} culture="pt-BR" events={events} view={view} date={date}
      views={['day', 'week', 'month', 'agenda']} onView={setView} onNavigate={setDate} selectable step={30} timeslots={2}
      min={new Date(2026, 9, 12, 8)} max={new Date(2026, 9, 12, 17)}
      messages={{ today: 'Hoje', previous: 'Anterior', next: 'Próximo', month: 'Mês', week: 'Semana', day: 'Dia', agenda: 'Lista', date: 'Data', time: 'Hora', event: 'Atendimento', allDay: 'Dia inteiro', noEventsInRange: 'Sem agendamentos de exemplo no período', showMore: (n: number) => `+ ${n}` }}
      eventPropGetter={event => ({ className: event.type === 'block' ? 'landing-event-block' : event.id === 'demo-2' ? 'landing-event-secondary' : 'landing-event-primary' })}
      onSelectEvent={event => setSelection(event.title)} onSelectSlot={() => setSelection('No sistema, este horário pode receber um novo agendamento ou bloqueio.')} /></div>
    <p role="status" className="mt-3 min-h-10 text-sm text-muted-foreground">{selection}</p>
  </div>;
}