import type { Metadata } from 'next';
import '@fontsource-variable/manrope';
import './globals.css';
export const metadata:Metadata={title:{default:'Cooper · Tu estudio de creación',template:'%s · Cooper'},description:'De una idea a tu próximo video. Tu espacio de creación con Cooper.',robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es" data-theme="oscuro"><body>{children}</body></html>;}
