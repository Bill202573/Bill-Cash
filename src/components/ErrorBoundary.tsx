import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-expense/15 flex items-center justify-center text-2xl">⚠️</div>
          <div>
            <p className="font-display font-semibold text-lg">Algo deu errado</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              {this.state.error.message}
            </p>
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            className="text-sm text-primary hover:underline"
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
