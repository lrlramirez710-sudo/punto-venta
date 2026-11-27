// Prueba del punto de venta en Devnet (Solana Playground)
const prog = pg.program;
const owner = pg.wallet.publicKey;
const pid = prog.programId;
const sys = web3.SystemProgram.programId;
const u64 = (n) => new BN(n).toArrayLike(Buffer, "le", 8);
const link = (s) => `https://explorer.solana.com/tx/${s}?cluster=devnet`;

const [tienda] = web3.PublicKey.findProgramAddressSync([Buffer.from("tienda"), owner.toBuffer()], pid);

let t = await prog.account.tienda.fetchNullable(tienda);
if (!t) {
  const s = await prog.methods.crearTienda("Papitas Juan").accounts({ owner, tienda, systemProgram: sys }).rpc();
  console.log("Tienda creada:", link(s));
  t = await prog.account.tienda.fetch(tienda);
}

const prodId = t.numProductos.toNumber();
const [producto] = web3.PublicKey.findProgramAddressSync([Buffer.from("producto"), tienda.toBuffer(), u64(prodId)], pid);
let s = await prog.methods.agregarProducto("Papitas de queso", new BN(2500), 5)
  .accounts({ owner, tienda, producto, systemProgram: sys }).rpc();
console.log("Producto agregado (stock 5):", link(s));

let nv = t.numVentas.toNumber();
async function vender(cant) {
  const [venta] = web3.PublicKey.findProgramAddressSync([Buffer.from("venta"), tienda.toBuffer(), u64(nv)], pid);
  const sig = await prog.methods.registrarVenta(cant).accounts({ owner, tienda, producto, venta, systemProgram: sys }).rpc();
  nv++;
  return sig;
}

s = await vender(3);
console.log("Venta de 3:", link(s));

try {
  await vender(8);
  console.log("ERROR: la venta de 8 debio fallar");
} catch (e) {
  console.log("Venta de 8 rechazada:", e.error?.errorMessage ?? e.message);
}

s = await prog.methods.reabastecerProducto(10).accounts({ owner, tienda, producto }).rpc();
console.log("Reabastecido +10:", link(s));

s = await vender(8);
console.log("Venta de 8 despues de reabastecer:", link(s));

const p = await prog.account.producto.fetch(producto);
const tf = await prog.account.tienda.fetch(tienda);
console.log("Stock final:", p.stock, "| Total vendido: $" + (tf.totalVendido.toNumber() / 100).toFixed(2));
