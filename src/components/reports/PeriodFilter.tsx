import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export type PeriodPreset = "7" | "15" | "30" | "custom";

export interface PeriodFilterProps {
  startDate: Date;
  endDate: Date;
  preset: PeriodPreset;
  onChange: (start: Date, end: Date, preset: PeriodPreset) => void;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return startOfDay(d);
}

export function applyPreset(p: Exclude<PeriodPreset, "custom">): { start: Date; end: Date } {
  return { start: daysAgo(Number(p) - 1), end: endOfDay(new Date()) };
}

export function PeriodFilter({ startDate, endDate, preset, onChange }: PeriodFilterProps) {
  const [openStart, setOpenStart] = useState(false);
  const [openEnd, setOpenEnd] = useState(false);

  const setPreset = (p: Exclude<PeriodPreset, "custom">) => {
    const { start, end } = applyPreset(p);
    onChange(start, end, p);
  };

  const presets: { key: Exclude<PeriodPreset, "custom">; label: string }[] = [
    { key: "7", label: "7 dias" },
    { key: "15", label: "15 dias" },
    { key: "30", label: "30 dias" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1.5 rounded-md border bg-card p-1">
        {presets.map((p) => (
          <Button
            key={p.key}
            type="button"
            size="sm"
            variant={preset === p.key ? "default" : "ghost"}
            className="h-8"
            onClick={() => setPreset(p.key)}
          >
            {p.label}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={preset === "custom" ? "default" : "ghost"}
          className="h-8"
          onClick={() => onChange(startDate, endDate, "custom")}
        >
          Personalizado
        </Button>
      </div>

      {preset === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <Popover open={openStart} onOpenChange={setOpenStart}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                {format(startDate, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(d) => {
                  if (!d) return;
                  onChange(startOfDay(d), endDate, "custom");
                  setOpenStart(false);
                }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">até</span>
          <Popover open={openEnd} onOpenChange={setOpenEnd}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                {format(endDate, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(d) => {
                  if (!d) return;
                  onChange(startDate, endOfDay(d), "custom");
                  setOpenEnd(false);
                }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
