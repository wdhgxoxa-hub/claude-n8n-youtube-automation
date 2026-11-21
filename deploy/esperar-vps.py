#!/usr/bin/env python3
"""Espera IP pública, llave ya autorizada y DNS; no instala ni cambia servicios."""
import argparse
import ipaddress
import json
import os
from pathlib import Path
import subprocess
import time


def comprobar(ip_file, key):
    if not ip_file.is_file() or ip_file.is_symlink():
        return "falta-ip"
    try:
        address = ipaddress.ip_address(ip_file.read_text().strip())
    except ValueError:
        return "ip-invalida"
    if address.version != 4 or not address.is_global:
        return "requiere-ipv4-publica"
    try:
        ssh = subprocess.run([
            "ssh", "-i", str(key), "-o", "BatchMode=yes",
            "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=yes",
            "-o", "ConnectTimeout=10", f"root@{address}", "true",
        ], capture_output=True, timeout=15, check=False)
        if ssh.returncode:
            return "esperando-ssh"
        dns = subprocess.run(["getent", "ahostsv4", "cooper.cooperestudio.com"],
                             capture_output=True, text=True, timeout=15, check=False)
        ips = {line.split()[0] for line in dns.stdout.splitlines() if line.split()}
        return "listo" if ips == {str(address)} else "esperando-dns"
    except (OSError, subprocess.TimeoutExpired):
        return "esperando-conexion"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--horas", type=float, default=8)
    parser.add_argument("--intervalo", type=float, default=120)
    args = parser.parse_args()
    if not 0 < args.horas <= 8 or not 0 < args.intervalo <= 120:
        parser.error("Usar hasta 8 horas e intervalos de hasta 120 segundos")
    os.umask(0o077)
    config = Path.home() / ".config/cooper"
    cache = Path.home() / ".cache/cooper-vps"
    cache.mkdir(parents=True, exist_ok=True, mode=0o700)
    start = time.time()
    deadline = time.monotonic() + args.horas * 3600
    attempt = 0
    while True:
        attempt += 1
        state = comprobar(config / "vps-ip", Path.home() / ".ssh/cooper_vps")
        exhausted = time.monotonic() >= deadline
        result = {"inicio": start, "fecha": time.time(), "intento": attempt,
                  "estado": state, "agotado": exhausted, "intervalo": args.intervalo}
        tmp = cache / "espera.tmp"
        tmp.write_text(json.dumps(result) + "\n")
        tmp.chmod(0o600)
        tmp.replace(cache / "espera.json")
        print(json.dumps(result), flush=True)
        if state == "listo":
            return 0
        if exhausted:
            return 2
        time.sleep(min(args.intervalo, max(0, deadline - time.monotonic())))


if __name__ == "__main__":
    raise SystemExit(main())
