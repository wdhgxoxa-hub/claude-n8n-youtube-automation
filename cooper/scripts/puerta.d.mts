export function avisos(texto: string): string[];
export function comprobarResultados(
  unitarias: {
    success: boolean;
    numPassedTests: number;
    numFailedTests?: number;
    numPendingTests?: number;
    numTodoTests?: number;
  },
  e2e: {
    stats: {
      expected: number;
      unexpected?: number;
      skipped?: number;
      flaky?: number;
    };
    errors?: unknown[];
  },
  flujos: string,
): { unitarias: number; e2e: number; flujos: number };
