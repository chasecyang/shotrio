'use client';

import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTranslations } from 'next-intl';

/**
 * Header 中使用的 Chatwoot 按钮
 * 点击后打开 Chatwoot 对话窗口
 */
export function ChatwootButton() {
  const t = useTranslations('feedback');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 检查 Chatwoot 是否已加载
    const checkChatwoot = setInterval(() => {
      if (window.$chatwoot) {
        setIsReady(true);
        clearInterval(checkChatwoot);
      }
    }, 100);

    // 10秒后停止检查
    setTimeout(() => clearInterval(checkChatwoot), 10000);

    return () => clearInterval(checkChatwoot);
  }, []);

  const handleClick = () => {
    if (window.$chatwoot && isReady) {
      window.$chatwoot.toggle();
    }
  };

  if (!isReady) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleClick}
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('chatWithUs')}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
