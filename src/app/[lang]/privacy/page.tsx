import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Metadata } from "next";
import { generatePageMetadata, privacyMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const metadata = privacyMetadata[lang as keyof typeof privacyMetadata] || privacyMetadata.zh;
  
  return generatePageMetadata({
    lang,
    title: metadata.title,
    description: metadata.description,
    path: '/privacy',
  });
}

export default function PrivacyPage() {
  const t = useTranslations("legal.privacy");

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">

        <Card className="rounded-3xl border-neutral-200">
          <CardHeader className="space-y-2">
            <CardTitle className="text-3xl font-bold text-neutral-900">
              {t("title")}
            </CardTitle>
            <p className="text-sm text-neutral-600">
              {t("lastUpdated")}
            </p>
          </CardHeader>
          <CardContent className="prose prose-neutral max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-neutral-900 mb-3">
                {t("section1.title")}
              </h2>
              <p className="text-neutral-700 leading-relaxed">
                {t("section1.content")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neutral-900 mb-3">
                {t("section2.title")}
              </h2>
              <ul className="list-disc list-inside space-y-2 text-neutral-700">
                <li>{t("section2.item1")}</li>
                <li>{t("section2.item2")}</li>
                <li>{t("section2.item3")}</li>
                <li>{t("section2.item4")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neutral-900 mb-3">
                {t("section3.title")}
              </h2>
              <p className="text-neutral-700 leading-relaxed mb-3">
                {t("section3.content")}
              </p>
              <ul className="list-disc list-inside space-y-2 text-neutral-700">
                <li>{t("section3.item1")}</li>
                <li>{t("section3.item2")}</li>
                <li>{t("section3.item3")}</li>
                <li>{t("section3.item4")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neutral-900 mb-3">
                {t("section4.title")}
              </h2>
              <p className="text-neutral-700 leading-relaxed">
                {t("section4.content")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neutral-900 mb-3">
                {t("section5.title")}
              </h2>
              <p className="text-neutral-700 leading-relaxed">
                {t("section5.content")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neutral-900 mb-3">
                {t("section6.title")}
              </h2>
              <p className="text-neutral-700 leading-relaxed">
                {t("section6.content")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neutral-900 mb-3">
                {t("section7.title")}
              </h2>
              <p className="text-neutral-700 leading-relaxed">
                {t("section7.content")}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-neutral-900 mb-3">
                {t("section8.title")}
              </h2>
              <p className="text-neutral-700 leading-relaxed">
                {t("section8.content")}
              </p>
            </section>
          </CardContent>
        </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
}
