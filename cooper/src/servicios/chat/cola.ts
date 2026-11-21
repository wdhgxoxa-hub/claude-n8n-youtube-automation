import { ErrorHttp } from "@/lib/permisos";

// Una instancia de Cooper: FIFO global acotada, una plaza por dueño y 30 turnos/hora.
// La reserva SQLite del chat sigue protegiendo también las confirmaciones y otros procesos.
export class ColaChat {
  private ocupados = new Set<string>();
  private activos = 0;
  private inicios: number[] = [];
  private pendientes: (() => void)[] = [];
  constructor(
    private opciones = {
      simultaneos: 1,
      porHora: 30,
      esperaMs: 15000,
      maxCola: 10,
    },
  ) {}

  async entrar(dueno: string, signal: AbortSignal): Promise<() => void> {
    signal.throwIfAborted();
    if (this.ocupados.has(dueno))
      throw new ErrorHttp(
        409,
        "Cooper está atendiendo otro mensaje tuyo. Espera a que termine.",
      );
    if (this.pendientes.length >= this.opciones.maxCola)
      throw new ErrorHttp(429, "Cooper está ocupado. Inténtalo en un momento.");
    this.ocupados.add(dueno);
    return new Promise((resolve, reject) => {
      const limpiar = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
      };
      const cancelar = (error: Error) => {
        limpiar();
        this.pendientes = this.pendientes.filter((p) => p !== iniciar);
        this.ocupados.delete(dueno);
        reject(error);
      };
      const abort = () =>
        cancelar(
          new ErrorHttp(
            504,
            "La espera de Cooper terminó. Vuelve a intentarlo.",
          ),
        );
      const iniciar = () => {
        limpiar();
        this.inicios = this.inicios.filter((t) => Date.now() - t < 3600000);
        if (this.inicios.length >= this.opciones.porHora) {
          this.ocupados.delete(dueno);
          reject(
            new ErrorHttp(
              429,
              "Cooper alcanzó su límite temporal de conversación. Inténtalo más tarde.",
            ),
          );
          this.avanzar();
          return;
        }
        this.inicios.push(Date.now());
        this.activos++;
        let liberado = false;
        resolve(() => {
          if (liberado) return;
          liberado = true;
          this.activos--;
          this.ocupados.delete(dueno);
          this.avanzar();
        });
      };
      const timer = setTimeout(
        () =>
          cancelar(
            new ErrorHttp(
              429,
              "Cooper sigue ocupado. Espera un momento y vuelve a enviar el mensaje.",
            ),
          ),
        this.opciones.esperaMs,
      );
      signal.addEventListener("abort", abort, { once: true });
      if (this.activos < this.opciones.simultaneos) iniciar();
      else this.pendientes.push(iniciar);
    });
  }
  private avanzar() {
    while (this.activos < this.opciones.simultaneos && this.pendientes.length)
      this.pendientes.shift()!();
  }
}
export const colaChat = new ColaChat();
