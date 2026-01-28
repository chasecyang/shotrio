import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Image as ImageIcon, Video, Check, Music, Zap } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PricingClientWrapper } from "./pricing-client";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion-wrapper";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Metadata } from "next";
import { generatePageMetadata, pricingMetadata } from "@/lib/seo/metadata";
import { CREDIT_COSTS } from "@/types/payment";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const metadata = pricingMetadata[lang as keyof typeof pricingMetadata] || pricingMetadata.zh;

  return generatePageMetadata({
    lang,
    title: metadata.title,
    description: metadata.description,
    keywords: metadata.keywords,
    path: '/pricing',
  });
}

export default async function PricingPage() {
  const t = await getTranslations();

  const faqs = [
    { id: "q1", question: t("pricing.faq.q1.question"), answer: t("pricing.faq.q1.answer") },
    { id: "q2", question: t("pricing.faq.q2.question"), answer: t("pricing.faq.q2.answer") },
    { id: "q3", question: t("pricing.faq.q3.question"), answer: t("pricing.faq.q3.answer") },
    { id: "q4", question: t("pricing.faq.q4.question"), answer: t("pricing.faq.q4.answer") },
    { id: "q5", question: t("pricing.faq.q5.question"), answer: t("pricing.faq.q5.answer") },
  ];

  const costItems = [
    { icon: ImageIcon, key: "imageGeneration", credits: CREDIT_COSTS.IMAGE_GENERATION },
    { icon: Video, key: "videoGeneration", credits: CREDIT_COSTS.VIDEO_GENERATION_PER_SECOND },
    { icon: Music, key: "soundEffect", credits: CREDIT_COSTS.SOUND_EFFECT_GENERATION },
    { icon: Music, key: "musicGeneration", credits: CREDIT_COSTS.MUSIC_GENERATION },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-12 md:py-16 overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          </div>
          <div className="container px-4 mx-auto relative z-10">
            <div className="max-w-4xl mx-auto text-center">
              <FadeIn>
                <Badge className="mb-6 px-4 py-1.5 text-sm font-medium bg-primary/10 text-primary border-primary/20 hover:bg-primary/15">
                  <Zap className="w-3.5 h-3.5 mr-1.5" />
                  {t("pricing.title")}
                </Badge>
              </FadeIn>
              <FadeIn delay={0.1}>
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6">
                  {t("pricing.subtitle")}
                </h1>
              </FadeIn>
              <FadeIn delay={0.2}>
                <p className="text-lg md:text-xl text-muted-foreground mb-6 max-w-2xl mx-auto leading-relaxed">
                  {t("credits.description")}
                </p>
              </FadeIn>
              <FadeIn delay={0.3}>
                <div className="flex flex-wrap justify-center gap-3">
                  {costItems.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-card border border-border/50 shadow-sm hover:border-primary/30 transition-colors"
                    >
                      <item.icon className="w-4 h-4 text-primary" aria-hidden="true" />
                      <span className="text-sm font-medium">
                        {t(`credits.costs.${item.key}`, { credits: item.credits })}
                      </span>
                    </div>
                  ))}
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="py-8 md:py-12 relative">
          <div className="container px-4 mx-auto max-w-7xl">
            <PricingClientWrapper />
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 md:py-28 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-secondary/30 via-secondary/50 to-secondary/30" />
          <div className="container px-4 mx-auto relative z-10">
            <div className="max-w-5xl mx-auto">
              <FadeIn>
                <div className="text-center mb-14">
                  <Badge className="mb-4 px-3 py-1 text-xs font-medium bg-primary/10 text-primary border-primary/20">
                    <Sparkles className="w-3 h-3 mr-1" />
                    {t("pricing.features.title")}
                  </Badge>
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                    {t("pricing.features.title")}
                  </h2>
                </div>
              </FadeIn>
              <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StaggerItem>
                  <Card className="h-full border-border/50 bg-card/80 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
                    <CardHeader className="pb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4 ring-1 ring-primary/10">
                        <ImageIcon className="w-6 h-6 text-primary" aria-hidden="true" />
                      </div>
                      <CardTitle className="text-lg">{t("pricing.features.imageGeneration.title")}</CardTitle>
                      <CardDescription className="text-sm leading-relaxed">
                        {t("pricing.features.imageGeneration.description")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-2.5 text-sm">
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 text-primary" />
                          </div>
                          <span className="text-muted-foreground">{t(`pricing.features.imageGeneration.feature${i}`)}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </StaggerItem>
                <StaggerItem>
                  <Card className="h-full border-border/50 bg-card/80 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
                    <CardHeader className="pb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4 ring-1 ring-primary/10">
                        <Video className="w-6 h-6 text-primary" />
                      </div>
                      <CardTitle className="text-lg">{t("pricing.features.videoGeneration.title")}</CardTitle>
                      <CardDescription className="text-sm leading-relaxed">
                        {t("pricing.features.videoGeneration.description")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-2.5 text-sm">
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 text-primary" />
                          </div>
                          <span className="text-muted-foreground">{t(`pricing.features.videoGeneration.feature${i}`)}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </StaggerItem>
                <StaggerItem>
                  <Card className="h-full border-border/50 bg-card/80 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
                    <CardHeader className="pb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4 ring-1 ring-primary/10">
                        <Music className="w-6 h-6 text-primary" />
                      </div>
                      <CardTitle className="text-lg">{t("pricing.features.audioGeneration.title")}</CardTitle>
                      <CardDescription className="text-sm leading-relaxed">
                        {t("pricing.features.audioGeneration.description")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-2.5 text-sm">
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 text-primary" />
                          </div>
                          <span className="text-muted-foreground">{t(`pricing.features.audioGeneration.feature${i}`)}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </StaggerItem>
              </StaggerContainer>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20 md:py-28">
          <div className="container px-4 mx-auto">
            <div className="max-w-3xl mx-auto">
              <FadeIn>
                <div className="text-center mb-12">
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                    {t("pricing.faq.title")}
                  </h2>
                </div>
              </FadeIn>
              <FadeIn delay={0.1}>
                <Accordion type="single" collapsible className="space-y-3">
                  {faqs.map((faq) => (
                    <AccordionItem
                      key={faq.id}
                      value={faq.id}
                      className="border border-border/50 rounded-xl px-6 bg-card/50 backdrop-blur-sm data-[state=open]:border-primary/30 transition-colors"
                    >
                      <AccordionTrigger className="text-left hover:no-underline py-5">
                        <span className="font-semibold text-[15px]">{faq.question}</span>
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </FadeIn>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
