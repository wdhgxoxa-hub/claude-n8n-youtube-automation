"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { MotionConfig, motion } from "framer-motion";
import {
  House,
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
const nav = [
  { path: "/", label: "Inicio", icon: House },
  { path: "/canales", label: "Canales", icon: Radio },
  { path: "/videos", label: "Videos", icon: Clapperboard },
  { path: "/avatares", label: "Avatares y voces", icon: UsersRound },
];
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
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const refresh = useCallback(async () => {
    setData(await api<Estado>("estado", undefined, "GET"));
  }, []);
  useEffect(() => {
    let source: EventSource | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let attempts = 0;
    const controller = new AbortController();
    const connect = () => {
      if (stopped) return;
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
          setData(JSON.parse(event.data));
          setConnected(true);
          attempts = 0;
        } catch {
          retry();
        }
      });
      source.addEventListener("fallo", () => setConnected(false));
      source.onerror = retry;
    };
    connect();
    window.addEventListener("online", connect);
    return () => {
      stopped = true;
      source?.close();
      clearTimeout(timer);
      controller.abort();
      window.removeEventListener("online", connect);
    };
  }, []);
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
  const pending = data.videos.filter((v) => esperaAprobacion(v.stage)).length;
  return (
    <Context.Provider value={{ data, refresh, connected }}>
      <MotionConfig reducedMotion="user">
        <div className="workspace">
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
                  <Icon size={19} />
                  <span>{label}</span>
                  {href === "/videos" && pending > 0 && (
                    <span className="nav-count">{pending}</span>
                  )}
                </Link>
              ))}
            </nav>
            <div className="sidebar-note">
              <span className="small-orbit" />
              <p>
                Las buenas ideas
                <br />
                merecen salir al mundo.
              </p>
            </div>
            <nav className="bottom-nav" aria-label="Cuenta">
              {data.user.role === "admin" && (
                <Link
                  onClick={() => setMenu(false)}
                  href="/admin"
                  aria-current={path === "/admin" ? "page" : undefined}
                >
                  <ShieldCheck size={18} />
                  Administración
                </Link>
              )}
              <Link
                onClick={() => setMenu(false)}
                href="/perfil"
                aria-current={path === "/perfil" ? "page" : undefined}
              >
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
                <span className="demo-label">Modo de prueba</span>
              </div>
            </header>
            <main id="contenido" tabIndex={-1}>
              <motion.div
                key={path}
                initial={{ y: 4 }}
                animate={{ y: 0 }}
                transition={{ duration: 0.22 }}
              >
                {children}
              </motion.div>
            </main>
          </div>
        </div>
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
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
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
      <svg viewBox="0 0 120 80" width="120" height="80" aria-hidden="true">
        <rect
          x="20"
          y="12"
          width="64"
          height="48"
          rx="8"
          fill="none"
          stroke="currentColor"
        />
        <path
          d="m84 28 18-8v32L84 44M38 70h48M49 29l19 9-19 10Z"
          fill="none"
          stroke="currentColor"
        />
      </svg>
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
    <p className="notice error" role="alert">
      {error}
    </p>
  ) : message ? (
    <p className="notice" role="status">
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
      <div className="skeleton wide" />
      <div className="skeleton" />
      <div className="skeleton tall" />
    </div>
  );
}
