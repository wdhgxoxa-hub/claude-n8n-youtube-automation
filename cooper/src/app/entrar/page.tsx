import { signIn } from "@/auth";
import { Logo } from "@/marca/Logo";
import { Revelado } from "@/componentes/titular";
export default async function Entrar({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="login">
      <section className="login-story">
        <div className="brand">
          <Logo size={42} />
          <span>cooper.</span>
        </div>
        <div className="login-headline">
          <h1>
            <Revelado texto="Las ideas buenas" />
            <br />
            <Revelado texto="no se quedan" inicio={3} />
            <br />
            <Revelado texto="en el chat." inicio={6} />
          </h1>
          <p>
            Un estudio de creación.
            <br />
            Todo tu equipo, en movimiento.
          </p>
        </div>
        <div className="login-track" aria-hidden="true">
          <span>Idea</span>
          <i />
          <span>Creación</span>
          <i />
          <span>Publicación</span>
        </div>
        <small>Hecho para contar lo que importa.</small>
      </section>
      <section className="login-entry">
        <div className="entry-inner">
          <span className="entry-mark">
            <Logo size={48} />
          </span>
          <h2>
            Tu próxima historia
            <br />
            empieza aquí.
          </h2>
          <p>Entra a tu espacio con la cuenta de Google de tu equipo.</p>
          {error && (
            <p role="alert" className="notice error">
              No pudimos darte acceso. Usa un correo de la lista permitida o
              contacta al administrador.
            </p>
          )}
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <button className="google-button">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M20 12h-8m8 0c0 5-3 8-8 8a8 8 0 1 1 5.7-13.7"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                />
              </svg>
              Continuar con Google
            </button>
          </form>
          <div className="login-footnote">
            Un espacio privado.
            <br />
            Solo las personas invitadas pueden entrar.
          </div>
        </div>
        <span className="login-copyright">Cooper / Estudio de creación</span>
      </section>
    </main>
  );
}
