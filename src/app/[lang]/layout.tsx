import type { Metadata } from "next";
import { Syne, Manrope, Noto_Sans_SC } from "next/font/google";
import "../globals.css";
import { Toaster } from "@/components/ui/sonner";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { ChatwootProvider } from '@/components/integrations/chatwoot-provider';
import { getCurrentUser } from '@/lib/auth/auth-utils';
import { generatePageMetadata, homepageMetadata } from '@/lib/seo/metadata';

// 英文字体
const syne = Syne({
  variable: "--font-heading-en",
  subsets: ["latin"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-sans-en",
  subsets: ["latin"],
  display: "swap",
});

// 中文字体 - 使用思源黑体（统一使用无衬线字体，更适合屏幕阅读）
const notoSansSC = Noto_Sans_SC({
  variable: "--font-zh",
  weight: ["300", "400", "500", "700", "900"],
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const metadata = homepageMetadata[lang as keyof typeof homepageMetadata] || homepageMetadata.zh;
  
  return generatePageMetadata({
    lang,
    title: metadata.title,
    description: metadata.description,
    keywords: metadata.keywords,
    path: '',
  });
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ lang: locale }));
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}>) {
  const { lang } = await params;
  
  // 验证语言是否有效
  if (!routing.locales.includes(lang as typeof routing.locales[number])) {
    notFound();
  }

  // 获取翻译消息
  const messages = await getMessages();
  
  // 获取当前用户信息（用于 Chatwoot）
  const user = await getCurrentUser();
  
  return (
    <html lang={lang} suppressHydrationWarning>
      <body
        className={`${syne.variable} ${manrope.variable} ${notoSansSC.variable} font-sans antialiased bg-background text-foreground selection:bg-primary/30 selection:text-primary`}
      >
        <NextIntlClientProvider messages={messages}>
          {children}
          <Toaster />
          <ChatwootProvider user={user} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
