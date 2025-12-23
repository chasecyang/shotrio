import { Suspense } from "react";
import { getAllArtStyles } from "@/lib/actions/admin/art-style-admin";
import { Skeleton } from "@/components/ui/skeleton";
import { StyleTable } from "@/components/admin/art-styles/style-table";
import { Palette } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function ArtStylesAdminPage() {
  const t = await getTranslations("admin.artStyles");
  
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Palette className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("pageTitle")}</h1>
          </div>
        </div>
        <p className="text-muted-foreground">
          {t("description")}
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

