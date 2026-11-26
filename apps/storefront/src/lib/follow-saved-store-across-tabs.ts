/**
 * Keeps a saved cart/favorites store in step with the shopper's other open tabs.
 *
 * Each tab holds its own copy in memory and saves the whole copy on every change.
 * Without this, a tab opened earlier would save its older cart over items added in
 * another tab (for example by only tapping a favorite). Reloading from storage as soon
 * as another tab saves means every tab always saves the latest cart.
 */
type SavedStore = {
  persist: {
    getOptions: () => { name?: string };
    rehydrate: () => Promise<void> | void;
  };
};

/** Starts following other tabs and returns the function that stops it. */
export function followSavedStoreAcrossTabs(store: SavedStore): () => void {
  const name = store.persist.getOptions().name;
  const reload = (event: StorageEvent) => {
    // A null key means another tab cleared all site storage.
    if (event.storageArea !== window.localStorage) return;
    if (event.key !== name && event.key !== null) return;
    void store.persist.rehydrate();
  };
  window.addEventListener('storage', reload);
  return () => window.removeEventListener('storage', reload);
}
