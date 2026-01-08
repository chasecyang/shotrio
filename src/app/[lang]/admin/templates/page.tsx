import { getTranslations } from "next-intl/server";
import { TemplateManager } from "./template-manager";
import { getAllTemplateProjects, getAdminProjects } from "@/lib/actions/admin/template-admin";

export default async function TemplatesAdminPage() {
  const t = await getTranslations("admin.templates");

  const [templatesResult, projectsResult] = await Promise.all([
    getAllTemplateProjects(),
    getAdminProjects(),
  ]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-foreground">{t("title")}</h1>
        <p className="text-lg text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Template Manager */}
      <TemplateManager
        templates={templatesResult.templates || []}
        projects={projectsResult.projects || []}
      />
    </div>
  );
}
