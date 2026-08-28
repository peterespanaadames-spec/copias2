import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, SlidersHorizontal, Plus, Trash2, Eye, X, 
  FileText, User, Smartphone, Mail, Sparkles, 
  Settings, Loader2, CheckCircle2, FileCheck, Share2, Printer, 
  Calendar, Tag, DollarSign, Clock, AlertTriangle, ShieldCheck,
  Check, Edit3, PackageCheck, RotateCcw
} from 'lucide-react';
import { dbService } from '../lib/supabase';
import { Product, Quote, QuoteItem, BusinessProfile } from '../types';

const DEFAULT_QUOTE_NOTES = `1. Precios expresados en USD. Pago en Bolívares a la tasa oficial BCV del día.
2. Presupuesto válido según el tiempo de expiración seleccionado.
3. Se requiere un anticipo del 50% para iniciar la producción/trabajo y el 50% restante al momento de la entrega.
4. Los tiempos de entrega comienzan a contarse a partir de la confirmación del diseño y del pago del anticipo.`;

const unifyClients = (dbClientsList: any[], invoicesList: any[], quotesList: any[]) => {
  const map = new Map<string, any>();

  // 1. DB / Local clients
  (dbClientsList || []).forEach(c => {
    const name = c.name || c.nombre || c.customer_name;
    if (!name) return;
    const key = (c.id || c.document || c.rif || name).toString().trim().toLowerCase();
    map.set(key, {
      id: c.id || key,
      name: name.trim(),
      phone: c.phone || c.telefono || c.phone_number || '',
      email: c.email || c.correo || c.customer_email || '',
      document: c.document || c.rif || c.doc_number || c.customer_document || ''
    });
  });

  // 2. Invoices clients
  (invoicesList || []).forEach(inv => {
    const name = inv.customer_name;
    if (!name || name.toLowerCase() === 'consumidor final') return;
    const key = (inv.customer_id || inv.customer_document || inv.rif || name).toString().trim().toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        id: inv.customer_id || key,
        name: name.trim(),
        phone: inv.phone_number || inv.phone || '',
        email: inv.customer_email || inv.email || '',
        document: inv.customer_document || inv.rif || ''
      });
    }
  });

  // 3. Quotes clients
  (quotesList || []).forEach(q => {
    const name = q.client_name;
    if (!name || name.toLowerCase() === 'consumidor final') return;
    const key = (q.client_id || name).toString().trim().toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        id: q.client_id || key,
        name: name.trim(),
        phone: q.client_phone || '',
        email: q.client_email || '',
        document: ''
      });
    }
  });

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
};

interface CotizacionesPageProps {
  products: Product[];
  bcvRate: number;
  onRefreshData: () => void;
}

export default function CotizacionesPage({
  products,
  bcvRate,
  onRefreshData
}: CotizacionesPageProps) {
  // Business Profile
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);

  // Quotes and clients list states
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState('todos');
  const [selectedStatus, setSelectedStatus] = useState('todos');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  
  // Billing/Conversion to Sale Modal State
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [billingPaymentMethod, setBillingPaymentMethod] = useState('Pago Móvil');
  const [billingPaymentStatus, setBillingPaymentStatus] = useState<'pagado' | 'credito'>('pagado');
  const [isBilling, setIsBilling] = useState(false);

  // Create Form State
  const [formClientType, setFormClientType] = useState<'existing' | 'new'>('existing');
  const [formClientId, setFormClientId] = useState('');
  const [formClientName, setFormClientName] = useState('');
  const [formClientPhone, setFormClientPhone] = useState('');
  const [formClientEmail, setFormClientEmail] = useState('');
  const [formSellerName, setFormSellerName] = useState('Vendedor Principal');
  const [formConcept, setFormConcept] = useState('');
  const [formNotes, setFormNotes] = useState(DEFAULT_QUOTE_NOTES);
  
  // Expiration Options: '7', '15', '30', 'none', 'custom'
  const [formExpirationDays, setFormExpirationDays] = useState<string>('15');
  const [formCustomExpirationDate, setFormCustomExpirationDate] = useState<string>('');

  // Items Picker State
  const [formItems, setFormItems] = useState<QuoteItem[]>([]);
  const [itemPickerTab, setItemPickerTab] = useState<'catalog' | 'libre'>('catalog');

  // Catalog Item State
  const [selectedProdId, setSelectedProdId] = useState('');
  const [catalogQty, setCatalogQty] = useState<number>(1);
  const [catalogCustomPrice, setCatalogCustomPrice] = useState('');

  // Free/Libre Item State
  const [freeConceptName, setFreeConceptName] = useState('');
  const [freeQty, setFreeQty] = useState<number>(1);
  const [freePrice, setFreePrice] = useState('');

  // Search filter query for products in catalog tab
  const [searchProdQuery, setSearchProdQuery] = useState('');

  const normalizeText = (text: string) =>
    text ? text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';

  const filteredProductsForSelect = useMemo(() => {
    if (!searchProdQuery.trim()) return products;
    const q = normalizeText(searchProdQuery);
    const words = q.split(/\s+/).filter(Boolean);

    return products.filter(p => {
      const name = normalizeText(p.name);
      const sku = normalizeText(p.sku || '');
      const category = normalizeText((p as any).category_name || (p as any).category || '');
      const brand = normalizeText((p as any).brand_name || (p as any).brand || '');
      const desc = normalizeText((p as any).description || '');

      const combined = `${name} ${sku} ${category} ${brand} ${desc}`;
      return words.every(word => combined.includes(word));
    });
  }, [products, searchProdQuery]);

  // Auto-select first matching product when typing search query if current selected is invalid or empty
  useEffect(() => {
    if (searchProdQuery.trim()) {
      if (filteredProductsForSelect.length > 0) {
        const isCurrentValid = filteredProductsForSelect.some(p => p.id === selectedProdId);
        if (!isCurrentValid) {
          const firstMatch = filteredProductsForSelect[0];
          setSelectedProdId(firstMatch.id);
          setCatalogCustomPrice(firstMatch.price.toString());
        }
      } else {
        setSelectedProdId('');
        setCatalogCustomPrice('');
      }
    }
  }, [searchProdQuery, filteredProductsForSelect]);

  // Optional Financial Breakdown
  const [formDiscountAmount, setFormDiscountAmount] = useState<string>('0');
  const [formTaxPercent, setFormTaxPercent] = useState<string>('0');

  // Premium Banner State
  const [showPremiumBanner, setShowPremiumBanner] = useState(true);

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [quotesData, dbClientsList, invoicesList, profileData] = await Promise.all([
        dbService.getQuotes(),
        dbService.getClients(),
        dbService.getInvoices(),
        dbService.getBusinessProfile()
      ]);
      setQuotes(quotesData);

      const combinedClients = unifyClients(dbClientsList, invoicesList, quotesData);
      setClients(combinedClients);

      if (profileData) setBusinessProfile(profileData);
    } catch (error) {
      console.error('Error fetching quotes/clients/profile:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    window.addEventListener('bellavista_business_profile_updated', fetchData);
    window.addEventListener('bellavista_settings_updated', fetchData);
    return () => {
      window.removeEventListener('bellavista_business_profile_updated', fetchData);
      window.removeEventListener('bellavista_settings_updated', fetchData);
    };
  }, []);

  // Open Create Modal Handler
  const handleOpenCreateModal = async () => {
    try {
      const [dbClientsList, invoicesList, quotesList] = await Promise.all([
        dbService.getClients(),
        dbService.getInvoices(),
        dbService.getQuotes()
      ]);
      const combinedClients = unifyClients(dbClientsList, invoicesList, quotesList);
      setClients(combinedClients);
    } catch (e) {
      console.warn('Error refreshing clients list:', e);
    }

    setFormClientType('existing');
    setFormClientId('');
    setFormClientName('');
    setFormClientPhone('');
    setFormClientEmail('');
    setFormSellerName('Vendedor Principal');
    setFormConcept('');
    setFormNotes(DEFAULT_QUOTE_NOTES);
    setFormExpirationDays('15');
    setFormCustomExpirationDate('');
    setFormItems([]);
    setFormDiscountAmount('0');
    setFormTaxPercent('0');

    setItemPickerTab('catalog');
    setSelectedProdId('');
    setCatalogQty(1);
    setCatalogCustomPrice('');

    setFreeConceptName('');
    setFreeQty(1);
    setFreePrice('');

    setShowCreateModal(true);
  };

  // Calculate Expiration Date based on selection
  const calculatedExpirationDate = useMemo(() => {
    if (formExpirationDays === 'none') return null;
    if (formExpirationDays === 'custom') return formCustomExpirationDate || null;
    
    const days = parseInt(formExpirationDays, 10);
    if (isNaN(days)) return null;

    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
  }, [formExpirationDays, formCustomExpirationDate]);

  // Filtered quotes list
  const filteredQuotes = useMemo(() => {
    return quotes.filter(q => {
      // Search by concept, client name, phone or quote number
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const conceptMatch = (q.concept || '').toLowerCase().includes(query);
        const nameMatch = (q.client_name || '').toLowerCase().includes(query);
        const phoneMatch = (q.client_phone || '').toLowerCase().includes(query);
        const codeMatch = (q.quote_number || '').toLowerCase().includes(query);
        if (!conceptMatch && !nameMatch && !phoneMatch && !codeMatch) return false;
      }

      // Filter by Client Name
      if (selectedClient !== 'todos') {
        if (q.client_name !== selectedClient) return false;
      }

      // Filter by Status
      if (selectedStatus !== 'todos') {
        if (selectedStatus === 'creada' && q.status !== 'creada' && q.status !== 'pendiente') return false;
        if (selectedStatus === 'expirada' && q.status !== 'expirada') return false;
        if (selectedStatus === 'vendida' && q.status !== 'vendida' && q.status !== 'facturada' && q.status !== 'aprobada') return false;
        if (selectedStatus === 'rechazada' && q.status !== 'rechazada') return false;
      }

      return true;
    });
  }, [quotes, searchQuery, selectedClient, selectedStatus]);

  // Unique client names for dropdown
  const uniqueClientNames = useMemo(() => {
    const names = quotes.map(q => q.client_name).filter(Boolean);
    return Array.from(new Set(names));
  }, [quotes]);

  // Selected catalog product object
  const selectedProductObj = useMemo(() => {
    return products.find(p => p.id === selectedProdId) || null;
  }, [products, selectedProdId]);

  // Handle adding catalog product item
  const handleAddCatalogItem = () => {
    if (!selectedProductObj) return;
    const price = parseFloat(catalogCustomPrice);
    const finalPrice = isNaN(price) || price < 0 ? selectedProductObj.price : price;
    const qty = Math.max(1, Number(catalogQty) || 1);

    const existingIndex = formItems.findIndex(item => item.product_id === selectedProductObj.id);

    if (existingIndex !== -1) {
      const updated = [...formItems];
      updated[existingIndex].quantity += qty;
      updated[existingIndex].price = finalPrice;
      setFormItems(updated);
    } else {
      const newItem: QuoteItem = {
        product_id: selectedProductObj.id,
        name: selectedProductObj.name,
        sku: selectedProductObj.sku || '',
        quantity: qty,
        price: finalPrice,
        is_custom: false
      };
      setFormItems([...formItems, newItem]);
    }

    // Reset picker
    setSelectedProdId('');
    setCatalogQty(1);
    setCatalogCustomPrice('');
  };

  // Handle adding free/custom item
  const handleAddFreeItem = () => {
    if (!freeConceptName.trim()) {
      alert('Ingresa la descripción del concepto o trabajo.');
      return;
    }
    const price = parseFloat(freePrice);
    if (isNaN(price) || price < 0) {
      alert('Ingresa un precio unitario válido.');
      return;
    }
    const qty = Math.max(1, Number(freeQty) || 1);

    const newItem: QuoteItem = {
      product_id: null,
      name: freeConceptName.trim(),
      quantity: qty,
      price: price,
      is_custom: true
    };

    setFormItems([...formItems, newItem]);

    // Reset free item fields
    setFreeConceptName('');
    setFreeQty(1);
    setFreePrice('');
  };

  // Handlers for modifying items in formItems list
  const handleUpdateItemQty = (index: number, delta: number) => {
    const updated = [...formItems];
    const current = Number(updated[index].quantity) || 1;
    const next = Math.max(1, current + delta);
    updated[index].quantity = next;
    setFormItems(updated);
  };

  const handleSetItemQty = (index: number, val: string) => {
    const updated = [...formItems];
    const parsed = parseInt(val, 10);
    updated[index].quantity = isNaN(parsed) || parsed < 1 ? 1 : parsed;
    setFormItems(updated);
  };

  const handleUpdateItemPrice = (index: number, val: string) => {
    const updated = [...formItems];
    const parsed = parseFloat(val);
    updated[index].price = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    setFormItems(updated);
  };

  // Remove item from form
  const handleRemoveItem = (index: number) => {
    setFormItems(formItems.filter((_, idx) => idx !== index));
  };

  // Financial calculations
  const formSubtotal = useMemo(() => {
    return formItems.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
  }, [formItems]);

  const formDiscount = useMemo(() => {
    const val = parseFloat(formDiscountAmount) || 0;
    return Math.min(val, formSubtotal);
  }, [formDiscountAmount, formSubtotal]);

  const formTax = useMemo(() => {
    const pct = parseFloat(formTaxPercent) || 0;
    const taxable = Math.max(0, formSubtotal - formDiscount);
    return taxable * (pct / 100);
  }, [formTaxPercent, formSubtotal, formDiscount]);

  const formTotalPrice = useMemo(() => {
    return Math.max(0, formSubtotal - formDiscount + formTax);
  }, [formSubtotal, formDiscount, formTax]);

  // Determine creation_type
  const formCreationType = useMemo(() => {
    const hasCatalog = formItems.some(i => !i.is_custom && i.product_id);
    const hasCustom = formItems.some(i => i.is_custom || !i.product_id);

    if (hasCatalog && hasCustom) return 'mixto';
    if (hasCustom) return 'libre';
    return 'catalogo';
  }, [formItems]);

  // Handle submit new quote
  const handleCreateQuote = async (e: React.FormEvent) => {
    e.preventDefault();

    let clientName = '';
    let clientPhone = '';
    let clientEmail = '';

    if (formClientType === 'existing') {
      const selectedClientObj = clients.find(c => c.id === formClientId);
      if (!selectedClientObj) {
        alert('Por favor, selecciona un cliente existente.');
        return;
      }
      clientName = selectedClientObj.name;
      clientPhone = selectedClientObj.phone || '';
      clientEmail = selectedClientObj.email || selectedClientObj.correo || '';
    } else {
      if (!formClientName.trim()) {
        alert('Por favor, ingresa el nombre del cliente.');
        return;
      }
      clientName = formClientName.trim();
      clientPhone = formClientPhone.trim();
      clientEmail = formClientEmail.trim();
    }

    if (!formConcept.trim()) {
      alert('Por favor, especifica un concepto o referencia general.');
      return;
    }

    if (formItems.length === 0) {
      alert('Debes agregar al menos un ítem o producto a la cotización.');
      return;
    }

    try {
      const newQuote: Omit<Quote, 'created_at' | 'quote_number'> = {
        id: crypto.randomUUID(),
        client_name: clientName,
        client_phone: clientPhone,
        client_email: clientEmail || null,
        seller_name: formSellerName.trim() || 'Vendedor Principal',
        concept: formConcept.trim(),
        creation_type: formCreationType,
        items: formItems,
        subtotal_price: formSubtotal,
        discount_amount: formDiscount,
        tax_amount: formTax,
        total_price: formTotalPrice,
        status: 'creada',
        expiration_date: calculatedExpirationDate,
        expiration_days: formExpirationDays,
        notes: formNotes.trim() || null,
        order_id: null
      };

      await dbService.saveQuote(newQuote);
      
      // Reset form & close
      setFormClientId('');
      setFormClientName('');
      setFormClientPhone('');
      setFormClientEmail('');
      setFormSellerName('Vendedor Principal');
      setFormConcept('');
      setFormNotes('');
      setFormItems([]);
      setFormDiscountAmount('0');
      setFormTaxPercent('0');
      setShowCreateModal(false);
      fetchData();
      alert('¡Cotización guardada exitosamente!');
    } catch (err: any) {
      console.error(err);
      alert(`Error al guardar la cotización: ${err.message || 'Error'}`);
    }
  };

  // Convert Quote into Sale ("Vendida" / "Facturada")
  const handleConvertToSale = async () => {
    if (!selectedQuote) return;
    setIsBilling(true);

    try {
      // 1. Update quote status to 'vendida'
      const updatedQuote: Quote = {
        ...selectedQuote,
        status: 'vendida',
        updated_at: new Date().toISOString()
      };
      await dbService.saveQuote(updatedQuote);

      // 2. Register formal Order / Sale in system
      const newOrderPayload = {
        customer_name: selectedQuote.client_name,
        phone_number: selectedQuote.client_phone || '0000000000',
        customer_email: selectedQuote.client_email || null,
        delivery_method: 'retiro' as const,
        address_text: `Venta generada desde Cotización N° ${selectedQuote.quote_number}`,
        items: selectedQuote.items.map(item => ({
          product_id: item.product_id || '',
          name: item.name,
          sku: item.sku || '',
          quantity: item.quantity,
          price: item.price
        })),
        total_price: selectedQuote.total_price,
        status: 'completado',
        comments: `Cotización: ${selectedQuote.quote_number} | Vendedor: ${selectedQuote.seller_name || 'N/A'}. ${selectedQuote.notes || ''}`,
        payment_method: billingPaymentMethod,
        payment_status: billingPaymentStatus === 'pagado' ? 'pagado' : 'pendiente',
        payment_amount_with: selectedQuote.total_price
      };

      const createdOrder = await dbService.createOrder(newOrderPayload);

      // 3. Deduct stock for catalog items
      for (const item of selectedQuote.items) {
        if (item.product_id && !item.is_custom) {
          const catalogProd = products.find(p => p.id === item.product_id);
          if (catalogProd) {
            const newStock = Math.max(0, catalogProd.stock - item.quantity);
            try {
              await dbService.updateProduct(catalogProd.id, { stock: newStock });
            } catch (stockErr) {
              console.warn(`Could not update stock for product ${catalogProd.id}:`, stockErr);
            }
          }
        }
      }

      // 4. Register Cash Operation if paid immediately
      if (billingPaymentStatus === 'pagado') {
        const bsAmount = selectedQuote.total_price * bcvRate;
        await dbService.addCashOp({
          type: 'ingreso',
          concept: `Venta por Cotización N° ${selectedQuote.quote_number} - Cliente: ${selectedQuote.client_name}`,
          amount: selectedQuote.total_price,
          amount_bs: bsAmount,
          payment_method: billingPaymentMethod
        });
      }

      // Close modals & refresh state
      setShowBillingModal(false);
      setShowDetailModal(false);
      setSelectedQuote(null);
      fetchData();
      onRefreshData();

      alert(`¡Cotización convertida en VENTA exitosamente! Se descontó el inventario y se registró el pedido #${createdOrder.order_number || ''}.`);
    } catch (err: any) {
      console.error(err);
      alert(`Error al procesar la venta: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsBilling(false);
    }
  };

  // Reject Quote
  const handleRejectQuote = async (quote: Quote) => {
    if (!window.confirm('¿Está seguro de marcar esta cotización como RECHAZADA?')) return;
    try {
      const updated: Quote = {
        ...quote,
        status: 'rechazada',
        updated_at: new Date().toISOString()
      };
      await dbService.saveQuote(updated);
      fetchData();
      if (selectedQuote && selectedQuote.id === quote.id) {
        setSelectedQuote(updated);
      }
      alert('Cotización marcada como rechazada.');
    } catch (err) {
      console.error(err);
      alert('Error al actualizar cotización.');
    }
  };

  // Delete Quote
  const handleDeleteQuote = async (id: string) => {
    if (!window.confirm('¿Está seguro de eliminar esta cotización de forma permanente?')) return;
    try {
      await dbService.deleteQuote(id);
      fetchData();
      setShowDetailModal(false);
      setSelectedQuote(null);
      alert('Cotización eliminada.');
    } catch (err) {
      console.error(err);
      alert('Error al eliminar cotización.');
    }
  };

  // Share Quote via WhatsApp
  const handleShareWhatsApp = (quote: Quote) => {
    const rawPhone = (quote.client_phone || '').replace(/\D/g, '');
    const cleanPhone = rawPhone.length >= 10 
      ? (rawPhone.startsWith('58') ? rawPhone : `58${rawPhone.replace(/^0/, '')}`) 
      : '';

    const itemsText = quote.items.map(item => 
      `• *${item.quantity}x* ${item.name} a $${item.price.toFixed(2)} = *$${(item.price * item.quantity).toFixed(2)}*`
    ).join('\n');

    const formattedDate = new Date(quote.created_at).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const expDateText = quote.expiration_date 
      ? new Date(quote.expiration_date).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : 'Sin Expiración';

    const storeTitle = (businessProfile?.name || 'Copias Bella Vista').toUpperCase();
    const text = `📄 *COTIZACIÓN DE VENTA - ${storeTitle}*
*N° Cotización:* ${quote.quote_number}
*Fecha de Emisión:* ${formattedDate}
*Válida Hasta:* ${expDateText}
*Vendedor Responsable:* ${quote.seller_name || 'Atención al Cliente'}

👤 *CLIENTE:* ${quote.client_name}
${quote.client_phone ? `📱 *Teléfono:* ${quote.client_phone}\n` : ''}${quote.client_email ? `✉️ *Email:* ${quote.client_email}\n` : ''}${quote.concept ? `📝 *Concepto:* ${quote.concept}\n` : ''}
----------------------------------
📋 *DETALLE DE ÍTEMS:*
${itemsText}
----------------------------------
${quote.subtotal_price ? `*Subtotal:* $${quote.subtotal_price.toFixed(2)}\n` : ''}${quote.discount_amount ? `*Descuento:* -$${quote.discount_amount.toFixed(2)}\n` : ''}${quote.tax_amount ? `*IVA:* +$${quote.tax_amount.toFixed(2)}\n` : ''}💰 *TOTAL FINAL USD:* *$${quote.total_price.toFixed(2)} USD*
🇻🇪 *TOTAL FINAL VES:* *Bs. ${(quote.total_price * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}* (Tasa: ${bcvRate} Bs/USD)

${quote.notes ? `📌 *Notas/Condiciones:* ${quote.notes}\n\n` : ''}Quedamos atentos a sus comentarios. ¡Gracias por preferirnos!`;

    const url = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

    window.open(url, '_blank');
  };

  // Generate and Print PDF / Voucher
  const handlePrintPDF = (quote: Quote) => {
    setSelectedQuote(quote);
    setShowDetailModal(true);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  return (
    <div id="cotizaciones-panel" className="bg-[#fcfdfd] min-h-screen p-6 text-gray-900">
      
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-5 mb-6">
        <div>
          <h1 className="text-2xl font-montserrat font-extrabold text-[#1D3557] uppercase tracking-tight flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-[#00BFFF] fill-[#00BFFF]/10" />
            <span>Cotizaciones y Presupuestos</span>
          </h1>
          <p className="text-xs text-[#2B2D42]/70 font-medium mt-0.5">
            Gestión completa de presupuestos para clientes, cotizaciones de catálogo o libres, y conversión directa a venta.
          </p>
        </div>

        <div>
          <button 
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 bg-[#1D3557] hover:bg-[#152742] text-white text-xs font-montserrat font-extrabold rounded-xl transition flex items-center gap-2 cursor-pointer shadow-md uppercase tracking-wider active:scale-98"
          >
            <Plus className="w-4 h-4 shrink-0 text-[#40E0D0]" />
            <span>Crear Cotización</span>
          </button>
        </div>
      </div>

      {/* HIGHLIGHT BANNER */}
      {showPremiumBanner && (
        <div className="bg-[#1D3557] text-white p-4 rounded-2xl mb-6 relative flex items-start gap-4 shadow-md transition-all border border-[#00BFFF]/20">
          <div className="p-2 bg-[#40E0D0]/20 rounded-xl mt-0.5 shrink-0">
            <Sparkles className="w-5 h-5 text-[#40E0D0]" />
          </div>
          <div className="flex-1 text-left">
            <h4 className="font-montserrat font-extrabold text-sm tracking-tight text-white mb-0.5 uppercase">
              Módulo de Cotizaciones Profesional Activo
            </h4>
            <p className="text-xs text-gray-200 font-medium leading-relaxed max-w-4xl">
              Crea cotizaciones con productos de inventario o ítems libres, imprime comprobantes PDF, comparte por WhatsApp y convierte presupuestos directamente en ventas
            </p>
          </div>
          <button 
            type="button" 
            onClick={() => setShowPremiumBanner(false)}
            className="absolute top-3 right-3 text-gray-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* FILTER PANEL */}
      <div className="bg-[#F8F9FA] border border-gray-200 p-4 rounded-2xl shadow-xs space-y-3 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          <div className="flex items-center gap-2 flex-wrap text-left">
            {/* Advanced Trigger */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`px-3 py-2 border rounded-xl text-xs font-montserrat font-bold transition flex items-center gap-1.5 cursor-pointer ${
                showAdvanced 
                  ? 'bg-gray-200 border-gray-300 text-[#1D3557]' 
                  : 'bg-white border-gray-200 text-[#2B2D42] hover:bg-gray-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#00BFFF]" />
              <span>Filtros</span>
            </button>

            {/* Client Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-1 text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] bg-[#1D3557]/10 px-2.5 py-1 rounded-lg border border-[#1D3557]/20">
                <User className="w-3 h-3 text-[#00BFFF]" />
                Cliente
              </span>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF] cursor-pointer"
              >
                <option value="todos">Todos los clientes</option>
                {uniqueClientNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* Status Dropdown */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF] cursor-pointer"
            >
              <option value="todos">Todos los estados</option>
              <option value="creada">Creadas / Pendientes</option>
              <option value="expirada">Expiradas</option>
              <option value="vendida">Vendidas / Facturadas</option>
              <option value="rechazada">Rechazadas</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative w-full lg:max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2">
                <Search className="w-4 h-4 text-[#00BFFF]" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar cliente, N° o concepto..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00BFFF] transition"
              />
            </div>
          </div>

        </div>

        {showAdvanced && (
          <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
            <span className="text-[10px] font-montserrat font-bold text-gray-500 uppercase">
              Registros encontrados: {filteredQuotes.length}
            </span>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedClient('todos');
                setSelectedStatus('todos');
              }}
              className="text-[10px] font-montserrat font-extrabold text-[#00BFFF] hover:underline cursor-pointer uppercase"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* TABLE LIST */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00BFFF] mx-auto mb-2" />
            <p className="text-xs font-bold text-[#2B2D42]">Cargando cotizaciones...</p>
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="p-16 text-center text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-3 text-[#00BFFF]/50" />
            <p className="text-sm font-montserrat font-extrabold text-[#2B2D42]">No se encontraron cotizaciones</p>
            <p className="text-xs font-medium text-gray-500 mt-1">
              Modifica los filtros o presiona "Crear Cotización" para emitir un nuevo presupuesto.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#1D3557] text-white text-[10px] uppercase font-montserrat font-extrabold tracking-wider">
                  <th className="px-6 py-4">N° / Cliente</th>
                  <th className="px-6 py-4">Contacto</th>
                  <th className="px-6 py-4">Concepto / Vendedor</th>
                  <th className="px-6 py-4">Modalidad</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Monto Total</th>
                  <th className="px-6 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-800">
                {filteredQuotes.map((q) => {
                  const isExpired = q.status === 'expirada';
                  const isSold = q.status === 'vendida' || q.status === 'facturada' || q.status === 'aprobada';

                  return (
                    <tr key={q.id} className="hover:bg-gray-50/50 transition">
                      
                      {/* Name / Code */}
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-montserrat font-extrabold text-[#1D3557] leading-tight">{q.client_name}</p>
                          <span className="inline-block text-[10px] bg-[#1D3557]/10 text-[#1D3557] font-mono font-bold px-2 py-0.5 rounded-md mt-1 border border-[#1D3557]/20">
                            #{q.quote_number}
                          </span>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="px-6 py-4 font-bold text-[#2B2D42]">
                        {q.client_phone ? (
                          <span className="flex items-center gap-1 text-[#2B2D42]">
                            <Smartphone className="w-3.5 h-3.5 text-[#00BFFF] shrink-0" />
                            {q.client_phone}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Sin teléfono</span>
                        )}
                      </td>

                      {/* Concept & Seller */}
                      <td className="px-6 py-4">
                        <p className="font-bold text-[#2B2D42] line-clamp-1 max-w-xs">{q.concept}</p>
                        <span className="text-[10px] font-medium text-gray-500 block mt-0.5">
                          Vendedor: {q.seller_name || 'Vendedor Principal'}
                        </span>
                      </td>

                      {/* Creation Mode Badge */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 text-[9px] font-montserrat font-extrabold uppercase px-2.5 py-1 rounded-lg bg-gray-100 text-[#2B2D42] border border-gray-200">
                          {q.creation_type === 'libre' ? '✏️ Libre' : q.creation_type === 'mixto' ? '🔄 Mixto' : '📦 Catálogo'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-montserrat font-extrabold uppercase border ${
                          isSold
                            ? 'bg-[#40E0D0]/15 border-[#40E0D0]/30 text-[#1D3557]'
                            : isExpired
                            ? 'bg-rose-50 border-rose-200 text-rose-700'
                            : q.status === 'rechazada'
                            ? 'bg-gray-100 border-gray-200 text-gray-600'
                            : 'bg-amber-50 border-amber-200 text-amber-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            isSold ? 'bg-[#40E0D0]' :
                            isExpired ? 'bg-rose-500' :
                            q.status === 'rechazada' ? 'bg-gray-400' : 'bg-amber-500'
                          }`} />
                          <span>{
                            isSold ? 'Vendida' :
                            isExpired ? 'Expirada' :
                            q.status === 'rechazada' ? 'Rechazada' : 'Creada'
                          }</span>
                        </span>
                      </td>

                      {/* Total */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="font-mono font-black text-[#1D3557] text-sm">
                          ${q.total_price.toFixed(2)} USD
                        </p>
                        <p className="text-[10px] text-gray-500 font-bold font-mono leading-none">
                          Bs. {(q.total_price * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </p>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View Detail */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedQuote(q);
                              setShowDetailModal(true);
                            }}
                            className="p-1.5 bg-[#F8F9FA] hover:bg-gray-200 text-[#1D3557] rounded-xl border border-gray-200 transition cursor-pointer"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4 text-[#00BFFF]" />
                          </button>

                          {/* Print PDF */}
                          <button
                            type="button"
                            onClick={() => handlePrintPDF(q)}
                            className="p-1.5 bg-[#F8F9FA] hover:bg-gray-200 text-[#2B2D42] rounded-xl border border-gray-200 transition cursor-pointer"
                            title="Imprimir / PDF"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Share WhatsApp */}
                          <button
                            type="button"
                            onClick={() => handleShareWhatsApp(q)}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200 transition cursor-pointer"
                            title="Enviar por WhatsApp"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 📝 CREATE QUOTE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-gray-100 w-full max-w-3xl shadow-2xl overflow-hidden relative text-left flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="bg-[#1D3557] p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#40E0D0]/20 rounded-xl">
                  <FileCheck className="w-5 h-5 text-[#40E0D0]" />
                </div>
                <div>
                  <h3 className="font-montserrat font-extrabold text-sm tracking-tight text-white uppercase">
                    Crear Nueva Cotización
                  </h3>
                  <p className="text-[10px] text-gray-200 font-medium">
                    Emisión de cotización con productos de catálogo o ítems libres.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-gray-300 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateQuote} className="p-6 space-y-5 overflow-y-auto flex-1">
              
              {/* HEADER / VENDEDOR SECTION */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                    Vendedor Responsable *
                  </label>
                  <input
                    type="text"
                    required
                    value={formSellerName}
                    onChange={(e) => setFormSellerName(e.target.value)}
                    placeholder="Nombre del vendedor"
                    className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                    Tiempo de Validez / Expiración
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFormExpirationDays('7')}
                      className={`py-1.5 text-[10px] font-montserrat font-extrabold rounded-lg border transition ${
                        formExpirationDays === '7' ? 'bg-[#1D3557] text-white border-[#1D3557]' : 'bg-[#F8F9FA] border-gray-200 text-[#2B2D42]'
                      }`}
                    >
                      7 Días
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormExpirationDays('15')}
                      className={`py-1.5 text-[10px] font-montserrat font-extrabold rounded-lg border transition ${
                        formExpirationDays === '15' ? 'bg-[#1D3557] text-white border-[#1D3557]' : 'bg-[#F8F9FA] border-gray-200 text-[#2B2D42]'
                      }`}
                    >
                      15 Días
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormExpirationDays('30')}
                      className={`py-1.5 text-[10px] font-montserrat font-extrabold rounded-lg border transition ${
                        formExpirationDays === '30' ? 'bg-[#1D3557] text-white border-[#1D3557]' : 'bg-[#F8F9FA] border-gray-200 text-[#2B2D42]'
                      }`}
                    >
                      30 Días
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormExpirationDays('none')}
                      className={`py-1.5 text-[10px] font-montserrat font-extrabold rounded-lg border transition ${
                        formExpirationDays === 'none' ? 'bg-[#1D3557] text-white border-[#1D3557]' : 'bg-[#F8F9FA] border-gray-200 text-[#2B2D42]'
                      }`}
                    >
                      Sin Exp.
                    </button>
                  </div>
                </div>
              </div>

              {/* CLIENT SECTION */}
              <div className="bg-[#F8F9FA] border border-gray-200 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-montserrat font-extrabold uppercase text-[#1D3557] tracking-wider">Información del Cliente</span>
                  <div className="flex bg-gray-200/80 p-0.5 rounded-lg text-[10px] font-montserrat font-bold">
                    <button
                      type="button"
                      onClick={() => setFormClientType('existing')}
                      className={`px-2.5 py-1 rounded-md transition ${formClientType === 'existing' ? 'bg-[#1D3557] text-white shadow-3xs' : 'text-[#2B2D42]'}`}
                    >
                      Cliente Existente
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormClientType('new')}
                      className={`px-2.5 py-1 rounded-md transition ${formClientType === 'new' ? 'bg-[#1D3557] text-white shadow-3xs' : 'text-[#2B2D42]'}`}
                    >
                      Cliente Nuevo
                    </button>
                  </div>
                </div>

                {formClientType === 'existing' ? (
                  <div className="space-y-2">
                    <select
                      value={formClientId}
                      required={formClientType === 'existing'}
                      onChange={(e) => {
                        const selectedVal = e.target.value;
                        setFormClientId(selectedVal);
                        const selectedObj = clients.find(c => String(c.id) === selectedVal || c.name === selectedVal);
                        if (selectedObj) {
                          setFormClientName(selectedObj.name);
                          setFormClientPhone(selectedObj.phone || '');
                          setFormClientEmail(selectedObj.email || '');
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                    >
                      <option value="">-- Selecciona Cliente ({clients.length} disponibles) --</option>
                      {clients.map(c => (
                        <option key={c.id || c.name} value={c.id || c.name}>
                          {c.name} {c.phone ? `(Tel: ${c.phone})` : ''} {c.document ? `- ${c.document}` : ''}
                        </option>
                      ))}
                    </select>

                    {formClientId && (
                      <div className="p-3 bg-[#1D3557]/10 border border-[#1D3557]/20 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <span className="font-montserrat font-extrabold text-[#1D3557] block">Cliente: {formClientName || formClientId}</span>
                          <div className="text-[11px] text-[#2B2D42] flex items-center gap-3">
                            {formClientPhone && <span>📱 {formClientPhone}</span>}
                            {formClientEmail && <span>✉️ {formClientEmail}</span>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setFormClientId('');
                            setFormClientName('');
                            setFormClientPhone('');
                            setFormClientEmail('');
                          }}
                          className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                        >
                          Cambiar / Limpiar
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Nombre Completo *</label>
                      <input
                        type="text"
                        required={formClientType === 'new'}
                        value={formClientName}
                        onChange={(e) => setFormClientName(e.target.value)}
                        placeholder="Ej: Pedro Pérez"
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Teléfono / WhatsApp *</label>
                      <input
                        type="text"
                        value={formClientPhone}
                        onChange={(e) => setFormClientPhone(e.target.value)}
                        placeholder="Ej: 04141234567"
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Correo Electrónico</label>
                      <input
                        type="email"
                        value={formClientEmail}
                        onChange={(e) => setFormClientEmail(e.target.value)}
                        placeholder="Ej: cliente@gmail.com"
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* CONCEPT FIELD */}
              <div>
                <label className="block text-xs font-montserrat font-extrabold text-[#1D3557] uppercase tracking-wider mb-1">
                  Concepto / Referencia General *
                </label>
                <input
                  type="text"
                  required
                  value={formConcept}
                  onChange={(e) => setFormConcept(e.target.value)}
                  placeholder="Ej: Presupuesto de impresiones de tesis y planos digitales"
                  className="w-full px-3.5 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF] focus:bg-white transition"
                />
              </div>

              {/* ITEM PICKER TABS: CATALOG VS LIBRE */}
              <div className="border border-gray-200 rounded-2xl p-4 space-y-4 bg-white">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                  <span className="text-xs font-montserrat font-extrabold uppercase text-[#1D3557] tracking-wider">
                    Agregar Ítems a la Cotización
                  </span>
                  <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-montserrat font-bold">
                    <button
                      type="button"
                      onClick={() => setItemPickerTab('catalog')}
                      className={`px-3 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                        itemPickerTab === 'catalog' ? 'bg-[#1D3557] text-white shadow-3xs font-black' : 'text-[#2B2D42] hover:text-[#1D3557]'
                      }`}
                    >
                      <PackageCheck className="w-3.5 h-3.5" />
                      <span>Desde Catálogo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemPickerTab('libre')}
                      className={`px-3 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                        itemPickerTab === 'libre' ? 'bg-[#1D3557] text-white shadow-3xs font-black' : 'text-[#2B2D42] hover:text-[#1D3557]'
                      }`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Ítem / Concepto Libre</span>
                    </button>
                  </div>
                </div>

                {/* TAB 1: CATALOG PICKER */}
                {itemPickerTab === 'catalog' ? (
                  <div className="space-y-3">
                    {/* Buscador de Productos */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                          Buscar en Inventario
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="🔍 Buscar producto por nombre o SKU..."
                            value={searchProdQuery}
                            onChange={(e) => setSearchProdQuery(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                          />
                          {searchProdQuery && (
                            <button
                              type="button"
                              onClick={() => setSearchProdQuery('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-extrabold text-xs"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                          Seleccionar Producto
                        </label>
                        <select
                          value={selectedProdId}
                          onChange={(e) => {
                            setSelectedProdId(e.target.value);
                            const prod = products.find(p => p.id === e.target.value);
                            if (prod) setCatalogCustomPrice(prod.price.toString());
                          }}
                          className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                        >
                          <option value="">
                            {searchProdQuery.trim()
                              ? `-- ${filteredProductsForSelect.length} producto(s) relacionado(s) --`
                              : '-- Seleccionar Producto --'
                            }
                          </option>
                          {filteredProductsForSelect.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} (${p.price.toFixed(2)}) - Stock: {p.stock}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {searchProdQuery.trim() && filteredProductsForSelect.length === 0 && (
                      <div className="p-3 bg-rose-50 border border-rose-200/70 rounded-xl text-center">
                        <p className="text-xs font-bold text-rose-700">
                          No se encontraron productos en inventario que coincidan con &quot;{searchProdQuery}&quot;.
                        </p>
                      </div>
                    )}

                    {/* CARD / ROW CON LA FORMA DE LA IMAGEN 1 */}
                    {selectedProductObj && (
                      <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-2xs mt-2">
                        {/* HEADER DE LA TABLA (IMAGEN 1) */}
                        <div className="bg-[#1D3557] text-white px-4 py-2 grid grid-cols-12 gap-2 text-[10px] font-montserrat font-extrabold uppercase tracking-wider items-center">
                          <div className="col-span-5 sm:col-span-6">PRODUCTO</div>
                          <div className="col-span-3 sm:col-span-2 text-center">CANT</div>
                          <div className="col-span-3 sm:col-span-2 text-center">PRECIO ($)</div>
                          <div className="col-span-1 text-center">ACCIÓN</div>
                        </div>

                        {/* FILA DEL PRODUCTO SELECCIONADO */}
                        <div className="p-3.5 grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-5 sm:col-span-6">
                            <span className="text-xs font-bold text-[#2B2D42] block leading-tight">
                              {selectedProductObj.name}
                            </span>
                            <span className="inline-block mt-1 bg-[#1D3557]/10 text-[#1D3557] border border-[#1D3557]/20 font-extrabold text-[10px] px-2 py-0.5 rounded-md">
                              Exento (0%)
                            </span>
                          </div>

                          <div className="col-span-3 sm:col-span-2 flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setCatalogQty(Math.max(1, catalogQty - 1))}
                              className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-[#2B2D42] text-xs font-bold transition flex items-center justify-center cursor-pointer select-none"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={catalogQty}
                              onChange={(e) => setCatalogQty(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-11 py-1 text-center bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-black text-[#2B2D42] focus:outline-none focus:ring-1 focus:ring-[#00BFFF]"
                            />
                            <button
                              type="button"
                              onClick={() => setCatalogQty(catalogQty + 1)}
                              className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-[#2B2D42] text-xs font-bold transition flex items-center justify-center cursor-pointer select-none"
                            >
                              +
                            </button>
                          </div>

                          <div className="col-span-3 sm:col-span-2 flex items-center justify-center">
                            <div className="inline-flex items-center gap-1 bg-white border border-gray-200 px-2.5 py-1 rounded-full text-xs font-black text-[#2B2D42] focus-within:ring-1 focus-within:ring-[#00BFFF]">
                              <span className="text-gray-400 font-bold">$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={catalogCustomPrice}
                                onChange={(e) => setCatalogCustomPrice(e.target.value)}
                                className="w-16 text-center font-black focus:outline-none bg-transparent"
                              />
                            </div>
                          </div>

                          <div className="col-span-1 flex items-center justify-center">
                            <button
                              type="button"
                              onClick={handleAddCatalogItem}
                              className="px-3 py-1.5 bg-[#1D3557] hover:bg-[#152742] text-white text-xs font-montserrat font-extrabold rounded-xl transition flex items-center gap-1 shadow-3xs cursor-pointer"
                              title="Agregar a la cotización"
                            >
                              <Plus className="w-4 h-4 text-[#40E0D0]" />
                              <span className="hidden sm:inline">Agregar</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* TAB 2: LIBRE / CUSTOM CONCEPT PICKER */
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                        Descripción del Concepto / Trabajo
                      </label>
                      <input
                        type="text"
                        value={freeConceptName}
                        onChange={(e) => setFreeConceptName(e.target.value)}
                        placeholder="Ej: Carnet en Lamina PVC Sublimado Colores"
                        className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                      />
                    </div>

                    {/* CARD CON LA FORMA DE LA IMAGEN 1 PARA CONCEPTO LIBRE */}
                    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-2xs mt-2">
                      <div className="bg-[#1D3557] text-white px-4 py-2 grid grid-cols-12 gap-2 text-[10px] font-montserrat font-extrabold uppercase tracking-wider items-center">
                        <div className="col-span-5 sm:col-span-6">CONCEPTO</div>
                        <div className="col-span-3 sm:col-span-2 text-center">CANT</div>
                        <div className="col-span-3 sm:col-span-2 text-center">PRECIO ($)</div>
                        <div className="col-span-1 text-center">ACCIÓN</div>
                      </div>

                      <div className="p-3.5 grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-5 sm:col-span-6">
                          <span className="text-xs font-bold text-[#2B2D42] block leading-tight">
                            {freeConceptName || 'Concepto Libre'}
                          </span>
                          <span className="inline-block mt-1 bg-[#1D3557]/10 text-[#1D3557] border border-[#1D3557]/20 font-extrabold text-[10px] px-2 py-0.5 rounded-md">
                            Exento (0%)
                          </span>
                        </div>

                        <div className="col-span-3 sm:col-span-2 flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setFreeQty(Math.max(1, freeQty - 1))}
                            className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-[#2B2D42] text-xs font-bold transition flex items-center justify-center cursor-pointer select-none"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={freeQty}
                            onChange={(e) => setFreeQty(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-11 py-1 text-center bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-black text-[#2B2D42] focus:outline-none focus:ring-1 focus:ring-[#00BFFF]"
                          />
                          <button
                            type="button"
                            onClick={() => setFreeQty(freeQty + 1)}
                            className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-[#2B2D42] text-xs font-bold transition flex items-center justify-center cursor-pointer select-none"
                          >
                            +
                          </button>
                        </div>

                        <div className="col-span-3 sm:col-span-2 flex items-center justify-center">
                          <div className="inline-flex items-center gap-1 bg-white border border-gray-200 px-2.5 py-1 rounded-full text-xs font-black text-[#2B2D42] focus-within:ring-1 focus-within:ring-[#00BFFF]">
                            <span className="text-gray-400 font-bold">$</span>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={freePrice}
                              onChange={(e) => setFreePrice(e.target.value)}
                              className="w-16 text-center font-black focus:outline-none bg-transparent"
                            />
                          </div>
                        </div>

                        <div className="col-span-1 flex items-center justify-center">
                          <button
                            type="button"
                            onClick={handleAddFreeItem}
                            className="px-3 py-1.5 bg-[#1D3557] hover:bg-[#152742] text-white text-xs font-montserrat font-extrabold rounded-xl transition flex items-center gap-1 shadow-3xs cursor-pointer"
                            title="Agregar a la cotización"
                          >
                            <Plus className="w-4 h-4 text-[#40E0D0]" />
                            <span className="hidden sm:inline">Agregar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TABLA DE ÍTEMS AGREGADOS CON LA FORMA DE LA IMAGEN 1 */}
                <div className="pt-2">
                  <span className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-2 tracking-wider">
                    Ítems en la Cotización ({formItems.length})
                  </span>

                  {formItems.length > 0 ? (
                    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                      {/* HEADER DE LA TABLA (IMAGEN 1) */}
                      <div className="bg-[#1D3557] text-white px-4 py-2 grid grid-cols-12 gap-2 text-[10px] font-montserrat font-extrabold uppercase tracking-wider items-center">
                        <div className="col-span-5 sm:col-span-6">PRODUCTO</div>
                        <div className="col-span-3 sm:col-span-2 text-center">CANT</div>
                        <div className="col-span-3 sm:col-span-2 text-center">PRECIO ($)</div>
                        <div className="col-span-1 text-center">ACCIÓN</div>
                      </div>

                      {/* FILAS DE ÍTEMS AGREGADOS (ESTILO EXACTO IMAGEN 1) */}
                      <div className="divide-y divide-gray-100">
                        {formItems.map((item, index) => (
                          <div key={index} className="p-3.5 grid grid-cols-12 gap-2 items-center hover:bg-[#F8F9FA] transition">
                            <div className="col-span-5 sm:col-span-6">
                              <span className="text-xs font-bold text-[#2B2D42] block leading-tight">
                                {item.name}
                              </span>
                              <span className="inline-block mt-1 bg-[#1D3557]/10 text-[#1D3557] border border-[#1D3557]/20 font-extrabold text-[10px] px-2 py-0.5 rounded-md">
                                Exento (0%)
                              </span>
                            </div>

                            <div className="col-span-3 sm:col-span-2 flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(index, -1)}
                                className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-[#2B2D42] text-xs font-bold transition flex items-center justify-center cursor-pointer select-none"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleSetItemQty(index, e.target.value)}
                                className="w-11 py-1 text-center bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-black text-[#2B2D42] focus:outline-none focus:ring-1 focus:ring-[#00BFFF]"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(index, 1)}
                                className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-[#2B2D42] text-xs font-bold transition flex items-center justify-center cursor-pointer select-none"
                              >
                                +
                              </button>
                            </div>

                            <div className="col-span-3 sm:col-span-2 flex items-center justify-center">
                              <div className="inline-flex items-center gap-1 bg-white border border-gray-200 px-2.5 py-1 rounded-full text-xs font-black text-[#2B2D42] focus-within:ring-1 focus-within:ring-[#00BFFF]">
                                <span className="text-gray-400 font-bold">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.price}
                                  onChange={(e) => handleUpdateItemPrice(index, e.target.value)}
                                  className="w-16 text-center font-black focus:outline-none bg-transparent"
                                />
                              </div>
                            </div>

                            <div className="col-span-1 flex items-center justify-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(index)}
                                className="text-gray-400 hover:text-rose-600 p-1.5 rounded-lg transition cursor-pointer"
                                title="Eliminar ítem"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-400 font-bold italic text-center py-4 bg-[#F8F9FA] rounded-2xl border border-dashed border-gray-200">
                      No se han agregado ítems a la cotización.
                    </p>
                  )}
                </div>
              </div>

              {/* OPTIONAL DISCOUNTS & TAXES BREAKDOWN */}
              <div className="bg-[#F8F9FA] border border-gray-200 p-4 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">
                    Descuento Aplicado ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formDiscountAmount}
                    onChange={(e) => setFormDiscountAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">
                    Impuestos / IVA (%)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={formTaxPercent}
                    onChange={(e) => setFormTaxPercent(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none"
                  />
                </div>
              </div>

              {/* OBSERVATIONS NOTES */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-montserrat font-extrabold text-[#1D3557] uppercase tracking-wider">
                    Notas / Condiciones del Presupuesto
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormNotes(DEFAULT_QUOTE_NOTES)}
                    className="text-[10px] font-bold text-[#00BFFF] hover:underline cursor-pointer flex items-center gap-1"
                    title="Restablecer texto predeterminado"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restablecer Nota Predeterminada</span>
                  </button>
                </div>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Ej: Requiere el 50% de anticipo. Tiempo de entrega: 48 horas hábiles..."
                  rows={4}
                  className="w-full px-3 py-2.5 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF] focus:bg-white transition leading-relaxed"
                />
              </div>

              {/* FOOTER TOTAL CALCULATOR */}
              <div className="bg-[#1D3557]/5 border border-[#1D3557]/20 p-4 rounded-2xl space-y-2">
                <div className="flex justify-between text-xs text-[#2B2D42] font-bold">
                  <span>Subtotal:</span>
                  <span className="font-mono">${formSubtotal.toFixed(2)}</span>
                </div>
                {formDiscount > 0 && (
                  <div className="flex justify-between text-xs text-amber-700 font-bold">
                    <span>Descuento:</span>
                    <span className="font-mono">-${formDiscount.toFixed(2)}</span>
                  </div>
                )}
                {formTax > 0 && (
                  <div className="flex justify-between text-xs text-[#2B2D42] font-bold">
                    <span>IVA ({formTaxPercent}%):</span>
                    <span className="font-mono">+${formTax.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-[#1D3557]/20 pt-2 flex justify-between items-center">
                  <div>
                    <span className="text-xs font-montserrat font-extrabold uppercase text-[#1D3557] block">TOTAL ESTIMADO FINAL</span>
                    <span className="text-xs text-[#2B2D42]/70 font-bold">
                      Bs. {(formTotalPrice * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} (Tasa {bcvRate})
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-montserrat font-extrabold text-[#1D3557]">${formTotalPrice.toFixed(2)}</span>
                    <span className="text-xs font-montserrat font-extrabold text-[#1D3557] ml-1">USD</span>
                  </div>
                </div>
              </div>

              {/* FORM ACTIONS */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-200 text-[#2B2D42] font-bold text-xs rounded-xl hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#40E0D0] hover:bg-[#36cebe] text-[#1D3557] font-montserrat font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
                >
                  <Check className="w-4 h-4 text-[#1D3557]" />
                  <span>Guardar Cotización</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 🔍 VIEW DETAIL MODAL */}
      {showDetailModal && selectedQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="printable-area bg-white rounded-3xl border border-gray-100 w-full max-w-xl shadow-2xl overflow-hidden relative text-left">
            
            <div className="bg-[#1D3557] p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-[#40E0D0]" />
                <div>
                  <h3 className="font-montserrat font-extrabold text-sm tracking-tight text-white uppercase">
                    Detalle de Cotización #{selectedQuote.quote_number}
                  </h3>
                  <p className="text-[10px] text-gray-200">
                    Vendedor: {selectedQuote.seller_name || 'Vendedor Principal'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="text-gray-300 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              
              {/* PRINT & PREVIEW BUSINESS HEADER */}
              <div className="text-center pb-3 border-b border-gray-200 space-y-0.5">
                <h2 className="text-base font-montserrat font-extrabold uppercase text-[#1D3557] tracking-tight">
                  {businessProfile?.name || 'Copias Bella Vista'}
                </h2>
                {businessProfile?.slogan && (
                  <p className="text-[10px] text-[#2B2D42]/70 font-bold italic">{businessProfile.slogan}</p>
                )}
                <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] text-[#2B2D42] font-mono pt-0.5">
                  {businessProfile?.rif && <span>RIF: {businessProfile.rif}</span>}
                  {businessProfile?.phone && <span>Telf: {businessProfile.phone}</span>}
                  {businessProfile?.address && <span>{businessProfile.address}</span>}
                </div>
              </div>

              {/* STATUS HEADER BANNER */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400 block leading-none">Fecha Emisión</span>
                  <span className="text-xs font-bold text-[#2B2D42] block mt-1">
                    {new Date(selectedQuote.created_at).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400 block leading-none">Validez Hasta</span>
                  <span className="text-xs font-bold text-[#2B2D42] block mt-1">
                    {selectedQuote.expiration_date 
                      ? new Date(selectedQuote.expiration_date).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })
                      : 'Sin Expiración'}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-black uppercase text-gray-400 block leading-none">Estado</span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-montserrat font-extrabold uppercase border mt-1 ${
                    selectedQuote.status === 'vendida' || selectedQuote.status === 'facturada'
                      ? 'bg-[#40E0D0]/15 border-[#40E0D0]/30 text-[#1D3557]'
                      : selectedQuote.status === 'expirada'
                      ? 'bg-rose-50 border-rose-200 text-rose-700'
                      : 'bg-amber-50 border-amber-200 text-amber-700'
                  }`}>
                    <span>{
                      selectedQuote.status === 'vendida' || selectedQuote.status === 'facturada' ? 'Vendida' :
                      selectedQuote.status === 'expirada' ? 'Expirada' : 'Creada'
                    }</span>
                  </span>
                </div>
              </div>

              {/* CLIENT DETAILS */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] block tracking-wider">Información del Cliente</span>
                <div className="bg-[#F8F9FA] border border-gray-200 rounded-2xl p-4 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-[#00BFFF]" />
                    <span className="text-xs font-montserrat font-extrabold text-[#1D3557]">{selectedQuote.client_name}</span>
                  </div>
                  {selectedQuote.client_phone && (
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-[#00BFFF]" />
                      <span className="text-xs font-bold text-[#2B2D42]">{selectedQuote.client_phone}</span>
                    </div>
                  )}
                  {selectedQuote.client_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-xs font-bold text-[#2B2D42]">{selectedQuote.client_email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* CONCEPT */}
              <div className="space-y-1">
                <span className="text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] block tracking-wider">Concepto de Operación</span>
                <p className="text-xs font-extrabold text-[#1D3557] bg-[#1D3557]/5 border border-[#1D3557]/15 p-3 rounded-xl">
                  {selectedQuote.concept}
                </p>
              </div>

              {/* PRODUCT ITEMS LIST */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] block tracking-wider">Detalle de Ítems</span>
                <div className="border border-gray-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#1D3557] text-white font-montserrat font-extrabold text-[10px] uppercase">
                        <th className="px-4 py-2">Detalle</th>
                        <th className="px-4 py-2 text-center">Tipo</th>
                        <th className="px-4 py-2 text-center">Cant</th>
                        <th className="px-4 py-2 text-right">Precio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-[#2B2D42]">
                      {selectedQuote.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-[#F8F9FA]">
                          <td className="px-4 py-2.5 font-bold">{item.name}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-[#2B2D42]">
                              {item.is_custom ? 'Libre' : 'Catálogo'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center font-black text-[#1D3557]">{item.quantity}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-extrabold">${item.price.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* NOTES */}
              {selectedQuote.notes && (
                <div className="space-y-1">
                  <span className="text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] block tracking-wider">Notas del Presupuesto</span>
                  <p className="text-xs text-[#2B2D42] font-medium bg-[#F8F9FA] border border-gray-200 p-3 rounded-xl italic">
                    "{selectedQuote.notes}"
                  </p>
                </div>
              )}

              {/* CALCULATED PRICING BLOCK */}
              <div className="bg-[#1D3557]/5 border border-[#1D3557]/15 p-4 rounded-2xl space-y-1.5">
                {selectedQuote.subtotal_price !== undefined && (
                  <div className="flex justify-between text-xs font-bold text-[#2B2D42]">
                    <span>Subtotal:</span>
                    <span className="font-mono">${selectedQuote.subtotal_price.toFixed(2)}</span>
                  </div>
                )}
                {selectedQuote.discount_amount !== undefined && selectedQuote.discount_amount > 0 && (
                  <div className="flex justify-between text-xs font-bold text-amber-700">
                    <span>Descuento:</span>
                    <span className="font-mono">-${selectedQuote.discount_amount.toFixed(2)}</span>
                  </div>
                )}
                {selectedQuote.tax_amount !== undefined && selectedQuote.tax_amount > 0 && (
                  <div className="flex justify-between text-xs font-bold text-[#2B2D42]">
                    <span>IVA:</span>
                    <span className="font-mono">+${selectedQuote.tax_amount.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-[#1D3557]/15 pt-2 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] block">Total Cotización</span>
                    <span className="text-[11px] font-bold text-[#2B2D42]/70 block">
                      Bs. {(selectedQuote.total_price * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-montserrat font-extrabold text-[#1D3557]">${selectedQuote.total_price.toFixed(2)}</span>
                    <span className="text-xs font-montserrat font-extrabold text-[#1D3557] ml-1">USD</span>
                  </div>
                </div>
              </div>

            </div>

            {/* BUTTON BAR ACTIONS */}
            <div className="bg-[#F8F9FA] border-t border-gray-200 p-4 flex flex-col md:flex-row gap-2 justify-between print:hidden">
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteQuote(selectedQuote.id)}
                  className="p-2 bg-white hover:bg-rose-50 border border-gray-200 hover:border-rose-200 text-rose-500 rounded-xl transition cursor-pointer"
                  title="Eliminar permanentemente"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handlePrintPDF(selectedQuote)}
                  className="px-3 py-2 bg-white hover:bg-gray-100 border border-gray-200 text-[#2B2D42] font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleShareWhatsApp(selectedQuote)}
                  className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WhatsApp</span>
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 bg-white hover:bg-gray-100 border border-gray-200 text-[#2B2D42] font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cerrar
                </button>

                {/* CONVERT TO SALE OPTION */}
                {selectedQuote.status !== 'vendida' && selectedQuote.status !== 'facturada' && (
                  <button
                    type="button"
                    onClick={() => setShowBillingModal(true)}
                    className="px-4 py-2 bg-[#40E0D0] hover:bg-[#36cebe] text-[#1D3557] font-montserrat font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-[#1D3557]" />
                    <span>Convertir en Venta</span>
                  </button>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

      {/* 💵 CONVERT TO SALE / BILLING MODAL */}
      {showBillingModal && selectedQuote && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-gray-100 w-full max-w-sm shadow-2xl overflow-hidden text-left">
            
            <div className="bg-[#1D3557] p-5 text-white flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-[#40E0D0]" />
              <div>
                <h3 className="font-montserrat font-extrabold text-sm tracking-tight text-white uppercase">
                  Convertir Cotización en Venta
                </h3>
                <p className="text-[10px] text-gray-200 font-bold">
                  Cotización N° {selectedQuote.quote_number}
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-[#2B2D42] font-medium leading-relaxed">
                Al confirmar la venta, la cotización cambiará a estado **Vendida**, se registrará el pedido en ventas y se descontará automáticamente el inventario de los productos de catálogo.
              </p>

              <div className="bg-[#40E0D0]/10 border border-[#40E0D0]/30 p-3.5 rounded-2xl text-center">
                <p className="text-2xl font-montserrat font-extrabold text-[#1D3557]">${selectedQuote.total_price.toFixed(2)} USD</p>
                <p className="text-xs text-emerald-700 font-bold">Bs. {(selectedQuote.total_price * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</p>
              </div>

              {/* PAYMENT METHOD SELECT */}
              <div>
                <label className="block text-[10px] font-montserrat font-extrabold uppercase text-gray-500 mb-1.5">
                  Método de Pago
                </label>
                <select
                  value={billingPaymentMethod}
                  onChange={(e) => setBillingPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                >
                  <option value="Efectivo USD">💵 Efectivo Dólares (USD)</option>
                  <option value="Efectivo VES">💵 Efectivo Bolívares (VES)</option>
                  <option value="Pago Móvil">📱 Pago Móvil</option>
                  <option value="Punto de Venta">💳 Punto de Venta</option>
                  <option value="Transferencia Bancaria">🏢 Transferencia VES</option>
                  <option value="Zelle">🇺🇸 Transferencia USD (Zelle)</option>
                </select>
              </div>

              {/* PAYMENT STATUS */}
              <div>
                <label className="block text-[10px] font-montserrat font-extrabold uppercase text-gray-500 mb-1.5">
                  Estado del Pago
                </label>
                <div className="grid grid-cols-2 gap-2 bg-[#F8F9FA] p-1 rounded-xl border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setBillingPaymentStatus('pagado')}
                    className={`py-1.5 text-center text-xs font-montserrat font-extrabold rounded-lg transition cursor-pointer ${
                      billingPaymentStatus === 'pagado'
                        ? 'bg-[#1D3557] text-white shadow-3xs'
                        : 'text-[#2B2D42] hover:text-[#1D3557]'
                    }`}
                  >
                    Pagado
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingPaymentStatus('credito')}
                    className={`py-1.5 text-center text-xs font-montserrat font-extrabold rounded-lg transition cursor-pointer ${
                      billingPaymentStatus === 'credito'
                        ? 'bg-amber-600 text-white shadow-3xs'
                        : 'text-[#2B2D42] hover:text-[#1D3557]'
                    }`}
                  >
                    A Crédito
                  </button>
                </div>
              </div>

              {/* MODAL ACTIONS */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowBillingModal(false)}
                  disabled={isBilling}
                  className="px-4 py-2 border border-gray-200 text-[#2B2D42] font-bold text-xs rounded-xl hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConvertToSale}
                  disabled={isBilling}
                  className="px-4 py-2 bg-[#40E0D0] hover:bg-[#36cebe] text-[#1D3557] font-montserrat font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-1 cursor-pointer uppercase tracking-wider"
                >
                  {isBilling ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1D3557]" />
                      <span>Procesando...</span>
                    </>
                  ) : (
                    <span>Confirmar y Vender</span>
                  )}
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
