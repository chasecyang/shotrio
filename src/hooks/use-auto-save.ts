import { useState, useRef, useEffect } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface UseAutoSaveOptions<T> {
  data: T;
  originalData: T;
  onSave: (data: T) => Promise<{ success: boolean; error?: string }>;
  onSaveSuccess?: () => void;
  delay?: number;
  savedDisplayTime?: number;
}

export function useAutoSave<T>({
  data,
  originalData,
  onSave,
  onSaveSuccess,
  delay = 1500,
  savedDisplayTime = 3000,
}: UseAutoSaveOptions<T>) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const savedTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const hasChanges = JSON.stringify(data) !== JSON.stringify(originalData);

    if (hasChanges) {
      setSaveStatus("idle");

      saveTimeoutRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        try {
          const result = await onSave(data);

          if (result.success) {
            setSaveStatus("saved");
            onSaveSuccess?.();

            if (savedTimeoutRef.current) {
              clearTimeout(savedTimeoutRef.current);
            }
            savedTimeoutRef.current = setTimeout(() => {
              setSaveStatus("idle");
            }, savedDisplayTime);
          } else {
            setSaveStatus("error");
          }
        } catch (error) {
          setSaveStatus("error");
          console.error("Auto save error:", error);
        }
      }, delay);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [data, originalData, onSave, delay, savedDisplayTime]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
    };
  }, []);

  return { saveStatus };
}

