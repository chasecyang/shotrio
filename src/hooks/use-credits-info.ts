import { useState, useEffect, useCallback } from "react";
import { getCreditBalance } from "@/lib/actions/credits/balance";

/**
 * 获取积分信息的自定义 Hook
 * 支持 credits-changed 事件自动刷新余额
 */
export function useCreditsInfo() {
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBalance = useCallback(async () => {
    try {
      const balanceResult = await getCreditBalance();
      if (balanceResult.success && balanceResult.balance) {
        setBalance(balanceResult.balance.balance);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始获取余额
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // 监听 credits-changed 事件自动刷新
  useEffect(() => {
    const handleCreditsChanged = () => {
      fetchBalance();
    };

    window.addEventListener("credits-changed", handleCreditsChanged);
    return () => window.removeEventListener("credits-changed", handleCreditsChanged);
  }, [fetchBalance]);

  return {
    balance,
    isLoading,
    refresh: fetchBalance,
  };
}

