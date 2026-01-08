import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { TemplateViewer } from "./template-viewer";
import { getTemplateProjectDetail } from "@/lib/actions/project/clone";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TemplatePage({ params }: Props) {
  const { id } = await params;

  const result = await getTemplateProjectDetail(id);

  if (!result.success || !result.project) {
    notFound();
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <TemplateViewer project={result.project} />
      </main>
      <Footer />
    </div>
  );
}
