import React from "react";

interface AppErrorBoundaryState {
  hasError: boolean;
  message: string;
  reportPath: string;
}

export class AppErrorBoundary extends React.Component<
  React.PropsWithChildren,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: "",
    reportPath: ""
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error.message,
      reportPath: ""
    };
  }

  async componentDidCatch(error: Error) {
    console.error("App render crashed", error);
    if (typeof window !== "undefined" && window.appApi) {
      try {
        const result = await window.appApi.reportRendererCrash({
          source: "react-error-boundary",
          message: error.message,
          stack: error.stack
        });
        this.setState({ reportPath: result.path });
      } catch (reportError) {
        console.error("Failed to write crash report", reportError);
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="startup-shell">
          <div className="startup-card">
            <div className="panel-label">Renderer Error</div>
            <h1>Canvas Studio hit a runtime error</h1>
            <p>{this.state.message || "Unknown renderer error."}</p>
            <p>
              {this.state.reportPath
                ? `Crash report saved to ${this.state.reportPath}`
                : "A crash report will be written if possible."}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
