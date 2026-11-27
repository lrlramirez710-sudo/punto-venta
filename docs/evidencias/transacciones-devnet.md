# Evidencias en Devnet

Program ID: `8xkiiCoTvmu8BPZyBBEYnqAFhomM3ZjZvcVuPfcuYduf`
https://explorer.solana.com/address/8xkiiCoTvmu8BPZyBBEYnqAFhomM3ZjZvcVuPfcuYduf?cluster=devnet

Despliegue del programa:
https://explorer.solana.com/tx/5hv8MArekGcP9xHy7HVEPW9tWr6KAXNMCkmkEpH1dbsAdViddjwanNuFJEiBRvqFmLTeppqk3u1BEt2JJbJTiRqf?cluster=devnet

## Prueba del flujo de inventario y reabastecimiento
Script: `docs/evidencias/prueba-devnet.ts` (ejecutado en Solana Playground).
Captura: `docs/evidencias/devnet-prueba-reabastecimiento.jpg`

| Paso | Resultado | Transacción |
|---|---|---|
| Crear tienda "Papitas Juan" | OK | https://explorer.solana.com/tx/4DZhq8rwoFzZRfde4KG26qci3srUhrNS9HQ4NAYLtGdSnxgguoYMB6iexTQYvygLFW6Yctn3etCaMBSJ9jXjHsor?cluster=devnet |
| Agregar producto con stock 5 | OK | https://explorer.solana.com/tx/3se8vZ6Mxc35ETEHww8muS5cbLa4prSA3cSDtEY41pXCXMKUv1J93ivBAUyJGaUujCGKRWZLxBRPgfe6XWuhF9si?cluster=devnet |
| Vender 3 | OK (stock 2) | https://explorer.solana.com/tx/4pk41wEvdDxMkiQZVoDQ6iZd56hUMfPzi7aCBYHTC5nRvqWkK4cvqZKirGzDa99sTJ2oaMPM3z2oC8sGEWpbsefn?cluster=devnet |
| Vender 8 | Rechazada: "No hay suficiente stock para esta venta" | — |
| Reabastecer +10 | OK (stock 12) | https://explorer.solana.com/tx/4AVRe6rPPXNg29SvXFbEPa15cbKENFMjzUBpzwzWMUAMN11NTnizVcCBWmzJB1aa8wWdLRna4CZtFABuxTaiB1hy?cluster=devnet |
| Vender 8 después de reabastecer | OK (stock final 4) | https://explorer.solana.com/tx/51tjRY2TdzSCesbmXujsc58gGFW1Hp1d4qKvpPf4PgHVpoMg85HLLi3Xn1kcKUhxrewAyFURVsnccMFv64LS2zmx?cluster=devnet |
