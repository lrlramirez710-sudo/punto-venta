# Punto de Venta en Solana

Proyecto final del **Solana Engineering Track: Advanced** (WayLearn / Solana Foundation).

## Autor
- Nombre para el certificado: Luis Rolando López Ramírez
- Correo de registro: lrlramirez.710@gmail.com

## Ruta elegida
Proyecto guiado del bootcamp (punto de venta con tiendas, productos y ventas) más el reto de
**reabastecimiento de productos**, conectado desde el frontend.

## Propósito
Una tienda pequeña registra sus productos con precio y existencias, vende desde el frontend y
reabastece inventario. Todo queda guardado en Solana (Devnet) y solo el dueño de la tienda puede
modificar sus datos.

## Despliegue
- Red: Devnet
- Program ID: `8xkiiCoTvmu8BPZyBBEYnqAFhomM3ZjZvcVuPfcuYduf`
- Explorer: https://explorer.solana.com/address/8xkiiCoTvmu8BPZyBBEYnqAFhomM3ZjZvcVuPfcuYduf?cluster=devnet

## Cuentas (PDAs)
| Cuenta | Seeds | Datos |
|---|---|---|
| Tienda | `["tienda", owner]` | dueño, nombre, contadores, total vendido |
| Producto | `["producto", tienda, id]` | nombre, precio (centavos), stock |
| Venta | `["venta", tienda, id]` | producto, cantidad, total, fecha |

## Instrucciones del programa
| Instrucción | Qué hace | Validaciones |
|---|---|---|
| `crear_tienda` | Crea la tienda de la wallet | nombre 1–32 caracteres |
| `agregar_producto` | Alta de producto con precio y stock | precio > 0, solo el dueño |
| `actualizar_precio` | Cambia el precio | precio > 0, solo el dueño |
| `registrar_venta` | Vende, descuenta stock y suma al total | cantidad > 0, **stock suficiente**, solo el dueño |
| `reabastecer_producto` | **Reto:** suma existencias | cantidad > 0, máximo 10,000 por operación, sin desbordamiento, solo el dueño |
| `eliminar_producto` | Cierra la cuenta y devuelve la renta | **solo si el stock es 0** |

Seguridad: el dueño firma (`Signer`), `has_one = owner` en la tienda, `has_one = tienda` en
productos (un producto de otra tienda no se puede usar), `close = owner` al eliminar y
aritmética con `checked_add` / `checked_mul`.

## Reto: reabastecimiento
- Programa: instrucción `reabastecer_producto` con sus validaciones y un evento `ProductoReabastecido`.
- Frontend: en cada producto hay un campo de cantidad y el botón **Reabastecer**. Al confirmar
  la transacción, la lista se recarga y se ve el nuevo stock.
- Cómo comprobarlo:
  1. `anchor test` → pruebas que empiezan con `RETO:`.
  2. En el frontend vende más unidades de las que hay → "No hay suficiente stock para esta venta".
  3. Reabastece ese producto y repite la venta → ahora sí pasa.
- Desarrollado con apoyo de IA; revisé y probé el código.

## Requisitos
Solana CLI 2.1.x, Anchor 0.31.x, Node 20 o superior, Phantom en Devnet.

## Ejecución
```bash
# pruebas (localnet): genera una llave local para el programa
anchor keys sync
anchor build
anchor test

# el programa ya esta desplegado en Devnet (Solana Playground).
# Para desplegar una copia propia: bash desplegar.sh

# frontend
cd app
npm install
npm run dev        # http://localhost:5173
```
SOL de prueba: https://faucet.solana.com

## Pruebas y evidencias
- `anchor test`: 13 pruebas pasando (`docs/evidencias/anchor-test.txt`).
- Flujo probado en Devnet (venta, rechazo por falta de stock, reabastecimiento y nueva venta): `docs/evidencias/transacciones-devnet.md`
- Transacción verificable (reabastecimiento): https://explorer.solana.com/tx/4AVRe6rPPXNg29SvXFbEPa15cbKENFMjzUBpzwzWMUAMN11NTnizVcCBWmzJB1aa8wWdLRna4CZtFABuxTaiB1hy?cluster=devnet
- Capturas: `docs/evidencias/`
