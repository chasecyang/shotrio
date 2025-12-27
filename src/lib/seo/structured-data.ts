import { getBaseUrl } from './metadata';

/**
 * WebSite Schema - 网站基本信息
 */
export function generateWebSiteSchema(lang: string) {
  const baseUrl = getBaseUrl();
  
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Shotrio',
    url: baseUrl,
    description: lang === 'zh' 
      ? '用心创作好漫剧 - 强大的可控性与AI智能辅助，完整的微短剧创作工具链' 
      : 'Create great micro-dramas with powerful control and AI assistance - Complete creation toolchain for quality-focused creators',
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
    name: 'Shotrio',
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    description: 'Professional micro-drama creation platform providing powerful control and AI assistance for quality-focused content creators',
    sameAs: [
      // 可以添加社交媒体链接
      // 'https://twitter.com/Shotrio',
      // 'https://www.facebook.com/Shotrio',
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
    name: 'Shotrio',
    url: baseUrl,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    description: lang === 'zh'
      ? '专业的微短剧创作工具 - 提供强大的可控性和AI智能辅助，让创作者精准把控每个细节'
      : 'Professional micro-drama creation tool - Powerful control and AI assistance for creators who master every detail',
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

