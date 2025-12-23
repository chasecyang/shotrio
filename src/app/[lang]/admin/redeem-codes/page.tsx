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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Role } from "@/lib/db/schemas/auth";
import { RedeemCodeActions } from "./code-actions-client";

export const metadata = {
  title: "兑换码管理 - 管理后台",
  description: "管理积分兑换码",
};

async function CodesTable() {
  const result = await getAllRedeemCodes({ limit: 100 });

  if (!result.success) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <p>{result.error || "无法加载兑换码"}</p>
        </CardContent>
      </Card>
    );
  }

  const codes = result.codes || [];

  if (codes.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <p>暂无兑换码</p>
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
                <TableHead>兑换码</TableHead>
                <TableHead className="text-right">积分</TableHead>
                <TableHead className="text-right">使用情况</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>有效期</TableHead>
                <TableHead>备注</TableHead>
                <TableHead className="text-right">创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
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
                          ? "可用"
                          : isExpired
                          ? "已过期"
                          : isFullyUsed
                          ? "已用完"
                          : "已禁用"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {code.expiresAt
                        ? format(new Date(code.expiresAt), "yyyy-MM-dd", {
                            locale: zhCN,
                          })
                        : "永久"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {code.description || "-"}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {format(new Date(code.createdAt), "yyyy-MM-dd HH:mm", {
                        locale: zhCN,
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

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">兑换码管理</h1>
          <p className="text-muted-foreground mt-2">
            创建和管理积分兑换码
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

