import { printInvoiceDocument } from '../lib/printInvoice';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, Trash2, Search, Pause, Play, CheckCircle, 
  AlertCircle, FileText, FileCheck, X, Printer, Loader2, Plus, Minus, Eye, RefreshCw,
  User, Users, UserPlus, Tag, Pencil, PlusCircle, Save, Package, PackagePlus, ShoppingBag,
  Scan, CreditCard, Banknote, Building2, Landmark, QrCode, Coins, Smartphone, Zap,
  ChevronRight, ChevronLeft, Download, Check, DollarSign, SlidersHorizontal, Layers,
  Grid, ArrowRight, ArrowLeft, Barcode, Calendar, Lock, Unlock, Wallet, Flame, TrendingUp
} from 'lucide-react';
import { Product, Category, Brand, ProductImage, Tax, StoreUser, PaymentMethodConfig } from '../types';
import { CurrencyCode, formatCurrency } from '../lib/currency';
import { dbService } from '../lib/supabase';
import { sortProductsByPriority } from '../lib/searchUtils';
import { GASTO_CATEGORIES } from './GastoAssistant';
import ClosureTicketModal from './ClosureTicketModal';
import OpenCashSessionModal from './OpenCashSessionModal';
import BarcodeScannerModal from './BarcodeScannerModal';
import { playCashRegisterSound, playLowStockBeep } from '../lib/soundEffects';

interface POSModuleProps {
  products: Product[];
  productImages?: ProductImage[];
  bcvRate: number;
  activeCurrency: CurrencyCode;
  currencyRates: Record<CurrencyCode, number>;
  currentUser?: StoreUser | null;
  storeUsers?: StoreUser[];
  onRefreshData?: () => void;
  onOpenProductForm?: () => void;
  onOpenBalance?: () => void;
}

interface CartQtyInputProps {
  initialQty: number;
  stock: number;
  onQtyChange: (newQty: number) => void;
}

const CartQtyInput: React.FC<CartQtyInputProps> = ({ initialQty, stock, onQtyChange }) => {
  const [localVal, setLocalVal] = useState<string>(initialQty.toString());

  useEffect(() => {
    setLocalVal(initialQty.toString());
  }, [initialQty]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    if (/^\d*$/.test(rawVal)) {
      setLocalVal(rawVal);
      const numericVal = parseInt(rawVal, 10);
      if (!isNaN(numericVal) && numericVal > 0) {
        if (numericVal <= stock) {
          onQtyChange(numericVal);
        } else {
          onQtyChange(stock);
        }
      }
    }
  };

  const handleBlur = () => {
    const numericVal = parseInt(localVal, 10);
    if (isNaN(numericVal) || numericVal <= 0) {
      setLocalVal("1");
      onQtyChange(1);
    } else if (numericVal > stock) {
      setLocalVal(stock.toString());
      onQtyChange(stock);
    } else {
      setLocalVal(numericVal.toString());
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={localVal}
      onChange={handleChange}
      onBlur={handleBlur}
      className="w-11 py-0.5 text-center font-extrabold text-gray-800 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:bg-white transition"
    />
  );
};

export default function POSModule({ 
  products, 
  productImages,
  bcvRate, 
  activeCurrency, 
  currencyRates,
  currentUser,
  storeUsers,
  onRefreshData,
  onOpenProductForm,
  onOpenBalance
}: POSModuleProps) {
  // Cart state
  const [cart, setCart] = useState<{ product: Product; qty: number }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPosScanner, setShowPosScanner] = useState(false);
  const [selectedClient, setSelectedClient] = useState('Consumidor final');
  const [documentType, setDocumentType] = useState<'factura' | 'nota_entrega'>('factura');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loadedImages, setLoadedImages] = useState<ProductImage[]>(productImages || []);

  // Business info state for ticket printing
  const [businessInfo, setBusinessInfo] = useState({
    storeName: 'Copias Bella Vista, C.A.',
    rif: 'J-50987654-3',
    address: 'Carrera 6 entre Calle 19 y 20 Bella Vista, Local #2, Barinitas, Venezuela',
    phone: '+58 412-5551234'
  });

  const loadBusinessConfig = async () => {
    try {
      const profile = await dbService.getBusinessProfile();
      if (profile && profile.name) {
        setBusinessInfo({
          storeName: profile.name,
          rif: profile.rif || '',
          address: profile.address || '',
          phone: profile.phone || ''
        });
        return;
      }
      const saved = localStorage.getItem('copias_bellavista_sys_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        setBusinessInfo({
          storeName: parsed.configStoreName || 'Copias Bella Vista, C.A.',
          rif: parsed.configRif || 'J-50987654-3',
          address: parsed.businessAddress || 'Carrera 6 entre Calle 19 y 20 Bella Vista, Local #2, Barinitas, Venezuela',
          phone: parsed.configPhone || '+58 412-5551234'
        });
      }
    } catch (e) {
      console.error("Error loading business config in POS:", e);
    }
  };

  useEffect(() => {
    loadBusinessConfig();
    window.addEventListener('bellavista_settings_updated', loadBusinessConfig);
    window.addEventListener('bellavista_business_profile_updated', loadBusinessConfig);
    return () => {
      window.removeEventListener('bellavista_settings_updated', loadBusinessConfig);
      window.removeEventListener('bellavista_business_profile_updated', loadBusinessConfig);
    };
  }, []);

  useEffect(() => {
    if (productImages && productImages.length > 0) {
      setLoadedImages(productImages);
    } else {
      dbService.getProductImages().then(imgs => {
        if (imgs) setLoadedImages(imgs);
      }).catch(() => {});
    }
  }, [productImages, products]);

  const getProductImageUrl = (productId: string): string | null => {
    const imagesToSearch = (productImages && productImages.length > 0) ? productImages : loadedImages;
    const match = imagesToSearch.find(img => img.product_id === productId);
    return match ? match.image_url : null;
  };

  // 🏷️ Categoría & Filtro State
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');

  // 💵 Tasa BCV Local Editable
  const [customBcvRate, setCustomBcvRate] = useState<number>(bcvRate || 36.5);
  useEffect(() => {
    if (bcvRate && bcvRate > 0) {
      setCustomBcvRate(bcvRate);
    }
  }, [bcvRate]);

  // ⚖️ Taxes State & real-time sync with Supabase / LocalStorage
  const [taxes, setTaxes] = useState<Tax[]>([]);

  const loadTaxes = async () => {
    try {
      const fetchedTaxes = await dbService.getTaxes();
      setTaxes(fetchedTaxes || []);
    } catch (e) {
      console.error("Error loading taxes inside POSModule", e);
    }
  };

  useEffect(() => {
    loadTaxes();
    window.addEventListener('bellavista_taxes_updated', loadTaxes);
    return () => {
      window.removeEventListener('bellavista_taxes_updated', loadTaxes);
    };
  }, []);

  // ⚡ 2-Step Flow for Right Lateral Panel ('cart' | 'checkout')
  const [posStep, setPosStep] = useState<'cart' | 'checkout'>('cart');

  // 💳 Pasarela de Pago State
  const [applyIva, setApplyIva] = useState<boolean>(true);
  const [applyIgtf, setApplyIgtf] = useState<boolean>(false);
  const [extraCharges, setExtraCharges] = useState<{ id: string; name: string; amount: number }[]>([]);
  const [showExtraChargeModal, setShowExtraChargeModal] = useState<boolean>(false);
  const [extraChargeName, setExtraChargeName] = useState<string>('Delivery / Envío');
  const [extraChargeAmount, setExtraChargeAmount] = useState<string>('');
  const [discountCode, setDiscountCode] = useState<string>('');
  const [isResumenOpen, setIsResumenOpen] = useState<boolean>(false);
  const [activePrintFormat, setActivePrintFormat] = useState<'carta' | '58mm' | '80mm'>('carta');

  const [saleCondition, setSaleCondition] = useState<'pagada' | 'credito'>('pagada');
  const [useMultiCurrency, setUseMultiCurrency] = useState<boolean>(true);
  const [saleDate, setSaleDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [numberOfPayments, setNumberOfPayments] = useState<number>(1);
  const [paymentCount, setPaymentCount] = useState<number>(1);
  const [splitPayments, setSplitPayments] = useState<{ method: string; amount: number }[]>([
    { method: 'Efectivo USD', amount: 0 }
  ]);
  const [selectedSeller, setSelectedSeller] = useState<string>('Cajero Principal');

  // 🏷️ Descuentos
  const [discountPercent, setDiscountPercent] = useState<string>('0');
  const [discountAmount, setDiscountAmount] = useState<string>('0');

  // 📝 Concepto y Notas
  const [saleConcept, setSaleConcept] = useState<string>('');
  const [saleNote, setSaleNote] = useState<string>('');
  const [showAccordionNotes, setShowAccordionNotes] = useState<boolean>(false);

  // 🧮 Modal Calculadora de Cambio
  const [showChangeModal, setShowChangeModal] = useState<boolean>(false);
  const [customerPaidAmount, setCustomerPaidAmount] = useState<string>('');
  const [customerPaidCurrency, setCustomerPaidCurrency] = useState<'USD' | 'VES'>('USD');

  // 💸 Modal Nuevo Gasto Rápido
  const [showGastoModal, setShowGastoModal] = useState<boolean>(false);
  const [gastoConcept, setGastoConcept] = useState<string>('');
  const [gastoAmount, setGastoAmount] = useState<string>('');
  const [gastoPaymentMethod, setGastoPaymentMethod] = useState<string>('Efectivo USD');
  const [isSavingGasto, setIsSavingGasto] = useState<boolean>(false);

  // 💰 Modal Registrar Movimiento Financiero (Ingreso / Egreso)
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [manualType, setManualType] = useState<'ingreso' | 'egreso'>('egreso');
  const [manualConcept, setManualConcept] = useState<string>('');
  const [manualCategory, setManualCategory] = useState<string>('Otros gastos');
  const [manualAmountUsd, setManualAmountUsd] = useState<string>('');
  const [manualPaymentMethod, setManualPaymentMethod] = useState<string>('Efectivo USD');
  const [manualObservations, setManualObservations] = useState<string>('');
  const [isSavingManual, setIsSavingManual] = useState<boolean>(false);
  const manualAmountBs = (parseFloat(manualAmountUsd) || 0) * customBcvRate;

  // 📦 Modal Crear Producto Rápido
  const [showCreateProductModal, setShowCreateProductModal] = useState<boolean>(false);
  const [newProdName, setNewProdName] = useState<string>('');
  const [newProdSku, setNewProdSku] = useState<string>('');
  const [newProdPrice, setNewProdPrice] = useState<string>('');
  const [newProdStock, setNewProdStock] = useState<string>('10');
  const [newProdCategory, setNewProdCategory] = useState<string>('');
  const [newProdTaxId, setNewProdTaxId] = useState<string>('exento');
  const [newProdTaxRate, setNewProdTaxRate] = useState<number>(0);
  const [isSavingProduct, setIsSavingProduct] = useState<boolean>(false);

  // 🎉 Modal Éxito de Venta y Comprobante
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [successSaleName, setSuccessSaleName] = useState<string>('');

  // 🛍️ Venta Libre (Código 99999) State
  const [showVentaLibreModal, setShowVentaLibreModal] = useState(false);
  const [vlName, setVlName] = useState('');
  const [vlPrice, setVlPrice] = useState('');
  const [vlQty, setVlQty] = useState('1');
  const [vlTaxId, setVlTaxId] = useState<string>('exento');
  const [vlTaxRate, setVlTaxRate] = useState<number>(0);
  const [editingVlId, setEditingVlId] = useState<string | null>(null);
  const [vlSaveDb, setVlSaveDb] = useState(true);
  const [isSavingVl, setIsSavingVl] = useState(false);

  useEffect(() => {
    Promise.all([
      dbService.getCategories().catch(() => []),
      dbService.getBrands().catch(() => [])
    ]).then(([cats, brs]) => {
      setCategories(cats || []);
      setBrands(brs || []);
    });
  }, []);

  // Global payment methods configured in Settings > Facturación
  const [configuredPaymentMethods, setConfiguredPaymentMethods] = useState<PaymentMethodConfig[]>([]);

  // Global disabled methods settings (legacy fallback)
  const [disabledSettings, setDisabledSettings] = useState({
    delivery_b2c: false,
    delivery_retiro: false,
    pay_pagomovil: false,
    pay_efectivo: false,
    pay_transferencia: false,
    pay_punto: false,
    pay_otras: false,
    pay_binance: false,
    pay_zelle: false
  });

  const loadPaymentMethodsConfig = async () => {
    try {
      const methods = await dbService.getPaymentMethods();
      if (methods && Array.isArray(methods) && methods.length > 0) {
        setConfiguredPaymentMethods(methods);
      } else {
        setConfiguredPaymentMethods([]);
      }
    } catch (e) {
      console.error("Error loading payment methods in POS:", e);
    }
  };

  useEffect(() => {
    const loadSettings = () => {
      try {
        const saved = localStorage.getItem('copias_bellavista_disabled_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          setDisabledSettings({
            delivery_b2c: parsed.delivery_b2c === true,
            delivery_retiro: parsed.delivery_retiro === true,
            pay_pagomovil: parsed.pay_pagomovil === true,
            pay_efectivo: parsed.pay_efectivo === true,
            pay_transferencia: parsed.pay_transferencia === true,
            pay_punto: parsed.pay_punto === true,
            pay_otras: parsed.pay_otras === true,
            pay_binance: parsed.pay_binance === true,
            pay_zelle: parsed.pay_zelle === true
          });
        }
      } catch (e) {
        console.error(e);
      }
    };

    loadSettings();
    loadPaymentMethodsConfig();

    window.addEventListener('storage', loadSettings);
    window.addEventListener('bellavista_payment_methods_updated', loadPaymentMethodsConfig);
    window.addEventListener('bellavista_settings_updated', loadPaymentMethodsConfig);

    return () => {
      window.removeEventListener('storage', loadSettings);
      window.removeEventListener('bellavista_payment_methods_updated', loadPaymentMethodsConfig);
      window.removeEventListener('bellavista_settings_updated', loadPaymentMethodsConfig);
    };
  }, []);

  const getActiveMethods = () => {
    // 1. If custom configured payment methods exist in Settings > Facturación
    if (configuredPaymentMethods && configuredPaymentMethods.length > 0) {
      const activeFromConfig = configuredPaymentMethods
        .filter(m => m.is_active !== false)
        .sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99))
        .map(m => {
          let icon = '💳';
          if (m.type === 'efectivo') icon = '💵';
          else if (m.type === 'movil') icon = '📱';
          else if (m.type === 'transferencia') icon = '🏛️';
          else if (m.type === 'punto') icon = '💳';
          else if (m.type === 'digital') icon = '🪙';
          
          return {
            id: m.name,
            label: m.currency ? `${m.name} (${m.currency})` : m.name,
            icon: icon,
            rawConfig: m
          };
        });

      if (activeFromConfig.length > 0) {
        return activeFromConfig;
      }
    }

    // 2. Fallback to default catalog filtered by disabledSettings
    const list: { id: string; label: string; icon: string; rawConfig?: PaymentMethodConfig }[] = [];
    if (!disabledSettings.pay_efectivo) {
      list.push({ id: 'Efectivo USD', label: 'Efectivo USD ($)', icon: '💵' });
      list.push({ id: 'Efectivo VES', label: 'Efectivo VES (Bs.)', icon: '💵' });
    }
    if (!disabledSettings.pay_pagomovil) {
      list.push({ id: 'Pago Móvil', label: 'Pago Móvil (VES)', icon: '📱' });
    }
    if (!disabledSettings.pay_punto) {
      list.push({ id: 'Punto de Venta', label: 'Punto de Venta / POS', icon: '💳' });
    }
    if (!disabledSettings.pay_transferencia) {
      list.push({ id: 'Transferencia Bancaria', label: 'Transferencia Bancaria (VES)', icon: '🏛️' });
    }
    if (!disabledSettings.pay_otras) {
      list.push({ id: 'Euro', label: 'Euro (EUR €)', icon: '💶' });
      list.push({ id: 'Pesos Colombianos', label: 'Pesos Colombianos (COP)', icon: '🇨🇴' });
    }
    if (!disabledSettings.pay_binance) {
      list.push({ id: 'Binance', label: 'Binance Pay / USDT', icon: '🪙' });
    }
    if (!disabledSettings.pay_zelle) {
      list.push({ id: 'Zelle', label: 'Zelle (USD)', icon: '🇺🇸' });
    }
    return list;
  };

  // Keep paymentMethod synchronized if current selected method becomes disabled or is not in list
  useEffect(() => {
    const active = getActiveMethods();
    if (active.length > 0) {
      const exists = active.some(m => m.id === paymentMethod);
      if (!exists) {
        setPaymentMethod(active[0].id);
      }
    }
  }, [configuredPaymentMethods, disabledSettings]);

  // ── Currency helpers for split payments ──────────────────────────────────
  const getMethodCurrency = (method: string): CurrencyCode => {
    const cleanMethod = (method || '').trim().toLowerCase();

    // 1. Primero intentar buscar en la configuración cargada de base de datos
    if (configuredPaymentMethods && configuredPaymentMethods.length > 0) {
      const found = configuredPaymentMethods.find(pm => 
        (pm.name || '').trim().toLowerCase() === cleanMethod ||
        (pm.id || '').trim().toLowerCase() === cleanMethod ||
        (pm.name || '').replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase() === cleanMethod.replace(/\s*\([^)]*\)\s*$/, '')
      );
      if (found && found.currency && found.currency !== 'MULTIMONEDA') {
        return found.currency as CurrencyCode;
      }
    }

    // 2. Fallback de coincidencia de texto más exhaustivo y tolerante
    if (
      cleanMethod.includes('ves') ||
      cleanMethod.includes('bolivar') ||
      cleanMethod.includes('bolívar') ||
      cleanMethod.includes('pago movil') ||
      cleanMethod.includes('pago móvil') ||
      cleanMethod.includes('punto') ||
      cleanMethod.includes('biopago') ||
      cleanMethod.includes('transferencia') ||
      cleanMethod.includes('cxc') ||
      cleanMethod.includes('caja') ||
      (cleanMethod.includes('bs') && !cleanMethod.includes('usd'))
    ) return 'VES';

    if (cleanMethod.includes('eur') || cleanMethod.includes('euro')) return 'EUR';
    if (cleanMethod.includes('cop') || cleanMethod.includes('peso')) return 'COP';
    return 'USD';
  };

  const methodAmountToUsd = (amount: number, method: string): number => {
    const curr = getMethodCurrency(method);
    if (curr === 'USD') return amount || 0;
    const rate = curr === 'VES'
      ? (customBcvRate > 0 ? customBcvRate : (currencyRates.VES || bcvRate || 45.5))
      : (currencyRates[curr] || 1);
    return rate > 0 ? (amount || 0) / rate : 0;
  };

  const usdToMethodAmount = (usdAmount: number, method: string): number => {
    const curr = getMethodCurrency(method);
    if (curr === 'USD') return usdAmount || 0;
    const rate = curr === 'VES'
      ? (customBcvRate > 0 ? customBcvRate : (currencyRates.VES || bcvRate || 45.5))
      : (currencyRates[curr] || 1);
    return (usdAmount || 0) * rate;
  };

  const handleAddSplitMethod = () => {
    const active = getActiveMethods();
    const currentMethods = splitPayments.map(p => p.method);
    const nextAvailable = active.find(m => !currentMethods.includes(m.id))?.id || active[0]?.id || 'Efectivo USD';

    let sumOtherUsd = 0;
    splitPayments.forEach(p => {
      sumOtherUsd += methodAmountToUsd(p.amount || 0, p.method);
    });
    const remainingUsd = Math.max(0, total - sumOtherUsd);
    const convertedAmount = parseFloat(usdToMethodAmount(remainingUsd, nextAvailable).toFixed(2));

    const updated = [...splitPayments, { method: nextAvailable, amount: convertedAmount }];
    setSplitPayments(updated);
    setPaymentCount(updated.length);
  };

  const handleRemoveSplitMethod = (index: number) => {
    if (splitPayments.length <= 1) return;
    const updated = splitPayments.filter((_, idx) => idx !== index);
    setSplitPayments(updated);
    setPaymentCount(updated.length);
  };

  const handleApplyDiscountCode = (code: string) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;
    if (cleanCode.includes('10')) {
      setDiscountPercent('10');
      showToast('success', 'Cupón del 10% de descuento aplicado.');
    } else if (cleanCode.includes('20')) {
      setDiscountPercent('20');
      showToast('success', 'Cupón del 20% de descuento aplicado.');
    } else if (cleanCode.includes('5')) {
      setDiscountPercent('5');
      showToast('success', 'Cupón del 5% de descuento aplicado.');
    } else {
      setDiscountPercent('10');
      showToast('success', `Cupón "${cleanCode}" aplicado con éxito.`);
    }
  };

    const handlePaymentCountChange = (count: number) => {
    setPaymentCount(count);
    const active = getActiveMethods();
    const defaultMethod = active[0]?.id || 'Efectivo USD';

    if (count === 1) {
      setPaymentMethod(splitPayments[0]?.method || defaultMethod);
      return;
    }

    const equalShareUsd = count > 0 ? total / count : total;
    let accumulatedUsd = 0;
    const newSplits: { method: string; amount: number }[] = [];
    for (let i = 0; i < count; i++) {
      const shareUsd = i === count - 1 ? Math.max(0, total - accumulatedUsd) : equalShareUsd;
      accumulatedUsd += shareUsd;
      const slotMethod = splitPayments[i]?.method || active[i % active.length]?.id || defaultMethod;
      const convertedAmt = parseFloat(usdToMethodAmount(shareUsd, slotMethod).toFixed(2));
      newSplits.push({
        method: slotMethod,
        amount: convertedAmt
      });
    }
    setSplitPayments(newSplits);
  };

  const handleUpdateSplitMethod = (index: number, newMethodId: string) => {
    setSplitPayments(prev => {
      const copy = [...prev];
      if (copy[index]) {
        const oldMethod = copy[index].method;
        const currentAmount = copy[index].amount || 0;
        const inUsd = methodAmountToUsd(currentAmount, oldMethod);
        const inNewMethod = parseFloat(usdToMethodAmount(inUsd, newMethodId).toFixed(2));
        copy[index] = {
          method: newMethodId,
          amount: inNewMethod
        };
      }
      return copy;
    });
  };

  const handleUpdateSplitAmount = (index: number, val: number) => {
    setSplitPayments(prev => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = {
          ...copy[index],
          amount: isNaN(val) ? 0 : val
        };
      }
      return copy;
    });
  };

  const handleFillRemaining = (index: number) => {
    setSplitPayments(prev => {
      const copy = [...prev];
      let sumOtherUsd = 0;
      copy.forEach((item, idx) => {
        if (idx !== index) {
          sumOtherUsd += methodAmountToUsd(item.amount || 0, item.method);
        }
      });
      const remainingUsd = Math.max(0, total - sumOtherUsd);
      if (copy[index]) {
        copy[index] = {
          ...copy[index],
          amount: parseFloat(usdToMethodAmount(remainingUsd, copy[index].method).toFixed(2))
        };
      }
      return copy;
    });
  };

  // Cash Register session state
  const [activeSession, setActiveSession] = useState<any | null>(null);

  const checkActiveSession = async () => {
    try {
      const active = await dbService.getActiveCashSession();
      setActiveSession(active);
    } catch (e) {
      console.error("Error loading cash session in POSModule:", e);
    }
  };

  // 🔐 Store Users & Permissions for Cash Register
  const [localStoreUsers, setLocalStoreUsers] = useState<StoreUser[]>([]);

  useEffect(() => {
    if (storeUsers && storeUsers.length > 0) {
      setLocalStoreUsers(storeUsers);
    } else {
      dbService.getStoreUsers().then(users => {
        if (users && users.length > 0) {
          setLocalStoreUsers(users);
        }
      }).catch(console.error);
    }
  }, [storeUsers]);

  // Filter active registered store personnel who have caja permissions
  const authorizedCajaUsers = useMemo(() => {
    const list = localStoreUsers.length > 0 ? localStoreUsers : (storeUsers || []);
    return list.filter(u => {
      if (u.is_active === false) return false;
      const role = (u.role || '').toLowerCase();
      if (role === 'cliente') return false;

      if (role === 'gerente' || role === 'admin' || role === 'administrador' || role === 'cajero') {
        return true;
      }

      if (u.permissions && u.permissions.length > 0) {
        return u.permissions.some(p => p === 'caja' || p === 'sales' || p === 'orders');
      }

      return false;
    });
  }, [localStoreUsers, storeUsers]);

  // 🔐 Modal Apertura y Cierre de Caja
  const [showOpenCajaModal, setShowOpenCajaModal] = useState<boolean>(false);
  const [aperturaBsInput, setAperturaBsInput] = useState<string>('10.00');
  const [aperturaObsInput, setAperturaObsInput] = useState<string>('');
  const [aperturaEmployee, setAperturaEmployee] = useState<string>('');
  const [isSavingApertura, setIsSavingApertura] = useState<boolean>(false);

  useEffect(() => {
    if (showOpenCajaModal) {
      if (!aperturaEmployee) {
        const defaultUser = currentUser?.name || currentUser?.email;
        if (defaultUser && currentUser?.role !== 'Cliente') {
          setAperturaEmployee(defaultUser);
        } else if (authorizedCajaUsers.length > 0) {
          const first = authorizedCajaUsers[0];
          setAperturaEmployee(first.name || first.email);
        }
      }
    }
  }, [showOpenCajaModal, aperturaEmployee, currentUser, authorizedCajaUsers]);

  const [showCloseCajaModal, setShowCloseCajaModal] = useState<boolean>(false);
  const [cierreBsInput, setCierreBsInput] = useState<string>('0.00');
  const [cierreObsInput, setCierreObsInput] = useState<string>('');
  const [isSavingCierre, setIsSavingCierre] = useState<boolean>(false);
  const [ticketSession, setTicketSession] = useState<any | null>(null);
  const [allCashOpsForTicket, setAllCashOpsForTicket] = useState<any[]>([]);
  const [showTicketModal, setShowTicketModal] = useState<boolean>(false);

  const [sessionSummary, setSessionSummary] = useState<{
    totalSalesBs: number;
    totalSalesUsd: number;
    totalIncomesBs: number;
    totalEgressesBs: number;
    expectedBs: number;
    expectedUsd: number;
  } | null>(null);

  const handleConfirmOpenCaja = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (activeSession) {
      showToast('error', `Ya existe una caja abierta asignada a: ${activeSession.empleado_nombre || 'otro empleado'}. Debe cerrar la caja activa primero.`);
      return;
    }

    const aperturaBs = parseFloat(aperturaBsInput) || 0;
    const rateToUse = customBcvRate > 0 ? customBcvRate : 36.5;
    const openingUsd = aperturaBs / rateToUse;
    const empName = aperturaEmployee.trim() || currentUser?.name || currentUser?.email || 'Cajero de Turno';
    
    setIsSavingApertura(true);
    try {
      await dbService.createCashSession({
        empleado_nombre: empName,
        empleado_id: currentUser?.id || null,
        apertura_bs: aperturaBs,
        apertura_usd: openingUsd,
        observaciones: aperturaObsInput.trim()
      });

      await dbService.addCashOp({
        type: 'ingreso',
        concept: 'Apertura de Caja - Fondo Inicial',
        amount: openingUsd,
        amount_bs: aperturaBs,
        empleado_nombre: empName,
        payment_method: 'Efectivo VES'
      });

      await checkActiveSession();
      if (onRefreshData) {
        onRefreshData();
      }
      setShowOpenCajaModal(false);
      showToast('success', `¡Caja abierta exitosamente por ${empName}!`);
    } catch (err: any) {
      console.error(err);
      showToast('error', `Error al abrir caja: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsSavingApertura(false);
    }
  };

  const prepareCloseCajaModal = async () => {
    if (!activeSession) return;
    setIsLoading(true);
    try {
      const ops = await dbService.getCashOps();
      const sessionOps = ops.filter((op: any) => op.session_id === activeSession.id);
      const initialBs = Number(activeSession.apertura_bs) || 0;
      const initialUsd = Number(activeSession.apertura_usd) || 0;

      let sessionIngressesBs = 0;
      let sessionIngressesUsd = 0;
      let sessionEgressesBs = 0;
      let sessionEgressesUsd = 0;

      sessionOps.forEach((op: any) => {
        if (op.type === 'ingreso' && op.concept !== 'Apertura de Caja - Fondo Inicial') {
          sessionIngressesBs += Number(op.amount_bs) || 0;
          sessionIngressesUsd += Number(op.amount) || 0;
        } else if (op.type === 'egreso') {
          sessionEgressesBs += Number(op.amount_bs) || 0;
          sessionEgressesUsd += Number(op.amount) || 0;
        }
      });

      const expectedBs = initialBs + sessionIngressesBs - sessionEgressesBs;
      const expectedUsd = initialUsd + sessionIngressesUsd - sessionEgressesUsd;

      setSessionSummary({
        totalSalesBs: sessionIngressesBs,
        totalSalesUsd: sessionIngressesUsd,
        totalIncomesBs: sessionIngressesBs,
        totalEgressesBs: sessionEgressesBs,
        expectedBs,
        expectedUsd
      });
      setCierreBsInput(expectedBs > 0 ? expectedBs.toFixed(2) : '0.00');
      setCierreObsInput('');
      setShowCloseCajaModal(true);
    } catch (err: any) {
      console.error("Error preparing close caja:", err);
      showToast('error', 'Error al consultar operaciones de caja');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmCloseCaja = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeSession) return;

    const cierreBs = parseFloat(cierreBsInput) || 0;
    const rateToUse = customBcvRate > 0 ? customBcvRate : 36.5;
    const cierreUsd = cierreBs / rateToUse;
    const expectedBs = sessionSummary?.expectedBs || 0;
    const expectedUsd = sessionSummary?.expectedUsd || 0;
    const diferenciaBs = cierreBs - expectedBs;
    const diferenciaUsd = cierreUsd - expectedUsd;

    let estadoArqueo = 'cuadrada';
    if (Math.abs(diferenciaBs) >= 0.01) {
      estadoArqueo = diferenciaBs > 0 ? 'descuadre_sobrante' : 'descuadre_faltante';
    }

    setIsSavingCierre(true);
    try {
      const closedSession = await dbService.updateCashSession(activeSession.id, {
        cierre: new Date().toLocaleString('es-VE'),
        cierre_bs: cierreBs,
        cierre_usd: cierreUsd,
        esperado_bs: expectedBs,
        esperado_usd: expectedUsd,
        diferencia_bs: diferenciaBs,
        diferencia_usd: diferenciaUsd,
        estado: 'cerrada',
        estado_arqueo: estadoArqueo,
        observaciones: cierreObsInput.trim()
      });

      await dbService.addCashOp({
        type: 'egreso',
        concept: 'Cierre de Caja - Entrega de Efectivo (Arqueo)',
        amount: cierreUsd,
        amount_bs: cierreBs,
        empleado_nombre: activeSession.empleado_nombre || currentUser?.name || 'Cajero',
        payment_method: 'Efectivo VES'
      });

      const allOps = await dbService.getCashOps();

      await checkActiveSession();
      if (onRefreshData) {
        onRefreshData();
      }
      setShowCloseCajaModal(false);
      showToast('success', `¡Caja cerrada exitosamente! (${estadoArqueo === 'cuadrada' ? 'Caja Cuadrada' : 'Descuadre Registrado'})`);

      // Open Closure Ticket Modal
      setTicketSession(closedSession || { ...activeSession, cierre_bs: cierreBs, estado: 'cerrada', estado_arqueo: estadoArqueo, observaciones: cierreObsInput.trim() });
      setAllCashOpsForTicket(allOps);
      setShowTicketModal(true);
    } catch (err: any) {
      console.error(err);
      showToast('error', `Error al cerrar caja: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsSavingCierre(false);
    }
  };

  // Clients database for autocomplete
  const [clients, setClients] = useState<any[]>([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [filteredClients, setFilteredClients] = useState<any[]>([]);

  const handleClientChange = (val: string) => {
    setSelectedClient(val);
    if (!val.trim()) {
      setFilteredClients([]);
      setShowClientSuggestions(false);
      return;
    }
    const filtered = clients.filter(c => 
      (c.name || '').toLowerCase().includes(val.toLowerCase()) ||
      (c.document || '').toLowerCase().includes(val.toLowerCase())
    );
    setFilteredClients(filtered);
    setShowClientSuggestions(filtered.length > 0);
  };

  // Database lists
  const [invoiceHistory, setInvoiceHistory] = useState<any[]>([]);
  const [draftInvoices, setDraftInvoices] = useState<any[]>([]);
  const [draftToDelete, setDraftToDelete] = useState<{ id: string; ref: string } | null>(null);
  
  // Catalog display limit state: 'top10' (only show top 10 most sold) or 'all'
  const [catalogShowLimit, setCatalogShowLimit] = useState<'top10' | 'all'>('top10');

  // Loading & interactive UI states
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals state
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'todos' | 'factura' | 'nota_entrega'>('todos');
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_ITEMS_PER_PAGE = 10;

  // Filtered invoices for the history modal
  const filteredHistoryInvoices = useMemo(() => {
    return invoiceHistory.filter((inv) => {
      const isNota = inv.document_type === 'nota_entrega' || (inv.control_number && String(inv.control_number).startsWith('NE-'));
      
      // Filter by document type
      if (historyTypeFilter === 'factura' && isNota) return false;
      if (historyTypeFilter === 'nota_entrega' && !isNota) return false;

      // Filter by search query (Number, Customer Name, RIF/CI, Payment Method, Total)
      if (historySearchQuery.trim()) {
        const q = historySearchQuery.trim().toLowerCase();
        const numMatch = (inv.control_number || '').toString().toLowerCase().includes(q);
        const customerMatch = (inv.customer_name || '').toLowerCase().includes(q);
        const docMatch = (inv.customer_id || inv.customer_document || inv.rif || inv.document || '').toString().toLowerCase().includes(q);
        const methodMatch = (inv.payment_method || '').toLowerCase().includes(q);
        const totalMatch = (inv.total || '').toString().includes(q);

        if (!numMatch && !customerMatch && !docMatch && !methodMatch && !totalMatch) {
          return false;
        }
      }

      return true;
    });
  }, [invoiceHistory, historyTypeFilter, historySearchQuery]);

  // Counts for type filter tabs
  const totalFacturasCount = useMemo(() => {
    return invoiceHistory.filter(inv => !(inv.document_type === 'nota_entrega' || (inv.control_number && String(inv.control_number).startsWith('NE-')))).length;
  }, [invoiceHistory]);

  const totalNotasCount = useMemo(() => {
    return invoiceHistory.filter(inv => inv.document_type === 'nota_entrega' || (inv.control_number && String(inv.control_number).startsWith('NE-'))).length;
  }, [invoiceHistory]);

  // Reset page when search or filter changes
  useEffect(() => {
    setHistoryPage(1);
  }, [historySearchQuery, historyTypeFilter]);

  // Pagination calculation
  const totalHistoryPages = Math.ceil(filteredHistoryInvoices.length / HISTORY_ITEMS_PER_PAGE) || 1;
  const paginatedHistoryInvoices = filteredHistoryInvoices.slice(
    (historyPage - 1) * HISTORY_ITEMS_PER_PAGE,
    historyPage * HISTORY_ITEMS_PER_PAGE
  );
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [showDraftsListModal, setShowDraftsListModal] = useState(false);
  const [draftReference, setDraftReference] = useState('');
  
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [pendingDraftToResume, setPendingDraftToResume] = useState<any>(null);
  
  const [completedInvoice, setCompletedInvoice] = useState<any>(null);
  const [invoiceBcvRate, setInvoiceBcvRate] = useState<number>(bcvRate || 36.5);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  // Sync historical BCV rate when opening an invoice or delivery note in digital view
  useEffect(() => {
    if (completedInvoice) {
      const fallbackRate = (completedInvoice as any).bcv_rate || (completedInvoice as any).rate || (customBcvRate > 0 ? customBcvRate : (bcvRate > 0 ? bcvRate : 36.5));
      setInvoiceBcvRate(fallbackRate);
      if (completedInvoice.created_at) {
        dbService.getBcvRateForDate(completedInvoice.created_at, fallbackRate)
          .then((rate) => {
            if (rate && rate > 0) {
              setInvoiceBcvRate(rate);
            }
          })
          .catch((err) => {
            console.warn('Could not load historical BCV rate for invoice date:', err);
          });
      }
    }
  }, [completedInvoice, customBcvRate, bcvRate]);

  // Search and quick add client modals
  const [showClientSearchModal, setShowClientSearchModal] = useState(false);
  const [showQuickClientModal, setShowQuickClientModal] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  
  // Quick client form states
  const [newClientName, setNewClientName] = useState('');
  const [newClientDocument, setNewClientDocument] = useState('');
  const [newClientType, setNewClientType] = useState<'Natural' | 'Jurídico'>('Natural');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientCredit, setNewClientCredit] = useState('0');

  const handleQuickRegisterClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) {
      showToast('error', 'El nombre es obligatorio.');
      return;
    }
    if (!newClientDocument.trim()) {
      showToast('error', 'El documento o C.I. / RIF es obligatorio.');
      return;
    }

    setIsLoading(true);
    try {
      const clientPayload = {
        name: newClientName.trim(),
        document: newClientDocument.trim(),
        type: newClientType,
        phone: newClientPhone.trim(),
        email: newClientEmail.trim(),
        credit_usd: parseFloat(newClientCredit) || 0
      };

      const created = await dbService.createClient(clientPayload);
      if (created) {
        showToast('success', '¡Cliente registrado y seleccionado exitosamente!');
        // Update client list
        setClients(prev => [created, ...prev]);
        setSelectedClient(created.name);
        // Reset states
        setNewClientName('');
        setNewClientDocument('');
        setNewClientType('Natural');
        setNewClientPhone('');
        setNewClientEmail('');
        setNewClientCredit('0');
        setShowQuickClientModal(false);
      } else {
        showToast('error', 'No se pudo crear el cliente.');
      }
    } catch (err: any) {
      console.error('Error in quick client creation:', err);
      showToast('error', `Error al registrar cliente: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Load invoices and draft invoices from Supabase
  const loadInvoiceData = async () => {
    setIsLoadingData(true);
    try {
      const [invoices, drafts, dbClientsList] = await Promise.all([
        dbService.getInvoices(),
        dbService.getDraftInvoices(),
        dbService.getClients()
      ]);
      setInvoiceHistory(invoices);
      setDraftInvoices(drafts);
      setClients(dbClientsList);
    } catch (err) {
      console.error('Error loading invoices/drafts/clients data:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadInvoiceData();
    checkActiveSession();

    const handleDataUpdate = () => {
      loadInvoiceData();
      checkActiveSession();
    };

    window.addEventListener('bellavista_invoices_updated', handleDataUpdate);
    window.addEventListener('bellavista_cash_updated', handleDataUpdate);
    window.addEventListener('bellavista_orders_updated', handleDataUpdate);

    return () => {
      window.removeEventListener('bellavista_invoices_updated', handleDataUpdate);
      window.removeEventListener('bellavista_cash_updated', handleDataUpdate);
      window.removeEventListener('bellavista_orders_updated', handleDataUpdate);
    };
  }, [products]);

  // Display ephemeral toast notification
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + (item.product.price * item.qty), 0);
  
  // Calculate discounts
  const discountPercentNum = parseFloat(discountPercent) || 0;
  const discountAmountNum = parseFloat(discountAmount) || 0;
  const calculatedDiscountUsd = discountPercentNum > 0 
    ? parseFloat((subtotal * (discountPercentNum / 100)).toFixed(2))
    : discountAmountNum;

  // Extra charges total
  const extraChargesTotal = extraCharges.reduce((acc, c) => acc + (Number(c.amount) || 0), 0);

  // Base for taxes after discount and plus extra charges
  const baseForTaxes = Math.max(0, subtotal - calculatedDiscountUsd + extraChargesTotal);

  // IVA & IGTF
  const calculatedIvaUsd = applyIva ? parseFloat((baseForTaxes * 0.16).toFixed(2)) : 0;
  const calculatedIgtfUsd = applyIgtf ? parseFloat((baseForTaxes * 0.03).toFixed(2)) : 0;

  // Final Total to Pay in USD
  const total = parseFloat((baseForTaxes + calculatedIvaUsd + calculatedIgtfUsd).toFixed(2));
  const iva = calculatedIvaUsd;

  const appliedTaxes = [
    ...(applyIva ? [{ id: 'iva-16', name: 'IVA (16%)', rate: 16, amount: calculatedIvaUsd }] : []),
    ...(applyIgtf ? [{ id: 'igtf-3', name: 'IGTF (3%)', rate: 3, amount: calculatedIgtfUsd }] : [])
  ];

    useEffect(() => {
    if (paymentCount > 1) {
      const active = getActiveMethods();
      const defaultMethod = active[0]?.id || 'Efectivo USD';
      
      const equalShareUsd = paymentCount > 0 ? total / paymentCount : total;
      let accumulatedUsd = 0;
      setSplitPayments(prev => {
        const copy = [...prev];
        const updated: { method: string; amount: number }[] = [];
        for (let i = 0; i < paymentCount; i++) {
          const shareUsd = i === paymentCount - 1 ? Math.max(0, total - accumulatedUsd) : equalShareUsd;
          accumulatedUsd += shareUsd;
          const slotMethod = copy[i]?.method || active[i % active.length]?.id || defaultMethod;
          const convertedAmt = parseFloat(usdToMethodAmount(shareUsd, slotMethod).toFixed(2));
          updated.push({
            method: slotMethod,
            amount: convertedAmt
          });
        }
        return updated;
      });
    }
  }, [total, paymentCount]);

  // 🛍️ Venta Libre (Código 99999) Handlers
  const openVentaLibreModal = (_preset?: Partial<Product>) => {
    const isItemInCart = _preset?.id ? cart.some(item => item.product.id === _preset.id) : false;
    const isPresetCatalogCard = _preset?.id === 'preset-sku-99999';

    if (isItemInCart && !isPresetCatalogCard) {
      setEditingVlId(_preset!.id!);
      setVlName(_preset?.name || '');
      setVlPrice(_preset?.price !== undefined && _preset?.price !== null ? _preset.price.toString() : '');
      const cartItem = cart.find(item => item.product.id === _preset!.id);
      setVlQty(cartItem ? cartItem.qty.toString() : '1');
    } else {
      setEditingVlId(null);
      setVlName('');
      setVlPrice(_preset?.price && _preset.price > 0 ? _preset.price.toString() : '');
      setVlQty('1');
    }

    const defaultTaxId = _preset?.tax_id || 'exento';
    setVlTaxId(defaultTaxId);
    if (defaultTaxId === 'exento' || defaultTaxId === '0') {
      setVlTaxRate(0);
    } else {
      const rateToUse = _preset?.tax_rate !== undefined && _preset?.tax_rate !== null 
        ? _preset.tax_rate 
        : (taxes.find(t => t.id === defaultTaxId)?.rate || 0);
      setVlTaxRate(rateToUse);
    }
    setVlSaveDb(true);
    setShowVentaLibreModal(true);
  };

  const handleConfirmVentaLibre = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = vlName.trim();
    const parsedPrice = parseFloat(vlPrice);
    const parsedQty = parseInt(vlQty, 10) || 1;

    if (!cleanName) {
      showToast('error', 'El nombre del producto/servicio es obligatorio.');
      return;
    }
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      showToast('error', 'Ingrese un precio de venta mayor a 0.00 $ USD.');
      return;
    }

    setIsSavingVl(true);
    try {
      let createdProduct: Product | null = null;
      if (vlSaveDb && !editingVlId) {
        try {
          createdProduct = await dbService.createProduct({
            name: cleanName,
            sku: `PRD-${Date.now().toString().slice(-6)}`,
            slug: cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString().slice(-4),
            price: parsedPrice,
            offer_price: null,
            stock: 999999,
            category_id: '',
            brand_id: '',
            featured: false,
            active: true,
            description: 'Registrado desde Venta Flash (Venta Libre)',
            technical_sheet_url: null,
            barcode_qr: null,
            tax_id: vlTaxId,
            tax_rate: vlTaxRate
          });
          if (createdProduct && onRefreshData) {
            onRefreshData();
          }
        } catch (dbErr) {
          console.error("Error al guardar producto de Venta Libre en DB:", dbErr);
        }
      }

      if (editingVlId) {
        setCart(prevCart => prevCart.map(item => {
          if (item.product.id === editingVlId) {
            return {
              ...item,
              product: {
                ...item.product,
                name: cleanName,
                price: parsedPrice,
                tax_id: vlTaxId,
                tax_rate: vlTaxRate
              },
              qty: parsedQty
            };
          }
          return item;
        }));
        showToast('success', `¡Venta Libre "${cleanName}" actualizada!`);
      } else {
        const openProduct: Product = createdProduct || {
          id: `vl-99999-${Date.now()}`,
          name: cleanName,
          sku: '99999',
          slug: `vl-${Date.now()}`,
          price: parsedPrice,
          tax_id: vlTaxId,
          tax_rate: vlTaxRate,
          offer_price: null,
          stock: 999999,
          category_id: '',
          brand_id: '',
          featured: false,
          active: true,
          description: 'Venta Libre (99999)',
          technical_sheet_url: null,
          barcode_qr: null
        };

        setCart(prevCart => {
          const existingIndex = prevCart.findIndex(item => 
            (item.product.sku === '99999' || item.product.id.startsWith('vl-99999')) && 
            item.product.name.toLowerCase() === cleanName.toLowerCase()
          );
          if (existingIndex > -1) {
            const newCart = [...prevCart];
            newCart[existingIndex] = {
              product: { 
                ...newCart[existingIndex].product, 
                name: cleanName, 
                price: parsedPrice,
                tax_id: vlTaxId,
                tax_rate: vlTaxRate
              },
              qty: newCart[existingIndex].qty + parsedQty
            };
            return newCart;
          } else {
            return [...prevCart, { product: openProduct, qty: parsedQty }];
          }
        });
        showToast('success', `¡Venta Libre "${cleanName}" ${createdProduct ? 'guardada en productos y agregada a la factura' : 'agregada a la factura'}!`);
      }

      setShowVentaLibreModal(false);
      setVlName('');
      setVlPrice('');
      setVlQty('1');
      setVlTaxId('exento');
      setVlTaxRate(0);
      setEditingVlId(null);
      if (searchTerm.trim() === '99999') setSearchTerm('');
    } catch (err: any) {
      console.error(err);
      showToast('error', `Error al registrar Venta Libre: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsSavingVl(false);
    }
  };

  // Search filter
  const activeProducts = products.filter(p => p && p.active);
  const defaultVentaLibreProduct: Product = {
    id: 'preset-sku-99999',
    name: '99999 - Venta Libre / Ítem Abierto',
    sku: '99999',
    slug: 'venta-libre-99999',
    price: 0,
    offer_price: null,
    stock: 999999,
    category_id: '',
    brand_id: '',
    featured: false,
    active: true,
    description: 'Venta libre especial: asigna nombre y precio al facturar.',
    technical_sheet_url: null,
    barcode_qr: '99999'
  };

  const cleanActiveProducts = activeProducts.filter(p => p.sku !== '99999');

  // Mapa de unidades vendidas acumuladas por producto calculado desde el historial de facturas
  const productSalesMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (Array.isArray(invoiceHistory)) {
      invoiceHistory.forEach(inv => {
        if (inv && Array.isArray(inv.items)) {
          inv.items.forEach((item: any) => {
            const qty = Number(item.qty || item.quantity || 1) || 1;
            const pid = item.product_id || item.id;
            const sku = item.sku;
            if (pid) {
              map[String(pid)] = (map[String(pid)] || 0) + qty;
            }
            if (sku) {
              map[String(sku)] = (map[String(sku)] || 0) + qty;
            }
          });
        }
      });
    }
    return map;
  }, [invoiceHistory]);

  // Ordenar productos activos por cantidad de ventas (los más vendidos primero)
  const productsSortedBySales = useMemo(() => {
    return [...cleanActiveProducts].sort((a, b) => {
      const salesA = (productSalesMap[String(a.id)] || 0) + (productSalesMap[String(a.sku)] || 0);
      const salesB = (productSalesMap[String(b.id)] || 0) + (productSalesMap[String(b.sku)] || 0);
      if (salesB !== salesA) {
        return salesB - salesA;
      }
      if (b.featured !== a.featured) return b.featured ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }, [cleanActiveProducts, productSalesMap]);

  const displayProductsList = [defaultVentaLibreProduct, ...productsSortedBySales];

  // Ordenar categorías por popularidad (mayor cantidad de productos activos primero)
  const popularCategories = [...categories].sort((a, b) => {
    const countA = activeProducts.filter(p => String(p.category_id) === String(a.id)).length;
    const countB = activeProducts.filter(p => String(p.category_id) === String(b.id)).length;
    return countB - countA;
  });

  // Filtrado por Categoría seleccionada (ordenado por los más vendidos)
  const categoryProductsSorted = selectedCategoryId === 'all'
    ? productsSortedBySales
    : productsSortedBySales.filter(p => String(p.category_id) === String(selectedCategoryId));

  // Lista base del catálogo (solo muestra los 10 más vendidos por defecto)
  const baseCatalogList = catalogShowLimit === 'top10'
    ? (selectedCategoryId === 'all'
        ? [defaultVentaLibreProduct, ...categoryProductsSorted.slice(0, 10)]
        : categoryProductsSorted.slice(0, 10))
    : (selectedCategoryId === 'all'
        ? [defaultVentaLibreProduct, ...categoryProductsSorted]
        : categoryProductsSorted);

  // Filtrado final por término de búsqueda y categoría
  const filteredProducts = searchTerm.trim() === ''
    ? baseCatalogList
    : sortProductsByPriority(
        selectedCategoryId === 'all' ? displayProductsList : cleanActiveProducts.filter(p => String(p.category_id) === String(selectedCategoryId)),
        searchTerm,
        categories,
        brands
      );

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const term = searchTerm.trim();
      if (!term) return;

      if (term === '99999') {
        openVentaLibreModal();
        return;
      }

      // Check exact barcode or SKU match
      const exactMatch = displayProductsList.find(
        p => (p.barcode_qr && p.barcode_qr.toLowerCase() === term.toLowerCase()) ||
             (p.sku && p.sku.toLowerCase() === term.toLowerCase())
      );

      if (exactMatch) {
        addToCart(exactMatch);
        setSearchTerm('');
        return;
      }

      // If only 1 filtered result, auto-add
      if (filteredProducts.length === 1) {
        addToCart(filteredProducts[0]);
        setSearchTerm('');
        return;
      }
    }
  };

  // Cart operations
  const addToCart = (product: Product) => {
    // Check if item is Venta Libre / SKU 99999
    if (product.sku === '99999' || product.id === 'preset-sku-99999') {
      openVentaLibreModal(product);
      return;
    }

    // Check if item has stock (respecting "Bloquear Venta sin Stock" setting)
    const blockNoStock = localStorage.getItem('copias_bellavista_block_no_stock_sale') === 'true';
    if (blockNoStock && product.stock <= 0) {
      showToast('error', `El producto "${product.name}" no tiene stock disponible.`);
      return;
    }

    const existingIndex = cart.findIndex(item => item.product.id === product.id);
    if (existingIndex > -1) {
      const currentQty = cart[existingIndex].qty;
      if (blockNoStock && currentQty >= product.stock) {
        showToast('error', `No hay más stock disponible para "${product.name}" (${product.stock} unidades máx).`);
        return;
      }
      const newCart = [...cart];
      newCart[existingIndex].qty += 1;
      setCart(newCart);
    } else {
      setCart([...cart, { product, qty: 1 }]);
    }
    showToast('success', `Se agregó "${product.name}" al carrito.`);
  };

  const updateQty = (productId: string, newQty: number) => {
    const item = cart.find(item => item.product.id === productId);
    if (!item) return;

    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    const blockNoStock = localStorage.getItem('copias_bellavista_block_no_stock_sale') === 'true';
    if (blockNoStock && item.product.sku !== '99999' && newQty > item.product.stock) {
      showToast('error', `Cantidad solicitada excede el stock disponible (${item.product.stock} unidades máx).`);
      return;
    }

    setCart(cart.map(item => 
      item.product.id === productId ? { ...item, qty: newQty } : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
    showToast('success', 'Producto removido del carrito.');
  };

  const getCartQtyForProduct = (productId: string) => {
    const item = cart.find(item => item.product.id === productId);
    return item ? item.qty : 0;
  };

  const updateUnitPrice = (productId: string, newPrice: number) => {
    if (isNaN(newPrice) || newPrice < 0) return;
    setCart(cart.map(item => 
      item.product.id === productId 
        ? { ...item, product: { ...item.product, price: newPrice } } 
        : item
    ));
  };

  // ⏸️ POSPONE SALE / PUT ON HOLD (AUTOMATIC)
  const handlePostponeSale = async () => {
    if (cart.length === 0) {
      showToast('error', 'Debe agregar al menos un producto al carrito para postergar la venta.');
      return;
    }

    setIsLoading(true);
    try {
      // Generate sequential draft reference
      let calculatedDraftRef = '';
      if (activeDraftId) {
        const existingDraft = draftInvoices.find(d => d.id === activeDraftId);
        if (existingDraft) {
          calculatedDraftRef = existingDraft.reference;
        }
      }

      if (!calculatedDraftRef) {
        const count = draftInvoices.length;
        calculatedDraftRef = `ESP-${1001 + count}`;
      }

      // Create draft details matching db structure
      const draftItems = cart.map(item => {
        const itemTaxRate = item.product.tax_rate !== undefined && item.product.tax_rate !== null ? item.product.tax_rate : 0;
        const itemTaxId = item.product.tax_id || (itemTaxRate > 0 ? 'default-iva' : 'exento');
        const itemTotal = item.product.price * item.qty;
        const itemTaxAmount = itemTotal * (itemTaxRate / 100);
        return {
          product_id: item.product.id,
          name: item.product.name,
          sku: item.product.sku,
          qty: item.qty,
          price: item.product.price,
          total: itemTotal,
          tax_id: itemTaxId,
          tax_rate: itemTaxRate,
          tax_amount: itemTaxAmount
        };
      });

      // Delete the old draft before saving the updated one so we don't have duplicates
      if (activeDraftId) {
        await dbService.deleteDraftInvoice(activeDraftId);
      }

      const finalPaymentMethod = paymentCount > 1 
        ? `Multimétodo: ${splitPayments.map(p => `${p.method} (${formatCurrency(p.amount, activeCurrency, currencyRates)})`).join(' + ')}`
        : paymentMethod;

      const taxesDetail = appliedTaxes.map(t => ({
        id: t.id,
        name: t.name,
        rate: t.rate,
        amount: t.amount
      }));

      await dbService.createDraftInvoice({
        reference: calculatedDraftRef,
        customer_name: selectedClient,
        payment_method: finalPaymentMethod,
        subtotal: subtotal,
        iva: iva,
        total: total,
        items: draftItems,
        taxes_detail: taxesDetail
      });

      // Clear current sale y regresar al paso carrito
      setCart([]);
      setSelectedClient('Consumidor final');
      setPaymentMethod('Efectivo');
      setActiveDraftId(null);
      setPosStep('cart');
      
      // Reload lists
      await loadInvoiceData();
      
      showToast('success', `Venta postergada en espera con código: ${calculatedDraftRef}`);
    } catch (err: any) {
      console.error('Error postponing sale:', err);
      showToast('error', `Error al postergar venta: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 🟢 RESUME POSTPONED SALE
  const handleResumeDraft = (draft: any) => {
    setPendingDraftToResume(draft);
    if (cart.length > 0) {
      setShowMergeModal(true);
    } else {
      executeResumeDraft(draft, 'replace');
    }
  };

  const executeResumeDraft = async (draft: any, mode: 'merge' | 'replace') => {
    try {
      setIsLoading(true);
      
      // Fetch full products list to ensure up-to-date prices and stock
      const updatedCart: { product: Product; qty: number }[] = mode === 'merge' ? [...cart] : [];

      for (const draftItem of draft.items || []) {
        let prodToUse: Product;
        const foundProduct = products.find(p => p.id === draftItem.product_id || (p.sku && p.sku === draftItem.sku && p.sku !== '99999'));
        
        if (foundProduct) {
          prodToUse = foundProduct;
        } else {
          // Construct item for Venta Libre, custom items, or un-cataloged draft items
          prodToUse = {
            id: draftItem.product_id || `draft-prod-${Date.now()}-${Math.random()}`,
            name: draftItem.name || 'Producto en espera',
            sku: draftItem.sku || '99999',
            slug: `draft-item-${Date.now()}`,
            price: Number(draftItem.price) || 0,
            offer_price: null,
            stock: 999999,
            category_id: '',
            brand_id: '',
            featured: false,
            active: true,
            description: 'Ítem de factura en espera',
            technical_sheet_url: null,
            barcode_qr: null
          };
        }

        const existingIndex = updatedCart.findIndex(item => 
          item.product.id === prodToUse.id || 
          (item.product.sku === '99999' && item.product.name.toLowerCase() === prodToUse.name.toLowerCase())
        );

        const itemQty = Number(draftItem.qty) || 1;

        if (existingIndex > -1) {
          updatedCart[existingIndex].qty += itemQty;
        } else {
          updatedCart.push({
            product: prodToUse,
            qty: itemQty
          });
        }
      }

      setCart(updatedCart);
      setSelectedClient(draft.customer_name || 'Consumidor final');
      setPaymentMethod(draft.payment_method || 'Efectivo');
      
      // Keep draft in DB but mark as active draft being edited in POS
      setActiveDraftId(draft.id);
      
      // Hide dialogs and reload
      setShowMergeModal(false);
      setShowDraftsListModal(false);
      setPendingDraftToResume(null);
      await loadInvoiceData();
      
      showToast('success', `Factura pospuesta de "${draft.reference}" cargada a la tabla de ventas.`);
    } catch (err: any) {
      console.error('Error resuming draft:', err);
      showToast('error', `No se pudo retomar la factura: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDraft = (id: string, ref: string) => {
    setDraftToDelete({ id, ref });
  };

  const confirmDeleteDraft = async () => {
    if (!draftToDelete) return;
    const { id, ref } = draftToDelete;
    
    // Immediate optimistic update
    setDraftInvoices(prev => prev.filter(d => d.id !== id));
    if (activeDraftId === id) {
      setActiveDraftId(null);
    }
    setDraftToDelete(null);

    setIsLoading(true);
    try {
      await dbService.deleteDraftInvoice(id);
      await loadInvoiceData();
      showToast('success', `Factura en espera "${ref}" eliminada con éxito.`);
    } catch (err: any) {
      console.error('Error deleting draft:', err);
      showToast('error', 'Error al eliminar factura en espera.');
      await loadInvoiceData();
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrintInvoice = (invoice: any) => {
    if (!invoice) return;
    window.print();
  };

  // ⚡ Reset Venta Flash State — limpia TODOS los campos del formulario
  const resetVentaFlash = () => {
    setCart([]);
    setSelectedClient('Consumidor final');
    setPaymentMethod('Efectivo');
    setSaleConcept('');
    setSaleNote('');
    setDiscountPercent('0');
    setDiscountAmount('0');
    setDiscountCode('');
    setExtraCharges([]);
    setExtraChargeName('Delivery / Envío');
    setExtraChargeAmount('');
    // Resetear métodos de pago a un solo método vacío
    const defaultMethod = getActiveMethods()[0]?.id || 'Efectivo USD';
    setSplitPayments([{ method: defaultMethod, amount: 0 }]);
    setPaymentCount(1);
    setPosStep('cart');
    setShowSuccessModal(false);
    setShowChangeModal(false);
    setCompletedInvoice(null);
    setActiveDraftId(null);
  };

  // 💸 + REGISTRAR NUEVO GASTO EN CAJA
  const handleSaveGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(gastoAmount);
    if (!gastoConcept.trim()) {
      showToast('error', 'Ingrese el concepto del gasto.');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      showToast('error', 'Ingrese un monto válido.');
      return;
    }

    setIsSavingGasto(true);
    try {
      const session = await dbService.getActiveCashSession();
      if (!session) {
        showToast('error', 'No hay una caja abierta para registrar egresos.');
        setIsSavingGasto(false);
        return;
      }

      await dbService.addCashOp({
        type: 'egreso',
        concept: `Gasto Venta Flash: ${gastoConcept.trim()}`,
        amount: amt,
        amount_bs: amt * customBcvRate,
        payment_method: gastoPaymentMethod
      });

      showToast('success', `Gasto de $${amt.toFixed(2)} registrado en caja.`);
      setGastoConcept('');
      setGastoAmount('');
      setGastoPaymentMethod('Efectivo USD');
      setShowGastoModal(false);
      checkActiveSession();
      if (onRefreshData) {
        onRefreshData();
      }
    } catch (err: any) {
      showToast('error', `Error al guardar gasto: ${err.message || 'Error'}`);
    } finally {
      setIsSavingGasto(false);
    }
  };

  // 💰 Handle Manual Movement (Registrar Movimiento Financiero)
  const handleAddManualMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    const usdAmount = parseFloat(manualAmountUsd);
    if (!manualConcept.trim() || isNaN(usdAmount) || usdAmount <= 0) {
      showToast('error', 'Por favor, ingrese un concepto válido y un monto mayor a cero.');
      return;
    }

    setIsSavingManual(true);
    try {
      const bsAmount = usdAmount * customBcvRate;
      await dbService.addCashOp({
        type: manualType,
        concept: manualType === 'egreso' 
          ? `[Gasto] [${manualCategory}] ${manualConcept.trim()}`
          : manualConcept.trim(),
        amount: usdAmount,
        amount_bs: bsAmount,
        payment_method: manualPaymentMethod,
        category: manualType === 'egreso' ? manualCategory : null,
        observation: manualObservations.trim() || null
      });

      showToast('success', `Movimiento (${manualType.toUpperCase()}) de $${usdAmount.toFixed(2)} registrado en caja.`);
      setManualConcept('');
      setManualAmountUsd('');
      setManualObservations('');
      setShowManualModal(false);
      checkActiveSession();
      if (onRefreshData) {
        onRefreshData();
      }
    } catch (err: any) {
      console.error(err);
      showToast('error', `Error al registrar movimiento: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsSavingManual(false);
    }
  };

  // 📦 + CREAR PRODUCTO RÁPIDO
  const handleQuickCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) {
      showToast('error', 'El nombre es obligatorio.');
      return;
    }
    const price = parseFloat(newProdPrice);
    if (isNaN(price) || price < 0) {
      showToast('error', 'Ingrese un precio válido.');
      return;
    }
    const stock = parseInt(newProdStock, 10) || 0;

    setIsSavingProduct(true);
    try {
      const created = await dbService.createProduct({
        name: newProdName.trim(),
        sku: newProdSku.trim() || `PRD-${Date.now().toString().slice(-5)}`,
        slug: newProdName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        price: price,
        offer_price: null,
        stock: stock,
        category_id: newProdCategory || '',
        brand_id: '',
        featured: false,
        description: 'Creado desde Venta Flash',
        active: true,
        technical_sheet_url: null,
        barcode_qr: null,
        tax_id: newProdTaxId,
        tax_rate: newProdTaxRate
      });

      if (created) {
        showToast('success', `¡Producto "${created.name}" creado y agregado!`);
        setShowCreateProductModal(false);
        setNewProdName('');
        setNewProdSku('');
        setNewProdPrice('');
        setNewProdStock('10');
        setNewProdCategory('');
        setNewProdTaxId('exento');
        setNewProdTaxRate(0);
        if (onRefreshData) onRefreshData();
        addToCart(created);
      }
    } catch (err: any) {
      showToast('error', `Error al crear producto: ${err.message || 'Error'}`);
    } finally {
      setIsSavingProduct(false);
    }
  };

  // 📝 + EXECUTE FINALIZE INVOICE
  const executeFinalizeInvoice = async () => {
    if (cart.length === 0) {
      showToast('error', 'El carrito está vacío. Agregue productos para facturar.');
      return;
    }

    const session = await dbService.getActiveCashSession();
    if (!session) {
      showToast('error', '⚠️ CAJA CERRADA: Debe aperturar la caja en la sección "Caja y Arqueo" antes de realizar ventas.');
      return;
    }

    const stockErrors = cart.filter(item => item.product.sku !== '99999' && item.qty > item.product.stock);
    if (stockErrors.length > 0) {
      showToast('error', `No hay suficiente inventario para los siguientes productos: ${stockErrors.map(e => e.product.name).join(', ')}`);
      return;
    }

    setIsLoading(true);
    try {
      // 1. REBAJAR EL INVENTARIO / DECREASE THE INVENTORY STOCK
      for (const item of cart) {
        if (item.product.sku === '99999' || item.product.id.startsWith('vl-99999') || item.product.id === 'preset-sku-99999') {
          continue;
        }
        const currentStock = item.product.stock;
        const newStock = Math.max(0, currentStock - item.qty);
        await dbService.updateProduct(item.product.id, { stock: newStock });
      }

      // 2. Structure invoice items with tax transferred information
      const invoiceItems = cart.map(item => {
        const itemTaxRate = item.product.tax_rate !== undefined && item.product.tax_rate !== null ? item.product.tax_rate : 0;
        const itemTaxId = item.product.tax_id || (itemTaxRate > 0 ? 'default-iva' : 'exento');
        const itemTotal = item.product.price * item.qty;
        const itemTaxAmount = itemTotal * (itemTaxRate / 100);
        return {
          product_id: item.product.id,
          name: item.product.name,
          sku: item.product.sku,
          qty: item.qty,
          price: item.product.price,
          total: itemTotal,
          tax_id: itemTaxId,
          tax_rate: itemTaxRate,
          tax_amount: itemTaxAmount
        };
      });

      const rateForThisInvoice = customBcvRate > 0 ? customBcvRate : (currencyRates.VES || bcvRate || 45.5);

      const ratesSnapshot: Record<CurrencyCode, number> = {
        USD: 1.0,
        VES: rateForThisInvoice,
        EUR: currencyRates.EUR || 0.92,
        COP: currencyRates.COP || 4100
      };

      const calculatedTotalsByCurrency: Record<string, number> = {
        USD: total,
        VES: parseFloat((total * ratesSnapshot.VES).toFixed(2)),
        EUR: parseFloat((total * ratesSnapshot.EUR).toFixed(2)),
        COP: parseFloat((total * ratesSnapshot.COP).toFixed(0))
      };

      const detailedSplitPayments = splitPayments.map(sp => {
        const paymentCurr: CurrencyCode = getMethodCurrency(sp.method);
        const rateUsed = ratesSnapshot[paymentCurr] || 1;
        const normUsd = paymentCurr === 'USD' ? sp.amount : sp.amount / rateUsed;
        const normVes = paymentCurr === 'VES' ? sp.amount : normUsd * ratesSnapshot.VES;
        const normEur = paymentCurr === 'EUR' ? sp.amount : normUsd * (ratesSnapshot.EUR || 0.92);
        const normCop = paymentCurr === 'COP' ? sp.amount : normUsd * (ratesSnapshot.COP || 4100);

        return {
          method: sp.method,
          currency: paymentCurr,
          amount: sp.amount,
          amount_usd: parseFloat(normUsd.toFixed(2)),
          amount_ves: parseFloat(normVes.toFixed(2)),
          amount_eur: parseFloat(normEur.toFixed(2)),
          amount_cop: parseFloat(normCop.toFixed(0)),
          rate: rateUsed
        };
      });

      const finalPaymentMethod = paymentCount > 1 
        ? `Multimétodo: ${splitPayments.map(p => `${p.method} (${p.amount} ${getMethodCurrency(p.method)})`).join(' + ')}`
        : paymentMethod;

      const taxesDetail = appliedTaxes.map(t => ({
        id: t.id,
        name: t.name,
        rate: t.rate,
        amount: t.amount
      }));

      // 3. Create the Invoice in Supabase
      const created = await dbService.createInvoice({
        document_type: documentType,
        customer_name: selectedClient,
        payment_method: finalPaymentMethod,
        subtotal: subtotal,
        iva: iva,
        total: total,
        items: invoiceItems,
        notes: saleConcept ? `${saleConcept} | ${saleNote}` : saleNote,
        taxes_detail: taxesDetail,
        bcv_rate: rateForThisInvoice,
        currency_code: activeCurrency,
        currency_rates_snapshot: ratesSnapshot,
        totals_by_currency: calculatedTotalsByCurrency,
        split_payments: detailedSplitPayments
      });

      // 3.2 Register income in Cash register (Caja)
      try {
        const amountBs = total * rateForThisInvoice;
        const amountEur = total * (ratesSnapshot.EUR || 0.92);
        const amountCop = total * (ratesSnapshot.COP || 4100);
        const docLabel = documentType === 'nota_entrega' ? 'Nota de Entrega' : 'Factura';
        await dbService.addCashOp({
          type: 'ingreso',
          concept: `Venta Flash - ${docLabel} ${created.control_number || ''} (${selectedClient}) ${saleConcept ? `- ${saleConcept}` : ''}`,
          amount: total,
          amount_bs: amountBs,
          amount_eur: amountEur,
          amount_cop: amountCop,
          currency_code: activeCurrency,
          currency_rates_snapshot: ratesSnapshot,
          payment_method: finalPaymentMethod,
          split_payments: detailedSplitPayments
        });
      } catch (cajaErr) {
        console.error("Failed to register POS sale in cash register:", cajaErr);
      }

      // 3.5 Delete the draft from the wait list if active
      if (activeDraftId) {
        try {
          await dbService.deleteDraftInvoice(activeDraftId);
        } catch (delErr) {
          console.error("Failed to delete draft after finalizing invoice:", delErr);
        }
        setActiveDraftId(null);
      }

      if (onRefreshData) {
        onRefreshData();
      }

      // 5. Open success modal & show receipt overlay
      setCompletedInvoice(created);
      setSuccessSaleName(saleConcept || (cart.length > 0 ? cart[0].product.name : `Venta #${created.control_number || ''}`));
      setShowSuccessModal(true);
      setShowChangeModal(false);

      // Play Cash Register "Cha-Ching" sound effect
      playCashRegisterSound();

      // Check if any product in cart dropped below low stock threshold
      try {
        const sysCfg = localStorage.getItem('copias_bellavista_sys_config');
        const lowStockThresh = sysCfg ? (JSON.parse(sysCfg).inventarioLowStockThreshold ?? 5) : 5;
        const lowStockItems = cart.filter(item => item.product.sku !== '99999' && (item.product.stock - item.qty) <= lowStockThresh);
        if (lowStockItems.length > 0) {
          setTimeout(() => {
            playLowStockBeep();
          }, 400);
        }
      } catch (e) {
        console.warn("Error checking low stock sound:", e);
      }

      // 5.5 Clear sales cart and reset ALL fields for next sale
      resetVentaFlash();

      // 6. Reload history lists
      await loadInvoiceData();
      await checkActiveSession();
      showToast('success', '¡Venta registrada e inventario actualizado exitosamente!');
    } catch (err: any) {
      console.error('Error finalizing invoice:', err);
      showToast('error', `Error al procesar facturación: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalizeInvoice = () => {
    if (cart.length === 0) {
      showToast('error', 'El carrito está vacío. Agregue productos para facturar.');
      return;
    }

    // ✅ Validar que todos los métodos de pago estén conciliados
    const splitSumUsd = splitPayments.reduce(
      (acc, sp) => acc + methodAmountToUsd(sp.amount || 0, sp.method),
      0
    );
    const diffUsd = parseFloat((total - splitSumUsd).toFixed(2));
    if (diffUsd > 0.02) {
      showToast(
        'error',
        `⚠️ Quedan $${diffUsd.toFixed(2)} sin asignar a un método de pago. Complete los montos antes de facturar.`
      );
      return;
    }
    if (diffUsd < -0.02) {
      showToast(
        'error',
        `⚠️ El monto asignado excede el total en $${Math.abs(diffUsd).toFixed(2)}. Corrija los montos antes de facturar.`
      );
      return;
    }

    executeFinalizeInvoice();
  };

  const activeClientObj = clients.find(c => (c.name || '').toLowerCase() === selectedClient.toLowerCase());

  return (
    <div className="relative text-left p-4 md:p-6 bg-gray-50/50 min-h-screen">
      
      {/* Modal: Agregar Cargo Extra */}
      {showExtraChargeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-gray-100 w-full max-w-sm shadow-2xl p-5 space-y-4 text-left">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="text-sm font-black text-gray-800">Agregar Cargo Extra</h3>
              <button
                type="button"
                onClick={() => setShowExtraChargeModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Concepto del cargo</label>
                <input
                  type="text"
                  value={extraChargeName}
                  onChange={(e) => setExtraChargeName(e.target.value)}
                  placeholder="Ej: Delivery, Empaque, Servicio"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005da9]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Monto en Dólares ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={extraChargeAmount}
                  onChange={(e) => setExtraChargeAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005da9]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowExtraChargeModal(false)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const amt = parseFloat(extraChargeAmount);
                  if (!isNaN(amt) && amt > 0) {
                    setExtraCharges(prev => [...prev, { id: Date.now().toString(), name: extraChargeName.trim() || 'Cargo Extra', amount: amt }]);
                    showToast('success', `Cargo "${extraChargeName}" de ${amt.toFixed(2)} agregado.`);
                  }
                  setShowExtraChargeModal(false);
                  setExtraChargeAmount('');
                }}
                className="flex-1 py-2 bg-[#005da9] hover:bg-[#004b88] text-white font-black text-xs rounded-xl transition shadow-xs"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
  
      {/* Toast alert system */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-xs font-bold transition-all duration-300 transform translate-y-0 ${
          toast.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* TOP HEADER CARD WITH QUICK ACTION BUTTONS */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-xs p-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#005da9]/10 text-[#005da9] rounded-2xl shrink-0">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">Venta Flash</h2>
                {activeSession && (
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full border bg-emerald-50 border-emerald-200 text-emerald-700">
                    🟢 CAJA ABIERTA (#{activeSession.session_code || activeSession.id?.slice(0, 5)})
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 font-medium">Facturación rápida, punto de venta y cobranzas</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* 🔑 Botón Abrir Caja / Cerrar Caja */}
            {!activeSession ? (
              <button 
                type="button"
                onClick={() => {
                  setAperturaBsInput('10.00');
                  setAperturaObsInput('');
                  const defaultEmp = currentUser?.name || currentUser?.email || (authorizedCajaUsers.length > 0 ? (authorizedCajaUsers[0].name || authorizedCajaUsers[0].email) : 'Cajero Responsable');
                  setAperturaEmployee(defaultEmp);
                  setShowOpenCajaModal(true);
                }}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md hover:shadow-lg"
                title="Abrir Caja registradora para iniciar turno"
              >
                <Unlock className="w-4 h-4 shrink-0" />
                <span>Abrir Caja</span>
              </button>
            ) : (
              <button 
                type="button"
                onClick={prepareCloseCajaModal}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Cerrar Caja registradora y realizar arqueo"
              >
                <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Cerrar Caja</span>
              </button>
            )}

            {/* Botón Facturas en Espera (Pausadas) - Siempre visible */}
            <button 
              onClick={() => setShowDraftsListModal(true)}
              className={`px-3.5 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-2 shadow-md cursor-pointer border ${
                draftInvoices.length > 0
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white border-amber-600 animate-pulse hover:shadow-lg'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 hover:shadow-sm'
              }`}
              title="Abrir pantalla flotante con ventas en espera"
            >
              <Pause className={`w-4 h-4 shrink-0 ${draftInvoices.length > 0 ? 'fill-white' : 'fill-amber-400'}`} />
              <span>Facturas en Espera ({draftInvoices.length})</span>
            </button>

            {/* Botón Últimas Facturas Emitidas */}
            <button 
              onClick={() => {
                setShowHistoryModal(true);
                loadInvoiceData();
              }}
              className="px-3.5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 text-xs font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Buscar y revisar historial de facturas y notas de entrega emitidas"
            >
              <FileText className="w-3.5 h-3.5 text-sky-700" />
              <span>Últimas Facturas</span>
            </button>

            {/* Botón ingreso/egreso */}
            <button 
              onClick={() => {
                setManualType('egreso');
                setManualConcept('');
                setManualAmountUsd('');
                setManualObservations('');
                setShowManualModal(true);
              }}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Registrar Ingreso u Egreso Financiero"
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-700" />
              <span>ingreso/egreso</span>
            </button>

            {/* Botón Crear Producto (Vinculado a pantalla + Nuevo Producto) */}
            <button 
              onClick={() => {
                if (onOpenProductForm) {
                  onOpenProductForm();
                } else {
                  setShowCreateProductModal(true);
                }
              }}
              className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200 text-xs font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Crear un nuevo producto en el catálogo"
            >
              <PackagePlus className="w-3.5 h-3.5 text-gray-700" />
              <span>+ Crear Producto</span>
            </button>
          </div>
        </div>
      </div>

      {/* MAIN 2-COLUMN LAYOUT (LEFT 58% / RIGHT 42%) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* COLUMNA IZQUIERDA (CATÁLOGO & HISTORIAL) */}
        <div className="xl:col-span-7 space-y-6">
          
          {/* BARRA DE BÚSQUEDA Y CHIPS DE CATEGORÍAS */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-xs p-5">
            {/* Buscador Global con lector de código de barras */}
            <div className="relative mb-4 flex items-center gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Search className="w-4 h-4 text-[#005da9]" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar producto por SKU (ej: 99999), Nombre, Marca o escanea Código de Barras..."
                  className="w-full pl-10 pr-12 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:bg-white transition font-bold"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  autoFocus
                />
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center gap-1.5">
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')} 
                      className="text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {/* Camera Barcode Trigger for Venta Flash */}
                  <button
                    type="button"
                    onClick={() => setShowPosScanner(true)}
                    className="p-1 text-[#005da9] hover:text-white hover:bg-[#005da9] rounded-md transition-all cursor-pointer flex items-center justify-center border border-[#005da9]/10 bg-[#005da9]/5"
                    title="Escanear con cámara"
                  >
                    <Scan className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {showPosScanner && (
              <BarcodeScannerModal
                onClose={() => setShowPosScanner(false)}
                products={products}
                onProductFound={(product) => {
                  addToCart(product);
                  setShowPosScanner(false);
                }}
              />
            )}

            {/* Chips de Categorías */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedCategoryId('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition shrink-0 border cursor-pointer ${
                  selectedCategoryId === 'all'
                    ? 'bg-[#005da9] text-white border-[#004b87] shadow-xs'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                Todos ({displayProductsList.length})
              </button>
              {popularCategories.map((cat) => {
                const count = activeProducts.filter(p => String(p.category_id) === String(cat.id)).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition shrink-0 border cursor-pointer ${
                      selectedCategoryId === cat.id
                        ? 'bg-[#005da9] text-white border-[#004b87] shadow-xs'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {cat.name} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* GRILLA DE PRODUCTOS Y SELECCIÓN RÁPIDA */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-xs p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-200/80 shadow-3xs">
                  <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-gray-800 uppercase tracking-tight">Catálogo de Productos</span>
                    <span className="bg-amber-100 text-amber-900 text-[9px] px-2 py-0.5 rounded-full font-black border border-amber-300/70 flex items-center gap-1 shadow-3xs">
                      <Flame className="w-2.5 h-2.5 text-amber-600 fill-amber-600" />
                      Top 10 Más Vendidos
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                    {catalogShowLimit === 'top10'
                      ? 'Mostrando únicamente los 10 productos más vendidos'
                      : 'Mostrando catálogo completo de productos'
                    }
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex bg-gray-100/80 p-1 rounded-xl border border-gray-200/80">
                  <button
                    type="button"
                    onClick={() => setCatalogShowLimit('top10')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition flex items-center gap-1 cursor-pointer ${
                      catalogShowLimit === 'top10'
                        ? 'bg-amber-500 text-white shadow-xs font-black'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <Flame className="w-3 h-3 text-white fill-white" />
                    <span>Top 10</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogShowLimit('all')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition flex items-center gap-1 cursor-pointer ${
                      catalogShowLimit === 'all'
                        ? 'bg-[#005da9] text-white shadow-xs font-black'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <Grid className="w-3 h-3 text-white" />
                    <span>Todos ({cleanActiveProducts.length})</span>
                  </button>
                </div>

                <span className="text-[10px] font-extrabold text-gray-500 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-xl shrink-0">
                  {filteredProducts.length} ítems
                </span>
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="py-12 text-center text-gray-400 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                <Package className="w-9 h-9 mx-auto mb-2 text-gray-300" />
                <p className="text-xs font-bold text-gray-500">No se encontraron productos en esta categoría o búsqueda.</p>
                <button
                  type="button"
                  onClick={() => { setSelectedCategoryId('all'); setSearchTerm(''); setCatalogShowLimit('all'); }}
                  className="mt-3 text-[11px] font-extrabold text-[#005da9] hover:underline cursor-pointer"
                >
                  Ver todos los productos
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {/* Tarjetas de Productos */}
              {filteredProducts.map((p) => {
                const isVentaLibre = p.sku === '99999';
                const isOutOfStock = !isVentaLibre && p.stock <= 0;
                const qtyInCart = getCartQtyForProduct(p.id);
                const imgUrl = getProductImageUrl(p.id);

                const salesCount = (productSalesMap[String(p.id)] || 0) + (productSalesMap[String(p.sku)] || 0);
                const rankIndex = productsSortedBySales.findIndex(sp => sp.id === p.id);
                const isTop10 = rankIndex >= 0 && rankIndex < 10;

                return (
                  <div 
                    key={p.id}
                    onClick={() => !isOutOfStock && addToCart(p)}
                    className={`p-2.5 border rounded-2xl flex flex-col justify-between transition text-left relative overflow-hidden group ${
                      isVentaLibre
                        ? 'bg-amber-50/50 border-amber-300 hover:border-[#005da9] hover:shadow-xs cursor-pointer'
                        : isOutOfStock 
                          ? 'bg-gray-50/80 border-gray-100 opacity-50 cursor-not-allowed' 
                          : 'bg-white border-gray-200 hover:border-[#005da9] hover:shadow-md cursor-pointer'
                    }`}
                  >
                    {/* Thumbnail Image Container */}
                    <div className="relative w-full h-24 sm:h-28 mb-2 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                      {imgUrl ? (
                        <img 
                          src={imgUrl} 
                          alt={p.name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className={`flex flex-col items-center justify-center p-2 text-center ${isVentaLibre ? 'text-amber-500' : 'text-gray-300'}`}>
                          {isVentaLibre ? (
                            <>
                              <Tag className="w-7 h-7 text-amber-500" />
                              <span className="text-[9px] font-black text-amber-600 mt-1 uppercase tracking-tight">Venta Libre</span>
                            </>
                          ) : (
                            <>
                              <Package className="w-7 h-7 text-gray-300 stroke-[1.5]" />
                              <span className="text-[8px] font-bold text-gray-400 mt-0.5">Sin foto</span>
                            </>
                          )}
                        </div>
                      )}

                      {!isVentaLibre && isTop10 && (
                        <span className="absolute top-1.5 left-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-[8px] px-1.5 py-0.5 rounded-md shadow-xs flex items-center gap-0.5 z-10">
                          <Flame className="w-2.5 h-2.5 fill-white text-white" />
                          #{rankIndex + 1}
                        </span>
                      )}

                      {qtyInCart > 0 && (
                        <span className="absolute top-1.5 right-1.5 bg-[#005da9] text-white font-extrabold text-[10px] rounded-full w-5 h-5 flex items-center justify-center shadow-md border border-white z-10 animate-bounce-short">
                          {qtyInCart}
                        </span>
                      )}

                      {isVentaLibre && (
                        <span className="absolute top-1.5 left-1.5 bg-amber-500 text-white font-extrabold text-[8px] px-1.5 py-0.5 rounded-md uppercase tracking-wider shadow-xs">
                          Libre
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="flex justify-between items-start gap-1">
                        <span className="text-[11px] font-black text-gray-800 line-clamp-2 leading-snug group-hover:text-[#005da9] transition">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-[9px] text-gray-400 font-mono font-bold">{p.sku}</span>
                        {p.barcode_qr && (
                          <span className="text-[8px] text-[#005da9] bg-blue-50 px-1 py-0.2 rounded font-mono font-bold">
                            📟 {p.barcode_qr}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-100">
                      {isVentaLibre ? (
                        <span className="text-xs font-black text-[#005da9]">Precio abierto</span>
                      ) : (
                        (() => {
                          const activeRate = customBcvRate > 0 ? customBcvRate : (bcvRate > 0 ? bcvRate : (currencyRates?.VES || 36.5));
                          const priceBs = (p.price || 0) * activeRate;
                          const formattedNumStr = priceBs.toFixed(2);
                          const standardParts = formattedNumStr.split('.');
                          const integerPart = standardParts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                          const decimalPart = standardParts[1] || '00';

                          return (
                            <div className="flex items-start text-[#0F1111] select-none font-sans">
                              <span className="text-[10px] font-black mr-0.5 mt-[1px] text-gray-900">Bs.</span>
                              <span className="text-sm sm:text-base font-black leading-none tracking-tight text-gray-900">{integerPart}</span>
                              <span className="text-[10px] font-bold ml-[0.5px] leading-none mt-[1px] text-gray-900">,{decimalPart}</span>
                            </div>
                          );
                        })()
                      )}
                      
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                        isVentaLibre
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : p.stock > 10 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : p.stock > 0 
                              ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {isVentaLibre ? '✨ Venta Libre' : p.stock > 0 ? `${p.stock} disp.` : 'Agotado'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>

        {/* COLUMNA DERECHA: PRODUCTOS EN LA VENTA & DATOS DE FACTURA */}
        <div className="xl:col-span-5 space-y-6">

          {/* TABLA / LISTA DE ÍTEMS AGREGADOS (PRODUCTOS EN LA VENTA) */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-xs p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-[#005da9]" />
                <span className="text-xs font-black text-gray-800 uppercase tracking-tight">
                  Productos en la Venta ({cart.reduce((sum, item) => sum + item.qty, 0)} ítems)
                </span>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-[10px] text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Limpiar Tabla</span>
                </button>
              )}
            </div>

            {activeDraftId && (
              <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200/80 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-900">
                <div className="flex items-center gap-2">
                  <Pause className="w-3.5 h-3.5 text-amber-700 fill-amber-700 animate-pulse shrink-0" />
                  <div>
                    <span className="font-extrabold text-amber-900">Retomando Factura en Espera</span>
                    <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100/80 border border-amber-300 text-amber-900 font-mono font-bold rounded text-[10px]">
                      {draftInvoices.find(d => d.id === activeDraftId)?.reference || 'ESP-XXXX'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCart([]);
                    setSelectedClient('Consumidor final');
                    setPaymentMethod('Efectivo');
                    setActiveDraftId(null);
                    showToast('success', 'Edición de factura cancelada.');
                  }}
                  className="shrink-0 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded-lg text-[10px] uppercase transition cursor-pointer"
                >
                  Descartar Edición
                </button>
              </div>
            )}

            {cart.length === 0 ? (
              <div className="py-10 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
                <ShoppingCart className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-xs font-bold text-gray-500">La tabla está vacía</p>
                <p className="text-[10px] text-gray-400 mt-1 max-w-[280px]">Haz clic en los productos del catálogo para agregarlos a la venta.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-0.5">
                {cart.map((item) => {
                  const itemImg = getProductImageUrl(item.product.id);
                  const effectiveRate = customBcvRate > 0 ? customBcvRate : (bcvRate > 0 ? bcvRate : (currencyRates?.VES || 36.5));
                  const itemTotalBs = (item.product.price || 0) * item.qty * effectiveRate;
                  const formattedTotalBs = itemTotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                  return (
                    <div 
                      key={item.product.id} 
                      className="p-3 bg-white border border-gray-200/90 rounded-2xl shadow-2xs hover:shadow-xs transition flex items-center justify-between gap-3 text-left relative"
                    >
                      {/* Left: Thumbnail + Name + SKU + Quantity Selector */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Thumbnail */}
                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-50 border border-gray-100 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                          {itemImg ? (
                            <img 
                              src={itemImg} 
                              alt={item.product.name} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-gray-300">
                              {item.product.sku === '99999' ? (
                                <Tag className="w-5 h-5 text-amber-500" />
                              ) : (
                                <Package className="w-5 h-5 text-gray-300 stroke-[1.5]" />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Text details & Qty */}
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs sm:text-[13px] font-extrabold text-gray-900 line-clamp-1 leading-snug" title={item.product.name}>
                            {item.product.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-gray-400 font-mono font-bold">
                              SKU: {item.product.sku}
                            </span>
                            {item.product.sku === '99999' && (
                              <button
                                type="button"
                                onClick={() => openVentaLibreModal(item.product)}
                                className="text-[10px] text-[#005da9] hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" />
                                Editar
                              </button>
                            )}
                          </div>

                          {/* Quantity Selector: [ - ] [ 1 ] [ + ] */}
                          <div className="inline-flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white mt-1.5 shadow-3xs">
                            <button 
                              type="button"
                              onClick={() => updateQty(item.product.id, item.qty - 1)}
                              className="px-2.5 py-0.5 hover:bg-gray-100 text-gray-700 font-bold transition text-xs cursor-pointer active:bg-gray-200 border-r border-gray-100"
                            >
                              -
                            </button>
                            <CartQtyInput 
                              initialQty={item.qty}
                              stock={item.product.stock || 99999}
                              onQtyChange={(newQty) => updateQty(item.product.id, newQty)}
                            />
                            <button 
                              type="button"
                              onClick={() => updateQty(item.product.id, item.qty + 1)}
                              className="px-2.5 py-0.5 hover:bg-gray-100 text-gray-700 font-bold transition text-xs cursor-pointer active:bg-gray-200 border-l border-gray-100"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Right: Trash icon (top-right), Total in Bs (bottom-right) */}
                      <div className="flex flex-col items-end justify-between self-stretch shrink-0 pl-2">
                        <button 
                          type="button"
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-gray-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded-lg transition cursor-pointer"
                          title="Remover de la Venta"
                        >
                          <Trash2 className="w-4 h-4 stroke-[1.75]" />
                        </button>

                        <div className="text-right">
                          <span className="text-sm sm:text-base font-black text-gray-900 tracking-tight">
                            Bs. {formattedTotalBs}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* DATOS DE FACTURA O NOTA DE ENTREGA: 2-COLUMN MODERN CHECKOUT */}
          <div className="bg-white border border-gray-100 rounded-3xl shadow-sm p-5 md:p-6 space-y-6">
            
            {/* Header / Tipo de Documento & Cliente */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="flex bg-gray-100/90 p-1 rounded-2xl border border-gray-200/80">
                  <button
                    type="button"
                    onClick={() => setDocumentType('factura')}
                    className={`px-4 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                      documentType === 'factura'
                        ? 'bg-[#005da9] text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Factura</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocumentType('nota_entrega')}
                    className={`px-4 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                      documentType === 'nota_entrega'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <FileCheck className="w-4 h-4" />
                    <span>Nota de Entrega</span>
                  </button>
                </div>
              </div>

              {/* Selector de Cliente */}
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={selectedClient}
                    onChange={(e) => handleClientChange(e.target.value)}
                    onFocus={() => { if (selectedClient && selectedClient !== 'Consumidor final') setShowClientSuggestions(filteredClients.length > 0); }}
                    onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:bg-white transition"
                    placeholder="Consumidor final o nombre cliente"
                  />
                  {showClientSuggestions && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-gray-100 text-xs text-left">
                      {filteredClients.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={() => {
                            setSelectedClient(c.name);
                            setShowClientSuggestions(false);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-blue-50 text-gray-800 font-bold transition flex justify-between"
                        >
                          <span>{c.name}</span>
                          <span className="font-mono text-gray-400">{c.document}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowClientSearchModal(true)}
                  className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition cursor-pointer"
                  title="Buscar cliente registrado"
                >
                  <Search className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewClientName(selectedClient !== 'Consumidor final' ? selectedClient : '');
                    setNewClientDocument('');
                    setNewClientPhone('');
                    setNewClientEmail('');
                    setNewClientType('Natural');
                    setNewClientCredit('0');
                    setShowQuickClientModal(true);
                  }}
                  className="p-2 bg-blue-50 hover:bg-blue-100 text-[#005da9] rounded-xl transition cursor-pointer"
                  title="Crear nuevo cliente"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 2 COLUMNS: RESUMEN (LEFT) + MÉTODOS DE PAGO & TASA (RIGHT) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* LEFT COLUMN: RESUMEN (lg:col-span-5) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="border border-gray-150 rounded-3xl p-5 bg-white shadow-2xs space-y-4">
                  <div className="text-center pb-2 border-b border-gray-100">
                    <span className="text-sm font-black text-gray-900 tracking-tight">Resumen:</span>
                  </div>

                  {/* Subtotal con Acordeón desplegable (Image 4) */}
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => setIsResumenOpen(!isResumenOpen)}
                      className="w-full flex items-center justify-between text-xs font-bold text-gray-700 hover:text-[#005da9] transition cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Subtotal:</span>
                        <ChevronRight className={`w-3.5 h-3.5 text-[#005da9] transition-transform duration-200 ${isResumenOpen ? 'rotate-90' : ''}`} />
                      </div>
                      <span className="font-mono font-black text-gray-900">${subtotal.toFixed(2)}</span>
                    </button>

                    {isResumenOpen && (
                      <div className="pl-3 pr-2 py-2 bg-gray-50/80 rounded-2xl border border-gray-150 space-y-1.5 text-[11px] max-h-44 overflow-y-auto">
                        {cart.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-gray-600">
                            <span className="truncate pr-2">{item.product.name} <span className="text-gray-400 font-bold">x{item.qty}</span></span>
                            <span className="font-mono font-bold text-gray-800 shrink-0">${(item.product.price * item.qty).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Descuento */}
                  <div className="flex justify-between text-xs text-gray-600 font-medium">
                    <span>Descuento:</span>
                    <span className={`font-mono font-bold ${calculatedDiscountUsd > 0 ? 'text-emerald-600' : 'text-gray-700'}`}>
                      -${calculatedDiscountUsd.toFixed(2)}
                    </span>
                  </div>

                  {/* Cargos extras */}
                  <div className="flex justify-between text-xs text-gray-600 font-medium">
                    <span>Cargos extras:</span>
                    <span className="font-mono font-bold text-gray-800">${extraChargesTotal.toFixed(2)}</span>
                  </div>

                  {/* IVA 16% */}
                  <div className="flex justify-between text-xs text-gray-600 font-medium">
                    <span>IVA 16%:</span>
                    <span className="font-mono font-bold text-gray-800">${applyIva ? calculatedIvaUsd.toFixed(2) : '0.00'}</span>
                  </div>

                  {/* IGTF 3% */}
                  <div className="flex justify-between text-xs text-gray-600 font-medium">
                    <span>IGTF 3%:</span>
                    <span className="font-mono font-bold text-gray-800">${applyIgtf ? calculatedIgtfUsd.toFixed(2) : '0.00'}</span>
                  </div>

                  {/* Divider y Total a pagar */}
                  <div className="border-t border-gray-200/80 pt-3 flex justify-between items-baseline">
                    <span className="text-sm font-black text-gray-900">Total a pagar:</span>
                    <div className="text-right">
                      <div className="text-xl font-black text-gray-950 font-mono tracking-tight">
                        ${total.toFixed(2)}
                      </div>
                      <div className="text-xs font-bold text-[#005da9] font-mono">
                        Bs. {(total * (customBcvRate > 0 ? customBcvRate : (currencyRates.VES || bcvRate || 45.5))).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Código de descuento */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700">Código de descuento</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={discountCode}
                      onChange={(e) => setDiscountCode(e.target.value)}
                      placeholder="XXXXXXXX"
                      className="flex-1 px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-mono font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005da9] uppercase placeholder:text-gray-300 shadow-2xs"
                    />
                    {discountCode && (
                      <button
                        type="button"
                        onClick={() => handleApplyDiscountCode(discountCode)}
                        className="px-3.5 py-2 bg-[#005da9] hover:bg-[#004b88] text-white font-black text-xs rounded-xl transition cursor-pointer shadow-xs"
                      >
                        Aplicar
                      </button>
                    )}
                  </div>
                </div>

                {/* Toggles (Switches estilo iOS/Tailwind) */}
                <div className="space-y-3 pt-1">
                  <label className="flex items-center justify-between cursor-pointer select-none group">
                    <span className="text-xs font-bold text-gray-700 group-hover:text-gray-900">Aplicar IVA (16%)</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={applyIva}
                      onClick={() => setApplyIva(!applyIva)}
                      className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        applyIva ? 'bg-[#005da9]' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        applyIva ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer select-none group">
                    <span className="text-xs font-bold text-gray-700 group-hover:text-gray-900">Aplicar IGTF (3%)</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={applyIgtf}
                      onClick={() => setApplyIgtf(!applyIgtf)}
                      className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        applyIgtf ? 'bg-[#005da9]' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        applyIgtf ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </label>
                </div>
              </div>

              {/* RIGHT COLUMN: MÉTODOS DE PAGO Y TASA (lg:col-span-7) */}
              <div className="lg:col-span-7 space-y-4">
                
                {/* Barra superior: + Agregar cargo extra y Tasa de cambio */}
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowExtraChargeModal(true)}
                    className="text-xs font-black text-[#005da9] hover:text-[#004b88] flex items-center gap-1 cursor-pointer hover:underline"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar cargo extra</span>
                  </button>

                  {/* Badge Tasa de cambio */}
                  <div className="flex items-center gap-2 bg-amber-50/90 border border-amber-200/80 px-3 py-1 rounded-full text-xs">
                    <span className="font-bold text-gray-700">Tasa de cambio (Bs/$):</span>
                    <input
                      type="number"
                      step="0.01"
                      value={customBcvRate > 0 ? customBcvRate : (currencyRates.VES || bcvRate || 45.5)}
                      onChange={(e) => setCustomBcvRate(parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-0.5 bg-white border border-amber-300 rounded-lg text-xs font-mono font-black text-[#004b88] text-center focus:outline-none focus:ring-2 focus:ring-[#005da9]"
                    />
                  </div>
                </div>

                {/* Lista de Métodos de Pago Dinámicos */}
                <div className="space-y-3.5">
                  {splitPayments.map((p, idx) => {
                    const methodCurr = getMethodCurrency(p.method);
                    const currSymbol = methodCurr === 'VES' ? 'BS' : methodCurr === 'USD' ? '$' : methodCurr === 'EUR' ? '€' : 'COP';
                    
                    return (
                      <div key={idx} className="relative p-4 bg-gray-50/60 border border-gray-200/70 rounded-2xl space-y-2.5">
                        {splitPayments.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSplitMethod(idx)}
                            className="absolute top-2.5 right-2.5 p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Eliminar método"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-end pr-5">
                          {/* Selector Método de pago */}
                          <div className="space-y-1">
                            <label className="block text-[11px] font-bold text-gray-600">Método de pago</label>
                            <select
                              value={p.method}
                              onChange={(e) => handleUpdateSplitMethod(idx, e.target.value)}
                              className="w-full bg-white border border-gray-200 text-gray-800 font-bold text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#005da9] cursor-pointer shadow-2xs"
                            >
                              {getActiveMethods().map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.label || m.id}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Input Monto a pagar */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <label className="block text-[11px] font-bold text-gray-600">Monto a pagar</label>
                              <button
                                type="button"
                                onClick={() => handleFillRemaining(idx)}
                                className="text-[10px] text-[#005da9] font-black hover:underline cursor-pointer"
                              >
                                Restante
                              </button>
                            </div>
                            <div className="relative">
                              <input
                                type="number"
                                step="0.01"
                                value={p.amount || ''}
                                onChange={(e) => handleUpdateSplitAmount(idx, parseFloat(e.target.value) || 0)}
                                placeholder="0.00"
                                className="w-full pl-3 pr-12 py-2 bg-white border border-gray-200 rounded-xl text-xs font-mono font-black text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005da9] shadow-2xs"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black font-mono text-gray-500">
                                {currSymbol}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Botón + Agregar método de pago */}
                <div>
                  <button
                    type="button"
                    onClick={handleAddSplitMethod}
                    className="text-xs font-black text-[#005da9] hover:text-[#004b88] flex items-center gap-1.5 cursor-pointer hover:underline py-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar método de pago</span>
                  </button>
                </div>

                {/* Validador de Pago en Vivo */}
                {(() => {
                  const splitSumUsd = splitPayments.reduce((acc, sp) => acc + methodAmountToUsd(sp.amount || 0, sp.method), 0);
                  const diffUsd = parseFloat((total - splitSumUsd).toFixed(2));
                  if (Math.abs(diffUsd) < 0.02) {
                    return (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200/80 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>¡Monto total distribuido perfectamente!</span>
                      </div>
                    );
                  } else if (diffUsd > 0) {
                    return (
                      <div className="p-2.5 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-800 text-xs font-bold flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Pendiente por asignar:</span>
                        </div>
                        <span className="font-mono text-amber-950 font-black">
                          ${diffUsd.toFixed(2)} (Bs. {(diffUsd * (customBcvRate > 0 ? customBcvRate : (currencyRates.VES || bcvRate || 45.5))).toFixed(2)})
                        </span>
                      </div>
                    );
                  } else {
                    return (
                      <div className="p-2.5 bg-rose-50 border border-rose-200/80 rounded-xl text-rose-800 text-xs font-bold flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>Excedente por asignar:</span>
                        </div>
                        <span className="font-mono text-rose-950 font-black">
                          ${Math.abs(diffUsd).toFixed(2)} (Bs. {(Math.abs(diffUsd) * (customBcvRate > 0 ? customBcvRate : (currencyRates.VES || bcvRate || 45.5))).toFixed(2)})
                        </span>
                      </div>
                    );
                  }
                })()}

                {/* Botones de Navegación: Anterior | Poner en Espera | Facturar */}
                <div className="flex items-center justify-between gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setPosStep('cart')}
                    className="px-6 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-[#005da9]/30 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Anterior
                  </button>

                  <div className="flex items-center gap-2">
                    {/* ⏸ Botón Poner en Espera */}
                    <button
                      type="button"
                      onClick={handlePostponeSale}
                      disabled={isLoading || cart.length === 0}
                      className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-amber-800 border border-amber-300 font-black text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="Guardar esta venta en espera para retomar después"
                    >
                      <Pause className="w-3.5 h-3.5 fill-amber-600 shrink-0" />
                      <span>Poner en Espera</span>
                    </button>

                    {/* ✅ Botón Facturar */}
                    <button
                      type="button"
                      onClick={handleFinalizeInvoice}
                      disabled={isLoading || cart.length === 0}
                      className="px-8 py-2.5 bg-[#005da9] hover:bg-[#004b88] disabled:bg-gray-300 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      <span>Facturar</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* -------------------- MODAL: CONFIRMACIÓN FUSIONAR / REEMPLAZAR DRAFT -------------------- */}
      {showMergeModal && pendingDraftToResume && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-gray-100 w-full max-w-sm shadow-2xl p-5 relative text-left">
            <div className="flex items-center gap-2 text-amber-600 mb-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-black uppercase tracking-tight">Caja Ocupada</h3>
            </div>
            <p className="text-[11px] text-gray-500 font-medium mb-5 leading-normal">
              El carrito actual de la caja no está vacío. ¿Cómo desea cargar la factura postergada de <span className="font-bold text-gray-800">"{pendingDraftToResume.reference}"</span>?
            </p>

            <div className="space-y-2">
              <button
                onClick={() => executeResumeDraft(pendingDraftToResume, 'merge')}
                className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Fusionar con Carrito Actual</span>
              </button>
              
              <button
                onClick={() => executeResumeDraft(pendingDraftToResume, 'replace')}
                className="w-full py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reemplazar Carrito Actual</span>
              </button>

              <button
                onClick={() => {
                  setShowMergeModal(false);
                  setPendingDraftToResume(null);
                }}
                className="w-full py-2 text-gray-400 hover:text-gray-600 font-bold text-xs rounded-xl text-center"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- MODAL: VISTA DE RECIBO / FACTURA / NOTA COMPLETADA -------------------- */}
      {completedInvoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-gray-100 w-full max-w-2xl shadow-2xl overflow-hidden text-left flex flex-col max-h-[90vh]">
            
            {/* Header del modal */}
            <div className="p-4 text-center border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-sm font-bold text-gray-600">Compra completada exitosamente</h3>
            </div>

            {/* Cuerpo del Documento / Factura Preview (Image 5) */}
            <div className="p-6 overflow-y-auto space-y-5">
              
              {/* Encabezado de la Empresa */}
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xl font-black text-[#003764] tracking-tight flex items-center gap-1.5">
                    <span className="text-[#005da9]">⚡</span>
                    <span>{businessInfo.storeName || 'COPIAS BELLA VISTA, C.A.'}</span>
                  </div>
                  <span className="text-[11px] font-bold text-[#005da9]">
                    {completedInvoice.document_type === 'nota_entrega' ? 'Nota de Entrega' : 'Factura de Venta'}
                  </span>
                </div>
                <div className="text-right text-[10px] text-gray-500 space-y-0.5">
                  <p className="font-bold text-gray-700">RIF: {businessInfo.rif}</p>
                  <p>{businessInfo.address}</p>
                  <p>Telf: {businessInfo.phone}</p>
                </div>
              </div>

              {/* Ficha de Metadatos del Cliente y Documento */}
              <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50/40 text-xs text-gray-700 space-y-2">
                <div className="grid grid-cols-3 gap-2 pb-2 border-b border-gray-200/60">
                  <div>
                    <span className="font-bold text-gray-900 uppercase text-[10px] block text-gray-400">CLIENTE</span>
                    <span className="font-bold text-gray-800">{completedInvoice.customer_name}</span>
                  </div>
                  <div className="text-center">
                    <span className="font-bold text-gray-900 uppercase text-[10px] block text-gray-400">
                      {completedInvoice.document_type === 'nota_entrega' ? 'Nota de entrega :' : 'Factura :'}
                    </span>
                    <span className="font-mono font-bold text-[#004b88]">#{completedInvoice.control_number}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-gray-900 uppercase text-[10px] block text-gray-400">FECHA</span>
                    <span className="font-mono">{new Date(completedInvoice.created_at || Date.now()).toLocaleDateString('es-VE')}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="font-bold text-gray-400 uppercase text-[9px] block">C.I/RIF</span>
                    <span className="font-mono font-bold text-gray-700">{completedInvoice.customer_document || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="font-bold text-gray-400 uppercase text-[9px] block">DIRECCIÓN</span>
                    <span className="text-gray-700">{completedInvoice.customer_address || 'Ciudad'}</span>
                  </div>
                </div>
              </div>

              {/* Tabla de Productos */}
              <div className="border border-gray-200 rounded-2xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-100/80 text-gray-600 font-bold uppercase text-[10px] border-b border-gray-200">
                    <tr>
                      <th className="py-2.5 px-3 text-center">CANTIDAD</th>
                      <th className="py-2.5 px-3">DESCRIPCIÓN</th>
                      <th className="py-2.5 px-3 text-right">PRECIO USD</th>
                      <th className="py-2.5 px-3 text-right">TOTAL USD</th>
                      <th className="py-2.5 px-3 text-right">PRECIO BS</th>
                      <th className="py-2.5 px-3 text-right">TOTAL BS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {completedInvoice.items?.map((item: any, i: number) => {
                      const itemPrice = Number(item.price || 0);
                      const itemTotal = Number(item.total || itemPrice * (item.qty || 1));
                      const rate = completedInvoice.bcv_rate || customBcvRate || bcvRate || 45.5;
                      const itemPriceBs = itemPrice * rate;
                      const itemTotalBs = itemTotal * rate;

                      return (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className="py-2 px-3 text-center font-bold text-gray-900">{item.qty}</td>
                          <td className="py-2 px-3 font-bold text-gray-800">{item.name}</td>
                          <td className="py-2 px-3 text-right font-mono text-gray-600">${itemPrice.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">${itemTotal.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-mono text-gray-600">Bs. {itemPriceBs.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">Bs. {itemTotalBs.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totales y Desglose */}
              <div className="flex justify-end">
                <div className="w-72 space-y-1 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-mono font-bold text-gray-800">${Number(completedInvoice.subtotal || 0).toFixed(2)}</span>
                  </div>
                  {Number(completedInvoice.discount || 0) > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Descuento:</span>
                      <span className="font-mono">-${Number(completedInvoice.discount || 0).toFixed(2)}</span>
                    </div>
                  )}
                  {Number(completedInvoice.iva || 0) > 0 && (
                    <div className="flex justify-between">
                      <span>IVA (16%):</span>
                      <span className="font-mono font-bold text-gray-800">${Number(completedInvoice.iva || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 pt-1.5 flex justify-between font-black text-sm text-gray-900">
                    <span>Total a pagar:</span>
                    <div className="text-right">
                      <span className="font-mono block">${Number(completedInvoice.total || 0).toFixed(2)}</span>
                      <span className="text-xs font-bold text-[#005da9] font-mono">
                        Bs. {(Number(completedInvoice.total || 0) * (completedInvoice.bcv_rate || customBcvRate || bcvRate || 45.5)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer con controles de Impresión: Carta, 58mm, 80mm, Aceptar (Image 5) */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-2 justify-center items-center shrink-0">
              <button
                type="button"
                onClick={() => printInvoiceDocument(completedInvoice, businessInfo, 'carta', customBcvRate || bcvRate)}
                className="px-4 py-2.5 bg-white hover:bg-blue-50 text-[#005da9] border border-[#005da9]/30 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir (carta)</span>
              </button>

              <button
                type="button"
                onClick={() => printInvoiceDocument(completedInvoice, businessInfo, '58mm', customBcvRate || bcvRate)}
                className="px-4 py-2.5 bg-white hover:bg-blue-50 text-[#005da9] border border-[#005da9]/30 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir (58mm)</span>
              </button>

              <button
                type="button"
                onClick={() => printInvoiceDocument(completedInvoice, businessInfo, '80mm', customBcvRate || bcvRate)}
                className="px-4 py-2.5 bg-white hover:bg-blue-50 text-[#005da9] border border-[#005da9]/30 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir (80mm)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCompletedInvoice(null);
                  resetVentaFlash();
                }}
                className="px-8 py-2.5 bg-[#005da9] hover:bg-[#004b88] text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md cursor-pointer"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- MODAL: BUSCAR Y SELECCIONAR CLIENTE -------------------- */}
      {showClientSearchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-gray-100 w-full max-w-lg shadow-2xl overflow-hidden text-left flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-5 bg-gray-50 border-b border-gray-100 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#005da9]" />
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight">Buscar Cliente Registrado</h3>
              </div>
              <button 
                onClick={() => setShowClientSearchModal(false)}
                className="p-1.5 hover:bg-gray-200 text-gray-400 hover:text-gray-600 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 bg-white border-b border-gray-50 shrink-0">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={clientSearchQuery}
                  onChange={(e) => setClientSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre, cédula/RIF, teléfono o correo..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:bg-white transition"
                  autoFocus
                />
              </div>
            </div>

            {/* Clients List */}
            <div className="p-4 overflow-y-auto flex-1 bg-gray-50/50 space-y-2 max-h-[45vh]">
              {clients.filter(c => {
                const q = clientSearchQuery.toLowerCase();
                return (
                  (c.name || '').toLowerCase().includes(q) ||
                  (c.document || '').toLowerCase().includes(q) ||
                  (c.phone || '').toLowerCase().includes(q) ||
                  (c.email || '').toLowerCase().includes(q)
                );
              }).length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <p className="text-xs text-gray-400 font-bold">No se encontraron clientes que coincidan con la búsqueda.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowClientSearchModal(false);
                      setNewClientName(clientSearchQuery);
                      setNewClientDocument('');
                      setNewClientPhone('');
                      setNewClientEmail('');
                      setNewClientType('Natural');
                      setNewClientCredit('0');
                      setShowQuickClientModal(true);
                    }}
                    className="mx-auto px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold text-xs rounded-xl border border-emerald-200 transition-colors flex items-center gap-1.5"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Registrar "{clientSearchQuery || 'Nuevo Cliente'}"</span>
                  </button>
                </div>
              ) : (
                clients.filter(c => {
                  const q = clientSearchQuery.toLowerCase();
                  return (
                    (c.name || '').toLowerCase().includes(q) ||
                    (c.document || '').toLowerCase().includes(q) ||
                    (c.phone || '').toLowerCase().includes(q) ||
                    (c.email || '').toLowerCase().includes(q)
                  );
                }).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedClient(c.name);
                      setShowClientSearchModal(false);
                    }}
                    className="w-full text-left p-3.5 bg-white border border-gray-100 hover:border-[#005da9] hover:bg-blue-50/30 rounded-2xl transition flex items-center justify-between gap-4 group"
                  >
                    <div className="min-w-0">
                      <div className="font-extrabold text-gray-900 text-xs truncate group-hover:text-[#005da9] transition-colors">{c.name}</div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] text-gray-400 font-bold">
                        <span className="font-mono text-gray-500">Doc: {c.document}</span>
                        {c.phone && <span>Tel: {c.phone}</span>}
                        {c.email && <span className="truncate max-w-[150px]">Email: {c.email}</span>}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {c.credit_usd > 0 && (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[9px] font-black border border-emerald-100">
                          Crédito: ${Number(c.credit_usd).toFixed(2)}
                        </span>
                      )}
                      <span className="text-[10px] text-[#005da9] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                        Seleccionar
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSelectedClient('Consumidor final');
                  setShowClientSearchModal(false);
                }}
                className="py-2 px-3 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold text-xs rounded-xl transition"
              >
                Limpiar / Consumidor Final
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowClientSearchModal(false)}
                  className="py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-xs rounded-xl transition"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowClientSearchModal(false);
                    setNewClientName(clientSearchQuery);
                    setNewClientDocument('');
                    setNewClientPhone('');
                    setNewClientEmail('');
                    setNewClientType('Natural');
                    setNewClientCredit('0');
                    setShowQuickClientModal(true);
                  }}
                  className="py-2 px-4 bg-[#005da9] hover:bg-[#004b88] text-white font-black text-xs uppercase rounded-xl transition flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Nuevo Cliente</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- MODAL: REGISTRO RÁPIDO DE CLIENTE -------------------- */}
      {showQuickClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
          <form 
            onSubmit={handleQuickRegisterClient}
            className="bg-white rounded-3xl border border-gray-100 w-full max-w-md shadow-2xl overflow-hidden text-left flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-5 bg-gray-50 border-b border-gray-100 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight">Registro Rápido de Cliente</h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowQuickClientModal(false)}
                className="p-1.5 hover:bg-gray-200 text-gray-400 hover:text-gray-600 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Nombre Completo / Razón Social *</label>
                <input
                  type="text"
                  required
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Ej: Juan Pérez o Inversiones Alfa C.A."
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>

              {/* Grid document + type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">C.I. / RIF / Documento *</label>
                  <input
                    type="text"
                    required
                    value={newClientDocument}
                    onChange={(e) => setNewClientDocument(e.target.value)}
                    placeholder="Ej: V-12345678 o J-98765432-1"
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Tipo de Persona</label>
                  <select
                    value={newClientType}
                    onChange={(e) => setNewClientType(e.target.value as 'Natural' | 'Jurídico')}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  >
                    <option value="Natural">Natural</option>
                    <option value="Jurídico">Jurídico</option>
                  </select>
                </div>
              </div>

              {/* Phone + Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    placeholder="Ej: 0412-5551234"
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                    placeholder="Ej: cliente@correo.com"
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Initial credit */}
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Saldo de Crédito Inicial ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newClientCredit}
                  onChange={(e) => setNewClientCredit(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-2 justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowQuickClientModal(false)}
                className="py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-xs rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="py-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5" />
                )}
                <span>Registrar y Seleccionar</span>
              </button>
            </div>
          </form>
        </div>
      )}
      {/* 🛍️ MODAL VENTA LIBRE (CÓDIGO 99999) */}
      {showVentaLibreModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 flex flex-col">
            {/* Modal Header */}
            <div className="bg-[#005da9] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center font-mono font-black text-xs border border-amber-300/30 shrink-0">
                  99999
                </div>
                <div>
                  <h3 className="font-extrabold text-sm tracking-tight text-white">
                    Venta Libre / Ítem Genérico (Código 99999)
                  </h3>
                  <p className="text-[10px] text-blue-100 font-medium">
                    Ingrese el nombre y precio personalizado para esta factura.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowVentaLibreModal(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleConfirmVentaLibre} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
                  Nombre o Descripción del Producto / Servicio <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Servicio de Copia Especial, Trabajo Técnico..."
                  value={vlName}
                  onChange={(e) => setVlName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:bg-white transition"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
                    Precio ($ USD) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 font-bold text-xs">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={vlPrice}
                      onChange={(e) => setVlPrice(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-extrabold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:bg-white transition"
                    />
                  </div>
                  {vlPrice && !isNaN(parseFloat(vlPrice)) && parseFloat(vlPrice) > 0 && (
                    <span className="text-[10px] text-emerald-700 font-extrabold block mt-1">
                      Bs. {(parseFloat(vlPrice) * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={vlQty}
                    onChange={(e) => setVlQty(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-extrabold text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
                  Impuesto del Artículo
                </label>
                <select
                  value={vlTaxId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    setVlTaxId(selectedId);
                    if (selectedId === 'exento' || selectedId === '0') {
                      setVlTaxRate(0);
                    } else {
                      const found = taxes.find(t => t.id === selectedId);
                      setVlTaxRate(found ? found.rate : 0);
                    }
                  }}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:bg-white transition"
                >
                  <option value="exento">Exento / Sin Impuesto (0%)</option>
                  {taxes.filter(t => t.is_active !== false).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.rate}%)
                    </option>
                  ))}
                </select>
              </div>

              {!editingVlId && (
                <div className="flex items-start gap-2.5 p-3 bg-blue-50/70 border border-blue-100/90 rounded-2xl">
                  <input
                    type="checkbox"
                    id="vlSaveDbCheckbox"
                    checked={vlSaveDb}
                    onChange={(e) => setVlSaveDb(e.target.checked)}
                    className="w-4 h-4 mt-0.5 text-[#005da9] rounded focus:ring-[#005da9] cursor-pointer shrink-0"
                  />
                  <label htmlFor="vlSaveDbCheckbox" className="text-xs font-bold text-gray-800 cursor-pointer select-none">
                    Guardar en el catálogo de productos de ventas
                    <span className="block text-[10px] text-gray-500 font-normal mt-0.5">
                      Al activar, el producto o servicio quedará registrado en la lista de productos para ser usado en ventas futuras.
                    </span>
                  </label>
                </div>
              )}

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowVentaLibreModal(false)}
                  disabled={isSavingVl}
                  className="px-4 py-2 border border-gray-200 text-gray-600 font-bold text-xs rounded-xl hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingVl}
                  className="px-4 py-2 bg-[#005da9] hover:bg-[#004b87] text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  {isSavingVl ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3.5 h-3.5 text-amber-300" />
                      <span>Agregar a Facturación</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------- MODAL FLOTANTE: FACTURAS EN ESPERA -------------------- */}
      {showDraftsListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-gray-100 w-full max-w-2xl shadow-2xl overflow-hidden text-left flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-amber-500 to-amber-600 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-2xl shrink-0">
                  <Pause className="w-6 h-6 fill-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black uppercase tracking-tight">Facturas en Espera (Ventas Pausadas)</h3>
                    <span className="px-2.5 py-0.5 bg-white/20 text-white text-[11px] font-black rounded-full">
                      {draftInvoices.length}
                    </span>
                  </div>
                  <p className="text-xs text-amber-100 font-medium mt-0.5">
                    Seleccione una factura guardada en espera para recuperarla en la venta actual o descartarla.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowDraftsListModal(false)}
                className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content List */}
            <div className="p-5 overflow-y-auto flex-1 bg-gray-50/50 space-y-3">
              {draftInvoices.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center justify-center space-y-2">
                  <div className="p-3 bg-amber-50 text-amber-500 rounded-full">
                    <Pause className="w-8 h-8 fill-amber-500" />
                  </div>
                  <p className="text-xs font-bold text-gray-700">No hay facturas en espera en este momento.</p>
                  <p className="text-[10px] text-gray-400 max-w-xs">
                    Cuando pause una venta con el botón "Poner en Espera", aparecerá en esta pantalla flotante.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {draftInvoices.map((draft) => {
                    const totalItemsCount = draft.items?.reduce((sum: number, i: any) => sum + (i.qty || 1), 0) || 0;
                    return (
                      <div 
                        key={draft.id} 
                        className="bg-white border border-gray-200 hover:border-amber-400 rounded-2xl p-4 shadow-2xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-lg">
                              {draft.reference || 'ESP-XXXX'}
                            </span>
                            <span className="font-extrabold text-gray-900 text-xs">
                              {draft.customer_name || 'Consumidor final'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-gray-400 font-medium">
                            <span>📦 <strong className="text-gray-700">{totalItemsCount}</strong> ítem(s)</span>
                            <span>•</span>
                            <span>💳 <strong className="text-gray-700">{draft.payment_method || 'Efectivo'}</strong></span>
                            <span>•</span>
                            <span className="text-gray-400 text-[10px]">
                              {draft.created_at ? new Date(draft.created_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : 'Reciente'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-gray-100">
                          <div className="text-left sm:text-right">
                            <span className="text-[9px] text-gray-400 font-bold uppercase block leading-none">Monto Total</span>
                            <span className="text-sm font-black text-[#005da9]">
                              ${Number(draft.total || 0).toFixed(2)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                handleResumeDraft(draft);
                                setShowDraftsListModal(false);
                              }}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5 fill-white" />
                              <span>Recuperar</span>
                            </button>

                            <button
                              onClick={() => handleDeleteDraft(draft.id, draft.reference)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                              title="Eliminar factura en espera"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowDraftsListModal(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- MODAL DE CONFIRMACIÓN: ELIMINAR FACTURA EN ESPERA -------------------- */}
      {draftToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-gray-100 max-w-md w-full p-6 shadow-2xl text-left space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">¿Eliminar Factura en Espera?</h3>
                <p className="text-xs text-gray-500 font-medium">Confirmación de eliminación</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 font-medium leading-relaxed bg-rose-50/50 p-3.5 rounded-2xl border border-rose-100/80">
              ¿Está seguro de que desea eliminar permanentemente la factura en espera con referencia <strong className="text-rose-700 font-extrabold">{draftToDelete.ref}</strong>? Esta acción no se puede deshacer.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDraftToDelete(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteDraft}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sí, Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- MODAL: REGISTRAR MOVIMIENTO FINANCIERO (IMAGE 1) -------------------- */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-gray-100 w-full max-w-md shadow-2xl overflow-hidden relative text-left">
            
            {/* Header */}
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Wallet className="w-5 h-5 text-[#ffb700]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm tracking-tight text-white">
                    Registrar Movimiento Financiero
                  </h3>
                  <p className="text-[10px] text-gray-300 font-medium">
                    Asigne gastos, egresos u otros ingresos directamente.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="text-gray-400 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddManualMovement} className="p-5 space-y-4">
              
              {/* TIPO DE OPERACIÓN */}
              <div>
                <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">
                  TIPO DE OPERACIÓN *
                </label>
                <div className="grid grid-cols-2 gap-2 bg-gray-50 p-1 rounded-2xl border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setManualType('ingreso')}
                    className={`py-2 text-center text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      manualType === 'ingreso'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <span>Ingreso</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 inline-block"></span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualType('egreso')}
                    className={`py-2 text-center text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      manualType === 'egreso'
                        ? 'bg-[#f41d48] text-white shadow-xs'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <span>Egreso</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-300 inline-block"></span>
                  </button>
                </div>
              </div>

              {/* CONCEPTO / DETALLE */}
              <div>
                <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
                  CONCEPTO / DETALLE *
                </label>
                <input
                  type="text"
                  required
                  value={manualConcept}
                  onChange={(e) => setManualConcept(e.target.value)}
                  placeholder="Ej: Pago de papelería, Compra de cartuchos, etc."
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:bg-white transition"
                  autoFocus
                />
              </div>

              {/* CATEGORÍA DE GASTO */}
              {manualType === 'egreso' && (
                <div>
                  <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
                    CATEGORÍA DE GASTO *
                  </label>
                  <select
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:bg-white transition cursor-pointer"
                  >
                    {GASTO_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* MONTOS USD Y VES */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
                    MONTO ($ USD) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-xs text-gray-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={manualAmountUsd}
                      onChange={(e) => setManualAmountUsd(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:bg-white transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1">
                    MONTO (BS VES) (LIVE)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-gray-400">Bs</span>
                    <input
                      type="text"
                      disabled
                      value={manualAmountBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      className="w-full pl-9 pr-3.5 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-xs font-black text-gray-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* MEDIO DE PAGO / COBRO */}
              <div>
                <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
                  MEDIO DE PAGO / COBRO *
                </label>
                <select
                  value={manualPaymentMethod}
                  onChange={(e) => setManualPaymentMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:bg-white transition cursor-pointer"
                >
                  {getActiveMethods().map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.icon} {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* NOTAS / OBSERVACIONES ADICIONALES */}
              <div>
                <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
                  NOTAS / OBSERVACIONES ADICIONALES
                </label>
                <input
                  type="text"
                  value={manualObservations}
                  onChange={(e) => setManualObservations(e.target.value)}
                  placeholder="Ej: Factura Nº 12345..."
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:bg-white transition"
                />
              </div>

              {/* BOTONES ACCIÓN */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  disabled={isSavingManual}
                  className="px-5 py-2.5 border border-gray-200 text-gray-600 font-bold text-xs rounded-xl hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingManual}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-[#ffb700] font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingManual ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 text-[#ffb700]" />
                  )}
                  <span>Registrar Movimiento</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* -------------------- MODAL: REGISTRAR NUEVO GASTO -------------------- */}
      {showGastoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-gray-100 max-w-md w-full overflow-hidden shadow-2xl text-left flex flex-col">
            <div className="p-5 bg-gradient-to-r from-amber-500 to-amber-600 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-2xl shrink-0">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight">Registrar Nuevo Gasto</h3>
                  <p className="text-xs text-amber-100 font-medium">Egreso directo de caja chica</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowGastoModal(false)}
                className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGasto} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
                  Concepto del Gasto <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Pago de flete, bolsas, botellones de agua..."
                  value={gastoConcept}
                  onChange={(e) => setGastoConcept(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
                  Monto ($ USD) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 font-bold text-xs">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={gastoAmount}
                    onChange={(e) => setGastoAmount(e.target.value)}
                    className="w-full pl-7 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-extrabold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                  />
                </div>
                {gastoAmount && !isNaN(parseFloat(gastoAmount)) && parseFloat(gastoAmount) > 0 && (
                  <span className="text-[10px] text-amber-700 font-extrabold block mt-1">
                    Equivalente: Bs. {(parseFloat(gastoAmount) * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
                  Medio de Pago <span className="text-rose-500">*</span>
                </label>
                <select
                  value={gastoPaymentMethod}
                  onChange={(e) => setGastoPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                >
                  <option value="Efectivo USD">Efectivo Dólares (USD)</option>
                  <option value="Efectivo VES">Efectivo Bolívares (VES)</option>
                  <option value="Pago Móvil">Pago Móvil</option>
                  <option value="Punto de Venta">Punto de Venta</option>
                  <option value="Transferencia">Transferencia Bancaria</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowGastoModal(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 font-bold text-xs rounded-xl hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingGasto}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingGasto ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5" />
                  )}
                  <span>Registrar Gasto</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------- MODAL: CREAR PRODUCTO RÁPIDO -------------------- */}
      {showCreateProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-gray-100 max-w-lg w-full overflow-hidden shadow-2xl text-left flex flex-col">
            <div className="p-5 bg-[#005da9] text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-2xl shrink-0">
                  <PackagePlus className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight">Crear Nuevo Producto</h3>
                  <p className="text-xs text-blue-100 font-medium">Registrar e incorporar de inmediato al catálogo de Venta Flash</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowCreateProductModal(false)}
                className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickCreateProduct} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
                  Nombre del Producto <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Cuaderno Espiral Carta 100 Hojas"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:bg-white transition"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
                    Código / SKU
                  </label>
                  <input
                    type="text"
                    placeholder="Auto si está vacío"
                    value={newProdSku}
                    onChange={(e) => setNewProdSku(e.target.value)}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
                    Categoría
                  </label>
                  <select
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:bg-white transition"
                  >
                    <option value="">Sin Categoría</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Impuesto Registrado */}
              <div>
                <label className="block text-xs font-black text-blue-900 uppercase tracking-wider mb-1">
                  Impuesto Registrado a Trasladar *
                </label>
                <select
                  value={newProdTaxId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    setNewProdTaxId(selectedId);
                    if (selectedId === 'exento' || selectedId === '0') {
                      setNewProdTaxRate(0);
                    } else {
                      const found = taxes.find(t => t.id === selectedId);
                      setNewProdTaxRate(found ? found.rate : 0);
                    }
                  }}
                  className="w-full px-3 py-2 bg-blue-50/60 border border-blue-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:bg-white transition"
                >
                  <option value="exento">Exento / Sin Impuesto (0%)</option>
                  {taxes.filter(t => t.is_active !== false).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.rate}%)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
                    Precio ($ USD) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 font-bold text-xs">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="0.00"
                      value={newProdPrice}
                      onChange={(e) => setNewProdPrice(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-extrabold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:bg-white transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
                    Stock Inicial
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newProdStock}
                    onChange={(e) => setNewProdStock(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-extrabold text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateProductModal(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 font-bold text-xs rounded-xl hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingProduct}
                  className="px-4 py-2 bg-[#005da9] hover:bg-[#004b87] text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingProduct ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5 text-amber-300" />
                  )}
                  <span>Guardar y Agregar a Venta</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* -------------------- MODAL FLOTANTE: ÚLTIMAS FACTURAS Y NOTAS DE ENTREGA EMITIDAS -------------------- */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 md:p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-gray-100 max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl text-left flex flex-col">
            
            {/* Header del Modal */}
            <div className="p-4 md:p-5 bg-gradient-to-r from-[#005da9] via-blue-700 to-blue-800 text-white flex justify-between items-center shrink-0 shadow-md">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-2xl shrink-0 backdrop-blur-xs">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-black uppercase tracking-tight flex items-center gap-2">
                    Historial y Búsqueda de Comprobantes
                  </h3>
                  <p className="text-xs text-blue-100 font-medium">
                    Consulta, filtra y busca facturas o notas de entrega emitidas ({invoiceHistory.length} registros en total)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadInvoiceData()}
                  disabled={isLoadingData}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition cursor-pointer flex items-center gap-1 text-xs font-bold disabled:opacity-50"
                  title="Recargar facturas desde la base de datos"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Actualizar</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setShowHistoryModal(false)}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition cursor-pointer"
                  title="Cerrar modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Panel de Filtros y Búsqueda */}
            <div className="p-4 bg-gray-50/90 border-b border-gray-200 shrink-0 space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                
                {/* Campo de búsqueda por N° Documento, Cliente o RIF */}
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder="Buscar por N° documento (ej: FAC-1031, NE-1005), cliente o RIF/C.I..."
                    className="w-full pl-10 pr-9 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:border-transparent transition shadow-xs"
                  />
                  {historySearchQuery && (
                    <button
                      type="button"
                      onClick={() => setHistorySearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Filtro por Tipo (Pills / Botones) */}
                <div className="flex items-center gap-1 bg-white p-1 border border-gray-200 rounded-xl shadow-xs shrink-0 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setHistoryTypeFilter('todos')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                      historyTypeFilter === 'todos'
                        ? 'bg-[#005da9] text-white shadow-xs'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span>Todos</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      historyTypeFilter === 'todos' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {invoiceHistory.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHistoryTypeFilter('factura')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                      historyTypeFilter === 'factura'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700'
                    }`}
                  >
                    <span>Facturas</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      historyTypeFilter === 'factura' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {totalFacturasCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHistoryTypeFilter('nota_entrega')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                      historyTypeFilter === 'nota_entrega'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-gray-600 hover:bg-amber-50 hover:text-amber-700'
                    }`}
                  >
                    <span>Notas Entrega</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      historyTypeFilter === 'nota_entrega' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {totalNotasCount}
                    </span>
                  </button>
                </div>

              </div>

              {/* Barra de Resumen de Resultados Filtros Activos */}
              {(historySearchQuery || historyTypeFilter !== 'todos') && (
                <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-200/60">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-700">Filtros activos:</span>
                    {historySearchQuery && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-bold text-[11px] border border-blue-200">
                        Búsqueda: "{historySearchQuery}"
                      </span>
                    )}
                    {historyTypeFilter !== 'todos' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-200 text-gray-800 rounded-md font-bold text-[11px]">
                        Tipo: {historyTypeFilter === 'factura' ? 'Facturas' : 'Notas de Entrega'}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setHistorySearchQuery('');
                      setHistoryTypeFilter('todos');
                    }}
                    className="text-[#005da9] hover:underline font-bold text-[11px] cursor-pointer shrink-0"
                  >
                    Restablecer filtros
                  </button>
                </div>
              )}
            </div>

            {/* Contenido Principal / Tabla de Resultados */}
            <div className="p-4 md:p-5 overflow-y-auto flex-1 bg-white">
              {isLoadingData ? (
                <div className="py-16 text-center text-xs text-gray-500 flex flex-col items-center gap-2 font-medium">
                  <Loader2 className="w-8 h-8 animate-spin text-[#005da9]" />
                  <span>Cargando historial de comprobantes...</span>
                </div>
              ) : filteredHistoryInvoices.length === 0 ? (
                <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
                  <div className="p-4 bg-gray-100 rounded-full text-gray-400">
                    <Search className="w-8 h-8" />
                  </div>
                  <div className="max-w-md">
                    <h4 className="text-sm font-black text-gray-800 uppercase">Sin Resultados</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      {historySearchQuery || historyTypeFilter !== 'todos'
                        ? `No se encontraron comprobantes que coincidan con la búsqueda "${historySearchQuery}".`
                        : 'No se han registrado comprobantes en el sistema todavía.'}
                    </p>
                  </div>
                  {(historySearchQuery || historyTypeFilter !== 'todos') && (
                    <button
                      type="button"
                      onClick={() => {
                        setHistorySearchQuery('');
                        setHistoryTypeFilter('todos');
                      }}
                      className="mt-2 px-4 py-2 bg-[#005da9] hover:bg-[#004b87] text-white font-extrabold text-xs rounded-xl shadow-xs transition cursor-pointer"
                    >
                      Mostrar Todos los Comprobantes
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50/90 border-b border-gray-200 text-gray-500 font-bold uppercase text-[9.5px] tracking-wider">
                      <tr>
                        <th className="p-3">Documento N°</th>
                        <th className="p-3">Tipo</th>
                        <th className="p-3">Cliente / RIF</th>
                        <th className="p-3">Fecha</th>
                        <th className="p-3">Método Pago</th>
                        <th className="p-3 text-right">Total ($)</th>
                        <th className="p-3 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedHistoryInvoices.map((inv) => {
                        const isNota = inv.document_type === 'nota_entrega' || (inv.control_number && String(inv.control_number).startsWith('NE-'));
                        const docRef = inv.customer_id || inv.customer_document || inv.rif || inv.document || '';
                        
                        return (
                          <tr key={inv.id || inv.control_number} className="hover:bg-blue-50/30 transition-colors">
                            <td className="p-3 font-mono font-black text-[#005da9] text-xs">
                              {inv.control_number || 'S/N'}
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1 ${
                                isNota 
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}>
                                {isNota ? 'Nota Entrega' : 'Factura'}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-gray-800">{inv.customer_name || 'Consumidor Final'}</div>
                              {docRef && (
                                <div className="text-[10px] text-gray-400 font-mono">{docRef}</div>
                              )}
                            </td>
                            <td className="p-3 text-gray-500 text-[11px] whitespace-nowrap">
                              {inv.created_at ? new Date(inv.created_at).toLocaleString('es-VE', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                              }) : '-'}
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md text-[10px] font-bold border border-gray-200 capitalize">
                                {inv.payment_method || 'Efectivo'}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <div className="font-black text-gray-900 text-sm">
                                ${Number(inv.total || 0).toFixed(2)}
                              </div>
                              {bcvRate > 0 && (
                                <div className="text-[10px] text-gray-400 font-medium">
                                  Bs. {(Number(inv.total || 0) * (inv.bcv_rate || bcvRate)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <button 
                                onClick={() => {
                                  setCompletedInvoice(inv);
                                }}
                                className="px-2.5 py-1.5 bg-blue-50 text-[#005da9] hover:bg-blue-600 hover:text-white rounded-xl transition-all inline-flex items-center gap-1 text-[11px] font-black cursor-pointer shadow-2xs"
                                title="Ver detalle completo y reimprimir"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Ver</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer con Pagina y Botón Cerrar */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-gray-500 font-medium">
                Mostrando <span className="font-bold text-gray-800">{paginatedHistoryInvoices.length}</span> de <span className="font-bold text-gray-800">{filteredHistoryInvoices.length}</span> comprobantes encontrados
              </div>

              {/* Controles de Paginación */}
              <div className="flex items-center gap-2">
                {totalHistoryPages > 1 && (
                  <div className="flex items-center gap-1 mr-2">
                    <button
                      type="button"
                      onClick={() => setHistoryPage(prev => Math.max(prev - 1, 1))}
                      disabled={historyPage === 1}
                      className="p-1.5 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white cursor-pointer transition"
                      title="Página Anterior"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-bold px-2 text-gray-700">
                      Página {historyPage} de {totalHistoryPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setHistoryPage(prev => Math.min(prev + 1, totalHistoryPages))}
                      disabled={historyPage === totalHistoryPages}
                      className="p-1.5 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white cursor-pointer transition"
                      title="Página Siguiente"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowHistoryModal(false)}
                  className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 🔐 MODAL APERTURA CAJA */}
      <OpenCashSessionModal
        isOpen={showOpenCajaModal}
        onClose={() => setShowOpenCajaModal(false)}
        onConfirm={async ({ aperturaBs, observaciones, empleadoNombre }) => {
          const rateToUse = customBcvRate > 0 ? customBcvRate : (bcvRate > 0 ? bcvRate : 36.5);
          const openingUsd = aperturaBs / rateToUse;
          const empName = empleadoNombre.trim() || currentUser?.name || currentUser?.email || 'Cajero Responsable';

          const newSession = await dbService.createCashSession({
            empleado_nombre: empName,
            empleado_id: currentUser?.id || null,
            apertura_bs: aperturaBs,
            apertura_usd: openingUsd,
            observaciones: observaciones
          });

          await dbService.addCashOp({
            session_id: newSession?.id,
            type: 'ingreso',
            concept: 'Apertura de Caja - Fondo Inicial',
            amount: openingUsd,
            amount_bs: aperturaBs,
            empleado_nombre: empName,
            payment_method: 'Efectivo VES'
          });

          await checkActiveSession();
          if (onRefreshData) {
            onRefreshData();
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('bellavista_cash_updated'));
          }
          setShowOpenCajaModal(false);
          showToast('success', `¡Caja abierta exitosamente por ${empName}!`);
        }}
        bcvRate={customBcvRate > 0 ? customBcvRate : bcvRate}
        currentUser={currentUser}
        storeUsers={storeUsers}
        initialBs={aperturaBsInput}
        initialObs={aperturaObsInput}
      />

      {/* 🔒 MODAL CIERRE DE CAJA */}
      {showCloseCajaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-gray-100 w-full max-w-md shadow-2xl overflow-hidden relative text-left">
            <div className="bg-rose-600 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Lock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm tracking-tight text-white">
                    Cierre de Caja y Arqueo
                  </h3>
                  <p className="text-[10px] text-rose-100 font-medium">
                    Verifique el efectivo y efectúe el cierre del turno.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCloseCajaModal(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmCloseCaja} className="p-5 space-y-4">
              {/* Resumen del Turno */}
              <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-3.5 space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-gray-600">
                  <span>Fondo Inicial:</span>
                  <span className="font-mono font-bold text-gray-800">
                    {Number(activeSession?.apertura_bs || 0).toFixed(2)} Bs (${Number(activeSession?.apertura_usd || 0).toFixed(2)} USD)
                  </span>
                </div>
                <div className="flex justify-between items-center text-gray-600">
                  <span>Total Ventas / Ingresos:</span>
                  <span className="font-mono font-bold text-emerald-700">
                    +{sessionSummary?.totalSalesBs?.toFixed(2)} Bs (${sessionSummary?.totalSalesUsd?.toFixed(2)} USD)
                  </span>
                </div>
                <div className="pt-1.5 border-t border-rose-200/60 flex justify-between items-center font-black text-rose-950">
                  <span>Arqueo Esperado en Caja:</span>
                  <span className="font-mono text-sm text-rose-700">
                    {sessionSummary?.expectedBs?.toFixed(2)} Bs (${sessionSummary?.expectedUsd?.toFixed(2)} USD)
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
                  Efectivo Real Contado en Caja (Bs) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-xs text-gray-400">Bs</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={cierreBsInput}
                    onChange={(e) => setCierreBsInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-extrabold text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition"
                  />
                </div>
                {/* Diferencia live indicator */}
                {(() => {
                  const inputVal = parseFloat(cierreBsInput) || 0;
                  const diff = inputVal - (sessionSummary?.expectedBs || 0);
                  if (Math.abs(diff) < 0.01) {
                    return <p className="text-[10px] text-emerald-600 font-bold mt-1">🟢 Cuadre exacto: Sin diferencia</p>;
                  } else if (diff > 0) {
                    return <p className="text-[10px] text-blue-600 font-bold mt-1">🔵 Sobrante: +{diff.toFixed(2)} Bs</p>;
                  } else {
                    return <p className="text-[10px] text-rose-600 font-bold mt-1">🔴 Faltante: {diff.toFixed(2)} Bs</p>;
                  }
                })()}
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
                  Observaciones de Cierre
                </label>
                <input
                  type="text"
                  value={cierreObsInput}
                  onChange={(e) => setCierreObsInput(e.target.value)}
                  placeholder="Ej: Cierre de turno sin novedades..."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCloseCajaModal(false)}
                  disabled={isSavingCierre}
                  className="px-4 py-2 border border-gray-200 text-gray-600 font-bold text-xs rounded-xl hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingCierre}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  {isSavingCierre ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  <span>Confirmar y Cerrar Caja</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🧾 MODAL TICKET / COMPROBANTE DE ARQUEO Y CIERRE DE CAJA */}
      {showTicketModal && ticketSession && (
        <ClosureTicketModal
          session={ticketSession}
          sessionOps={allCashOpsForTicket}
          bcvRate={customBcvRate > 0 ? customBcvRate : bcvRate}
          onClose={() => {
            setShowTicketModal(false);
            setTicketSession(null);
          }}
        />
      )}
    </div>
  );
}
