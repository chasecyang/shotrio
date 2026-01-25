import { Suspense } from "react";
import { getAllRedeemCodes } from "@/lib/actions/admin/manage-codes";
import { CodeGenerator } from "@/components/admin/code-generator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { zhCN, enUS } from "date-fns/locale";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Role } from "@/lib/db/schemas/auth";
import { RedeemCodeActions } from "./code-actions-client";
import { getTranslations, getLocale } from "next-intl/server";
import { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.redeemCodes");
  return {
    title: t("title"),
    description: t("description"),
  };
}

async function CodesTable() {
  const result = await getAllRedeemCodes({ limit: 100 });
  const t = await getTranslations("admin.redeemCodes");
  const locale = await getLocale();
  const dateLocale = locale === "zh" ? zhCN : enUS;

  if (!result.success) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <p>{result.error || t("loadFailed")}</p>
        </CardContent>
      </Card>
    );
  }

  const codes = result.codes || [];

  if (codes.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <p>{t("empty")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.code")}</TableHead>
                <TableHead className="text-right">{t("table.credits")}</TableHead>
                <TableHead className="text-right">{t("table.usage")}</TableHead>
                <TableHead>{t("table.status")}</TableHead>
                <TableHead>{t("table.expires")}</TableHead>
                <TableHead>{t("table.description")}</TableHead>
                <TableHead className="text-right">{t("table.createdAt")}</TableHead>
                <TableHead className="text-right">{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.map((code) => {
                const isExpired = code.expiresAt && new Date() > code.expiresAt;
                const isFullyUsed = code.usedCount >= code.maxUses;
                const isActive = code.isActive && !isExpired && !isFullyUsed;

                return (
                  <TableRow key={code.id}>
                    <TableCell className="font-mono font-semibold">
                      {code.code}
                    </TableCell>
                    <TableCell className="text-right">
                      {code.credits.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          isFullyUsed ? "text-muted-foreground" : "text-primary"
                        }
                      >
                        {code.usedCount} / {code.maxUses}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={isActive ? "default" : "secondary"}
                      >
                        {isActive
                          ? t("status.active")
                          : isExpired
                          ? t("status.expired")
                          : isFullyUsed
                          ? t("status.used")
                          : t("status.disabled")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {code.expiresAt
                        ? format(new Date(code.expiresAt), "yyyy-MM-dd", {
                            locale: dateLocale,
                          })
                        : t("permanent")}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {code.description || "-"}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {format(new Date(code.createdAt), "yyyy-MM-dd HH:mm", {
                        locale: dateLocale,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <RedeemCodeActions
                        codeId={code.id}
                        isActive={code.isActive}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function RedeemCodesPage() {
  // 检查管理员权限
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user || session.user.role !== Role.ADMIN) {
    redirect("/");
  }

  const t = await getTranslations("admin.redeemCodes");

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("description")}
          </p>
        </div>
        <CodeGenerator />
      </div>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CodesTable />
      </Suspense>
    </div>
  );
}

