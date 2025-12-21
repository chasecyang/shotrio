"use client";

import { useState } from "react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Wallet, Plus } from "lucide-react";
import { PurchaseDialog } from "./purchase-dialog";
import { useCreditsInfo } from "@/hooks/use-credits-info";

export function HeaderCreditsButton() {
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
          className="rounded-none border-r gap-2 h-9 px-3 hover:bg-accent"
        >
          <Link href="/credits">
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline font-medium">
              {balance.toLocaleString()}
            </span>
            <span className="sm:hidden font-medium">{balance}</span>
          </Link>
        </Button>

        {/* Add credits button */}
        <Button
          variant="ghost"
          size="sm"
          className="rounded-none h-9 px-2 hover:bg-accent hover:text-primary"
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

