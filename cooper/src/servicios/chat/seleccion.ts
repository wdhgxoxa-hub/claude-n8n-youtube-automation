import { ErrorHttp } from "@/lib/permisos";
import { ChatClaude, ChatOpenAI, ChatConRespaldo } from "./proveedores";
import { ChatClaudeCli, ChatCodexLocal } from "./locales";
import { ChatSimulado } from "./simulado";
import type { EntradaModelo, EventoProveedor, ProveedorChat } from "./tipos";

class ApoyoBasico implements ProveedorChat {
  async *generar(
    e: EntradaModelo,
    signal: AbortSignal,
  ): AsyncGenerator<EventoProveedor> {
    const aviso =
      "Estoy en modo básico temporal. Puedo atender pedidos sencillos del estudio. ";
    if (!e.mensajes.at(-1)?.resultados) yield { tipo: "texto", texto: aviso };
    yield* new ChatSimulado().generar(e, signal);
  }
}

export function proveedorChat(): ProveedorChat {
  const mode =
    process.env.COOPER_DEMO === "1"
      ? "simulada"
      : (process.env.COOPER_CHAT ?? "auto");
  if (mode === "simulada") return new ChatSimulado();
  if (mode === "openai") return new ChatOpenAI();
  if (mode === "claude")
    return new ChatConRespaldo(new ChatClaude(), new ChatOpenAI());
  if (!["auto", "claude-cli", "codex-local"].includes(mode))
    throw new ErrorHttp(
      503,
      "El chat no está configurado. Contacta con Walter.",
    );
  let proveedor: ProveedorChat = new ApoyoBasico();
  if (process.env.COOPER_CHAT_API_RESPALDO !== "0") {
    if (process.env.OPENAI_API_KEY)
      proveedor = new ChatConRespaldo(new ChatOpenAI(), proveedor);
    if (process.env.ANTHROPIC_API_KEY)
      proveedor = new ChatConRespaldo(new ChatClaude(), proveedor);
  }
  proveedor = new ChatConRespaldo(new ChatCodexLocal(), proveedor);
  if (mode !== "codex-local")
    proveedor = new ChatConRespaldo(new ChatClaudeCli(), proveedor);
  return proveedor;
}
