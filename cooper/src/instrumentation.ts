export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build" &&
    process.env.COOPER_BIBLIOTECA_PAUSA !== "1"
  ) {
    const { iniciarBiblioteca } =
      await import("./servicios/biblioteca-trabajador");
    iniciarBiblioteca();
  }
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build" &&
    process.env.COOPER_MENSAJERIA_PAUSA !== "1"
  ) {
    const { iniciarMensajeria } =
      await import("./servicios/mensajeria/trabajador");
    iniciarMensajeria();
  }
}
