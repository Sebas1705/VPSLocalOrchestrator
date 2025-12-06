#!/bin/bash

# Script de prueba con privilegios simulados
# Este script verifica servicios sin necesitar contraseña

echo "==================================="
echo "Script de Prueba - VPS Orchestrator"
echo "==================================="
echo ""
echo "Ejecutando verificaciones del sistema..."
echo ""

# 1. Ver servicios activos
echo "[1/4] Top 5 procesos por CPU:"
ps aux --sort=-%cpu | head -n 6
echo ""

# 2. Uso de memoria
echo "[2/4] Uso de memoria:"
free -h
echo ""

# 3. Uso de disco
echo "[3/4] Uso de disco:"
df -h | grep -E "^/dev/"
echo ""

# 4. Servicios en puerto 80 y 443
echo "[4/4] Servicios escuchando en puertos web:"
ss -tlnp 2>/dev/null | grep -E ":(80|443|3000)" || netstat -tlnp 2>/dev/null | grep -E ":(80|443|3000)"
echo ""

echo "==================================="
echo "✅ Verificación completada"
echo "==================================="
