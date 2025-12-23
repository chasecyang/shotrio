import { Metadata } from 'next';

/**
 * Get base URL (based on environment)
 */
export function getBaseUrl(): string {
  if (process.env.NODE_ENV === 'production') {
    return 'https://shotrio.com';
  }
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

/**
 * Generate multilingual links
 */
export function getAlternateLanguages(path: string = '') {
  const baseUrl = getBaseUrl();
  return {
    'x-default': `${baseUrl}/en${path}`,
    'en': `${baseUrl}/en${path}`,
    'en-US': `${baseUrl}/en${path}`,
    'zh': `${baseUrl}/zh${path}`,
    'zh-CN': `${baseUrl}/zh${path}`,
  };
}

/**
 * Page metadata configuration interface
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
 * Generate complete page metadata
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
    authors: [{ name: 'Shotrio Team' }],
    creator: 'Shotrio Team',
    publisher: 'Shotrio Team',
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: currentUrl,
      languages: getAlternateLanguages(path),
    },
    openGraph: {
      title,
      description,
      url: currentUrl,
      siteName: 'Shotrio',
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
      creator: '@Shotrio',
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
 * Homepage metadata content (English and Chinese)
 */
export const homepageMetadata = {
  en: {
    title: 'Shotrio - Professional Micro-Drama Creation Tool',
    description: 'From script to final cut, an all-in-one micro-drama creation platform. AI-assisted creation to help content creators efficiently produce high-quality micro-drama works.',
    keywords: ['Micro-Drama', 'AI Video Generation', 'Short Drama', 'Video Creation', 'Storyboard', 'Script Writing'],
  },
  zh: {
    title: 'Shotrio - 专业的微短剧创作工具',
    description: '从剧本到成片，一站式微短剧创作平台。AI 辅助创作，助力内容创作者高效产出优质微短剧作品。',
    keywords: ['微短剧', 'AI视频生成', '短剧创作', '视频制作', '分镜设计', '剧本创作'],
  },
};

/**
 * Login page metadata content
 */
export const loginMetadata = {
  en: {
    title: 'Login | Shotrio',
    description: 'Sign in to your Shotrio account',
  },
  zh: {
    title: '登录 | Shotrio',
    description: '登录您的 Shotrio 账户',
  },
};

/**
 * Privacy policy metadata content
 */
export const privacyMetadata = {
  en: {
    title: 'Privacy Policy | Shotrio',
    description: 'Learn how we protect your privacy and data.',
  },
  zh: {
    title: '隐私政策 | Shotrio',
    description: '了解我们如何保护您的隐私和数据。',
  },
};

/**
 * Terms of service metadata content
 */
export const termsMetadata = {
  en: {
    title: 'Terms of Service | Shotrio',
    description: 'Read our terms of service.',
  },
  zh: {
    title: '用户协议 | Shotrio',
    description: '阅读用户服务条款。',
  },
};
