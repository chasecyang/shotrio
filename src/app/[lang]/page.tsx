import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { BetaBanner } from "@/components/ui/beta-banner";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion-wrapper";
import { HeroQuickStart } from "@/components/home/hero-quick-start";
import { HomeLoginButton } from "@/components/home/login-button";
import { TemplateGallery } from "@/components/home/template-gallery";
import { ExampleWaterfall } from "@/components/home/example-waterfall";
import { getCurrentUser } from "@/lib/auth/auth-utils";
import { getPublicTemplates } from "@/lib/actions/project/template";
import { getPublicExampleAssets } from "@/lib/actions/example/public";
import {
  Sparkles,
  FileText,
  Layout,
  FolderOpen,
  Bot,
  Music,
  Subtitles
} from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function Home() {
  const t = await getTranslations("home");
  const user = await getCurrentUser();
  const templates = await getPublicTemplates({ limit: 6 });

  // 获取示例资产
  const exampleAssets = await getPublicExampleAssets({ limit: 12 });

  const features = [
    {
      icon: FileText,
      titleKey: "features.script.title",
      descriptionKey: "features.script.description",
      badgeKey: "features.script.badge",
      badgeVariant: "default" as const,
    },
    {
      icon: FolderOpen,
      titleKey: "features.assetManagement.title",
      descriptionKey: "features.assetManagement.description",
      badgeKey: "features.assetManagement.badge",
      badgeVariant: "default" as const,
    },
    {
      icon: Layout,
      titleKey: "features.videoGeneration.title",
      descriptionKey: "features.videoGeneration.description",
      badgeKey: "features.videoGeneration.badge",
      badgeVariant: "default" as const,
    },
    {
      icon: Bot,
      titleKey: "features.agent.title",
      descriptionKey: "features.agent.description",
      badgeKey: "features.agent.badge",
      badgeVariant: "outline" as const,
    },
    {
      icon: Music,
      titleKey: "features.voiceMusic.title",
      descriptionKey: "features.voiceMusic.description",
      badgeKey: "features.voiceMusic.badge",
      badgeVariant: "secondary" as const,
    },
    {
      icon: Subtitles,
      titleKey: "features.subtitleFeature.title",
      descriptionKey: "features.subtitleFeature.description",
      badgeKey: "features.subtitleFeature.badge",
      badgeVariant: "secondary" as const,
    },
  ];

  const workflow = [
    {
      step: "01",
      titleKey: "workflow.step1.title",
      descriptionKey: "workflow.step1.description",
    },
    {
      step: "02",
      titleKey: "workflow.step2.title",
      descriptionKey: "workflow.step2.description",
    },
    {
      step: "03",
      titleKey: "workflow.step3.title",
      descriptionKey: "workflow.step3.description",
    },
    {
      step: "04",
      titleKey: "workflow.step4.title",
      descriptionKey: "workflow.step4.description",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans selection:bg-primary/20">
      <Header />
      
      {/* Beta Notice Banner - 可关闭 */}
      <BetaBanner dismissible storageKey="home-beta-banner-dismissed" />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-12 md:py-20 overflow-hidden">
          {/* Background Elements */}
          <div className="absolute inset-0 bg-noise opacity-[0.03] z-10 pointer-events-none"></div>
          
          <div className="container px-4 mx-auto relative z-20">
            <div className="max-w-5xl mx-auto text-center">
              <FadeIn delay={0}>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-4 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-medium">
                  <Sparkles className="w-4 h-4" />
                  <span className="tracking-wide uppercase text-xs font-bold">{t("subtitle")}</span>
                </div>
              </FadeIn>
              
              <FadeIn delay={0.1}>
                <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold font-heading tracking-tight mb-8 leading-[1.1]">
                  {t("hero.title")}{" "}
                  <span className="text-primary italic">
                    {t("hero.titleHighlight")}
                  </span>
                </h1>
              </FadeIn>
              
              <FadeIn delay={0.2}>
                <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
                  {t("hero.subtitle")}
                </p>
              </FadeIn>
              
              <FadeIn delay={0.3}>
                <HeroQuickStart isAuthenticated={!!user} />
              </FadeIn>
            </div>
          </div>
        </section>

        {/* Example Assets Waterfall - 示例资产展示 */}
        {exampleAssets.examples.length > 0 && (
          <ExampleWaterfall
            initialExamples={exampleAssets.examples}
            total={exampleAssets.total}
          />
        )}

        {/* Template Gallery - 示例项目展示 */}
        {templates.length > 0 && <TemplateGallery templates={templates} />}

        {/* Features Grid */}
        <section className="py-24 md:py-32 relative">
          <div className="container px-4 mx-auto">
            <div className="text-center mb-16 md:mb-24">
              <FadeIn>
                <h2 className="text-3xl md:text-5xl font-bold font-heading mb-6">
                  {t("features.title")}
                </h2>
              </FadeIn>
              <FadeIn delay={0.1}>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                  {t("features.subtitle")}
                </p>
              </FadeIn>
            </div>
            
            <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                
                return (
                  <StaggerItem key={index}>
                    <div 
                      className="group relative p-8 rounded-3xl border hover:border-primary/30 transition-all duration-300 h-full"
                    >
                      <div className="flex items-start justify-between mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                          <Icon className="w-6 h-6" />
                        </div>
                        <Badge variant={feature.badgeVariant} className="text-xs font-mono tracking-wider">
                          {t(feature.badgeKey)}
                        </Badge>
                      </div>
                      
                      <h3 className="text-xl font-bold font-heading mb-3">
                        {t(feature.titleKey)}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {t(feature.descriptionKey)}
                      </p>
                    </div>
                  </StaggerItem>
                );
              })}
            </StaggerContainer>
          </div>
        </section>

        {/* Workflow Section */}
        <section className="py-24 md:py-32 bg-secondary/30 relative overflow-hidden">
          <div className="container px-4 mx-auto relative z-10">
            <div className="text-center mb-20">
              <FadeIn>
                <h2 className="text-3xl md:text-5xl font-bold font-heading mb-6">
                  {t("workflow.title")}
                </h2>
              </FadeIn>
            </div>
            
            <div className="max-w-6xl mx-auto">
              <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 relative">
                {/* Connecting Line (Desktop) */}
                <div className="hidden lg:block absolute top-8 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                
                {workflow.map((step, index) => (
                  <StaggerItem key={index}>
                    <div className="relative group">
                      <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-full bg-background border border-primary/20 text-primary flex items-center justify-center text-xl font-bold font-heading mb-6 relative z-10 transition-all duration-300">
                          {step.step}
                        </div>
                        <h3 className="text-xl font-bold mb-3 font-heading">
                          {t(step.titleKey)}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed px-4">
                          {t(step.descriptionKey)}
                        </p>
                      </div>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32 relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/5"></div>

          <div className="container px-4 mx-auto relative z-10">
            <div className="max-w-4xl mx-auto text-center">
              <FadeIn>
                <h2 className="text-4xl md:text-6xl font-bold font-heading mb-8">
                  {t("cta.title")}
                </h2>
              </FadeIn>
              <FadeIn delay={0.1}>
                <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
                  {t("cta.description")}
                </p>
              </FadeIn>
              <FadeIn delay={0.2}>
                <HomeLoginButton variant="cta" />
              </FadeIn>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
}
