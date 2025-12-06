'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatwootWidgetProps {
  websiteToken: string;
  baseUrl: string;
  user?: {
    email?: string;
    name?: string;
    avatarUrl?: string;
    identifier?: string;
  };
  customAttributes?: Record<string, unknown>;
  showFloatingButton?: boolean; // 是否显示浮动按钮
}

export function ChatwootWidget({
  websiteToken,
  baseUrl,
  user,
  customAttributes,
  showFloatingButton = true,
}: ChatwootWidgetProps) {
  const locale = useLocale();
  const t = useTranslations('feedback');
  const [isReady, setIsReady] = useState(false);
  const [textIndex, setTextIndex] = useState(0);

  // 文案列表
  const texts = [
    t('chatWithUs'),
    t('needHelp'),
    t('giveFeedback'),
  ];

  // 加载 Chatwoot SDK
  useEffect(() => {
    if (!websiteToken || !baseUrl) {
      console.warn('Chatwoot: Missing websiteToken or baseUrl');
      return;
    }

    // 配置 Chatwoot 设置 - 隐藏默认按钮
    window.chatwootSettings = {
      hideMessageBubble: true,
      position: 'right',
      locale: locale === 'zh' ? 'zh_CN' : 'en',
      type: 'standard',
    };

    // 加载 Chatwoot 脚本
    const script = document.createElement('script');
    script.src = `${baseUrl}/packs/js/sdk.js`;
    script.defer = true;
    script.async = true;

    script.onload = () => {
      if (window.chatwootSDK) {
        window.chatwootSDK.run({
          websiteToken,
          baseUrl,
        });

        // 等待 Chatwoot 初始化完成
        const checkChatwoot = setInterval(() => {
          if (window.$chatwoot) {
            clearInterval(checkChatwoot);
            setIsReady(true);

            // 设置语言
            window.$chatwoot.setLocale(locale === 'zh' ? 'zh_CN' : 'en');
          }
        }, 100);

        // 10秒后清除检查
        setTimeout(() => clearInterval(checkChatwoot), 10000);
      }
    };

    document.body.appendChild(script);

    // 清理函数
    return () => {
      try {
        // 安全地清理 Chatwoot 元素
        const chatwootContainer = document.querySelector('.woot-widget-holder');
        if (chatwootContainer) {
          chatwootContainer.remove();
        }
        
        // 清理 iframe
        const chatwootIframe = document.querySelector('iframe[name^="chatwoot"]');
        if (chatwootIframe) {
          chatwootIframe.remove();
        }
        
        // 安全地移除 script
        const existingScript = document.querySelector(
          `script[src="${baseUrl}/packs/js/sdk.js"]`
        );
        if (existingScript && existingScript.parentNode) {
          existingScript.parentNode.removeChild(existingScript);
        }
        
        // 重置 window 对象
        if (window.$chatwoot) {
          delete window.$chatwoot;
        }
        if (window.chatwootSettings) {
          delete window.chatwootSettings;
        }
        if (window.chatwootSDK) {
          delete window.chatwootSDK;
        }
        
        setIsReady(false);
      } catch (error) {
        console.warn('Error cleaning up Chatwoot:', error);
      }
    };
  }, [websiteToken, baseUrl, locale]);

  // 单独的 effect 用于更新用户信息和自定义属性
  useEffect(() => {
    if (!isReady || !window.$chatwoot) {
      return;
    }

    try {
      // 设置用户信息
      if (user?.identifier) {
        window.$chatwoot.setUser(user.identifier, {
          email: user.email,
          name: user.name,
          avatar_url: user.avatarUrl,
        });
      }

      // 设置自定义属性
      if (customAttributes) {
        window.$chatwoot.setCustomAttributes(customAttributes);
      }
    } catch (error) {
      console.warn('Error updating Chatwoot user info:', error);
    }
  }, [isReady, user, customAttributes]);

  // 文案切换效果
  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % texts.length);
    }, 3000); // 每3秒切换一次

    return () => clearInterval(interval);
  }, [texts.length]);

  const handleToggle = () => {
    if (window.$chatwoot && isReady) {
      window.$chatwoot.toggle();
    }
  };

  // 如果不显示浮动按钮，直接返回 null（但 Chatwoot 脚本已加载）
  if (!isReady || !showFloatingButton) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* 客服按钮 */}
      <Button
        onClick={handleToggle}
        size="lg"
        className="h-12 px-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 bg-[#FB923C] hover:bg-[#F97316] text-white group relative flex items-center gap-2 font-medium"
        aria-label={t('openChat')}
      >
        <MessageCircle className="w-5 h-5" />
        
        {/* 按钮文字 - 带切换动画 */}
        <span className="relative text-sm min-w-[80px] text-center overflow-hidden">
          {texts.map((text, index) => (
            <span
              key={index}
              className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
                index === textIndex
                  ? 'opacity-100 translate-y-0'
                  : index < textIndex
                  ? 'opacity-0 -translate-y-full'
                  : 'opacity-0 translate-y-full'
              }`}
            >
              {text}
            </span>
          ))}
          {/* 占位文本，确保宽度 */}
          <span className="invisible">{texts[textIndex]}</span>
        </span>
        
        {/* 在线指示器 */}
        <span className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-background animate-pulse" />
      </Button>
    </div>
  );
}

