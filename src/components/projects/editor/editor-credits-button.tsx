"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wallet, Plus } from "lucide-react";
import { PurchaseDialog } from "@/components/credits/purchase-dialog";
import { useCreditsInfo } from "@/hooks/use-credits-info";

export function EditorCreditsButton() {
  const { balance } = useCreditsInfo();
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);

  if (balance === null) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-1">
        {/* Balance display */}
        <div className="flex items-center gap-1.5 px-2 py-1 text-sm text-muted-foreground">
          <Wallet className="h-3.5 w-3.5" />
          <span className="font-medium tabular-nums">{balance.toLocaleString()}</span>
        </div>

        {/* Add credits button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:text-primary"
          onClick={() => setPurchaseDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <PurchaseDialog
        open={purchaseDialogOpen}
        onOpenChange={setPurchaseDialogOpen}
      />
    </>
  );
}

