export default function StorefrontLoading() {
  return (
    <main
      className="mx-auto min-h-[70vh] max-w-[1240px] px-4 py-12 sm:px-8"
      aria-label="Loading storefront"
    >
      <div className="h-80 animate-pulse rounded-[2rem] bg-store-primary/10" />
      <div className="mt-12 flex gap-3">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-11 w-28 animate-pulse rounded-full bg-store-primary/10" />
        ))}
      </div>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-72 animate-pulse rounded-3xl bg-white" />
        ))}
      </div>
    </main>
  );
}
