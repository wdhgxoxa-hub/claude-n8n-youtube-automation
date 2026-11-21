export function rutaBase(path: string, demo: boolean) {
  return demo ? `${path}.demo` : path;
}
