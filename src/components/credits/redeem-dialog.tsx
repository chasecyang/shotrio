"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Ticket, Loader2 } from "lucide-react";
import { useRedeemCode } from "@/lib/actions/redeem/use-code";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface RedeemDialogProps {
  onSuccess?: () => void;
}

export function RedeemDialog({ onSuccess }: RedeemDialogProps) {
  const t = useTranslations("credits.redeem");
  const tToast = useTranslations("toasts");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRedeem = async () => {
    if (!code.trim()) {
      toast.error(t("errors.empty"));
      return;
    }

    setLoading(true);
    try {
      // 调用 server action (不是 React Hook，是 server action 函数)
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const result = await useRedeemCode(code.trim());
      
      if (result.success && result.credits) {
        toast.success(t("success", { credits: result.credits }));
        setCode("");
        setOpen(false);
        // 使用 Next.js router 刷新数据
        if (onSuccess) {
          onSuccess();
        } else {
          router.refresh();
        }
      } else {
        toast.error(result.error || t("errors.invalid"));
      }
    } catch (error) {
      toast.error(t("errors.invalid"));
      console.error("兑换失败:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Ticket className="h-4 w-4" />
          {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("dialogDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="code">{t("title")}</Label>
            <Input
              id="code"
              placeholder={t("placeholder")}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleRedeem();
                }
              }}
              disabled={loading}
            />
          </div>

          <Button
            onClick={handleRedeem}
            disabled={loading || !code.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("submitting")}
              </>
            ) : (
              t("submit")
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

