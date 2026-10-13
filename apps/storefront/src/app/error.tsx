'use client';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="storefront-shell" role="alert">
      <h1>Something went wrong</h1>
      <p>The page could not be loaded. Try again.</p>
      <button className="waffarly-button" onClick={reset} type="button">
        Try again
      </button>
    </main>
  );
}
