import { useEffect, useMemo, useState } from "react";
import { AnchorProvider, BN, Program, Idl } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import idl from "./idl/punto_venta.json";

type Prod = { pk: PublicKey; id: number; nombre: string; precio: number; stock: number };
type Ven = { pk: PublicKey; id: number; producto: PublicKey; cantidad: number; total: number; fecha: number };

const u64 = (n: number) => new BN(n).toArrayLike(Buffer, "le", 8);
const explorer = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
const pesos = (c: number) => "$" + (c / 100).toFixed(2);

// mensaje entendible del error de Anchor o de la wallet
function msgError(e: any): string {
  if (e?.error?.errorMessage) return e.error.errorMessage;
  const m = String(e?.message ?? e);
  if (m.includes("User rejected")) return "Firma cancelada en la wallet";
  if (m.includes("ConstraintHasOne")) return "Esta wallet no es dueña de la tienda";
  return m.slice(0, 160);
}

export default function App() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const program = useMemo(() => {
    if (!wallet) return null;
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    return new Program(idl as Idl, provider);
  }, [connection, wallet]);

  const [tienda, setTienda] = useState<any>(null);
  const [productos, setProductos] = useState<Prod[]>([]);
  const [ventas, setVentas] = useState<Ven[]>([]);
  const [estado, setEstado] = useState<{ tipo: "ok" | "error" | "info"; txt: string; sig?: string } | null>(null);
  const [cargando, setCargando] = useState(false);

  // formularios
  const [nomTienda, setNomTienda] = useState("");
  const [nomProd, setNomProd] = useState("");
  const [precio, setPrecio] = useState("");
  const [stockIni, setStockIni] = useState("");
  const [cantVenta, setCantVenta] = useState<Record<string, string>>({});
  const [cantReab, setCantReab] = useState<Record<string, string>>({});

  const tiendaPda = useMemo(() => {
    if (!wallet || !program) return null;
    return PublicKey.findProgramAddressSync(
      [Buffer.from("tienda"), wallet.publicKey.toBuffer()], program.programId)[0];
  }, [wallet, program]);

  async function cargar() {
    if (!program || !tiendaPda) return;
    const acc = program.account as any;
    const t = await acc.tienda.fetchNullable(tiendaPda);
    setTienda(t);
    if (!t) { setProductos([]); setVentas([]); return; }

    // productos y ventas de esta tienda (campo tienda en offset 8)
    const filtro = [{ memcmp: { offset: 8, bytes: tiendaPda.toBase58() } }];
    const ps = await acc.producto.all(filtro);
    setProductos(ps.map((p: any) => ({
      pk: p.publicKey, id: p.account.id.toNumber(), nombre: p.account.nombre,
      precio: p.account.precio.toNumber(), stock: p.account.stock,
    })).sort((a: Prod, b: Prod) => a.id - b.id));

    const vs = await acc.venta.all(filtro);
    setVentas(vs.map((v: any) => ({
      pk: v.publicKey, id: v.account.id.toNumber(), producto: v.account.producto,
      cantidad: v.account.cantidad, total: v.account.total.toNumber(), fecha: v.account.fecha.toNumber(),
    })).sort((a: Ven, b: Ven) => b.id - a.id));
  }

  useEffect(() => { cargar().catch((e) => setEstado({ tipo: "error", txt: msgError(e) })); }, [program]);

  // firma -> confirma -> recarga datos
  async function enviar(desc: string, fn: () => Promise<string>) {
    setCargando(true);
    setEstado({ tipo: "info", txt: `${desc}: esperando firma en la wallet...` });
    try {
      const sig = await fn();
      setEstado({ tipo: "info", txt: `${desc}: confirmando...` });
      await connection.confirmTransaction(sig, "confirmed");
      await cargar();
      setEstado({ tipo: "ok", txt: `${desc}: listo`, sig });
    } catch (e) {
      setEstado({ tipo: "error", txt: `${desc}: ${msgError(e)}` });
    } finally {
      setCargando(false);
    }
  }

  const m = () => program!.methods as any;
  const owner = () => wallet!.publicKey;
  const systemProgram = SystemProgram.programId;
  const pid = () => program!.programId;

  const crearTienda = () => enviar("Crear tienda", () =>
    m().crearTienda(nomTienda).accountsPartial({ owner: owner(), tienda: tiendaPda, systemProgram }).rpc());

  const agregarProducto = () => {
    const producto = PublicKey.findProgramAddressSync(
      [Buffer.from("producto"), tiendaPda!.toBuffer(), u64(tienda.numProductos.toNumber())], pid())[0];
    const centavos = Math.round(Number(precio || 0) * 100);
    return enviar("Agregar producto", async () => {
      const sig = await m().agregarProducto(nomProd, new BN(centavos), Number(stockIni || 0))
        .accountsPartial({ owner: owner(), tienda: tiendaPda, producto, systemProgram }).rpc();
      setNomProd(""); setPrecio(""); setStockIni("");
      return sig;
    });
  };

  const vender = (p: Prod) => {
    const venta = PublicKey.findProgramAddressSync(
      [Buffer.from("venta"), tiendaPda!.toBuffer(), u64(tienda.numVentas.toNumber())], pid())[0];
    const cant = Number(cantVenta[p.pk.toBase58()] || 0);
    return enviar(`Vender ${cant} ${p.nombre}`, async () => {
      const sig = await m().registrarVenta(cant)
        .accountsPartial({ owner: owner(), tienda: tiendaPda, producto: p.pk, venta, systemProgram }).rpc();
      setCantVenta({ ...cantVenta, [p.pk.toBase58()]: "" });
      return sig;
    });
  };

  // RETO: reabastecimiento desde el frontend
  const reabastecer = (p: Prod) => {
    const cant = Number(cantReab[p.pk.toBase58()] || 0);
    return enviar(`Reabastecer ${p.nombre} (+${cant})`, async () => {
      const sig = await m().reabastecerProducto(cant)
        .accountsPartial({ owner: owner(), tienda: tiendaPda, producto: p.pk }).rpc();
      setCantReab({ ...cantReab, [p.pk.toBase58()]: "" });
      return sig;
    });
  };

  const eliminar = (p: Prod) => enviar(`Eliminar ${p.nombre}`, () =>
    m().eliminarProducto().accountsPartial({ owner: owner(), tienda: tiendaPda, producto: p.pk }).rpc());

  const nombreProd = (pk: PublicKey) => productos.find((p) => p.pk.equals(pk))?.nombre ?? "(eliminado)";
  const unidades = productos.reduce((s, p) => s + p.stock, 0);

  return (
    <div className="contenedor">
      <header>
        <div>
          <h1>Punto de Venta</h1>
          <span className="red">Solana Devnet</span>
        </div>
        <WalletMultiButton />
      </header>

      {estado && (
        <div className={`estado ${estado.tipo}`}>
          {estado.txt}
          {estado.sig && <> · <a href={explorer(estado.sig)} target="_blank">ver transacción</a></>}
        </div>
      )}

      {!wallet && <p className="vacio">Conecta tu wallet (en Devnet) para empezar.</p>}

      {wallet && !tienda && (
        <section className="tarjeta">
          <h2>Crear tienda</h2>
          <div className="fila">
            <input placeholder="Nombre de la tienda" value={nomTienda} onChange={(e) => setNomTienda(e.target.value)} />
            <button disabled={cargando || !nomTienda} onClick={crearTienda}>Crear</button>
          </div>
        </section>
      )}

      {tienda && (
        <>
          <section className="resumen">
            <div><small>Tienda</small><b>{tienda.nombre}</b></div>
            <div><small>Productos</small><b>{productos.length}</b></div>
            <div><small>Unidades en stock</small><b>{unidades}</b></div>
            <div><small>Total vendido</small><b>{pesos(tienda.totalVendido.toNumber())}</b></div>
          </section>

          <section className="tarjeta" style={{ marginBottom: 16 }}>
            <h2>Nuevo producto</h2>
            <div className="fila">
              <input placeholder="Nombre" value={nomProd} onChange={(e) => setNomProd(e.target.value)} />
              <input placeholder="Precio $" type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} />
              <input placeholder="Stock inicial" type="number" value={stockIni} onChange={(e) => setStockIni(e.target.value)} />
              <button disabled={cargando || !nomProd || !precio} onClick={agregarProducto}>Agregar</button>
            </div>
          </section>

          <div className="columnas">
            <section className="tarjeta">
              <h2>Inventario</h2>
              {productos.length === 0 && <p className="vacio">Sin productos</p>}
              {productos.map((p) => {
                const k = p.pk.toBase58();
                return (
                  <div className="prod" key={k}>
                    <div className="prod-top">
                      <div>
                        <b>{p.nombre}</b>
                        <small>{pesos(p.precio)} c/u</small>
                      </div>
                      <span className={p.stock === 0 ? "sin" : p.stock < 5 ? "pend" : "aldia"}>
                        {p.stock} en stock
                      </span>
                    </div>
                    <div className="fila">
                      <input placeholder="Cant." type="number" value={cantVenta[k] ?? ""}
                        onChange={(e) => setCantVenta({ ...cantVenta, [k]: e.target.value })} />
                      <button disabled={cargando} onClick={() => vender(p)}>Vender</button>
                      <input placeholder="Cant." type="number" value={cantReab[k] ?? ""}
                        onChange={(e) => setCantReab({ ...cantReab, [k]: e.target.value })} />
                      <button className="reab" disabled={cargando} onClick={() => reabastecer(p)}>Reabastecer</button>
                      <button className="peligro" disabled={cargando} onClick={() => eliminar(p)}>✕</button>
                    </div>
                  </div>
                );
              })}
            </section>

            <section className="tarjeta">
              <h2>Ventas</h2>
              {ventas.length === 0 && <p className="vacio">Sin ventas</p>}
              {ventas.map((v) => (
                <div className="item" key={v.pk.toBase58()}>
                  <div>
                    <b>{v.cantidad} × {nombreProd(v.producto)}</b>
                    <small>{new Date(v.fecha * 1000).toLocaleString()}</small>
                  </div>
                  <b>{pesos(v.total)}</b>
                </div>
              ))}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
