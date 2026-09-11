import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShoppingBag, Plus, Search, Calendar, Truck, FileText, CheckCircle2, 
  Trash2, Eye, RefreshCw, Download, Printer, ArrowUpRight, Package, 
  DollarSign, AlertCircle, X, Check, Layers, TrendingUp, Sparkles, User, Hash, Edit3, Barcode,
  ArrowUp, Link2, Upload, Star
} from 'lucide-react';
import { Product, Provider, Purchase, PurchaseItem, Category, Brand, Tax, BusinessBranch } from '../types.ts';
import { dbService } from '../lib/supabase.ts';
import BarcodeScannerModal from './BarcodeScannerModal.tsx';

interface ComprasModuleProps {
  products: Product[];
  providers: Provider[];
  categories?: Category[];
  brands?: Brand[];
  adminTaxes?: Tax[];
  businessBranchesList?: BusinessBranch[];
  onRefreshData: () => void;
  currencyRates?: Record<string, number>;
  activeRole?: string;
}

export default function ComprasModule({
  products,
  providers,
  categories = [],
  brands = [],
  adminTaxes = [],
  businessBranchesList = [],
  onRefreshData,
  currencyRates = { VES: 0 },
  activeRole = 'admin'
}: ComprasModuleProps) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('all'); // all, today, this_month

  // Categories, Brands, Taxes and Branches internal lists
  const [categoriesList, setCategoriesList] = useState<Category[]>(categories);
  const [brandsList, setBrandsList] = useState<Brand[]>(brands);
  const [taxesList, setTaxesList] = useState<Tax[]>(adminTaxes);
  const [branchesList, setBranchesList] = useState<BusinessBranch[]>(businessBranchesList);

  useEffect(() => {
    if (categories && categories.length > 0) {
      setCategoriesList(categories);
    } else {
      dbService.getCategories().then(cats => {
        if (Array.isArray(cats) && cats.length > 0) setCategoriesList(cats);
      }).catch(err => console.warn("Error loading categories in Compras:", err));
    }
  }, [categories]);

  useEffect(() => {
    if (brands && brands.length > 0) {
      setBrandsList(brands);
    } else {
      dbService.getBrands().then(brs => {
        if (Array.isArray(brs) && brs.length > 0) setBrandsList(brs);
      }).catch(err => console.warn("Error loading brands in Compras:", err));
    }
  }, [brands]);

  useEffect(() => {
    if (adminTaxes && adminTaxes.length > 0) {
      setTaxesList(adminTaxes);
    } else {
      dbService.getTaxes().then(txs => {
        if (Array.isArray(txs) && txs.length > 0) setTaxesList(txs);
      }).catch(err => console.warn("Error loading taxes in Compras:", err));
    }
  }, [adminTaxes]);

  useEffect(() => {
    if (businessBranchesList && businessBranchesList.length > 0) {
      setBranchesList(businessBranchesList);
    } else {
      dbService.getBusinessBranches().then(brs => {
        if (Array.isArray(brs) && brs.length > 0) setBranchesList(brs.filter(b => b.active !== false));
      }).catch(err => console.warn("Error loading branches in Compras:", err));
    }
  }, [businessBranchesList]);

  // Modal: Nueva Compra
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // Interactive Product Search state per row
  const [rowSearchQueries, setRowSearchQueries] = useState<Record<string, string>>({});
  const [openSearchRowId, setOpenSearchRowId] = useState<string | null>(null);

  // Full Product Registration Modal State (Matching Admin Catalog Modal Image)
  const [showQuickProductModal, setShowQuickProductModal] = useState<boolean>(false);
  const [quickTargetRowId, setQuickTargetRowId] = useState<string | null>(null);
  
  const [prodSku, setProdSku] = useState<string>('');
  const [prodName, setProdName] = useState<string>('');
  const [prodDescription, setProdDescription] = useState<string>('');
  const [prodCostPrice, setProdCostPrice] = useState<number | string>(0);
  const [prodMargin1, setProdMargin1] = useState<number | string>(30);
  const [prodPrice, setProdPrice] = useState<number | string>(0);
  const [prodOfferPrice, setProdOfferPrice] = useState<string>('');
  const [prodStock, setProdStock] = useState<number>(10);
  const [prodUnit, setProdUnit] = useState<string>('Unidad');
  const [prodCategoryId, setProdCategoryId] = useState<string>('');
  const [prodBrandId, setProdBrandId] = useState<string>('');
  const [prodCriticalStock, setProdCriticalStock] = useState<number | string>(5);
  const [prodLocation, setProdLocation] = useState<string>('Tienda Bella Vista (SP-01)');
  const [prodTaxId, setProdTaxId] = useState<string>('exento');
  const [prodTaxRate, setProdTaxRate] = useState<number>(0);
  const [prodExpirationDate, setProdExpirationDate] = useState<string>('');
  const [prodFeatured, setProdFeatured] = useState<boolean>(false);
  const [prodActive, setProdActive] = useState<boolean>(true);
  const [prodRatingStars, setProdRatingStars] = useState<number>(5);
  const [prodRatingCount, setProdRatingCount] = useState<number>(0);
  const [prodTechUrl, setProdTechUrl] = useState<string>('');
  const [prodBarcodeQr, setProdBarcodeQr] = useState<string>('');
  const [showProductFormScanner, setShowProductFormScanner] = useState<boolean>(false);
  const [prodImageMode, setProdImageMode] = useState<'upload' | 'url'>('upload');
  const [prodUploadedImages, setProdUploadedImages] = useState<string[]>([]);
  const [prodImageUrl, setProdImageUrl] = useState<string>('');
  const [isUploadingImages, setIsUploadingImages] = useState<boolean>(false);
  const [slotReplaceIndex, setSlotReplaceIndex] = useState<number | null>(null);
  const [isSavingQuickProduct, setIsSavingQuickProduct] = useState<boolean>(false);

  const prodFileInputRef = useRef<HTMLInputElement | null>(null);
  const prodReplaceInputRef = useRef<HTMLInputElement | null>(null);
  
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

  // Real-time product search filtering per row
  const getFilteredProductsForRow = (query: string) => {
    const cleanQ = (query || '').trim().toLowerCase();
    if (!cleanQ) {
      return products.slice(0, 10);
    }
    return products.filter(p => {
      const matchName = (p.name || '').toLowerCase().includes(cleanQ);
      const matchSku = (p.sku || '').toLowerCase().includes(cleanQ);
      const matchBarcode = (p.barcode_qr || '').toLowerCase().includes(cleanQ);
      return matchName || matchSku || matchBarcode;
    }).slice(0, 15);
  };

  // Helpers for Price and Margin Calculations in Product Form
  const handleCostChange = (val: string) => {
    setProdCostPrice(val);
    const cost = parseFloat(String(val).replace(',', '.')) || 0;
    const m = parseFloat(String(prodMargin1).replace(',', '.')) || 0;
    setProdPrice((cost * (1 + m / 100)).toFixed(2));
  };

  const handleMarginChange = (val: string) => {
    setProdMargin1(val);
    const cost = parseFloat(String(prodCostPrice).replace(',', '.')) || 0;
    const m = parseFloat(String(val).replace(',', '.')) || 0;
    setProdPrice((cost * (1 + m / 100)).toFixed(2));
  };

  const handlePriceChange = (val: string) => {
    setProdPrice(val);
    const cost = parseFloat(String(prodCostPrice).replace(',', '.')) || 0;
    const p = parseFloat(String(val).replace(',', '.')) || 0;
    if (cost > 0) {
      setProdMargin1((((p - cost) / cost) * 100).toFixed(2));
    }
  };

  // Image Upload Handlers for Product Form
  const handleImageFilesChange = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploadingImages(true);
    try {
      const newImages = [...prodUploadedImages];
      const remainingSlots = Math.max(0, 3 - newImages.length);
      const filesToProcess = Array.from(files).slice(0, remainingSlots);

      for (const file of filesToProcess) {
        if (!file.type.startsWith('image/')) continue;
        const uploadedUrl = await dbService.uploadProductImageFile(file);
        if (uploadedUrl) {
          newImages.push(uploadedUrl);
        }
      }
      setProdUploadedImages(newImages.slice(0, 3));
    } catch (err) {
      console.error("Error processing images:", err);
      alert("Error al cargar las imágenes. Por favor intente nuevamente.");
    } finally {
      setIsUploadingImages(false);
    }
  };

  const handleRemoveUploadedImage = (indexToRemove: number) => {
    setProdUploadedImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleReplaceUploadedImage = async (indexToReplace: number, file: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    setIsUploadingImages(true);
    try {
      const uploadedUrl = await dbService.uploadProductImageFile(file);
      if (uploadedUrl) {
        setProdUploadedImages(prev => {
          const copy = [...prev];
          copy[indexToReplace] = uploadedUrl;
          return copy;
        });
      }
    } catch (err) {
      console.error("Error replacing image:", err);
      alert("Error al reemplazar la imagen.");
    } finally {
      setIsUploadingImages(false);
      setSlotReplaceIndex(null);
    }
  };

  // Open Full Product Creation Modal (from Image in Prompt)
  const handleOpenQuickProductModal = (rowId: string = '', initialName: string = '', initialCost: number = 0) => {
    const cleanName = initialName.trim();
    const autoSku = `PRD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const defaultBranch = branchesList[0] ? (branchesList[0].code ? `${branchesList[0].name} (${branchesList[0].code})` : branchesList[0].name) : 'Tienda Bella Vista (SP-01)';
    
    setQuickTargetRowId(rowId || null);
    setProdSku(autoSku);
    setProdName(cleanName);
    setProdDescription('');
    setProdCostPrice(initialCost > 0 ? initialCost : 0);
    setProdMargin1(30);
    setProdPrice(initialCost > 0 ? (initialCost * 1.3).toFixed(2) : 0);
    setProdOfferPrice('');
    setProdStock(10);
    setProdUnit('Unidad');
    setProdCategoryId(categoriesList[0]?.id || '');
    setProdBrandId(brandsList[0]?.id || '');
    setProdCriticalStock(5);
    setProdLocation(defaultBranch);
    setProdTaxId('exento');
    setProdTaxRate(0);
    setProdExpirationDate('');
    setProdFeatured(false);
    setProdActive(true);
    setProdRatingStars(5);
    setProdRatingCount(0);
    setProdTechUrl('');
    setProdBarcodeQr('');
    setProdImageMode('upload');
    setProdUploadedImages([]);
    setProdImageUrl('');
    setShowQuickProductModal(true);
    setOpenSearchRowId(null);
  };

  // Save Product directly to Supabase and link to current purchase row
  const handleSaveQuickProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) {
      alert('Por favor ingresa el nombre del producto.');
      return;
    }
    setIsSavingQuickProduct(true);
    try {
      const parseSpanishFloat = (val: any): number => {
        if (val === undefined || val === null) return 0;
        const str = String(val).trim().replace(',', '.');
        const parsed = parseFloat(str);
        return isNaN(parsed) ? 0 : parsed;
      };

      const parseSpanishFloatOptional = (val: any): number | null => {
        if (val === undefined || val === null) return null;
        const str = String(val).trim();
        if (str === '' || str.toLowerCase() === 'ninguno') return null;
        const cleaned = str.replace(',', '.');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? null : parsed;
      };

      const costNum = parseSpanishFloat(prodCostPrice);
      const marginNum = parseSpanishFloat(prodMargin1);
      const priceNum = parseSpanishFloat(prodPrice);
      const offerPriceNum = parseSpanishFloatOptional(prodOfferPrice);
      const generatedSlug = prodName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now().toString().slice(-4);

      const payload = {
        sku: prodSku.trim() || `PRD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        name: prodName.trim(),
        slug: generatedSlug,
        description: prodDescription.trim(),
        unit: prodUnit.trim() || 'Unidad',
        units: prodUnit.trim() || 'Unidad',
        cost_price: costNum,
        margin_1: marginNum,
        margin_2: marginNum,
        margin_3: marginNum,
        selected_margin_type: 1,
        price: priceNum,
        offer_price: offerPriceNum,
        stock: Number(prodStock) || 0,
        category_id: prodCategoryId || (categoriesList[0]?.id || ''),
        brand_id: prodBrandId || (brandsList[0]?.id || ''),
        featured: prodFeatured,
        active: prodActive,
        rating_stars: Number(prodRatingStars) || 5,
        rating_count: Number(prodRatingCount) || 0,
        technical_sheet_url: prodTechUrl.trim() || null,
        barcode_qr: prodBarcodeQr.trim() || null,
        tax_id: prodTaxId,
        tax_rate: Number(prodTaxRate) || 0,
        expiration_date: prodExpirationDate ? prodExpirationDate : null,
        critical_stock: Number(prodCriticalStock) || 0,
        location: prodLocation || 'Tienda Bella Vista (SP-01)'
      };

      const savedProduct = await dbService.createProduct(payload);

      // Handle images persistence in Supabase
      let finalImagesToPersist: string[] = [];
      if (prodImageMode === 'upload') {
        finalImagesToPersist = prodUploadedImages.filter(u => Boolean(u && u.trim())).slice(0, 3);
      } else {
        finalImagesToPersist = prodImageUrl.split(',').map(u => u.trim()).filter(u => Boolean(u && u.trim())).slice(0, 3);
      }

      if (finalImagesToPersist.length > 0) {
        await dbService.setProductImagesForProduct(savedProduct.id, finalImagesToPersist);
      }

      // Refresh global catalog
      onRefreshData();

      // Automatically link to target row or add as row
      if (quickTargetRowId) {
        setFormItems(prev => prev.map(item => {
          if (item.id === quickTargetRowId) {
            return {
              ...item,
              product_id: savedProduct.id,
              product_name: savedProduct.name,
              sku: savedProduct.sku || '',
              unit_cost: costNum,
              current_stock: Number(savedProduct.stock || 0)
            };
          }
          return item;
        }));
        setRowSearchQueries(prev => ({ ...prev, [quickTargetRowId]: '' }));
      } else {
        // If opened from header button, add a new row with this product
        setFormItems(prev => [
          ...prev,
          {
            id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            product_id: savedProduct.id,
            product_name: savedProduct.name,
            sku: savedProduct.sku || '',
            quantity: 1,
            unit_cost: costNum,
            current_stock: Number(savedProduct.stock || 0)
          }
        ]);
      }

      setShowQuickProductModal(false);
      showToast('¡Producto Creado!', `El producto "${savedProduct.name}" ha sido guardado e insertado en la compra.`, 'success');
    } catch (err: any) {
      console.error('Error creating product in Compras:', err);
      alert(`Error al registrar el producto: ${err.message || err.toString()}`);
    } finally {
      setIsSavingQuickProduct(false);
    }
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
          .header { border-bottom: 2px solid #1D3557; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
          .title { font-size: 20px; font-weight: bold; color: #1D3557; text-transform: uppercase; margin: 0; }
          .meta { margin-top: 4px; font-size: 12px; color: #555; }
          table { width: 100%; border-collapse: collapse; margin: 16px 0; }
          th { background: #f4f6f8; text-align: left; padding: 8px; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #ccc; }
          .totals { margin-top: 16px; text-align: right; font-size: 14px; }
          .totals-row { margin-bottom: 4px; }
          .grand-total { font-size: 18px; font-weight: bold; color: #1D3557; margin-top: 8px; }
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
          <h2 className="text-xl font-montserrat font-extrabold text-[#1D3557] uppercase tracking-tight flex items-center gap-2.5">
            <div className="p-2 bg-[#1D3557]/10 text-[#1D3557] rounded-xl">
              <ShoppingBag className="w-6 h-6 text-[#1D3557]" />
            </div>
            <span>Compras e Ingreso de Inventario</span>
          </h2>
          <p className="text-xs text-[#2B2D42]/70 font-medium mt-1">
            Registra facturas de proveedores, abastece el inventario con incremento de stock automático y actualiza costos.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => loadPurchases()}
            disabled={loading}
            className="p-2.5 bg-[#F8F9FA] hover:bg-gray-200 text-[#2B2D42] rounded-xl transition cursor-pointer border border-gray-200"
            title="Refrescar Compras"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#1D3557]' : 'text-[#1D3557]'}`} />
          </button>

          <button
            onClick={() => {
              resetForm();
              setShowNewModal(true);
            }}
            className="px-4 py-2.5 bg-[#40E0D0] hover:bg-[#36cebe] text-[#1D3557] text-xs font-montserrat font-extrabold rounded-xl transition shadow-md hover:shadow-lg uppercase tracking-wider flex items-center gap-2 shrink-0 cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4 stroke-[3] text-[#1D3557]" />
            <span>Nueva Compra</span>
          </button>
        </div>
      </div>

      {/* TOP KPI / STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invertido */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3.5 relative overflow-hidden group hover:border-[#00BFFF] transition">
          <div className="p-3 bg-[#1D3557]/10 text-[#1D3557] rounded-xl">
            <DollarSign className="w-6 h-6 text-[#1D3557]" />
          </div>
          <div>
            <span className="text-[10px] font-montserrat font-extrabold uppercase text-gray-400 tracking-wider block">Total Comprado (Histórico)</span>
            <span className="text-lg font-montserrat font-extrabold text-[#1D3557] block font-mono">
              ${(stats?.totalPurchasedUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </span>
            {bcvRate > 0 && (
              <span className="text-[10px] font-bold text-[#2B2D42]/70 block">
                ≈ Bs. {(stats?.totalPurchasedBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>
          <div className="absolute -right-2 -bottom-2 opacity-5 pointer-events-none group-hover:scale-110 transition duration-300">
            <DollarSign className="w-20 h-20 text-[#1D3557]" />
          </div>
        </div>

        {/* Total Compras Registradas */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3.5 relative overflow-hidden group hover:border-[#40E0D0] transition">
          <div className="p-3 bg-[#40E0D0]/20 text-[#1D3557] rounded-xl">
            <FileText className="w-6 h-6 text-[#1D3557]" />
          </div>
          <div>
            <span className="text-[10px] font-montserrat font-extrabold uppercase text-gray-400 tracking-wider block">Compras Realizadas</span>
            <span className="text-lg font-montserrat font-extrabold text-[#1D3557] block font-mono">
              {stats.totalPurchasesCount} {stats.totalPurchasesCount === 1 ? 'Factura' : 'Facturas'}
            </span>
            <span className="text-[10px] font-bold text-[#1D3557] flex items-center gap-1">
              <Check className="w-3 h-3 text-[#40E0D0]" /> Transacciones validadas
            </span>
          </div>
          <div className="absolute -right-2 -bottom-2 opacity-5 pointer-events-none group-hover:scale-110 transition duration-300">
            <FileText className="w-20 h-20 text-[#1D3557]" />
          </div>
        </div>

        {/* Unidades Ingresadas al Stock */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3.5 relative overflow-hidden group hover:border-[#00BFFF] transition">
          <div className="p-3 bg-[#00BFFF]/15 text-[#00BFFF] rounded-xl">
            <Layers className="w-6 h-6 text-[#1D3557]" />
          </div>
          <div>
            <span className="text-[10px] font-montserrat font-extrabold uppercase text-gray-400 tracking-wider block">Unidades Ingresadas</span>
            <span className="text-lg font-montserrat font-extrabold text-[#1D3557] block font-mono">
              {stats.totalUnitsBought} {stats.totalUnitsBought === 1 ? 'unidad' : 'unidades'}
            </span>
            <span className="text-[10px] font-bold text-[#1D3557] flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-[#00BFFF]" /> Incremento en inventario
            </span>
          </div>
          <div className="absolute -right-2 -bottom-2 opacity-5 pointer-events-none group-hover:scale-110 transition duration-300">
            <Layers className="w-20 h-20 text-[#1D3557]" />
          </div>
        </div>

        {/* Proveedores Activos */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3.5 relative overflow-hidden group hover:border-[#1D3557] transition">
          <div className="p-3 bg-[#1D3557]/10 text-[#1D3557] rounded-xl">
            <Truck className="w-6 h-6 text-[#1D3557]" />
          </div>
          <div>
            <span className="text-[10px] font-montserrat font-extrabold uppercase text-gray-400 tracking-wider block">Proveedores Registrados</span>
            <span className="text-lg font-montserrat font-extrabold text-[#1D3557] block font-mono">
              {stats.activeProvidersCount} {stats.activeProvidersCount === 1 ? 'Proveedor' : 'Proveedores'}
            </span>
            <span className="text-[10px] font-bold text-[#2B2D42]/70 block">
              Red de distribución activa
            </span>
          </div>
          <div className="absolute -right-2 -bottom-2 opacity-5 pointer-events-none group-hover:scale-110 transition duration-300">
            <Truck className="w-20 h-20 text-[#1D3557]" />
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-[#F8F9FA] p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-[#00BFFF] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por N° Factura, proveedor, producto o fecha..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#2B2D42]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <div className="flex items-center bg-gray-200/60 p-1 rounded-xl border border-gray-200">
            <button
              onClick={() => setDateFilter('all')}
              className={`px-3 py-1 text-xs font-montserrat font-bold rounded-lg transition ${
                dateFilter === 'all' ? 'bg-[#1D3557] text-white shadow-xs' : 'text-[#2B2D42]/70 hover:text-[#1D3557]'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setDateFilter('this_month')}
              className={`px-3 py-1 text-xs font-montserrat font-bold rounded-lg transition ${
                dateFilter === 'this_month' ? 'bg-[#1D3557] text-white shadow-xs' : 'text-[#2B2D42]/70 hover:text-[#1D3557]'
              }`}
            >
              Este Mes
            </button>
            <button
              onClick={() => setDateFilter('today')}
              className={`px-3 py-1 text-xs font-montserrat font-bold rounded-lg transition ${
                dateFilter === 'today' ? 'bg-[#1D3557] text-white shadow-xs' : 'text-[#2B2D42]/70 hover:text-[#1D3557]'
              }`}
            >
              Hoy
            </button>
          </div>

          <span className="text-[11px] font-bold text-[#2B2D42]/60 ml-2 hidden sm:inline">
            Mostrando {filteredPurchases.length} de {purchases.length}
          </span>
        </div>
      </div>

      {/* PURCHASES TABLE / HISTORY */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-xs font-montserrat font-extrabold text-[#1D3557] uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#00BFFF]" />
            <span>Historial de Compras Recientes ({filteredPurchases.length})</span>
          </h3>
          <span className="text-[11px] text-[#2B2D42]/70 font-medium">
            Tasa BCV del día: <strong className="font-mono text-[#00BFFF]">Bs. {bcvRate.toFixed(2)}/USD</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#1D3557] text-white font-montserrat font-extrabold uppercase tracking-wider text-[11px]">
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
            <tbody className="divide-y divide-gray-100 font-medium text-[#2B2D42]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#00BFFF]" />
                    <span>Cargando historial de compras...</span>
                  </td>
                </tr>
              ) : filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="p-4 bg-[#F8F9FA] text-[#1D3557] rounded-full w-16 h-16 flex items-center justify-center mx-auto">
                        <ShoppingBag className="w-8 h-8 text-[#1D3557]" />
                      </div>
                      <h4 className="font-montserrat font-extrabold text-[#1D3557] text-sm">No se encontraron registros de compra</h4>
                      <p className="text-xs text-[#2B2D42]/70 leading-relaxed">
                        {searchQuery ? 'No hay resultados que coincidan con la búsqueda.' : 'Aún no has registrado compras para reabastecer el inventario.'}
                      </p>
                      <button
                        onClick={() => {
                          resetForm();
                          setShowNewModal(true);
                        }}
                        className="px-4 py-2 bg-[#40E0D0] hover:bg-[#36cebe] text-[#1D3557] font-montserrat font-extrabold text-xs rounded-xl transition inline-flex items-center gap-1.5 shadow-xs"
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
                    <tr key={purchase.id} className="hover:bg-[#F8F9FA] transition group">
                      <td className="p-3.5">
                        <div className="font-mono font-black text-[#1D3557] text-xs flex items-center gap-1.5">
                          <Hash className="w-3.5 h-3.5 text-[#00BFFF]" />
                          <span>{purchase.invoice_number}</span>
                        </div>
                        {purchase.purchase_number && purchase.purchase_number !== purchase.invoice_number && (
                          <span className="text-[10px] text-gray-400 font-mono block">
                            Ref: {purchase.purchase_number}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-[#2B2D42] font-medium">
                          <Calendar className="w-3.5 h-3.5 text-[#00BFFF]" />
                          <span>{purchase.date}</span>
                        </div>
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-[#1D3557]">{purchase.provider_name || 'Proveedor General'}</div>
                        <div className="flex flex-wrap gap-1 mt-0.5 items-center">
                          {purchase.provider_rif && (
                            <span className="text-[10px] text-[#2B2D42]/60 font-mono">RIF: {purchase.provider_rif}</span>
                          )}
                          {purchase.payment_method && (
                            <span className="text-[8px] bg-[#1D3557]/10 text-[#1D3557] border border-[#1D3557]/20 font-black px-1.5 py-0.5 rounded uppercase">
                              {purchase.payment_method}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-[#1D3557]/10 text-[#1D3557] rounded-md font-black text-[11px]">
                            {itemsCount} {itemsCount === 1 ? 'ud.' : 'uds.'}
                          </span>
                          <span className="text-[11px] text-[#2B2D42]/70 truncate max-w-[180px]" title={purchase.items?.map(it => `${it.quantity}x ${it.product_name}`).join(', ')}>
                            {purchase.items?.length || 0} {purchase.items?.length === 1 ? 'producto' : 'productos'}
                          </span>
                        </div>
                      </td>

                      <td className="p-3.5 text-right font-mono font-black text-[#1D3557] text-xs">
                        ${totalUsd.toFixed(2)}
                      </td>

                      <td className="p-3.5 text-right font-mono font-bold text-[#2B2D42] text-xs">
                        Bs. {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td className="p-3.5 text-center">
                        {purchase.status === 'pendiente' ? (
                          <span className="px-2.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black rounded-full uppercase tracking-wider inline-flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            <span>Pendiente CXP</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-[#40E0D0]/20 border border-[#40E0D0]/40 text-[#1D3557] text-[10px] font-montserrat font-extrabold rounded-full uppercase tracking-wider inline-flex items-center gap-1">
                            <Check className="w-3 h-3 text-[#1D3557]" />
                            <span>Completada</span>
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedPurchaseDetail(purchase)}
                            className="p-1.5 text-[#2B2D42]/70 hover:text-[#1D3557] hover:bg-[#1D3557]/10 rounded-lg transition"
                            title="Ver Detalle de la Compra"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePrintVoucher(purchase)}
                            className="p-1.5 text-[#2B2D42]/70 hover:text-[#1D3557] hover:bg-[#40E0D0]/30 rounded-lg transition"
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
            <div className="p-4 sm:p-5 bg-[#1D3557] text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl backdrop-blur-xs">
                  <ShoppingBag className="w-5 h-5 text-[#40E0D0]" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-montserrat font-extrabold uppercase tracking-tight">Registrar Nueva Compra</h3>
                  <p className="text-[11px] text-[#40E0D0] font-medium">
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
              <div className="bg-[#F8F9FA] p-4 rounded-2xl border border-gray-200/80 space-y-4">
                <h4 className="text-xs font-montserrat font-extrabold text-[#1D3557] uppercase tracking-wider flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#00BFFF]" />
                  <span>1. Datos del Proveedor y Factura</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Selector de Proveedor */}
                  <div>
                    <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#2B2D42]/70 mb-1">
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
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
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
                    <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#2B2D42]/70 mb-1">
                      Factura N° / Control *
                    </label>
                    <input
                      type="text"
                      required
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="Ej: FAC-009842"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                    />
                  </div>

                  {/* Fecha de Compra */}
                  <div>
                    <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#2B2D42]/70 mb-1">
                      Fecha de la Factura *
                    </label>
                    <input
                      type="date"
                      required
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                    />
                  </div>
                </div>

                {/* Método de Pago y Financiación */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2 border-t border-gray-200">
                  {/* Método de Pago */}
                  <div className="sm:col-span-2 text-left">
                    <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#2B2D42]/70 mb-1">
                      Método de Pago *
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
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
                      <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#2B2D42]/70 mb-1">
                        Cantidad de Cuotas * (Máximo 6)
                      </label>
                      <select
                        value={installmentsCount}
                        onChange={(e) => setInstallmentsCount(Number(e.target.value))}
                        required
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
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
                  <div className="bg-[#1D3557]/5 border border-[#1D3557]/20 rounded-2xl p-4 space-y-3 pt-2 text-left">
                    <h5 className="text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#00BFFF]" />
                      <span>Calendario de Vencimientos de Cuotas (CXP)</span>
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {installments.map((inst, index) => (
                        <div key={inst.number} className="bg-white border border-gray-200 p-3 rounded-xl space-y-1.5 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] bg-[#1D3557]/10 text-[#1D3557] border border-[#1D3557]/20 px-1.5 py-0.5 rounded-md font-black">
                              Cuota #{inst.number}
                            </span>
                            <span className="text-[9px] text-[#2B2D42]/60 font-bold">Vence en {index * 15 + 15} días</span>
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[9px] font-bold text-[#2B2D42]/60 uppercase">Fecha de Vencimiento</label>
                            <input
                              type="date"
                              required
                              value={inst.due_date}
                              onChange={(e) => {
                                const newDate = e.target.value;
                                setInstallments(prev => prev.map(p => p.number === inst.number ? { ...p, due_date: newDate } : p));
                              }}
                              className="w-full px-2 py-1 bg-[#F8F9FA] border border-gray-200 rounded-lg text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-1 focus:ring-[#00BFFF]"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[9px] font-bold text-[#2B2D42]/60 uppercase">Monto (USD)</label>
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
                              className="w-full px-2 py-1 bg-[#F8F9FA] border border-gray-200 rounded-lg text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-1 focus:ring-[#00BFFF]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#1D3557] border-t border-[#1D3557]/20 pt-2 bg-[#1D3557]/5 px-1 rounded-md">
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
                      <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#2B2D42]/70 mb-1">
                        Nombre / Razón Social del Proveedor *
                      </label>
                      <input
                        type="text"
                        required
                        value={customProviderName}
                        onChange={(e) => setCustomProviderName(e.target.value)}
                        placeholder="Ej: Distribuidora Central C.A."
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#2B2D42]/70 mb-1">
                        RIF / Cédula del Proveedor
                      </label>
                      <input
                        type="text"
                        value={customProviderRif}
                        onChange={(e) => setCustomProviderRif(e.target.value)}
                        placeholder="Ej: J-12345678-0"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
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
                      className="w-4 h-4 text-[#1D3557] rounded focus:ring-[#00BFFF]"
                    />
                    <span className="text-xs font-bold text-[#2B2D42]">
                      Actualizar automáticamente el costo unitario (<code className="text-[#1D3557]">cost_price</code>) en la ficha del producto si varió.
                    </span>
                  </label>

                  <span className="text-[10px] font-bold text-gray-400 hidden sm:inline">
                    Lógica de Stock: Stock Nuevo = Actual + Comprado
                  </span>
                </div>
              </div>

              {/* SECTION 2: LISTA DINÁMICA DE PRODUCTOS A INGRESAR */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="text-xs font-montserrat font-extrabold text-[#1D3557] uppercase tracking-wider flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#00BFFF]" />
                    <span>2. Productos e Incremento de Inventario ({formItems.length})</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenQuickProductModal('', '')}
                      className="px-3 py-1.5 bg-[#005da9] hover:bg-[#004b88] text-white font-montserrat font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      title="Registrar un nuevo producto en el catálogo"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Registro de Producto</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAddItemRow}
                      className="px-3 py-1.5 bg-[#1D3557]/10 hover:bg-[#1D3557]/20 text-[#1D3557] font-montserrat font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 border border-[#1D3557]/20 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>+ Agregar Fila</span>
                    </button>
                  </div>
                </div>

                {/* Items Dynamic Rows */}
                <div className="space-y-3">
                  {formItems.map((item, index) => {
                    const rowSubtotal = Number(item.quantity || 0) * Number(item.unit_cost || 0);
                    const calculatedNewStock = Number(item.current_stock || 0) + Number(item.quantity || 0);
                    const rowQuery = rowSearchQueries[item.id] || '';
                    const isDropdownOpen = openSearchRowId === item.id;
                    const matchedProducts = getFilteredProductsForRow(rowQuery);

                    return (
                      <div 
                        key={item.id} 
                        className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs hover:border-gray-300 transition space-y-3"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                          {/* Fila # y Selector/Buscador de Producto Interactivo */}
                          <div className="sm:col-span-5 relative">
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[9px] font-black uppercase text-gray-500">
                                Producto {index + 1} *
                              </label>
                              <button
                                type="button"
                                onClick={() => handleOpenQuickProductModal(item.id, rowQuery)}
                                className="text-[9px] font-extrabold text-[#005da9] hover:text-[#004b88] hover:underline flex items-center gap-0.5 cursor-pointer"
                                title="Crear y registrar nuevo producto si no existe"
                              >
                                <Plus className="w-2.5 h-2.5 stroke-[3]" />
                                <span>Registrar Producto</span>
                              </button>
                            </div>

                            {/* CASO A: Producto ya seleccionado */}
                            {item.product_id ? (
                              <div className="flex items-center justify-between bg-[#F8F9FA] border border-[#005da9]/40 p-2 rounded-xl shadow-2xs">
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <div className="p-1.5 bg-[#005da9]/10 text-[#005da9] rounded-lg shrink-0">
                                    <Package className="w-4 h-4" />
                                  </div>
                                  <div className="truncate">
                                    <div className="text-xs font-bold text-[#1D3557] truncate" title={item.product_name}>
                                      {item.product_name}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[9px] text-gray-500 font-medium">
                                      {item.sku && <span className="bg-gray-200/80 px-1.5 py-0.2 rounded font-mono">SKU: {item.sku}</span>}
                                      <span className="font-bold text-emerald-700">Stock Actual: {item.current_stock}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleProductSelect(item.id, '');
                                      setOpenSearchRowId(item.id);
                                      setRowSearchQueries(prev => ({ ...prev, [item.id]: '' }));
                                    }}
                                    className="px-2 py-1 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 text-[10px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                                    title="Cambiar o buscar otro producto"
                                  >
                                    <Search className="w-3 h-3 text-[#005da9]" />
                                    <span>Cambiar</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* CASO B: Buscador interactivo en tiempo real con escritura progresiva */
                              <div className="relative">
                                <div className="relative">
                                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                  <input
                                    type="text"
                                    value={rowQuery}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setRowSearchQueries(prev => ({ ...prev, [item.id]: val }));
                                      setOpenSearchRowId(item.id);
                                    }}
                                    onFocus={() => setOpenSearchRowId(item.id)}
                                    placeholder="Escribe para buscar por nombre o SKU..."
                                    className="w-full pl-8 pr-7 py-2 bg-[#F8F9FA] border border-gray-300 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:bg-white"
                                  />
                                  {rowQuery && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRowSearchQueries(prev => ({ ...prev, [item.id]: '' }));
                                      }}
                                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>

                                {/* Menú Flotante Desplegable de Resultados de Búsqueda */}
                                {isDropdownOpen && (
                                  <>
                                    {/* Backdrop para cerrar al hacer click fuera */}
                                    <div 
                                      className="fixed inset-0 z-20"
                                      onClick={() => setOpenSearchRowId(null)}
                                    />

                                    <div className="absolute z-30 left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto divide-y divide-gray-100 text-left">
                                      {matchedProducts.length === 0 ? (
                                        /* ESTADO VACÍO: SI EL PRODUCTO NO EXISTE SE HABILITA BOTÓN DE REGISTRO */
                                        <div className="p-4 text-center space-y-2.5">
                                          <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                                            <AlertCircle className="w-4 h-4" />
                                          </div>
                                          <div>
                                            <p className="text-xs font-bold text-gray-800">
                                              Producto no encontrado
                                            </p>
                                            <p className="text-[11px] text-gray-500 mt-0.5">
                                              No existe ningún producto con: <span className="font-bold text-[#1D3557]">"{rowQuery}"</span>
                                            </p>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleOpenQuickProductModal(item.id, rowQuery)}
                                            className="w-full py-2 px-3 bg-[#005da9] hover:bg-[#004b88] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                                          >
                                            <Plus className="w-4 h-4 stroke-[3]" />
                                            <span>Registrar "{rowQuery}" como Producto</span>
                                          </button>
                                        </div>
                                      ) : (
                                        <div>
                                          <div className="px-3 py-1.5 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase flex justify-between items-center">
                                            <span>Resultados ({matchedProducts.length})</span>
                                            <button
                                              type="button"
                                              onClick={() => handleOpenQuickProductModal(item.id, rowQuery)}
                                              className="text-[#005da9] hover:underline font-extrabold flex items-center gap-0.5"
                                            >
                                              <Plus className="w-2.5 h-2.5 stroke-[3]" />
                                              <span>Nuevo Producto</span>
                                            </button>
                                          </div>
                                          {matchedProducts.map((prod) => (
                                            <button
                                              key={prod.id}
                                              type="button"
                                              onClick={() => {
                                                handleProductSelect(item.id, prod.id);
                                                setOpenSearchRowId(null);
                                                setRowSearchQueries(prev => ({ ...prev, [item.id]: '' }));
                                              }}
                                              className="w-full p-2.5 text-left hover:bg-blue-50/60 transition flex items-center justify-between gap-2 group cursor-pointer"
                                            >
                                              <div className="truncate">
                                                <div className="text-xs font-bold text-gray-900 group-hover:text-[#005da9] truncate">
                                                  {prod.name}
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5 font-medium">
                                                  {prod.sku && <span className="font-mono bg-gray-100 px-1 py-0.2 rounded text-[9px]">SKU: {prod.sku}</span>}
                                                  <span>Stock Actual: <strong className="text-gray-700">{prod.stock || 0}</strong></span>
                                                </div>
                                              </div>
                                              <div className="text-right shrink-0">
                                                <span className="text-[11px] font-mono font-bold text-[#1D3557]">
                                                  Costo: ${Number(prod.cost_price || prod.price || 0).toFixed(2)}
                                                </span>
                                              </div>
                                            </button>
                                          ))}

                                          {/* Pie del menú con opción de registro */}
                                          <div className="p-2 bg-gray-50/80 flex items-center justify-between border-t border-gray-100">
                                            <span className="text-[10px] text-gray-500 font-medium">¿Es un producto nuevo?</span>
                                            <button
                                              type="button"
                                              onClick={() => handleOpenQuickProductModal(item.id, rowQuery)}
                                              className="px-2 py-1 bg-[#005da9]/10 hover:bg-[#005da9]/20 text-[#005da9] text-[10px] font-extrabold rounded-lg transition flex items-center gap-1 cursor-pointer"
                                            >
                                              <Plus className="w-3 h-3 stroke-[3]" />
                                              <span>Registrar Producto</span>
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
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
                              className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-mono font-black text-[#1D3557] focus:outline-none focus:ring-2 focus:ring-[#00BFFF] text-center"
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
                                className="w-full pl-6 pr-2 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-mono font-black text-[#1D3557] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                              />
                            </div>
                          </div>

                          {/* Subtotal */}
                          <div className="sm:col-span-2 text-right">
                            <label className="block text-[9px] font-black uppercase text-gray-400 mb-1">
                              Subtotal
                            </label>
                            <div className="font-mono font-black text-[#1D3557] text-xs py-2">
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
                          <div className="bg-[#1D3557]/5 p-2 rounded-xl flex items-center justify-between text-[11px] border border-[#1D3557]/10">
                            <div className="flex items-center gap-2">
                              <span className="text-[#2B2D42]/70 font-medium">Actualización de Inventario:</span>
                              <span className="font-mono font-bold text-[#2B2D42] bg-white px-2 py-0.5 rounded border border-gray-200">
                                Stock Actual: {item.current_stock}
                              </span>
                              <span className="text-[#1D3557] font-bold">+</span>
                              <span className="font-mono font-bold text-[#1D3557] bg-[#1D3557]/10 px-2 py-0.5 rounded">
                                Comprado: {item.quantity}
                              </span>
                              <span className="text-gray-400 font-bold">➔</span>
                              <span className="font-mono font-black text-[#1D3557] bg-[#40E0D0]/30 px-2.5 py-0.5 rounded flex items-center gap-1">
                                <Check className="w-3 h-3 text-[#1D3557]" />
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
                  <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#2B2D42]/70 mb-1">
                    Notas u Observaciones (Opcional)
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Detalles sobre entrega, crédito, forma de pago u observaciones..."
                    className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-medium text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                  />
                </div>

                <div className="bg-[#1D3557] text-white p-4 rounded-2xl flex flex-col justify-between shadow-md">
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-gray-200">
                      <span>Artículos Totales a Ingresar:</span>
                      <span className="font-mono font-black text-[#40E0D0]">{formCalculations.totalItemsCount} unidades</span>
                    </div>
                    {bcvRate > 0 && (
                      <div className="flex justify-between text-gray-300 text-[11px]">
                        <span>Tasa BCV Aplicable:</span>
                        <span className="font-mono">Bs. {bcvRate.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-white/20 pt-2.5 mt-2 flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] font-montserrat font-extrabold uppercase tracking-wider text-gray-300 block">
                        TOTAL FACTURA DE COMPRA
                      </span>
                      <span className="text-xl font-black font-mono text-[#40E0D0]">
                        ${formCalculations.totalAmountUsd.toFixed(2)} USD
                      </span>
                    </div>
                    {bcvRate > 0 && (
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-gray-200 block">
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
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#2B2D42] text-xs font-montserrat font-extrabold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-[#40E0D0] hover:bg-[#36cebe] text-[#1D3557] text-xs font-montserrat font-extrabold rounded-xl transition shadow-lg hover:shadow-xl uppercase tracking-wider flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#1D3557]" />
                      <span>Actualizando Inventario...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3] text-[#1D3557]" />
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
            <div className="p-4 bg-[#1D3557] text-white flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 text-[#40E0D0] rounded-xl">
                  <FileText className="w-5 h-5 text-[#40E0D0]" />
                </div>
                <div>
                  <h3 className="text-xs font-montserrat font-extrabold text-white uppercase tracking-tight">
                    Detalle de Compra: Factura #{selectedPurchaseDetail.invoice_number}
                  </h3>
                  <span className="text-[10px] text-[#40E0D0] font-mono">
                    Fecha: {selectedPurchaseDetail.date} | Ref: {selectedPurchaseDetail.purchase_number || selectedPurchaseDetail.id}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedPurchaseDetail(null)}
                className="p-1.5 hover:bg-white/20 text-white rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Provider info card */}
              <div className="bg-[#1D3557]/5 p-3.5 rounded-2xl border border-[#1D3557]/10 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-montserrat font-extrabold uppercase text-[#2B2D42]/60 block">Proveedor</span>
                  <h4 className="font-bold text-xs text-[#1D3557]">{selectedPurchaseDetail.provider_name}</h4>
                  {selectedPurchaseDetail.provider_rif && (
                    <span className="text-[10px] text-[#2B2D42]/70 font-mono">RIF: {selectedPurchaseDetail.provider_rif}</span>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[9px] font-montserrat font-extrabold uppercase text-[#2B2D42]/60 block">Estado</span>
                  <span className={`px-2.5 py-0.5 text-[10px] font-montserrat font-extrabold rounded-full uppercase ${
                    selectedPurchaseDetail.status === 'pendiente' 
                      ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                      : 'bg-[#40E0D0]/20 text-[#1D3557] border border-[#40E0D0]/40'
                  }`}>
                    {selectedPurchaseDetail.status || 'Completada'}
                  </span>
                </div>
              </div>

              {/* Payment Method & CXP Installments Info */}
              <div className="bg-[#F8F9FA] border border-gray-150 p-3.5 rounded-2xl text-left space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <div>
                    <span className="text-[9px] font-montserrat font-extrabold uppercase text-[#2B2D42]/60 block">Método de Pago</span>
                    <span className="font-bold text-[#1D3557]">{selectedPurchaseDetail.payment_method || 'Efectivo USD'}</span>
                  </div>
                  {selectedPurchaseDetail.payment_status && (
                    <div className="text-right">
                      <span className="text-[9px] font-montserrat font-extrabold uppercase text-[#2B2D42]/60 block">Pago de Compra</span>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-montserrat font-extrabold uppercase ${
                        selectedPurchaseDetail.payment_status === 'pendiente'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-[#40E0D0]/20 text-[#1D3557] border border-[#40E0D0]/40'
                      }`}>
                        {selectedPurchaseDetail.payment_status === 'pendiente' ? 'Pendiente / Crédito' : 'Pagado'}
                      </span>
                    </div>
                  )}
                </div>

                {/* List of installments if credit */}
                {selectedPurchaseDetail.payment_method === 'Crédito / CXP' && selectedPurchaseDetail.installments && selectedPurchaseDetail.installments.length > 0 && (
                  <div className="pt-2 border-t border-gray-200 space-y-2">
                    <span className="text-[9px] font-montserrat font-extrabold uppercase text-[#1D3557] block">Calendario de Cuotas (Cuentas por Pagar)</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {selectedPurchaseDetail.installments.map((inst: any, idx: number) => (
                        <div key={idx} className="bg-white p-2 border border-gray-150 rounded-xl space-y-1 text-[11px]">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-[#1D3557]">Cuota #{inst.number}</span>
                            <span className={`text-[8px] font-black px-1.5 rounded-full uppercase ${
                              inst.status === 'pagado' ? 'bg-[#40E0D0]/30 text-[#1D3557]' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {inst.status}
                            </span>
                          </div>
                          <div className="text-[#2B2D42]/70 font-medium font-mono text-[10px]">Vence: {inst.due_date}</div>
                          <div className="font-mono font-black text-[#1D3557]">${Number(inst.amount).toFixed(2)} USD</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Items Breakdown Table */}
              <div>
                <h4 className="text-xs font-montserrat font-extrabold text-[#1D3557] uppercase tracking-wider mb-2">
                  Productos y Cantidades Compradas
                </h4>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#1D3557] text-white font-montserrat font-extrabold uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5">Producto</th>
                        <th className="p-2.5 text-center">Cant.</th>
                        <th className="p-2.5 text-right">Costo Unit.</th>
                        <th className="p-2.5 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium">
                      {(selectedPurchaseDetail.items || []).map((it, idx) => (
                        <tr key={idx} className="hover:bg-[#F8F9FA]">
                          <td className="p-2.5">
                            <div className="font-bold text-[#1D3557]">{it.product_name}</div>
                            {it.sku && <div className="text-[10px] text-[#2B2D42]/60 font-mono">SKU: {it.sku}</div>}
                          </td>
                          <td className="p-2.5 text-center font-mono font-black text-[#00BFFF]">
                            +{it.quantity}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-[#2B2D42]">
                            ${Number(it.unit_cost || 0).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono font-black text-[#1D3557]">
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
                <div className="bg-[#F8F9FA] p-3 rounded-xl border border-gray-200 text-xs text-[#2B2D42]">
                  <strong>Notas:</strong> {selectedPurchaseDetail.notes}
                </div>
              )}

              {/* Total Card */}
              <div className="bg-[#1D3557] text-white p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-montserrat font-extrabold uppercase text-gray-300 block">Total de la Compra</span>
                  <span className="text-xl font-mono font-black text-[#40E0D0]">
                    ${Number(selectedPurchaseDetail.total_amount || 0).toFixed(2)} USD
                  </span>
                </div>
                {bcvRate > 0 && (
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-gray-200 block">
                      Bs. {(Number(selectedPurchaseDetail.total_amount || 0) * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-[#F8F9FA] border-t border-gray-100 flex justify-between items-center">
              <button
                onClick={() => handlePrintVoucher(selectedPurchaseDetail)}
                className="px-4 py-2 bg-[#40E0D0] hover:bg-[#36cebe] text-[#1D3557] text-xs font-montserrat font-extrabold rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4 text-[#1D3557]" />
                <span>Imprimir Comprobante</span>
              </button>

              <button
                onClick={() => setSelectedPurchaseDetail(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-[#2B2D42] text-xs font-montserrat font-extrabold rounded-xl transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: AÑADIR NUEVO PRODUCTO (DISEÑO EXACTO DEL CATÁLOGO)                 */}
      {/* ========================================================================= */}
      {showQuickProductModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-[#005da9]/20 w-full max-w-2xl shadow-2xl overflow-hidden text-left flex flex-col my-auto max-h-[94vh]">
            {/* Modal Header (Frenyer Brand Gradient) */}
            <div className="p-4 bg-gradient-to-r from-[#1D3557] via-[#005da9] to-[#1D3557] text-white flex justify-between items-center shrink-0 border-b border-[#005da9]/30 shadow-md">
              <div className="flex items-center gap-2.5">
                <Package className="w-5 h-5 text-[#40E0D0]" />
                <h3 className="text-sm sm:text-base font-montserrat font-extrabold uppercase tracking-wide">
                  Añadir Nuevo Producto
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isSavingQuickProduct) setShowQuickProductModal(false);
                }}
                disabled={isSavingQuickProduct}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveQuickProduct} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs text-[#2B2D42]">
              {/* Row 1: SKU & Nombre */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4">
                  <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">
                    Código SKU
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      required
                      value={prodSku}
                      onChange={(e) => setProdSku(e.target.value)}
                      placeholder="PRD-XXXXXX"
                      className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-300 rounded-lg font-mono font-bold text-[#1D3557] focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:border-[#005da9] transition"
                    />
                    <button
                      type="button"
                      onClick={() => setProdSku(`PRD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`)}
                      title="Generar nuevo SKU"
                      className="p-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-[#005da9] cursor-pointer transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-8">
                  <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">
                    Nombre Completo del Producto *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    placeholder="Ej: Teclado Mecánico RGB Redragon Kumara K552"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg font-semibold text-[#1D3557] focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:border-[#005da9] transition"
                  />
                </div>
              </div>

              {/* Row 2: Descripción */}
              <div>
                <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">
                  Descripción y Detalles del Producto
                </label>
                <textarea
                  rows={2}
                  value={prodDescription}
                  onChange={(e) => setProdDescription(e.target.value)}
                  placeholder="Especificaciones, funcionalidades, para qué sirve, etc."
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:border-[#005da9] resize-y transition"
                />
              </div>

              {/* Row 3: Precios (Costo, Margen, Precio Final) */}
              <div className="bg-[#F8F9FA] p-3.5 rounded-xl border border-gray-200 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">
                      Precio Costo ($ USD) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={prodCostPrice}
                      onChange={(e) => handleCostChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg font-mono font-bold text-[#1D3557] focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:border-[#005da9] transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">
                      % Ganancia *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        required
                        value={prodMargin1}
                        onChange={(e) => handleMarginChange(e.target.value)}
                        className="w-full pl-3 pr-7 py-2 bg-white border border-gray-300 rounded-lg font-mono font-bold text-[#1D3557] focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:border-[#005da9] transition"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs pointer-events-none">
                        %
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">
                      Precio Final Ventas *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={prodPrice}
                      onChange={(e) => handlePriceChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg font-mono font-extrabold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:border-[#005da9] transition"
                    />
                  </div>
                </div>

                {/* Badge ganancia neta */}
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/60 w-fit">
                  <span>💡 Ganancia neta:</span>
                  <span className="font-mono font-black">
                    ${(Math.max(0, (parseFloat(String(prodPrice)) || 0) - (parseFloat(String(prodCostPrice)) || 0))).toFixed(2)} USD
                  </span>
                </div>
              </div>

              {/* Row 4: Oferta, Stock, Unidades */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">
                    Precio Oferta
                  </label>
                  <input
                    type="text"
                    value={prodOfferPrice}
                    onChange={(e) => setProdOfferPrice(e.target.value)}
                    placeholder="Ninguno"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg font-mono font-bold text-red-600 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:border-[#005da9] transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">
                    Stock Actual *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={prodStock}
                    onChange={(e) => setProdStock(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg font-mono font-bold text-[#1D3557] focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:border-[#005da9] transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">
                    Unidades *
                  </label>
                  <select
                    value={prodUnit}
                    onChange={(e) => setProdUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg font-bold text-[#1D3557] focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:border-[#005da9] transition"
                  >
                    <option value="Unidad">Unidad</option>
                    <option value="Pieza">Pieza</option>
                    <option value="Paquete">Paquete</option>
                    <option value="Caja">Caja</option>
                    <option value="Docena">Docena</option>
                    <option value="Kilogramo">Kilogramo</option>
                    <option value="Gramo">Gramo</option>
                    <option value="Litro">Litro</option>
                    <option value="Mililitro">Mililitro</option>
                    <option value="Metro">Metro</option>
                    <option value="Centímetro">Centímetro</option>
                    <option value="Rollo">Rollo</option>
                    <option value="Set / Juego">Set / Juego</option>
                    <option value="Bulto">Bulto</option>
                    <option value="Resma">Resma</option>
                  </select>
                </div>
              </div>

              {/* Row 5: Categoría & Marca */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">
                    Categoría del Catálogo *
                  </label>
                  <select
                    value={prodCategoryId}
                    onChange={(e) => setProdCategoryId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg font-semibold text-[#1D3557] focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:border-[#005da9] transition"
                  >
                    <option value="">Seleccione Categoría</option>
                    {categoriesList.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">
                    Marca o Fabricante
                  </label>
                  <select
                    value={prodBrandId}
                    onChange={(e) => setProdBrandId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg font-semibold text-[#1D3557] focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:border-[#005da9] transition"
                  >
                    <option value="">Genérico / Sin Marca</option>
                    {brandsList.map(brand => (
                      <option key={brand.id} value={brand.id}>{brand.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 6: Stock Crítico & Ubicación */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">
                    Stock Crítico *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={prodCriticalStock}
                    onChange={(e) => setProdCriticalStock(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg font-mono font-bold text-red-600 focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:border-[#005da9] transition"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Umbral mínimo de alerta para reabastecimiento
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">
                    Ubicación *
                  </label>
                  <select
                    value={prodLocation}
                    onChange={(e) => setProdLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg font-bold text-[#1D3557] focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:border-[#005da9] transition"
                  >
                    {branchesList.map(branch => {
                      const branchText = branch.code ? `${branch.name} (${branch.code})` : branch.name;
                      return <option key={branch.id} value={branchText}>{branchText}</option>;
                    })}
                    {branchesList.length === 0 && (
                      <option value="Tienda Bella Vista (SP-01)">Tienda Bella Vista (SP-01)</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Row 7: Impuesto & Fecha de Expiración */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">
                    Impuesto *
                  </label>
                  <select
                    value={prodTaxId}
                    onChange={(e) => {
                      const selId = e.target.value;
                      setProdTaxId(selId);
                      const tax = taxesList.find(t => t.id === selId);
                      setProdTaxRate(tax ? tax.rate : 0);
                    }}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg font-bold text-[#1D3557] focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:border-[#005da9] transition"
                  >
                    <option value="exento">Exento / Sin Impuesto (0%)</option>
                    {taxesList.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.rate}%)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">
                    Fecha Expiración (Opcional)
                  </label>
                  <input
                    type="date"
                    value={prodExpirationDate}
                    onChange={(e) => setProdExpirationDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-[#1D3557] focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:border-[#005da9] transition"
                  />
                </div>
              </div>

              {/* Row 8: Gestión de Imágenes del Producto */}
              <div className="border border-gray-200 rounded-xl p-3.5 space-y-3 bg-[#F8F9FA]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557]">
                    Gestión de Imágenes del Producto
                  </span>
                  <div className="flex items-center bg-gray-200 p-0.5 rounded-lg text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setProdImageMode('upload')}
                      className={`px-3 py-1 rounded-md transition cursor-pointer ${
                        prodImageMode === 'upload' 
                          ? 'bg-[#005da9] text-white shadow-2xs' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Subir Archivos (Opción 1 y 2)
                    </button>
                    <button
                      type="button"
                      onClick={() => setProdImageMode('url')}
                      className={`px-3 py-1 rounded-md transition cursor-pointer ${
                        prodImageMode === 'url' 
                          ? 'bg-[#005da9] text-white shadow-2xs' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Cargar Enlaces (Opción 3)
                    </button>
                  </div>
                </div>

                {prodImageMode === 'upload' ? (
                  <div className="space-y-3">
                    {/* Upload Drop Area */}
                    <div 
                      onClick={() => prodFileInputRef.current?.click()}
                      className="border-2 border-dashed border-[#00BFFF]/60 hover:border-[#005da9] bg-[#00BFFF]/5 hover:bg-[#00BFFF]/10 rounded-xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1.5"
                    >
                      <Upload className="w-6 h-6 text-[#005da9]" />
                      <p className="text-xs font-bold text-[#1D3557]">
                        Haz clic o arrastra imágenes aquí (Máximo 3)
                      </p>
                      <p className="text-[10px] text-gray-400">
                        Formatos soportados: JPG, PNG, WEBP, GIF
                      </p>
                      <input 
                        ref={prodFileInputRef}
                        type="file" 
                        accept="image/*" 
                        multiple 
                        className="hidden" 
                        onChange={(e) => handleImageFilesChange(e.target.files)}
                      />
                    </div>

                    {/* Hidden input for replacing an individual slot */}
                    <input 
                      ref={prodReplaceInputRef}
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        if (slotReplaceIndex !== null && e.target.files?.[0]) {
                          handleReplaceUploadedImage(slotReplaceIndex, e.target.files[0]);
                        }
                      }}
                    />

                    {isUploadingImages && (
                      <div className="flex items-center justify-center gap-2 py-2 text-xs font-bold text-[#005da9]">
                        <div className="w-4 h-4 border-2 border-[#005da9] border-t-transparent rounded-full animate-spin"></div>
                        <span>Subiendo imágenes a Supabase Storage...</span>
                      </div>
                    )}

                    {/* Image slots preview */}
                    {prodUploadedImages.length > 0 && (
                      <div className="grid grid-cols-3 gap-2.5 pt-1">
                        {prodUploadedImages.map((imgUrl, idx) => (
                          <div key={idx} className="relative group border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs aspect-square flex flex-col">
                            <img 
                              src={imgUrl} 
                              alt={`Slot ${idx + 1}`} 
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setSlotReplaceIndex(idx);
                                  prodReplaceInputRef.current?.click();
                                }}
                                className="p-1.5 bg-white text-[#1D3557] rounded-lg hover:bg-gray-100 shadow-xs text-[10px] font-bold cursor-pointer"
                                title="Cambiar imagen"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveUploadedImage(idx)}
                                className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-xs text-[10px] font-bold cursor-pointer"
                                title="Eliminar imagen"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <span className="absolute bottom-1 left-1 bg-[#1D3557]/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                              Foto {idx + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">
                      URL(s) de Imágenes Públicas (Separadas por coma)
                    </label>
                    <input
                      type="text"
                      value={prodImageUrl}
                      onChange={(e) => setProdImageUrl(e.target.value)}
                      placeholder="https://ejemplo.com/foto1.jpg, https://ejemplo.com/foto2.jpg"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:border-[#005da9] transition"
                    />
                  </div>
                )}
              </div>

              {/* Row 9: Ficha Técnica & Código de Barras */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">
                    Enlace de Ficha Técnica PDF Oficial (Opcional)
                  </label>
                  <input
                    type="url"
                    value={prodTechUrl}
                    onChange={(e) => setProdTechUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:border-[#005da9] transition"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557]">
                      Código de Barras / QR (Opcional)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowProductFormScanner(true)}
                      className="text-[10px] font-black text-[#005da9] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>📷 Escanear</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={prodBarcodeQr}
                    onChange={(e) => setProdBarcodeQr(e.target.value)}
                    placeholder="Ej: 759123456789"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg font-mono text-xs text-[#1D3557] focus:outline-none focus:ring-2 focus:ring-[#005da9] focus:border-[#005da9] transition"
                  />
                </div>
              </div>

              {/* Row 10: Switches / Checkboxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-200">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={prodFeatured}
                    onChange={(e) => setProdFeatured(e.target.checked)}
                    className="w-4 h-4 text-[#005da9] rounded focus:ring-[#005da9] accent-[#005da9]"
                  />
                  <span className="font-bold text-[#1D3557] text-xs">
                    Destacar en Inicio (Oferta Principal)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={prodActive}
                    onChange={(e) => setProdActive(e.target.checked)}
                    className="w-4 h-4 text-[#005da9] rounded focus:ring-[#005da9] accent-[#005da9]"
                  />
                  <span className="font-bold text-[#1D3557] text-xs">
                    Activo y Visible en Catálogo Público
                  </span>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowQuickProductModal(false)}
                  disabled={isSavingQuickProduct}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#2B2D42] text-xs font-montserrat font-bold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingQuickProduct}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#005da9] to-[#1D3557] hover:from-[#004b88] hover:to-[#152740] text-white text-xs font-montserrat font-extrabold rounded-xl transition flex items-center gap-2 shadow-md hover:shadow-lg cursor-pointer disabled:opacity-50 border-b-2 border-[#1D3557]/30"
                >
                  {isSavingQuickProduct ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Guardando Producto...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Guardar Producto</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal for the Product Creation Form */}
      {showProductFormScanner && (
        <BarcodeScannerModal
          products={products}
          onClose={() => setShowProductFormScanner(false)}
          onCodeScanned={(code) => {
            setProdBarcodeQr(code);
            setShowProductFormScanner(false);
          }}
        />
      )}
    </div>
  );
}
