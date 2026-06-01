import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className, showLabel = true }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? theme !== "light" : true;
  const nextTheme = isDark ? "light" : "dark";
  const label = isDark ? "Modo claro" : "Modo escuro";
  const Icon = isDark ? Sun : Moon;

  return (
    <Button
      type="button"
      variant="outline"
      size={showLabel ? "sm" : "icon"}
      className={cn("border-border bg-background/80 text-foreground", showLabel && "justify-start", className)}
      onClick={() => setTheme(nextTheme)}
      aria-label={`Alternar para ${label.toLowerCase()}`}
      title={`Alternar para ${label.toLowerCase()}`}
    >
      <Icon className="h-4 w-4" />
      {showLabel && <span>{label}</span>}
    </Button>
  );
}
