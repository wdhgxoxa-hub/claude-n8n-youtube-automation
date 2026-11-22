import styles from "./portada-video.module.css";

/** Cartela editorial de espera; nunca simula un fotograma de producción. */
export function Portada({ title }: { title: string }) {
  return (
    <span
      className={styles.cartela}
      aria-hidden="true"
      data-poster="tipografico"
    >
      <span className={styles.cartelaTitulo}>{title}</span>
    </span>
  );
}
