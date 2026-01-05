import { useState, useEffect, useRef } from 'react';

interface UseTypewriterOptions {
  words: string[];
  loop?: boolean;
  typeSpeed?: number;
  deleteSpeed?: number;
  delaySpeed?: number;
}

export function useTypewriter({
  words,
  loop = true,
  typeSpeed = 100,
  deleteSpeed = 50,
  delaySpeed = 2000,
}: UseTypewriterOptions) {
  const [text, setText] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    if (words.length === 0) return;

    const currentWord = words[wordIndex];

    const type = () => {
      if (!isDeleting) {
        // 打字阶段
        if (text.length < currentWord.length) {
          setText(currentWord.slice(0, text.length + 1));
          timeoutRef.current = setTimeout(type, typeSpeed);
        } else {
          // 打完后等待
          timeoutRef.current = setTimeout(() => {
            setIsDeleting(true);
          }, delaySpeed);
        }
      } else {
        // 删除阶段
        if (text.length > 0) {
          setText(currentWord.slice(0, text.length - 1));
          timeoutRef.current = setTimeout(type, deleteSpeed);
        } else {
          // 删除完毕，切换到下一个词
          setIsDeleting(false);
          if (loop) {
            setWordIndex((prev) => (prev + 1) % words.length);
          } else if (wordIndex < words.length - 1) {
            setWordIndex((prev) => prev + 1);
          }
        }
      }
    };

    timeoutRef.current = setTimeout(type, isDeleting ? deleteSpeed : typeSpeed);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [text, wordIndex, isDeleting, words, loop, typeSpeed, deleteSpeed, delaySpeed]);

  return text;
}

