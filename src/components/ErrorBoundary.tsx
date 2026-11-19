import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { logClientDiagnostic, toUserFriendlyErrorMessage } from '../utils/errorHandling';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  friendlyMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    friendlyMessage: '',
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      friendlyMessage: toUserFriendlyErrorMessage(
        error,
        'We ran into an unexpected display issue. You can retry without leaving the page or reload OnePlace.'
      ),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logClientDiagnostic(
      `ErrorBoundary caught render error (${errorInfo.componentStack?.split('\n')[1]?.trim() || 'unknown'})`,
      error
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, friendlyMessage: '' });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6"
        >
          <div className="max-w-md w-full rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-7 shadow-xs text-center">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="font-display text-lg font-extrabold tracking-tight text-[#171717]">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm text-[#737373] leading-relaxed">
              {this.state.friendlyMessage ||
                'We ran into an issue loading this section. Please try again.'}
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[#E85D04] px-4 py-2 text-sm font-semibold text-white hover:bg-[#DC2F02] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>Try again</span>
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#171717] hover:bg-[#F8F9FA] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
              >
                <RefreshCw className="h-4 w-4 text-[#737373]" aria-hidden="true" />
                <span>Reload page</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
