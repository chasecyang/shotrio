import { getTranslations } from "next-intl/server";
import { AudioDurationFixer } from "./audio-duration-fixer";
import { Wrench } from "lucide-react";

export default async function MaintenancePage() {
  const t = await getTranslations("admin.maintenance");

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500 to-orange-500/60 flex items-center justify-center">
            <Wrench className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("title")}</h1>
            <p className="text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        <AudioDurationFixer />
      </div>
    </div>
  );
}
