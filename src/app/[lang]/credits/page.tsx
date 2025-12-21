import { Suspense } from "react";
import { getCreditBalance } from "@/lib/actions/credits/balance";
import { getCreditTransactions } from "@/lib/actions/credits/transactions";
import { getUserOrders } from "@/lib/actions/payment/checkout";
import { BalanceCard } from "@/components/credits/balance-card";
import { TransactionList } from "@/components/credits/transaction-list";
import { RedeemDialog } from "@/components/credits/redeem-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion-wrapper";
import { Badge } from "@/components/ui/badge";
import { Coins, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { CREDIT_PACKAGES } from "@/types/payment";
import { CreditsPurchaseClient } from "./purchase-client";
import { getTranslations } from "next-intl/server";

export const metadata = {
  title: "积分中心",
  description: "购买积分、查看余额和交易记录",
};

async function BalanceSection() {
  const t = await getTranslations("credits");
  const result = await getCreditBalance();

  if (!result.success || !result.balance) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <p>{result.error || t("errors.loadBalanceFailed")}</p>
        </CardContent>
      </Card>
    );
  }

  return <BalanceCard balance={result.balance} />;
}

async function TransactionsSection() {
  const t = await getTranslations("credits");
  const result = await getCreditTransactions({ limit: 20 });

  if (!result.success) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <p>{result.error || t("errors.loadTransactionsFailed")}</p>
        </CardContent>
      </Card>
    );
  }

  return <TransactionList transactions={result.transactions || []} />;
}

async function OrdersSection() {
  const t = await getTranslations("credits");
  const result = await getUserOrders({ limit: 20 });

  if (!result.success) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <p>{result.error || t("errors.loadOrdersFailed")}</p>
        </CardContent>
      </Card>
    );
  }

  const orders = result.orders || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("orders.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>{t("orders.empty")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="space-y-1">
                  <p className="font-semibold">
                    {CREDIT_PACKAGES.find((p) => p.type === order.packageType)?.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ${order.amount} • {order.credits + order.bonusCredits} {t("creditsUnit")}
                    {order.bonusCredits > 0 && ` • +${order.bonusCredits} ${t("packages.bonusCredits")}`}
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <div
                    className={`text-sm font-medium ${
                      order.status === "completed"
                        ? "text-green-600"
                        : order.status === "failed"
                        ? "text-red-600"
                        : "text-yellow-600"
                    }`}
                  >
                    {t(`orders.status.${order.status}`)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function CreditsPage() {
  const t = await getTranslations("credits");
  
  // Check user login status
  const balanceResult = await getCreditBalance();
  if (!balanceResult.success && balanceResult.error === "未登录") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-16 md:py-24 overflow-hidden">
          <div className="container px-4 mx-auto relative z-10">
            <div className="max-w-4xl mx-auto">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12">
                <div className="flex-1">
                  <FadeIn>
                    <Badge className="mb-4 px-4 py-1.5 text-sm font-mono">
                      <Coins className="w-4 h-4 mr-2" />
                      {t("title")}
                    </Badge>
                  </FadeIn>
                  
                  <FadeIn delay={0.1}>
                    <h1 className="text-4xl md:text-5xl font-bold font-heading tracking-tight mb-4">
                      {t("balance.title")}
                    </h1>
                  </FadeIn>
                  
                  <FadeIn delay={0.2}>
                    <p className="text-lg text-muted-foreground">
                      {t("description")}
                    </p>
                  </FadeIn>
                </div>

                <FadeIn delay={0.3}>
                  <RedeemDialog />
                </FadeIn>
              </div>

              {/* Balance card */}
              <FadeIn delay={0.4}>
                <Suspense fallback={<Skeleton className="h-48 w-full rounded-2xl" />}>
                  <BalanceSection />
                </Suspense>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* Credit packages section */}
        <section className="py-16 md:py-24 relative">
          <div className="container px-4 mx-auto relative z-10">
            <div className="max-w-7xl mx-auto">
              <FadeIn>
                <div className="text-center mb-12">
                  <h2 className="text-3xl md:text-4xl font-bold font-heading mb-4">
                    {t("packages.title")}
                  </h2>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500/10 to-purple-500/10 border border-yellow-500/20 text-foreground">
                    <Sparkles className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm font-medium">{t("packages.bonusHint")}</span>
                  </div>
                </div>
              </FadeIn>

              <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {CREDIT_PACKAGES.map((pkg) => (
                  <StaggerItem key={pkg.type}>
                    <CreditsPurchaseClient package={pkg} />
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </div>
          </div>
        </section>

        {/* Transactions and Orders section */}
        <section className="py-16 md:py-24 bg-secondary/30 relative">
          <div className="container px-4 mx-auto relative z-10">
            <div className="max-w-7xl mx-auto">
              <FadeIn>
                <h2 className="text-3xl md:text-4xl font-bold font-heading mb-8 text-center">
                  {t("transactions.title")}
                </h2>
              </FadeIn>

              <FadeIn delay={0.1}>
                <Tabs defaultValue="transactions" className="space-y-6">
                  <TabsList className="w-full max-w-md mx-auto grid grid-cols-2">
                    <TabsTrigger value="transactions">{t("transactions.title")}</TabsTrigger>
                    <TabsTrigger value="orders">{t("orders.title")}</TabsTrigger>
                  </TabsList>

                  <TabsContent value="transactions">
                    <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
                      <TransactionsSection />
                    </Suspense>
                  </TabsContent>

                  <TabsContent value="orders">
                    <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
                      <OrdersSection />
                    </Suspense>
                  </TabsContent>
                </Tabs>
              </FadeIn>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

