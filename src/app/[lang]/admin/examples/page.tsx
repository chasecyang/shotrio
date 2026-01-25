import { getTranslations } from "next-intl/server";
import { ExampleAssetManager } from "./example-asset-manager";
import { getAllExampleAssets, getAdminAssets } from "@/lib/actions/admin/example-admin";

export default async function ExamplesAdminPage() {
  const t = await getTranslations("admin.examples");

  const [examplesResult, assetsResult] = await Promise.all([
    getAllExampleAssets(),
    getAdminAssets({ limit: 100 }),
  ]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-foreground">{t("title")}</h1>
        <p className="text-lg text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Example Asset Manager */}
      <ExampleAssetManager
        examples={examplesResult.examples || []}
        assets={assetsResult.assets || []}
      />
    </div>
  );
}
