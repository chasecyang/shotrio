import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion-wrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Metadata } from "next";
import { generatePageMetadata, changelogMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const metadata = changelogMetadata[lang as keyof typeof changelogMetadata] || changelogMetadata.zh;

  return generatePageMetadata({
    lang,
    title: metadata.title,
    description: metadata.description,
    keywords: metadata.keywords,
    path: '/changelog',
  });
}

interface ChangelogEntry {
  date: string;
  items: string[];
}

export default async function ChangelogPage() {
  const t = await getTranslations("changelog");

  const changelog: ChangelogEntry[] = [
    {
      date: "2026-01-21",
      items: [
        t("entries.0121.item1"),
        t("entries.0121.item2"),
        t("entries.0121.item3"),
        t("entries.0121.item4"),
        t("entries.0121.item5"),
        t("entries.0121.item6"),
        t("entries.0121.item7"),
      ],
    },
    {
      date: "2026-01-09",
      items: [t("entries.0109.item1")],
    },
    {
      date: "2026-01-08",
      items: [
        t("entries.0108.item1"),
        t("entries.0108.item2"),
        t("entries.0108.item3"),
        t("entries.0108.item4"),
      ],
    },
    {
      date: "2026-01-07",
      items: [
        t("entries.0107.item1"),
        t("entries.0107.item2"),
        t("entries.0107.item3"),
      ],
    },
    {
      date: "2026-01-06",
      items: [
        t("entries.0106.item1"),
        t("entries.0106.item2"),
        t("entries.0106.item3"),
      ],
    },
    {
      date: "2026-01-05",
      items: [
        t("entries.0105.item1"),
        t("entries.0105.item2"),
        t("entries.0105.item3"),
      ],
    },
    {
      date: "2026-01-04",
      items: [
        t("entries.0104.item1"),
        t("entries.0104.item2"),
        t("entries.0104.item3"),
      ],
    },
    {
      date: "2026-01-03",
      items: [
        t("entries.0103.item1"),
        t("entries.0103.item2"),
        t("entries.0103.item3"),
      ],
    },
    {
      date: "2026-01-01",
      items: [
        t("entries.0101.item1"),
        t("entries.0101.item2"),
        t("entries.0101.item3"),
      ],
    },
    {
      date: "2025-12-31",
      items: [
        t("entries.1231.item1"),
        t("entries.1231.item2"),
      ],
    },
    {
      date: "2025-12-29",
      items: [
        t("entries.1229.item1"),
      ],
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
                  {t("badge")}
                </Badge>
              </FadeIn>

              <FadeIn delay={0.1}>
                <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
                  {t("title")}
                </h1>
              </FadeIn>

              <FadeIn delay={0.2}>
                <p className="text-xl text-muted-foreground">
                  {t("description")}
                </p>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* Changelog List */}
        <section className="py-12 pb-24">
          <div className="container px-4 mx-auto">
            <div className="max-w-3xl mx-auto">
              <StaggerContainer className="space-y-8">
                {changelog.map((entry) => (
                  <StaggerItem key={entry.date}>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-3">
                          <Badge variant="outline" className="font-mono text-sm">
                            {entry.date}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {entry.items.map((item, itemIndex) => (
                            <li
                              key={itemIndex}
                              className="flex items-start gap-2 text-muted-foreground"
                            >
                              <span className="text-primary mt-1.5 text-xs">●</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
