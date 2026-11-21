// Subproceso de ensayo: no arranca Next ni lee archivos de entorno.
import {
  reservarMedio,
  cicloBiblioteca,
} from "../../src/servicios/biblioteca-trabajador";
const [mode, time] = process.argv.slice(2);
if (
  !process.env.COOPER_DATABASE_PATH?.includes(".cache/unit-") ||
  !Number.isFinite(Number(time))
)
  throw new Error("Solo bases efímeras de pruebas");
Date.now = () => Number(time);
globalThis.fetch = async () => {
  throw new Error("Red bloqueada");
};
async function main() {
  if (mode === "reservar") process.send?.({ reservado: !!reservarMedio() });
  else {
    let consultas = 0;
    await cicloBiblioteca({
      consultar: async (a) => {
        consultas++;
        if (mode === "caer") {
          process.send?.({ consultando: true });
          await new Promise(() => {});
        }
        return { id: a.providerId, estado: "listo" };
      },
    });
    process.send?.({ consultas });
  }
  process.disconnect();
}
void main();
