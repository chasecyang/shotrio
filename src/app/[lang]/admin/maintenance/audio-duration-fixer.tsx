"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  AudioLines,
  Search,
  Wrench,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import {
  findAudioWithoutDuration,
  fixAudioDurations,
} from "@/lib/actions/admin/fix-audio-duration";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function AudioDurationFixer() {
  const t = useTranslations("admin.maintenance");
  const [isScanning, setIsScanning] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [scanResult, setScanResult] = useState<{
    fixableCount: number;
    unfixableCount: number;
  } | null>(null);
  const [fixResult, setFixResult] = useState<{
    fixed: number;
    failed: number;
    total: number;
  } | null>(null);

  const handleScan = async () => {
    setIsScanning(true);
    setScanResult(null);
    setFixResult(null);

    try {
      const result = await findAudioWithoutDuration();
      if (result.success) {
        setScanResult({
          fixableCount: result.fixableCount,
          unfixableCount: result.unfixableCount,
        });
        if (result.fixableCount === 0 && result.unfixableCount === 0) {
          toast.success(t("audioDuration.noIssuesFound"));
        } else if (result.fixableCount > 0) {
          toast.info(
            t("audioDuration.issuesFound", { count: result.fixableCount })
          );
        } else {
          toast.warning(t("audioDuration.onlyUnfixable"));
        }
      } else {
        toast.error(result.error || t("audioDuration.scanFailed"));
      }
    } catch {
      toast.error(t("audioDuration.scanFailed"));
    } finally {
      setIsScanning(false);
    }
  };

  const handleFix = async () => {
    if (!scanResult || scanResult.fixableCount === 0) {
      toast.warning(t("audioDuration.nothingToFix"));
      return;
    }

    setIsFixing(true);
    setFixResult(null);

    try {
      const result = await fixAudioDurations();
      if (result.success) {
        setFixResult({
          fixed: result.fixed,
          failed: result.failed,
          total: result.total,
        });
        // 清除扫描结果，因为已经修复了
        setScanResult(null);
        if (result.fixed > 0) {
          toast.success(
            t("audioDuration.fixSuccess", { count: result.fixed })
          );
        }
        if (result.failed > 0) {
          toast.warning(
            t("audioDuration.fixPartial", { failed: result.failed })
          );
        }
        if (result.fixed === 0 && result.failed === 0) {
          toast.info(t("audioDuration.nothingToFix"));
        }
      } else {
        toast.error(result.error || t("audioDuration.fixFailed"));
      }
    } catch {
      toast.error(t("audioDuration.fixFailed"));
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-500/60 flex items-center justify-center">
            <AudioLines className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle>{t("audioDuration.title")}</CardTitle>
            <CardDescription>{t("audioDuration.description")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("audioDuration.detail")}
        </p>

        {/* Scan Result */}
        {scanResult && (
          <div className="p-4 rounded-lg bg-muted/50 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {scanResult.fixableCount > 0 && (
                <Badge variant="destructive">
                  {scanResult.fixableCount} {t("audioDuration.fixable")}
                </Badge>
              )}
              {scanResult.unfixableCount > 0 && (
                <Badge variant="secondary">
                  {scanResult.unfixableCount} {t("audioDuration.unfixable")}
                </Badge>
              )}
              {scanResult.fixableCount === 0 &&
                scanResult.unfixableCount === 0 && (
                  <Badge variant="default">
                    {t("audioDuration.noIssuesFound")}
                  </Badge>
                )}
            </div>
            {scanResult.fixableCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {t("audioDuration.clickFixToRepair")}
              </p>
            )}
            {scanResult.unfixableCount > 0 && (
              <p className="text-sm text-amber-600 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                {t("audioDuration.unfixableHint")}
              </p>
            )}
          </div>
        )}

        {/* Fix Result */}
        {fixResult && (
          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-center gap-4">
              {fixResult.fixed > 0 && (
                <div className="flex items-center gap-1.5 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {fixResult.fixed} {t("audioDuration.fixed")}
                  </span>
                </div>
              )}
              {fixResult.failed > 0 && (
                <div className="flex items-center gap-1.5 text-red-600">
                  <XCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {fixResult.failed} {t("audioDuration.failed")}
                  </span>
                </div>
              )}
              {fixResult.fixed === 0 && fixResult.failed === 0 && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">
                    {t("audioDuration.nothingToFix")}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleScan}
            disabled={isScanning || isFixing}
          >
            {isScanning ? (
              <Spinner className="w-4 h-4 mr-2" />
            ) : (
              <Search className="w-4 h-4 mr-2" />
            )}
            {t("audioDuration.scan")}
          </Button>

          <Button
            onClick={handleFix}
            disabled={
              isScanning || isFixing || !scanResult || scanResult.fixableCount === 0
            }
          >
            {isFixing ? (
              <Spinner className="w-4 h-4 mr-2" />
            ) : (
              <Wrench className="w-4 h-4 mr-2" />
            )}
            {t("audioDuration.fix")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
