import { Metadata } from "next";
import { generatePageMetadata, loginMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const metadata = loginMetadata[lang as keyof typeof loginMetadata] || loginMetadata.zh;
  
  return generatePageMetadata({
    lang,
    title: metadata.title,
    description: metadata.description,
    path: '/login',
  });
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

