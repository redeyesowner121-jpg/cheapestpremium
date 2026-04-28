import "./index.css";
import { createRoot } from "react-dom/client";

type AppModule = typeof import("./App");

const createMemoryStorage = (): Storage => {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
};

const ensureLocalStorageAccess = () => {
  if (typeof window === "undefined") return;

  try {
    const testKey = "__app_storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
  } catch (error) {
    const fallbackStorage = createMemoryStorage();

    try {
      Object.defineProperty(window, "localStorage", {
        value: fallbackStorage,
        configurable: true,
      });

      Object.defineProperty(globalThis, "localStorage", {
        value: fallbackStorage,
        configurable: true,
      });

      console.warn("localStorage unavailable, using in-memory fallback.", error);
    } catch (overrideError) {
      console.error("Failed to install localStorage fallback:", overrideError);
    }
  }
};

const clearStaleBrowserCaches = async () => {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch (error) {
    console.warn("Service worker cleanup failed:", error);
  }

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch (error) {
    console.warn("Cache cleanup failed:", error);
  }
};

const renderBootstrapFallback = (error: unknown) => {
  console.error("App bootstrap failed:", error);

  const rootElement = document.getElementById("root");
  if (!rootElement) return;

  rootElement.innerHTML = `
    <div class="min-h-screen bg-background flex items-center justify-center p-4">
      <div class="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-card space-y-6" data-app-bootstrap-fallback="true">
        <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive text-2xl">⚠️</div>
        <div class="space-y-2">
          <h1 class="text-2xl font-bold text-foreground">App failed to start</h1>
          <p class="text-sm text-muted-foreground">Startup recovery is active, so the page will no longer stay fully white.</p>
        </div>
        <div class="flex flex-col gap-3 sm:flex-row">
          <button id="app-reload-button" class="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90">Reload</button>
          <button id="app-home-button" class="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 py-3 font-medium text-secondary-foreground transition-colors hover:bg-secondary/80">Go Home</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("app-reload-button")?.addEventListener("click", async () => {
    await clearStaleBrowserCaches();
    const url = new URL(window.location.href);
    url.searchParams.set("_r", String(Date.now()));
    window.location.replace(url.toString());
  });

  document.getElementById("app-home-button")?.addEventListener("click", () => {
    window.location.assign(`/${window.location.search}${window.location.hash}`);
  });
};

const renderBootstrapScreen = () => {
  const rootElement = document.getElementById("root");
  if (!rootElement) return;

  rootElement.innerHTML = `
    <div class="min-h-screen bg-background flex items-center justify-center p-4" data-app-booting="true">
      <div class="flex flex-col items-center gap-4 text-center">
        <div class="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p class="text-sm font-medium text-muted-foreground">Loading store…</p>
      </div>
    </div>
  `;
};

const loadApp = async (): Promise<AppModule> => {
  const timeout = new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error("App module load timed out")), 8000);
  });

  return Promise.race([import("./App"), timeout]);
};

const bootstrap = async () => {
  ensureLocalStorageAccess();
  renderBootstrapScreen();

  try {
    const rootElement = document.getElementById("root");

    if (!rootElement) {
      throw new Error("Root element not found");
    }

    const { default: App }: AppModule = await loadApp();

    rootElement.innerHTML = "";

    createRoot(rootElement).render(<App />);

    // Detect new deployments and auto-refresh stale clients
    import("./lib/versionCheck").then(({ startVersionCheck }) => startVersionCheck()).catch(() => {});
  } catch (error) {
    renderBootstrapFallback(error);
  }
};

bootstrap();
