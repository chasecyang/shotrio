import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/routing";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion-wrapper";
import { 
  ArrowRight, 
  Sparkles, 
  FileText, 
  Users, 
  Image as ImageIcon, 
  Video, 
  Scissors,
  Layout,
  Clapperboard
} from "lucide-react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

export default async function Home() {
  const t = await getTranslations("home");

  const features = [
    {
      icon: FileText,
      titleKey: "features.script.title",
      descriptionKey: "features.script.description",
      badgeKey: "features.script.badge",
      available: true,
    },
    {
      icon: Layout,
      titleKey: "features.storyboard.title",
      descriptionKey: "features.storyboard.description",
      badgeKey: "features.storyboard.badge",
      available: false,
    },
    {
      icon: Users,
      titleKey: "features.character.title",
      descriptionKey: "features.character.description",
      badgeKey: "features.character.badge",
      available: false,
    },
    {
      icon: ImageIcon,
      titleKey: "features.scene.title",
      descriptionKey: "features.scene.description",
      badgeKey: "features.scene.badge",
      available: false,
    },
    {
      icon: Video,
      titleKey: "features.ai.title",
      descriptionKey: "features.ai.description",
      badgeKey: "features.ai.badge",
      available: false,
    },
    {
      icon: Scissors,
      titleKey: "features.edit.title",
      descriptionKey: "features.edit.description",
      badgeKey: "features.edit.badge",
      available: false,
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
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-24 md:py-32 overflow-hidden">
          {/* Background Elements */}
          <div className="absolute inset-0 bg-noise opacity-[0.03] z-10 pointer-events-none"></div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-primary/10 blur-[120px] rounded-full pointer-events-none"></div>
          
          <div className="container px-4 mx-auto relative z-20">
            <div className="max-w-5xl mx-auto text-center">
              <FadeIn delay={0}>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-medium">
                  <Sparkles className="w-4 h-4" />
                  <span className="tracking-wide uppercase text-xs font-bold">{t("subtitle")}</span>
                </div>
              </FadeIn>
              
              <FadeIn delay={0.1}>
                <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold font-heading tracking-tight mb-8 leading-[1.1]">
                  {t("hero.title")}
                  <br />
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
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <Link href="/login">
                    <Button size="lg" className="h-14 px-8 text-lg rounded-full shadow-[0_0_20px_-5px_var(--color-primary)] hover:shadow-[0_0_30px_-5px_var(--color-primary)] transition-shadow duration-500">
                      {t("getStarted")}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Button variant="outline" size="lg" className="h-14 px-8 text-lg rounded-full border-primary/20 hover:bg-primary/5">
                    <Clapperboard className="mr-2 h-5 w-5" />
                    Watch Demo
                  </Button>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

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
                      className="group relative p-8 rounded-3xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-500 hover:border-primary/20 backdrop-blur-sm h-full"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl" />
                      
                      <div className="relative z-10">
                        <div className="flex items-start justify-between mb-6">
                          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-500">
                            <Icon className="w-6 h-6" />
                          </div>
                          <Badge variant={feature.available ? "default" : "secondary"} className="text-xs font-mono tracking-wider bg-white/5 hover:bg-white/10 text-muted-foreground border-transparent">
                            {t(feature.badgeKey)}
                          </Badge>
                        </div>
                        
                        <h3 className="text-xl font-bold font-heading mb-3 group-hover:text-primary transition-colors duration-300">
                          {t(feature.titleKey)}
                        </h3>
                        <p className="text-muted-foreground leading-relaxed group-hover:text-foreground/80 transition-colors">
                          {t(feature.descriptionKey)}
                        </p>
                      </div>
                    </div>
                  </StaggerItem>
                );
              })}
            </StaggerContainer>
          </div>
        </section>

        {/* Workflow Section */}
        <section className="py-24 md:py-32 bg-secondary/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />
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
                        <div className="w-16 h-16 rounded-full bg-background border border-primary/20 text-primary flex items-center justify-center text-xl font-bold font-heading mb-6 relative z-10 group-hover:scale-110 group-hover:border-primary transition-all duration-300 shadow-[0_0_0_8px_var(--color-background)]">
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
          <div className="absolute -top-[200px] -right-[200px] w-[600px] h-[600px] bg-primary/20 blur-[150px] rounded-full pointer-events-none"></div>
          <div className="absolute -bottom-[200px] -left-[200px] w-[600px] h-[600px] bg-secondary/40 blur-[150px] rounded-full pointer-events-none"></div>

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
                <Link href="/login">
                  <Button size="lg" className="h-16 px-12 text-lg rounded-full font-bold shadow-2xl shadow-primary/20 hover:scale-105 transition-transform duration-300">
                    {t("cta.button")}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </FadeIn>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
}
