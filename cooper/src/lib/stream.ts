// SSE incremental: admite UTF-8 partido, CRLF y múltiples líneas data.
export async function* leerSSE(response: Response): AsyncGenerator<unknown> {
  if (!response.ok || !response.body)
    throw new Error("Respuesta no disponible.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 2 * 1024 * 1024)
        throw new Error("Respuesta demasiado grande.");
      buffer += decoder.decode(value, { stream: true });
      let match: RegExpExecArray | null;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const data = frame
          .split(/\r?\n/)
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trimStart())
          .join("\n");
        if (data && data !== "[DONE]") yield JSON.parse(data) as unknown;
      }
    }
    if (buffer.trim()) throw new Error("Respuesta interrumpida.");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
