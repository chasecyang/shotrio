import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Image, Video, Check } from "lucide-react";
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

export const metadata = {
  title: "定价方案 - Shotrio",
  description: "选择适合您的积分包，开始AI创作之旅",
};

export default async function PricingPage() {
  const t = await getTranslations();

  const faqs = [
    {
      id: "q1",
      question: t("pricing.faq.q1.question"),
      answer: t("pricing.faq.q1.answer"),
    },
    {
      id: "q2",
      question: t("pricing.faq.q2.question"),
      answer: t("pricing.faq.q2.answer"),
    },
    {
      id: "q3",
      question: t("pricing.faq.q3.question"),
      answer: t("pricing.faq.q3.answer"),
    },
    {
      id: "q4",
      question: t("pricing.faq.q4.question"),
      answer: t("pricing.faq.q4.answer"),
    },
    {
      id: "q5",
      question: t("pricing.faq.q5.question"),
      answer: t("pricing.faq.q5.answer"),
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-24 overflow-hidden">
          <div className="container px-4 mx-auto relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              <FadeIn>
                <Badge className="mb-6 px-4 py-1.5 text-sm font-mono">
                  <Sparkles className="w-4 h-4 mr-2" />
                  {t("pricing.title")}
                </Badge>
              </FadeIn>

              <FadeIn delay={0.1}>
                <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
                  {t("pricing.subtitle")}
                </h1>
              </FadeIn>

              <FadeIn delay={0.2}>
                <p className="text-xl text-muted-foreground mb-8">
                  {t("credits.description")}
                </p>
              </FadeIn>

              {/* Cost info badges */}
              <FadeIn delay={0.3}>
                <div className="flex flex-wrap justify-center gap-4 mb-12">
                  <Badge variant="outline" className="px-4 py-2 text-sm font-normal gap-2">
                    <Image className="w-4 h-4" />
                    {t("credits.costs.imageGeneration", { credits: 8 })}
                  </Badge>
                  <Badge variant="outline" className="px-4 py-2 text-sm font-normal gap-2">
                    <Video className="w-4 h-4" />
                    {t("credits.costs.videoGeneration", { credits: 20 })}
                  </Badge>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="py-12 relative">
          <div className="container px-4 mx-auto">
            <PricingClientWrapper />
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 bg-secondary/30 relative">
          <div className="container px-4 mx-auto relative z-10">
            <div className="max-w-5xl mx-auto">
              <FadeIn>
                <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
                  {t("pricing.features.title")}
                </h2>
              </FadeIn>

              <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <StaggerItem>
                  <Card>
                    <CardHeader>
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                        <Image className="w-6 h-6 text-primary" />
                      </div>
                      <CardTitle>{t("pricing.features.imageGeneration.title")}</CardTitle>
                      <CardDescription>
                        {t("pricing.features.imageGeneration.description")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-primary" />
                        <span>{t("pricing.features.imageGeneration.feature1")}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-primary" />
                        <span>{t("pricing.features.imageGeneration.feature2")}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-primary" />
                        <span>{t("pricing.features.imageGeneration.feature3")}</span>
                      </div>
                    </CardContent>
                  </Card>
                </StaggerItem>

                <StaggerItem>
                  <Card>
                    <CardHeader>
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                        <Video className="w-6 h-6 text-primary" />
                      </div>
                      <CardTitle>{t("pricing.features.videoGeneration.title")}</CardTitle>
                      <CardDescription>
                        {t("pricing.features.videoGeneration.description")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-primary" />
                        <span>{t("pricing.features.videoGeneration.feature1")}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-primary" />
                        <span>{t("pricing.features.videoGeneration.feature2")}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-primary" />
                        <span>{t("pricing.features.videoGeneration.feature3")}</span>
                      </div>
                    </CardContent>
                  </Card>
                </StaggerItem>
              </StaggerContainer>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-24">
          <div className="container px-4 mx-auto">
            <div className="max-w-3xl mx-auto">
              <FadeIn>
                <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
                  {t("pricing.faq.title")}
                </h2>
              </FadeIn>

              <FadeIn delay={0.1}>
                <Accordion type="single" collapsible className="space-y-4">
                  {faqs.map((faq, index) => (
                    <AccordionItem
                      key={faq.id}
                      value={faq.id}
                      className="border rounded-lg px-6 bg-card"
                    >
                      <AccordionTrigger className="text-left hover:no-underline">
                        <span className="font-semibold">{faq.question}</span>
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
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

