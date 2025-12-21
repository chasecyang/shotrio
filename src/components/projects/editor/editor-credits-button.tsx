"use client";

import { useState } from "react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Sparkles, Plus } from "lucide-react";
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
      <div className="flex items-center gap-0 border rounded-md overflow-hidden">
        {/* Balance display - clickable to go to credits page */}
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="rounded-none border-r gap-2 h-8 px-3 hover:bg-accent"
        >
          <Link href="/credits">
            <Sparkles className="h-4 w-4" />
            <span className="font-medium tabular-nums">
              {balance.toLocaleString()}
            </span>
          </Link>
        </Button>

        {/* Add credits button */}
        <Button
          variant="ghost"
          size="sm"
          className="rounded-none h-8 px-2 hover:bg-accent hover:text-primary"
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

