'use client';
import { createContext,useContext,useEffect,useState,useCallback,type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { MotionConfig,motion } from 'framer-motion';
import { House,Clapperboard,Radio,UsersRound,Settings2,ShieldCheck,LogOut,PanelLeftClose } from 'lucide-react';
import type { Estado } from '@/servicios/datos';
import { Logo } from '@/marca/Logo';
import { esperaAprobacion } from '@/lib/etapas';
export async function api<T=unknown>(path:string,data?:unknown,method='POST'):Promise<T> {
 const response=await fetch(`/api/${path}`,{method,headers:data===undefined?undefined:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
 const value=await response.json(); if(!response.ok) throw new Error(value.error??'No se pudo completar la solicitud.'); return value as T;
}
const Context=createContext<{data:Estado;refresh:()=>Promise<void>;connected:boolean}|null>(null);
export function useEspacio(){const value=useContext(Context);if(!value)throw new Error('Espacio no disponible');return value;}
const nav=[{path:'/',label:'Inicio',icon:House},{path:'/canales',label:'Canales',icon:Radio},{path:'/videos',label:'Videos',icon:Clapperboard},{path:'/avatares',label:'Avatares y voces',icon:UsersRound}];
export function Espacio({initial,children,logout}:{initial:Estado;children:ReactNode;logout:()=>Promise<void>}) {
 const [data,setData]=useState(initial),[connected,setConnected]=useState(false),[menu,setMenu]=useState(false);const path=usePathname();
 const refresh=useCallback(async()=>{setData(await api<Estado>('estado',undefined,'GET'));},[]);
 useEffect(()=>{const source=new EventSource('/api/eventos'); source.addEventListener('estado',e=>{setData(JSON.parse(e.data));setConnected(true);});source.addEventListener('fallo',()=>setConnected(false));source.onerror=()=>setConnected(false);return()=>source.close();},[]);
 useEffect(()=>{const media=window.matchMedia('(prefers-color-scheme: light)');const apply=()=>document.documentElement.dataset.theme=data.user.theme==='sistema'?(media.matches?'claro':'oscuro'):data.user.theme;apply();media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply);},[data.user.theme]);
 useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenu(false);};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[]);
 const pending=data.videos.filter(v=>esperaAprobacion(v.stage)).length;
 return <Context.Provider value={{data,refresh,connected}}><MotionConfig reducedMotion="user"><div className="workspace">
  <a className="skip" href="#contenido">Saltar al contenido</a>
  <aside id="navegacion" className={`sidebar ${menu?'is-open':''}`}><Link href="/" className="brand" aria-label="Cooper, inicio"><Logo/><span>cooper<span className="brand-dot">.</span></span></Link><div className="workspace-label">Tu espacio de creación</div>
   <nav aria-label="Principal">{nav.map(({path:href,label,icon:Icon})=><Link onClick={()=>setMenu(false)} key={href} href={href} aria-current={(href==='/'?path==='/':path.startsWith(href))?'page':undefined}><Icon size={19}/><span>{label}</span>{href==='/videos'&&pending>0&&<span className="nav-count">{pending}</span>}</Link>)}</nav>
   <div className="sidebar-note"><span className="small-orbit"/><p>Las buenas ideas<br/>merecen salir al mundo.</p></div>
   <nav className="bottom-nav" aria-label="Cuenta">{data.user.role==='admin'&&<Link onClick={()=>setMenu(false)} href="/admin" aria-current={path==='/admin'?'page':undefined}><ShieldCheck size={18}/>Administración</Link>}<Link onClick={()=>setMenu(false)} href="/perfil" aria-current={path==='/perfil'?'page':undefined}><Settings2 size={18}/>Mi perfil</Link><form action={logout}><button className="nav-button"><LogOut size={18}/>Cerrar sesión</button></form></nav>
   <div className="identity">{data.user.image?<Image unoptimized src={data.user.image} width={36} height={36} alt=""/>:<span className="initial">{data.user.name.slice(0,1).toUpperCase()}</span>}<div><strong>{data.user.name}</strong><small>{data.user.role==='admin'?'Administrador':'Equipo Cooper'}</small></div></div>
  </aside>
  <div className="main-column"><header className="topbar"><button className="icon-button menu-button" aria-label={menu?"Cerrar navegación":"Abrir navegación"} aria-controls="navegacion" aria-expanded={menu} onClick={()=>setMenu(!menu)}><PanelLeftClose size={20}/></button><span>Estudio Cooper</span><div className="topbar-right"><span className={`connection ${connected?'online':''}`}><i/>{connected?'En vivo':'Reconectando'}</span><span className="demo-label">Modo de prueba</span></div></header><main id="contenido" tabIndex={-1}><motion.div key={path} initial={{opacity:0}} animate={{opacity:1}} transition={{duration:.22}}>{children}</motion.div></main></div>
 </div></MotionConfig></Context.Provider>;
}
export function Heading({title,description,action}:{title:string;description:string;action?:ReactNode}) {return <div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div>{action}</div>;}
export function Empty({title,description,children}:{title:string;description:string;children?:ReactNode}) {return <div className="empty"><svg viewBox="0 0 120 80" width="120" height="80" aria-hidden="true"><rect x="20" y="12" width="64" height="48" rx="8" fill="none" stroke="currentColor"/><path d="m84 28 18-8v32L84 44M38 70h48M49 29l19 9-19 10Z" fill="none" stroke="currentColor"/></svg><h2>{title}</h2><p>{description}</p>{children}</div>;}
export function Notice({error,message}:{error?:string;message?:string}) {return error?<p className="notice error" role="alert">{error}</p>:message?<p className="notice" role="status">{message}</p>:null;}
export function Skeleton(){return <div className="skeleton-group" role="status" aria-label="Cargando contenido"><div className="skeleton wide"/><div className="skeleton"/><div className="skeleton tall"/></div>;}
