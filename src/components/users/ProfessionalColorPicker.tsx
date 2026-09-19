import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROFESSIONAL_CALENDAR_COLORS, normalizeCalendarColor } from "@/lib/professionalCalendarColors";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function ProfessionalColorPicker({ value, onChange }: Props) {
  const normalized = normalizeCalendarColor(value);
  return (
    <div className="space-y-2">
      <Label>Cor na agenda</Label>
      <div className="flex flex-wrap items-center gap-2">
        {PROFESSIONAL_CALENDAR_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Selecionar cor ${color}`}
            aria-pressed={normalized === color}
            className={cn(
              "h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              normalized === color ? "border-foreground scale-110" : "border-background shadow-sm",
            )}
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
          />
        ))}
        <Input
          type="color"
          value={normalized}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="h-9 w-12 cursor-pointer p-1"
          aria-label="Escolher cor personalizada"
        />
      </div>
      <p className="text-xs text-muted-foreground">Esta cor identifica todos os agendamentos deste profissional.</p>
    </div>
  );
}