"use client";

import { useState } from "react";
import { PricingCard } from "@/components/credits/pricing-card";
import { CREDIT_PACKAGES } from "@/types/payment";
import type { CreditPackage, PackageType } from "@/types/payment";
import { createCheckoutSession } from "@/lib/actions/payment/checkout";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function PricingClientWrapper() {
  const t = useTranslations("credits");
  const [loadingPackage, setLoadingPackage] = useState<PackageType | null>(null);

  const handlePurchase = async (pkg: CreditPackage) => {
    setLoadingPackage(pkg.type);
    try {
      const result = await createCheckoutSession({
        packageType: pkg.type,
      });

      if (result.success && result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        toast.error(result.error || t("errors.checkoutFailed"));
        setLoadingPackage(null);
      }
    } catch (error) {
      toast.error(t("errors.checkoutFailed"));
      console.error("Checkout session creation failed:", error);
      setLoadingPackage(null);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
      {CREDIT_PACKAGES.map((pkg, index) => (
        <PricingCard
          key={pkg.type}
          pkg={pkg}
          index={index}
          isLoading={loadingPackage === pkg.type}
          disabled={loadingPackage !== null && loadingPackage !== pkg.type}
          onPurchase={handlePurchase}
          variant="page"
        />
      ))}
    </div>
  );
}
