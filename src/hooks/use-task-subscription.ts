"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { Job } from "@/types/job";

interface TaskUpdateEvent {
  type: "connected" | "jobs_update" | "heartbeat" | "error";
  jobs?: Partial<Job>[];
  timestamp?: string;
  message?: string;
}

/**
 * SSE Hook - 订阅任务更新
 */
export function useTaskSubscription() {
  const [jobs, setJobs] = useState<Partial<Job>[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    // 如果已经连接，不重复连接
    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      return;
    }

    try {
      const eventSource = new EventSource("/api/tasks/stream");
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data: TaskUpdateEvent = JSON.parse(event.data);

          if (data.type === "jobs_update" && data.jobs) {
            setJobs(data.jobs);
          } else if (data.type === "error") {
            setError(data.message || "未知错误");
          }
        } catch (err) {
          console.error("解析 SSE 消息失败:", err);
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource.close();

        // 自动重连
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`尝试重连 SSE (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
            connect();
          }, delay);
        } else {
          setError("连接失败，已达到最大重试次数");
        }
      };
    } catch (err) {
      console.error("创建 SSE 连接失败:", err);
      setError("无法建立连接");
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsConnected(false);
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect, disconnect]);

  // 组件挂载时连接
  useEffect(() => {
    connect();

    // 组件卸载时断开连接
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    jobs,
    isConnected,
    error,
    reconnect,
  };
}

