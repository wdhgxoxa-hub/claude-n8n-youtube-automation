"""Sondeo probado sin SSH ni DNS reales."""
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("esperar", Path(__file__).parents[1] / "esperar-vps.py")
wait = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wait)


class EsperaTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.ip = Path(tmp.name) / "vps-ip"
        self.key = Path(tmp.name) / "cooper_vps"

    def test_no_conecta_sin_ip_o_con_ip_no_publica(self):
        with patch.object(wait.subprocess, "run") as run:
            self.assertEqual(wait.comprobar(self.ip, self.key), "falta-ip")
            for value in ("127.0.0.1", "10.0.0.5", "::1", "192.0.2.1"):
                self.ip.write_text(value)
                self.assertEqual(wait.comprobar(self.ip, self.key), "requiere-ipv4-publica")
            self.ip.write_text("1.1.1.1; touch /tmp/no-ejecutar")
            self.assertEqual(wait.comprobar(self.ip, self.key), "ip-invalida")
            run.assert_not_called()

    def test_exige_llave_y_host_conocido_antes_de_dns(self):
        self.ip.write_text("1.1.1.1")
        with patch.object(wait.subprocess, "run", return_value=subprocess.CompletedProcess([], 255)) as run:
            self.assertEqual(wait.comprobar(self.ip, self.key), "esperando-ssh")
            self.assertEqual(run.call_count, 1)
            cmd = run.call_args.args[0]
            self.assertIn("StrictHostKeyChecking=yes", cmd)
            self.assertIn("BatchMode=yes", cmd)
            self.assertIn("IdentitiesOnly=yes", cmd)
            self.assertEqual(cmd[-1], "true")

    def test_dns_ajeno_o_mixto_impide_continuar(self):
        self.ip.write_text("1.1.1.1")
        for dns in ("", "8.8.8.8 STREAM\n", "1.1.1.1 STREAM\n8.8.8.8 STREAM\n"):
            with patch.object(wait.subprocess, "run", side_effect=[
                subprocess.CompletedProcess([], 0), subprocess.CompletedProcess([], 0, stdout=dns),
            ]):
                self.assertEqual(wait.comprobar(self.ip, self.key), "esperando-dns")

    def test_completa_solo_con_ssh_y_dns_correctos(self):
        self.ip.write_text("1.1.1.1\n")
        with patch.object(wait.subprocess, "run", side_effect=[
            subprocess.CompletedProcess([], 0),
            subprocess.CompletedProcess([], 0, stdout="1.1.1.1 STREAM\n1.1.1.1 DGRAM\n"),
        ]):
            self.assertEqual(wait.comprobar(self.ip, self.key), "listo")

    def test_timeout_no_aborta_la_espera(self):
        self.ip.write_text("1.1.1.1")
        with patch.object(wait.subprocess, "run", side_effect=subprocess.TimeoutExpired("ssh", 15)):
            self.assertEqual(wait.comprobar(self.ip, self.key), "esperando-conexion")
