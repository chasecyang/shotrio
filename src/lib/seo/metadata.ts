import { Metadata } from 'next';

/**
 * 获取基础 URL（根据环境）
 */
export function getBaseUrl(): string {
  if (process.env.NODE_ENV === 'production') {
    return 'https://your-startup-domain.com';
  }
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

/**
 * 生成多语言链接
 */
export function getAlternateLanguages(path: string = '') {
  const baseUrl = getBaseUrl();
  return {
    'x-default': `${baseUrl}/zh${path}`,
    'zh': `${baseUrl}/zh${path}`,
    'zh-CN': `${baseUrl}/zh${path}`,
    'en': `${baseUrl}/en${path}`,
    'en-US': `${baseUrl}/en${path}`,
  };
}

/**
 * 页面 metadata 配置接口
 */
interface PageMetadataConfig {
  lang: string;
  title: string;
  description: string;
  path?: string;
  ogImage?: string;
  keywords?: string[];
  noIndex?: boolean;
}

/**
 * 生成完整的页面 metadata
 */
export function generatePageMetadata({
  lang,
  title,
  description,
  path = '',
  ogImage,
  keywords,
  noIndex = false,
}: PageMetadataConfig): Metadata {
  const baseUrl = getBaseUrl();
  const currentUrl = `${baseUrl}/${lang}${path}`;
  // Default OG image path
  const defaultOgImage = `${baseUrl}/og-image.png`;

  return {
    title,
    description,
    keywords: keywords?.join(', '),
    authors: [{ name: 'Startup Team' }],
    creator: 'Startup Team',
    publisher: 'Startup Team',
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: currentUrl,
      languages: getAlternateLanguages(path),
    },
    openGraph: {
      title,
      description,
      url: currentUrl,
      siteName: 'Startup Template',
      images: [
        {
          url: ogImage || defaultOgImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: lang === 'zh' ? 'zh_CN' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage || defaultOgImage],
      creator: '@StartupTeam',
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
          },
        },
  };
}

/**
 * 首页 metadata 内容（中英文）
 */
export const homepageMetadata = {
  zh: {
    title: 'Next.js Startup Template - 快速启动您的项目',
    description: '基于 Next.js, TailwindCSS, Shadcn UI 和 Drizzle ORM 的全栈开发模版，集成了认证、数据库和多语言支持。',
    keywords: ['Next.js Template', 'Startup Boilerplate', 'React', 'TailwindCSS'],
  },
  en: {
    title: 'Next.js Startup Template - Launch Your Project Faster',
    description: 'A full-stack starter kit with Next.js, TailwindCSS, Shadcn UI and Drizzle ORM. Includes Authentication, Database and i18n.',
    keywords: ['Next.js Template', 'Startup Boilerplate', 'React', 'TailwindCSS'],
  },
};

/**
 * 登录页 metadata 内容
 */
export const loginMetadata = {
  zh: {
    title: '登录 | Startup Template',
    description: '登录您的账户',
  },
  en: {
    title: 'Login | Startup Template',
    description: 'Login to your account',
  },
};

/**
 * 隐私政策 metadata 内容
 */
export const privacyMetadata = {
  zh: {
    title: '隐私政策 | Startup Template',
    description: '了解我们如何保护您的隐私。',
  },
  en: {
    title: 'Privacy Policy | Startup Template',
    description: 'Learn how we protect your privacy.',
  },
};

/**
 * 用户协议 metadata 内容
 */
export const termsMetadata = {
  zh: {
    title: '用户协议 | Startup Template',
    description: '阅读用户服务条款。',
  },
  en: {
    title: 'Terms of Service | Startup Template',
    description: 'Read our terms of service.',
  },
};
