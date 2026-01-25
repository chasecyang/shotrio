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
    authors: [{ name: 'ShotRio Team' }],
    creator: 'ShotRio Team',
    publisher: 'ShotRio Team',
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: currentUrl,
      languages: getAlternateLanguages(path),
    },
    openGraph: {
      title,
      description,
      url: currentUrl,
      siteName: 'ShotRio',
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
      creator: '@ShotRio',
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
    title: 'ShotRio - Create Great Micro-Dramas with Full Control & AI',
    description: 'Powerful control × AI assistance — Master every detail of your micro-drama creation. Complete toolchain for creators who care about quality.',
    keywords: ['Micro-Drama Creation', 'AI Video Generation', 'Video Editing', 'Video Production Tool', 'Professional Video Creation', 'Short Drama', 'Content Creation'],
  },
  zh: {
    title: 'ShotRio - 用心创作好漫剧的专业工具',
    description: '强大的可控性 × AI智能辅助，掌控创作的每个细节。完整的创作工具链，为注重品质的创作者打造，精准把控每个环节。',
    keywords: ['微短剧创作', 'AI视频生成', '视频剪辑', '视频制作工具', '专业创作工具', '短剧制作', '内容创作'],
  },
};

/**
 * Login page metadata content
 */
export const loginMetadata = {
  en: {
    title: 'Login | ShotRio',
    description: 'Sign in to your ShotRio account',
  },
  zh: {
    title: '登录 | ShotRio',
    description: '登录您的 ShotRio 账户',
  },
};

/**
 * Privacy policy metadata content
 */
export const privacyMetadata = {
  en: {
    title: 'Privacy Policy | ShotRio',
    description: 'Learn how we protect your privacy and data.',
  },
  zh: {
    title: '隐私政策 | ShotRio',
    description: '了解我们如何保护您的隐私和数据。',
  },
};

/**
 * Terms of service metadata content
 */
export const termsMetadata = {
  en: {
    title: 'Terms of Service | ShotRio',
    description: 'Read our terms of service.',
  },
  zh: {
    title: '用户协议 | ShotRio',
    description: '阅读用户服务条款。',
  },
};

/**
 * Pricing page metadata content
 */
export const pricingMetadata = {
  en: {
    title: 'Pricing Plans | ShotRio',
    description: 'Choose the credit package that suits you and start your AI creation journey. AI image and video generation with flexible pricing.',
    keywords: ['Pricing', 'Credits', 'AI Generation', 'Video Creation', 'Image Generation', 'Subscription'],
  },
  zh: {
    title: '定价方案 | ShotRio',
    description: '选择适合您的积分包，开始 AI 创作之旅。AI 图片和视频生成，灵活定价方案。',
    keywords: ['定价', '积分', 'AI生成', '视频创作', '图片生成', '订阅'],
  },
};

/**
 * Credits page metadata content
 */
export const creditsMetadata = {
  en: {
    title: 'Credit Center | ShotRio',
    description: 'Purchase credits for AI image and video generation. Manage your credit balance and transaction history.',
    keywords: ['Credits', 'Purchase', 'Balance', 'Transaction History', 'AI Generation'],
  },
  zh: {
    title: '积分中心 | ShotRio',
    description: '购买积分用于 AI 图片和视频生成。管理您的积分余额和交易记录。',
    keywords: ['积分', '购买', '余额', '交易记录', 'AI生成'],
  },
};

/**
 * Changelog page metadata content
 */
export const changelogMetadata = {
  en: {
    title: 'Changelog | ShotRio',
    description: 'Track the latest updates and improvements to ShotRio. See what\'s new in our AI-powered micro-drama creation platform.',
    keywords: ['Changelog', 'Updates', 'Release Notes', 'What\'s New', 'Features'],
  },
  zh: {
    title: '更新日志 | ShotRio',
    description: '了解 ShotRio 的最新功能更新与改进。查看我们 AI 微短剧创作平台的最新动态。',
    keywords: ['更新日志', '更新', '发布说明', '最新动态', '新功能'],
  },
};
