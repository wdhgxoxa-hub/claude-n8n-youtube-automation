#!/usr/bin/env python3
"""Operación local explícita. Nunca muestra entornos, SQL, filas ni salida de terceros."""
import argparse
import contextlib
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import stat
import subprocess
import sys
import tempfile
import time

DEPLOY = Path(__file__).resolve().parent
VOLUMENES = ("cooper", "n8n", "caddy-data", "caddy-config")


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def private_file(path):
    path = Path(path)
    require(not path.is_symlink() and path.is_file(), "Falta archivo privado regular")
    require(stat.S_IMODE(path.stat().st_mode) == 0o600, "Archivo privado requiere modo 0600")
    require(path.stat().st_uid == os.geteuid(), "Archivo privado debe pertenecer al operador")
    return path


def config(path):
    path = private_file(path).resolve()
    require(not path.is_relative_to(DEPLOY.parent) or os.getenv("COOPER_LAB") == "1",
            "El entorno de producción debe estar fuera del checkout")
    env = dict(os.environ)
    for line in path.read_text().splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        name, sep, value = line.partition("=")
        require(sep and re.fullmatch(r"[A-Z][A-Z0-9_]*", name), "Formato .env inválido")
        require(not any(c in value for c in "\n\r\x00"), "Valor de entorno inválido")
        env[name] = value  # Sin source, eval, expansión ni interpolación de comandos.
    for name in ("AUTH_SECRET", "COOPER_N8N_TOKEN", "COOPER_WEBHOOK_SECRET",
                 "N8N_ENCRYPTION_KEY", "N8N_RUNNERS_AUTH_TOKEN"):
        require(len(env.get(name, "")) >= 32, f"Configurar {name} (mínimo 32 caracteres)")
    for name in ("DATA_ROOT", "STATE_ROOT"):
        p = Path(env.get(name, ""))
        require(p.is_absolute() and str(p) != "/" and not p.is_symlink(), f"Revisar {name}")
    data, state = Path(env["DATA_ROOT"]).resolve(), Path(env["STATE_ROOT"]).resolve()
    require(not state.is_relative_to(data) and not data.is_relative_to(state),
            "Datos y estado operativo deben estar separados")
    return env, path


def run(args, env=None, cwd=None):
    result = subprocess.run(args, env=env, cwd=cwd, capture_output=True, text=True)
    if result.returncode and env and env.get("COOPER_LAB") == "1" and env.get("STATE_ROOT"):
        diagnostic = Path(env["STATE_ROOT"]) / "ultimo-error-laboratorio.log"
        diagnostic.write_text(result.stderr)
        diagnostic.chmod(0o600)
    operation = args[1] if len(args) > 1 and re.fullmatch(r"[a-z-]+", args[1]) else "operación"
    require(result.returncode == 0, f"Falló {Path(args[0]).name} {operation}; código {result.returncode}; salida reservada para proteger secretos")
    return result.stdout


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def manifest(root):
    """Cuenta todas las tablas sin leer sus filas; huellas solo en archivo privado."""
    root = Path(root)
    require((root / "cooper/cooper.sqlite").is_file(), "Falta SQLite de Cooper")
    require((root / "n8n/database.sqlite").is_file(), "Falta SQLite de n8n")
    counts = {}
    for path in sorted(root.rglob("*")):
        require(not path.is_symlink(), "No se admiten enlaces simbólicos en datos")
        if path.is_file() and path.suffix == ".sqlite":
            with contextlib.closing(sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)) as db:
                require(db.execute("PRAGMA integrity_check").fetchall() == [("ok",)],
                        "SQLite no supera integrity_check")
                tables = db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()
                counts[str(path.relative_to(root))] = {
                    name: db.execute('SELECT count(*) FROM "' + name.replace('"', '""') + '"').fetchone()[0]
                    for (name,) in tables
                }
    files = {}
    for path in sorted(root.rglob("*")):
        if path.is_file() and not path.name.endswith("-shm") and path.name != "manifiesto.json":
            files[str(path.relative_to(root))] = {"sha256": digest(path), "bytes": path.stat().st_size}
    return {"version": 1, "archivos": files, "tablas": counts}


def write_json(path, value):
    path = Path(path)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
    tmp.chmod(0o600)
    tmp.replace(path)


def verify(root):
    expected = json.loads((Path(root) / "manifiesto.json").read_text())
    require(manifest(root) == expected, "Restauración rechazada: conteos o hashes diferentes")
    return expected


def copy_data(source, target):
    source, target = Path(source).resolve(), Path(target).resolve()
    require(not target.is_relative_to(source), "La copia debe quedar fuera de los datos")
    before = manifest(source)
    target.mkdir(mode=0o700, parents=True, exist_ok=True)
    require(not any(target.iterdir()), "Destino de copia debe estar vacío")
    for name in VOLUMENES:
        if (source / name).exists():
            shutil.copytree(source / name, target / name,
                            ignore=shutil.ignore_patterns("*-shm"), symlinks=True)
    require(manifest(source) == before, "El origen cambió durante la copia; detener escritores")
    require(manifest(target) == before, "La copia no coincide con el origen")
    write_json(target / "manifiesto.json", before)


class Operator:
    def __init__(self, env, env_file):
        self.env, self.env_file = env, env_file
        self.data = Path(env["DATA_ROOT"])
        self.state = Path(env["STATE_ROOT"])
        self.state.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.release = self.state / "release.json"
        self.engine = env.get("CONTAINER_ENGINE", "docker")
        require(self.engine in ("docker", "podman"), "Motor no admitido")

    @contextlib.contextmanager
    def lock(self):
        with (self.state / "operacion.lock").open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            yield

    def compose(self, *args, image=None):
        env = dict(self.env)
        if self.release.exists():
            env["COOPER_IMAGE"] = json.loads(self.release.read_text())["image"]
        if image:
            env["COOPER_IMAGE"] = image
        cmd = ["docker", "compose", "--env-file", str(self.env_file), "-f", str(DEPLOY / "compose.yaml")]
        if env.get("COOPER_LAB") == "1" and env.get("COOPER_COMPOSE_OVERRIDE"):
            cmd += ["-f", env["COOPER_COMPOSE_OVERRIDE"]]
        return run(cmd + list(args), env=env)

    def restic(self, *args, cwd=None):
        private_file(self.env["RESTIC_PASSWORD_FILE"])
        return run([self.env.get("RESTIC_BIN", "restic"), "--no-cache", *args], env=self.env, cwd=cwd)

    def restore(self, snapshot, destination):
        require(re.fullmatch(r"[0-9a-f]{8,64}", snapshot), "Usar ID explícito de snapshot")
        destination = Path(destination).resolve()
        require(not destination.exists(), "La restauración exige un destino nuevo")
        self.restic("restore", snapshot, "--target", str(destination))
        result = destination / "datos"
        verify(result)
        return result

    def snapshot(self, source=None, resume=True, tag=None):
        # Ingresos cerrados, luego productores y escritores; no se copian SQLite en marcha.
        managed = source is None
        running = self.compose("ps", "--status", "running", "--services").split() if managed else []
        with tempfile.TemporaryDirectory(prefix="copia-", dir=self.state) as tmp:
            stage = Path(tmp) / "datos"
            try:
                if managed:
                    # n8n drena con runner y callback Cooper aún disponibles.
                    for service in ("caddy", "n8n", "runner", "cooper"):
                        self.compose("stop", service)
                    require(not self.compose("ps", "--status", "running", "--services").strip(),
                            "Quedan escritores en ejecución")
                copy_data(source or self.data, stage)
            finally:
                if managed and resume and running:
                    self.compose("start", *running)
            extra = ["--tag", tag] if tag else []
            output = self.restic("backup", "datos", "--host", "cooper-vps", "--tag", "cooper-vps",
                                 *extra, "--json", cwd=tmp)
            rows = [json.loads(line) for line in output.splitlines()]
            snapshot = next(row["snapshot_id"] for row in rows if row.get("message_type") == "summary")
            self.restore(snapshot, Path(tmp) / "restaurado")
            self.restic("check", "--read-data")
            write_json(self.state / "ultima-copia.json", {"snapshot": snapshot, "fecha": int(time.time()),
                                                          "restauracion": "PASS"})
            return snapshot

    def backup(self):
        snapshot = self.snapshot()
        self.restic("forget", "--host", "cooper-vps", "--tag", "cooper-vps", "--group-by", "host,tags",
                    "--keep-daily", "7", "--keep-weekly", "5", "--keep-monthly", "12",
                    "--keep-tag", "reversion", "--keep-tag", "migracion", "--prune")
        self.restic("check")
        return snapshot

    def import_snapshot(self, snapshot):
        require(not self.compose("ps", "--status", "running", "--services").strip(),
                "Detener todo el compose antes de importar")
        if self.data.exists():
            for path in self.data.iterdir():
                require(path.name in VOLUMENES and path.is_dir() and not path.is_symlink()
                        and not any(path.iterdir()), "La importación exige DATA_ROOT vacío")
        with tempfile.TemporaryDirectory(prefix="importar-", dir=self.state) as tmp:
            restored = self.restore(snapshot, Path(tmp) / "restore")
            if self.data.exists():
                for path in self.data.iterdir():
                    path.rmdir()  # Solo directorios verificados vacíos, creados por instalar.sh.
            copy_data(restored, self.data)
        self.ownership()

    def ownership(self):
        # Una PC sin Caddy no tiene estos volúmenes; crearlos antes del bind mount.
        for name in VOLUMENES:
            (self.data / name).mkdir(mode=0o700, exist_ok=True)
        if os.geteuid() == 0:
            for path in self.data.rglob("*"):
                if path.name != "manifiesto.json":
                    os.chown(path, 1000, 1000, follow_symlinks=False)

    def update(self, image):
        require(re.fullmatch(r"[a-zA-Z0-9./:_-]+@sha256:[0-9a-f]{64}", image) or
                re.fullmatch(r"localhost/cooper:[0-9a-f]{40}", image), "Usar digest o etiqueta del commit completo")
        # Precarga antes de cerrar tráfico; nunca latest ni cambio implícito de n8n.
        old_id = self.compose("ps", "-q", "cooper").strip()
        require(old_id, "Cooper debe existir antes de actualizar")
        old_image = run([self.engine, "inspect", "--format", "{{.Image}}", old_id], env=self.env).strip()
        rollback_tag = f"localhost/cooper:reversion-{time.time_ns()}"
        run([self.engine, "tag", old_image, rollback_tag], env=self.env)
        if "@sha256:" in image:
            run([self.engine, "pull", image], env=self.env)
        run([self.engine, "image", "inspect", image, "--format", "{{.Id}}"], env=self.env)
        snapshot = self.snapshot(resume=False, tag="reversion")
        write_json(self.state / "anterior.json", {"image": rollback_tag, "snapshot": snapshot})
        write_json(self.release, {"image": image})
        try:
            self.compose("up", "-d", "--no-build", "--wait", "--wait-timeout", "180")
        except RuntimeError:
            self.compose("stop")
            raise RuntimeError("Actualización fallida; servicios detenidos. Ejecutar revertir.sh antes de reabrir tráfico") from None

    def rollback(self):
        previous = json.loads((self.state / "anterior.json").read_text())
        # Validar y restaurar primero a otro directorio; no sobrescribir datos actuales.
        restore_dir = self.state / f"reversion-{time.time_ns()}"
        restored = self.restore(previous["snapshot"], restore_dir)
        self.snapshot(resume=False)
        archived = self.data.with_name(self.data.name + f".antes-reversion-{time.time_ns()}")
        self.data.rename(archived)
        copy_data(restored, self.data)
        self.ownership()
        write_json(self.release, {"image": previous["image"]})
        self.compose("up", "-d", "--no-build", "--force-recreate", "--wait", "--wait-timeout", "180")


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env", default="/etc/cooper/.env")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("validar")
    sub.add_parser("iniciar-repositorio")
    sub.add_parser("copia")
    sub.add_parser("revertir")
    update = sub.add_parser("actualizar")
    update.add_argument("imagen")
    export = sub.add_parser("exportar")
    export.add_argument("--origen", required=True, type=Path)
    export.add_argument("--origen-detenido", required=True, action="store_true")
    imp = sub.add_parser("importar")
    imp.add_argument("snapshot")
    restore = sub.add_parser("restaurar-prueba")
    restore.add_argument("snapshot")
    restore.add_argument("destino", type=Path)
    compose = sub.add_parser("compose")
    compose.add_argument("args", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    env, env_file = config(args.env)
    op = Operator(env, env_file)
    with op.lock():
        if args.command == "validar":
            op.compose("config", "--quiet")
        elif args.command == "iniciar-repositorio":
            op.restic("init")  # Nunca inicializar automáticamente ante un fallo de red/clave.
        elif args.command == "copia":
            print("Snapshot verificado:", op.backup())
        elif args.command == "exportar":
            snapshot = op.snapshot(args.origen, tag="migracion")
            print("Snapshot exportado y restaurado:", snapshot)
        elif args.command == "importar":
            op.import_snapshot(args.snapshot)
        elif args.command == "restaurar-prueba":
            op.restore(args.snapshot, args.destino)
        elif args.command == "actualizar":
            op.update(args.imagen)
        elif args.command == "revertir":
            op.rollback()
        elif args.command == "compose":
            require(args.args and args.args[0] in ("up", "stop", "start", "down", "pull", "build", "ps"),
                    "Operación compose no permitida por el wrapper")
            op.compose(*args.args)
    print("PASS:", args.command)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError, ValueError, sqlite3.Error, KeyError, StopIteration) as exc:
        # Errores de librerías pueden incluir rutas o datos: mensaje fijo salvo errores propios.
        print(str(exc) if isinstance(exc, RuntimeError) else "Operación fallida; revisar configuración y disponibilidad", file=sys.stderr)
        sys.exit(1)
