import { Component, type ReactNode } from 'react';

/** Recover when a cached page requests a retired deployment chunk or a screen fails. */
export class ScreenBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed)
      return (
        <main
          className="panel"
          role="alert"
        >
          <h1>This screen could not be loaded</h1>
          <p>Your saved workspace is still in the local database. Reload to retry.</p>
          <button onClick={() => window.location.reload()}>Reload</button>
        </main>
      );
    return this.props.children;
  }
}
