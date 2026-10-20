import { Component, type ReactNode } from 'react';
import { MerchantRouteFailure } from './MerchantRouteFailure.js';

export class MerchantRouteBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      !/loading (?:css )?chunk .* failed|failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i.test(
        message,
      )
    ) {
      throw error;
    }
    return { failed: true };
  }

  render() {
    return this.state.failed ? <MerchantRouteFailure /> : this.props.children;
  }
}
