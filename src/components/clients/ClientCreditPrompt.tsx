import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  availableCredit: number;
  total: number;
  onConfirm: (amount: number) => void;
  onDecline: () => void;
}

/**
 * Modal de confirmação para usar crédito do cliente em uma venda.
 * Aparece automaticamente quando um cliente com saldo é associado à venda.
 */
export function ClientCreditPrompt({
  open,
  onOpenChange,
  availableCredit,
  total,
  onConfirm,
  onDecline,
}: Props) {
  const max = Math.min(availableCredit, total);
  const [amount, setAmount] = useState(max.toFixed(2));

  useEffect(() => {
    if (open) setAmount(max.toFixed(2));
  }, [open, max]);

  const value = Math.max(0, Math.min(Number(amount) || 0, max));

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Crédito disponível na carteira
          </AlertDialogTitle>
          <AlertDialogDescription>
            Este cliente possui <strong>R$ {availableCredit.toFixed(2)}</strong> de
            crédito disponível na carteira. Deseja utilizar esse crédito nesta venda?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label className="text-xs">Quanto usar (máx. R$ {max.toFixed(2)})</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            max={max}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => setAmount(max.toFixed(2))}
            >
              Usar tudo (R$ {max.toFixed(2)})
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => setAmount((max / 2).toFixed(2))}
            >
              Usar metade
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Valor total da venda: <strong>R$ {total.toFixed(2)}</strong>
            <br />
            Restante a pagar: <strong>R$ {(total - value).toFixed(2)}</strong>
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDecline}>Não usar crédito</AlertDialogCancel>
          <AlertDialogAction
            disabled={value <= 0}
            onClick={() => onConfirm(value)}
          >
            Usar R$ {value.toFixed(2)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
