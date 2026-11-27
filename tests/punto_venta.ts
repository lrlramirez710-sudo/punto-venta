import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PuntoVenta } from "../target/types/punto_venta";
import { assert } from "chai";

describe("punto_venta", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.PuntoVenta as Program<PuntoVenta>;
  const owner = provider.wallet.publicKey;
  const pid = program.programId;
  const systemProgram = anchor.web3.SystemProgram.programId;

  const u64 = (n: number) => new BN(n).toArrayLike(Buffer, "le", 8);
  const [tienda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("tienda"), owner.toBuffer()], pid);
  const prodPda = (id: number) => anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("producto"), tienda.toBuffer(), u64(id)], pid)[0];
  const ventaPda = (id: number) => anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("venta"), tienda.toBuffer(), u64(id)], pid)[0];

  // regresa el codigo de error de Anchor
  async function falla(p: Promise<any>): Promise<string> {
    try { await p; } catch (e: any) { return e.error?.errorCode?.code ?? e.message; }
    assert.fail("La transaccion debio fallar");
  }

  const vender = (prod: number, venta: number, cant: number) =>
    program.methods.registrarVenta(cant)
      .accountsPartial({ owner, tienda, producto: prodPda(prod), venta: ventaPda(venta), systemProgram })
      .rpc();

  const reabastecer = (prod: number, cant: number) =>
    program.methods.reabastecerProducto(cant)
      .accountsPartial({ owner, tienda, producto: prodPda(prod) })
      .rpc();

  it("crea la tienda", async () => {
    await program.methods.crearTienda("Papitas Juan")
      .accountsPartial({ owner, tienda, systemProgram }).rpc();
    const t = await program.account.tienda.fetch(tienda);
    assert.equal(t.nombre, "Papitas Juan");
    assert.ok(t.owner.equals(owner));
  });

  it("agrega un producto con precio y stock", async () => {
    await program.methods.agregarProducto("Papitas de queso", new BN(2500), 10)
      .accountsPartial({ owner, tienda, producto: prodPda(0), systemProgram }).rpc();
    const p = await program.account.producto.fetch(prodPda(0));
    assert.equal(p.nombre, "Papitas de queso");
    assert.equal(p.stock, 10);
  });

  it("actualiza el precio", async () => {
    await program.methods.actualizarPrecio(new BN(3000))
      .accountsPartial({ owner, tienda, producto: prodPda(0) }).rpc();
    const p = await program.account.producto.fetch(prodPda(0));
    assert.equal(p.precio.toNumber(), 3000);
  });

  it("registra una venta y descuenta el stock", async () => {
    await vender(0, 0, 4);
    const p = await program.account.producto.fetch(prodPda(0));
    const v = await program.account.venta.fetch(ventaPda(0));
    const t = await program.account.tienda.fetch(tienda);
    assert.equal(p.stock, 6);
    assert.equal(v.total.toNumber(), 12000);
    assert.equal(t.totalVendido.toNumber(), 12000);
  });

  it("rechaza una venta sin stock suficiente", async () => {
    assert.equal(await falla(vender(0, 1, 7)), "StockInsuficiente");
  });

  it("rechaza una venta con cantidad 0", async () => {
    assert.equal(await falla(vender(0, 1, 0)), "CantidadInvalida");
  });

  // ===== RETO: reabastecimiento =====
  it("RETO: reabastece y el nuevo stock queda registrado", async () => {
    await reabastecer(0, 20);
    const p = await program.account.producto.fetch(prodPda(0));
    assert.equal(p.stock, 26);
  });

  it("RETO: despues de reabastecer ya se puede vender lo que antes fallaba", async () => {
    await vender(0, 1, 7);
    const p = await program.account.producto.fetch(prodPda(0));
    assert.equal(p.stock, 19);
  });

  it("RETO: rechaza reabastecer con cantidad 0", async () => {
    assert.equal(await falla(reabastecer(0, 0)), "CantidadInvalida");
  });

  it("RETO: rechaza reabastecer arriba del limite", async () => {
    assert.equal(await falla(reabastecer(0, 10_001)), "ReabastoExcedido");
  });

  it("RETO: otra wallet no puede reabastecer la tienda", async () => {
    const intruso = anchor.web3.Keypair.generate();
    const code = await falla(program.methods.reabastecerProducto(100)
      .accountsPartial({ owner: intruso.publicKey, tienda, producto: prodPda(0) })
      .signers([intruso]).rpc());
    assert.equal(code, "ConstraintHasOne");
  });

  // ===== Baja condicionada =====
  it("no permite eliminar un producto con existencias", async () => {
    const code = await falla(program.methods.eliminarProducto()
      .accountsPartial({ owner, tienda, producto: prodPda(0) }).rpc());
    assert.equal(code, "ProductoConStock");
  });

  it("elimina un producto sin existencias", async () => {
    await program.methods.agregarProducto("Papitas naturales", new BN(2000), 0)
      .accountsPartial({ owner, tienda, producto: prodPda(1), systemProgram }).rpc();
    await program.methods.eliminarProducto()
      .accountsPartial({ owner, tienda, producto: prodPda(1) }).rpc();
    assert.isNull(await provider.connection.getAccountInfo(prodPda(1)));
  });
});
