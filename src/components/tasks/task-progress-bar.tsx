"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface TaskProgressBarProps {
  progress: number;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  currentStep?: number;
  totalSteps?: number | null;
  className?: string;
  showPercentage?: boolean;
}

export function TaskProgressBar({
  progress,
  status,
  currentStep,
  totalSteps,
  className,
  showPercentage = true,
}: TaskProgressBarProps) {
  const getProgressColor = () => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "failed":
        return "bg-red-500";
      case "cancelled":
        return "bg-gray-400";
      case "processing":
        return "bg-primary";
      default:
        return "bg-muted-foreground";
    }
  };

  const getProgressText = () => {
    if (totalSteps && currentStep !== undefined) {
      return `${currentStep}/${totalSteps}`;
    }
    if (showPercentage) {
      return `${progress}%`;
    }
    return null;
  };

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="capitalize">{status}</span>
        {getProgressText() && <span>{getProgressText()}</span>}
      </div>
      <Progress 
        value={progress} 
        className="h-2" 
        indicatorClassName={getProgressColor()}
      />
    </div>
  );
}

