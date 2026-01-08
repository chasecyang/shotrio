import { Link } from "@/i18n/routing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Palette, ArrowRight, Sparkles, FileVideo } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function AdminPage() {
  const t = await getTranslations("admin");
  
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-foreground">
          {t("title")}
        </h1>
        <p className="text-lg text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {/* Quick Access Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Palette className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-xl">{t("dashboard.artStyles.title")}</CardTitle>
                <CardDescription>{t("dashboard.artStyles.description")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {t("dashboard.artStyles.detail")}
            </p>
            <Button asChild className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <Link href="/admin/art-styles" className="flex items-center justify-center gap-2">
                {t("dashboard.artStyles.action")}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* 示例模板管理卡片 */}
        <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500 to-amber-500/60 flex items-center justify-center">
                <FileVideo className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">{t("templates.title")}</CardTitle>
                <CardDescription>{t("templates.description")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {t("templates.detail")}
            </p>
            <Button asChild className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <Link href="/admin/templates" className="flex items-center justify-center gap-2">
                {t("dashboard.artStyles.action")}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* 预留未来功能卡片 */}
        <Card className="opacity-60 cursor-not-allowed">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-xl">{t("dashboard.moreFeatures.title")}</CardTitle>
                <CardDescription>{t("dashboard.moreFeatures.description")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {t("dashboard.moreFeatures.detail")}
            </p>
            <Button disabled className="w-full">
              {t("dashboard.moreFeatures.action")}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Info Section */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-foreground">{t("dashboard.hint.title")}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("dashboard.hint.description")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
