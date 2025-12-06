import { getBaseUrl } from './metadata';

/**
 * WebSite Schema - 网站基本信息
 */
export function generateWebSiteSchema(lang: string) {
  const baseUrl = getBaseUrl();
  
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Cineqo',
    url: baseUrl,
    description: lang === 'zh' 
      ? '在解决问题中学会语言' 
      : 'Learn languages through solving challenges',
    inLanguage: ['zh-CN', 'en-US'],
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Organization Schema - 组织信息
 */
export function generateOrganizationSchema() {
  const baseUrl = getBaseUrl();
  
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Cineqo',
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    description: 'Innovative language learning through scenario challenges',
    sameAs: [
      // 可以添加社交媒体链接
      // 'https://twitter.com/Cineqo',
      // 'https://www.facebook.com/Cineqo',
    ],
  };
}

/**
 * WebApplication Schema - Web 应用信息
 */
export function generateWebApplicationSchema(lang: string) {
  const baseUrl = getBaseUrl();
  
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Cineqo',
    url: baseUrl,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    description: lang === 'zh'
      ? '通过趣味场景挑战学习语言的创新应用'
      : 'Learn languages through fun scenario challenges',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '100',
      bestRating: '5',
      worstRating: '1',
    },
  };
}

/**
 * BreadcrumbList Schema - 面包屑导航
 */
export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  const baseUrl = getBaseUrl();
  
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${baseUrl}${item.url}`,
    })),
  };
}

/**
 * 生成首页的完整结构化数据
 */
export function generateHomepageStructuredData(lang: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      generateWebSiteSchema(lang),
      generateOrganizationSchema(),
      generateWebApplicationSchema(lang),
    ],
  };
}

/**
 * 将结构化数据转换为 JSON-LD script 标签的内容
 */
export function structuredDataToScript(data: object): string {
  return JSON.stringify(data, null, 2);
}

