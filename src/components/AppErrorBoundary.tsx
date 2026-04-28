import { Component, ErrorInfo, ReactNode } from "react";
import { RefreshCw } from "lucide-react";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  recoveredOnce: boolean;
}

class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    recoveredOnce: false,
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App recovery boundary caught an error:", error, errorInfo);

    try {
      const key = "__app_runtime_recovery__";
      const last = Number(sessionStorage.getItem(key) || "0");
      const now = Date.now();
      if (now - last > 60_000) {
        sessionStorage.setItem(key, String(now));
        window.setTimeout(() => window.location.replace(`/?_r=${now}`), 400);
      }
    } catch {}
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-muted-foreground">Loading store…</p>
            <button
              onClick={this.handleReload}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;