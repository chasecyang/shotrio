"use client";

import { useState } from "react";
import { PackageCard } from "@/components/credits/package-card";
import { createCheckoutSession } from "@/lib/actions/payment/checkout";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { CreditPackage } from "@/types/payment";

interface CreditsPurchaseClientProps {
  package: CreditPackage;
}

export function CreditsPurchaseClient({
  package: pkg,
}: CreditsPurchaseClientProps) {
  const [loading, setLoading] = useState(false);
  const t = useTranslations("credits");

  const handlePurchase = async () => {
    setLoading(true);
    try {
      const result = await createCheckoutSession({
        packageType: pkg.type,
      });

      if (result.success && result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        toast.error(result.error || t("errors.checkoutFailed"));
        setLoading(false);
      }
    } catch (error) {
      toast.error(t("errors.checkoutFailed"));
      console.error("Failed to create checkout session:", error);
      setLoading(false);
    }
  };

  return (
    <PackageCard
      package={pkg}
      onSelect={handlePurchase}
      loading={loading}
    />
  );
}

