#!/usr/bin/env bash
# Solo VPS dedicado Ubuntu 24.04. No ejecutar en la PC de desarrollo.
set -euo pipefail
umask 077
action=${1:---preparar}
[[ $EUID -eq 0 ]] || { echo 'Ejecutar como root en el VPS dedicado'; exit 1; }
[[ $action == --preparar || $action == --iniciar ]] || exit 2
# shellcheck source=/dev/null
source /etc/os-release
[[ $ID == ubuntu && $VERSION_ID == 24.04 ]] || { echo 'Se requiere Ubuntu 24.04 LTS'; exit 1; }
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
[[ $root == /opt/cooper ]] || { echo 'Instalar el checkout revisado en /opt/cooper'; exit 1; }
if [[ $action == --iniciar ]]; then
  python3 "$root/deploy/operar.py" validar
  python3 "$root/deploy/operar.py" compose up -d --no-build --wait --wait-timeout 180
  "$root/deploy/copiar.sh"
  systemctl enable --now cooper-backup.timer
  exit 0
fi
: "${COOPER_SSH_USER:?Definir usuario SSH no root con llave instalada}"
[[ $COOPER_SSH_USER =~ ^[a-z_][a-z0-9_-]*$ && $COOPER_SSH_USER != root ]] || exit 2
user_dir=$(getent passwd "$COOPER_SSH_USER" | cut -d: -f6)
[[ -s $user_dir/.ssh/authorized_keys ]] || { echo 'Instalar primero la llave SSH del operador'; exit 1; }
[[ " $(id -nG "$COOPER_SSH_USER") " == *' sudo '* ]] || { echo 'Operador debe pertenecer al grupo sudo'; exit 1; }
ssh_port=${COOPER_SSH_PORT:-22}
[[ $ssh_port =~ ^[0-9]+$ && $ssh_port -gt 0 && $ssh_port -lt 65536 ]] || exit 2
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl ufw fail2ban unattended-upgrades python3 restic openssh-client
install -d -m 0755 /etc/apt/keyrings
if [[ ! -s /etc/apt/keyrings/docker.asc ]]; then
  curl --fail --silent --show-error --location https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
fi
chmod 0644 /etc/apt/keyrings/docker.asc
arch=$(dpkg --print-architecture)
cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: noble
Components: stable
Architectures: $arch
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
install -d -m 0700 /etc/cooper /var/lib/cooper /var/lib/cooper-operacion
for name in cooper n8n caddy-data caddy-config; do
  install -d -m 0700 -o 1000 -g 1000 "/var/lib/cooper/$name"
done
if [[ ! -e /etc/cooper/.env ]]; then
  install -m 0600 "$root/deploy/.env.example" /etc/cooper/.env
fi
chmod 0600 /etc/cooper/.env
ufw default deny incoming
ufw default allow outgoing
ufw allow "$ssh_port/tcp"
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
# Docker publica mediante NAT; UFW por sí solo no filtra esos puertos.
install -m 0755 "$root/deploy/firewall-docker.sh" /usr/local/sbin/cooper-firewall-docker
install -m 0644 "$root/deploy/systemd/cooper-firewall.service" /etc/systemd/system/
install -d -m 0755 /etc/systemd/system/docker.service.d
cat > /etc/systemd/system/docker.service.d/cooper-firewall.conf <<'EOF'
[Service]
ExecStartPost=/usr/local/sbin/cooper-firewall-docker
EOF
cat > /etc/fail2ban/jail.d/cooper.local <<EOF
[sshd]
enabled = true
backend = systemd
port = $ssh_port
maxretry = 5
findtime = 10m
bantime = 1h
banaction = ufw
EOF
cat > /etc/ssh/sshd_config.d/00-cooper.conf <<EOF
Port $ssh_port
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
X11Forwarding no
AllowTcpForwarding local
EOF
sshd -t
systemctl reload ssh
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
cat > /etc/apt/apt.conf.d/52cooper-security <<'EOF'
Unattended-Upgrade::Allowed-Origins {
  "${distro_id}:${distro_codename}-security";
  "${distro_id}ESMApps:${distro_codename}-apps-security";
  "${distro_id}ESM:${distro_codename}-infra-security";
};
Unattended-Upgrade::Automatic-Reboot "false";
EOF
install -m 0644 "$root/deploy/systemd/cooper-backup.service" /etc/systemd/system/
install -m 0644 "$root/deploy/systemd/cooper-backup.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now cooper-firewall.service fail2ban unattended-upgrades
echo 'Preparado. Completar /etc/cooper/.env y restic, construir imagen y ejecutar --iniciar. No se inició Cooper ni n8n.'
