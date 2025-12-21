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

interface RedeemDialogProps {
  onSuccess?: () => void;
}

export function RedeemDialog({ onSuccess }: RedeemDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRedeem = async () => {
    if (!code.trim()) {
      toast.error("请输入兑换码");
      return;
    }

    setLoading(true);
    try {
      const result = await useRedeemCode(code.trim());
      
      if (result.success && result.credits) {
        toast.success(`兑换成功！获得 ${result.credits} 积分`);
        setCode("");
        setOpen(false);
        // 使用 Next.js router 刷新数据
        if (onSuccess) {
          onSuccess();
        } else {
          router.refresh();
        }
      } else {
        toast.error(result.error || "兑换失败");
      }
    } catch (error) {
      toast.error("兑换失败，请稍后重试");
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
          兑换码
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>使用兑换码</DialogTitle>
          <DialogDescription>
            输入兑换码以获取积分奖励
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="code">兑换码</Label>
            <Input
              id="code"
              placeholder="请输入兑换码"
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
                兑换中...
              </>
            ) : (
              "立即兑换"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

