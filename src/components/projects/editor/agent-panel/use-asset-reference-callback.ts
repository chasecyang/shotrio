import { useCallback } from "react";
import { createAssetReference } from "@/lib/utils/asset-reference";
import type { AssetWithFullData } from "@/types/asset";

interface UseAssetReferenceCallbackOptions {
  /** 当前输入值 */
  value: string;
  /** 更新输入值的函数 */
  onChange: (value: string) => void;
  /** 可选：插入引用后要聚焦的元素引用 */
  focusRef?: React.RefObject<{ focus: () => void } | HTMLElement | null>;
}

/**
 * 创建一个处理素材引用插入的回调函数
 * 用于在输入框中插入素材引用 [[name|id]]
 */
export function useAssetReferenceCallback({
  value,
  onChange,
  focusRef,
}: UseAssetReferenceCallbackOptions) {
  return useCallback(
    (asset: AssetWithFullData) => {
      const reference = createAssetReference(asset.name, asset.id);
      // 在当前值后添加引用，如果已有内容则添加空格
      const newValue = value + (value ? " " : "") + reference + " ";
      onChange(newValue);

      // 如果提供了 focusRef，则在插入后聚焦
      if (focusRef?.current) {
        setTimeout(() => {
          if ("focus" in focusRef.current!) {
            focusRef.current.focus();
          }
        }, 0);
      }
    },
    [value, onChange, focusRef]
  );
}
