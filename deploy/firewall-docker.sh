#!/usr/bin/env bash
set -euo pipefail
external=$(ip -4 route show default | awk 'NR==1 {print $5}')
[[ -n $external ]] || { echo 'No se encontró interfaz externa'; exit 1; }
# Cadena propia: ejecución repetible; nunca vaciar reglas del operador.
for command in iptables ip6tables; do
  if ! "$command" -w -S DOCKER-USER >/dev/null 2>&1; then
    [[ $command == ip6tables ]] && continue
    echo 'Docker debe usar backend iptables con DOCKER-USER'; exit 1
  fi
  "$command" -w -N COOPER-INGRESS 2>/dev/null || true
  "$command" -w -C DOCKER-USER -i "$external" -j COOPER-INGRESS 2>/dev/null ||
    "$command" -w -I DOCKER-USER 1 -i "$external" -j COOPER-INGRESS
  # Agregar cada regla solo si falta, conservando orden y conexiones establecidas.
  "$command" -w -C COOPER-INGRESS -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN 2>/dev/null ||
    "$command" -w -A COOPER-INGRESS -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
  for port in 80 443; do
    "$command" -w -C COOPER-INGRESS -p tcp -m conntrack --ctorigdstport "$port" -j RETURN 2>/dev/null ||
      "$command" -w -A COOPER-INGRESS -p tcp -m conntrack --ctorigdstport "$port" -j RETURN
  done
  "$command" -w -C COOPER-INGRESS -j DROP 2>/dev/null || "$command" -w -A COOPER-INGRESS -j DROP
done
