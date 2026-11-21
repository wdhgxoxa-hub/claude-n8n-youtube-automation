"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutGroup,
  LazyMotion,
  MotionConfig,
  m as motion,
} from "framer-motion";
import { EscenaEstudio, CelebracionPublicacion } from "./escena-estudio";
import { IlustracionViva } from "./ilustracion-viva";
import {
  Indicador,
  NumeroAnimado,
  useMovimientoReducido,
  usePausaMovimiento,
} from "./movimiento";
import {
  House,
  ChartNoAxesCombined,
  BookOpen,
  Clapperboard,
  Radio,
  UsersRound,
  Settings2,
  ShieldCheck,
  LogOut,
  PanelLeftClose,
  X,
} from "lucide-react";
import type { Estado } from "@/servicios/datos";
import { Logo } from "@/marca/Logo";
import { esperaAprobacion } from "@/lib/etapas";
export async function api<T = unknown>(
  path: string,
  data?: unknown,
  method = "POST",
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    signal: AbortSignal.timeout(15000),
    headers:
      data === undefined ? undefined : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const value = await response.json();
  if (!response.ok)
    throw new Error(value.error ?? "No se pudo completar la solicitud.");
  return value as T;
}
const Context = createContext<{
  data: Estado;
  refresh: () => Promise<void>;
  connected: boolean;
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
  { path: "/canales", label: "Canales", icon: Radio },
  { path: "/radar", label: "Operación", icon: Settings2 },
  { path: "/videos", label: "Videos", icon: Clapperboard },
  { path: "/publicados", label: "Publicados", icon: ChartNoAxesCombined },
  { path: "/aprendizaje", label: "Aprendizaje", icon: BookOpen },
  { path: "/avatares", label: "Avatares y voces", icon: UsersRound },
];
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
    [connected, setConnected] = useState(false),
    [menu, setMenu] = useState(false);
  const path = usePathname();
  const reduced = useMovimientoReducido();
  const [isPaused, setPaused] = usePausaMovimiento();
  const [celebration, setCelebration] = useState<string | null>(null);
  const previousVideos = useRef(initial.videos);
  const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const receive = useCallback((next: Estado) => {
    const published = next.videos.find(
      (v) =>
        v.stage === 11 &&
        previousVideos.current.some((p) => p.id === v.id && p.stage < 11),
    );
    previousVideos.current = next.videos;
    setData(next);
    if (published) {
      setCelebration(published.title);
      if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
      celebrationTimer.current = setTimeout(() => setCelebration(null), 9000);
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
  const sidebar = useRef<HTMLElement>(null);
  const refresh = useCallback(async () => {
    receive(await api<Estado>("estado", undefined, "GET"));
  }, [receive]);
  useEffect(() => {
    let source: EventSource | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let attempts = 0;
    const controller = new AbortController();
    const connect = () => {
      if (stopped || !navigator.onLine) return;
      if (timer) clearTimeout(timer);
      source?.close();
      source = new EventSource("/api/eventos");
      const retry = () => {
        if (stopped) return;
        source?.close();
        setConnected(false);
        if (timer) clearTimeout(timer);
        timer = setTimeout(connect, Math.min(1000 * 2 ** attempts++, 30000));
        void fetch("/api/estado", { signal: controller.signal })
          .then((response) => {
            if (!stopped && [401, 403].includes(response.status)) {
              stopped = true;
              clearTimeout(timer);
              window.location.assign("/entrar");
            }
          })
          .catch(() => {});
      };
      source.addEventListener("estado", (event) => {
        try {
          receive(JSON.parse(event.data));
          setConnected(true);
          attempts = 0;
        } catch {
          retry();
        }
      });
      source.addEventListener("fallo", () => setConnected(false));
      source.onerror = retry;
    };
    const offline = () => {
      source?.close();
      clearTimeout(timer);
      setConnected(false);
    };
    connect();
    window.addEventListener("offline", offline);
    window.addEventListener("online", connect);
    return () => {
      stopped = true;
      source?.close();
      clearTimeout(timer);
      controller.abort();
      window.removeEventListener("online", connect);
      window.removeEventListener("offline", offline);
    };
  }, [receive]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () =>
      (document.documentElement.dataset.theme =
        data.user.theme === "sistema"
          ? media.matches
            ? "claro"
            : "oscuro"
          : data.user.theme);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [data.user.theme]);
  useEffect(() => {
    if (!menu || !window.matchMedia("(max-width: 767px)").matches) return;
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
    const media = window.matchMedia("(max-width: 767px)");
    const resize = () => {
      if (!media.matches) setMenu(false);
    };
    media.addEventListener("change", resize);
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    return () => {
      media.removeEventListener("change", resize);
      document.body.style.overflow = before;
      window.removeEventListener("keydown", close);
      opener?.focus();
    };
  }, [menu]);
  const pending = data.videos.filter(
    (v) => v.productionState === "activa" && esperaAprobacion(v.stage),
  ).length;
  return (
    <Context.Provider value={{ data, refresh, connected }}>
      <MotionConfig
        reducedMotion={isPaused || hidden || reduced ? "always" : "user"}
      >
        <LazyMotion features={cargarMovimiento} strict>
          <LayoutGroup id="estudio">
            <div
              className="workspace"
              data-motion={isPaused || hidden || reduced ? "paused" : "playing"}
            >
              <a className="skip" href="#contenido">
                Saltar al contenido
              </a>
              <aside
                ref={sidebar}
                role={menu ? "dialog" : undefined}
                aria-modal={menu || undefined}
                aria-label="Navegación del estudio"
                id="navegacion"
                className={`sidebar ${menu ? "is-open" : ""}`}
              >
                <div className="sidebar-content">
                  <Link href="/" className="brand" aria-label="Cooper, inicio">
                    <Logo />
                    <span>
                      cooper<span className="brand-dot">.</span>
                    </span>
                  </Link>
                  <button
                    className="icon-button drawer-close"
                    aria-label="Cerrar navegación"
                    onClick={() => setMenu(false)}
                  >
                    <X size={20} />
                  </button>
                  <div className="workspace-label">Tu espacio de creación</div>
                  <nav aria-label="Principal">
                    {nav.map(({ path: href, label, icon: Icon }) => (
                      <Link
                        onClick={() => setMenu(false)}
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
                          <Indicador
                            id="navegacion"
                            className="nav-indicator"
                          />
                        )}
                        <Icon size={19} />
                        <span>{label}</span>
                        {href === "/videos" && pending > 0 && (
                          <span className="nav-count">{pending}</span>
                        )}
                      </Link>
                    ))}
                  </nav>
                  <div className="sidebar-note">
                    <p>En tu estudio</p>
                    <Link href="/videos">
                      <strong>
                        <NumeroAnimado
                          value={data.videos.filter((v) => v.stage < 11).length}
                        />
                      </strong>{" "}
                      videos en producción
                    </Link>
                    <Link href="/videos">
                      <strong>
                        <NumeroAnimado value={pending} />
                      </strong>{" "}
                      por aprobar
                    </Link>
                    <div className="sidebar-summary-track" aria-hidden="true">
                      {Array.from({ length: 12 }, (_, i) => (
                        <i
                          key={i}
                          className={
                            data.videos.some((v) => v.stage === i)
                              ? "occupied"
                              : ""
                          }
                        />
                      ))}
                    </div>
                  </div>
                  <nav className="bottom-nav" aria-label="Cuenta">
                    {data.user.role === "admin" && (
                      <Link
                        onClick={() => setMenu(false)}
                        href="/admin"
                        aria-current={path === "/admin" ? "page" : undefined}
                      >
                        {path === "/admin" && (
                          <Indicador
                            id="navegacion"
                            className="nav-indicator"
                          />
                        )}
                        <ShieldCheck size={18} />
                        Administración
                      </Link>
                    )}
                    <Link
                      onClick={() => setMenu(false)}
                      href="/perfil"
                      aria-current={path === "/perfil" ? "page" : undefined}
                    >
                      {path === "/perfil" && (
                        <Indicador id="navegacion" className="nav-indicator" />
                      )}
                      <Settings2 size={18} />
                      Mi perfil
                    </Link>
                    <form action={logout}>
                      <button className="nav-button">
                        <LogOut size={18} />
                        Cerrar sesión
                      </button>
                    </form>
                  </nav>
                  <div className="identity">
                    {data.user.image ? (
                      <Image
                        unoptimized
                        src={data.user.image}
                        width={36}
                        height={36}
                        alt=""
                      />
                    ) : (
                      <span className="initial">
                        {data.user.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div>
                      <strong>{data.user.name}</strong>
                      <small>
                        {data.user.role === "admin"
                          ? "Administrador"
                          : "Equipo Cooper"}
                      </small>
                    </div>
                  </div>
                </div>
              </aside>
              {menu && (
                <button
                  className="drawer-backdrop"
                  aria-label="Cerrar menú"
                  tabIndex={-1}
                  onClick={() => setMenu(false)}
                />
              )}
              <div className="main-column" inert={menu}>
                <header className="topbar">
                  <button
                    ref={menuButton}
                    className="icon-button menu-button"
                    aria-label="Abrir navegación"
                    aria-controls="navegacion"
                    aria-expanded={menu}
                    onClick={() => setMenu(!menu)}
                  >
                    <PanelLeftClose size={20} />
                  </button>
                  <span>Estudio Cooper</span>
                  <div className="topbar-right">
                    <span className={`connection ${connected ? "online" : ""}`}>
                      <i />
                      {connected ? "En vivo" : "Reconectando"}
                    </span>
                    <button
                      className="motion-toggle"
                      aria-pressed={isPaused}
                      onClick={() => setPaused(!isPaused)}
                    >
                      {isPaused ? "Activar movimiento" : "Pausar movimiento"}
                    </button>
                    <span className="demo-label">
                      {data.demo ? "Demostración" : "Modo de prueba"}
                    </span>
                  </div>
                </header>
                <main id="contenido" tabIndex={-1}>
                  <div key={path} className="route-choreography">
                    {children}
                  </div>
                  {celebration && (
                    <CelebracionPublicacion
                      title={celebration}
                      cerrar={() => setCelebration(null)}
                    />
                  )}
                </main>
              </div>
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
      <EscenaEstudio />
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
      <IlustracionViva nombre="cooper-recibe" className="empty-companion" />
      <div className="empty-story" aria-hidden="true">
        <span>
          <i className="story-idea" />
          Tu idea
        </span>
        <span>
          <i className="story-script" />
          Un guion
        </span>
        <span>
          <i className="story-film" />
          Tu video
        </span>
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Notice({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  return error ? (
    <p className="notice error notice-enter" role="alert">
      {error}
    </p>
  ) : message ? (
    <p className="notice notice-enter" role="status">
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
