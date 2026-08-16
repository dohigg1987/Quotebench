"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  title: string;
  description: string;
  recoveryPath: string;
};

type State = { failed: boolean };

export default class WorkspaceErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("QuoteBench workspace boundary", { name: error.name, message: error.message, componentStack: info.componentStack });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <section className="workspace-recovery" role="alert">
      <span aria-hidden="true">!</span>
      <div><strong>{this.props.title}</strong><p>{this.props.description}</p></div>
      <div><button className="button secondary" type="button" onClick={() => this.setState({ failed: false })}>Try again</button><a className="button primary" href={this.props.recoveryPath}>Reload editor</a></div>
    </section>;
  }
}
