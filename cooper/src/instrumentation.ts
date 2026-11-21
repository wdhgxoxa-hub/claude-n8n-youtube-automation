export async function register() {
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
