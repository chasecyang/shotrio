import { Suspense } from "react";
import { getAllArtStyles } from "@/lib/actions/admin/art-style-admin";
import { Skeleton } from "@/components/ui/skeleton";
import { StyleTable } from "@/components/admin/art-styles/style-table";
import { Palette } from "lucide-react";

export default async function ArtStylesAdminPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Palette className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">美术风格管理</h1>
          </div>
        </div>
        <p className="text-muted-foreground">
          管理系统预设风格，为每个风格生成预览图
        </p>
      </div>

      {/* Content */}
      <Suspense fallback={<StyleTableSkeleton />}>
        <StyleTableWrapper />
      </Suspense>
    </div>
  );
}

async function StyleTableWrapper() {
  const styles = await getAllArtStyles();
  
  return <StyleTable styles={styles} />;
}

function StyleTableSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

