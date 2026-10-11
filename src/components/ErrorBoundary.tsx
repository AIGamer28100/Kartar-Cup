import { Component, type ErrorInfo, type ReactNode } from 'react';
import FailurePage from './FailurePage';

export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error ?? new Error('Unknown error') };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) return <FailurePage error={this.state.error} />;
    return this.props.children;
  }
}
