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

const recoverAndReload = async () => {
  await clearStaleBrowserCaches();
  const url = new URL(window.location.href);
  url.searchParams.set("_r", String(Date.now()));
  window.location.replace(url.toString());
};

const renderBootstrapFallback = (error: unknown) => {
  console.error("App startup recovery triggered:", error);

  const rootElement = document.getElementById("root");
  if (!rootElement) return;

  const retryKey = "__app_startup_recovery__";
  const now = Date.now();

  try {
    const lastRetry = Number(sessionStorage.getItem(retryKey) || "0");
    if (now - lastRetry > 60_000) {
      sessionStorage.setItem(retryKey, String(now));
      recoverAndReload();
      return;
    }
  } catch {
    recoverAndReload();
    return;
  }

  rootElement.innerHTML = `
    <div class="min-h-screen bg-background flex items-center justify-center p-4">
      <div class="flex flex-col items-center gap-4 text-center" data-app-bootstrap-fallback="true">
        <div class="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p class="text-sm font-medium text-muted-foreground">Loading store…</p>
        <button id="app-reload-button" class="mt-2 inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">Retry</button>
      </div>
    </div>
  `;

  document.getElementById("app-reload-button")?.addEventListener("click", async () => {
    sessionStorage.removeItem(retryKey);
    await recoverAndReload();
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
