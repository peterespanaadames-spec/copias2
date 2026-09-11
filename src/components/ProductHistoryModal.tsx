/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  History, X, Search, Filter, Calendar, Download, Printer, 
  ArrowUpRight, ArrowDownLeft, RefreshCw, Package, ArrowLeftRight, 
  DollarSign, ShoppingCart, ShoppingBag, Truck, FileText, CheckCircle2, 
  AlertTriangle, User, Plus, FileSpreadsheet, Eye, ChevronRight, Hash,
  Tag, MapPin, Barcode, TrendingUp, TrendingDown, Clock, Layers
} from 'lucide-react';
import { Product, Invoice, Purchase, Order, ProductMovementLog } from '../types';
import { dbService, supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

export interface ProductHistoryModalProps {
  product: Product | null;
  onClose: () => void;
  onStockUpdated?: (newStock: number) => void;
  currencySymbol?: string;
  bcvRate?: number;
}

export interface UnifiedMovementItem {
  id: string;
  date: string;
  type: 'venta_factura' | 'nota_entrega' | 'compra_proveedor' | 'pedido_tienda' | 'ajuste_ingreso' | 'ajuste_egreso' | 'ajuste_conteo';
  typeLabel: string;
  typeCategory: 'salida' | 'entrada' | 'ajuste';
  referenceId?: string;
  referenceLabel?: string;
  clientOrProvider?: string;
  operatorName?: string;
  quantityChange: number; // positive or negative
  unitPrice?: number;
  totalAmount?: number;
  previousStock?: number;
  resultingStock?: number;
  notes?: string;
  rawItem?: any;
}

export const ProductHistoryModal: React.FC<ProductHistoryModalProps> = ({
  product,
  onClose,
  onStockUpdated,
  currencySymbol = '$',
  bcvRate = 1
}) => {
  if (!product) return null;

  const [loading, setLoading] = useState<boolean>(true);
  const [movements, setMovements] = useState<UnifiedMovementItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'ventas' | 'notas' | 'compras' | 'pedidos' | 'ajustes'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7d' | '30d' | 'month'>('all');
  
  // Quick manual adjustment form within the modal
  const [showAdjustmentForm, setShowAdjustmentForm] = useState<boolean>(false);
  const [adjustType, setAdjustType] = useState<'ingreso' | 'egreso' | 'ajuste'>('ingreso');
  const [adjustQty, setAdjustQty] = useState<number | string>(1);
  const [adjustConcept, setAdjustConcept] = useState<string>('');
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState<boolean>(false);
  const [currentLiveStock, setCurrentLiveStock] = useState<number>(product.stock);

  useEffect(() => {
    setCurrentLiveStock(product.stock);
  }, [product]);

  // Load all operational history matching this product
  const loadProductHistory = async () => {
    setLoading(true);
    try {
      const [
        allInvoices,
        allDrafts,
        allPurchases,
        allOrders,
        allManualLogs
      ] = await Promise.all([
        dbService.getInvoices().catch(() => [] as Invoice[]),
        dbService.getDraftInvoices().catch(() => [] as any[]),
        dbService.getPurchases().catch(() => [] as Purchase[]),
        dbService.getOrders().catch(() => [] as Order[]),
        dbService.getProductMovements(product.id).catch(() => [] as ProductMovementLog[])
      ]);

      const compiled: UnifiedMovementItem[] = [];

      const matchesProduct = (item: any) => {
        if (!item) return false;
        const itemId = String(item.id || item.product_id || '').toLowerCase();
        const itemSku = String(item.sku || '').toLowerCase();
        const itemName = String(item.name || item.product_name || item.description || '').toLowerCase();
        
        const targetId = String(product.id || '').toLowerCase();
        const targetSku = String(product.sku || '').toLowerCase();
        const targetName = String(product.name || '').toLowerCase();

        return (
          (targetId && itemId === targetId) ||
          (targetSku && itemSku === targetSku) ||
          (targetName && itemName === targetName) ||
          (targetName && targetName.length > 4 && itemName.includes(targetName))
        );
      };

      // 1. Invoices / Facturas (Ventas)
      (allInvoices || []).forEach((inv) => {
        if (inv.status === 'anulada') return;
        const items = Array.isArray(inv.items) ? inv.items : [];
        items.forEach((it: any, idx: number) => {
          if (matchesProduct(it)) {
            const qty = Number(it.quantity || it.qty || 1);
            const price = Number(it.price || it.unit_price || 0);
            const isDeliveryNote = inv.document_type === 'nota_entrega';

            compiled.push({
              id: `inv-${inv.id || inv.invoice_number || '0'}-${idx}`,
              date: inv.created_at || new Date().toISOString(),
              type: isDeliveryNote ? 'nota_entrega' : 'venta_factura',
              typeLabel: isDeliveryNote ? 'Nota de Entrega' : 'Venta / Factura',
              typeCategory: 'salida',
              referenceId: inv.invoice_number || inv.control_number || inv.id,
              referenceLabel: isDeliveryNote ? `Nota #${inv.invoice_number || inv.control_number || 'N/A'}` : `Factura #${inv.invoice_number || inv.control_number || 'N/A'}`,
              clientOrProvider: inv.customer_name || 'Consumidor Final',
              operatorName: inv.created_by || 'Caja POS',
              quantityChange: -Math.abs(qty),
              unitPrice: price,
              totalAmount: qty * price,
              notes: inv.notes || (isDeliveryNote ? 'Despacho con Nota de Entrega' : 'Venta POS / Facturación Comercial'),
              rawItem: inv
            });
          }
        });
      });

      // 2. Draft Delivery Notes
      (allDrafts || []).forEach((draft, idx) => {
        const items = Array.isArray(draft.items) ? draft.items : [];
        items.forEach((it: any, itIdx: number) => {
          if (matchesProduct(it)) {
            const qty = Number(it.quantity || it.qty || 1);
            const price = Number(it.price || it.unit_price || 0);
            compiled.push({
              id: `draft-${draft.id || idx}-${itIdx}`,
              date: draft.created_at || new Date().toISOString(),
              type: 'nota_entrega',
              typeLabel: 'Nota de Entrega (Borrador)',
              typeCategory: 'salida',
              referenceId: draft.control_number || draft.id,
              referenceLabel: `Nota #${draft.control_number || draft.invoice_number || 'Borrador'}`,
              clientOrProvider: draft.customer_name || 'Cliente',
              operatorName: draft.created_by || 'Despacho',
              quantityChange: -Math.abs(qty),
              unitPrice: price,
              totalAmount: qty * price,
              notes: draft.notes || 'Comprobante de entrega registrado',
              rawItem: draft
            });
          }
        });
      });

      // 3. Purchases / Compras (Entradas de mercancía de proveedores)
      (allPurchases || []).forEach((pur) => {
        const items = Array.isArray(pur.items) ? pur.items : [];
        items.forEach((it: any, idx: number) => {
          if (matchesProduct(it)) {
            const qty = Number(it.quantity || it.qty || 1);
            const cost = Number(it.cost_price || it.unit_cost || it.price || 0);
            compiled.push({
              id: `pur-${pur.id || pur.invoice_number || '0'}-${idx}`,
              date: pur.date || pur.created_at || new Date().toISOString(),
              type: 'compra_proveedor',
              typeLabel: 'Compra a Proveedor',
              typeCategory: 'entrada',
              referenceId: pur.invoice_number || pur.id,
              referenceLabel: `Doc Compra #${pur.invoice_number || 'S/N'}`,
              clientOrProvider: pur.provider_name || 'Proveedor Registrado',
              operatorName: pur.created_by || 'Administración',
              quantityChange: Math.abs(qty),
              unitPrice: cost,
              totalAmount: qty * cost,
              notes: pur.notes || `Ingreso de mercancía por compra - Proveedor: ${pur.provider_name || 'General'}`,
              rawItem: pur
            });
          }
        });
      });

      // 4. Orders / Pedidos Online o Tienda
      (allOrders || []).forEach((ord) => {
        if (ord.status === 'cancelled') return;
        const items = Array.isArray(ord.items) ? ord.items : [];
        items.forEach((it: any, idx: number) => {
          if (matchesProduct(it)) {
            const qty = Number(it.quantity || it.qty || 1);
            const price = Number(it.price || 0);
            const orderRefId = (ord.id || 'PED').slice(0, 8);
            compiled.push({
              id: `ord-${ord.id || idx}-${idx}`,
              date: ord.created_at || new Date().toISOString(),
              type: 'pedido_tienda',
              typeLabel: 'Pedido Online / Tienda',
              typeCategory: 'salida',
              referenceId: orderRefId,
              referenceLabel: `Pedido #${orderRefId}`,
              clientOrProvider: (ord as any).client_name || ord.customer_name || 'Cliente Web',
              operatorName: 'Catálogo Virtual',
              quantityChange: -Math.abs(qty),
              unitPrice: price,
              totalAmount: qty * price,
              notes: `Estado del pedido: ${ord.status || 'Completado'}`,
              rawItem: ord
            });
          }
        });
      });

      // 5. Manual Adjustments & Audit Logs
      (allManualLogs || []).forEach((log) => {
        const isEntry = log.type === 'ingreso' || log.quantity > 0;
        const isExit = log.type === 'egreso' || log.quantity < 0;
        const isCount = log.type === 'ajuste';

        compiled.push({
          id: `log-${log.id}`,
          date: log.created_at || new Date().toISOString(),
          type: isEntry ? 'ajuste_ingreso' : isExit ? 'ajuste_egreso' : 'ajuste_conteo',
          typeLabel: isEntry ? 'Ajuste: Entrada (+)' : isExit ? 'Ajuste: Salida (-)' : 'Ajuste: Conteo Físico',
          typeCategory: 'ajuste',
          referenceId: log.reference_id || log.id.slice(0, 8),
          referenceLabel: log.reference_id ? `Ref #${log.reference_id}` : 'Ajuste Manual',
          clientOrProvider: 'Inventario Interno',
          operatorName: log.user_name || 'Administrador',
          quantityChange: log.quantity,
          previousStock: log.previous_stock,
          resultingStock: log.new_stock,
          unitPrice: log.unit_price || (product.offer_price || product.price),
          totalAmount: log.total_amount || Math.abs(log.quantity) * (product.offer_price || product.price),
          notes: log.concept || 'Ajuste de inventario físico',
          rawItem: log
        });
      });

      // Sort descending by date
      compiled.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Deduplicate items that might share identical invoice & order refs
      const uniqueKeys = new Set<string>();
      const deduped = compiled.filter(item => {
        const key = `${item.type}-${item.referenceId}-${item.date.slice(0, 16)}-${item.quantityChange}`;
        if (uniqueKeys.has(key)) return false;
        uniqueKeys.add(key);
        return true;
      });

      setMovements(deduped);
    } catch (err) {
      console.error("Error loading product history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProductHistory();
  }, [product.id, product.sku]);

  // Handle Quick Manual Adjustment Registration
  const handleRegisterAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = Number(adjustQty) || 0;
    if (qtyNum <= 0 && adjustType !== 'ajuste') {
      alert('Por favor ingrese una cantidad mayor a cero.');
      return;
    }

    setIsSubmittingAdjust(true);
    try {
      const prevStock = currentLiveStock;
      let newStock = prevStock;
      let qtyDelta = 0;

      if (adjustType === 'ingreso') {
        newStock = prevStock + qtyNum;
        qtyDelta = qtyNum;
      } else if (adjustType === 'egreso') {
        newStock = Math.max(0, prevStock - qtyNum);
        qtyDelta = -Math.min(prevStock, qtyNum);
      } else if (adjustType === 'ajuste') {
        newStock = Math.max(0, qtyNum);
        qtyDelta = newStock - prevStock;
      }

      // Update product stock in database
      await supabase.from('products').update({ stock: newStock }).eq('id', product.id);

      // Record movement audit log
      const logRecord: ProductMovementLog = {
        id: crypto.randomUUID(),
        product_id: product.id,
        product_name: product.name,
        product_sku: product.sku,
        type: adjustType,
        quantity: qtyDelta,
        previous_stock: prevStock,
        new_stock: newStock,
        concept: adjustConcept.trim() || `Ajuste manual (${adjustType.toUpperCase()})`,
        unit_price: product.offer_price || product.price,
        total_amount: Math.abs(qtyDelta) * (product.offer_price || product.price),
        user_name: 'Administración',
        created_at: new Date().toISOString()
      };

      await dbService.recordProductMovement(logRecord);

      setCurrentLiveStock(newStock);
      if (onStockUpdated) {
        onStockUpdated(newStock);
      }

      setShowAdjustmentForm(false);
      setAdjustQty(1);
      setAdjustConcept('');
      
      // Reload history list
      await loadProductHistory();
    } catch (err: any) {
      alert(`Error al registrar el ajuste: ${err.message || err}`);
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  // Filtered movements based on search query, type, and date
  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      // Type filter
      if (filterType === 'ventas' && m.type !== 'venta_factura') return false;
      if (filterType === 'notas' && m.type !== 'nota_entrega') return false;
      if (filterType === 'compras' && m.type !== 'compra_proveedor') return false;
      if (filterType === 'pedidos' && m.type !== 'pedido_tienda') return false;
      if (filterType === 'ajustes' && !m.type.startsWith('ajuste')) return false;

      // Date filter
      if (dateFilter !== 'all') {
        const itemDate = new Date(m.date);
        const now = new Date();
        if (dateFilter === 'today') {
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (itemDate < startOfToday) return false;
        } else if (dateFilter === '7d') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (itemDate < sevenDaysAgo) return false;
        } else if (dateFilter === '30d') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (itemDate < thirtyDaysAgo) return false;
        } else if (dateFilter === 'month') {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          if (itemDate < startOfMonth) return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchRef = (m.referenceLabel || '').toLowerCase().includes(q);
        const matchClient = (m.clientOrProvider || '').toLowerCase().includes(q);
        const matchNotes = (m.notes || '').toLowerCase().includes(q);
        const matchOperator = (m.operatorName || '').toLowerCase().includes(q);
        const matchType = (m.typeLabel || '').toLowerCase().includes(q);
        if (!matchRef && !matchClient && !matchNotes && !matchOperator && !matchType) {
          return false;
        }
      }

      return true;
    });
  }, [movements, filterType, dateFilter, searchQuery]);

  // Aggregate Metrics for Product
  const metrics = useMemo(() => {
    let totalSoldUnits = 0;
    let totalSoldAmount = 0;
    let totalPurchasedUnits = 0;
    let totalPurchasedAmount = 0;
    let totalAdjustments = 0;

    movements.forEach(m => {
      if (m.type === 'venta_factura' || m.type === 'nota_entrega' || m.type === 'pedido_tienda') {
        totalSoldUnits += Math.abs(m.quantityChange);
        totalSoldAmount += m.totalAmount || 0;
      } else if (m.type === 'compra_proveedor') {
        totalPurchasedUnits += Math.abs(m.quantityChange);
        totalPurchasedAmount += m.totalAmount || 0;
      } else if (m.type.startsWith('ajuste')) {
        totalAdjustments += 1;
      }
    });

    return {
      totalSoldUnits,
      totalSoldAmount,
      totalPurchasedUnits,
      totalPurchasedAmount,
      totalAdjustments,
      totalOperations: movements.length
    };
  }, [movements]);

  // Export to Excel
  const handleExportExcel = () => {
    if (movements.length === 0) {
      alert('No hay movimientos registrados para exportar.');
      return;
    }

    const excelRows = filteredMovements.map((m, idx) => ({
      'N°': idx + 1,
      'Fecha y Hora': new Date(m.date).toLocaleString(),
      'Tipo de Movimiento': m.typeLabel,
      'Comprobante / Ref': m.referenceLabel || 'N/A',
      'Cliente / Proveedor / Destino': m.clientOrProvider || 'N/A',
      'Operador': m.operatorName || 'N/A',
      'Entrada / Salida (Unidades)': m.quantityChange,
      'Precio / Costo Unitario ($)': m.unitPrice ? m.unitPrice.toFixed(2) : '0.00',
      'Monto Total ($)': m.totalAmount ? m.totalAmount.toFixed(2) : '0.00',
      'Detalle / Concepto': m.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kardex_Movimientos");
    XLSX.writeFile(wb, `Kardex_${product.sku || 'Prod'}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Print Kardex Report
  const handlePrint = () => {
    window.print();
  };

  const costPrice = product.cost_price || 0;
  const salePrice = product.offer_price || product.price || 0;
  const marginPercent = costPrice > 0 ? (((salePrice - costPrice) / costPrice) * 100).toFixed(1) : '0.0';

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 text-left font-poppins animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-gray-200 w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 bg-[#1D3557] text-white flex items-center justify-between gap-4 shrink-0 border-b-2 border-[#40E0D0]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 text-[#40E0D0] flex items-center justify-center shrink-0 border border-white/10 shadow-inner">
              <History className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-montserrat font-extrabold text-sm sm:text-base text-white uppercase tracking-tight">
                  Kardex e Historial de Movimientos
                </h3>
                <span className="px-2 py-0.5 bg-[#40E0D0] text-[#1D3557] text-[10px] font-black rounded-md uppercase tracking-wider">
                  SKU: {product.sku || 'S/N'}
                </span>
                {product.barcode_qr && (
                  <span className="px-2 py-0.5 bg-white/10 text-white text-[10px] font-mono rounded-md flex items-center gap-1">
                    <Barcode className="w-3 h-3 text-[#40E0D0]" />
                    <span>{product.barcode_qr}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-white/80 font-semibold truncate max-w-xl mt-0.5">
                {product.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAdjustmentForm(!showAdjustmentForm)}
              className="px-3.5 py-2 bg-[#40E0D0] hover:bg-[#36cebe] text-[#1D3557] font-montserrat font-black text-xs rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer"
              id="btn-quick-movement-history"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span className="hidden sm:inline">Ajustar Stock</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-white/70 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
              title="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* QUICK ADJUSTMENT COLLAPSIBLE FORM */}
        {showAdjustmentForm && (
          <div className="p-4 bg-amber-50 border-b border-amber-200 text-xs text-amber-950 animate-in slide-in-from-top-2 duration-150 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="font-montserrat font-black uppercase text-[11px] text-amber-900 flex items-center gap-1.5">
                <ArrowLeftRight className="w-4 h-4 text-amber-700" />
                Registrar Movimiento Directo de Stock
              </span>
              <span className="text-[11px] font-bold text-amber-800">
                Stock actual en sistema: <strong>{currentLiveStock} unidades</strong>
              </span>
            </div>

            <form onSubmit={handleRegisterAdjustment} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[10px] font-black uppercase text-amber-800 mb-1">
                  Tipo de Operación
                </label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as any)}
                  className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="ingreso">📥 Entrada (+) Aumentar Stock</option>
                  <option value="egreso">📤 Salida (-) Disminuir Stock / Merma</option>
                  <option value="ajuste">🔄 Ajuste Físico (Establecer Total Exacto)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-amber-800 mb-1">
                  {adjustType === 'ajuste' ? 'Nuevo Stock Total' : 'Cantidad a Mover'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  required
                  className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-amber-800 mb-1">
                  Concepto / Motivo
                </label>
                <input
                  type="text"
                  value={adjustConcept}
                  onChange={(e) => setAdjustConcept(e.target.value)}
                  placeholder="Ej: Conteo físico, Merma, Devolución..."
                  className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustmentForm(false)}
                  className="px-3 py-2 bg-white border border-amber-300 text-amber-800 font-bold rounded-xl text-xs hover:bg-amber-100/50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdjust}
                  className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-montserrat font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingAdjust ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>{isSubmittingAdjust ? 'Guardando...' : 'Aplicar Ajuste'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* SUMMARY KPI CARDS */}
        <div className="p-4 bg-gray-50/80 border-b border-gray-200 grid grid-cols-2 sm:grid-cols-5 gap-3 shrink-0">
          <div className="p-3 bg-white rounded-2xl border border-gray-200 shadow-2xs space-y-1">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Stock Actual</span>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-lg font-black ${
                currentLiveStock === 0 ? 'text-rose-600' : currentLiveStock <= 5 ? 'text-amber-600' : 'text-[#1D3557]'
              }`}>
                {currentLiveStock}
              </span>
              <span className="text-[10px] font-bold text-gray-500 uppercase">{product.unit || product.units || 'Unid.'}</span>
            </div>
            <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
              currentLiveStock === 0 ? 'bg-rose-100 text-rose-700' : currentLiveStock <= 5 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {currentLiveStock === 0 ? 'Agotado' : currentLiveStock <= 5 ? 'Stock Crítico' : 'Disponible'}
            </span>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-gray-200 shadow-2xs space-y-1">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Total Vendido</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-black text-sky-700">{metrics.totalSoldUnits}</span>
              <span className="text-[10px] font-bold text-gray-500 uppercase">{product.unit || 'Unid.'}</span>
            </div>
            <p className="text-[10px] font-bold text-sky-800">
              {currencySymbol}{metrics.totalSoldAmount.toFixed(2)} generados
            </p>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-gray-200 shadow-2xs space-y-1">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Total Comprado</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-black text-emerald-700">{metrics.totalPurchasedUnits}</span>
              <span className="text-[10px] font-bold text-gray-500 uppercase">{product.unit || 'Unid.'}</span>
            </div>
            <p className="text-[10px] font-bold text-emerald-800">
              {currencySymbol}{metrics.totalPurchasedAmount.toFixed(2)} invertidos
            </p>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-gray-200 shadow-2xs space-y-1">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Precio & Margen</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-black text-gray-900">${salePrice.toFixed(2)}</span>
              <span className="text-[10px] text-gray-400 line-through">${costPrice.toFixed(2)}</span>
            </div>
            <span className="inline-block text-[10px] font-black text-[#00BFFF]">
              Margen: +{marginPercent}%
            </span>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-gray-200 shadow-2xs space-y-1 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Operaciones</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-black text-slate-800">{metrics.totalOperations}</span>
              <span className="text-[10px] font-bold text-gray-400">registros</span>
            </div>
            <p className="text-[10px] text-gray-500 font-semibold">
              {metrics.totalAdjustments} ajustes manuales
            </p>
          </div>
        </div>

        {/* TOOLBAR & FILTERS */}
        <div className="p-3 bg-white border-b border-gray-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          {/* Search bar */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por N° factura, cliente, detalle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-7 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs font-montserrat font-extrabold scrollbar-none">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'ventas', label: 'Ventas' },
              { id: 'notas', label: 'Notas Entrega' },
              { id: 'compras', label: 'Compras' },
              { id: 'pedidos', label: 'Pedidos' },
              { id: 'ajustes', label: 'Ajustes' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 ${
                  filterType === tab.id
                    ? 'bg-[#1D3557] text-white shadow-xs'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}

            {/* Date filter dropdown */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold border-none focus:ring-2 focus:ring-[#00BFFF] cursor-pointer shrink-0"
            >
              <option value="all">📅 Todo el Historial</option>
              <option value="today">📅 Hoy</option>
              <option value="7d">📅 Últimos 7 días</option>
              <option value="30d">📅 Últimos 30 días</option>
              <option value="month">📅 Este Mes</option>
            </select>

            {/* Action buttons */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="p-1.5 bg-gray-100 hover:bg-emerald-50 text-emerald-700 hover:border-emerald-300 border border-transparent rounded-xl transition cursor-pointer shrink-0"
              title="Exportar a Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="p-1.5 bg-gray-100 hover:bg-sky-50 text-sky-700 hover:border-sky-300 border border-transparent rounded-xl transition cursor-pointer shrink-0"
              title="Imprimir Kardex"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* HISTORY LEDGER TABLE */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-12 text-center text-gray-400 space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#00BFFF]" />
              <p className="text-xs font-bold font-montserrat uppercase tracking-wider">
                Cargando historial y trazabilidad del artículo...
              </p>
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="p-12 text-center text-gray-400 space-y-2">
              <History className="w-8 h-8 mx-auto text-gray-300 stroke-[1.5]" />
              <p className="text-xs font-bold text-gray-600">
                No se encontraron movimientos registrados para este artículo con los filtros aplicados.
              </p>
              <p className="text-[11px] text-gray-400">
                Las ventas facturadas, notas de entrega, compras o ajustes de stock se registrarán automáticamente aquí.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs font-poppins">
              <thead className="sticky top-0 bg-gray-100 text-gray-700 font-montserrat font-extrabold uppercase text-[10px] tracking-wider z-10 border-b border-gray-200">
                <tr>
                  <th className="p-3">Fecha y Hora</th>
                  <th className="p-3">Tipo de Operación</th>
                  <th className="p-3">Comprobante / Ref</th>
                  <th className="p-3">Cliente / Proveedor</th>
                  <th className="p-3 text-center">Movimiento</th>
                  <th className="p-3 text-right">Precio/Costo</th>
                  <th className="p-3 text-right">Monto Total</th>
                  <th className="p-3">Detalle / Concepto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800">
                {filteredMovements.map((mov) => {
                  const isPositive = mov.quantityChange > 0;
                  const isNegative = mov.quantityChange < 0;

                  return (
                    <tr key={mov.id} className="hover:bg-gray-50/80 transition">
                      {/* Date */}
                      <td className="p-3 font-medium text-gray-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span>{new Date(mov.date).toLocaleDateString()}</span>
                          <span className="text-gray-400">{new Date(mov.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </td>

                      {/* Operation Type Badge */}
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                          mov.type === 'venta_factura'
                            ? 'bg-sky-100 text-sky-800 border border-sky-200'
                            : mov.type === 'nota_entrega'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : mov.type === 'compra_proveedor'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : mov.type === 'pedido_tienda'
                                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                  : isPositive
                                    ? 'bg-teal-100 text-teal-800 border border-teal-200'
                                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {isPositive ? (
                            <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3 text-rose-600" />
                          )}
                          <span>{mov.typeLabel}</span>
                        </span>
                      </td>

                      {/* Reference / Invoice # */}
                      <td className="p-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                        <span className="text-[11px] bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                          {mov.referenceLabel || 'S/N'}
                        </span>
                      </td>

                      {/* Client / Provider */}
                      <td className="p-3 font-semibold text-gray-700 truncate max-w-xs">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-gray-400 shrink-0" />
                          <span className="truncate">{mov.clientOrProvider || 'Consumidor Final'}</span>
                        </div>
                      </td>

                      {/* Quantity change */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <span className={`font-mono font-black text-xs px-2 py-0.5 rounded ${
                          isPositive
                            ? 'bg-emerald-100 text-emerald-800'
                            : isNegative
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}>
                          {isPositive ? `+${mov.quantityChange}` : mov.quantityChange} {product.unit || 'un.'}
                        </span>
                      </td>

                      {/* Unit price */}
                      <td className="p-3 text-right font-semibold text-gray-600 whitespace-nowrap">
                        {mov.unitPrice ? `$${mov.unitPrice.toFixed(2)}` : '-'}
                      </td>

                      {/* Total Amount */}
                      <td className="p-3 text-right font-black text-gray-900 whitespace-nowrap">
                        {mov.totalAmount ? `$${mov.totalAmount.toFixed(2)}` : '-'}
                      </td>

                      {/* Notes / Concept */}
                      <td className="p-3 text-gray-600 max-w-xs truncate font-medium">
                        <span title={mov.notes || ''}>
                          {mov.notes || '-'}
                        </span>
                        {mov.operatorName && (
                          <span className="block text-[10px] text-gray-400">
                            Por: {mov.operatorName}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 text-xs">
          <div className="text-gray-500 font-medium text-center sm:text-left">
            Mostrando <strong>{filteredMovements.length}</strong> de <strong>{movements.length}</strong> movimientos registrados para <strong>{product.name}</strong>.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-montserrat font-extrabold text-xs rounded-xl transition cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProductHistoryModal;
