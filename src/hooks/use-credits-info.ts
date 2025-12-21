import { useState, useEffect } from "react";
import { getCreditBalance } from "@/lib/actions/credits/balance";

/**
 * 获取积分信息的自定义 Hook
 */
export function useCreditsInfo() {
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const balanceResult = await getCreditBalance();
        if (balanceResult.success && balanceResult.balance) {
          setBalance(balanceResult.balance.balance);
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  return {
    balance,
    isLoading,
  };
}

