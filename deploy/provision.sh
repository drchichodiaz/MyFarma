#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
# MyFarma — aprovisionamiento de un droplet Ubuntu 24.04 nuevo.
# Idempotente: se puede correr varias veces sin romper nada.
#
#   ssh root@IP 'bash -s' < deploy/provision.sh
#
# Deja: Docker + Compose, 2 GB de swap, firewall (22/80/443), SSH solo con llave,
# actualizaciones de seguridad automáticas, fail2ban y zona horaria de Panamá.
# ══════════════════════════════════════════════════════════════════════
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

step() { printf '\n▶ %s\n' "$1"; }

step "Esperando a que termine la configuración inicial del droplet"
cloud-init status --wait >/dev/null 2>&1 || true
# Espera hasta 10 min si otro proceso (actualizaciones automáticas) tiene apt bloqueado.
apt-get() { command apt-get -o DPkg::Lock::Timeout=600 "$@"; }

step "Paquetes base y actualizaciones"
apt-get update -q
apt-get upgrade -y -q
apt-get install -y -q ca-certificates curl gnupg ufw fail2ban unattended-upgrades

step "Docker (repositorio oficial)"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker
# Logs de contenedores acotados para que no llenen el disco.
cat > /etc/docker/daemon.json <<'JSON'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
JSON
systemctl restart docker

step "Swap de 2 GB (respaldo de memoria en un droplet de 2 GB)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
sysctl -w vm.swappiness=10 >/dev/null
echo 'vm.swappiness=10' > /etc/sysctl.d/99-swappiness.conf

step "Firewall: solo SSH, HTTP y HTTPS (incluye HTTP/3 por UDP)"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable
# Nota: los puertos que publica Docker saltan ufw. Por eso en producción solo Caddy
# publica puertos (80/443); Postgres y Redis quedan en la red interna de Docker.

step "SSH: solo con llave"
cat > /etc/ssh/sshd_config.d/99-myfarma.conf <<'CONF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
CONF
sshd -t && systemctl reload ssh

step "fail2ban (bloquea IPs que fuerzan SSH)"
cat > /etc/fail2ban/jail.d/sshd.local <<'CONF'
[sshd]
enabled = true
maxretry = 5
bantime = 1h
CONF
systemctl enable --now fail2ban
systemctl restart fail2ban

step "Actualizaciones de seguridad automáticas"
dpkg-reconfigure -f noninteractive unattended-upgrades

step "Zona horaria y carpeta de la app"
timedatectl set-timezone America/Panama
mkdir -p /opt/myfarma

step "Listo"
docker --version
docker compose version
free -h | head -3
ufw status | head -8
