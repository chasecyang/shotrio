"use client";

import React, { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Agent 面板错误边界
 * 捕获并优雅处理运行时错误
 */
export class AgentErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[AgentErrorBoundary] 捕获错误:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    // 刷新页面以重置状态
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center justify-center p-8">
          <div className="max-w-md text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-destructive/10 p-4">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">AI 助手遇到问题</h3>
              <p className="text-sm text-muted-foreground">
                {this.state.error?.message || "发生了未知错误"}
              </p>
              <p className="text-xs text-muted-foreground">
                请尝试刷新页面或联系技术支持
              </p>
            </div>
            <div className="flex gap-2 justify-center">
              <Button onClick={this.handleReset} size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新页面
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

