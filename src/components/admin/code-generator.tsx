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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2, Copy, Check } from "lucide-react";
import { generateRedeemCode, batchGenerateRedeemCodes } from "@/lib/actions/admin/manage-codes";
import { toast } from "sonner";

export function CodeGenerator() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isBatch, setIsBatch] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    credits: "100",
    maxUses: "1",
    count: "10",
    description: "",
    customCode: "",
    expiresInDays: "",
  });

  const handleGenerate = async () => {
    const credits = parseInt(formData.credits);
    const maxUses = parseInt(formData.maxUses);

    if (isNaN(credits) || credits <= 0) {
      toast.error("请输入有效的积分数量");
      return;
    }

    if (isNaN(maxUses) || maxUses <= 0) {
      toast.error("请输入有效的使用次数");
      return;
    }

    setLoading(true);
    try {
      if (isBatch) {
        const count = parseInt(formData.count);
        if (isNaN(count) || count <= 0 || count > 1000) {
          toast.error("批量生成数量必须在1-1000之间");
          setLoading(false);
          return;
        }

        const result = await batchGenerateRedeemCodes({
          count,
          credits,
          maxUses,
          description: formData.description || undefined,
          expiresAt: formData.expiresInDays
            ? new Date(Date.now() + parseInt(formData.expiresInDays) * 24 * 60 * 60 * 1000)
            : undefined,
        });

        if (result.success && result.codes) {
          setGeneratedCodes(result.codes);
          toast.success(`成功生成 ${result.codes.length} 个兑换码`);
          router.refresh();
        } else {
          toast.error(result.error || "生成失败");
        }
      } else {
        const result = await generateRedeemCode({
          credits,
          maxUses,
          description: formData.description || undefined,
          customCode: formData.customCode || undefined,
          expiresAt: formData.expiresInDays
            ? new Date(Date.now() + parseInt(formData.expiresInDays) * 24 * 60 * 60 * 1000)
            : undefined,
        });

        if (result.success && result.code) {
          setGeneratedCodes([result.code]);
          toast.success("兑换码生成成功");
          router.refresh();
        } else {
          toast.error(result.error || "生成失败");
        }
      }
    } catch (error) {
      toast.error("生成失败，请稍后重试");
      console.error("生成兑换码失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    const text = generatedCodes.join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("已复制到剪贴板");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setOpen(false);
    setGeneratedCodes([]);
    setFormData({
      credits: "100",
      maxUses: "1",
      count: "10",
      description: "",
      customCode: "",
      expiresInDays: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          生成兑换码
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>生成兑换码</DialogTitle>
          <DialogDescription>
            创建新的积分兑换码
          </DialogDescription>
        </DialogHeader>

        {generatedCodes.length > 0 ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>生成的兑换码</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      复制全部
                    </>
                  )}
                </Button>
              </div>
              <Textarea
                value={generatedCodes.join("\n")}
                readOnly
                rows={Math.min(generatedCodes.length, 10)}
                className="font-mono text-sm"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleClose} className="flex-1">
                完成
              </Button>
              <Button
                variant="outline"
                onClick={() => setGeneratedCodes([])}
                className="flex-1"
              >
                继续生成
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="batch">批量生成</Label>
              <Switch
                id="batch"
                checked={isBatch}
                onCheckedChange={setIsBatch}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="credits">积分数量 *</Label>
                <Input
                  id="credits"
                  type="number"
                  placeholder="100"
                  value={formData.credits}
                  onChange={(e) =>
                    setFormData({ ...formData, credits: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxUses">最大使用次数 *</Label>
                <Input
                  id="maxUses"
                  type="number"
                  placeholder="1"
                  value={formData.maxUses}
                  onChange={(e) =>
                    setFormData({ ...formData, maxUses: e.target.value })
                  }
                />
              </div>
            </div>

            {isBatch && (
              <div className="space-y-2">
                <Label htmlFor="count">生成数量 (1-1000)</Label>
                <Input
                  id="count"
                  type="number"
                  placeholder="10"
                  value={formData.count}
                  onChange={(e) =>
                    setFormData({ ...formData, count: e.target.value })
                  }
                />
              </div>
            )}

            {!isBatch && (
              <div className="space-y-2">
                <Label htmlFor="customCode">自定义兑换码（可选）</Label>
                <Input
                  id="customCode"
                  placeholder="留空自动生成"
                  value={formData.customCode}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      customCode: e.target.value.toUpperCase(),
                    })
                  }
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="expiresInDays">有效期（天数，可选）</Label>
              <Input
                id="expiresInDays"
                type="number"
                placeholder="留空为永久有效"
                value={formData.expiresInDays}
                onChange={(e) =>
                  setFormData({ ...formData, expiresInDays: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">备注（可选）</Label>
              <Textarea
                id="description"
                placeholder="添加备注信息..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                "生成兑换码"
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

