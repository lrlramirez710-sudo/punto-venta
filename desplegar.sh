#!/usr/bin/env bash
# Despliega el programa en Devnet y deja el frontend listo.
# Uso (en WSL Ubuntu, dentro de la carpeta del proyecto):  bash desplegar.sh
set -e

echo "== 1. Revisando herramientas =="
if ! command -v anchor >/dev/null || ! command -v solana >/dev/null; then
  echo "Falta Solana o Anchor. Instalando (tarda unos minutos)..."
  curl --proto '=https' --tlsv1.2 -sSfL https://solana-install.solana.workers.dev | bash
  export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.avm/bin:$HOME/.cargo/bin:$PATH"
fi
solana --version
anchor --version

echo "== 2. Wallet en Devnet =="
solana config set --url devnet >/dev/null
[ -f ~/.config/solana/id.json ] || solana-keygen new --no-bip39-passphrase -s -o ~/.config/solana/id.json
echo "Tu wallet: $(solana address)"
BAL=$(solana balance | cut -d' ' -f1)
if awk "BEGIN{exit !($BAL < 3)}"; then
  solana airdrop 2 || true
  BAL=$(solana balance | cut -d' ' -f1)
fi
echo "Saldo: $BAL SOL"
if awk "BEGIN{exit !($BAL < 2.5)}"; then
  echo ""
  echo "No hay SOL suficiente para desplegar (se necesitan ~2.5)."
  echo "Entra a https://faucet.solana.com, pega esta direccion y pide SOL:"
  echo "   $(solana address)"
  echo "Luego vuelve a correr: bash desplegar.sh"
  exit 1
fi

echo "== 3. Compilando =="
anchor build

echo "== 4. Desplegando en Devnet =="
anchor deploy --provider.cluster devnet
PID=$(solana-keygen pubkey target/deploy/punto_venta-keypair.json)

echo "== 5. Copiando IDL al frontend =="
cp target/idl/punto_venta.json app/src/idl/punto_venta.json

echo ""
echo "LISTO"
echo "Program ID: $PID"
echo "Explorer:   https://explorer.solana.com/address/$PID?cluster=devnet"
echo "Ahora: cd app && npm install && npm run dev"
