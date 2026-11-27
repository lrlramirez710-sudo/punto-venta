use anchor_lang::prelude::*;

declare_id!("8xkiiCoTvmu8BPZyBBEYnqAFhomM3ZjZvcVuPfcuYduf");

// Limite por reabastecimiento (evita errores de captura)
pub const MAX_REABASTO: u32 = 10_000;

#[program]
pub mod punto_venta {
    use super::*;

    // ---------- Tienda ----------
    pub fn crear_tienda(ctx: Context<CrearTienda>, nombre: String) -> Result<()> {
        require!(nombre.len() > 0 && nombre.len() <= 32, Errores::NombreInvalido);
        let t = &mut ctx.accounts.tienda;
        t.owner = ctx.accounts.owner.key();
        t.nombre = nombre;
        t.num_productos = 0;
        t.num_ventas = 0;
        t.total_vendido = 0;
        t.bump = ctx.bumps.tienda;
        Ok(())
    }

    // ---------- Productos ----------
    pub fn agregar_producto(ctx: Context<AgregarProducto>, nombre: String, precio: u64, stock: u32) -> Result<()> {
        require!(nombre.len() > 0 && nombre.len() <= 32, Errores::NombreInvalido);
        require!(precio > 0, Errores::PrecioInvalido);
        let t = &mut ctx.accounts.tienda;
        let p = &mut ctx.accounts.producto;
        p.tienda = t.key();
        p.id = t.num_productos;
        p.nombre = nombre;
        p.precio = precio;
        p.stock = stock;
        p.bump = ctx.bumps.producto;
        t.num_productos += 1;
        Ok(())
    }

    pub fn actualizar_precio(ctx: Context<ModificarProducto>, precio: u64) -> Result<()> {
        require!(precio > 0, Errores::PrecioInvalido);
        ctx.accounts.producto.precio = precio;
        Ok(())
    }

    // RETO: reabastecimiento de inventario
    pub fn reabastecer_producto(ctx: Context<ModificarProducto>, cantidad: u32) -> Result<()> {
        require!(cantidad > 0, Errores::CantidadInvalida);
        require!(cantidad <= MAX_REABASTO, Errores::ReabastoExcedido);
        let p = &mut ctx.accounts.producto;
        p.stock = p.stock.checked_add(cantidad).ok_or(Errores::Desbordamiento)?;
        emit!(ProductoReabastecido { producto: p.key(), cantidad, stock: p.stock });
        Ok(())
    }

    // Baja condicionada: solo si ya no tiene existencias
    pub fn eliminar_producto(ctx: Context<EliminarProducto>) -> Result<()> {
        require!(ctx.accounts.producto.stock == 0, Errores::ProductoConStock);
        Ok(()) // se cierra con `close = owner`
    }

    // ---------- Ventas ----------
    pub fn registrar_venta(ctx: Context<RegistrarVenta>, cantidad: u32) -> Result<()> {
        require!(cantidad > 0, Errores::CantidadInvalida);
        let t = &mut ctx.accounts.tienda;
        let p = &mut ctx.accounts.producto;
        // validacion de disponibilidad de inventario
        require!(p.stock >= cantidad, Errores::StockInsuficiente);

        let total = p.precio.checked_mul(cantidad as u64).ok_or(Errores::Desbordamiento)?;
        p.stock -= cantidad;

        let v = &mut ctx.accounts.venta;
        v.tienda = t.key();
        v.producto = p.key();
        v.id = t.num_ventas;
        v.cantidad = cantidad;
        v.total = total;
        v.fecha = Clock::get()?.unix_timestamp;
        v.bump = ctx.bumps.venta;

        t.num_ventas += 1;
        t.total_vendido = t.total_vendido.checked_add(total).ok_or(Errores::Desbordamiento)?;
        Ok(())
    }
}

// ================= Cuentas =================

#[account]
#[derive(InitSpace)]
pub struct Tienda {
    pub owner: Pubkey,
    #[max_len(32)]
    pub nombre: String,
    pub num_productos: u64,
    pub num_ventas: u64,
    pub total_vendido: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Producto {
    pub tienda: Pubkey,
    pub id: u64,
    #[max_len(32)]
    pub nombre: String,
    pub precio: u64, // en centavos
    pub stock: u32,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Venta {
    pub tienda: Pubkey,
    pub producto: Pubkey,
    pub id: u64,
    pub cantidad: u32,
    pub total: u64,
    pub fecha: i64,
    pub bump: u8,
}

#[event]
pub struct ProductoReabastecido {
    pub producto: Pubkey,
    pub cantidad: u32,
    pub stock: u32,
}

// ================= Contextos =================

#[derive(Accounts)]
pub struct CrearTienda<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init, payer = owner, space = 8 + Tienda::INIT_SPACE,
        seeds = [b"tienda", owner.key().as_ref()], bump
    )]
    pub tienda: Account<'info, Tienda>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AgregarProducto<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner, seeds = [b"tienda", owner.key().as_ref()], bump = tienda.bump)]
    pub tienda: Account<'info, Tienda>,
    #[account(
        init, payer = owner, space = 8 + Producto::INIT_SPACE,
        seeds = [b"producto", tienda.key().as_ref(), &tienda.num_productos.to_le_bytes()], bump
    )]
    pub producto: Account<'info, Producto>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ModificarProducto<'info> {
    pub owner: Signer<'info>,
    #[account(has_one = owner)]
    pub tienda: Account<'info, Tienda>,
    #[account(mut, has_one = tienda)]
    pub producto: Account<'info, Producto>,
}

#[derive(Accounts)]
pub struct EliminarProducto<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(has_one = owner)]
    pub tienda: Account<'info, Tienda>,
    #[account(mut, has_one = tienda, close = owner)]
    pub producto: Account<'info, Producto>,
}

#[derive(Accounts)]
pub struct RegistrarVenta<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner)]
    pub tienda: Account<'info, Tienda>,
    #[account(mut, has_one = tienda)]
    pub producto: Account<'info, Producto>,
    #[account(
        init, payer = owner, space = 8 + Venta::INIT_SPACE,
        seeds = [b"venta", tienda.key().as_ref(), &tienda.num_ventas.to_le_bytes()], bump
    )]
    pub venta: Account<'info, Venta>,
    pub system_program: Program<'info, System>,
}

// ================= Errores =================

#[error_code]
pub enum Errores {
    #[msg("El nombre debe tener entre 1 y 32 caracteres")]
    NombreInvalido,
    #[msg("El precio debe ser mayor a cero")]
    PrecioInvalido,
    #[msg("La cantidad debe ser mayor a cero")]
    CantidadInvalida,
    #[msg("No hay suficiente stock para esta venta")]
    StockInsuficiente,
    #[msg("La cantidad a reabastecer excede el limite permitido")]
    ReabastoExcedido,
    #[msg("No se puede eliminar un producto que todavia tiene existencias")]
    ProductoConStock,
    #[msg("Desbordamiento numerico")]
    Desbordamiento,
}
