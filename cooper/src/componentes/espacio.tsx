"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Link from "next/link";
import { conectarEventos, type EstadoConexion } from "@/lib/conexion-eventos";
import "./estado-conexion.css";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutGroup,
  LazyMotion,
  MotionConfig,
  m as motion,
} from "framer-motion";
import { CelebracionPublicacion, type Momento } from "./escena-estudio";
import { CooperFlotante } from "./cooper-flotante";
import { Transiciones } from "./transiciones";
import { PildoraConexion } from "./primitivas";
import "./armazon.css";
import {
  Indicador,
  useMovimientoReducido,
  usePausaMovimiento,
} from "./movimiento";
import {
  House,
  ChartNoAxesCombined,
  BookOpen,
  Palette,
  Clapperboard,
  Radio,
  UsersRound,
  Settings2,
  ShieldCheck,
  LogOut,
  Ellipsis,
  X,
} from "lucide-react";
import type { Estado } from "@/servicios/datos";
import { Logo } from "@/marca/Logo";
export async function api<T = unknown>(
  path: string,
  data?: unknown,
  method = "POST",
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, {
      method,
      signal: AbortSignal.timeout(15000),
      headers:
        data === undefined ? undefined : { "Content-Type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  } catch (error) {
    throw new Error(
      error instanceof Error && error.name === "TimeoutError"
        ? "No recibimos respuesta a tiempo. Revisa si el cambio se guardó antes de intentarlo otra vez."
        : "No pudimos conectar. Comprueba tu conexión y revisa si el cambio se guardó.",
    );
  }
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error(
      "No pudimos confirmar el resultado. Revisa si el cambio se guardó.",
    );
  }
  if (!response.ok)
    throw new Error(
      value &&
        typeof value === "object" &&
        "error" in value &&
        typeof value.error === "string"
        ? value.error
        : "No se pudo completar la solicitud.",
    );
  return value as T;
}
const Context = createContext<{
  data: Estado;
  refresh: () => Promise<void>;
  connected: boolean;
  marcaContexto: { id: string; nombre: string } | null;
  definirMarca: (marca: { id: string; nombre: string } | null) => void;
} | null>(null);
export function useEspacio() {
  const value = useContext(Context);
  if (!value) throw new Error("Espacio no disponible");
  return value;
}
const cargarMovimiento = () =>
  import("./movimiento-funciones").then((module) => module.default);
const nav = [
  { path: "/", label: "Inicio", icon: House },
  { path: "/videos", label: "Fábrica", icon: Clapperboard },
  { path: "/publicados", label: "Publicados", icon: ChartNoAxesCombined },
  { path: "/aprendizaje", label: "Aprendizaje", icon: BookOpen },
  { path: "/marcas", label: "Marcas", icon: Palette },
];
const extras = [
  { path: "/canales", label: "Canales", icon: Radio },
  { path: "/avatares", label: "Avatares y voces", icon: UsersRound },
  { path: "/radar", label: "Operación", icon: Settings2 },
  { path: "/perfil", label: "Mi perfil", icon: Settings2 },
];
function observarMovil(notify: () => void) {
  const media = window.matchMedia("(max-width: 1023px)");
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}
function observarVisibilidad(notify: () => void) {
  document.addEventListener("visibilitychange", notify);
  return () => document.removeEventListener("visibilitychange", notify);
}
export function Espacio({
  initial,
  children,
  logout,
}: {
  initial: Estado;
  children: ReactNode;
  logout: () => Promise<void>;
}) {
  const [data, setData] = useState(initial),
    [conexion, setConexion] = useState<EstadoConexion>("iniciando"),
    [avisoConexion, setAvisoConexion] = useState(false),
    [menu, setMenu] = useState(false),
    [cooper, setCooper] = useState(false);
  const connected = conexion === "activa";
  const [marcaContexto, definirMarca] = useState<{
    id: string;
    nombre: string;
  } | null>(null);
  const movil = useSyncExternalStore(
    observarMovil,
    () => window.matchMedia("(max-width: 1023px)").matches,
    () => false,
  );
  const path = usePathname();
  const ruta = useRef<HTMLDivElement>(null);
  const ultimaRuta = useRef(path);
  useEffect(() => {
    // La primera carga ya tiene contenido legible en SSR. La coreografía se
    // reserva para cambios de ruta, sin mover de nuevo el LCP al hidratar.
    if (ultimaRuta.current !== path) {
      ultimaRuta.current = path;
      ruta.current?.setAttribute("data-navigation", "true");
    }
  }, [path]);
  const reduced = useMovimientoReducido();
  const [isPaused] = usePausaMovimiento();
  const [celebration, setCelebration] = useState<{
    title: string;
    videoId: string;
    momento: Momento;
  } | null>(null);
  const previousVideos = useRef(initial.videos);
  const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const receive = useCallback((next: Estado) => {
    const cambio = next.videos.flatMap((video) => {
      const anterior = previousVideos.current.find((v) => v.id === video.id);
      if (!anterior || anterior.stage === video.stage) return [];
      let momento: Momento | undefined;
      if (video.stage === 11 && anterior.stage < 11) momento = "publicado";
      else if (video.stage === 9 && anterior.stage < 9) momento = "terminado";
      else if (
        (anterior.stage === 3 && video.stage === 4) ||
        (anterior.stage === 9 && video.stage === 10)
      )
        momento = "aprobado";
      return momento
        ? [{ title: video.title, videoId: video.id, momento }]
        : [];
    })[0];
    previousVideos.current = next.videos;
    // Conservar la celebración y evitar repintar latidos SSE idénticos.
    setData((previous) =>
      JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
    );
    if (cambio) {
      setCelebration(cambio);
      if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
      celebrationTimer.current = setTimeout(() => setCelebration(null), 900);
    }
  }, []);
  useEffect(
    () => () => {
      if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
    },
    [],
  );
  const hidden = useSyncExternalStore(
    observarVisibilidad,
    () => document.hidden,
    () => false,
  );
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLElement>(null);
  const previousPath = useRef(path);
  const refresh = useCallback(async () => {
    receive(await api<Estado>("estado", undefined, "GET"));
  }, [receive]);
  useEffect(
    () =>
      conectarEventos<Estado>({
        recibir: receive,
        cambiar: (estado, aviso) => {
          setConexion(estado);
          setAvisoConexion(aviso);
        },
      }),
    [receive],
  );
  useEffect(() => {
    if (!menu) return;
    const panel = sidebar.current;
    const opener = menuButton.current;
    const focusable = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled])",
        ) ?? [],
      );
    focusable()[0]?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenu(false);
      }
      if (event.key === "Tab") {
        const items = focusable();
        const target = event.shiftKey ? items.at(-1) : items[0];
        if (
          (event.shiftKey && document.activeElement === items[0]) ||
          (!event.shiftKey && document.activeElement === items.at(-1))
        ) {
          event.preventDefault();
          target?.focus();
        }
      }
    };
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = before;
      window.removeEventListener("keydown", close);
      opener?.focus();
    };
  }, [menu]);
  useEffect(() => {
    if (previousPath.current === path) return;
    previousPath.current = path;
    content.current?.focus({ preventScroll: true });
  }, [path]);
  // Abrir una hoja no cambia los datos del estudio ni debe renderizar sus pantallas.
  const contexto = useMemo(
    () => ({ data, refresh, connected, marcaContexto, definirMarca }),
    [data, refresh, connected, marcaContexto],
  );
  return (
    <Context.Provider value={contexto}>
      <MotionConfig
        reducedMotion={isPaused || hidden || reduced ? "always" : "user"}
      >
        <LazyMotion features={cargarMovimiento} strict>
          <LayoutGroup id="estudio">
            <div
              className="workspace"
              data-conexion={conexion}
              data-motion={isPaused || hidden || reduced ? "paused" : "playing"}
            >
              <Transiciones />
              <div
                className={`studio-shell ${cooper ? "cooper-open" : ""}`}
                inert={menu || (cooper && movil)}
              >
                <a className="skip" href="#contenido">
                  Saltar al contenido
                </a>
                <aside
                  className="glass-rail"
                  aria-label="Navegación del estudio"
                >
                  <Link
                    href="/"
                    className="rail-brand"
                    aria-label="Cooper, inicio"
                  >
                    <Logo size={32} />
                    <span>cooper.</span>
                  </Link>
                  <nav aria-label="Principal">
                    {nav.map(({ path: href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        aria-current={
                          (href === "/" ? path === "/" : path.startsWith(href))
                            ? "page"
                            : undefined
                        }
                      >
                        {(href === "/"
                          ? path === "/"
                          : path.startsWith(href)) && (
                          <Indicador id="riel" className="nav-indicator" />
                        )}
                        <Icon size={20} />
                        <span>{label}</span>
                      </Link>
                    ))}
                  </nav>
                  <button
                    className="rail-more"
                    onClick={(event) => {
                      menuButton.current = event.currentTarget;
                      setMenu(true);
                    }}
                    aria-label="Más destinos"
                    aria-expanded={menu}
                  >
                    <Ellipsis size={20} />
                    <span>Más</span>
                  </button>
                </aside>
                <div className="main-column">
                  <header className="topbar">
                    <span>
                      {[
                        ...nav,
                        ...extras,
                        { path: "/admin", label: "Administración" },
                        { path: "/rutina", label: "Rutina" },
                        { path: "/redes", label: "Redes" },
                        { path: "/referencias", label: "Referencias" },
                        { path: "/cuentas", label: "Cuentas" },
                        { path: "/decisiones", label: "Decisiones" },
                        { path: "/programados", label: "Programados" },
                        { path: "/avisos", label: "Avisos" },
                        { path: "/incidencias", label: "Incidencias" },
                        ...data.videos.map((video) => ({
                          path: `/videos/${video.id}`,
                          label: video.title,
                        })),
                        ...data.channels.map((canal) => ({
                          path: `/canales/${canal.id}`,
                          label: canal.name,
                        })),
                      ].find((n) => n.path === path)?.label ?? "Estudio Cooper"}
                    </span>
                    <Link
                      href="/perfil"
                      className="header-avatar"
                      aria-label="Mi perfil"
                    >
                      {data.user.image ? (
                        <Image
                          unoptimized
                          src={data.user.image}
                          width={40}
                          height={40}
                          alt=""
                        />
                      ) : (
                        <span>{data.user.name.slice(0, 1).toUpperCase()}</span>
                      )}
                    </Link>
                  </header>
                  <main ref={content} id="contenido" tabIndex={-1}>
                    <div key={path} ref={ruta} className="route-choreography">
                      {children}
                    </div>
                    {celebration && (
                      <CelebracionPublicacion
                        title={celebration.title}
                        momento={celebration.momento}
                        videoId={celebration.videoId}
                        cerrar={() => setCelebration(null)}
                      />
                    )}
                  </main>
                </div>
                <nav className="mobile-dock" aria-label="Principal móvil">
                  {nav.map(({ path: href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      aria-current={
                        (href === "/" ? path === "/" : path.startsWith(href))
                          ? "page"
                          : undefined
                      }
                    >
                      {(href === "/"
                        ? path === "/"
                        : path.startsWith(href)) && (
                        <Indicador id="barra-movil" className="nav-indicator" />
                      )}
                      <Icon size={20} />
                      <span>{label}</span>
                    </Link>
                  ))}
                </nav>
                <button
                  className="mobile-more icon-button"
                  aria-label="Más destinos"
                  aria-expanded={menu}
                  onClick={(event) => {
                    menuButton.current = event.currentTarget;
                    setMenu(true);
                  }}
                >
                  <Ellipsis size={20} />
                </button>
              </div>
              <PildoraConexion aviso={avisoConexion} />
              <CooperFlotante
                abierto={cooper}
                cambiar={setCooper}
                movil={movil}
              />
              {menu && (
                <div
                  className="more-backdrop"
                  onClick={(event) => {
                    if (event.target === event.currentTarget) setMenu(false);
                  }}
                >
                  <div
                    ref={sidebar}
                    className="more-sheet hoja-vidrio"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Más destinos"
                  >
                    <header>
                      <h2>Tu estudio</h2>
                      <button
                        className="icon-button"
                        aria-label="Cerrar navegación"
                        onClick={() => setMenu(false)}
                      >
                        <X size={20} />
                      </button>
                    </header>
                    <nav>
                      {extras.map(({ path: href, label, icon: Icon }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setMenu(false)}
                        >
                          <Icon size={20} />
                          {label}
                        </Link>
                      ))}
                      {data.user.role === "admin" && (
                        <Link href="/admin" onClick={() => setMenu(false)}>
                          <ShieldCheck size={20} />
                          Administración
                        </Link>
                      )}
                    </nav>
                    <form action={logout}>
                      <button className="button secondary">
                        <LogOut size={20} />
                        Cerrar sesión
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </LayoutGroup>
        </LazyMotion>
      </MotionConfig>
    </Context.Provider>
  );
}
export function Heading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const reduced = useMovimientoReducido();
  return (
    <div className="page-heading">
      <div>
        <motion.h1
          layoutId={reduced ? undefined : "titulo-ruta"}
          transition={{ duration: reduced ? 0 : 0.24 }}
        >
          {title}
        </motion.h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Notice({
  id,
  error,
  message,
}: {
  id?: string;
  error?: string;
  message?: string;
}) {
  return error ? (
    <p id={id} className="notice error notice-enter" role="alert">
      {error}
    </p>
  ) : message ? (
    <p id={id} className="notice notice-enter" role="status">
      {message}
    </p>
  ) : null;
}
export function Skeleton() {
  return (
    <div
      className="skeleton-group"
      role="status"
      aria-label="Cargando contenido"
    >
      <span className="loading-reel" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <div className="skeleton wide" />
      <div className="skeleton" />
      <div className="skeleton tall" />
    </div>
  );
}
