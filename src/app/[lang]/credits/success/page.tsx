import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Payment Successful | 支付成功",
    description: "Your payment has been completed successfully",
  };
}

export default async function PaymentSuccessPage() {
  const t = await getTranslations("credits.success");

  return (
    <div className="container mx-auto py-16 max-w-2xl">
      <Card className="text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <CardTitle className="text-3xl">{t("paymentSuccessTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            {t("paymentSuccessDescription")}
          </p>

          <div className="flex gap-4 justify-center">
            <Button asChild>
              <Link href="/credits">{t("viewBalance")}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/projects">{t("startCreating")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

