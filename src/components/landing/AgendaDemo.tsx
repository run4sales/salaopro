import { useState } from 'react';
import type { View } from 'react-big-calendar';
import { AgendaCalendar, type AgendaEvent } from '@/components/agenda/AgendaCalendar';
import { PROFESSIONAL_CALENDAR_COLORS } from '@/lib/professionalCalendarColors';

const demoDate = new Date(2026, 9, 12, 12);
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
    <AgendaCalendar events={events} view={view} date={date} openTime="08:00" closeTime="17:00" onViewChange={setView} onNavigate={setDate}
      onSelectEvent={event => setSelection(event.title)} onSelectSlot={() => setSelection('No sistema, este horário pode receber um novo agendamento ou bloqueio.')} />
    <p role="status" className="mt-3 min-h-10 text-sm text-muted-foreground">{selection}</p>
  </div>;
}