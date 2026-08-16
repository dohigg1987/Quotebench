"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback: (retry: () => void) => ReactNode;
  context: "quote" | "template";
};

type State = { failed: boolean };

export default class EditorErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("QuoteBench editor boundary", { name: error.name, message: error.message, componentStack: info.componentStack });
    void fetch("/api/client-errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ surface: `${this.props.context}_editor`, name: error.name, message: error.message, componentStack: info.componentStack }),
      keepalive: true,
    }).catch(() => undefined);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return this.props.fallback(() => this.setState({ failed: false }));
  }
}
