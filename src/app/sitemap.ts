import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://shotrio.com';
  const lastModified = new Date();
  
  return [
    // 首页（最高优先级）- 中文
    {
      url: `${baseUrl}/zh`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1.0,
      alternates: {
        languages: {
          'zh': `${baseUrl}/zh`,
          'zh-CN': `${baseUrl}/zh`,
          'en': `${baseUrl}/en`,
          'en-US': `${baseUrl}/en`,
          'x-default': `${baseUrl}/zh`,
        },
      },
    },
    // 首页 - 英文
    {
      url: `${baseUrl}/en`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1.0,
      alternates: {
        languages: {
          'zh': `${baseUrl}/zh`,
          'zh-CN': `${baseUrl}/zh`,
          'en': `${baseUrl}/en`,
          'en-US': `${baseUrl}/en`,
          'x-default': `${baseUrl}/zh`,
        },
      },
    },
    
    // 登录页 - 中文
    {
      url: `${baseUrl}/zh/login`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
      alternates: {
        languages: {
          'zh': `${baseUrl}/zh/login`,
          'zh-CN': `${baseUrl}/zh/login`,
          'en': `${baseUrl}/en/login`,
          'en-US': `${baseUrl}/en/login`,
        },
      },
    },
    // 登录页 - 英文
    {
      url: `${baseUrl}/en/login`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
      alternates: {
        languages: {
          'zh': `${baseUrl}/zh/login`,
          'zh-CN': `${baseUrl}/zh/login`,
          'en': `${baseUrl}/en/login`,
          'en-US': `${baseUrl}/en/login`,
        },
      },
    },
    
    // 隐私政策 - 中文
    {
      url: `${baseUrl}/zh/privacy`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.3,
      alternates: {
        languages: {
          'zh': `${baseUrl}/zh/privacy`,
          'zh-CN': `${baseUrl}/zh/privacy`,
          'en': `${baseUrl}/en/privacy`,
          'en-US': `${baseUrl}/en/privacy`,
        },
      },
    },
    // 隐私政策 - 英文
    {
      url: `${baseUrl}/en/privacy`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.3,
      alternates: {
        languages: {
          'zh': `${baseUrl}/zh/privacy`,
          'zh-CN': `${baseUrl}/zh/privacy`,
          'en': `${baseUrl}/en/privacy`,
          'en-US': `${baseUrl}/en/privacy`,
        },
      },
    },
    
    // 用户协议 - 中文
    {
      url: `${baseUrl}/zh/terms`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.3,
      alternates: {
        languages: {
          'zh': `${baseUrl}/zh/terms`,
          'zh-CN': `${baseUrl}/zh/terms`,
          'en': `${baseUrl}/en/terms`,
          'en-US': `${baseUrl}/en/terms`,
        },
      },
    },
    // 用户协议 - 英文
    {
      url: `${baseUrl}/en/terms`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.3,
      alternates: {
        languages: {
          'zh': `${baseUrl}/zh/terms`,
          'zh-CN': `${baseUrl}/zh/terms`,
          'en': `${baseUrl}/en/terms`,
          'en-US': `${baseUrl}/en/terms`,
        },
      },
    },
    
    // 定价页 - 中文
    {
      url: `${baseUrl}/zh/pricing`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
      alternates: {
        languages: {
          'zh': `${baseUrl}/zh/pricing`,
          'zh-CN': `${baseUrl}/zh/pricing`,
          'en': `${baseUrl}/en/pricing`,
          'en-US': `${baseUrl}/en/pricing`,
        },
      },
    },
    // 定价页 - 英文
    {
      url: `${baseUrl}/en/pricing`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
      alternates: {
        languages: {
          'zh': `${baseUrl}/zh/pricing`,
          'zh-CN': `${baseUrl}/zh/pricing`,
          'en': `${baseUrl}/en/pricing`,
          'en-US': `${baseUrl}/en/pricing`,
        },
      },
    },
  ];
}

