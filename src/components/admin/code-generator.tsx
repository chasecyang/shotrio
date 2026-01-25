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
import { useTranslations } from "next-intl";

export function CodeGenerator() {
  const tToast = useTranslations("toasts");
  const t = useTranslations("admin.redeemCodes.generator");
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
      toast.error(tToast("error.enterValidCredits"));
      return;
    }

    if (isNaN(maxUses) || maxUses <= 0) {
      toast.error(tToast("error.enterValidMaxUses"));
      return;
    }

    setLoading(true);
    try {
      if (isBatch) {
        const count = parseInt(formData.count);
        if (isNaN(count) || count <= 0 || count > 1000) {
          toast.error(tToast("error.enterValidMaxUses"));
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
          toast.success(t("batchSuccess", { count: result.codes.length }));
          router.refresh();
        } else {
          toast.error(result.error || tToast("error.codeGenerationFailed"));
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
          toast.success(tToast("success.codeGenerated"));
          router.refresh();
        } else {
          toast.error(result.error || tToast("error.codeGenerationFailed"));
        }
      }
    } catch (error) {
      toast.error(tToast("error.codeGenerationFailed"));
      console.error("[CodeGenerator] Generate failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    const text = generatedCodes.join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(tToast("success.codeCopied"));
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
          {t("generate")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("subtitle")}
          </DialogDescription>
        </DialogHeader>

        {generatedCodes.length > 0 ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("generated")}</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      {t("copied")}
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      {t("copyAll")}
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
                {t("done")}
              </Button>
              <Button
                variant="outline"
                onClick={() => setGeneratedCodes([])}
                className="flex-1"
              >
                {t("continueGenerate")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="batch">{t("batchMode")}</Label>
              <Switch
                id="batch"
                checked={isBatch}
                onCheckedChange={setIsBatch}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="credits">{t("credits")}</Label>
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
                <Label htmlFor="maxUses">{t("maxUses")}</Label>
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
                <Label htmlFor="count">{t("count")}</Label>
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
                <Label htmlFor="customCode">{t("customCode")}</Label>
                <Input
                  id="customCode"
                  placeholder={t("customCodeHint")}
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
              <Label htmlFor="expiresInDays">{t("expiresInDays")}</Label>
              <Input
                id="expiresInDays"
                type="number"
                placeholder={t("expiresInDaysHint")}
                value={formData.expiresInDays}
                onChange={(e) =>
                  setFormData({ ...formData, expiresInDays: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("description")}</Label>
              <Textarea
                id="description"
                placeholder={t("descriptionPlaceholder")}
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
                  {t("generating")}
                </>
              ) : (
                t("generate")
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

