import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, Plus, Search, Calendar, Truck, FileText, CheckCircle2, 
  Trash2, Eye, RefreshCw, Download, Printer, ArrowUpRight, Package, 
  DollarSign, AlertCircle, X, Check, Layers, TrendingUp, Sparkles, User, Hash
} from 'lucide-react';
import { Product, Provider, Purchase, PurchaseItem } from '../types.ts';
import { dbService } from '../lib/supabase.ts';

interface ComprasModuleProps {
  products: Product[];
  providers: Provider[];
  onRefreshData: () => void;
  currencyRates?: Record<string, number>;
  activeRole?: string;
}

export default function ComprasModule({
  products,
  providers,
  onRefreshData,
  currencyRates = { VES: 0 },
  activeRole = 'admin'
}: ComprasModuleProps) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('all'); // all, today, this_month

  // Modal: Nueva Compra
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // Form State
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [customProviderName, setCustomProviderName] = useState<string>('');
  const [customProviderRif, setCustomProviderRif] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');
  const [updateProductCost, setUpdateProductCost] = useState<boolean>(true);

  // Dynamic Items State
  interface FormItem {
    id: string;
    product_id: string;
    product_name: string;
    sku: string;
    quantity: number;
    unit_cost: number;
    current_stock: number;
  }

  const [formItems, setFormItems] = useState<FormItem[]>([
    {
      id: 'item-1',
      product_id: '',
      product_name: '',
      sku: '',
      quantity: 1,
      unit_cost: 0,
      current_stock: 0
    }
  ]);

  // States for purchase payment method & accounts payable installments
  const [paymentMethod, setPaymentMethod] = useState<string>('Efectivo USD');
  const [installmentsCount, setInstallmentsCount] = useState<number>(1);
  const [installments, setInstallments] = useState<any[]>([]);

  // Automatically adjust installments when paymentMethod, count, or total changes
  useEffect(() => {
    if (paymentMethod === 'Crédito / CXP') {
      const count = Number(installmentsCount) || 1;
      let total = 0;
      formItems.forEach(item => {
        if (item.product_id && item.quantity > 0) {
          total += Number(item.quantity) * Number(item.unit_cost || 0);
        }
      });
      const baseAmount = Number((total / count).toFixed(2));
      
      setInstallments(prev => {
        const newInst = [];
        for (let i = 1; i <= count; i++) {
          const existing = prev.find(p => p.number === i);
          
          let dueDate = '';
          if (existing) {
            dueDate = existing.due_date;
          } else {
            const d = new Date();
            d.setDate(d.getDate() + (i * 15)); // Default: space out by 15 days
            dueDate = d.toISOString().split('T')[0];
          }

          newInst.push({
            number: i,
            due_date: dueDate,
            amount: existing ? existing.amount : baseAmount,
            status: 'pendiente'
          });
        }
        return newInst;
      });
    } else {
      setInstallments([]);
    }
  }, [paymentMethod, installmentsCount, formItems]);

  // Modal: Detalle de Compra
  const [selectedPurchaseDetail, setSelectedPurchaseDetail] = useState<Purchase | null>(null);

  // Floating Toast Notification
  const [toast, setToast] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    show: false,
    title: '',
    message: '',
    type: 'success'
  });

  const bcvRate = currencyRates?.VES || 0;

  // Load purchases on mount
  useEffect(() => {
    loadPurchases();
  }, []);

  const loadPurchases = async () => {
    setLoading(true);
    try {
      const data = await dbService.getPurchases();
      setPurchases(data);
    } catch (e) {
      console.error('Error fetching purchases:', e);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (title: string, message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, title, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 6000);
  };

  // Item Form Handlers
  const handleAddItemRow = () => {
    setFormItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        product_id: '',
        product_name: '',
        sku: '',
        quantity: 1,
        unit_cost: 0,
        current_stock: 0
      }
    ]);
  };

  const handleRemoveItemRow = (id: string) => {
    if (formItems.length === 1) {
      // Reset the only row rather than deleting
      setFormItems([{
        id: 'item-1',
        product_id: '',
        product_name: '',
        sku: '',
        quantity: 1,
        unit_cost: 0,
        current_stock: 0
      }]);
      return;
    }
    setFormItems(prev => prev.filter(item => item.id !== id));
  };

  const handleProductSelect = (rowId: string, productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) {
      setFormItems(prev => prev.map(item => 
        item.id === rowId 
          ? { ...item, product_id: '', product_name: '', sku: '', unit_cost: 0, current_stock: 0 }
          : item
      ));
      return;
    }

    setFormItems(prev => prev.map(item => {
      if (item.id === rowId) {
        return {
          ...item,
          product_id: prod.id,
          product_name: prod.name,
          sku: prod.sku || '',
          unit_cost: Number(prod.cost_price || prod.price || 0),
          current_stock: Number(prod.stock || 0)
        };
      }
      return item;
    }));
  };

  const handleItemFieldChange = (rowId: string, field: 'quantity' | 'unit_cost', value: number) => {
    setFormItems(prev => prev.map(item => {
      if (item.id === rowId) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Calculations for Form
  const formCalculations = useMemo(() => {
    let totalItemsCount = 0;
    let totalAmountUsd = 0;

    formItems.forEach(item => {
      if (item.product_id && item.quantity > 0) {
        totalItemsCount += Number(item.quantity);
        totalAmountUsd += Number(item.quantity) * Number(item.unit_cost || 0);
      }
    });

    const totalAmountBs = bcvRate > 0 ? totalAmountUsd * bcvRate : 0;

    return { totalItemsCount, totalAmountUsd, totalAmountBs };
  }, [formItems, bcvRate]);

  // Submit New Purchase Form
  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const validItems = formItems.filter(it => it.product_id && it.quantity > 0);
    if (validItems.length === 0) {
      alert('Debes seleccionar al menos un producto con cantidad mayor a cero.');
      return;
    }

    let finalProviderName = 'Proveedor General';
    let finalProviderRif = '';

    if (selectedProviderId) {
      const prov = providers.find(p => p.id === selectedProviderId);
      if (prov) {
        finalProviderName = prov.name;
        finalProviderRif = prov.rif;
      }
    } else if (customProviderName.trim()) {
      finalProviderName = customProviderName.trim();
      finalProviderRif = customProviderRif.trim();
    }

    if (!invoiceNumber.trim()) {
      alert('Por favor ingresa el número de Factura o comprobante de compra.');
      return;
    }

    setIsSubmitting(true);

    try {
      const itemsPayload: PurchaseItem[] = validItems.map(item => {
        const prod = products.find(p => p.id === item.product_id);
        const curStock = Number(prod?.stock || item.current_stock || 0);
        const qty = Number(item.quantity);
        const cost = Number(item.unit_cost || 0);

        return {
          product_id: item.product_id,
          product_name: item.product_name,
          sku: item.sku,
          quantity: qty,
          unit_cost: cost,
          subtotal: qty * cost,
          previous_stock: curStock,
          new_stock: curStock + qty
        };
      });

      const purchaseData: Omit<Purchase, 'id'> = {
        invoice_number: invoiceNumber.trim(),
        provider_id: selectedProviderId || undefined,
        provider_name: finalProviderName,
        provider_rif: finalProviderRif,
        date: purchaseDate || new Date().toISOString().split('T')[0],
        items: itemsPayload,
        total_amount: formCalculations.totalAmountUsd,
        total_items: formCalculations.totalItemsCount,
        status: paymentMethod === 'Crédito / CXP' ? 'pendiente' : 'completada',
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'Crédito / CXP' ? 'pendiente' : 'pagado',
        installments_count: paymentMethod === 'Crédito / CXP' ? installmentsCount : undefined,
        installments: paymentMethod === 'Crédito / CXP' ? installments : undefined,
        due_date: paymentMethod === 'Crédito / CXP' && installments.length > 0 ? installments[installments.length - 1].due_date : undefined,
        notes: notes.trim() || undefined,
        update_cost_applied: updateProductCost
      };

      const result = await dbService.createPurchase(purchaseData, updateProductCost);

      // Generate automatic CXP accounts in local storage for Balance module synchronization
      if (paymentMethod === 'Crédito / CXP' && installments && installments.length > 0) {
        try {
          const savedCxp = localStorage.getItem('copias_bellavista_cuentas_por_pagar');
          const cxpList = savedCxp ? JSON.parse(savedCxp) : [];
          
          installments.forEach((inst: any) => {
            const newCxp = {
              id: `cxp-pur-${result.purchase?.id || Date.now()}-${inst.number}`,
              provider_name: finalProviderName,
              concept: `Factura #${invoiceNumber} - Cuota #${inst.number} de ${installments.length}`,
              amount: Number(inst.amount || 0),
              amount_bs: Number(inst.amount || 0) * (bcvRate || 36.5),
              due_date: inst.due_date,
              observation: `Generado automáticamente desde Compra Factura #${invoiceNumber}`,
              created_at: new Date().toISOString(),
              status: 'pendiente'
            };
            cxpList.unshift(newCxp);
          });
          
          localStorage.setItem('copias_bellavista_cuentas_por_pagar', JSON.stringify(cxpList));
        } catch (le) {
          console.error('Error creating automatic CXP from purchase:', le);
        }
      }

      // Refresh data
      await loadPurchases();
      if (onRefreshData) {
        onRefreshData();
      }

      // Close modal & reset form
      setShowNewModal(false);
      resetForm();

      // Show rich floating toast
      const updatedCount = result.updatedProducts.length;
      showToast(
        '¡Compra e Inventario Actualizados!',
        `Factura #${purchaseData.invoice_number} guardada. Se incrementó el stock de ${updatedCount} ${updatedCount === 1 ? 'producto' : 'productos'} en el catálogo.`
      );
    } catch (err: any) {
      console.error('Error saving purchase:', err);
      alert(`Error al registrar la compra: ${err.message || err.toString()}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedProviderId('');
    setCustomProviderName('');
    setCustomProviderRif('');
    setInvoiceNumber('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setUpdateProductCost(true);
    setPaymentMethod('Efectivo USD');
    setInstallmentsCount(1);
    setInstallments([]);
    setFormItems([
      {
        id: 'item-1',
        product_id: '',
        product_name: '',
        sku: '',
        quantity: 1,
        unit_cost: 0,
        current_stock: 0
      }
    ]);
  };

  const handleDeletePurchase = async (id: string, invNum: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas anular/eliminar la compra Factura #${invNum}? (Nota: Esta acción no descontará automáticamente el stock ya ingresado).`)) {
      return;
    }

    try {
      await dbService.deletePurchase(id);
      await loadPurchases();
      showToast('Compra eliminada', `El registro de la factura #${invNum} fue removido del historial.`, 'info');
    } catch (e: any) {
      alert(`Error al eliminar la compra: ${e.message || e.toString()}`);
    }
  };

  // KPIs & Statistics
  const stats = useMemo(() => {
    const totalPurchasedUsd = purchases.reduce((sum, p) => sum + Number(p.total_amount || 0), 0);
    const totalPurchasedBs = bcvRate > 0 ? totalPurchasedUsd * bcvRate : 0;
    const totalPurchasesCount = purchases.length;
    
    let totalUnitsBought = 0;
    purchases.forEach(p => {
      if (Array.isArray(p.items)) {
        p.items.forEach(it => {
          totalUnitsBought += Number(it.quantity || 0);
        });
      }
    });

    const activeProvidersCount = providers.length;

    return {
      totalPurchasedUsd,
      totalPurchasedBs,
      totalPurchasesCount,
      totalUnitsBought,
      activeProvidersCount
    };
  }, [purchases, providers, bcvRate]);

  // Filtered Purchases List
  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      // Search query filter
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || (
        (p.invoice_number && p.invoice_number.toLowerCase().includes(q)) ||
        (p.purchase_number && p.purchase_number.toLowerCase().includes(q)) ||
        (p.provider_name && p.provider_name.toLowerCase().includes(q)) ||
        (p.provider_rif && p.provider_rif.toLowerCase().includes(q)) ||
        (p.date && p.date.toLowerCase().includes(q)) ||
        (p.items && p.items.some(it => it.product_name.toLowerCase().includes(q) || (it.sku && it.sku.toLowerCase().includes(q))))
      );

      // Date Filter
      let matchDate = true;
      if (dateFilter === 'today') {
        const todayStr = new Date().toISOString().split('T')[0];
        matchDate = p.date === todayStr || (p.created_at && p.created_at.startsWith(todayStr));
      } else if (dateFilter === 'this_month') {
        const currentMonthStr = new Date().toISOString().substring(0, 7); // YYYY-MM
        matchDate = (p.date && p.date.startsWith(currentMonthStr)) || (p.created_at && p.created_at.startsWith(currentMonthStr));
      }

      return matchSearch && matchDate;
    });
  }, [purchases, searchQuery, dateFilter]);

  // Print voucher helper
  const handlePrintVoucher = (purchase: Purchase) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor permite las ventanas emergentes (popups) para imprimir el comprobante de compra.');
      return;
    }

    const itemsRows = (purchase.items || []).map(it => `
      <tr>
        <td style="padding: 6px 8px; border-bottom: 1px solid #eee;">${it.product_name} <br/><small style="color:#777;">SKU: ${it.sku || 'N/A'}</small></td>
        <td style="padding: 6px 8px; text-align: center; border-bottom: 1px solid #eee;">${it.quantity}</td>
        <td style="padding: 6px 8px; text-align: right; border-bottom: 1px solid #eee;">$${Number(it.unit_cost || 0).toFixed(2)}</td>
        <td style="padding: 6px 8px; text-align: right; border-bottom: 1px solid #eee; font-weight: bold;">$${Number(it.subtotal || 0).toFixed(2)}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Comprobante de Compra #${purchase.invoice_number}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; color: #222; padding: 24px; max-width: 700px; margin: auto; }
          .header { border-bottom: 2px solid #005da9; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
          .title { font-size: 20px; font-weight: bold; color: #005da9; text-transform: uppercase; margin: 0; }
          .meta { margin-top: 4px; font-size: 12px; color: #555; }
          table { width: 100%; border-collapse: collapse; margin: 16px 0; }
          th { background: #f4f6f8; text-align: left; padding: 8px; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #ccc; }
          .totals { margin-top: 16px; text-align: right; font-size: 14px; }
          .totals-row { margin-bottom: 4px; }
          .grand-total { font-size: 18px; font-weight: bold; color: #005da9; margin-top: 8px; }
          .footer { margin-top: 30px; font-size: 11px; color: #888; text-align: center; border-top: 1px dashed #ccc; padding-top: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">COPIAS BELLA VISTA</h1>
            <div class="meta">Comprobante de Entrada / Registro de Compra</div>
            <div class="meta"><strong>Factura Proveedor:</strong> ${purchase.invoice_number}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 12px; font-weight: bold;">Fecha: ${purchase.date}</div>
            <div style="font-size: 11px; color: #666;">ID: ${purchase.purchase_number || purchase.id}</div>
          </div>
        </div>

        <div style="background: #f8fafc; padding: 12px; border-radius: 6px; margin-bottom: 16px;">
          <div><strong>Proveedor:</strong> ${purchase.provider_name}</div>
          ${purchase.provider_rif ? `<div><strong>RIF / Cédula:</strong> ${purchase.provider_rif}</div>` : ''}
          ${purchase.notes ? `<div style="margin-top: 4px; color: #555;"><strong>Notas:</strong> ${purchase.notes}</div>` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th>Producto / Descripción</th>
              <th style="text-align: center;">Cant.</th>
              <th style="text-align: right;">Costo Unit.</th>
              <th style="text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-row"><strong>Artículos Ingresados:</strong> ${purchase.total_items || purchase.items.length}</div>
          <div class="totals-row grand-total">TOTAL COMPRA: $${Number(purchase.total_amount || 0).toFixed(2)} USD</div>
          ${bcvRate > 0 ? `<div style="color: #666; font-size: 12px;">Equivalente BCV: Bs. ${(Number(purchase.total_amount || 0) * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</div>` : ''}
        </div>

        <div class="footer">
          Documento interno de control de inventario y compras - Sistema Copias Bella Vista
        </div>
        <script>
          window.print();
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 text-left" id="modulo-compras-inventario">
      {/* FLOATING SUCCESS TOAST NOTIFICATION */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-white border-2 border-emerald-500 rounded-2xl p-4 shadow-2xl flex items-start gap-3.5 animate-bounce-short transition-all duration-300">
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-black text-gray-900 uppercase tracking-tight">{toast.title}</h4>
            <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{toast.message}</p>
          </div>
          <button 
            onClick={() => setToast(prev => ({ ...prev, show: false }))}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* HEADER SECTION WITH TITLE & ACTION BUTTON */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-[#131921] uppercase tracking-tight flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-[#005da9] rounded-xl">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <span>Compras e Ingreso de Inventario</span>
          </h2>
          <p className="text-xs text-gray-500 font-medium mt-1">
            Registra facturas de proveedores, abastece el inventario con incremento de stock automático y actualiza costos.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => loadPurchases()}
            disabled={loading}
            className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition cursor-pointer border border-gray-200"
            title="Refrescar Compras"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#005da9]' : ''}`} />
          </button>

          <button
            onClick={() => {
              resetForm();
              setShowNewModal(true);
            }}
            className="px-4 py-2.5 bg-[#005da9] hover:bg-[#004a87] text-white text-xs font-black rounded-xl transition shadow-md hover:shadow-lg uppercase tracking-wider flex items-center gap-2 shrink-0 cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Nueva Compra</span>
          </button>
        </div>
      </div>

      {/* TOP KPI / STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invertido */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3.5 relative overflow-hidden group hover:border-blue-300 transition">
          <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Total Comprado (Histórico)</span>
            <span className="text-lg font-black text-gray-900 block font-mono">
              ${stats.totalPurchasedUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </span>
            {bcvRate > 0 && (
              <span className="text-[10px] font-bold text-gray-500 block">
                ≈ Bs. {stats.totalPurchasedBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>
          <div className="absolute -right-2 -bottom-2 opacity-5 pointer-events-none group-hover:scale-110 transition duration-300">
            <DollarSign className="w-20 h-20 text-blue-900" />
          </div>
        </div>

        {/* Total Compras Registradas */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3.5 relative overflow-hidden group hover:border-emerald-300 transition">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Compras Realizadas</span>
            <span className="text-lg font-black text-gray-900 block font-mono">
              {stats.totalPurchasesCount} {stats.totalPurchasesCount === 1 ? 'Factura' : 'Facturas'}
            </span>
            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
              <Check className="w-3 h-3" /> Transacciones validadas
            </span>
          </div>
          <div className="absolute -right-2 -bottom-2 opacity-5 pointer-events-none group-hover:scale-110 transition duration-300">
            <FileText className="w-20 h-20 text-emerald-900" />
          </div>
        </div>

        {/* Unidades Ingresadas al Stock */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3.5 relative overflow-hidden group hover:border-amber-300 transition">
          <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Unidades Ingresadas</span>
            <span className="text-lg font-black text-gray-900 block font-mono">
              {stats.totalUnitsBought} {stats.totalUnitsBought === 1 ? 'unidad' : 'unidades'}
            </span>
            <span className="text-[10px] font-bold text-amber-700 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" /> Incremento en inventario
            </span>
          </div>
          <div className="absolute -right-2 -bottom-2 opacity-5 pointer-events-none group-hover:scale-110 transition duration-300">
            <Layers className="w-20 h-20 text-amber-900" />
          </div>
        </div>

        {/* Proveedores Activos */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3.5 relative overflow-hidden group hover:border-purple-300 transition">
          <div className="p-3 bg-purple-50 text-purple-700 rounded-xl">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Proveedores Registrados</span>
            <span className="text-lg font-black text-gray-900 block font-mono">
              {stats.activeProvidersCount} {stats.activeProvidersCount === 1 ? 'Proveedor' : 'Proveedores'}
            </span>
            <span className="text-[10px] font-bold text-purple-700 block">
              Red de distribución activa
            </span>
          </div>
          <div className="absolute -right-2 -bottom-2 opacity-5 pointer-events-none group-hover:scale-110 transition duration-300">
            <Truck className="w-20 h-20 text-purple-900" />
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por N° Factura, proveedor, producto o fecha..."
            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#005da9]"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200">
            <button
              onClick={() => setDateFilter('all')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                dateFilter === 'all' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setDateFilter('this_month')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                dateFilter === 'this_month' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Este Mes
            </button>
            <button
              onClick={() => setDateFilter('today')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                dateFilter === 'today' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Hoy
            </button>
          </div>

          <span className="text-[11px] font-bold text-gray-400 ml-2 hidden sm:inline">
            Mostrando {filteredPurchases.length} de {purchases.length}
          </span>
        </div>
      </div>

      {/* PURCHASES TABLE / HISTORY */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#005da9]" />
            <span>Historial de Compras Recientes ({filteredPurchases.length})</span>
          </h3>
          <span className="text-[11px] text-gray-500 font-medium">
            Tasa BCV del día: <strong className="font-mono text-[#005da9]">Bs. {bcvRate.toFixed(2)}/USD</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5">Factura N° / Código</th>
                <th className="p-3.5">Fecha</th>
                <th className="p-3.5">Proveedor</th>
                <th className="p-3.5">Ítems Ingresados</th>
                <th className="p-3.5 text-right">Total ($ USD)</th>
                <th className="p-3.5 text-right">Total (Bs.)</th>
                <th className="p-3.5 text-center">Estado</th>
                <th className="p-3.5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#005da9]" />
                    <span>Cargando historial de compras...</span>
                  </td>
                </tr>
              ) : filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="p-4 bg-gray-50 text-gray-400 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
                        <ShoppingBag className="w-8 h-8" />
                      </div>
                      <h4 className="font-black text-gray-800 text-sm">No se encontraron registros de compra</h4>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        {searchQuery ? 'No hay resultados que coincidan con la búsqueda.' : 'Aún no has registrado compras para reabastecer el inventario.'}
                      </p>
                      <button
                        onClick={() => {
                          resetForm();
                          setShowNewModal(true);
                        }}
                        className="px-4 py-2 bg-[#005da9] hover:bg-[#004a87] text-white font-black text-xs rounded-xl transition inline-flex items-center gap-1.5 shadow-sm"
                      >
                        <Plus className="w-4 h-4 stroke-[3]" />
                        <span>Registrar Primera Compra</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((purchase) => {
                  const totalUsd = Number(purchase.total_amount || 0);
                  const totalBs = bcvRate > 0 ? totalUsd * bcvRate : 0;
                  const itemsCount = purchase.total_items || (purchase.items?.reduce((s, it) => s + Number(it.quantity || 0), 0)) || 0;

                  return (
                    <tr key={purchase.id} className="hover:bg-gray-50/80 transition group">
                      <td className="p-3.5">
                        <div className="font-mono font-black text-gray-900 text-xs flex items-center gap-1.5">
                          <Hash className="w-3.5 h-3.5 text-[#005da9]" />
                          <span>{purchase.invoice_number}</span>
                        </div>
                        {purchase.purchase_number && purchase.purchase_number !== purchase.invoice_number && (
                          <span className="text-[10px] text-gray-400 font-mono block">
                            Ref: {purchase.purchase_number}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-gray-600 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span>{purchase.date}</span>
                        </div>
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-gray-900">{purchase.provider_name || 'Proveedor General'}</div>
                        <div className="flex flex-wrap gap-1 mt-0.5 items-center">
                          {purchase.provider_rif && (
                            <span className="text-[10px] text-gray-400 font-mono">RIF: {purchase.provider_rif}</span>
                          )}
                          {purchase.payment_method && (
                            <span className="text-[8px] bg-slate-100 text-slate-700 border border-slate-200 font-black px-1.5 py-0.5 rounded uppercase">
                              {purchase.payment_method}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-blue-50 text-[#005da9] rounded-md font-black text-[11px]">
                            {itemsCount} {itemsCount === 1 ? 'ud.' : 'uds.'}
                          </span>
                          <span className="text-[11px] text-gray-500 truncate max-w-[180px]" title={purchase.items?.map(it => `${it.quantity}x ${it.product_name}`).join(', ')}>
                            {purchase.items?.length || 0} {purchase.items?.length === 1 ? 'producto' : 'productos'}
                          </span>
                        </div>
                      </td>

                      <td className="p-3.5 text-right font-mono font-black text-gray-900 text-xs">
                        ${totalUsd.toFixed(2)}
                      </td>

                      <td className="p-3.5 text-right font-mono font-bold text-gray-600 text-xs">
                        Bs. {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td className="p-3.5 text-center">
                        {purchase.status === 'pendiente' ? (
                          <span className="px-2.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black rounded-full uppercase tracking-wider inline-flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            <span>Pendiente CXP</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-black rounded-full uppercase tracking-wider inline-flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            <span>Completada</span>
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedPurchaseDetail(purchase)}
                            className="p-1.5 text-gray-500 hover:text-[#005da9] hover:bg-blue-50 rounded-lg transition"
                            title="Ver Detalle de la Compra"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePrintVoucher(purchase)}
                            className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                            title="Imprimir Comprobante"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePurchase(purchase.id, purchase.invoice_number)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Eliminar Registro de Compra"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: REGISTRAR NUEVA COMPRA (CON INCREMENTO RELATIVO DE STOCK)          */}
      {/* ========================================================================= */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-gray-100 w-full max-w-4xl shadow-2xl overflow-hidden text-left flex flex-col my-auto max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-linear-to-r from-[#005da9] to-[#0077d9] text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black uppercase tracking-tight">Registrar Nueva Compra</h3>
                  <p className="text-[11px] text-blue-100 font-medium">
                    Ingresa los datos de la factura y abastece el stock de tus productos
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isSubmitting) setShowNewModal(false);
                }}
                disabled={isSubmitting}
                className="p-1.5 hover:bg-white/20 text-white rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSavePurchase} className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
              {/* SECTION 1: CABECERA DE FACTURA Y PROVEEDOR */}
              <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-200/80 space-y-4">
                <h4 className="text-xs font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#005da9]" />
                  <span>1. Datos del Proveedor y Factura</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Selector de Proveedor */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">
                      Proveedor *
                    </label>
                    <select
                      value={selectedProviderId}
                      onChange={(e) => {
                        setSelectedProviderId(e.target.value);
                        if (e.target.value) {
                          const prov = providers.find(p => p.id === e.target.value);
                          if (prov) {
                            setCustomProviderName(prov.name);
                            setCustomProviderRif(prov.rif);
                          }
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005da9]"
                    >
                      <option value="">-- Seleccionar Proveedor --</option>
                      {providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.rif})
                        </option>
                      ))}
                      <option value="otro">➕ Otro (Ingresar manual)</option>
                    </select>
                  </div>

                  {/* Factura N° */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">
                      Factura N° / Control *
                    </label>
                    <input
                      type="text"
                      required
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="Ej: FAC-009842"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005da9]"
                    />
                  </div>

                  {/* Fecha de Compra */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">
                      Fecha de la Factura *
                    </label>
                    <input
                      type="date"
                      required
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005da9]"
                    />
                  </div>
                </div>

                {/* Método de Pago y Financiación */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2 border-t border-gray-150">
                  {/* Método de Pago */}
                  <div className="sm:col-span-2 text-left">
                    <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">
                      Método de Pago *
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005da9]"
                    >
                      <option value="Efectivo USD">💵 Efectivo USD</option>
                      <option value="Efectivo Bs">💵 Efectivo Bs</option>
                      <option value="Transferencia">🏦 Transferencia Bancaria</option>
                      <option value="Pago Móvil">📱 Pago Móvil</option>
                      <option value="Punto de Venta">💳 Punto de Venta</option>
                      <option value="Zelle">🇺🇸 Zelle</option>
                      <option value="Crédito / CXP">⏳ Crédito / Cuenta por Pagar (CXP)</option>
                    </select>
                  </div>

                  {paymentMethod === 'Crédito / CXP' && (
                    <div className="sm:col-span-2 text-left">
                      <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">
                        Cantidad de Cuotas * (Máximo 6)
                      </label>
                      <select
                        value={installmentsCount}
                        onChange={(e) => setInstallmentsCount(Number(e.target.value))}
                        required
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005da9]"
                      >
                        {[1, 2, 3, 4, 5, 6].map(num => (
                          <option key={num} value={num}>{num} {num === 1 ? 'Cuota' : 'Cuotas'}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* DYNAMIC INSTALLMENTS GRID */}
                {paymentMethod === 'Crédito / CXP' && installments.length > 0 && (
                  <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 space-y-3 pt-2 text-left">
                    <h5 className="text-[10px] font-black uppercase text-blue-800 tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-700" />
                      <span>Calendario de Vencimientos de Cuotas (CXP)</span>
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {installments.map((inst, index) => (
                        <div key={inst.number} className="bg-white border border-gray-200 p-3 rounded-xl space-y-1.5 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded-md font-black">
                              Cuota #{inst.number}
                            </span>
                            <span className="text-[9px] text-gray-400 font-bold">Vence en {index * 15 + 15} días</span>
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[9px] font-bold text-gray-400 uppercase">Fecha de Vencimiento</label>
                            <input
                              type="date"
                              required
                              value={inst.due_date}
                              onChange={(e) => {
                                const newDate = e.target.value;
                                setInstallments(prev => prev.map(p => p.number === inst.number ? { ...p, due_date: newDate } : p));
                              }}
                              className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#005da9]"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[9px] font-bold text-gray-400 uppercase">Monto (USD)</label>
                            <input
                              type="number"
                              required
                              step="0.01"
                              min="0"
                              value={inst.amount}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setInstallments(prev => prev.map(p => p.number === inst.number ? { ...p, amount: val } : p));
                              }}
                              className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#005da9]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-bold text-blue-900 border-t border-blue-100 pt-2 bg-blue-50/20 px-1 rounded-md">
                      <span>Total de cuotas de Crédito:</span>
                      <span className="font-mono font-black text-xs">
                        ${installments.reduce((sum, item) => sum + (Number(item.amount) || 0), 0).toFixed(2)} USD
                      </span>
                    </div>
                  </div>
                )}

                {/* Si seleccionó 'otro' o no hay proveedor en lista */}
                {(selectedProviderId === 'otro' || (providers.length === 0 && !selectedProviderId)) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-200">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">
                        Nombre / Razón Social del Proveedor *
                      </label>
                      <input
                        type="text"
                        required
                        value={customProviderName}
                        onChange={(e) => setCustomProviderName(e.target.value)}
                        placeholder="Ej: Distribuidora Central C.A."
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005da9]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">
                        RIF / Cédula del Proveedor
                      </label>
                      <input
                        type="text"
                        value={customProviderRif}
                        onChange={(e) => setCustomProviderRif(e.target.value)}
                        placeholder="Ej: J-12345678-0"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005da9]"
                      />
                    </div>
                  </div>
                )}

                {/* Checkbox: Actualizar Costo de Compra */}
                <div className="pt-2 border-t border-gray-200 flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={updateProductCost}
                      onChange={(e) => setUpdateProductCost(e.target.checked)}
                      className="w-4 h-4 text-[#005da9] rounded focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-gray-700">
                      Actualizar automáticamente el costo unitario (<code className="text-blue-700">cost_price</code>) en la ficha del producto si varió.
                    </span>
                  </label>

                  <span className="text-[10px] font-bold text-gray-400 hidden sm:inline">
                    Lógica de Stock: Stock Nuevo = Actual + Comprado
                  </span>
                </div>
              </div>

              {/* SECTION 2: LISTA DINÁMICA DE PRODUCTOS A INGRESAR */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#005da9]" />
                    <span>2. Productos e Incremento de Inventario ({formItems.length})</span>
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#005da9] font-black text-xs rounded-xl transition flex items-center gap-1.5 border border-blue-200 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>+ Agregar Producto</span>
                  </button>
                </div>

                {/* Items Dynamic Rows */}
                <div className="space-y-3">
                  {formItems.map((item, index) => {
                    const rowSubtotal = Number(item.quantity || 0) * Number(item.unit_cost || 0);
                    const calculatedNewStock = Number(item.current_stock || 0) + Number(item.quantity || 0);

                    return (
                      <div 
                        key={item.id} 
                        className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs hover:border-gray-300 transition space-y-3"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                          {/* Fila # y Selector de Producto */}
                          <div className="sm:col-span-5">
                            <label className="block text-[9px] font-black uppercase text-gray-400 mb-1">
                              Producto {index + 1} *
                            </label>
                            <select
                              required
                              value={item.product_id}
                              onChange={(e) => handleProductSelect(item.id, e.target.value)}
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005da9]"
                            >
                              <option value="">-- Selecciona un producto del catálogo --</option>
                              {products.map((prod) => (
                                <option key={prod.id} value={prod.id}>
                                  {prod.name} {prod.sku ? `[SKU: ${prod.sku}]` : ''} — Stock Actual: {prod.stock || 0}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Cantidad Comprada */}
                          <div className="sm:col-span-2">
                            <label className="block text-[9px] font-black uppercase text-gray-400 mb-1">
                              Cant. Comprada *
                            </label>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              required
                              value={item.quantity}
                              onChange={(e) => handleItemFieldChange(item.id, 'quantity', Math.max(1, parseInt(e.target.value, 10) || 1))}
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#005da9] text-center"
                            />
                          </div>

                          {/* Costo Unitario USD */}
                          <div className="sm:col-span-2">
                            <label className="block text-[9px] font-black uppercase text-gray-400 mb-1">
                              Costo Unit. ($) *
                            </label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-xs">$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                required
                                value={item.unit_cost}
                                onChange={(e) => handleItemFieldChange(item.id, 'unit_cost', parseFloat(e.target.value) || 0)}
                                className="w-full pl-6 pr-2 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#005da9]"
                              />
                            </div>
                          </div>

                          {/* Subtotal */}
                          <div className="sm:col-span-2 text-right">
                            <label className="block text-[9px] font-black uppercase text-gray-400 mb-1">
                              Subtotal
                            </label>
                            <div className="font-mono font-black text-gray-900 text-xs py-2">
                              ${rowSubtotal.toFixed(2)}
                            </div>
                          </div>

                          {/* Botón Eliminar Fila */}
                          <div className="sm:col-span-1 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(item.id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer mt-3 sm:mt-0"
                              title="Eliminar fila"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* IMPACTO EN EL STOCK (INDICADOR VISUAL OBLIGATORIO) */}
                        {item.product_id && (
                          <div className="bg-blue-50/70 p-2 rounded-xl flex items-center justify-between text-[11px] border border-blue-100">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 font-medium">Actualización de Inventario:</span>
                              <span className="font-mono font-bold text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-200">
                                Stock Actual: {item.current_stock}
                              </span>
                              <span className="text-blue-700 font-bold">+</span>
                              <span className="font-mono font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                                Comprado: {item.quantity}
                              </span>
                              <span className="text-gray-400 font-bold">➔</span>
                              <span className="font-mono font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                Stock Nuevo: {calculatedNewStock}
                              </span>
                            </div>

                            {item.sku && (
                              <span className="text-gray-400 font-mono text-[10px] hidden md:inline">
                                SKU: {item.sku}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 3: NOTAS Y RESUMEN TOTAL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">
                    Notas u Observaciones (Opcional)
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Detalles sobre entrega, crédito, forma de pago u observaciones..."
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005da9]"
                  />
                </div>

                <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col justify-between shadow-md">
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Artículos Totales a Ingresar:</span>
                      <span className="font-mono font-black text-white">{formCalculations.totalItemsCount} unidades</span>
                    </div>
                    {bcvRate > 0 && (
                      <div className="flex justify-between text-slate-400 text-[11px]">
                        <span>Tasa BCV Aplicable:</span>
                        <span className="font-mono">Bs. {bcvRate.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-700 pt-2.5 mt-2 flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                        TOTAL FACTURA DE COMPRA
                      </span>
                      <span className="text-xl font-black font-mono text-emerald-400">
                        ${formCalculations.totalAmountUsd.toFixed(2)} USD
                      </span>
                    </div>
                    {bcvRate > 0 && (
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-slate-300 block">
                          Bs. {formCalculations.totalAmountBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-[#005da9] hover:bg-[#004a87] text-white text-xs font-black rounded-xl transition shadow-lg hover:shadow-xl uppercase tracking-wider flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Actualizando Inventario...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Guardar Compra e Incrementar Stock</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DETALLE COMPLETO DE COMPRA                                         */}
      {/* ========================================================================= */}
      {selectedPurchaseDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-gray-150 w-full max-w-2xl shadow-2xl overflow-hidden text-left flex flex-col my-auto">
            {/* Header */}
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-[#005da9] rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-gray-900 uppercase tracking-tight">
                    Detalle de Compra: Factura #{selectedPurchaseDetail.invoice_number}
                  </h3>
                  <span className="text-[10px] text-gray-500 font-mono">
                    Fecha: {selectedPurchaseDetail.date} | Ref: {selectedPurchaseDetail.purchase_number || selectedPurchaseDetail.id}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedPurchaseDetail(null)}
                className="p-1.5 hover:bg-gray-200 text-gray-400 hover:text-gray-600 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Provider info card */}
              <div className="bg-blue-50/50 p-3.5 rounded-2xl border border-blue-100 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-black uppercase text-gray-400 block">Proveedor</span>
                  <h4 className="font-bold text-xs text-gray-900">{selectedPurchaseDetail.provider_name}</h4>
                  {selectedPurchaseDetail.provider_rif && (
                    <span className="text-[10px] text-gray-500 font-mono">RIF: {selectedPurchaseDetail.provider_rif}</span>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[9px] font-black uppercase text-gray-400 block">Estado</span>
                  <span className={`px-2.5 py-0.5 text-[10px] font-black rounded-full uppercase ${
                    selectedPurchaseDetail.status === 'pendiente' 
                      ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}>
                    {selectedPurchaseDetail.status || 'Completada'}
                  </span>
                </div>
              </div>

              {/* Payment Method & CXP Installments Info */}
              <div className="bg-gray-50 border border-gray-150 p-3.5 rounded-2xl text-left space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <div>
                    <span className="text-[9px] font-black uppercase text-gray-400 block">Método de Pago</span>
                    <span className="font-bold text-gray-800">{selectedPurchaseDetail.payment_method || 'Efectivo USD'}</span>
                  </div>
                  {selectedPurchaseDetail.payment_status && (
                    <div className="text-right">
                      <span className="text-[9px] font-black uppercase text-gray-400 block">Pago de Compra</span>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                        selectedPurchaseDetail.payment_status === 'pendiente'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {selectedPurchaseDetail.payment_status === 'pendiente' ? 'Pendiente / Crédito' : 'Pagado'}
                      </span>
                    </div>
                  )}
                </div>

                {/* List of installments if credit */}
                {selectedPurchaseDetail.payment_method === 'Crédito / CXP' && selectedPurchaseDetail.installments && selectedPurchaseDetail.installments.length > 0 && (
                  <div className="pt-2 border-t border-gray-200 space-y-2">
                    <span className="text-[9px] font-black uppercase text-blue-700 block">Calendario de Cuotas (Cuentas por Pagar)</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {selectedPurchaseDetail.installments.map((inst: any, idx: number) => (
                        <div key={idx} className="bg-white p-2 border border-gray-150 rounded-xl space-y-1 text-[11px]">
                          <div className="flex justify-between items-center">
                            <span className="font-black text-slate-800">Cuota #{inst.number}</span>
                            <span className={`text-[8px] font-black px-1.5 rounded-full uppercase ${
                              inst.status === 'pagado' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {inst.status}
                            </span>
                          </div>
                          <div className="text-gray-500 font-medium font-mono text-[10px]">Vence: {inst.due_date}</div>
                          <div className="font-mono font-black text-gray-900">${Number(inst.amount).toFixed(2)} USD</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Items Breakdown Table */}
              <div>
                <h4 className="text-xs font-black text-gray-800 uppercase tracking-wider mb-2">
                  Productos y Cantidades Compradas
                </h4>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5">Producto</th>
                        <th className="p-2.5 text-center">Cant.</th>
                        <th className="p-2.5 text-right">Costo Unit.</th>
                        <th className="p-2.5 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium">
                      {(selectedPurchaseDetail.items || []).map((it, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50">
                          <td className="p-2.5">
                            <div className="font-bold text-gray-800">{it.product_name}</div>
                            {it.sku && <div className="text-[10px] text-gray-400 font-mono">SKU: {it.sku}</div>}
                          </td>
                          <td className="p-2.5 text-center font-mono font-black text-blue-700">
                            +{it.quantity}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-gray-700">
                            ${Number(it.unit_cost || 0).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono font-black text-gray-900">
                            ${Number(it.subtotal || (it.quantity * it.unit_cost) || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes if any */}
              {selectedPurchaseDetail.notes && (
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs text-gray-600">
                  <strong>Notas:</strong> {selectedPurchaseDetail.notes}
                </div>
              )}

              {/* Total Card */}
              <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Total de la Compra</span>
                  <span className="text-xl font-mono font-black text-emerald-400">
                    ${Number(selectedPurchaseDetail.total_amount || 0).toFixed(2)} USD
                  </span>
                </div>
                {bcvRate > 0 && (
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-slate-300 block">
                      Bs. {(Number(selectedPurchaseDetail.total_amount || 0) * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
              <button
                onClick={() => handlePrintVoucher(selectedPurchaseDetail)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Comprobante</span>
              </button>

              <button
                onClick={() => setSelectedPurchaseDetail(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-black rounded-xl transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
