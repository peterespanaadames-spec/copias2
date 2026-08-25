/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { 
  Package, CheckCircle2, AlertTriangle, 
  Settings, Phone, ArrowUp, ArrowRight, Info, ShieldAlert, Lock, Bell, ClipboardList, ShoppingCart, Clock, Globe, Home, Search, User, DollarSign, LayoutDashboard
} from 'lucide-react';
import { Category, Brand, Product, ProductImage, CartItem, Order, StoreUser, AdminMenuType } from './types';
import { dbService } from './lib/supabase.ts';
import Navbar from './components/Navbar.tsx';
import Sidebar from './components/Sidebar.tsx';
import ProductCard from './components/ProductCard.tsx';
import AmazonCarousel from './components/AmazonCarousel.tsx';
import { CurrencyCode, DEFAULT_RATES, getSavedCurrency, saveCurrency } from './lib/currency';
import { useI18n } from './lib/i18n.ts';

// 🚀 Lazy-Loaded Heavy Components & Modals for Instant Page Speed
const AdminPanel = lazy(() => import('./components/AdminPanel.tsx'));
const ProductDetailModal = lazy(() => import('./components/ProductDetailModal.tsx'));
const SettingsModal = lazy(() => import('./components/SettingsModal.tsx'));
const CartDrawer = lazy(() => import('./components/CartDrawer.tsx'));
const InfoModal = lazy(() => import('./components/InfoModal.tsx'));
const OrderTrackingModal = lazy(() => import('./components/OrderTrackingModal.tsx'));
const TortaTresLechesLanding = lazy(() => import('./components/TortaTresLechesLanding.tsx'));
const BarcodeScannerModal = lazy(() => import('./components/BarcodeScannerModal.tsx'));
const LoginModal = lazy(() => import('./components/LoginModal.tsx'));
const CustomerDashboardModal = lazy(() => import('./components/CustomerDashboardModal.tsx'));
const MobileCurrencyModal = lazy(() => import('./components/MobileCurrencyModal.tsx'));

const ModalSuspenseFallback = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs select-none pointer-events-none">
    <div className="bg-white/95 dark:bg-slate-900/95 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-2xl flex items-center gap-3">
      <div className="w-5 h-5 border-2 border-[#FF9900] border-t-transparent rounded-full animate-spin"></div>
      <span className="text-xs font-black text-gray-800 dark:text-gray-200 uppercase tracking-wider">Cargando...</span>
    </div>
  </div>
);

const AdminSuspenseFallback = () => (
  <div className="min-h-[450px] flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm text-center select-none animate-fadeIn my-4">
    <div className="w-10 h-10 border-3 border-[#FF9900]/30 border-t-[#FF9900] rounded-full animate-spin mb-4"></div>
    <h3 className="text-sm font-black uppercase tracking-wider text-gray-900 dark:text-gray-100">Iniciando Panel de Administración</h3>
    <p className="text-xs text-gray-500 mt-1 font-semibold">Cargando módulos de gestión en tiempo real...</p>
  </div>
);

export default function App() {
  const { t } = useI18n();
  // Multi-Currency State
  const [activeCurrency, setActiveCurrency] = useState<CurrencyCode>('VES');
  const [currencyRates, setCurrencyRates] = useState<Record<CurrencyCode, number>>(DEFAULT_RATES);

  const handleCurrencyChange = useCallback((newCurrency: CurrencyCode) => {
    setActiveCurrency(newCurrency);
    // Deliberately not saving to localStorage so it always resets to VES on reload
  }, []);

  // Listen for currency change events from any part of the app
  useEffect(() => {
    const handleCustomCurrencyEvent = (e: any) => {
      if (e.detail && ['USD', 'VES', 'EUR', 'COP'].includes(e.detail)) {
        setActiveCurrency(e.detail as CurrencyCode);
      }
    };
    window.addEventListener('bellavista_currency_changed', handleCustomCurrencyEvent);
    return () => {
      window.removeEventListener('bellavista_currency_changed', handleCustomCurrencyEvent);
    };
  }, []);

  // Load currency rates from database on mount
  useEffect(() => {
    const loadRates = async () => {
      try {
        const newRates = { ...DEFAULT_RATES };
        
        // 1. Load general currency rates
        const rates = await dbService.getAllCurrencyRates();
        if (rates && rates.length > 0) {
          rates.forEach((r: any) => {
            if (r.code in newRates) {
              newRates[r.code as CurrencyCode] = r.rate;
            }
          });
        }

        // 2. Query and overlay the latest specific BCV rate from the bcv_rates table
        const latestBcv = await dbService.getLatestBcvRate();
        if (latestBcv && latestBcv.rate) {
          newRates.VES = latestBcv.rate;
        }

        setCurrencyRates(newRates);
      } catch (err) {
        console.error("Error loading currency rates:", err);
      }
    };
    loadRates();
  }, []);

  // Keep ratesRef up to date for background interval checking
  const ratesRef = useRef<Record<CurrencyCode, number>>(currencyRates);
  useEffect(() => {
    ratesRef.current = currencyRates;
  }, [currencyRates]);

  const checkAndAutoUpdateDolarRate = useCallback(async () => {
    try {
      // 1. Get current America/Caracas date and time via robust timezone-independent math (UTC-4)
      const now = new Date();
      const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
      const caracasOffset = -4 * 60 * 60 * 1000;
      const caracasTime = new Date(utcTime + caracasOffset);
      
      const year = caracasTime.getUTCFullYear();
      const month = caracasTime.getUTCMonth() + 1;
      const day = caracasTime.getUTCDate();
      const hour = caracasTime.getUTCHours();
      const minute = caracasTime.getUTCMinutes();
      
      // Checkpoints requested: "8:00 am, 11:50am, 2:30am, 6:00pm, 8:30 pm"
      // Represented in 24h format:
      // 2:30 am -> "02:30"
      // 8:00 am -> "08:00"
      // 11:50 am -> "11:50"
      // 6:00 pm -> "18:00"
      // 8:30 pm -> "20:30"
      const checkTimes = ["02:30", "08:00", "11:50", "18:00", "20:30"];
      
      const formatDateStr = (y: number, m: number, d: number) => {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      };
      
      let latestCheckpointKey = "";
      const todayStr = formatDateStr(year, month, day);
      
      // Find today's passed checkpoints
      const passedToday = checkTimes.filter(t => {
        const [ch, cm] = t.split(":").map(Number);
        if (hour > ch) return true;
        if (hour === ch && minute >= cm) return true;
        return false;
      });
      
      if (passedToday.length > 0) {
        const lastT = passedToday[passedToday.length - 1];
        latestCheckpointKey = `dolar_checkpoint_${todayStr}_${lastT}`;
      } else {
        // None passed today, get yesterday's last checkpoint (20:30)
        const yesterday = new Date(utcTime - (24 * 60 * 60 * 1000) + caracasOffset);
        const yYear = yesterday.getUTCFullYear();
        const yMonth = yesterday.getUTCMonth() + 1;
        const yDay = yesterday.getUTCDate();
        
        const yesterdayStr = formatDateStr(yYear, yMonth, yDay);
        latestCheckpointKey = `dolar_checkpoint_${yesterdayStr}_20:30`;
      }
      
      // Check if we have already successfully run the check for this checkpoint
      const lastChecked = localStorage.getItem('copias_bellavista_last_dolar_checkpoint');
      if (lastChecked === latestCheckpointKey) {
        return;
      }
      
      console.log(`Checking official dollar rate from DolarAPI for checkpoint: ${latestCheckpointKey}`);
      const res = await fetch('https://ve.dolarapi.com/v1/dolares');
      if (!res.ok) {
        throw new Error(`DolarAPI response error: ${res.status}`);
      }
      
      const data = await res.json();
      if (Array.isArray(data)) {
        const oficial = data.find((item: any) => item && item.fuente === 'oficial');
        if (oficial && typeof oficial.promedio === 'number') {
          const fetchedRate = oficial.promedio;
          const currentDbVES = ratesRef.current.VES;
          
          if (fetchedRate > currentDbVES) {
            console.log(`New higher official dollar rate detected! Current DB: ${currentDbVES}, New Fetch: ${fetchedRate}. Updating database & local state to the higher value...`);
            try {
              await dbService.updateCurrencyRate('VES', fetchedRate, 'Sistema (DolarAPI Auto)');
            } catch (dbErr) {
              console.warn("Could not save new rate to DB (unauthenticated guest session or RLS policy), updating UI locally:", dbErr);
            }
            
            setCurrencyRates(prev => ({
              ...prev,
              VES: fetchedRate
            }));
          } else {
            console.log(`Current DB dollar rate (${currentDbVES}) is greater than or equal to official rate (${fetchedRate}). Keeping the higher value.`);
          }
          
          localStorage.setItem('copias_bellavista_last_dolar_checkpoint', latestCheckpointKey);
        }
      }
    } catch (e) {
      console.error("Error auto-updating dollar rate:", e);
    }
  }, []);

  // Auto-Update Dolar Rate on Mount and periodic intervals + Normalize database emails to lowercase
  useEffect(() => {
    dbService.normalizeAllUserEmailsToLowerCase();

    const initialTimer = setTimeout(() => {
      checkAndAutoUpdateDolarRate();
    }, 2000);

    const intervalTimer = setInterval(() => {
      checkAndAutoUpdateDolarRate();
    }, 60000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, [checkAndAutoUpdateDolarRate]);

  // Update a currency rate and persist to database
  const updateCurrencyRate = async (code: string, rate: number) => {
    try {
      let finalRate = rate;
      if (code === 'VES') {
        try {
          const res = await fetch('https://ve.dolarapi.com/v1/dolares');
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              const oficial = data.find((item: any) => item && item.fuente === 'oficial');
              if (oficial && typeof oficial.promedio === 'number') {
                const fetchedRate = oficial.promedio;
                if (fetchedRate > rate) {
                  finalRate = fetchedRate;
                  alert(`Aviso: La tasa oficial de DolarAPI (Bs. ${fetchedRate.toFixed(2)}) es superior a la ingresada (Bs. ${rate.toFixed(2)}). Se mantendrá la tasa de mayor valor (Bs. ${fetchedRate.toFixed(2)}) en el sistema.`);
                } else {
                  console.log(`Tasa ingresada (${rate}) es mayor o igual a la de DolarAPI (${fetchedRate}). Manteniendo la de mayor valor.`);
                }
              }
            }
          }
        } catch (apiErr) {
          console.warn("No se pudo consultar DolarAPI para comparación de tasa, guardando la ingresada:", apiErr);
        }
      }

      await dbService.updateCurrencyRate(code, finalRate, 'Pedro (Admin)');
      setCurrencyRates(prev => ({
        ...prev,
        [code as CurrencyCode]: finalRate
      }));
    } catch (err) {
      console.error("Error updating currency rate:", err);
      alert("Error al actualizar la tasa de cambio.");
    }
  };

  // Database states
  const [products, setProducts] = useState<Product[]>([]);
  const [allProductsForCarousel, setAllProductsForCarousel] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [loading, setLoading] = useState(true);

  // Tracking Order States
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [hasSavedOrder, setHasSavedOrder] = useState(false);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);
  const [adminTab, setAdminTab] = useState<'products' | 'categories' | 'brands' | 'orders'>('orders');
  const [adminMenu, setAdminMenu] = useState<AdminMenuType>('orders');

  const checkAdminOrders = async () => {
    try {
      const data = await dbService.getOrders();
      setAdminOrders(data || []);
    } catch (err) {
      console.error("Error fetching admin orders in App.tsx:", err);
    }
  };

  const checkActiveOrders = async () => {
    const savedIdsStr = localStorage.getItem('copias_bellavista_order_ids');
    const lastId = localStorage.getItem('copias_bellavista_last_order_id');
    
    let ids: string[] = [];
    if (savedIdsStr) {
      try {
        ids = JSON.parse(savedIdsStr);
      } catch (_) {}
    }
    if (lastId && !ids.includes(lastId)) {
      ids.push(lastId);
    }

    if (ids.length === 0) {
      setActiveOrders([]);
      setHasSavedOrder(false);
      return;
    }

    try {
      const ordersData = await Promise.all(
        ids.map(async (id) => {
          try {
            return await dbService.getOrder(id);
          } catch (err) {
            console.error(`Error fetching order ${id}:`, err);
            return null;
          }
        })
      );

      const active = ordersData.filter((o): o is Order => {
        if (!o) return false;
        const status = (o.status || '').toLowerCase();
        return status !== 'entregado' && status !== 'cancelado';
      });

      setActiveOrders(active);
      setHasSavedOrder(active.length > 0);
    } catch (err) {
      console.error("Error checking active orders:", err);
    }
  };

  useEffect(() => {
    checkActiveOrders();
    checkAdminOrders();

    const savedId = localStorage.getItem('copias_bellavista_last_order_id');
    if (savedId) {
      const savedIdsStr = localStorage.getItem('copias_bellavista_order_ids') || '[]';
      let ids: string[] = [];
      try {
        ids = JSON.parse(savedIdsStr);
      } catch (_) {}
      if (!ids.includes(savedId)) {
        ids.push(savedId);
        localStorage.setItem('copias_bellavista_order_ids', JSON.stringify(ids));
      }
    }

    const interval = setInterval(() => {
      checkActiveOrders();
      checkAdminOrders();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Layout and view states
  const [activeRole, setActiveRole] = useState<'admin' | 'vendedor' | 'cliente'>('cliente');

  useEffect(() => {
    if (activeRole === 'admin') {
      checkAdminOrders();
    }
  }, [activeRole]);
  const [isAdminView, setIsAdminView] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Display toast utility (Short duration: default 1800ms)
  const triggerToast = (message: string, duration = 1800) => {
    setToastMessage(message);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, duration);
  };

  // User Authentication State
  const [currentUser, setCurrentUser] = useState<StoreUser | null>(() => {
    try {
      const saved = localStorage.getItem('copias_bellavista_logged_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showCustomerDashboardModal, setShowCustomerDashboardModal] = useState(false);

  // Wishlist state
  const [wishlistedProductIds, setWishlistedProductIds] = useState<string[]>([]);

  const loadUserWishlist = async () => {
    if (currentUser?.email) {
      try {
        const list = await dbService.getWishlist(currentUser.email);
        setWishlistedProductIds(list.map(w => w.product_id));
      } catch (err) {
        console.error("Error loading wishlist in App.tsx:", err);
      }
    } else {
      setWishlistedProductIds([]);
    }
  };

  useEffect(() => {
    loadUserWishlist();
  }, [currentUser]);

  const handleToggleWishlist = async (productId: string) => {
    if (!currentUser) {
      setShowLoginModal(true);
      triggerToast("Por favor, inicia sesión para guardar artículos en tu lista de deseos.");
      return;
    }

    const email = currentUser.email;
    const isCurrentlyWishlisted = wishlistedProductIds.includes(productId);

    try {
      if (isCurrentlyWishlisted) {
         await dbService.removeFromWishlist(email, productId);
         setWishlistedProductIds(prev => prev.filter(id => id !== productId));
         triggerToast("Artículo eliminado de tu lista de deseos.");
      } else {
         await dbService.addToWishlist(email, productId);
         setWishlistedProductIds(prev => [...prev, productId]);
         triggerToast("Artículo agregado a tu lista de deseos.");
      }
    } catch (err) {
      console.error("Error toggling wishlist:", err);
      triggerToast("Ocurrió un error al actualizar tu lista de deseos.");
    }
  };

  const handleLoginSuccess = (user: StoreUser) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('copias_bellavista_logged_user', JSON.stringify(user));
    } catch (e) {}

    // Set active role and view based on role
    const r = (user.role || '').toLowerCase();
    if (r === 'admin' || r === 'gerente') {
      setActiveRole('admin');
      setIsAdminView(true);
      setAdminMenu('orders');
      setAdminTab('orders');
    } else if (r === 'cajero' || r === 'despachador' || r === 'repartidor') {
      setActiveRole('vendedor');
      setIsAdminView(true);
      setAdminMenu('orders');
      setAdminTab('orders');
    } else {
      setActiveRole('cliente');
    }

    triggerToast(`¡Bienvenido(a) ${user.name}! Sesión iniciada como ${user.role}.`);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('copias_bellavista_logged_user');
    } catch (e) {}
    setActiveRole('cliente');
    setIsAdminView(false);
    triggerToast('Sesión cerrada correctamente.');
  };

  const [showAdminShortcutButton, setShowAdminShortcutButton] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [showTresLechesLanding, setShowTresLechesLanding] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [isMobileCurrencyModalOpen, setIsMobileCurrencyModalOpen] = useState(false);

  const [disabledSettings, setDisabledSettings] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('copias_bellavista_disabled_settings');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  useEffect(() => {
    const loadSettings = () => {
      try {
        const saved = localStorage.getItem('copias_bellavista_disabled_settings');
        if (saved) setDisabledSettings(JSON.parse(saved));
      } catch (e) {}
    };
    loadSettings();
    window.addEventListener('storage', loadSettings);
    window.addEventListener('bellavista_settings_updated', loadSettings);
    return () => {
      window.removeEventListener('storage', loadSettings);
      window.removeEventListener('bellavista_settings_updated', loadSettings);
    };
  }, []);

  const [isLandingActive, setIsLandingActive] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('copias_bellavista_landing_active');
      const disabledSaved = localStorage.getItem('copias_bellavista_disabled_settings');
      if (disabledSaved) {
        const parsed = JSON.parse(disabledSaved);
        if (parsed.disable_landing === true) return false;
      }
      return saved === 'true'; // Default FALSE so landing doesn't appear
    } catch (e) {
      return false;
    }
  });

  // Shopping Cart States
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('copias_bella_vista_cart');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Error reading cart from localStorage:", e);
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Sync cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('copias_bella_vista_cart', JSON.stringify(cart));
    } catch (e) {
      console.error("Error saving cart to localStorage:", e);
    }
  }, [cart]);

  // Cart helper functions
  const handleAddToCart = (product: Product, quantity: number = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        const newQty = Math.min(product.stock, existing.quantity + quantity);
        triggerToast(`Actualizado: ${product.name} en el carrito (${newQty} uds).`);
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: newQty } : item);
      }
      triggerToast(`¡Añadido al carrito: ${product.name}!`);
      return [...prev, { product, quantity }];
    });
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart(prev => {
      const item = prev.find(i => i.product.id === productId);
      if (item) {
        triggerToast(`Eliminado del carrito: ${item.product.name}`);
      }
      return prev.filter(i => i.product.id !== productId);
    });
  };

  const handleUpdateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveFromCart(productId);
      return;
    }
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const qty = Math.min(item.product.stock, quantity);
        return { ...item, quantity: qty };
      }
      return item;
    }));
  };

  const handleClearCart = () => {
    setCart([]);
    triggerToast("Carrito vaciado.");
  };

  const handleOrderSuccess = (orderId: string) => {
    // Add the new order ID to our list in localStorage
    const savedIdsStr = localStorage.getItem('copias_bellavista_order_ids') || '[]';
    let ids: string[] = [];
    try {
      ids = JSON.parse(savedIdsStr);
    } catch (_) {}
    if (!ids.includes(orderId)) {
      ids.push(orderId);
      localStorage.setItem('copias_bellavista_order_ids', JSON.stringify(ids));
    }
    localStorage.setItem('copias_bellavista_last_order_id', orderId);

    setTrackingOrderId(orderId);
    checkActiveOrders(); // Immediately fetch to update active orders state!
    
    setIsCartOpen(false);
    setCart([]); // Silent clear of the cart state
    try {
      localStorage.removeItem('copias_bella_vista_cart');
    } catch (e) {
      console.error("Error clearing cart storage", e);
    }
    triggerToast("¡Pedido registrado! Rastreando pedido en tiempo real...");
  };

  // Global search & Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(1000);
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [onlyOffers, setOnlyOffers] = useState(false);

  // Fetch all initial data
  // Pagination states
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const observerTarget = useRef<HTMLDivElement>(null);

  const loadGlobalData = async () => {
    try {
      const [cats, brs, imgs, prods] = await Promise.all([
        dbService.getCategories().catch(e => { console.error("Error loading categories:", e); return []; }),
        dbService.getBrands().catch(e => { console.error("Error loading brands:", e); return []; }),
        dbService.getProductImages().catch(e => { console.error("Error loading product images:", e); return []; }),
        dbService.getProducts().catch(e => { console.error("Error loading products:", e); return []; })
      ]);
      setCategories(cats || []);
      setBrands(brs || []);
      setProductImages(imgs || []);
      setAllProductsForCarousel(prods || []);
    } catch (e) {
      console.error("Error loading application data:", e);
    }
  };

  useEffect(() => {
    loadGlobalData();

    // Scroll listener for back-to-top button
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Public View: Fetch paginated products based on filters
  useEffect(() => {
    if (isAdminView) return;

    let isMounted = true;
    const fetchInitialProducts = async () => {
      setLoading(true);
      setPage(0);
      try {
        const { data, count } = await dbService.getProductsPaginated({
          page: 0,
          pageSize: 20,
          searchTerm,
          categoryId: selectedCategory,
          brandId: selectedBrand,
          onlyAvailable: onlyInStock,
          onlyFeatured,
          onlyOffers,
          minPrice,
          maxPrice
        });
        if (isMounted) {
          setProducts(data);
          setTotalCount(count);
          setHasMore(data.length < count);
        }
      } catch (e) {
        console.error("Error loading products:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    fetchInitialProducts();
    
    return () => { isMounted = false; };
  }, [isAdminView, searchTerm, selectedCategory, selectedBrand, minPrice, maxPrice, onlyInStock, onlyFeatured, onlyOffers]);

  // Load more function
  const loadMoreProducts = useCallback(async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const { data, count } = await dbService.getProductsPaginated({
        page: nextPage,
        pageSize: 20,
        searchTerm,
        categoryId: selectedCategory,
        brandId: selectedBrand,
        onlyAvailable: onlyInStock,
        onlyFeatured,
        onlyOffers,
        minPrice,
        maxPrice
      });
      setProducts(prev => {
        const newTotal = prev.length + data.length;
        setHasMore(newTotal < count);
        return [...prev, ...data];
      });
      setPage(nextPage);
    } catch (e) {
      console.error("Error loading more products:", e);
    } finally {
      setLoadingMore(false);
    }
  }, [page, hasMore, loadingMore, loading, searchTerm, selectedCategory, selectedBrand, minPrice, maxPrice, onlyInStock, onlyFeatured, onlyOffers]);

  // IntersectionObserver for infinite scrolling
  useEffect(() => {
    if (isAdminView || loading || loadingMore || !hasMore) return;
    
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          loadMoreProducts();
        }
      },
      { threshold: 0.1 }
    );
    
    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    
    return () => observer.disconnect();
  }, [isAdminView, loading, loadingMore, hasMore, loadMoreProducts]);

  // Admin View: Load full inventory
  useEffect(() => {
    if (isAdminView) {
      setLoading(true);
      dbService.getProducts().then(prods => {
        setProducts(prods);
        setLoading(false);
      });
    }
  }, [isAdminView]);

  // Keyboard combination shortcut (Ctrl + A + S) to toggle the admin login button visibility
  useEffect(() => {
    const pressedKeys = new Set<string>();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e || !e.key) return;
      const key = e.key.toLowerCase();
      pressedKeys.add(key);

      const hasCtrl = e.ctrlKey || e.metaKey || pressedKeys.has('control');
      const hasA = pressedKeys.has('a');
      const hasS = pressedKeys.has('s');

      // Prevent default action for Ctrl+S (Save) and Ctrl+A (Select All) to make experience smooth
      if (hasCtrl && (key === 'a' || key === 's')) {
        e.preventDefault();
      }

      if (hasCtrl && hasA && hasS) {
        e.preventDefault();
        setShowAdminShortcutButton(prev => !prev);
        pressedKeys.clear();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e || !e.key) return;
      pressedKeys.delete(e.key.toLowerCase());
    };

    const handleBlur = () => {
      pressedKeys.clear();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Deep linking: check URL for a shared product or order tracking
  useEffect(() => {
    let active = true;
    const checkDeepLink = async () => {
      const params = new URLSearchParams(window.location.search);
      const productSlug = params.get('producto') || params.get('p');
      const orderIdParam = params.get('pedido') || params.get('orderId');
      const hash = window.location.hash;
      
      if (orderIdParam) {
        setTrackingOrderId(orderIdParam);
        // Clear param from URL cleanly so it doesn't reopen repeatedly on refresh
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
        return;
      }

      let slug = productSlug;
      if (!slug && hash.includes('#/producto/')) {
        slug = hash.split('#/producto/')[1];
      } else if (!slug && window.location.pathname.startsWith('/producto/')) {
        slug = window.location.pathname.split('/producto/')[1];
      }

      if (slug) {
        try {
          const allProds = await dbService.getProducts();
          const matchedProduct = allProds.find(p => p.slug === slug || p.id === slug || p.sku === slug);
          if (matchedProduct && active) {
            setSelectedProduct(matchedProduct);
          }
        } catch (err) {
          console.error("Error checking deep link product:", err);
        }
      }
    };

    // Run on initial load
    checkDeepLink();

    // Also listen to popstate changes (e.g. going back/forward)
    window.addEventListener('popstate', checkDeepLink);
    return () => {
      active = false;
      window.removeEventListener('popstate', checkDeepLink);
    };
  }, []);

  // WhatsApp click redirection
  const handleWhatsAppQuery = (product: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    const phoneNumber = '584125043857'; // Default Venezuela Barinitas contact phone
    const formattedPrice = product.offer_price ? `$${product.offer_price.toFixed(2)} USD (Precio Oferta)` : `$${product.price.toFixed(2)} USD`;
    const message = `Hola Copias Bella Vista, estoy interesado en el siguiente artículo de su catálogo online:
      
*Producto:* ${product.name}
*SKU:* ${product.sku}
*Precio:* ${formattedPrice}
      
¿Tienen disponibilidad y método de entrega en Barinitas? ¡Muchas gracias!`;
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${phoneNumber}&text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  // Share link trigger
  const handleShareProduct = (product: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const url = `https://b2c-roan-five.vercel.app/?producto=${product.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      triggerToast(`¡Enlace del producto ${product.sku} copiado al portapapeles!`);
    });
  };

  // Reset filter inputs
  const handleResetFilters = () => {
    setSelectedCategory('all');
    setSelectedBrand('all');
    setMinPrice(0);
    setMaxPrice(1000);
    setOnlyInStock(false);
    setOnlyFeatured(false);
    setOnlyOffers(false);
    setSearchTerm('');
    triggerToast("Filtros de catálogo restablecidos.");
  };

  // Clear search filters only (keeping search term)
  const handleClearFiltersOnly = () => {
    setSelectedCategory('all');
    setSelectedBrand('all');
    setMinPrice(0);
    setMaxPrice(1000);
    setOnlyInStock(false);
    setOnlyFeatured(false);
    setOnlyOffers(false);
  };

  // Helper to filter by category name keyword from menus/buttons
  const handleSelectCategoryByName = (keyword: string) => {
    const cleanKw = (keyword || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // 1. Try to find matching category by name or slug (accent and case-insensitive)
    let found = categories.find(c => {
      const cName = (c.name || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const cSlug = (c.slug || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return cName === cleanKw || cSlug === cleanKw || cName.includes(cleanKw) || cleanKw.includes(cName);
    });

    // 2. Fallback: check partial word matching (e.g. "escolar", "utiles", "escolares")
    if (!found) {
      const kwWords = cleanKw.split(/\s+/).filter(w => w.length > 2);
      found = categories.find(c => {
        const cName = (c.name || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return kwWords.some(w => cName.includes(w));
      });
    }

    if (found) {
      setSelectedCategory(found.id);
      setSelectedBrand('all');
      setOnlyOffers(false);
      setOnlyFeatured(false);
      setSearchTerm('');
      triggerToast(`Filtrando por categoría: ${found.name}`);
    } else {
      // Fallback: search for it using global search
      setSearchTerm(keyword);
      setSelectedCategory('all');
      setSelectedBrand('all');
      setOnlyOffers(false);
      setOnlyFeatured(false);
      triggerToast(`Buscando artículos de "${keyword}"`);
    }

    // Smooth scroll down to the products section so user sees them immediately
    setTimeout(() => {
      const el = document.getElementById('products-display-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 150);
  };

  const handleRefreshAdminData = () => {
    loadGlobalData();
    checkAdminOrders();
    if (isAdminView) {
      setLoading(true);
      dbService.getProducts().then(prods => {
        setProducts(prods);
        setAllProductsForCarousel(prods || []);
        setLoading(false);
      });
    }
  };

  const newOrdersList = adminOrders.filter(o => {
    const s = (o.status || '').toLowerCase();
    return s === 'recibido' || s === 'pendiente';
  });

  const pendingOrdersList = adminOrders.filter(o => {
    const s = (o.status || '').toLowerCase();
    return s !== 'entregado' && s !== 'cancelado';
  });

  return (
    <div className="min-h-screen bg-[#EAEDED] flex flex-col font-sans text-[#0F1111]">
      {/* Dynamic Toast Alerts - Fixed at top of screen, short duration */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-[90vw] md:max-w-md bg-gray-900/95 backdrop-blur-md text-white font-extrabold px-4 py-2.5 rounded-full shadow-2xl border border-gray-700/80 text-xs flex items-center justify-center gap-2 animate-fadeIn transition-all duration-200 pointer-events-none">
          <CheckCircle2 className="w-4.5 h-4.5 text-[#FF9900] shrink-0" />
          <span className="truncate">{toastMessage}</span>
        </div>
      )}

      {/* Main Navbar */}
      <Navbar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        activeRole={activeRole}
        onOpenSettings={() => setShowSettingsModal(true)}
        onNavigateToAdmin={() => {
          setIsAdminView(true);
          setAdminMenu('orders');
          setAdminTab('orders');
        }}
        isAdminView={isAdminView}
        onExitAdminView={() => setIsAdminView(false)}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        categories={categories}
        onlyOffers={onlyOffers}
        setOnlyOffers={setOnlyOffers}
        onResetFilters={handleResetFilters}
        onSelectCategoryByName={handleSelectCategoryByName}
        cartItemsCount={cart.reduce((acc, item) => acc + item.quantity, 0)}
        onOpenCart={() => setIsCartOpen(true)}
        onClearFiltersOnly={handleClearFiltersOnly}
        activeCurrency={activeCurrency}
        onCurrencyChange={handleCurrencyChange}
        currencyRates={currencyRates}
        onOpenTresLechesLanding={isLandingActive && !disabledSettings.disable_landing ? () => setShowTresLechesLanding(true) : undefined}
        onOpenScanner={() => setShowBarcodeScanner(true)}
        currentUser={currentUser}
        onOpenLoginModal={() => setShowLoginModal(true)}
        onLogout={handleLogout}
        onOpenCustomerDashboard={() => setShowCustomerDashboardModal(true)}
        onOpenMobileCurrencyModal={() => setIsMobileCurrencyModalOpen(true)}
      />

      {/* Main Application Body */}
      <main className={`flex-1 py-2.5 sm:py-6 pb-16 md:pb-6 w-full relative z-10 ${isAdminView ? 'w-full px-2 sm:px-4 md:px-6' : 'max-w-[1480px] mx-auto px-2 sm:px-4 md:px-6'}`}>
        {/* Administrator & Manager Real-time Alert Banner */}
        {activeRole === 'admin' && (newOrdersList.length > 0 || pendingOrdersList.length > 0) && (
          <div className="mb-6 bg-[#131921] text-white rounded-xl border-l-4 border-red-600 shadow-2xl p-4 md:p-5 select-none animate-fadeIn flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            {/* Left section: Info & Messages */}
            <div className="flex items-start gap-3 md:gap-4">
              <div className="p-2.5 bg-[#232F3E] text-[#FF9900] rounded-lg border border-gray-700 animate-pulse shrink-0">
                <Bell className="w-6 h-6 animate-swing" />
              </div>
              <div className="space-y-1 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-red-600 text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full animate-pulse">
                    ALERTA DE GERENCIA
                  </span>
                  <span className="text-gray-400 font-extrabold text-[10px] uppercase tracking-wider">
                    Panel de Administración • En Tiempo Real
                  </span>
                  {/* Blinking Live indicator */}
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-black uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                    En vivo
                  </span>
                </div>
                
                <h3 className="text-sm md:text-base font-black text-white leading-snug">
                  {newOrdersList.length > 0 && (
                    <span>
                      ¡Tienes <strong className="text-[#FF9900]">{newOrdersList.length} nuevo(s) pedido(s)</strong> sin procesar!{' '}
                    </span>
                  )}
                  {pendingOrdersList.length > 0 && (
                    <span className={newOrdersList.length > 0 ? 'border-l border-gray-700 pl-2 ml-1' : ''}>
                      Falta completar el proceso de <strong className="text-sky-400">{pendingOrdersList.length} pedido(s) activo(s)</strong> con el cliente.
                    </span>
                  )}
                </h3>
                
                <p className="text-[11px] text-gray-400 leading-normal font-semibold">
                  Atención Administrador / Gerente: Por favor, revisa y gestiona las solicitudes de los clientes para garantizar tiempos de entrega rápidos y actualizar las fases de preparación.
                </p>
              </div>
            </div>

            {/* Right section: Action Buttons */}
            <div className="flex items-center gap-2 w-full md:w-auto self-stretch md:self-auto shrink-0">
              <button
                onClick={() => {
                  setIsAdminView(true);
                  setAdminMenu('orders');
                  setAdminTab('orders');
                  setTimeout(() => {
                    const el = document.getElementById('btn-tab-orders') || document.getElementById('products-display-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
                className="flex-1 md:flex-initial px-4.5 py-2.5 bg-[#FF9900] hover:bg-[#e68a00] text-[#131921] text-xs font-black rounded-lg transition duration-200 uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <ClipboardList className="w-4 h-4 shrink-0" />
                Gestionar Pedidos
              </button>
            </div>
          </div>
        )}

        {isAdminView ? (
          /* ADMINISTRATIVE MODULE VIEW */
          <Suspense fallback={<AdminSuspenseFallback />}>
            <AdminPanel
              products={products}
              categories={categories}
              brands={brands}
              productImages={productImages}
              onRefreshData={handleRefreshAdminData}
              activeRole={activeRole}
              currentUser={currentUser}
              initialTab={adminTab}
              initialMenu={adminMenu}
              onTabChange={(tab) => setAdminTab(tab)}
              onMenuChange={(menu) => setAdminMenu(menu)}
              activeCurrency={activeCurrency}
              onCurrencyChange={handleCurrencyChange}
              currencyRates={currencyRates}
              onUpdateCurrencyRate={updateCurrencyRate}
              isLandingActive={isLandingActive}
              onToggleLandingActive={(val) => {
                setIsLandingActive(val);
                localStorage.setItem('copias_bellavista_landing_active', String(val));
              }}
              onLogout={handleLogout}
            />
          </Suspense>
        ) : (
          /* PUBLIC MARKETPLACE VIEW */
          <>
            {/* Amazon-style Categories & Featured Carousel */}
            <div className="relative z-20 mb-6">
              <AmazonCarousel
                products={allProductsForCarousel.length > 0 ? allProductsForCarousel : products}
                categories={categories}
                productImages={productImages}
                onViewDetails={(p) => setSelectedProduct(p)}
                onAddToCart={(p, e) => handleAddToCart(p, 1)}
                activeCurrency={activeCurrency}
                currencyRates={currencyRates}
                onSelectCategoryByName={handleSelectCategoryByName}
              />
            </div>

            {/* Gourmet Promotion Banner */}
            {isLandingActive && (
              <div className="mb-6 bg-gradient-to-r from-amber-950 via-[#3D2314] to-[#4E2F1D] text-white rounded-2xl p-5 md:p-6 shadow-xl border border-amber-900/20 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative select-none">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF9900]/5 rounded-full blur-2xl pointer-events-none"></div>
                <div className="flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
                  <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-[#FF9900] shadow-md shrink-0">
                    <img 
                      src="https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=120&h=120" 
                      alt="Tres Leches" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                      <span className="bg-[#FF9900]/20 text-[#FF9900] text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border border-[#FF9900]/30 animate-pulse">
                        ¡Novedad Dulce! 🍰
                      </span>
                      <span className="text-gray-400 font-extrabold text-[10px] uppercase tracking-wider">
                        Obrador de Postres Artesanales
                      </span>
                    </div>
                    <h3 className="text-base md:text-lg font-serif font-black text-[#FFF5EA] leading-tight">
                      Torta Tres Leches Choco Arequipe <span className="text-[#FF9900]">(Porción Individual)</span>
                    </h3>
                    <p className="text-xs text-gray-300 font-medium leading-normal max-w-xl">
                      Bizcocho de cacao premium sumergido en infusión de tres leches de chocolate, decorado con hilos de arequipe y lluvia de chocolate. ¡Déjate tentar por nuestra receta especial!
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowTresLechesLanding(true)}
                  className="w-full md:w-auto px-5 py-3 bg-[#FF9900] hover:bg-[#e68a00] text-[#131921] text-xs font-black rounded-xl transition duration-200 uppercase tracking-widest flex items-center justify-center gap-1.5 shadow-lg shrink-0 cursor-pointer hover:scale-105 active:scale-95"
                >
                  <span>Descubrir Especial</span>
                  <ArrowRight className="w-4.5 h-4.5" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              
              {/* Left Column: Filter Sidebar */}
              <div className="hidden lg:block lg:col-span-1">
                <Sidebar
                  categories={categories.filter(c => c.active !== false)}
                  brands={brands.filter(b => b.active !== false)}
                  selectedCategory={selectedCategory}
                  setSelectedCategory={setSelectedCategory}
                  selectedBrand={selectedBrand}
                  setSelectedBrand={setSelectedBrand}
                  minPrice={minPrice}
                  setMinPrice={setMinPrice}
                  maxPrice={maxPrice}
                  setMaxPrice={setMaxPrice}
                  onlyInStock={onlyInStock}
                  setOnlyInStock={setOnlyInStock}
                  onlyFeatured={onlyFeatured}
                  setOnlyFeatured={setOnlyFeatured}
                  onResetFilters={handleResetFilters}
                />
              </div>

              {/* Right Column: Products Display Grid */}
              <div id="products-display-section" className="lg:col-span-3 text-left scroll-mt-20">
                {/* Result header count */}
                <div className="bg-white p-3.5 rounded-lg border border-gray-200 shadow-sm flex justify-between items-center mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    {t('catalog.found_results', 'Resultados encontrados:')} <span className="text-[#0F1111] font-black">{totalCount} {t('catalog.articles', 'artículos')}</span>
                  </span>
                  
                  {/* Active filters count summary badges */}
                  <div className="flex gap-2">
                    {selectedCategory !== 'all' && (
                      <span className="bg-sky-50 text-[#007185] border border-sky-100 text-[10px] font-bold px-2 py-0.5 rounded">
                        Categoría Activa
                      </span>
                    )}
                    {selectedBrand !== 'all' && (
                      <span className="bg-sky-50 text-[#007185] border border-sky-100 text-[10px] font-bold px-2 py-0.5 rounded">
                        Marca Activa
                      </span>
                    )}
                    {(minPrice > 0 || maxPrice < 1000) && (
                      <span className="bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-bold px-2 py-0.5 rounded">
                        Filtro Precio
                      </span>
                    )}
                  </div>
                </div>

                {/* Loading indicator */}
                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                    {/* Skeletons para carga inicial */}
                    {[...Array(8)].map((_, i) => (
                      <div key={`skeleton-${i}`} className="bg-white rounded-lg shadow border border-gray-100 overflow-hidden flex flex-col h-[320px] animate-pulse">
                        <div className="h-40 bg-gray-200"></div>
                        <div className="p-3 flex-1 flex flex-col gap-2">
                          <div className="h-3 bg-gray-200 w-1/3 rounded"></div>
                          <div className="h-4 bg-gray-200 w-3/4 rounded"></div>
                          <div className="h-4 bg-gray-200 w-1/2 rounded mb-auto"></div>
                          <div className="h-6 bg-gray-200 w-1/4 rounded mt-4"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : products.length === 0 ? (
                  /* Empty state */
                  <div className="bg-white p-16 rounded-lg border border-gray-200 text-center shadow-sm flex flex-col items-center justify-center max-w-xl mx-auto my-6">
                    <Package className="w-12 h-12 text-[#FF9900] mb-4" />
                    <h3 className="text-lg font-black text-[#131921] mb-1">{t('catalog.no_results_title', 'Sin Resultados Coincidentes')}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed mb-6 max-w-md">
                      {t('catalog.no_results_desc', 'No encontramos ningún artículo que coincida con tus criterios de búsqueda. Prueba modificando los filtros del panel lateral o buscando otro término.')}
                    </p>
                    <button
                      onClick={handleResetFilters}
                      className="px-5 py-2.5 bg-[#FF9900] hover:bg-[#e68a00] text-[#131921] font-black rounded text-xs uppercase tracking-wider transition shadow cursor-pointer"
                    >
                      {t('catalog.clear_filters', 'Limpiar Todos los Filtros')}
                    </button>
                  </div>
                ) : (
                  /* Standard Grid */
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4 md:gap-6">
                      {products.map((product) => {
                        const category = categories.find(c => c.id === product.category_id);
                        const brand = brands.find(b => b.id === product.brand_id);
                        const associatedImages = productImages
                          .filter(img => img.product_id === product.id)
                          .map(img => img.image_url);

                        return (
                          <ProductCard
                            key={product.id}
                            product={product}
                            categoryName={category?.name || 'General'}
                            brandName={brand?.name || 'S/M'}
                            images={associatedImages}
                            onViewDetails={(p) => setSelectedProduct(p)}
                            onShare={(p, e) => handleShareProduct(p, e)}
                            onWhatsAppQuery={(p, e) => handleWhatsAppQuery(p, e)}
                            onAddToCart={(p, e) => handleAddToCart(p, 1)}
                            activeCurrency={activeCurrency}
                            currencyRates={currencyRates}
                            isWishlisted={wishlistedProductIds.some(id => String(id) === String(product.id))}
                            onToggleWishlist={(p) => handleToggleWishlist(p.id)}
                          />
                        );
                      })}
                      
                      {/* Skeletons para carga al hacer scroll */}
                      {loadingMore && [...Array(4)].map((_, i) => (
                        <div key={`more-skeleton-${i}`} className="bg-white rounded-lg shadow border border-gray-100 overflow-hidden flex flex-col h-[320px] animate-pulse">
                          <div className="h-40 bg-gray-200"></div>
                          <div className="p-3 flex-1 flex flex-col gap-2">
                            <div className="h-3 bg-gray-200 w-1/3 rounded"></div>
                            <div className="h-4 bg-gray-200 w-3/4 rounded"></div>
                            <div className="h-4 bg-gray-200 w-1/2 rounded mb-auto"></div>
                            <div className="h-6 bg-gray-200 w-1/4 rounded mt-4"></div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Sentinel para Intersection Observer */}
                    <div id="scroll-sentinel" ref={observerTarget} className="h-10 mt-4 w-full"></div>
                  </>
                )}
              </div>

            </div>
          </>
        )}
      </main>

      {/* Floating Call to Action on the left (WhatsApp & Shopping Cart) */}
      <div className="fixed bottom-16 md:bottom-6 left-3 sm:left-6 z-40 flex items-center gap-2 sm:gap-3">
        <button
          onClick={() => {
            const encoded = encodeURIComponent("Hola Copias Bella Vista, me gustaría realizar una consulta sobre sus servicios.");
            window.open(`https://api.whatsapp.com/send?phone=584125043857&text=${encoded}`, '_blank');
          }}
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#25D366] hover:bg-[#20ba56] text-white flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition duration-200 cursor-pointer"
          title="Atención directa por WhatsApp"
          id="btn-floating-whatsapp"
        >
          <Phone className="w-5 h-5 fill-current" />
        </button>

        {/* Floating Shopping Cart Button next to WhatsApp (Desktop Only) */}
        {!isAdminView && (
          <button
            onClick={() => setIsCartOpen(true)}
            className="hidden md:flex relative w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#FF9900] hover:bg-[#e68a00] text-[#131921] items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition duration-200 cursor-pointer border-2 border-[#131921]"
            title="Abrir Carrito de Compras"
            id="btn-floating-cart-left"
          >
            <ShoppingCart className="w-5 h-5 text-[#131921]" />
            {cart.reduce((sum, item) => sum + item.quantity, 0) > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] font-black rounded-full h-5 w-5 flex items-center justify-center border-2 border-white animate-bounce">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Floating Controls on the right (Information & Back to Top) */}
      <div className="fixed bottom-16 md:bottom-6 right-3 sm:right-6 z-40 flex flex-col gap-2.5 items-end">
        {showBackToTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#232F3E] text-white hover:bg-[#131921] border border-gray-700 flex items-center justify-center shadow-xl hover:scale-105 transition cursor-pointer"
            title="Subir al inicio"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        )}

        {/* Floating Tracking Shortcut */}
        {hasSavedOrder && (
          <button
            onClick={() => {
              if (activeOrders.length > 0 && activeOrders[0].id) {
                setTrackingOrderId(activeOrders[0].id);
              } else {
                const savedId = localStorage.getItem('copias_bellavista_last_order_id');
                if (savedId) {
                  setTrackingOrderId(savedId);
                }
              }
            }}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-[#008296] hover:bg-[#006677] text-white font-black shadow-2xl hover:scale-105 transition duration-200 cursor-pointer text-[11px] sm:text-xs uppercase tracking-wider border border-[#006677]"
            title="Ver estado de mi último pedido"
            id="btn-floating-tracking"
          >
            <Clock className="w-4 h-4 text-white animate-pulse" />
            <span className="hidden sm:inline">Rastrear Pedido</span>
          </button>
        )}

        {/* Botón de Información (Solo Símbolo "i") */}
        <button
          onClick={() => setIsInfoModalOpen(true)}
          className="w-11 h-11 rounded-full bg-[#FF9900] hover:bg-[#e68a00] text-[#131921] font-black shadow-2xl hover:scale-110 active:scale-95 transition duration-200 cursor-pointer flex items-center justify-center border border-[#e68a00]"
          title="Ver Información del Negocio"
          id="btn-floating-info"
        >
          <Info className="w-6 h-6 text-[#131921]" />
        </button>
      </div>

      {/* Bottom Navigation Bar (Mobile Only) */}
      {!isAdminView && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#131921] border-t border-gray-800 text-white h-14 md:hidden flex items-center justify-around shadow-2xl px-2 select-none">
          {/* 🏠 Inicio */}
          <button
            type="button"
            onClick={() => {
              handleResetFilters();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex flex-col items-center justify-center w-full h-full text-gray-400 hover:text-[#FF9900] active:text-[#FF9900] transition cursor-pointer"
            id="mobile-bottom-nav-home"
          >
            <Home className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-bold">Inicio</span>
          </button>

          {/* 🔍 Buscar */}
          <button
            type="button"
            onClick={() => {
              const searchInput = document.getElementById('input-global-search');
              if (searchInput) {
                searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                searchInput.focus();
              } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className="flex flex-col items-center justify-center w-full h-full text-gray-400 hover:text-[#FF9900] active:text-[#FF9900] transition cursor-pointer"
            id="mobile-bottom-nav-search"
          >
            <Search className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-bold">Buscar</span>
          </button>

          {/* 🛒 Carrito */}
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="flex flex-col items-center justify-center w-full h-full text-gray-400 hover:text-[#FF9900] active:text-[#FF9900] transition cursor-pointer relative"
            id="mobile-bottom-nav-cart"
          >
            <div className="relative">
              <ShoppingCart className="w-5 h-5 mb-0.5 text-white" />
              {cart.reduce((sum, item) => sum + item.quantity, 0) > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-[#FF9900] text-[#131921] text-[9px] font-black rounded-full h-4 w-4 flex items-center justify-center border border-[#131921] animate-bounce">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold">Carrito</span>
          </button>

          {/* 💲 Moneda ($ USD) */}
          <button
            type="button"
            onClick={() => setIsMobileCurrencyModalOpen(true)}
            className="flex flex-col items-center justify-center w-full h-full text-gray-400 hover:text-[#FF9900] active:text-[#FF9900] transition cursor-pointer"
            id="mobile-bottom-nav-currency"
            title="Configurar Moneda"
          >
            <DollarSign className="w-5 h-5 mb-0.5 text-white group-hover:text-[#FF9900]" />
            <span className="text-[10px] font-bold">{activeCurrency}</span>
          </button>

          {/* 👤 Mi Cuenta / Acceso O Panel Admin (para roles de tienda: administrador, gerente, cajero, repartidor, despachador) */}
          {(() => {
            const userRoleClean = (currentUser?.role || activeRole || '').trim().toLowerCase();
            const isStaffUser = ['administrador', 'admin', 'gerente', 'cajero', 'repartidor', 'despachador', 'vendedor'].some(
              r => userRoleClean.includes(r)
            );

            if (isStaffUser) {
              return (
                <button
                  type="button"
                  onClick={() => {
                    setIsAdminView(true);
                    if (userRoleClean.includes('cajero') || userRoleClean.includes('vendedor')) {
                      setAdminMenu('sales');
                    } else if (userRoleClean.includes('despachador')) {
                      setAdminMenu('products');
                    } else if (userRoleClean.includes('repartidor')) {
                      setAdminMenu('orders');
                    } else {
                      setAdminMenu('orders');
                    }
                  }}
                  className={`flex flex-col items-center justify-center w-full h-full transition cursor-pointer font-bold ${
                    isAdminView ? 'text-[#FF9900]' : 'text-gray-400 hover:text-[#FF9900] active:text-[#FF9900]'
                  }`}
                  id="mobile-bottom-nav-admin"
                  title="Panel Administrativo"
                >
                  <LayoutDashboard className="w-5 h-5 mb-0.5 transition-colors" />
                  <span className="text-[10px] font-extrabold tracking-tight transition-colors">Panel Admin</span>
                </button>
              );
            }

            return (
              <button
                type="button"
                onClick={() => {
                  if (currentUser) {
                    setShowCustomerDashboardModal(true);
                  } else {
                    setShowLoginModal(true);
                  }
                }}
                className="flex flex-col items-center justify-center w-full h-full text-gray-400 hover:text-[#FF9900] active:text-[#FF9900] transition cursor-pointer"
                id="mobile-bottom-nav-account"
              >
                <User className="w-5 h-5 mb-0.5" />
                <span className="text-[10px] font-bold">{currentUser ? 'Mi Cuenta' : 'Acceso'}</span>
              </button>
            );
          })()}
        </nav>
      )}

      {/* ====================================
          MODAL VIEWS OVERLAYS (LAZY LOADED)
          ==================================== */}

      {/* 1. PRODUCT DETAIL MODAL */}
      {selectedProduct && (
        <Suspense fallback={<ModalSuspenseFallback />}>
          <ProductDetailModal
            product={selectedProduct}
            categories={categories}
            brands={brands}
            allProducts={products}
            onClose={() => setSelectedProduct(null)}
            onViewProduct={(p) => setSelectedProduct(p)}
            onShare={handleShareProduct}
            onWhatsAppQuery={handleWhatsAppQuery}
            onAddToCart={handleAddToCart}
            activeCurrency={activeCurrency}
            currencyRates={currencyRates}
            isWishlisted={selectedProduct ? wishlistedProductIds.some(id => String(id) === String(selectedProduct.id)) : false}
            onToggleWishlist={(productId) => handleToggleWishlist(productId)}
          />
        </Suspense>
      )}

      {/* 2. SETTINGS / SUPABASE INTEGRATION MODAL */}
      {showSettingsModal && (
        <Suspense fallback={<ModalSuspenseFallback />}>
          <SettingsModal
            onClose={() => setShowSettingsModal(false)}
          />
        </Suspense>
      )}

      {/* 3. SHOPPING CART DRAWER */}
      <Suspense fallback={<ModalSuspenseFallback />}>
        <CartDrawer
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          cartItems={cart}
          onAddToCart={handleAddToCart}
          onUpdateQuantity={handleUpdateCartQuantity}
          onRemoveItem={handleRemoveFromCart}
          onClearCart={handleClearCart}
          productImages={productImages}
          onOrderSuccess={handleOrderSuccess}
          activeCurrency={activeCurrency}
          currencyRates={currencyRates}
          currentUser={currentUser}
          onOpenLoginModal={() => setShowLoginModal(true)}
        />
      </Suspense>

      {/* 4. BUSINESS INFORMATION MODAL */}
      {isInfoModalOpen && (
        <Suspense fallback={<ModalSuspenseFallback />}>
          <InfoModal
            onClose={() => setIsInfoModalOpen(false)}
          />
        </Suspense>
      )}

      {/* 5. ORDER TRACKING MODAL */}
      {trackingOrderId && (
        <Suspense fallback={<ModalSuspenseFallback />}>
          <OrderTrackingModal
            orderId={trackingOrderId}
            onClose={() => {
              setTrackingOrderId(null);
              checkActiveOrders();
            }}
            activeOrders={activeOrders}
            onRefreshActiveOrders={checkActiveOrders}
          />
        </Suspense>
      )}

      {/* 6. TORTA TRES LECHES CHOCO AREQUIPE LANDING PAGE OVERLAY */}
      {showTresLechesLanding && isLandingActive && (
        <Suspense fallback={<ModalSuspenseFallback />}>
          <TortaTresLechesLanding
            products={products}
            categories={categories}
            activeCurrency={activeCurrency}
            currencyRates={currencyRates}
            onAddToCart={handleAddToCart}
            onClose={() => setShowTresLechesLanding(false)}
            onRefreshProducts={loadGlobalData}
            onOpenCart={() => setIsCartOpen(true)}
          />
        </Suspense>
      )}

      {/* 7. CAMERA BARCODE & QR SCANNER PRICE QUERY MODAL */}
      {showBarcodeScanner && (
        <Suspense fallback={<ModalSuspenseFallback />}>
          <BarcodeScannerModal
            products={products}
            onClose={() => setShowBarcodeScanner(false)}
            onProductFound={(product) => {
              setSelectedProduct(product);
            }}
          />
        </Suspense>
      )}

      {/* Footer Area */}
      <footer className="bg-[#131921] text-white py-10 border-t-4 border-[#FF9900] select-none text-xs">
        <div className="max-w-[1480px] mx-auto px-4 md:px-6 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          
          {/* Col 1 */}
          <div>
            <h4 className="font-extrabold text-sm uppercase tracking-wider mb-3">Copias Bella Vista</h4>
            <p className="text-gray-400 leading-relaxed mb-4">
              Tu aliado estratégico de confianza en fotocopiado, impresión, encuadernación y útiles escolares de primera calidad. Despachos y atención inmediata en la ciudad de Barinitas, Estado Barinas, Venezuela.
            </p>
            <span className="inline-flex items-center gap-1 bg-gray-800 text-[#FF9900] px-2.5 py-1 rounded text-[10px] font-bold">
              <Info className="w-3.5 h-3.5" />
              Precios Calculados en USD ($)
            </span>
          </div>

          {/* Col 2 */}
          <div>
            <h4 className="font-extrabold text-sm uppercase tracking-wider mb-3">Soporte y Consultas</h4>
            <ul className="space-y-2 text-gray-400 font-medium">
              <li>• Horario: Lunes a Sábado de 8:30 a 12:00 - 2:30 a 6:00</li>
              <li>• Despachos en Barinitas</li>
              <li>• Facturación formal disponible</li>
              <li>• Consultas al por mayor para colegios y oficinas</li>
            </ul>
          </div>

          {/* Col 3: Acceso Controlado (Ctrl + A + S) */}
          <div>
            {showAdminShortcutButton && (
              <div className="space-y-3 animate-fadeIn" id="admin-shortcut-container">
                <h4 className="font-extrabold text-sm uppercase tracking-wider mb-3 flex items-center gap-1.5 text-gray-300">
                  <ShieldAlert className="w-4 h-4 text-[#FF9900]" />
                  Acceso de Rol
                </h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setActiveRole('cliente');
                      setIsAdminView(false);
                    }}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      !isAdminView && activeRole === 'cliente'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-[#232F3E] hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700'
                    }`}
                    id="btn-shortcut-clientes"
                  >
                    Clientes
                  </button>

                  <button
                    onClick={() => {
                      setActiveRole('admin');
                      setIsAdminView(true);
                      setAdminMenu('orders');
                      setAdminTab('orders');
                    }}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      isAdminView || activeRole === 'admin'
                        ? 'bg-red-600 text-white shadow-md'
                        : 'bg-[#232F3E] hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700'
                    }`}
                    id="btn-shortcut-administrador"
                  >
                    Administrador
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        <div className="max-w-[1480px] mx-auto px-4 md:px-6 mt-8 pt-6 border-t border-gray-800 text-center text-gray-500 font-semibold flex flex-col sm:flex-row justify-between items-center gap-4 pb-12 md:pb-0">
          <p>© 2026 Copias Bella Vista. Todos los derechos reservados. Barinitas, Venezuela.</p>
          <p className="text-[10px]">Diseñado y desarrollado por Google AI Studio</p>
        </div>
      </footer>

      {/* Login Modal */}
      {showLoginModal && (
        <Suspense fallback={<ModalSuspenseFallback />}>
          <LoginModal
            isOpen={showLoginModal}
            onClose={() => setShowLoginModal(false)}
            onLoginSuccess={handleLoginSuccess}
          />
        </Suspense>
      )}

      {/* Mobile Currency Configuration Modal */}
      {isMobileCurrencyModalOpen && (
        <Suspense fallback={<ModalSuspenseFallback />}>
          <MobileCurrencyModal
            isOpen={isMobileCurrencyModalOpen}
            onClose={() => setIsMobileCurrencyModalOpen(false)}
            activeCurrency={activeCurrency}
            onCurrencyChange={handleCurrencyChange}
            currencyRates={currencyRates}
            disabledSettings={disabledSettings}
          />
        </Suspense>
      )}

      {/* Customer Dashboard Modal */}
      {currentUser && showCustomerDashboardModal && (
        <Suspense fallback={<ModalSuspenseFallback />}>
          <CustomerDashboardModal
            isOpen={showCustomerDashboardModal}
            onClose={() => setShowCustomerDashboardModal(false)}
            currentUser={currentUser}
            onLogout={() => {
              handleLogout();
              setShowCustomerDashboardModal(false);
            }}
            onTrackOrder={(orderId) => {
              setTrackingOrderId(orderId);
            }}
            onUpdateUser={(updated) => {
              setCurrentUser(updated);
              try {
                localStorage.setItem('copias_bellavista_logged_user', JSON.stringify(updated));
              } catch (e) {}
            }}
            onAddToCart={(p) => handleAddToCart(p, 1)}
            activeCurrency={activeCurrency}
            currencyRates={currencyRates}
            products={allProductsForCarousel}
            onWishlistChanged={loadUserWishlist}
          />
        </Suspense>
      )}
    </div>
  );
}
