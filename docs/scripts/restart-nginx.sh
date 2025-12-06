#!/bin/bash

# Script de prueba que requiere privilegios
# Este script reinicia el servicio nginx

echo "==================================="
echo "Script de prueba con privilegios"
echo "==================================="
echo ""
echo "Este script intentará:"
echo "1. Verificar el estado de nginx"
echo "2. Reiniciar nginx"
echo "3. Verificar nuevamente el estado"
echo ""

# Verificar estado actual
echo "[1/3] Verificando estado de nginx..."
sudo systemctl status nginx --no-pager -l | head -n 5
echo ""

# Reiniciar servicio
echo "[2/3] Reiniciando nginx..."
sudo systemctl restart nginx
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Nginx reiniciado exitosamente"
else
    echo "❌ Error al reiniciar nginx (código: $EXIT_CODE)"
    exit $EXIT_CODE
fi

echo ""

# Verificar nuevo estado
echo "[3/3] Verificando nuevo estado..."
sudo systemctl status nginx --no-pager -l | head -n 5

echo ""
echo "==================================="
echo "✅ Script completado exitosamente"
echo "==================================="
