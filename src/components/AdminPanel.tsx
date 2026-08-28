/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo, Suspense, lazy } from 'react';
import { 
  BarChart, Package, Tag, Layers, ToggleLeft, ToggleRight, 
  Plus, Edit3, Trash2, Check, AlertTriangle, Printer, Star, Search, Image as ImageIcon, FileText, X, Upload, Download,
  ClipboardList, RefreshCw, Eye, Coins, Truck, Store, Calendar, HelpCircle, Clock, Timer,
  LayoutDashboard, ShieldCheck, Settings, Activity, ArrowRight, ArrowUp, ArrowDown, Sparkles, TrendingUp, TrendingDown, Users, UserCheck,
  Lock, Unlock, LogOut, Megaphone, ShoppingCart, Barcode, Save, Code, Copy, CheckCircle, User, DollarSign, Menu, ShoppingBag, Crown, FileCheck,
  LayoutGrid, Kanban, Volume2, VolumeX, SlidersHorizontal, ArrowLeftRight, MapPin,
  ChevronDown, ChevronRight, PieChart, Wallet, CreditCard, Scale, Zap, Receipt
} from 'lucide-react';
import { Product, Category, Brand, ProductImage, Order, Provider, StoreUser, BannerSlide, LandingConfig, HomeCarouselCardItem, Tax, BusinessBranch, BusinessTerminal, AdminMenuType } from '../types.ts';
import { dbService, supabase } from '../lib/supabase.ts';
import { sortProductsByPriority } from '../lib/searchUtils';
import * as XLSX from 'xlsx';
import { CurrencyCode, CURRENCIES } from '../lib/currency';
import { sendPushNotification } from '../lib/pushNotifications.ts';
import { useI18n } from '../lib/i18n.ts';
import { AdminBrandHeader, AdminIsotype } from './AdminLogo.tsx';

// 🚀 Lazy-Loaded Administrative Submodules
const POSModule = lazy(() => import('./POSModule'));
const MarketingModule = lazy(() => import('./MarketingModule.tsx'));
const BalancePage = lazy(() => import('./BalancePage.tsx'));
const CotizacionesPage = lazy(() => import('./CotizacionesPage.tsx'));
const OpenCashSessionModal = lazy(() => import('./OpenCashSessionModal.tsx'));
const BarcodeScannerModal = lazy(() => import('./BarcodeScannerModal.tsx'));
const SystemConfigPanel = lazy(() => import('./SystemConfigPanel.tsx'));
const ReportesDashboard = lazy(() => import('./ReportesDashboard.tsx'));
const ReportesDiariosPage = lazy(() => import('./ReportesDiariosPage.tsx'));
const ComprasModule = lazy(() => import('./ComprasModule.tsx'));
const CuentasBancariasPage = lazy(() => import('./CuentasBancariasPage.tsx'));
const GastosPage = lazy(() => import('./GastosPage.tsx'));
const CuentasPendientesPage = lazy(() => import('./CuentasPendientesPage.tsx'));

const AdminSubmoduleLoader = ({ name = 'Módulo' }: { name?: string }) => (
  <div className="flex flex-col items-center justify-center p-16 min-h-[380px] bg-white rounded-2xl border border-gray-150 text-center select-none animate-fadeIn my-2">
    <div className="w-8 h-8 border-3 border-[#005da9]/30 border-t-[#005da9] rounded-full animate-spin mb-3"></div>
    <span className="text-xs font-black uppercase tracking-wider text-gray-800">Cargando {name}...</span>
    <span className="text-[10px] text-gray-400 font-semibold mt-0.5">Sincronizando registros en tiempo real</span>
  </div>
);

const OrderTimer = ({ createdAt, status, currentTime }: { createdAt: string | undefined, status: string, currentTime: number }) => {
  const createdDate = createdAt ? new Date(createdAt) : new Date();
  const elapsedMs = currentTime - createdDate.getTime();
  const elapsedMins = Math.floor(Math.max(0, elapsedMs) / 60000);
  const elapsedSecs = Math.floor((Math.max(0, elapsedMs) % 60000) / 1000);
  
  const statusClean = (status || '').toLowerCase();
  const isOverdue = elapsedMins >= 45 && statusClean !== 'entregado' && statusClean !== 'cancelado';
  
  const timeString = `${String(elapsedMins).padStart(2, '0')}:${String(elapsedSecs).padStart(2, '0')} min`;
  const orderDateStr = createdDate.toLocaleString('es-VE', { 
    year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  }).replace(',', '');

  return (
    <div className="flex flex-col gap-1">
      <div className={`font-bold flex items-center gap-1 text-[12px] ${isOverdue ? 'text-red-500' : 'text-emerald-600'}`}>
        <Timer className="w-4 h-4" />
        {statusClean === 'entregado' || statusClean === 'cancelado' ? 'Finalizado' : timeString}
      </div>
      <div className="flex items-center gap-1 text-gray-500 text-[11px] font-mono font-medium">
        <Calendar className="w-3.5 h-3.5" />
        {orderDateStr}
      </div>

    </div>
  );
};

interface AdminPanelProps {
  products: Product[];
  categories: Category[];
  brands: Brand[];
  productImages: ProductImage[];
  onRefreshData: () => void;
  activeRole: 'admin' | 'vendedor' | 'cliente';
  currentUser?: StoreUser | null;
  initialTab?: 'products' | 'categories' | 'brands' | 'orders';
  onTabChange?: (tab: 'products' | 'categories' | 'brands' | 'orders') => void;
  initialMenu?: AdminMenuType;
  onMenuChange?: (menu: AdminMenuType) => void;
  activeCurrency: CurrencyCode;
  onCurrencyChange: (currency: CurrencyCode) => void;
  currencyRates: Record<CurrencyCode, number>;
  onUpdateCurrencyRate: (code: string, rate: number) => Promise<void>;
  isLandingActive?: boolean;
  onToggleLandingActive?: (active: boolean) => void;
  onLogout?: () => void;
}

export default function AdminPanel({
  products,
  categories,
  brands,
  productImages,
  onRefreshData,
  activeRole,
  currentUser,
  initialTab,
  onTabChange,
  initialMenu,
  onMenuChange,
  activeCurrency,
  onCurrencyChange,
  currencyRates,
  onUpdateCurrencyRate,
  isLandingActive = true,
  onToggleLandingActive,
  onLogout
}: AdminPanelProps) {
  const { t, lang } = useI18n();
  const getGroupIdForMenu = (menu: AdminMenuType): string => {
    if (['sales', 'orders', 'cotizaciones'].includes(menu)) return 'ventas';
    if (['products', 'compras'].includes(menu)) return 'inventarios';
    if (['caja', 'cuentas_bancarias', 'balance'].includes(menu)) return 'cuentas';
    if (menu === 'marketing') return 'marketing';
    if (['reportes_balance', 'reportes_gastos', 'reportes_ganancias', 'reportes', 'gastos'].includes(menu)) return 'reportes';
    if (['clientes', 'proveedores', 'clientes_proveedores'].includes(menu)) return 'contactos';
    if (['settings', 'users'].includes(menu)) return 'configuracion';
    return '';
  };

  const [currentMenu, setCurrentMenu] = useState<AdminMenuType>(initialMenu || 'orders');
  const [contactsTab, setContactsTab] = useState<'clientes' | 'proveedores'>('clientes');
  
  // Menú colapsado por defecto, manteniendo únicamente el grupo activo abierto si existe
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const activeGroup = getGroupIdForMenu(initialMenu || 'orders');
    return activeGroup ? { [activeGroup]: true } : {};
  });

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const isCurrentlyOpen = !!prev[groupId];
      // Si está abierto lo cerramos; si está cerrado, abrimos solo este grupo (modo acordeón limpio)
      return isCurrentlyOpen ? {} : { [groupId]: true };
    });
  };

  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState<boolean>(false);
  const [isPrintingInventory, setIsPrintingInventory] = useState<boolean>(false);
  const [systemConfigSubTab, setSystemConfigSubTab] = useState<'mi_cuenta' | 'mi_negocio' | 'facturacion' | 'inventario' | 'impresion' | 'dashboard' | 'notificaciones' | 'planes_suscripcion'>('mi_negocio');

  useEffect(() => {
    const handleOpenConfigDashboard = () => {
      setSystemConfigSubTab('dashboard');
      setCurrentMenu('settings');
      setExpandedGroups({ configuracion: true });
    };
    window.addEventListener('bellavista_open_config_dashboard', handleOpenConfigDashboard);
    return () => {
      window.removeEventListener('bellavista_open_config_dashboard', handleOpenConfigDashboard);
    };
  }, []);

  const handleMenuChange = (menu: AdminMenuType) => {
    setCurrentMenu(menu);
    const activeGroup = getGroupIdForMenu(menu);
    if (activeGroup) {
      setExpandedGroups({ [activeGroup]: true });
    }
    setIsSidebarCollapsed(true);
    setIsSidebarHovered(false);
    if (onMenuChange) {
      onMenuChange(menu);
    }
  };
  const [bcvRate, setBcvRate] = useState<number>(721.34);
  const [isEditingBcv, setIsEditingBcv] = useState<boolean>(false);
  const [bcvInputValue, setBcvInputValue] = useState<string>("721.34");
  const [eurInputValue, setEurInputValue] = useState<string>("0.92");
  const [copInputValue, setCopInputValue] = useState<string>("4000");
  const [bcvRatesHistory, setBcvRatesHistory] = useState<any[]>([]);

  useEffect(() => {
    if (currencyRates) {
      setEurInputValue(currencyRates.EUR.toString());
      setCopInputValue(currencyRates.COP.toString());
      if (currencyRates.VES) {
        setBcvInputValue(currencyRates.VES.toString());
        setBcvRate(currencyRates.VES);
      }
    }
  }, [currencyRates]);

  const fetchBcvRate = async () => {
    try {
      const latest = await dbService.getLatestBcvRate();
      if (latest && latest.rate !== undefined && latest.rate !== null) {
        setBcvRate(latest.rate);
        setBcvInputValue(latest.rate.toString());
      }
      const history = await dbService.getBcvRatesHistory();
      setBcvRatesHistory(history);
    } catch (err) {
      console.error("Error loading BCV rate:", err);
    }
  };

  const handleSaveBcvRate = async (rate: number) => {
    try {
      let finalRate = rate;
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

      await dbService.updateBcvRate(finalRate, 'Pedro (Admin)');
      setBcvRate(finalRate);
      setBcvInputValue(finalRate.toString());
      const history = await dbService.getBcvRatesHistory();
      setBcvRatesHistory(history);
    } catch (err: any) {
      console.error("Error updating BCV rate:", err);
      alert("Error al guardar la tasa: " + err.message);
    }
  };

  // --- Interactive administrative modules states ---
  // POS States
  const [posProductId, setPosProductId] = useState<string>('');
  const [posQty, setPosQty] = useState<number>(1);
  const [posClientName, setPosClientName] = useState<string>('');
  const [posClientPhone, setPosClientPhone] = useState<string>('');
  const [posPaymentMethod, setPosPaymentMethod] = useState<string>('Pago Móvil');
  const [posSales, setPosSales] = useState<any[]>([
    { id: 'FAC-2026-001', clientName: 'María Ramírez', totalUSD: 15.50, paymentMethod: 'Pago Móvil', date: 'Hace 2 horas', itemsCount: 3 },
    { id: 'FAC-2026-002', clientName: 'Juan Pérez', totalUSD: 45.00, paymentMethod: 'Zelle', date: 'Hace 4 horas', itemsCount: 1 }
  ]);
  const [posSuccessMsg, setPosSuccessMsg] = useState<string | null>(null);

  // Cash / Caja States
  const [cashOps, setCashOps] = useState<any[]>([]);
  const [cashSessions, setCashSessions] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any | null>(null);

  const [showOpenCajaModal, setShowOpenCajaModal] = useState<boolean>(false);
  const [showCloseCajaModal, setShowCloseCajaModal] = useState<boolean>(false);
  const [openCajaAmountBs, setOpenCajaAmountBs] = useState<string>('10.00');
  const [closeCajaAmountBs, setCloseCajaAmountBs] = useState<string>('');
  const [cajaObservaciones, setCajaObservaciones] = useState<string>('');

  const [newOpConcept, setNewOpConcept] = useState<string>('');
  const [newOpAmount, setNewOpAmount] = useState<string>('');
  const [newOpType, setNewOpType] = useState<'ingreso' | 'egreso'>('ingreso');
  const [cajaSuccessMsg, setCajaSuccessMsg] = useState<string | null>(null);

  const fetchCajaData = async () => {
    try {
      const sessions = await dbService.getCashSessions();
      const ops = await dbService.getCashOps();
      const active = await dbService.getActiveCashSession();
      setCashSessions(sessions);
      setCashOps(ops);
      setActiveSession(active);
    } catch (e) {
      console.error("Error fetching Caja data:", e);
    }
  };

  // Configuration States
  const [configStoreName, setConfigStoreName] = useState<string>('Papelería & Suministros Bella Vista, C.A.');
  const [configRif, setConfigRif] = useState<string>('J-50987654-3');
  const [configIva, setConfigIva] = useState<number>(16);
  const [configPhone, setConfigPhone] = useState<string>('+58 412-5551234');
  const [configSaved, setConfigSaved] = useState<boolean>(false);

  // Taxes States
  const [adminTaxes, setAdminTaxes] = useState<Tax[]>([]);
  const [newTaxName, setNewTaxName] = useState<string>('');
  const [newTaxRate, setNewTaxRate] = useState<string>('');
  const [taxMessage, setTaxMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadAdminTaxes = async () => {
    try {
      const fetched = await dbService.getTaxes();
      setAdminTaxes(fetched || []);
    } catch (e) {
      console.error('Error loading taxes:', e);
    }
  };

  useEffect(() => {
    loadAdminTaxes();
    window.addEventListener('bellavista_taxes_updated', loadAdminTaxes);
    window.addEventListener('bellavista_cash_updated', fetchCajaData);
    return () => {
      window.removeEventListener('bellavista_taxes_updated', loadAdminTaxes);
      window.removeEventListener('bellavista_cash_updated', fetchCajaData);
    };
  }, []);

  // Global Delivery & Payment methods disable configuration states
  const [disableDeliveryB2C, setDisableDeliveryB2C] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('copias_bellavista_disabled_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.delivery_b2c !== undefined) return parsed.delivery_b2c === true;
      }
    } catch (e) {}
    return true; // Default TRUE (Disabled)
  });

  const [disableDeliveryRetiro, setDisableDeliveryRetiro] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('copias_bellavista_disabled_settings');
      if (saved) return JSON.parse(saved).delivery_retiro === true;
    } catch (e) {}
    return false;
  });

  const [disableCoupon, setDisableCoupon] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('copias_bellavista_disabled_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.disable_coupon !== undefined) return parsed.disable_coupon === true;
      }
    } catch (e) {}
    return true; // Default TRUE (Disabled)
  });

  const [disableCurrUSD, setDisableCurrUSD] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('copias_bellavista_disabled_settings');
      if (saved) return JSON.parse(saved).curr_usd === true;
    } catch (e) {}
    return false;
  });

  const [disableCurrEUR, setDisableCurrEUR] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('copias_bellavista_disabled_settings');
      if (saved) return JSON.parse(saved).curr_eur === true;
    } catch (e) {}
    return false;
  });

  const [disableCurrVES, setDisableCurrVES] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('copias_bellavista_disabled_settings');
      if (saved) return JSON.parse(saved).curr_ves === true;
    } catch (e) {}
    return false;
  });

  const [disableCurrCOP, setDisableCurrCOP] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('copias_bellavista_disabled_settings');
      if (saved) return JSON.parse(saved).curr_cop === true;
    } catch (e) {}
    return false;
  });

  const [disablePayPagomovil, setDisablePayPagomovil] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('copias_bellavista_disabled_settings');
      if (saved) return JSON.parse(saved).pay_pagomovil === true;
    } catch (e) {}
    return false;
  });

  const [disablePayEfectivo, setDisablePayEfectivo] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('copias_bellavista_disabled_settings');
      if (saved) return JSON.parse(saved).pay_efectivo === true;
    } catch (e) {}
    return false;
  });

  const [disablePayTransferencia, setDisablePayTransferencia] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('copias_bellavista_disabled_settings');
      if (saved) return JSON.parse(saved).pay_transferencia === true;
    } catch (e) {}
    return false;
  });

  const [disablePayPunto, setDisablePayPunto] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('copias_bellavista_disabled_settings');
      if (saved) return JSON.parse(saved).pay_punto === true;
    } catch (e) {}
    return false;
  });

  const [disablePayOtras, setDisablePayOtras] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('copias_bellavista_disabled_settings');
      if (saved) return JSON.parse(saved).pay_otras === true;
    } catch (e) {}
    return false;
  });

  const [disablePayBinance, setDisablePayBinance] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('copias_bellavista_disabled_settings');
      if (saved) return JSON.parse(saved).pay_binance === true;
    } catch (e) {}
    return false;
  });

  const [disablePayZelle, setDisablePayZelle] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('copias_bellavista_disabled_settings');
      if (saved) return JSON.parse(saved).pay_zelle === true;
    } catch (e) {}
    return false;
  });

  const [chartView, setChartView] = useState<'days' | 'months'>('days');
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'brands' | 'orders'>(initialTab || 'products');
  const [settingsTab, setSettingsTab] = useState<'mi_cuenta' | 'business' | 'bcv' | 'landing' | 'publicidad' | 'taxes' | 'mi_negocio' | 'facturacion' | 'inventario' | 'impresion' | 'dashboard_custom' | 'notificaciones'>('mi_cuenta');
  const [adSubTab, setAdSubTab] = useState<'landing' | 'banner' | 'carrusel'>('banner');
  const [bannerSlidesList, setBannerSlidesList] = useState<BannerSlide[]>([]);
  const [homeCarouselCardsList, setHomeCarouselCardsList] = useState<HomeCarouselCardItem[]>([]);
  const [landingConfigState, setLandingConfigState] = useState<LandingConfig>({
    is_active: isLandingActive,
    title: '¡Novedad Dulce! Tres Leches Especial Gourmet',
    subtitle: 'Disfruta de nuestra exquisita torta Tres Leches artesanal preparada con la receta original Bella Vista.',
    badge: '🍰 Novedad Especial',
    image_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=600&h=400',
    button_text: 'Explorar Colección Gourmet'
  });

  const [editingSlide, setEditingSlide] = useState<Partial<BannerSlide> | null>(null);
  const [showSlideModal, setShowSlideModal] = useState(false);
  const [adSaveSuccessMsg, setAdSaveSuccessMsg] = useState<string | null>(null);

  // ⚙️ ESTADOS COMPLEMENTARIOS PARA CONFIGURACIÓN DEL SISTEMA
  const [userPerfilNombre, setUserPerfilNombre] = useState<string>('');
  const [userPerfilDoc, setUserPerfilDoc] = useState<string>('');
  const [userPerfilPhone, setUserPerfilPhone] = useState<string>('');
  const [userPerfilEmail, setUserPerfilEmail] = useState<string>('');
  const [userPerfilPhoto, setUserPerfilPhoto] = useState<string>('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150');
  
  const [userPassword, setUserPassword] = useState<string>('');
  const [userNewPassword, setUserNewPassword] = useState<string>('');
  const [userConfirmPassword, setUserConfirmPassword] = useState<string>('');
  const [user2FA, setUser2FA] = useState<boolean>(false);
  const [userInterfaceLang, setUserInterfaceLang] = useState<'es' | 'en'>('es');
  const [userInterfaceTheme, setUserInterfaceTheme] = useState<'claro' | 'oscuro'>('claro');

  const [businessLogo, setBusinessLogo] = useState<string>('https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&q=80&w=150');
  const [businessAddress, setBusinessAddress] = useState<string>('Calle Bella Vista, Local #12, Maracaibo, Venezuela');
  const [businessSaaSPlan, setBusinessSaaSPlan] = useState<'gratuito' | 'basico' | 'pro' | 'enterprise'>('pro');
  const [businessBranches, setBusinessBranches] = useState<any[]>([
    { id: '1', name: 'Sede Principal Bella Vista', code: 'SP-01', address: 'Calle 72 con Av. Bella Vista', active: true },
    { id: '2', name: 'Sucursal Delicias Norte', code: 'SD-02', address: 'Av. 15 Las Delicias', active: false }
  ]);
  const [businessCajas, setBusinessCajas] = useState<any[]>([
    { id: '1', name: 'Caja Principal #1', code: 'C1', branch_id: '1', active: true },
    { id: '2', name: 'Caja Auxiliar #2', code: 'C2', branch_id: '1', active: true }
  ]);

  const [facturacionMultiCurrency, setFacturacionMultiCurrency] = useState<boolean>(true);
  const [facturacionMainCurrency, setFacturacionMainCurrency] = useState<'USD' | 'VES' | 'EUR'>('VES');
  const [facturacionExchangeAuto, setFacturacionExchangeAuto] = useState<boolean>(false);
  const [facturacionExenciones, setFacturacionExenciones] = useState<string>('Servicios Educativos, Fotocopias Escolares');
  const [facturacionRetencionesISLR, setFacturacionRetencionesISLR] = useState<number>(2);
  const [facturacionRetencionesIGTF, setFacturacionRetencionesIGTF] = useState<number>(3);
  const [facturacionCorrelativoFactura, setFacturacionCorrelativoFactura] = useState<number>(1024);
  const [facturacionCorrelativoCotizacion, setFacturacionCorrelativoCotizacion] = useState<number>(350);
  const [facturacionCorrelativoTicket, setFacturacionCorrelativoTicket] = useState<number>(5412);

  const [inventarioLowStockThreshold, setInventarioLowStockThreshold] = useState<number>(5);
  const [inventarioBlockNoStockSale, setInventarioBlockNoStockSale] = useState<boolean>(false);
  const [inventarioVirtualLink, setInventarioVirtualLink] = useState<string>('https://bellavista.sistemapos.com/tienda');
  const [inventarioScheduleMonFri, setInventarioScheduleMonFri] = useState<string>('08:00 - 18:00');
  const [inventarioScheduleSat, setInventarioScheduleSat] = useState<string>('09:00 - 14:00');
  const [inventarioScheduleSun, setInventarioScheduleSun] = useState<string>('Cerrado');
  const [inventarioHideOutOfStock, setInventarioHideOutOfStock] = useState<boolean>(false);
  const [inventarioGlobalUnits, setInventarioGlobalUnits] = useState<string[]>(['Unidades', 'Metros', 'Kilos', 'Servicios', 'Resmas']);
  const [newGlobalUnit, setNewGlobalUnit] = useState<string>('');

  const [impresionTicketFormat, setImpresionTicketFormat] = useState<'80mm' | '58mm' | 'carta' | 'pdf'>('58mm');
  const [impresionGreeting, setImpresionGreeting] = useState<string>('¡Gracias por su compra en Bella Vista!');
  const [impresionWarranty, setImpresionWarranty] = useState<string>('Conserve su ticket para cambios dentro de las 48 horas.');
  const [impresionPrinterConnected, setImpresionPrinterConnected] = useState<boolean>(true);
  const [impresionTriggerDrawer, setImpresionTriggerDrawer] = useState<boolean>(true);

  const [dashboardShowProfits, setDashboardShowProfits] = useState<boolean>(true);
  const [dashboardShowSales, setDashboardShowSales] = useState<boolean>(true);
  const [dashboardShowExpenses, setDashboardShowExpenses] = useState<boolean>(true);
  const [dashboardShowEmployeeSales, setDashboardShowEmployeeSales] = useState<boolean>(true);
  const [dashboardEmailReports, setDashboardEmailReports] = useState<'ninguno' | 'diario' | 'semanal' | 'mensual'>('diario');
  const [dashboardEmailReportsAddress, setDashboardEmailReportsAddress] = useState<string>('administracion@bellavista.com');

  const [notifSoundOnSale, setNotifSoundOnSale] = useState<boolean>(true);
  const [notifAlertUnopenedCash, setNotifAlertUnopenedCash] = useState<boolean>(true);
  const [notifPushLowStock, setNotifPushLowStock] = useState<boolean>(true);
  const [notifPushDailyClose, setNotifPushDailyClose] = useState<boolean>(true);

  // Sincronizar cargando desde localStorage/Supabase al montar
  useEffect(() => {
    try {
      const saved = localStorage.getItem('copias_bellavista_sys_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.userPerfilNombre) setUserPerfilNombre(parsed.userPerfilNombre);
        if (parsed.userPerfilDoc) setUserPerfilDoc(parsed.userPerfilDoc);
        if (parsed.userPerfilPhone) setUserPerfilPhone(parsed.userPerfilPhone);
        if (parsed.userPerfilEmail) setUserPerfilEmail(parsed.userPerfilEmail);
        if (parsed.userPerfilPhoto) setUserPerfilPhoto(parsed.userPerfilPhoto);
        if (parsed.user2FA !== undefined) setUser2FA(parsed.user2FA);
        if (parsed.userInterfaceLang) setUserInterfaceLang(parsed.userInterfaceLang);
        if (parsed.userInterfaceTheme) setUserInterfaceTheme(parsed.userInterfaceTheme);

        if (parsed.businessLogo) setBusinessLogo(parsed.businessLogo);
        if (parsed.businessAddress) setBusinessAddress(parsed.businessAddress);
        if (parsed.businessSaaSPlan) setBusinessSaaSPlan(parsed.businessSaaSPlan);
        if (parsed.businessBranches) setBusinessBranches(parsed.businessBranches);
        if (parsed.businessCajas) setBusinessCajas(parsed.businessCajas);

        if (parsed.configStoreName) setConfigStoreName(parsed.configStoreName);
        if (parsed.configRif) setConfigRif(parsed.configRif);
        if (parsed.configIva !== undefined) setConfigIva(parsed.configIva);
        if (parsed.configPhone) setConfigPhone(parsed.configPhone);

        if (parsed.facturacionMultiCurrency !== undefined) setFacturacionMultiCurrency(parsed.facturacionMultiCurrency);
        if (parsed.facturacionMainCurrency) setFacturacionMainCurrency(parsed.facturacionMainCurrency);
        if (parsed.facturacionExchangeAuto !== undefined) setFacturacionExchangeAuto(parsed.facturacionExchangeAuto);
        if (parsed.facturacionExenciones) setFacturacionExenciones(parsed.facturacionExenciones);
        if (parsed.facturacionRetencionesISLR !== undefined) setFacturacionRetencionesISLR(parsed.facturacionRetencionesISLR);
        if (parsed.facturacionRetencionesIGTF !== undefined) setFacturacionRetencionesIGTF(parsed.facturacionRetencionesIGTF);
        if (parsed.facturacionCorrelativoFactura !== undefined) setFacturacionCorrelativoFactura(parsed.facturacionCorrelativoFactura);
        if (parsed.facturacionCorrelativoCotizacion !== undefined) setFacturacionCorrelativoCotizacion(parsed.facturacionCorrelativoCotizacion);
        if (parsed.facturacionCorrelativoTicket !== undefined) setFacturacionCorrelativoTicket(parsed.facturacionCorrelativoTicket);

        if (parsed.inventarioLowStockThreshold !== undefined) setInventarioLowStockThreshold(parsed.inventarioLowStockThreshold);
        if (parsed.inventarioBlockNoStockSale !== undefined) setInventarioBlockNoStockSale(parsed.inventarioBlockNoStockSale);
        if (parsed.inventarioVirtualLink) setInventarioVirtualLink(parsed.inventarioVirtualLink);
        if (parsed.inventarioScheduleMonFri) setInventarioScheduleMonFri(parsed.inventarioScheduleMonFri);
        if (parsed.inventarioScheduleSat) setInventarioScheduleSat(parsed.inventarioScheduleSat);
        if (parsed.inventarioScheduleSun) setInventarioScheduleSun(parsed.inventarioScheduleSun);
        if (parsed.inventarioHideOutOfStock !== undefined) setInventarioHideOutOfStock(parsed.inventarioHideOutOfStock);
        if (parsed.inventarioGlobalUnits) setInventarioGlobalUnits(parsed.inventarioGlobalUnits);

        if (parsed.impresionTicketFormat) setImpresionTicketFormat(parsed.impresionTicketFormat);
        if (parsed.impresionGreeting) setImpresionGreeting(parsed.impresionGreeting);
        if (parsed.impresionWarranty) setImpresionWarranty(parsed.impresionWarranty);
        if (parsed.impresionPrinterConnected !== undefined) setImpresionPrinterConnected(parsed.impresionPrinterConnected);
        if (parsed.impresionTriggerDrawer !== undefined) setImpresionTriggerDrawer(parsed.impresionTriggerDrawer);

        if (parsed.dashboardShowProfits !== undefined) setDashboardShowProfits(parsed.dashboardShowProfits);
        if (parsed.dashboardShowSales !== undefined) setDashboardShowSales(parsed.dashboardShowSales);
        if (parsed.dashboardShowExpenses !== undefined) setDashboardShowExpenses(parsed.dashboardShowExpenses);
        if (parsed.dashboardShowEmployeeSales !== undefined) setDashboardShowEmployeeSales(parsed.dashboardShowEmployeeSales);
        if (parsed.dashboardEmailReports) setDashboardEmailReports(parsed.dashboardEmailReports);
        if (parsed.dashboardEmailReportsAddress) setDashboardEmailReportsAddress(parsed.dashboardEmailReportsAddress);

        if (parsed.notifSoundOnSale !== undefined) setNotifSoundOnSale(parsed.notifSoundOnSale);
        if (parsed.notifAlertUnopenedCash !== undefined) setNotifAlertUnopenedCash(parsed.notifAlertUnopenedCash);
        if (parsed.notifPushLowStock !== undefined) setNotifPushLowStock(parsed.notifPushLowStock);
        if (parsed.notifPushDailyClose !== undefined) setNotifPushDailyClose(parsed.notifPushDailyClose);
      } else if (currentUser) {
        setUserPerfilNombre(currentUser.name || '');
        setUserPerfilEmail(currentUser.email || '');
        setUserPerfilPhone(currentUser.phone || currentUser.telefono || '');
        setUserPerfilDoc(currentUser.document || currentUser.documento || '');
      }
    } catch (e) {
      console.error("Error loading full config:", e);
    }
  }, [currentUser]);

  const saveFullSystemConfig = async (customConfig?: any) => {
    const updatedConfig = customConfig || {
      userPerfilNombre,
      userPerfilDoc,
      userPerfilPhone,
      userPerfilEmail,
      userPerfilPhoto,
      user2FA,
      userInterfaceLang,
      userInterfaceTheme,
      businessLogo,
      businessAddress,
      businessSaaSPlan,
      businessBranches,
      businessCajas,
      configStoreName,
      configRif,
      configIva,
      configPhone,
      facturacionMultiCurrency,
      facturacionMainCurrency,
      facturacionExchangeAuto,
      facturacionExenciones,
      facturacionRetencionesISLR,
      facturacionRetencionesIGTF,
      facturacionCorrelativoFactura,
      facturacionCorrelativoCotizacion,
      facturacionCorrelativoTicket,
      inventarioLowStockThreshold,
      inventarioBlockNoStockSale,
      inventarioVirtualLink,
      inventarioScheduleMonFri,
      inventarioScheduleSat,
      inventarioScheduleSun,
      inventarioHideOutOfStock,
      inventarioGlobalUnits,
      impresionTicketFormat,
      impresionGreeting,
      impresionWarranty,
      impresionPrinterConnected,
      impresionTriggerDrawer,
      dashboardShowProfits,
      dashboardShowSales,
      dashboardShowExpenses,
      dashboardShowEmployeeSales,
      dashboardEmailReports,
      dashboardEmailReportsAddress,
      notifSoundOnSale,
      notifAlertUnopenedCash,
      notifPushLowStock,
      notifPushDailyClose
    };

    localStorage.setItem('copias_bellavista_sys_config', JSON.stringify(updatedConfig));
    localStorage.setItem('copias_bellavista_theme', updatedConfig.userInterfaceTheme);
    localStorage.setItem('copias_bellavista_sound_on_sale', String(updatedConfig.notifSoundOnSale));
    localStorage.setItem('copias_bellavista_block_no_stock_sale', String(updatedConfig.inventarioBlockNoStockSale));

    // Handle theme toggle inside DOM
    if (updatedConfig.userInterfaceTheme === 'oscuro') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Save to Supabase fallback app_config
    const { supabase } = dbService as any;
    try {
      if (supabase) {
        await supabase.from('app_config').upsert({
          key: 'sys_config',
          value: updatedConfig,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      }
    } catch (e) {
      console.warn("Supabase sys_config upsert failed:", e);
    }

    // Dispatch custom events
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('bellavista_settings_updated'));
    window.dispatchEvent(new CustomEvent('bellavista_theme_updated'));

    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 4000);
    alert('¡Configuraciones guardadas y aplicadas con éxito en el sistema!');
  };

  useEffect(() => {
    const loadPublicidadData = async () => {
      try {
        const slides = await dbService.getBannerSlides();
        setBannerSlidesList(slides);
        const landing = await dbService.getLandingConfig();
        setLandingConfigState(landing);
        const cards = await dbService.getHomeCarouselCards();
        setHomeCarouselCardsList(cards);
      } catch (e) {
        console.error('Error loading Publicidad data:', e);
      }
    };
    loadPublicidadData();
  }, []);

  const handleMoveCarouselCardUp = (index: number) => {
    if (index <= 0) return;
    const newCards = [...homeCarouselCardsList];
    const temp = newCards[index - 1];
    newCards[index - 1] = newCards[index];
    newCards[index] = temp;
    newCards.forEach((c, idx) => { c.sort_order = idx + 1; });
    setHomeCarouselCardsList(newCards);
  };

  const handleMoveCarouselCardDown = (index: number) => {
    if (index >= homeCarouselCardsList.length - 1) return;
    const newCards = [...homeCarouselCardsList];
    const temp = newCards[index + 1];
    newCards[index + 1] = newCards[index];
    newCards[index] = temp;
    newCards.forEach((c, idx) => { c.sort_order = idx + 1; });
    setHomeCarouselCardsList(newCards);
  };

  const handleToggleCarouselCardEnabled = (id: string) => {
    const newCards = homeCarouselCardsList.map((c) => (c.id === id ? { ...c, enabled: c.enabled === false ? true : false } : c));
    setHomeCarouselCardsList(newCards);
  };

  const handleUpdateCarouselCardField = (id: string, field: keyof HomeCarouselCardItem, value: any) => {
    const newCards = homeCarouselCardsList.map((c) => (c.id === id ? { ...c, [field]: value } : c));
    setHomeCarouselCardsList(newCards);
  };

  const handleSaveCarouselCardsToSupabase = async () => {
    try {
      await dbService.saveHomeCarouselCards(homeCarouselCardsList);
      setAdSaveSuccessMsg('¡Orden del Carrusel de Inicio guardado con éxito en Supabase!');
      setTimeout(() => setAdSaveSuccessMsg(null), 3000);
    } catch (e) {
      console.error('Error al guardar el orden del carrusel:', e);
    }
  };

  const handleMoveSlideUp = (index: number) => {
    if (index <= 0) return;
    const newSlides = [...bannerSlidesList];
    const temp = newSlides[index - 1];
    newSlides[index - 1] = newSlides[index];
    newSlides[index] = temp;
    newSlides.forEach((s, idx) => { s.sort_order = idx + 1; });
    setBannerSlidesList(newSlides);
  };

  const handleMoveSlideDown = (index: number) => {
    if (index >= bannerSlidesList.length - 1) return;
    const newSlides = [...bannerSlidesList];
    const temp = newSlides[index + 1];
    newSlides[index + 1] = newSlides[index];
    newSlides[index] = temp;
    newSlides.forEach((s, idx) => { s.sort_order = idx + 1; });
    setBannerSlidesList(newSlides);
  };

  const handleToggleSlideActive = (id: string) => {
    const newSlides = bannerSlidesList.map((s) => (s.id === id ? { ...s, active: !s.active } : s));
    setBannerSlidesList(newSlides);
  };

  const handleDeleteSlide = (id: string) => {
    const newSlides = bannerSlidesList.filter((s) => s.id !== id);
    newSlides.forEach((s, idx) => { s.sort_order = idx + 1; });
    setBannerSlidesList(newSlides);
  };

  const handleSaveSlideForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlide || !editingSlide.title || !editingSlide.image_url) return;

    if (editingSlide.id) {
      setBannerSlidesList((prev) =>
        prev.map((s) => (s.id === editingSlide.id ? ({ ...s, ...editingSlide } as BannerSlide) : s))
      );
    } else {
      const newSlide: BannerSlide = {
        id: `slide-${Date.now()}`,
        title: editingSlide.title || '',
        subtitle: editingSlide.subtitle || '',
        badge: editingSlide.badge || '',
        image_url: editingSlide.image_url || '',
        button_text: editingSlide.button_text || 'Ver Más',
        target_category: editingSlide.target_category || '',
        target_offer: editingSlide.target_offer || false,
        active: editingSlide.active !== undefined ? editingSlide.active : true,
        sort_order: bannerSlidesList.length + 1,
      };
      setBannerSlidesList((prev) => [...prev, newSlide]);
    }
    setShowSlideModal(false);
    setEditingSlide(null);
  };

  const handleSaveBannerConfigToSupabase = async () => {
    await dbService.saveBannerSlides(bannerSlidesList);
    setAdSaveSuccessMsg('¡Orden y pantallas del Banner guardados con éxito en Supabase!');
    setTimeout(() => setAdSaveSuccessMsg(null), 3500);
  };

  const handleSaveLandingConfigToSupabase = async () => {
    await dbService.saveLandingConfig(landingConfigState);
    if (onToggleLandingActive) onToggleLandingActive(landingConfigState.is_active);
    setAdSaveSuccessMsg('¡Configuración de Landing Especial guardada con éxito en Supabase!');
    setTimeout(() => setAdSaveSuccessMsg(null), 3500);
  };

  const [usersSubTab, setUsersSubTab] = useState<'internos' | 'externos' | 'permisos'>('internos');
  
  const [localLandingActive, setLocalLandingActive] = useState(isLandingActive);
  const [showLandingSaveSuccess, setShowLandingSaveSuccess] = useState(false);

  useEffect(() => {
    setLocalLandingActive(isLandingActive);
  }, [isLandingActive]);

  const handleSaveLanding = () => {
    if (onToggleLandingActive) {
      onToggleLandingActive(localLandingActive);
      setShowLandingSaveSuccess(true);
      setTimeout(() => setShowLandingSaveSuccess(false), 3000);
    }
  };

  useEffect(() => {
    if (initialMenu) {
      setCurrentMenu(initialMenu);
      if (initialMenu === 'orders') {
        setActiveTab('orders');
      } else if (initialMenu === 'products') {
        if (initialTab && initialTab !== 'orders') {
          setActiveTab(initialTab);
        } else {
          setActiveTab('products');
        }
      }
    } else if (initialTab) {
      setActiveTab(initialTab);
      if (initialTab === 'orders') {
        setCurrentMenu('orders');
      } else {
        setCurrentMenu('products');
      }
    }
  }, [initialTab, initialMenu]);

  useEffect(() => {
    fetchOrders();
    fetchBcvRate();
    fetchCajaData();
    fetchStoreUsers();
  }, []);

  const handleTabClick = (tab: 'products' | 'categories' | 'brands' | 'orders') => {
    setActiveTab(tab);
    setSearchQuery('');
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');

  // Orders State & Kanban View Controls
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [deliveryMethodFilter, setDeliveryMethodFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [waTemplate, setWaTemplate] = useState<'default' | 'availability' | 'validation' | 'issue'>('default');
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [ordersViewMode, setOrdersViewMode] = useState<'kanban' | 'table'>('kanban');
  const [soundAlertEnabled, setSoundAlertEnabled] = useState<boolean>(true);
  const prevOrdersCountRef = useRef<number | null>(null);

  // Pedidos Facturados / Historial modal states
  const [showPedidosFacturadosModal, setShowPedidosFacturadosModal] = useState<boolean>(false);
  const [pedidosFacturadosSearch, setPedidosFacturadosSearch] = useState<string>('');
  const [pedidosFacturadosTab, setPedidosFacturadosTab] = useState<'todos' | 'facturados' | 'pendientes' | 'cancelados'>('todos');
  const [selectedPedidoDigitalView, setSelectedPedidoDigitalView] = useState<Order | null>(null);
  const [selectedPedidoBcvRate, setSelectedPedidoBcvRate] = useState<number>(currencyRates?.VES || 36.5);

  // Sync historical BCV rate when opening an order in digital view
  useEffect(() => {
    if (selectedPedidoDigitalView) {
      const fallback = (selectedPedidoDigitalView as any).bcv_rate || currencyRates?.VES || 36.5;
      setSelectedPedidoBcvRate(fallback);
      if (selectedPedidoDigitalView.created_at) {
        dbService.getBcvRateForDate(selectedPedidoDigitalView.created_at, fallback)
          .then((rate) => {
            if (rate && rate > 0) {
              setSelectedPedidoBcvRate(rate);
            }
          })
          .catch((err) => {
            console.warn('Could not load historical BCV rate for order date:', err);
          });
      }
    }
  }, [selectedPedidoDigitalView, currencyRates]);

  // Filtered orders for "Pedidos Facturados" modal
  const filteredPedidosFacturadosList = useMemo(() => {
    return orders.filter(o => {
      // Tab filter
      const st = (o.status || '').toLowerCase();
      if (pedidosFacturadosTab === 'facturados' && st !== 'entregado') return false;
      if (pedidosFacturadosTab === 'pendientes' && (st === 'entregado' || st === 'cancelado')) return false;
      if (pedidosFacturadosTab === 'cancelados' && st !== 'cancelado') return false;

      // Search query
      if (pedidosFacturadosSearch.trim()) {
        const q = pedidosFacturadosSearch.toLowerCase();
        const num = String(o.order_number || o.id || '').toLowerCase();
        const client = (o.customer_name || '').toLowerCase();
        const phone = (o.phone_number || '').toLowerCase();
        if (!num.includes(q) && !client.includes(q) && !phone.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [orders, pedidosFacturadosSearch, pedidosFacturadosTab]);

  // Print Order Digital View helper
  const handlePrintOrderDigitalView = (order: any) => {
    const printWin = window.open('', '_blank', 'width=900,height=700');
    if (!printWin) {
      alert('Por favor permita las ventanas emergentes (pop-ups) para imprimir.');
      return;
    }

    const orderNumStr = String(order.order_number || order.id || '').padStart(6, '0');
    const clientName = order.customer_name || 'Consumidor Final';
    const clientPhone = order.phone_number || 'N/A';
    const payMethod = order.payment_method || 'Efectivo / Transferencia';
    const payStatus = order.payment_status || 'pendiente';
    const deliveryStatus = order.status || 'recibido';
    const createdAt = order.created_at ? new Date(order.created_at).toLocaleString('es-VE') : new Date().toLocaleString('es-VE');
    const totalUSD = Number(order.total_price || 0);
    const bcv = selectedPedidoBcvRate || (order as any).bcv_rate || currencyRates?.VES || 36.5;
    const totalBs = totalUSD * bcv;

    let itemsHtml = '';
    const items = order.items || [];
    if (items.length > 0) {
      items.forEach((item: any) => {
        const name = item.product_name || item.name || 'Artículo';
        const qty = Number(item.quantity || item.qty || 1);
        const price = Number(item.price || item.unit_price || 0);
        const sub = qty * price;
        itemsHtml += `
          <tr>
            <td style="padding: 6px 0; border-bottom: 1px dashed #ddd; font-size: 12px;">${name}</td>
            <td style="padding: 6px 0; border-bottom: 1px dashed #ddd; font-size: 12px; text-align: center;">${qty}</td>
            <td style="padding: 6px 0; border-bottom: 1px dashed #ddd; font-size: 12px; text-align: right;">$${sub.toFixed(2)}</td>
          </tr>
        `;
      });
    } else {
      itemsHtml = `
        <tr>
          <td colspan="3" style="padding: 10px 0; text-align: center; color: #666; font-size: 12px;">Pedido de servicios o productos generales</td>
        </tr>
      `;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Pedido #${orderNumStr} - Copias Bella Vista</title>
          <style>
            body { font-family: monospace, sans-serif; padding: 20px; color: #111; max-width: 400px; margin: 0 auto; }
            h2, h3 { text-align: center; margin: 5px 0; }
            .center { text-align: center; }
            .line { border-bottom: 1px dashed #333; margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; border-bottom: 1px solid #333; font-size: 11px; padding-bottom: 4px; }
            .right { text-align: right; }
          </style>
        </head>
        <body>
          <h2>COPIAS BELLA VISTA, C.A.</h2>
          <div class="center" style="font-size: 11px;">
            RIF: J-50987654-3<br/>
            Sector bella vista, calle 20 entre carrera 3 y 4<br/>
            Telf: +58 412-5043857
          </div>
          <div class="line"></div>
          <div style="font-size: 11px; line-height: 1.5;">
            <strong>PEDIDO N°:</strong> #${orderNumStr}<br/>
            <strong>FECHA:</strong> ${createdAt}<br/>
            <strong>CLIENTE:</strong> ${clientName} (${clientPhone})<br/>
            <strong>MÉTODO PAGO:</strong> ${payMethod}<br/>
            <strong>ESTADO PAGO:</strong> ${payStatus.toUpperCase()}<br/>
            <strong>ESTADO ENTREGA:</strong> ${deliveryStatus.toUpperCase()}
          </div>
          <div class="line"></div>
          <table>
            <thead>
              <tr>
                <th>DETALLE</th>
                <th class="center">CANT</th>
                <th class="right">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div class="line"></div>
          <div style="font-size: 12px; display: flex; justify-content: space-between;">
            <strong>TOTAL NETO:</strong>
            <strong style="float: right;">$${totalUSD.toFixed(2)} USD</strong>
          </div>
          <div style="font-size: 11px; text-align: right; margin-top: 6px; padding: 6px 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
            <span style="font-size: 9px; font-weight: bold; color: #64748b; text-transform: uppercase; display: block;">PAGO EN DIVISAS / BS. BCV</span>
            <span style="font-size: 12px; font-weight: 900; color: #1e293b; display: block;">Bs. ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span style="font-size: 10px; color: #64748b; display: block;">Tasa Oficial BCV: 1 USD = Bs. ${bcv.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div class="line"></div>
          <div class="center" style="font-size: 10px; margin-top: 15px;">
            *** GRACIAS POR SU PREFERENCIA ***<br/>
            Representación digital de pedido de cliente.
          </div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  const playNewOrderChime = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.18); // A5
      gain2.gain.setValueAtTime(0.25, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.65);
    } catch (e) {
      console.warn('Audio alert not triggered:', e);
    }
  };

  // --- Clientes con Identificación Venezolana State ---
  const [dbClients, setDbClients] = useState<any[]>([]);
  const [loadingClients, setLoadingClients] = useState<boolean>(false);
  const [clientSearch, setClientSearch] = useState<string>('');
  const [showClientModal, setShowClientModal] = useState<boolean>(false);
  const [selectedClientForEdit, setSelectedClientForEdit] = useState<any | null>(null);

  const filteredDbClients = dbClients.filter(c => {
    const q = (clientSearch || '').toLowerCase().trim();
    if (!q) return true;
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.code || '').toLowerCase().includes(q) ||
      (c.document || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q)
    );
  });

  // Client modal form state
  const [clientFormName, setClientFormName] = useState<string>('');
  const [clientFormDocument, setClientFormDocument] = useState<string>('');
  const [clientFormType, setClientFormType] = useState<string>('Natural');
  const [clientFormPhone, setClientFormPhone] = useState<string>('');
  const [clientFormEmail, setClientFormEmail] = useState<string>('');
  const [clientFormCredit, setClientFormCredit] = useState<number>(0);

  // Store users state
  const [storeUsers, setStoreUsers] = useState<StoreUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userFormName, setUserFormName] = useState('');
  const [userFormEmail, setUserFormEmail] = useState('');
  const [userFormPassword, setUserFormPassword] = useState('');
  const [userFormRole, setUserFormRole] = useState('Cajero');
  const [userFormClientCode, setUserFormClientCode] = useState('');
  const [userFormError, setUserFormError] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Permissions & Activation switches state
  const [showPermissionsModal, setShowPermissionsModal] = useState<boolean>(false);
  const [permissionUser, setPermissionUser] = useState<StoreUser | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [showSqlModal, setShowSqlModal] = useState<boolean>(false);
  const [sqlCopied, setSqlCopied] = useState<boolean>(false);

  const ALL_MODULES = [
    { id: 'orders', name: 'Pedidos de Cliente', desc: 'Acceso a gestión de pedidos y órdenes de despacho' },
    { id: 'sales', name: 'Venta Flash', desc: 'Punto de venta, emisión de facturas y cobros en caja' },
    { id: 'products', name: 'Productos e Inventario', desc: 'Gestión de catálogo, precios, stock y categorías' },
    { id: 'caja', name: 'Caja', desc: 'Apertura y cierre de caja, control de flujo en efectivo/divisas' },
    { id: 'clientes', name: 'Clientes (Directorio RIF/Cédula)', desc: 'Directorio de clientes, cuentas corrientes y datos de contacto' },
    { id: 'proveedores', name: 'Proveedores', desc: 'Gestión de proveedores y recepción de mercancía' },
    { id: 'compras', name: 'Compras', desc: 'Creación de órdenes de compra y control de adquisiciones' },
    { id: 'reportes', name: 'Finanzas', desc: 'Métricas de ingresos, balance, gastos fijos y ganancias' },
    { id: 'settings', name: 'Configuración del Sistema', desc: 'Tasa BCV, landing page y ajustes generales de la empresa' },
    { id: 'marketing', name: 'Marketing & Banners', desc: 'Campañas promocionales y banners publicitarios' }
  ];

  const getDefaultPermissionsForRole = (role: string): string[] => {
    const r = (role || '').toLowerCase();
    if (r === 'gerente' || r === 'admin' || r === 'administrador') {
      return ['orders', 'sales', 'products', 'caja', 'clientes', 'proveedores', 'compras', 'reportes', 'settings', 'marketing'];
    }
    if (r === 'cajero') {
      return ['orders', 'sales', 'caja', 'clientes'];
    }
    if (r === 'despachador') {
      return ['products'];
    }
    if (r === 'repartidor') {
      return ['orders'];
    }
    return ['orders', 'sales', 'products', 'caja', 'clientes'];
  };

  const handleOpenPermissionsModal = (user: StoreUser) => {
    setPermissionUser(user);
    const existing = user.permissions && user.permissions.length > 0 
      ? user.permissions 
      : getDefaultPermissionsForRole(user.role);
    setUserPermissions(existing);
    setShowPermissionsModal(true);
  };

  const handleToggleModulePermission = (moduleId: string) => {
    setUserPermissions(prev => {
      if (prev.includes(moduleId)) {
        return prev.filter(m => m !== moduleId);
      } else {
        return [...prev, moduleId];
      }
    });
  };

  const handleSavePermissions = async () => {
    if (!permissionUser) return;
    setLoadingUsers(true);
    try {
      const id = permissionUser.id || permissionUser.email;
      await dbService.updateStoreUser(id, { permissions: userPermissions });
      await fetchStoreUsers();
      setShowPermissionsModal(false);
      setPermissionUser(null);
    } catch (err) {
      console.error('Error saving user permissions:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchStoreUsers = async () => {
    setLoadingUsers(true);
    const users = await dbService.getStoreUsers();
    setStoreUsers(users);
    setLoadingUsers(false);
  };

  useEffect(() => {
    if (currentMenu === 'users') {
      fetchStoreUsers();
      fetchClients();
    }
  }, [currentMenu, usersSubTab]);

  const handleSaveStoreUser = async () => {
    setUserFormError('');
    if (!userFormName.trim() || !userFormEmail.trim() || !userFormRole) {
      setUserFormError('Por favor complete el nombre, correo y rol.');
      return;
    }

    if (!editingUserId && !userFormPassword.trim()) {
      setUserFormError('Por favor ingrese una contraseña para el usuario.');
      return;
    }

    setLoadingUsers(true);
    try {
      if (editingUserId) {
        const updates: Partial<StoreUser> = {
          name: userFormName.trim(),
          email: userFormEmail.trim().toLowerCase(),
          role: userFormRole,
          permissions: getDefaultPermissionsForRole(userFormRole),
          client_code: userFormRole === 'Cliente' ? userFormClientCode : undefined
        };
        if (userFormPassword.trim()) {
          updates.password = userFormPassword.trim();
        }
        const success = await dbService.updateStoreUser(editingUserId, updates);
        if (success) {
          await fetchStoreUsers();
          setShowUserModal(false);
        } else {
          setUserFormError('Error al guardar cambios en la base de datos.');
        }
      } else {
        const newUser = await dbService.addStoreUser({
          name: userFormName.trim(),
          email: userFormEmail.trim().toLowerCase(),
          password: userFormPassword.trim(),
          role: userFormRole,
          permissions: getDefaultPermissionsForRole(userFormRole),
          is_active: true,
          client_code: userFormRole === 'Cliente' ? userFormClientCode : undefined
        });
        if (newUser) {
          await fetchStoreUsers();
          setShowUserModal(false);
        } else {
          setUserFormError('Error al crear usuario en la base de datos.');
        }
      }
    } catch (err: any) {
      console.error('Error saving store user:', err);
      setUserFormError('Error al procesar: ' + (err.message || 'Error de conexión'));
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleDeleteStoreUser = async (id: string, name: string) => {
    if (!confirm(`¿Está seguro de eliminar al usuario "${name}"?`)) return;
    const success = await dbService.deleteStoreUser(id);
    if (success) {
      setStoreUsers(storeUsers.filter(u => u.id !== id));
    } else {
      alert('Error al eliminar el usuario de la base de datos.');
    }
  };

  const handleToggleStoreUserStatus = async (id: string, currentStatus: boolean) => {
    // Only Admin or Gerente can toggle status
    if ((activeRole as string) !== 'Admin' && (activeRole as string) !== 'Gerente' && activeRole !== 'admin') {
      alert('No tienes permisos para desactivar usuarios.');
      return;
    }
    const success = await dbService.updateStoreUser(id, { is_active: !currentStatus });
    if (success) {
      setStoreUsers(storeUsers.map(u => u.id === id ? { ...u, is_active: !currentStatus } : u));
    }
  };

  const fetchClients = async () => {
    setLoadingClients(true);
    try {
      const data = await dbService.getClients();
      setDbClients(data);
    } catch (e) {
      console.error("Error loading clients:", e);
    } finally {
      setLoadingClients(false);
    }
  };

  // --- Providers State ---
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState<boolean>(false);
  const [providerSearch, setProviderSearch] = useState<string>('');
  const [showProviderModal, setShowProviderModal] = useState<boolean>(false);
  const [selectedProviderForEdit, setSelectedProviderForEdit] = useState<Provider | null>(null);

  // Form State
  const [providerFormCode, setProviderFormCode] = useState<string>('');
  const [providerFormName, setProviderFormName] = useState<string>('');
  const [providerFormRif, setProviderFormRif] = useState<string>('');
  const [providerFormType, setProviderFormType] = useState<string>('Jurídico');
  const [providerFormPhone, setProviderFormPhone] = useState<string>('');
  const [providerFormBankName, setProviderFormBankName] = useState<string>('');

  const filteredProviders = providers.filter(p => {
    const q = (providerSearch || '').toLowerCase().trim();
    if (!q) return true;
    return (
      (p.name || '').toLowerCase().includes(q) ||
      (p.code || '').toLowerCase().includes(q) ||
      (p.rif || '').toLowerCase().includes(q) ||
      (p.phone || '').toLowerCase().includes(q) ||
      (p.bank_name || '').toLowerCase().includes(q)
    );
  });

  const fetchProviders = async () => {
    setLoadingProviders(true);
    try {
      const data = await dbService.getProviders();
      setProviders(data);
    } catch (e) {
      console.error("Error loading providers:", e);
    } finally {
      setLoadingProviders(false);
    }
  };

  const getNextProviderCode = (providerList: Provider[]): string => {
    let maxNum = 0;
    (providerList || []).forEach(p => {
      if (!p.code) return;
      const match = p.code.match(/(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });
    const nextNum = maxNum + 1;
    return nextNum < 1000 ? `PROV-${String(nextNum).padStart(3, '0')}` : `PROV-${nextNum}`;
  };

  const handleSaveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const generatedCode = providerFormCode.trim() || getNextProviderCode(providers);
      const providerData = {
        code: generatedCode,
        name: providerFormName.trim(),
        rif: providerFormRif.trim(),
        type: providerFormType,
        phone: providerFormPhone.trim(),
        bank_name: providerFormBankName.trim()
      };

      if (selectedProviderForEdit) {
        await dbService.updateProvider(selectedProviderForEdit.id, providerData);
      } else {
        await dbService.createProvider(providerData);
      }

      setShowProviderModal(false);
      setSelectedProviderForEdit(null);
      fetchProviders();
    } catch (err: any) {
      console.error("Error saving provider:", err);
      alert("Error al guardar proveedor: " + err.message);
    }
  };

  const handleDeleteProvider = async (id: string, name: string) => {
    if (!confirm(`¿Está seguro de eliminar al proveedor "${name}"?`)) return;
    try {
      await dbService.deleteProvider(id);
      fetchProviders();
    } catch (err: any) {
      console.error("Error deleting provider:", err);
      alert("Error al eliminar proveedor: " + err.message);
    }
  };

  const openAddProviderModal = () => {
    setSelectedProviderForEdit(null);
    setProviderFormCode(getNextProviderCode(providers));
    setProviderFormName('');
    setProviderFormRif('');
    setProviderFormType('Jurídico');
    setProviderFormPhone('');
    setProviderFormBankName('');
    setShowProviderModal(true);
  };

  const openEditProviderModal = (provider: Provider) => {
    setSelectedProviderForEdit(provider);
    setProviderFormCode(provider.code || '');
    setProviderFormName(provider.name);
    setProviderFormRif(provider.rif);
    setProviderFormType(provider.type || 'Jurídico');
    setProviderFormPhone(provider.phone || '');
    setProviderFormBankName(provider.bank_name || '');
    setShowProviderModal(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const clientData = {
        name: clientFormName.trim(),
        document: clientFormDocument.trim(),
        type: clientFormType,
        phone: clientFormPhone.trim(),
        email: clientFormEmail.trim(),
        credit_usd: Number(clientFormCredit) || 0
      };

      if (selectedClientForEdit) {
        await dbService.updateClient(selectedClientForEdit.id, clientData);
      } else {
        await dbService.createClient(clientData);
      }

      setShowClientModal(false);
      setSelectedClientForEdit(null);
      fetchClients();
    } catch (err: any) {
      console.error("Error saving client:", err);
      alert("Error al guardar cliente: " + err.message);
    }
  };

  const handleDeleteClient = async (id: string, name: string) => {
    if (!confirm(`¿Está seguro de eliminar al cliente "${name}"?`)) return;
    try {
      await dbService.deleteClient(id);
      fetchClients();
    } catch (err: any) {
      console.error("Error deleting client:", err);
      alert("Error al eliminar cliente: " + err.message);
    }
  };

  const openEditClientModal = (client: any) => {
    setSelectedClientForEdit(client);
    setClientFormName(client.name);
    setClientFormDocument(client.document);
    setClientFormType(client.type || 'Natural');
    setClientFormPhone(client.phone || '');
    setClientFormEmail(client.email || '');
    setClientFormCredit(client.credit_usd || 0);
    setShowClientModal(true);
  };

  const openAddClientModal = () => {
    setSelectedClientForEdit(null);
    setClientFormName('');
    setClientFormDocument('');
    setClientFormType('Natural');
    setClientFormPhone('');
    setClientFormEmail('');
    setClientFormCredit(0);
    setShowClientModal(true);
  };

  useEffect(() => {
    if (currentMenu === 'clientes') {
      fetchClients();
    }
    if (currentMenu === 'proveedores') {
      fetchProviders();
    }
  }, [currentMenu]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedOrder) {
      setWaTemplate('default');
    }
  }, [selectedOrder]);

  const fetchOrders = async (silent = false) => {
    if (!silent) setLoadingOrders(true);
    setOrdersError(null);
    try {
      const data = await dbService.getOrders();
      if (prevOrdersCountRef.current !== null && data.length > prevOrdersCountRef.current && soundAlertEnabled) {
        playNewOrderChime();
      }
      prevOrdersCountRef.current = data.length;
      setOrders(data);
    } catch (e: any) {
      console.error("Error loading orders inside AdminPanel:", e);
      setOrdersError(e.message || "No se pudieron cargar los pedidos de la base de datos.");
    } finally {
      if (!silent) setLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    // 1. Listen for in-app events dispatched across window
    const handleOrderEvent = () => {
      fetchOrders(true);
    };

    window.addEventListener('bellavista_orders_updated', handleOrderEvent);
    window.addEventListener('storage', handleOrderEvent);

    // 2. Real-time Supabase Postgres changes subscription on 'orders' table
    let ordersChannel: any = null;
    if (supabase) {
      ordersChannel = supabase
        .channel('realtime:admin_orders_kanban_sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          () => {
            fetchOrders(true);
          }
        )
        .subscribe();
    }

    // 3. Fast high-frequency polling interval (every 3 seconds) for instant sync fallback
    const syncInterval = setInterval(() => {
      fetchOrders(true);
    }, 3000);

    return () => {
      window.removeEventListener('bellavista_orders_updated', handleOrderEvent);
      window.removeEventListener('storage', handleOrderEvent);
      if (ordersChannel && supabase) {
        supabase.removeChannel(ordersChannel);
      }
      clearInterval(syncInterval);
    };
  }, [soundAlertEnabled]);

  useEffect(() => {
    if (currentMenu === 'orders' || activeTab === 'orders') {
      fetchOrders(true);
    }
  }, [currentMenu, activeTab]);

  // Pending changes for Status and Payment Status
  const [pendingChanges, setPendingChanges] = useState<Record<string, { status?: string; payment_status?: string }>>({});

  const handlePendingChange = (orderId: string, field: 'status' | 'payment_status', value: string) => {
    if (field === 'status') {
      const newStatus = value.toLowerCase();
      const currentPaymentStatus = (
        pendingChanges[orderId]?.payment_status ?? 
        (orders.find(o => o.id === orderId)?.payment_status || 'pendiente')
      ).toLowerCase();
      
      if (currentPaymentStatus === 'pendiente' && ['listo para retirar', 'en camino', 'entregado'].includes(newStatus)) {
        alert("🚨 ¡RESTRICCIÓN DE CONTROL DE PAGOS!\n\nNo se puede cambiar el estado de entrega a '" + value.toUpperCase() + "' si el estado de pago del pedido es 'PENDIENTE'.\n\nEl cliente debe registrar o confirmar su pago antes de proceder con el despacho o entrega. (Nota: Sí está permitido CANCELAR el pedido).");
        return;
      }
    }

    if (field === 'payment_status') {
      const newPaymentStatus = value.toLowerCase();
      const currentStatus = (
        pendingChanges[orderId]?.status ?? 
        (orders.find(o => o.id === orderId)?.status || 'recibido')
      ).toLowerCase();

      if (newPaymentStatus === 'pendiente' && ['listo para retirar', 'en camino', 'entregado'].includes(currentStatus)) {
        alert("🚨 ¡CONTRADICCIÓN DE ESTADO DE PAGO!\n\nNo se puede revertir el estado de pago a 'PENDIENTE' para un pedido que ya se encuentra en estado '" + currentStatus.toUpperCase() + "'. Un pedido en esta fase logística debe tener su pago asentado y verificado.");
        return;
      }
    }

    setPendingChanges(prev => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        [field]: value
      }
    }));
  };

  const handleConfirmOrderChanges = async (orderId: string) => {
    const changes = pendingChanges[orderId];
    if (!changes) return;

    const orderObj = orders.find(o => o.id === orderId);

    setUpdatingOrderId(orderId);
    try {
      const updates: any = {};
      if (changes.status !== undefined) updates.status = changes.status;
      if (changes.payment_status !== undefined) updates.payment_status = changes.payment_status;

      const oldStatus = (orderObj?.status || '').toLowerCase();
      const newStatus = (changes.status || '').toLowerCase();
      const oldPaymentStatus = (orderObj?.payment_status || '').toLowerCase();
      const newPaymentStatus = (changes.payment_status || '').toLowerCase();

      // Check if status transitions to 'entregado' or 'completado'
      const isStatusDelivered = (newStatus === 'entregado' || newStatus === 'completado') && oldStatus !== 'entregado' && oldStatus !== 'completado';
      // Check if payment status transitions to 'pagado'
      const isPaymentPaid = newPaymentStatus === 'pagado' && oldPaymentStatus !== 'pagado';

      // If status transitions to 'entregado'/'completado', subtract from inventory
      if (changes.status !== undefined && isStatusDelivered && orderObj && Array.isArray(orderObj.items)) {
        for (const item of orderObj.items) {
          const prod = products.find(p => p.id === item.product_id);
          if (prod) {
            const currentStock = prod.stock;
            const newStock = Math.max(0, currentStock - Number(item.quantity || 0));
            await dbService.updateProduct(prod.id, { stock: newStock });
          }
        }
        if (onRefreshData) {
          onRefreshData();
        }
      }

      // Unified registration of income in Cash register (Caja)
      if ((isStatusDelivered || isPaymentPaid) && orderObj) {
        try {
          const orderNumStr = String(orderObj.order_number || '').padStart(6, '0');
          // Check if already registered
          const alreadyRegistered = cashOps.some((op: any) => 
            (op.concept || '').includes(`Pedido #${orderNumStr}`)
          );

          if (!alreadyRegistered) {
            const amountBs = (orderObj.total_price || 0) * bcvRate;
            await dbService.addCashOp({
              type: 'ingreso',
              concept: `Venta Online - Pedido #${orderNumStr} (${orderObj.customer_name})`,
              amount: orderObj.total_price || 0,
              amount_bs: amountBs,
              payment_method: orderObj.payment_method || 'Pago Móvil'
            });
            await fetchCajaData();
          }
        } catch (cajaErr) {
          console.error("Failed to register order income in cash register:", cajaErr);
        }
      }

      // If status transitions FROM 'entregado'/'completado' to something else, restore to inventory
      const wasDelivered = oldStatus === 'entregado' || oldStatus === 'completado';
      const isNoLongerDelivered = newStatus !== 'entregado' && newStatus !== 'completado';
      if (changes.status !== undefined && wasDelivered && isNoLongerDelivered && orderObj && Array.isArray(orderObj.items)) {
        for (const item of orderObj.items) {
          const prod = products.find(p => p.id === item.product_id);
          if (prod) {
            const currentStock = prod.stock;
            const newStock = currentStock + Number(item.quantity || 0);
            await dbService.updateProduct(prod.id, { stock: newStock });
          }
        }
        if (onRefreshData) {
          onRefreshData();
        }
      }

      await dbService.updateOrder(orderId, updates);
      
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o));
      
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, ...updates } : null);
      }

      // Clear pending changes for this order
      setPendingChanges(prev => {
        const copy = { ...prev };
        delete copy[orderId];
        return copy;
      });

      alert("¡Estados confirmados y guardados en la base de datos exitosamente!");

      // Enviar notificación por WhatsApp si el pedido existe
      if (orderObj) {
        const statusChanged = changes.status !== undefined && changes.status !== null && (changes.status || '').toLowerCase() !== (orderObj.status || '').toLowerCase();
        const paymentStatusChanged = changes.payment_status !== undefined && changes.payment_status !== null && (changes.payment_status || '').toLowerCase() !== (orderObj.payment_status || '').toLowerCase();

        if (statusChanged || paymentStatusChanged) {
          const formatStatusSpanish = (s?: string | null): string => {
            if (!s) return 'Pendiente';
            const val = (s || '').toLowerCase().trim();
            if (val === 'pendiente' || val === 'recibido') return 'Recibido / Pendiente ⏳';
            if (val === 'preparacion' || val === 'en preparacion' || val === 'preparando') return 'En Preparación 🛠️';
            if (val === 'listo' || val === 'listo para retirar' || val === 'listo para retirar en tienda') return 'Listo para retirar en tienda 📦';
            if (val === 'en_camino' || val === 'en camino') return 'En camino a tu dirección 🛵';
            if (val === 'entregado') return 'Entregado con éxito ✅';
            if (val === 'cancelado') return 'Cancelado / Anulado ❌';
            return s;
          };

          const formatPaymentSpanish = (p?: string | null): string => {
            if (!p) return 'Pendiente ⏳';
            const val = (p || '').toLowerCase().trim();
            if (val === 'pendiente') return 'Pendiente ⏳';
            if (val === 'pagado') return 'Pagado / Verificado 🟢';
            if (val === 'reembolsado') return 'Reembolsado 🔄';
            return p;
          };

          const orderNumberStr = String(orderObj.order_number || '').padStart(6, '0');
          const cleanPhone = orderObj.phone_number.replace(/\D/g, '');

          let text = `*Copias Bella Vista Barinitas 🖨️✨*\n`;
          text += `¡Hola, *${orderObj.customer_name}*! Te saludamos para informarte sobre la actualización en tiempo real de tu pedido *#${orderNumberStr}*:\n\n`;

          if (statusChanged) {
            text += `📦 *Estado de la Entrega:* ~${formatStatusSpanish(orderObj.status)}~ ➡️ *${formatStatusSpanish(changes.status)}*\n`;
          } else {
            text += `📦 *Estado de la Entrega:* *${formatStatusSpanish(orderObj.status)}*\n`;
          }

          if (paymentStatusChanged) {
            text += `💳 *Estado de Pago:* ~${formatPaymentSpanish(orderObj.payment_status)}~ ➡️ *${formatPaymentSpanish(changes.payment_status)}*\n`;
          } else {
            text += `💳 *Estado de Pago:* *${formatPaymentSpanish(orderObj.payment_status)}*\n`;
          }

          text += `\n💵 *Total del Pedido:* $${Number(orderObj.total_price || 0).toFixed(2)}\n`;
          text += `🛒 *Método de entrega:* ${orderObj.delivery_method === 'retiro' ? 'Retiro en Tienda' : 'Envío a Domicilio'}\n\n`;
          
          // Direct Live Tracking Link
          text += `🔗 *Sigue el estado en vivo de tu pedido aquí:*\n`;
          text += `${window.location.origin}/?pedido=${orderObj.id}\n\n`;
          
          text += `¡Muchas gracias por elegirnos! Si tienes dudas o comentarios adicionales, puedes responder a este chat. 😊`;

          // Send push notification via Web Push in the background
          const pushTitle = 'Copias Bella Vista 🖨️';
          let pushBody = `Tu pedido #${orderNumberStr} tiene novedades.`;
          if (statusChanged && paymentStatusChanged) {
            pushBody = `Actualizado: Entrega: ${changes.status || 'Recibido'} | Pago: ${changes.payment_status || 'Pendiente'}`;
          } else if (statusChanged) {
            pushBody = `Tu pedido #${orderNumberStr} cambió de estado a: ${changes.status || 'Recibido'}`;
          } else if (paymentStatusChanged) {
            pushBody = `Tu pago del pedido #${orderNumberStr} cambió de estado a: ${changes.payment_status || 'Pendiente'}`;
          }

          sendPushNotification(orderId, pushTitle, pushBody)
            .then(sent => {
              if (sent) console.log("Push notification triggered successfully on the backend.");
            })
            .catch(err => console.error("Could not trigger background push notification:", err));

          // Ask if they want to send the message
          const confirmWhatsApp = window.confirm(
            `🔔 ¿DESEAS NOTIFICAR AL CLIENTE POR WHATSAPP?\n\nSe ha actualizado el estado de su pedido exitosamente.\n\nCliente: ${orderObj.customer_name}\nTeléfono: ${orderObj.phone_number}\n\nHaz clic en Aceptar para abrir WhatsApp con el mensaje preconfigurado.`
          );

          if (confirmWhatsApp) {
            const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
            window.open(whatsappUrl, '_blank');
          }
        }
      }
    } catch (e: any) {
      console.error("Error confirming order changes:", e);
      alert(`Error al actualizar la base de datos: ${e.message || e.toString()}`);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const getWhatsAppMessageText = (order: Order, template: 'default' | 'availability' | 'validation' | 'issue') => {
    const orderNumberStr = String(order.order_number || '').padStart(6, '0');
    const totalPriceFormatted = Number(order.total_price || 0).toFixed(2);
    
    if (template === 'default') {
      let paymentDetails = '';
      const pm = (order.payment_method || '').toLowerCase().trim();
      
      if (pm === 'pagomovil') {
        paymentDetails = `📱 *Datos de Pago Móvil:*\n🏦 *Banco:* Banco Banesco\n🆔 *Cédula:* V-12.206.392\n📞 *Teléfono:* 0412-504.38.57\n\nPor favor, realiza tu pago y *envía el capture o comprobante de pago* por esta vía para proceder con la verificación de tu pedido.`;
      } else if (pm === 'transferencia') {
        paymentDetails = `🏦 *Datos de Transferencia Bancaria:*\n🏦 *Banco:* Banco Banesco\n🆔 *Cédula:* V-12.206.392\n📞 *Teléfono:* 0412-504.38.57\n\nPor favor, realiza tu transferencia y *envía el capture o comprobante de pago* por esta vía para proceder con la verificación de tu pedido.`;
      } else if (pm === 'efectivo') {
        const payWith = order.payment_amount_with ? ` (pagas con: US$ ${Number(order.payment_amount_with).toFixed(2)})` : '';
        paymentDetails = `💵 *Pago en Efectivo (USD / Bs):*\nEl método de pago seleccionado es efectivo en tienda${payWith}.\n\nPor favor, *envía un capture, foto o confirma por este medio* la hora estimada en la que pasarás a retirar y pagar tu pedido para tenerlo listo y agilizar tu atención.`;
      } else {
        paymentDetails = `💳 *Datos de Pago (Pago Móvil / Transferencia):*\n🏦 *Banco:* Banco Banesco\n🆔 *Cédula:* V-12.206.392\n📞 *Teléfono:* 0412-504.38.57\n\nPor favor, realiza tu pago por el método que prefieras y *envía el capture o comprobante de pago* por esta vía para proceder con la verificación de tu pedido.`;
      }

      return `*Copias Bella Vista Barinitas 🖨️✨*\n\nHola *${order.customer_name}*, te saludamos cordialmente. Referente a tu pedido *#${orderNumberStr}* por un total de *$${totalPriceFormatted}*:\n\n${paymentDetails}\n\n¡Muchas gracias por elegirnos! 😊`;
    }
    
    if (template === 'availability') {
      return `*Copias Bella Vista Barinitas 🖨️✨*\n\nHola *${order.customer_name}*, te saludamos cordialmente. Nos comunicamos referente a tu pedido *#${orderNumberStr}* para informarte que todos los artículos de tu solicitud se encuentran *totalmente disponibles y listos para procesar*.\n\nQuedamos atentos a tus comentarios para continuar con el pedido. ¡Muchas gracias! 👍`;
    }
    
    if (template === 'validation') {
      return `*Copias Bella Vista Barinitas 🖨️✨*\n\nHola *${order.customer_name}*, te saludamos cordialmente. Te informamos que hemos *verificado con éxito tu pago* para el pedido *#${orderNumberStr}* por un total de *$${totalPriceFormatted}*.\n\nTu pedido ha sido validado correctamente y ya se encuentra en fase de procesamiento. ¡Muchas gracias por tu confianza! 🟢`;
    }
    
    if (template === 'issue') {
      return `*Copias Bella Vista Barinitas 🖨️✨*\n\nHola *${order.customer_name}*, te saludamos cordialmente. Nos comunicamos contigo referente a tu pedido *#${orderNumberStr}* porque se ha presentado un *pequeño inconveniente o duda* con respecto a tu solicitud.\n\nPor favor, respóndenos por esta vía a la brevedad para poder aclarar la situación y continuar procesando tu pedido de la mejor manera. ¡Disculpa las molestias! 🙏`;
    }
    
    return '';
  };

  // Modals visibility states
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showBrandModal, setShowBrandModal] = useState(false);

  // Edit target states
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);

  // Form states - Products
  const [prodSku, setProdSku] = useState('');
  const [prodName, setProdName] = useState('');
  const [prodDescription, setProdDescription] = useState('');
  const [prodUnit, setProdUnit] = useState<string>('Unidad');
  const [prodCostPrice, setProdCostPrice] = useState<number | string>(0);
  const [prodMargin1, setProdMargin1] = useState<number | string>(30);
  const [prodPrice, setProdPrice] = useState<number | string>(0);
  const [prodOfferPrice, setProdOfferPrice] = useState<string>('');
  const [prodStock, setProdStock] = useState(0);
  const [prodCategoryId, setProdCategoryId] = useState('');
  const [prodBrandId, setProdBrandId] = useState('');
  const [prodFeatured, setProdFeatured] = useState(false);
  const [prodActive, setProdActive] = useState(true);
  const [prodRatingStars, setProdRatingStars] = useState<number>(5);
  const [prodRatingCount, setProdRatingCount] = useState<number>(0);
  const [prodImageUrl, setProdImageUrl] = useState(''); // Comma separated for multiples
  const [prodTechUrl, setProdTechUrl] = useState('');
  const [prodBarcodeQr, setProdBarcodeQr] = useState('');
  const [showProductFormScanner, setShowProductFormScanner] = useState(false);
  const [prodTaxId, setProdTaxId] = useState<string>('exento');
  const [prodTaxRate, setProdTaxRate] = useState<number>(0);
  const [prodExpirationDate, setProdExpirationDate] = useState<string>('');
  const [prodCriticalStock, setProdCriticalStock] = useState<number | string>(5);
  const [prodLocation, setProdLocation] = useState<string>('Tienda Bella Vista');

  // Business Locations (Sedes y Terminales) loaded dynamically from system configuration
  const [businessBranchesList, setBusinessBranchesList] = useState<BusinessBranch[]>([]);
  const [businessTerminalsList, setBusinessTerminalsList] = useState<BusinessTerminal[]>([]);

  const loadRealLocations = async () => {
    try {
      const branches = await dbService.getBusinessBranches();
      const terminals = await dbService.getBusinessTerminals();
      let activeBranches: BusinessBranch[] = [];
      if (Array.isArray(branches)) {
        activeBranches = branches.filter(b => b.active !== false);
        setBusinessBranchesList(activeBranches);
      }
      if (Array.isArray(terminals)) {
        setBusinessTerminalsList(terminals.filter(t => t.active !== false));
      }
      return activeBranches;
    } catch (err) {
      console.error("Error loading real business locations:", err);
      return [];
    }
  };

  useEffect(() => {
    loadRealLocations();

    const handleBranchesUpdated = () => loadRealLocations();
    const handleTerminalsUpdated = () => loadRealLocations();

    window.addEventListener('bellavista_branches_updated', handleBranchesUpdated);
    window.addEventListener('bellavista_terminals_updated', handleTerminalsUpdated);

    return () => {
      window.removeEventListener('bellavista_branches_updated', handleBranchesUpdated);
      window.removeEventListener('bellavista_terminals_updated', handleTerminalsUpdated);
    };
  }, []);

  // Filter states for Products table
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [productFilterOption, setProductFilterOption] = useState<
    'inventario_venta' | 'inventario_costo' | 'stock_critico' | 'destacados' | 'mas_vendidos' | 'sin_rotacion' | 'ubicacion'
  >('inventario_venta');

  // Product Movement Modal states
  const [movementModalProd, setMovementModalProd] = useState<Product | null>(null);
  const [movementType, setMovementType] = useState<'ingreso' | 'egreso' | 'ajuste'>('ingreso');
  const [movementQty, setMovementQty] = useState<number | string>(1);
  const [movementConcept, setMovementConcept] = useState<string>('Ajuste de inventario');

  const handleSaveProductMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementModalProd) return;

    const qty = Number(movementQty) || 0;
    let newStock = movementModalProd.stock;

    if (movementType === 'ingreso') {
      newStock += qty;
    } else if (movementType === 'egreso') {
      newStock = Math.max(0, newStock - qty);
    } else if (movementType === 'ajuste') {
      newStock = Math.max(0, qty);
    }

    try {
      await supabase.from('products').update({ stock: newStock }).eq('id', movementModalProd.id);
      if (onRefreshData) {
        onRefreshData();
      }
      setMovementModalProd(null);
      alert(`¡Movimiento registrado con éxito! Nuevo stock de "${movementModalProd.name}": ${newStock} unidades.`);
    } catch (err: any) {
      alert(`Error al actualizar el stock: ${err.message || 'Error desconocido'}`);
    }
  };

  // Form states - Categories
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catImageUrl, setCatImageUrl] = useState('');
  const [catActive, setCatActive] = useState(true);

  // Form states - Brands
  const [brandName, setBrandName] = useState('');
  const [brandLogoUrl, setBrandLogoUrl] = useState('');
  const [brandActive, setBrandActive] = useState(true);

  // Calculate general dashboard metrics
  const totalProducts = products.length;
  const totalCategories = categories.length;
  const totalBrands = brands.length;
  const outOfStockProducts = products.filter(p => p.stock === 0).length;
  const featuredProducts = products.filter(p => p.featured).length;

  // Real-time sale price calculation helper based on Cost and % Profit Margin
  const calculateSalePriceFromCost = (
    cost: number | string,
    margin: number | string
  ): number => {
    const parseVal = (v: any) => {
      if (v === undefined || v === null) return 0;
      const parsed = parseFloat(String(v).replace(',', '.'));
      return isNaN(parsed) ? 0 : parsed;
    };
    const costVal = parseVal(cost);
    const marginVal = parseVal(margin);
    const calculated = costVal * (1 + marginVal / 100);
    return Number(calculated.toFixed(2));
  };

  // Bidirectional recalculations:
  // 1. When Cost changes -> Recalculate Sale Price using current % Ganancia
  const handleCostChange = (val: string | number) => {
    setProdCostPrice(val);
    const costNum = parseFloat(String(val).replace(',', '.'));
    const marginNum = parseFloat(String(prodMargin1).replace(',', '.'));
    if (!isNaN(costNum) && costNum >= 0 && !isNaN(marginNum)) {
      const newPrice = Number((costNum * (1 + marginNum / 100)).toFixed(2));
      setProdPrice(newPrice);
    }
  };

  // 2. When % Ganancia changes -> Recalculate Sale Price using current Cost
  const handleMarginChange = (val: string | number) => {
    setProdMargin1(val);
    const marginNum = parseFloat(String(val).replace(',', '.'));
    const costNum = parseFloat(String(prodCostPrice).replace(',', '.'));
    if (!isNaN(marginNum) && !isNaN(costNum) && costNum >= 0) {
      const newPrice = Number((costNum * (1 + marginNum / 100)).toFixed(2));
      setProdPrice(newPrice);
    }
  };

  // 3. When Sale Price changes -> Recalculate % Ganancia automatically from Cost
  const handlePriceChange = (val: string | number) => {
    const priceNum = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
    setProdPrice(val);
    
    const costNum = parseFloat(String(prodCostPrice).replace(',', '.'));
    if (!isNaN(costNum) && costNum > 0 && !isNaN(priceNum) && priceNum >= 0) {
      const calculatedMargin = Number((((priceNum - costNum) / costNum) * 100).toFixed(2));
      setProdMargin1(calculatedMargin);
    }
  };

  // Handle open Product form
  const handleOpenProductForm = async (prod: Product | null = null) => {
    const activeBranches = await loadRealLocations();
    const firstB = activeBranches && activeBranches.length > 0 ? activeBranches[0] : (businessBranchesList[0] || null);
    const defaultRealLocation = firstB ? (firstB.code ? `${firstB.name} (${firstB.code})` : firstB.name) : 'Tienda Bella Vista (SP-01)';

    if (prod) {
      setEditingProduct(prod);
      setProdSku(prod.sku);
      setProdName(prod.name);
      setProdDescription(prod.description);
      setProdUnit(prod.unit || (prod as any).units || 'Unidad');

      const cost = prod.cost_price ?? 0;
      const m1 = prod.margin_1 ?? 30;

      setProdCostPrice(cost);
      setProdMargin1(m1);

      // Set initial sale price
      setProdPrice(prod.price || calculateSalePriceFromCost(cost, m1));
      setProdOfferPrice(prod.offer_price !== null ? prod.offer_price.toString() : '');
      setProdStock(prod.stock);
      setProdCategoryId(prod.category_id || '');
      setProdBrandId(prod.brand_id || '');
      setProdFeatured(prod.featured);
      setProdActive(prod.active);
      setProdRatingStars(prod.rating_stars ?? 5);
      setProdRatingCount(prod.rating_count ?? 0);
      setProdTechUrl(prod.technical_sheet_url || '');
      setProdBarcodeQr(prod.barcode_qr || '');
      setProdTaxId(prod.tax_id || (prod.tax_rate && prod.tax_rate > 0 ? 'default-iva' : 'exento'));
      setProdTaxRate(prod.tax_rate ?? 0);
      setProdExpirationDate(prod.expiration_date || '');
      setProdCriticalStock(prod.critical_stock ?? 5);
      const isForbiddenLoc = (loc?: string) => {
        if (!loc) return true;
        const l = loc.toLowerCase().trim();
        return l.includes('caja principal') || l.includes('caja copias') || l.includes('sede principal - almacen') || l.includes('sede principal - almacén');
      };
      setProdLocation((prod.location && !isForbiddenLoc(prod.location)) ? prod.location : defaultRealLocation);

      // Load images
      const associatedImgs = productImages
        .filter(img => img.product_id === prod.id)
        .map(img => img.image_url)
        .join(', ');
      setProdImageUrl(associatedImgs);
    } else {
      setEditingProduct(null);
      setProdSku('PRD-' + Math.random().toString(36).substring(2, 8).toUpperCase());
      setProdName('');
      setProdDescription('');
      setProdUnit('Unidad');
      setProdCostPrice(0);
      setProdMargin1(30);
      setProdPrice(0);
      setProdOfferPrice('');
      setProdStock(10);
      setProdCategoryId(categories[0]?.id || '');
      setProdBrandId(brands[0]?.id || '');
      setProdFeatured(false);
      setProdActive(true);
      setProdRatingStars(5);
      setProdRatingCount(0);
      setProdImageUrl('');
      setProdTechUrl('');
      setProdBarcodeQr('');
      setProdTaxId('exento');
      setProdTaxRate(0);
      setProdExpirationDate('');
      setProdCriticalStock(5);
      setProdLocation(defaultRealLocation);
    }
    setShowProductModal(true);
  };

  // Handle save Product
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Parse price and offer price with Spanish comma decimal safety
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

    const costPriceNum = parseSpanishFloat(prodCostPrice);
    const m1Num = parseSpanishFloat(prodMargin1);
    const finalPrice = parseSpanishFloat(prodPrice);
    const offerPriceNum = parseSpanishFloatOptional(prodOfferPrice);
    const slug = (prodName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const payload = {
      sku: prodSku.trim(),
      name: prodName.trim(),
      slug: slug,
      description: prodDescription.trim(),
      unit: prodUnit.trim() || 'Unidad',
      units: prodUnit.trim() || 'Unidad',
      cost_price: costPriceNum,
      margin_1: m1Num,
      margin_2: m1Num,
      margin_3: m1Num,
      selected_margin_type: 1,
      price: finalPrice,
      offer_price: offerPriceNum,
      stock: Number(prodStock),
      category_id: prodCategoryId,
      brand_id: prodBrandId,
      featured: prodFeatured,
      active: prodActive,
      rating_stars: Number(prodRatingStars),
      rating_count: Number(prodRatingCount),
      technical_sheet_url: prodTechUrl.trim() || null,
      barcode_qr: prodBarcodeQr.trim() || null,
      tax_id: prodTaxId,
      tax_rate: Number(prodTaxRate),
      expiration_date: prodExpirationDate ? prodExpirationDate : null,
      critical_stock: Number(prodCriticalStock) || 0,
      location: prodLocation || (businessBranchesList[0] ? (businessBranchesList[0].code ? `${businessBranchesList[0].name} (${businessBranchesList[0].code})` : businessBranchesList[0].name) : 'Tienda Bella Vista (SP-01)')
    };

    try {
      let savedProduct: Product;
      if (editingProduct) {
        savedProduct = await dbService.updateProduct(editingProduct.id, payload);
      } else {
        savedProduct = await dbService.createProduct(payload);
      }

      // Handle additional images save
      if (prodImageUrl.trim() !== '') {
        // Clear previous images if editing
        if (editingProduct) {
          const prevImgs = productImages.filter(img => img.product_id === editingProduct.id);
          for (const img of prevImgs) {
            await dbService.removeProductImage(img.id);
          }
        }

        // Add new images
        const urls = prodImageUrl.split(',').map(u => u.trim()).filter(u => u !== '');
        for (let i = 0; i < urls.length; i++) {
          await dbService.addProductImage({
            product_id: savedProduct.id,
            image_url: urls[i],
            sort_order: i + 1
          });
        }
      }

      setShowProductModal(false);
      onRefreshData();
      alert(editingProduct ? "¡Producto actualizado exitosamente!" : "¡Nuevo producto creado exitosamente!");
    } catch (err: any) {
      console.error("Error saving product", err);
      alert(`Error al guardar el producto: ${err.message || err.toString()}`);
    }
  };

  // Handle delete Product
  const handleDeleteProduct = async (id: string) => {
    if (activeRole === 'vendedor') {
      alert("Su rol de Vendedor no tiene permisos para eliminar registros.");
      return;
    }
    if (confirm("¿Está seguro de que desea eliminar este producto del catálogo?")) {
      await dbService.deleteProduct(id);
      onRefreshData();
    }
  };

  // Handle toggle Active state product
  const handleToggleActiveProduct = async (prod: Product) => {
    await dbService.updateProduct(prod.id, { active: !prod.active });
    onRefreshData();
  };

  const handleToggleActiveCategory = async (cat: Category) => {
    await dbService.updateCategory(cat.id, { active: !(cat.active ?? true) });
    onRefreshData();
  };

  const handleToggleActiveBrand = async (brand: Brand) => {
    await dbService.updateBrand(brand.id, { active: !(brand.active ?? true) });
    onRefreshData();
  };

  // Handle toggle Featured state product
  const handleToggleFeaturedProduct = async (prod: Product) => {
    await dbService.updateProduct(prod.id, { featured: !prod.featured });
    onRefreshData();
  };

  // Handle open Category form
  const handleOpenCategoryForm = (cat: Category | null = null) => {
    if (cat) {
      setEditingCategory(cat);
      setCatName(cat.name);
      setCatSlug(cat.slug);
      setCatImageUrl(cat.image_url);
      setCatActive(cat.active ?? true);
    } else {
      setEditingCategory(null);
      setCatName('');
      setCatSlug('');
      setCatImageUrl('');
      setCatActive(true);
    }
    setShowCategoryModal(true);
  };

  // Handle save Category
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = catSlug.trim() || (catName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const payload = {
      name: catName.trim(),
      slug: slug,
      image_url: catImageUrl.trim() || 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&q=80&w=400',
      active: catActive
    };

    if (editingCategory) {
      await dbService.updateCategory(editingCategory.id, payload);
    } else {
      await dbService.createCategory(payload);
    }
    setShowCategoryModal(false);
    onRefreshData();
  };

  // Handle delete Category
  const handleDeleteCategory = async (id: string) => {
    if (activeRole === 'vendedor') {
      alert("Su rol de Vendedor no tiene permisos para eliminar registros.");
      return;
    }
    if (confirm("¿Está seguro de eliminar esta categoría? Los productos asociados quedarán sin categoría.")) {
      await dbService.deleteCategory(id);
      onRefreshData();
    }
  };

  // Handle open Brand form
  const handleOpenBrandForm = (b: Brand | null = null) => {
    if (b) {
      setEditingBrand(b);
      setBrandName(b.name);
      setBrandLogoUrl(b.logo_url);
      setBrandActive(b.active ?? true);
    } else {
      setEditingBrand(null);
      setBrandName('');
      setBrandLogoUrl('');
      setBrandActive(true);
    }
    setShowBrandModal(true);
  };

  // Handle save Brand
  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: brandName.trim(),
      logo_url: brandLogoUrl.trim() || 'https://images.unsplash.com/photo-1560169897-fc0cdbdfa4d5?auto=format&fit=crop&q=80&w=200',
      active: brandActive
    };

    if (editingBrand) {
      await dbService.updateBrand(editingBrand.id, payload);
    } else {
      await dbService.createBrand(payload);
    }
    setShowBrandModal(false);
    onRefreshData();
  };

  // Handle delete Brand
  const handleDeleteBrand = async (id: string) => {
    if (activeRole === 'vendedor') {
      alert("Su rol de Vendedor no tiene permisos para eliminar registros.");
      return;
    }
    if (confirm("¿Está seguro de eliminar esta marca? Los productos asociados quedarán sin marca registrada.")) {
      await dbService.deleteBrand(id);
      onRefreshData();
    }
  };

  // Print Critical Stock Inventory Report
  const handlePrintInventoryReport = async () => {
    try {
      // 1. Fetch up-to-date products from Database
      let allProds = products;
      try {
        const fetched = await dbService.getProducts();
        if (fetched && fetched.length > 0) {
          allProds = fetched;
        }
      } catch (e) {
        console.warn("Error fetching products from DB for report, using local state:", e);
      }

      // 2. Determine low stock threshold
      const sysCfg = localStorage.getItem('copias_bellavista_sys_config');
      const lowStockThresh = sysCfg ? (JSON.parse(sysCfg).inventarioLowStockThreshold ?? 5) : inventarioLowStockThreshold;

      // 3. Filter products where stock is <= minimum stock threshold
      const criticalProds = allProds.filter(p => {
        const pMin = (p as any).min_stock ?? (p as any).stock_minimo ?? lowStockThresh;
        return p.stock <= pMin;
      });

      // Sort by stock ascending (0 or negative stock first)
      criticalProds.sort((a, b) => a.stock - b.stock);

      // 4. Open clean printable window
      const printWin = window.open('', '_blank', 'width=950,height=750');
      if (!printWin) {
        alert("Por favor habilite las ventanas emergentes (popups) en su navegador para imprimir el reporte.");
        return;
      }

      const reportDate = new Date().toLocaleString('es-VE', { dateStyle: 'full', timeStyle: 'short' });
      const businessName = localStorage.getItem('business_name') || 'Copias Bella Vista, C.A.';

      const tableRowsHtml = criticalProds.length > 0
        ? criticalProds.map((p, idx) => {
            const catName = categories.find(c => c.id === p.category_id)?.name || 'General';
            const brandName = brands.find(b => b.id === p.brand_id)?.name || 'S/M';
            const pMin = (p as any).min_stock ?? (p as any).stock_minimo ?? lowStockThresh;
            const isZero = p.stock <= 0;
            const statusLabel = isZero ? 'AGOTADO' : 'STOCK CRÍTICO';
            const statusStyle = isZero
              ? 'background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5;'
              : 'background: #fffbeb; color: #d97706; border: 1px solid #fde68a;';

            return `
              <tr>
                <td style="text-align: center; font-weight: bold; color: #64748b; padding: 7px;">${idx + 1}</td>
                <td style="font-family: monospace; font-weight: bold; color: #0f172a; padding: 7px;">${p.sku || 'N/A'}</td>
                <td style="font-weight: 600; color: #1e293b; padding: 7px;">${p.name}</td>
                <td style="color: #475569; padding: 7px;">${catName} / ${brandName}</td>
                <td style="text-align: center; font-weight: 900; font-size: 12px; color: ${isZero ? '#dc2626' : '#d97706'}; padding: 7px;">${p.stock} un.</td>
                <td style="text-align: center; color: #64748b; font-weight: 600; padding: 7px;">${pMin} un.</td>
                <td style="text-align: right; font-weight: bold; color: #0f172a; padding: 7px;">$${Number(p.price).toFixed(2)}</td>
                <td style="text-align: center; padding: 7px;">
                  <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 900; ${statusStyle}">
                    ${statusLabel}
                  </span>
                </td>
              </tr>
            `;
          }).join('')
        : `<tr><td colspan="8" style="text-align: center; padding: 24px; color: #059669; font-weight: bold; font-size: 13px;">
             ✅ ¡Excelente! No se encontraron productos con stock crítico por debajo o igual al umbral mínimo (${lowStockThresh} unidades).
           </td></tr>`;

      printWin.document.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>Reporte de Stock Crítico - ${businessName}</title>
          <style>
            @page { size: letter portrait; margin: 12mm; }
            body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 20px; background: #fff; }
            .header { border-bottom: 3px solid #dc2626; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
            .company { font-size: 20px; font-weight: 900; color: #005da9; text-transform: uppercase; letter-spacing: -0.5px; }
            .report-title { font-size: 15px; font-weight: 900; color: #dc2626; margin-top: 2px; }
            .meta-info { text-align: right; font-size: 11px; color: #64748b; line-height: 1.4; }
            .summary-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 16px; margin-bottom: 16px; display: flex; gap: 24px; align-items: center; }
            .stat-item { display: flex; flex-direction: column; }
            .stat-label { font-size: 10px; font-weight: 800; color: #991b1b; text-transform: uppercase; }
            .stat-value { font-size: 16px; font-weight: 900; color: #7f1d1d; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px 6px; text-align: left; font-size: 10px; font-weight: 900; text-transform: uppercase; color: #334155; }
            td { border: 1px solid #e2e8f0; }
            tr:nth-child(even) { background: #f8fafc; }
            .footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 10px; text-align: center; font-size: 10px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="company">${businessName}</div>
              <div class="report-title">⚠️ REPORTE DE STOCK CRÍTICO DE INVENTARIO</div>
            </div>
            <div class="meta-info">
              <div><strong>Fecha de emisión:</strong> ${reportDate}</div>
              <div><strong>Umbral crítico global:</strong> ≤ ${lowStockThresh} unidades</div>
            </div>
          </div>

          <div class="summary-box">
            <div class="stat-item">
              <span class="stat-label">Total Productos Críticos</span>
              <span class="stat-value">${criticalProds.length} artículos</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Total en Agotado (Stock 0)</span>
              <span class="stat-value">${criticalProds.filter(p => p.stock <= 0).length} artículos</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 30px; text-align: center;">#</th>
                <th style="width: 90px;">SKU</th>
                <th>Nombre del Producto</th>
                <th>Categoría / Marca</th>
                <th style="width: 85px; text-align: center;">Stock Actual</th>
                <th style="width: 75px; text-align: center;">Stock Mín.</th>
                <th style="width: 80px; text-align: right;">Precio ($)</th>
                <th style="width: 100px; text-align: center;">Estado</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div class="footer">
            Sistema de Gestión Integral - ${businessName} | Reporte generado automáticamente
          </div>

          <script>
            window.onload = function() {
              window.focus();
              window.print();
            };
          </script>
        </body>
        </html>
      `);
      printWin.document.close();
    } catch (err) {
      console.error("Error al imprimir el reporte de stock crítico:", err);
      alert("No se pudo generar el reporte de stock crítico.");
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportExcel = () => {
    const data = products.map(p => {
      const category = categories.find(c => c.id === p.category_id);
      const brand = brands.find(b => b.id === p.brand_id);
      return {
        ID: p.id,
        SKU: p.sku,
        Nombre: p.name,
        Slug: p.slug,
        Descripcion: p.description,
        Precio: p.price,
        PrecioOferta: p.offer_price || '',
        Stock: p.stock,
        Categoria: category?.name || '',
        Marca: brand?.name || '',
        Destacado: p.featured ? 'Si' : 'No',
        Activo: p.active ? 'Si' : 'No',
        Estrellas: p.rating_stars ?? 5,
        Reviews: p.rating_count ?? 0,
        FichaTecnica: p.technical_sheet_url || '',
        CodigoBarraQR: p.barcode_qr || ''
      };
    });
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Productos");
    XLSX.writeFile(wb, "Inventario_Copias_Bella_Vista.xlsx");
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (activeRole === 'vendedor') {
      alert("Su rol de Vendedor no tiene permisos para importar registros masivos.");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: any[] = XLSX.utils.sheet_to_json(ws);
        
        let importedCount = 0;
        
        for (const row of data) {
          // Required fields basic check
          if (!row.Nombre || !row.SKU || row.Precio === undefined || row.Stock === undefined) continue;

          // Try to find category, else use first one or default
          let catId = categories[0]?.id || '';
          if (row.Categoria) {
            const foundCat = categories.find(c => c && c.name && (c.name || '').toLowerCase() === (row.Categoria || '').toString().toLowerCase());
            if (foundCat) catId = foundCat.id;
          }

          // Try to find brand, else use first one or default
          let brandId = brands[0]?.id || '';
          if (row.Marca) {
            const foundBrand = brands.find(b => b && b.name && (b.name || '').toLowerCase() === (row.Marca || '').toString().toLowerCase());
            if (foundBrand) brandId = foundBrand.id;
          }

          const offerPriceNum = row.PrecioOferta && row.PrecioOferta !== '' ? Number(row.PrecioOferta) : null;
          const slug = row.Slug || (row.Nombre || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

          const payload = {
            sku: row.SKU.toString(),
            name: row.Nombre.toString(),
            slug: slug,
            description: row.Descripcion?.toString() || '',
            price: Number(row.Precio),
            offer_price: offerPriceNum,
            stock: Number(row.Stock),
            category_id: catId,
            brand_id: brandId,
            featured: row.Destacado === 'Si' || row.Destacado === true,
            active: row.Activo === 'Si' || row.Activo === true,
            rating_stars: row.Estrellas !== undefined ? Number(row.Estrellas) : 5,
            rating_count: row.Reviews !== undefined ? Number(row.Reviews) : 0,
            technical_sheet_url: row.FichaTecnica?.toString() || null,
            barcode_qr: row.CodigoBarraQR?.toString() || null
          };

          if (row.ID) {
            // Check if exists
            const exists = products.find(p => p.id === row.ID.toString());
            if (exists) {
              await dbService.updateProduct(exists.id, payload);
              importedCount++;
              continue;
            }
          }
          // Create new
          await dbService.createProduct(payload);
          importedCount++;
        }
        
        alert(`Se han importado o actualizado exitosamente ${importedCount} productos.`);
        onRefreshData();
      } catch (err) {
        console.error("Error importing Excel file:", err);
        alert("Ocurrió un error al procesar el archivo Excel. Verifique el formato.");
      }
      
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // Calculate sales counts for products from non-cancelled orders
  const productSalesMap = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach(order => {
      if ((order.status || '').toLowerCase() === 'cancelado') return;
      if (Array.isArray(order.items)) {
        order.items.forEach(item => {
          const key = item.product_id || item.sku || item.name;
          if (key) {
            map[key] = (map[key] || 0) + Number(item.quantity || 0);
          }
        });
      }
    });
    return map;
  }, [orders]);

  // Filtered lists for table views
  const filteredProducts = useMemo(() => {
    let list = searchQuery.trim() === ''
      ? [...products]
      : sortProductsByPriority(products, searchQuery, categories, brands);

    if (productFilterOption === 'stock_critico') {
      list = list.filter(p => {
        const threshold = (p as any).critical_stock !== undefined && (p as any).critical_stock !== null
          ? Number((p as any).critical_stock)
          : (inventarioLowStockThreshold || 5);
        return p.stock <= threshold;
      });
    } else if (productFilterOption === 'destacados') {
      list = list.filter(p => !!p.featured);
    } else if (productFilterOption === 'mas_vendidos') {
      list = list
        .filter(p => (productSalesMap[p.id] || productSalesMap[p.sku] || productSalesMap[p.name] || 0) > 0)
        .sort((a, b) => {
          const qtyA = productSalesMap[a.id] || productSalesMap[a.sku] || productSalesMap[a.name] || 0;
          const qtyB = productSalesMap[b.id] || productSalesMap[b.sku] || productSalesMap[b.name] || 0;
          return qtyB - qtyA;
        });
    } else if (productFilterOption === 'sin_rotacion') {
      list = list.filter(p => {
        const qty = productSalesMap[p.id] || productSalesMap[p.sku] || productSalesMap[p.name] || 0;
        return qty === 0;
      });
    }

    return list;
  }, [products, searchQuery, categories, brands, productFilterOption, productSalesMap, inventarioLowStockThreshold]);

  const filteredCategories = categories.filter(c => 
    (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.slug || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredBrands = brands.filter(b => 
    (b.name || '').toLowerCase().includes((searchQuery || '').toLowerCase())
  );

  // Robust Order status normalizer ensuring 100% sync between Table and Kanban columns
  const normalizeOrderStatus = (rawStatus?: string | null): string => {
    if (!rawStatus) return 'recibido';
    const s = rawStatus.toString().trim().toLowerCase();
    if (s === 'recibido' || s === 'recibida' || s === 'pendiente' || s === 'nuevo' || s === 'nueva' || s === 'new' || s === 'received') return 'recibido';
    if (s === 'preparando' || s === 'en preparación' || s === 'en preparacion' || s === 'preparacion' || s === 'preparing') return 'preparando';
    if (s === 'listo para retirar' || s === 'listo p/ retiro' || s === 'listo p/retiro' || s === 'listo retiro' || s === 'listo' || s === 'ready') return 'listo para retirar';
    if (s === 'en camino' || s === 'despachado' || s === 'enviado' || s === 'en transito' || s === 'en tránsito' || s === 'on_the_way' || s === 'shipped') return 'en camino';
    if (s === 'entregado' || s === 'entregada' || s === 'completado' || s === 'completada' || s === 'delivered' || s === 'completed') return 'entregado';
    if (s === 'cancelado' || s === 'cancelada' || s === 'anulado' || s === 'anulada' || s === 'cancelled' || s === 'canceled') return 'cancelado';
    return s;
  };

  const filteredOrders = orders.filter(order => {
    const formattedNum = String(order.order_number || '').padStart(7, '0');
    const searchLower = (searchQuery || '').toLowerCase().trim();
    const matchesSearch = !searchLower || 
      formattedNum.includes(searchLower) ||
      String(order.order_number || '').includes(searchLower) ||
      (order.customer_name || '').toLowerCase().includes(searchLower) ||
      (order.phone_number || '').includes(searchLower) ||
      (order.address_text && String(order.address_text).toLowerCase().includes(searchLower));

    const normalizedOrderStatus = normalizeOrderStatus(order.status);
    const matchesStatus = statusFilter === 'all' || normalizedOrderStatus === normalizeOrderStatus(statusFilter);
    const matchesPaymentStatus = paymentStatusFilter === 'all' || (order.payment_status || 'pendiente').toLowerCase().trim() === (paymentStatusFilter || '').toLowerCase().trim();
    const matchesDeliveryMethod = deliveryMethodFilter === 'all' || (order.delivery_method || '').toLowerCase().trim() === (deliveryMethodFilter || '').toLowerCase().trim();
    const matchesDate = !dateFilter || (order.created_at && order.created_at.split('T')[0] === dateFilter);

    return matchesSearch && matchesStatus && matchesPaymentStatus && matchesDeliveryMethod && matchesDate;
  });

  const handleExportOrdersExcel = () => {
    try {
      const dataToExport = orders.map(o => ({
        'Número de Pedido': String(o.order_number || '').padStart(7, '0'),
        'Cliente': o.customer_name || 'Sin nombre',
        'Teléfono': o.phone_number || '',
        'Método de Entrega': o.delivery_method === 'retiro' ? 'Retiro en Tienda' : 'Envío a Domicilio',
        'Dirección': o.address_text || 'N/A',
        'Puntos': o.points || 0,
        'Método de Pago': o.payment_method || 'N/A',
        'Total USD': o.total_price,
        'Estado': (o.status || 'recibido').toUpperCase(),
        'Estado de Pago': (o.payment_status || 'pendiente').toUpperCase(),
        'Fecha de Creación': o.created_at ? new Date(o.created_at).toLocaleString() : 'N/A',
        'Comentarios': o.comments || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Pedidos');
      XLSX.writeFile(workbook, `Copias_Bella_Vista_Pedidos_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e) {
      console.error("Error exporting orders to excel:", e);
      alert("No se pudieron exportar los pedidos.");
    }
  };

  const totalOrdersCount = orders.length;
  const pendingOrdersCount = orders.filter(o => (o.status || '').toLowerCase() !== 'entregado' && (o.status || '').toLowerCase() !== 'cancelado').length;
  const completedOrdersCount = orders.filter(o => (o.status || '').toLowerCase() === 'entregado').length;
  const totalRevenue = orders
    .filter(o => (o.status || '').toLowerCase() !== 'cancelado')
    .reduce((sum, o) => sum + Number(o.total_price || 0), 0);

  // Dashboard Helpers
  const getSalesByDays = () => {
    const daysData = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
      
      const dayOrders = orders.filter(o => {
        if ((o.status || '').toLowerCase() === 'cancelado') return false;
        if (!o.created_at) return false;
        const oDate = o.created_at.split('T')[0];
        return oDate === dateStr;
      });
      
      const daySum = dayOrders.reduce((sum, o) => sum + Number(o.total_price || 0), 0);
      daysData.push({ label: dayLabel, amount: daySum, count: dayOrders.length });
    }
    return daysData;
  };

  const getSalesByMonths = () => {
    const monthsData = [];
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const now = new Date();
    const currentYear = now.getFullYear();
    
    for (let m = 0; m < 12; m++) {
      const monthOrders = orders.filter(o => {
        if ((o.status || '').toLowerCase() === 'cancelado') return false;
        if (!o.created_at) return false;
        const oDate = new Date(o.created_at);
        return oDate.getFullYear() === currentYear && oDate.getMonth() === m;
      });
      
      const monthSum = monthOrders.reduce((sum, o) => sum + Number(o.total_price || 0), 0);
      monthsData.push({ label: monthNames[m], amount: monthSum, count: monthOrders.length });
    }
    return monthsData;
  };

  const getBestSellers = () => {
    const counts: Record<string, { name: string; sku: string; qty: number; revenue: number }> = {};
    orders.forEach(order => {
      if ((order.status || '').toLowerCase() === 'cancelado') return;
      if (Array.isArray(order.items)) {
        order.items.forEach(item => {
          const key = item.product_id || item.sku || item.name;
          if (!key) return;
          if (!counts[key]) {
            counts[key] = {
              name: item.name || 'Producto sin nombre',
              sku: item.sku || 'N/A',
              qty: 0,
              revenue: 0
            };
          }
          counts[key].qty += Number(item.quantity || 0);
          counts[key].revenue += Number(item.quantity || 0) * Number(item.price || 0);
        });
      }
    });
    return Object.values(counts)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  };

  const getTopCustomers = () => {
    const clients: Record<string, { name: string; phone: string; count: number; totalSpent: number }> = {};
    orders.forEach(order => {
      if ((order.status || '').toLowerCase() === 'cancelado') return;
      const key = (order.customer_name || '').trim().toLowerCase();
      if (!key) return;
      if (!clients[key]) {
        clients[key] = {
          name: order.customer_name || 'Cliente',
          phone: order.phone_number || '',
          count: 0,
          totalSpent: 0
        };
      }
      clients[key].count += 1;
      clients[key].totalSpent += Number(order.total_price || 0);
    });
    return Object.values(clients)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  const renderSalesChart = () => {
    const chartData = chartView === 'days' ? getSalesByDays() : getSalesByMonths();
    const maxAmount = Math.max(...chartData.map(d => d.amount), 50);
    
    const width = 500;
    const height = 180;
    const paddingLeft = 40;
    const paddingRight = 10;
    const paddingTop = 15;
    const paddingBottom = 25;
    
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;
    
    const points = chartData.map((d, index) => {
      const x = paddingLeft + (index / (chartData.length - 1)) * chartWidth;
      const y = paddingTop + chartHeight - (d.amount / maxAmount) * chartHeight;
      return { x, y, label: d.label, amount: d.amount, count: d.count };
    });
    
    let linePath = '';
    let areaPath = '';
    
    if (points.length > 0) {
      linePath = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
      areaPath = linePath + ` L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;
    }
    
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm text-left">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#131921] flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Curva de Ventas ({chartView === 'days' ? 'Últimos 7 Días' : 'Desempeño Mensual'})
            </h4>
            <p className="text-[10px] text-gray-400 font-semibold uppercase">Estadísticas en tiempo real de facturación</p>
          </div>
          
          <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
            <button
              onClick={() => setChartView('days')}
              className={`px-2 py-1 text-[9px] font-black uppercase tracking-wider rounded transition-all cursor-pointer ${
                chartView === 'days' ? 'bg-[#FF9900] text-[#131921] shadow-xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Días
            </button>
            <button
              onClick={() => setChartView('months')}
              className={`px-2 py-1 text-[9px] font-black uppercase tracking-wider rounded transition-all cursor-pointer ${
                chartView === 'months' ? 'bg-[#FF9900] text-[#131921] shadow-xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Año / Meses
            </button>
          </div>
        </div>
        
        <div className="relative w-full overflow-hidden">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#25D366" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#25D366" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
              const y = paddingTop + ratio * chartHeight;
              const value = (maxAmount * (1 - ratio)).toFixed(0);
              return (
                <g key={idx} className="opacity-10">
                  <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#000" strokeWidth="1" strokeDasharray="3,3" />
                  <text x={paddingLeft - 8} y={y + 3} textAnchor="end" className="text-[8px] font-mono font-bold fill-black">$ {value}</text>
                </g>
              );
            })}
            
            {areaPath && <path d={areaPath} fill="url(#chartGradient)" className="transition-all duration-500" />}
            
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="#10B981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-500"
              />
            )}
            
            {points.map((p, idx) => (
              <g key={idx} className="group cursor-pointer">
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="4"
                  fill="#ffffff"
                  stroke="#10B981"
                  strokeWidth="2"
                  className="transition-all hover:r-6 hover:fill-[#10B981]"
                />
                <text
                  x={p.x}
                  y={p.y - 8}
                  textAnchor="middle"
                  className="text-[8px] font-extrabold fill-emerald-800 bg-white opacity-0 group-hover:opacity-100 transition-opacity font-mono pointer-events-none"
                >
                  ${p.amount.toFixed(1)}
                </text>
                <text
                  x={p.x}
                  y={height - 6}
                  textAnchor="middle"
                  className="text-[8px] font-bold text-gray-400 fill-gray-400"
                >
                  {p.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  };

  const renderNavigationItems = (isMobile: boolean = false) => {
    interface SubItem {
      id: AdminMenuType;
      label: string;
      icon: any;
      badge?: number | string | null;
      badgeColor?: string;
    }

    interface MenuGroup {
      groupId: string;
      title: string;
      icon: any;
      directId?: AdminMenuType;
      badge?: number | string | null;
      subItems?: SubItem[];
    }

    interface SectionCategory {
      sectionNumber: string;
      sectionTitle: string;
      groups: MenuGroup[];
    }

    const pendingOrdersCount = orders.filter(o => (o.status || '').toLowerCase() === 'pendiente').length;

    const navSections: SectionCategory[] = [
      {
        sectionNumber: "1",
        sectionTitle: "Gestión de Negocios",
        groups: [
          {
            groupId: "ventas",
            title: "Ventas",
            icon: ShoppingBag,
            badge: pendingOrdersCount > 0 ? pendingOrdersCount : null,
            subItems: [
              { id: 'sales', label: 'Venta Flash', icon: Zap },
              { id: 'orders', label: 'Pedidos de clientes', icon: ClipboardList, badge: pendingOrdersCount > 0 ? pendingOrdersCount : null, badgeColor: 'bg-amber-500 text-white' },
              { id: 'cotizaciones', label: 'Cotizaciones', icon: FileCheck }
            ]
          },
          {
            groupId: "inventarios",
            title: "Inventarios",
            icon: Package,
            subItems: [
              { id: 'products', label: 'Mercancías', icon: Package },
              { id: 'compras', label: 'Compras', icon: ShoppingCart }
            ]
          },
          {
            groupId: "cuentas",
            title: "Cuentas",
            icon: Store,
            badge: activeSession ? 'Abierta' : null,
            subItems: [
              { id: 'caja', label: 'Caja', icon: Store, badge: activeSession ? '•' : null, badgeColor: 'text-emerald-500 font-black text-xs' },
              { id: 'cuentas_bancarias', label: 'Cuentas bancarias', icon: Coins },
              { id: 'balance', label: 'Cuentas por cobrar y por pagar', icon: ArrowLeftRight }
            ]
          },
          {
            groupId: "reportes",
            title: "Finanzas",
            icon: TrendingUp,
            subItems: [
              { id: 'reportes_balance', label: 'Balance', icon: BarChart },
              { id: 'reportes_gastos', label: 'Gastos fijos', icon: Receipt },
              { id: 'reportes_ganancias', label: 'Ganancias y pérdidas', icon: PieChart }
            ]
          },
          {
            groupId: "marketing",
            title: "Marketing",
            icon: Megaphone,
            directId: 'marketing'
          }
        ]
      },
      {
        sectionNumber: "2",
        sectionTitle: "Gestión de Contactos",
        groups: [
          {
            groupId: "contactos",
            title: "Clientes y Proveedores",
            icon: Users,
            directId: 'clientes_proveedores',
            subItems: [
              { id: 'clientes', label: 'Clientes', icon: Users, badge: dbClients.length || null },
              { id: 'proveedores', label: 'Proveedores', icon: Truck, badge: providers.length || null }
            ]
          }
        ]
      },
      {
        sectionNumber: "3",
        sectionTitle: "Opciones de Sistema",
        groups: [
          {
            groupId: "configuracion",
            title: "Configuración",
            icon: Settings,
            subItems: [
              { id: 'settings', label: 'General y Negocio', icon: Settings },
              { id: 'users', label: 'Usuarios y accesos', icon: UserCheck }
            ]
          }
        ]
      }
    ];

    const isItemAllowed = (itemId: string) => {
      const roleLower = (activeRole as string || '').toLowerCase();
      if (roleLower === 'gerente' || roleLower === 'admin' || roleLower === 'administrador') {
        return true;
      }
      if (itemId === 'users' || itemId === 'settings' || itemId === 'reportes_ganancias' || itemId === 'reportes_balance' || itemId === 'reportes_gastos' || itemId === 'gastos' || itemId === 'balance' || itemId === 'compras') {
        return roleLower === 'gerente' || roleLower === 'admin' || roleLower === 'administrador';
      }
      if (roleLower === 'cajero' || roleLower === 'vendedor') {
        return ['orders', 'sales', 'cotizaciones', 'caja', 'clientes', 'cuentas_bancarias', 'clientes_proveedores'].includes(itemId);
      }
      if (roleLower === 'despachador') {
        return ['products', 'orders'].includes(itemId);
      }
      if (roleLower === 'repartidor') {
        return ['orders'].includes(itemId);
      }
      return true;
    };

    return (
      <div className="space-y-4 font-poppins">
        {/* Top Header Card: Usuario & Tasa BCV */}
        <div className="p-3 bg-gradient-to-r from-[#1D3557]/5 to-[#40E0D0]/10 border border-[#1D3557]/15 rounded-2xl shadow-2xs space-y-2.5">
          {/* User Info Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 bg-[#1D3557] text-white rounded-full flex items-center justify-center font-montserrat font-black text-xs shrink-0 shadow-2xs border border-[#40E0D0]">
                {currentUser ? currentUser.name.charAt(0).toUpperCase() : (activeRole === 'admin' ? 'A' : 'V')}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] font-extrabold text-[#2B2D42] leading-tight truncate font-montserrat">
                  {currentUser ? currentUser.name : (activeRole === 'admin' ? 'Administrador' : 'Vendedor')}
                </span>
                <span className="text-[8.5px] font-black uppercase tracking-wider text-[#00BFFF]">
                  {currentUser ? currentUser.role : (activeRole === 'admin' ? 'Admin' : 'Vendedor')}
                </span>
              </div>
            </div>
            {!isMobile && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSidebarCollapsed(prev => !prev);
                }}
                className="p-1 text-gray-400 hover:text-[#1D3557] hover:bg-white/80 rounded transition cursor-pointer shrink-0"
                title={isSidebarCollapsed ? "Fijar menú lateral (Pin)" : "Ocultar automáticamente (Collapse)"}
              >
                {isSidebarCollapsed ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          {/* Tasa BCV Row */}
          <div className="flex items-center justify-between pt-2 border-t border-[#1D3557]/10">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#00BFFF] shrink-0" />
              <span className="text-[10px] font-bold text-[#2B2D42]">Tasa BCV:</span>
            </div>
            <div className="flex items-center gap-1">
              {isEditingBcv ? (
                <input
                  type="text"
                  value={bcvInputValue}
                  onChange={(e) => setBcvInputValue(e.target.value)}
                  onBlur={() => {
                    const val = parseFloat(bcvInputValue);
                    if (!isNaN(val) && val > 0) {
                      handleSaveBcvRate(val);
                    }
                    setIsEditingBcv(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = parseFloat(bcvInputValue);
                      if (!isNaN(val) && val > 0) {
                        handleSaveBcvRate(val);
                      }
                      setIsEditingBcv(false);
                    }
                  }}
                  className="w-20 px-1 py-0.5 text-xs border border-gray-300 rounded font-bold text-right text-gray-800 bg-white"
                  autoFocus
                />
              ) : (
                <span 
                  onDoubleClick={() => {
                    setBcvInputValue(bcvRate.toString());
                    setIsEditingBcv(true);
                  }}
                  className="text-xs font-montserrat font-black text-[#1D3557] bg-white border border-[#40E0D0]/60 px-2 py-0.5 rounded-lg cursor-pointer hover:bg-[#40E0D0]/10 transition flex items-center shadow-2xs"
                  title="Doble clic para editar tasa"
                >
                  Bs. {bcvRate.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="space-y-4">
          {navSections.map((section, sIdx) => {
            const filteredGroups = section.groups.filter(group => {
              if (group.directId) return isItemAllowed(group.directId);
              if (group.subItems) {
                return group.subItems.some(sub => isItemAllowed(sub.id));
              }
              return true;
            });

            if (filteredGroups.length === 0) return null;

            return (
              <div key={sIdx} className="space-y-1.5">
                <div className="flex items-center gap-1.5 px-2 pt-2 pb-1 border-b border-gray-200">
                  <span className="text-[10px] font-black font-montserrat text-[#1D3557]">{section.sectionNumber}.</span>
                  <span className="text-[9.5px] font-montserrat font-black uppercase tracking-wider text-[#2B2D42]/70">
                    {section.sectionTitle}
                  </span>
                </div>

                <div className="space-y-1">
                  {filteredGroups.map((group) => {
                    const GroupIcon = group.icon;
                    const isExpanded = !!expandedGroups[group.groupId];
                    
                    const isGroupActive = group.directId 
                      ? currentMenu === group.directId
                      : group.subItems?.some(sub => currentMenu === sub.id) || (group.groupId === 'contactos' && (currentMenu === 'clientes' || currentMenu === 'proveedores' || currentMenu === 'clientes_proveedores'));

                    // Single direct action item (no subItems)
                    if (group.directId && (!group.subItems || group.subItems.length === 0)) {
                      const isActive = currentMenu === group.directId;
                      return (
                        <button
                          key={group.groupId}
                          onClick={() => {
                            handleMenuChange(group.directId as AdminMenuType);
                            if (isMobile) setIsMobileDrawerOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-xs rounded-xl transition-all text-left cursor-pointer min-h-[38px] select-none font-montserrat ${
                            isActive
                              ? 'bg-[#1D3557] text-white font-black shadow-md tracking-tight border-l-4 border-[#40E0D0]'
                              : 'text-[#2B2D42] hover:bg-[#1D3557]/5 hover:text-[#1D3557] font-bold'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <GroupIcon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#40E0D0]' : 'text-gray-500'}`} />
                            <span className="truncate font-black">{group.title}</span>
                          </div>
                          {group.badge && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${isActive ? 'bg-[#40E0D0] text-[#1D3557]' : 'bg-[#1D3557]/10 text-[#1D3557]'}`}>
                              {group.badge}
                            </span>
                          )}
                        </button>
                      );
                    }

                    // Group with sub-items
                    const visibleSubItems = (group.subItems || []).filter(sub => isItemAllowed(sub.id));

                    return (
                      <div key={group.groupId} className="space-y-0.5">
                        <button
                          onClick={() => toggleGroup(group.groupId)}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all text-left cursor-pointer select-none font-montserrat ${
                            isGroupActive && !isExpanded
                              ? 'bg-[#1D3557]/10 text-[#1D3557] font-black border border-[#1D3557]/20'
                              : 'text-[#2B2D42] hover:bg-gray-100 font-bold'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <GroupIcon className={`w-4 h-4 shrink-0 ${isGroupActive ? 'text-[#1D3557]' : 'text-gray-500'}`} />
                            <span className="truncate text-xs font-black">{group.title}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {group.badge && (
                              <span className="text-[9px] bg-[#40E0D0]/20 text-[#1D3557] px-1.5 py-0.5 rounded-full font-black">
                                {group.badge}
                              </span>
                            )}
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                            )}
                          </div>
                        </button>

                        {/* Sub-items list */}
                        {isExpanded && (
                          <div className="ml-3.5 pl-2.5 border-l-2 border-[#1D3557]/20 space-y-0.5 py-0.5">
                            {visibleSubItems.map((sub) => {
                              const SubIcon = sub.icon;
                              const isSubActive = currentMenu === sub.id || (sub.id === 'clientes' && currentMenu === 'clientes_proveedores' && contactsTab === 'clientes') || (sub.id === 'proveedores' && currentMenu === 'clientes_proveedores' && contactsTab === 'proveedores');

                              return (
                                <button
                                  key={sub.id}
                                  onClick={() => {
                                    handleMenuChange(sub.id);
                                    if (sub.id === 'orders') {
                                      setActiveTab('orders');
                                      fetchOrders();
                                    } else if (sub.id === 'products') {
                                      setActiveTab('products');
                                    } else if (sub.id === 'clientes') {
                                      setContactsTab('clientes');
                                    } else if (sub.id === 'proveedores') {
                                      setContactsTab('proveedores');
                                    }
                                    if (isMobile) {
                                      setIsMobileDrawerOpen(false);
                                    }
                                  }}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-all text-left cursor-pointer min-h-[32px] select-none ${
                                    isSubActive
                                      ? 'bg-[#1D3557] text-white font-montserrat font-bold shadow-xs border-r-2 border-[#40E0D0]'
                                      : 'text-[#2B2D42] hover:bg-[#1D3557]/5 hover:text-[#1D3557] font-medium'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <SubIcon className={`w-3.5 h-3.5 shrink-0 ${isSubActive ? 'text-white' : 'text-gray-400'}`} />
                                    <span className="truncate text-[11px]">{sub.label}</span>
                                  </div>
                                  {sub.badge && (
                                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black ${isSubActive ? 'bg-white/20 text-white' : (sub.badgeColor || 'bg-gray-100 text-gray-700')}`}>
                                      {sub.badge}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </div>
    );
  };

  return (
    <div className="w-full select-none text-[#0F1111] admin-container">
      {/* Ultra-compact Mobile Header (< lg) */}
      <div className="lg:hidden h-12 bg-white border border-gray-200 rounded-xl shadow-xs mb-4 px-3 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsMobileDrawerOpen(true)}
            className="p-1.5 text-gray-700 hover:bg-gray-100 rounded-lg min-w-[40px] min-h-[40px] flex items-center justify-center cursor-pointer"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5 text-gray-800" />
          </button>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 bg-[#131921] rounded flex items-center justify-center">
              <LayoutDashboard className="w-3.5 h-3.5 text-white" />
            </div>
            <h1 className="font-black text-[#131921] text-xs uppercase tracking-tight truncate max-w-[130px]">
              {currentMenu === 'orders' ? 'Pedidos' :
               currentMenu === 'sales' ? 'Venta Flash' :
               currentMenu === 'products' ? 'Productos' :
               currentMenu === 'caja' ? 'Caja' :
               currentMenu === 'balance' ? 'Cuentas Pendientes' :
               (currentMenu === 'gastos' || currentMenu === 'reportes_gastos') ? 'Gastos fijos' :
               currentMenu === 'reportes_balance' ? 'Balance' :
               currentMenu === 'reportes_ganancias' ? 'Ganancias y pérdidas' :
               currentMenu === 'reportes' ? 'Reportes' :
               currentMenu === 'cotizaciones' ? 'Cotizaciones' :
               currentMenu === 'settings' ? 'Configuración' : 'Administración'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg text-[10px] font-black text-emerald-800">
            <TrendingUp className="w-3 h-3 text-emerald-600" />
            <span>Bs.{bcvRate.toFixed(2)}</span>
          </div>
          <div className="bg-blue-50 border border-blue-100 px-2 py-1 rounded-lg text-[10px] font-black text-blue-800">
            ${totalRevenue.toFixed(0)}
          </div>
        </div>
      </div>

      {/* Mobile Drawer (Slide-over Sidebar Overlay) */}
      {isMobileDrawerOpen && (
        <div 
          onClick={() => setIsMobileDrawerOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 lg:hidden transition-opacity"
        />
      )}

      <div className={`fixed top-0 left-0 bottom-0 z-50 w-[280px] bg-white p-4 shadow-2xl transition-transform duration-300 ease-in-out lg:hidden admin-sidebar flex flex-col justify-between overflow-y-auto ${isMobileDrawerOpen ? 'open translate-x-0' : '-translate-x-full'}`}>
        <div>
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#131921] rounded flex items-center justify-center">
                <LayoutDashboard className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-black text-[#131921] text-xs uppercase tracking-wider">Menú de Gestión</span>
            </div>
            <button 
              onClick={() => setIsMobileDrawerOpen(false)}
              className="p-2 text-gray-500 hover:text-black rounded-lg min-w-[40px] min-h-[40px] flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {renderNavigationItems(true)}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Hover trigger zone on the left edge when collapsed */}
        {isSidebarCollapsed && (
          <div 
            onMouseEnter={() => setIsSidebarHovered(true)}
            className="hidden lg:block fixed left-0 top-0 bottom-0 w-8 z-40 bg-transparent cursor-pointer group"
            title="Pasar mouse para ver el menú"
          >
            {/* Minimalist modern floating handle indicator */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-20 bg-[#005da9]/20 group-hover:bg-[#005da9] rounded-r-md transition-all group-hover:w-3.5 flex items-center justify-center shadow-xs">
              <span className="text-[10px] text-white font-black select-none">›</span>
            </div>
          </div>
        )}

        {/* Left Static Sidebar Navigation (Desktop) */}
        <aside 
          onMouseEnter={() => {
            if (isSidebarCollapsed) setIsSidebarHovered(true);
          }}
          onMouseLeave={() => {
            if (isSidebarCollapsed) setIsSidebarHovered(false);
          }}
          className={`
            hidden lg:flex flex-col justify-between self-start bg-white border border-gray-200 rounded-2xl p-5 shadow-xs transition-all duration-300 ease-in-out
            ${isSidebarCollapsed 
              ? `fixed top-6 left-6 z-50 w-64 h-[calc(100vh-48px)] overflow-y-auto shadow-2xl ${isSidebarHovered ? 'translate-x-0 opacity-100' : '-translate-x-[300px] opacity-0 pointer-events-none'}`
              : 'relative w-64 h-fit shrink-0 translate-x-0 opacity-100'
            }
          `}
        >
          <div>
            {renderNavigationItems(false)}
          </div>

          {/* Bottom logout button for desktop */}
          <div className="pt-3 border-t border-gray-100 mt-6">
            <button
              onClick={() => {
                if (onLogout) {
                  onLogout();
                } else {
                  window.location.reload();
                }
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[#d9383a] hover:text-red-700 hover:bg-red-50/60 rounded-xl transition-all cursor-pointer font-bold text-xs"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4 text-[#d9383a] shrink-0" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Brand Header Card */}
          <div className="bg-white border border-[#1D3557]/15 rounded-2xl p-4 md:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-poppins">
            <AdminBrandHeader showTagline={true} />
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <span className="text-[11px] font-bold text-[#2B2D42] bg-[#F8F9FA] px-3 py-1.5 rounded-xl border border-gray-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#40E0D0] animate-pulse"></span>
                Tasa Oficial: <strong className="font-montserrat text-[#1D3557] font-black">Bs. {bcvRate.toFixed(2)}</strong>
              </span>
            </div>
          </div>

          {/* VIEW: SALES (FACTURACIÓN / POS) */}
          {currentMenu === 'sales' && (
            <Suspense fallback={<AdminSubmoduleLoader name="Punto de Venta (POS)" />}>
              <POSModule 
                products={products} 
                productImages={productImages}
                bcvRate={bcvRate} 
                activeCurrency={activeCurrency} 
                currencyRates={currencyRates} 
                currentUser={currentUser}
                storeUsers={storeUsers}
                onRefreshData={() => {
                  onRefreshData();
                  fetchCajaData();
                }} 
                onOpenProductForm={() => handleOpenProductForm(null)}
                onOpenBalance={() => {
                  fetchCajaData();
                  setCurrentMenu('balance');
                }}
              />
            </Suspense>
          )}

          {/* VIEW: BALANCE / CUENTAS PENDIENTES (CxP & CxC) */}
          {currentMenu === 'balance' && (
            <Suspense fallback={<AdminSubmoduleLoader name="Cuentas Pendientes (CxP y CxC)" />}>
              <CuentasPendientesPage 
                bcvRate={bcvRate}
                currentUser={currentUser}
                onRefreshData={fetchCajaData}
              />
            </Suspense>
          )}

          {/* VIEW: CUENTAS BANCARIAS */}
          {currentMenu === 'cuentas_bancarias' && (
            <Suspense fallback={<AdminSubmoduleLoader name="Cuentas Bancarias" />}>
              <CuentasBancariasPage 
                bcvRate={bcvRate}
                currentUser={currentUser}
                onRefreshData={fetchCajaData}
              />
            </Suspense>
          )}

          {/* VIEW: GASTOS FIJOS/VARIABLES */}
          {(currentMenu === 'gastos' || currentMenu === 'reportes_gastos') && (
            <Suspense fallback={<AdminSubmoduleLoader name="Gastos Fijos/Variables" />}>
              <GastosPage 
                bcvRate={bcvRate}
                currentUser={currentUser}
                onRefreshData={fetchCajaData}
              />
            </Suspense>
          )}

          {/* VIEW: COTIZACIONES */}
          {currentMenu === 'cotizaciones' && (
            <Suspense fallback={<AdminSubmoduleLoader name="Cotizaciones y Presupuestos" />}>
              <CotizacionesPage 
                products={products}
                bcvRate={bcvRate}
                onRefreshData={() => {
                  onRefreshData();
                  if (typeof fetchCajaData === 'function') {
                    fetchCajaData();
                  }
                }}
              />
            </Suspense>
          )}

          {/* VIEW: CAJA Y ARQUEO */}
          {currentMenu === 'caja' && (
            <div className="space-y-6 text-left">
              {/* Calculations Helpers */}
              {(() => {
                const formatBs = (num: number | null | undefined) => {
                  if (num === null || num === undefined) return '—';
                  return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num) + ' Bs.';
                };

                const formatUSD = (num: number | null | undefined) => {
                  if (num === null || num === undefined) return '—';
                  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
                };

                // Filter operations for current session
                const activeSessionOps = activeSession 
                  ? cashOps.filter((op: any) => op.session_id === activeSession.id) 
                  : [];

                const initialFondoBs = activeSession ? activeSession.apertura_bs : 0;
                const initialFondoUsd = activeSession ? activeSession.apertura_usd : 0;

                // Ingresses belonging to active session
                const sessionIngressesOps = activeSessionOps.filter((op: any) => op.type === 'ingreso' && op.concept !== 'Apertura de Caja - Fondo Inicial');
                const sessionIngressesBs = sessionIngressesOps.reduce((acc: number, curr: any) => acc + (curr.amount_bs || (curr.amount * bcvRate)), 0);
                const sessionIngressesUsd = sessionIngressesOps.reduce((acc: number, curr: any) => acc + curr.amount, 0);

                // Egresses belonging to active session
                const sessionEgressesOps = activeSessionOps.filter((op: any) => op.type === 'egreso');
                const sessionEgressesBs = sessionEgressesOps.reduce((acc: number, curr: any) => acc + (curr.amount_bs || (curr.amount * bcvRate)), 0);
                const sessionEgressesUsd = sessionEgressesOps.reduce((acc: number, curr: any) => acc + curr.amount, 0);

                // Expected Net balance
                const esperadoSessionBs = initialFondoBs + sessionIngressesBs - sessionEgressesBs;
                const esperadoSessionUsd = initialFondoUsd + sessionIngressesUsd - sessionEgressesUsd;

                const startSession = async (aperturaBs: number, observaciones: string) => {
                  const openingUsd = aperturaBs / bcvRate;
                  const newSession = await dbService.createCashSession({
                    apertura_bs: aperturaBs,
                    apertura_usd: openingUsd,
                    observaciones: observaciones
                  });
                  
                  // Create starting cash movement
                  await dbService.addCashOp({
                    type: 'ingreso',
                    concept: 'Apertura de Caja - Fondo Inicial',
                    amount: openingUsd,
                    amount_bs: aperturaBs
                  });

                  await fetchCajaData();
                  setShowOpenCajaModal(false);
                  setOpenCajaAmountBs('10.00');
                  setCajaObservaciones('');
                  alert("¡Caja aperturada con éxito!");
                };

                const closeSession = async (cierreBs: number, observaciones: string) => {
                  if (!activeSession) return;
                  
                  const diferenciaBs = cierreBs - esperadoSessionBs;
                  const cierreUsd = cierreBs / bcvRate;
                  const diferenciaUsd = cierreUsd - esperadoSessionUsd;

                  await dbService.updateCashSession(activeSession.id, {
                    cierre: new Date().toLocaleString('es-VE'),
                    cierre_bs: cierreBs,
                    cierre_usd: cierreUsd,
                    esperado_bs: esperadoSessionBs,
                    esperado_usd: esperadoSessionUsd,
                    diferencia_bs: diferenciaBs,
                    diferencia_usd: diferenciaUsd,
                    estado: 'cerrada',
                    observaciones: observaciones
                  });

                  // Add closing movement
                  await dbService.addCashOp({
                    type: 'egreso',
                    concept: `Cierre de Caja - Entrega de Efectivo (Arqueo)`,
                    amount: cierreUsd,
                    amount_bs: cierreBs
                  });

                  await fetchCajaData();
                  setShowCloseCajaModal(false);
                  setCloseCajaAmountBs('');
                  setCajaObservaciones('');
                  alert("¡Caja cerrada y arqueada exitosamente!");
                };

                const handleRegisterManualMovement = async () => {
                  const amountNum = parseFloat(newOpAmount);
                  if (!newOpConcept.trim() || isNaN(amountNum) || amountNum <= 0) {
                    alert('Por favor ingrese un concepto válido y un monto mayor a cero.');
                    return;
                  }
                  
                  if (!activeSession) {
                    alert('Debe aperturar la caja antes de registrar movimientos manuales.');
                    return;
                  }

                  try {
                    const amountBs = amountNum * bcvRate;
                    await dbService.addCashOp({
                      type: newOpType,
                      concept: newOpConcept.trim(),
                      amount: amountNum,
                      amount_bs: amountBs
                    });
                    
                    setCajaSuccessMsg(`¡Movimiento registrado con éxito!`);
                    setNewOpConcept('');
                    setNewOpAmount('');
                    fetchCajaData();
                    setTimeout(() => setCajaSuccessMsg(null), 3000);
                  } catch (e) {
                    console.error("Error saving manual movement:", e);
                    alert("Error al registrar movimiento en base de datos.");
                  }
                };

                return (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-150 pb-4 font-poppins">
                      <div>
                        <h2 className="text-xl font-montserrat font-extrabold text-[#1D3557] uppercase tracking-tight flex items-center gap-2">
                          <Store className="w-6 h-6 text-[#40E0D0]" />
                          <span>Control de Caja</span>
                        </h2>
                        <p className="text-xs text-[#2B2D42]/70 font-medium mt-0.5">
                          Monitoreo de ingresos y egresos diarios, control de fondo fijo, y verificación de balances en bolívares y dólares.
                        </p>
                      </div>

                      {/* Header Session Action Controls */}
                      <div className="flex items-center gap-3">
                        {activeSession ? (
                          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl">
                            <div className="text-right">
                              <p className="text-[9px] text-emerald-800 font-montserrat font-extrabold uppercase tracking-wider">Caja Abierta</p>
                              <p className="text-[11px] text-emerald-600 font-mono font-bold leading-none mt-0.5">{activeSession.apertura}</p>
                            </div>
                            <button
                              onClick={() => {
                                setCloseCajaAmountBs('');
                                setCajaObservaciones('');
                                setShowCloseCajaModal(true);
                              }}
                              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-montserrat font-extrabold uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>Cerrar Caja</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 px-4 py-2 rounded-xl">
                            <div>
                              <p className="text-[9px] text-rose-800 font-montserrat font-extrabold uppercase tracking-wider">Caja Cerrada</p>
                              <p className="text-[10px] text-rose-500 font-semibold leading-none mt-0.5">Debe abrir caja para facturar</p>
                            </div>
                            <button
                              onClick={() => {
                                setOpenCajaAmountBs('10.00');
                                setCajaObservaciones('');
                                setShowOpenCajaModal(true);
                              }}
                              className="px-4 py-2 bg-[#40E0D0] hover:bg-[#36cebf] text-[#1D3557] text-xs font-montserrat font-extrabold uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
                            >
                              <Unlock className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>Aperturar Caja</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Cash balance metrics widgets */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-poppins">
                      <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
                        <p className="text-[10px] text-[#2B2D42]/60 font-montserrat font-extrabold uppercase tracking-wider">Fondo de Apertura</p>
                        <p className="text-lg font-black font-mono text-emerald-800 mt-1">{formatBs(initialFondoBs)}</p>
                        <p className="text-[10px] text-emerald-600 font-bold mt-0.5 font-mono">({formatUSD(initialFondoUsd)})</p>
                      </div>
                      <div className="bg-[#1D3557]/5 border border-[#1D3557]/15 rounded-xl p-4">
                        <p className="text-[10px] text-[#2B2D42]/60 font-montserrat font-extrabold uppercase tracking-wider">Ingresos del Turno</p>
                        <p className="text-lg font-black font-mono text-[#1D3557] mt-1">+{formatBs(sessionIngressesBs)}</p>
                        <p className="text-[10px] text-[#00BFFF] font-bold mt-0.5 font-mono">(+{formatUSD(sessionIngressesUsd)})</p>
                      </div>
                      <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-4">
                        <p className="text-[10px] text-[#2B2D42]/60 font-montserrat font-extrabold uppercase tracking-wider">Egresos del Turno</p>
                        <p className="text-lg font-black font-mono text-rose-800 mt-1">-{formatBs(sessionEgressesBs)}</p>
                        <p className="text-[10px] text-rose-600 font-bold mt-0.5 font-mono">(-{formatUSD(sessionEgressesUsd)})</p>
                      </div>
                      <div className="bg-[#F8F9FA] border border-gray-200 rounded-xl p-4">
                        <p className="text-[10px] text-[#2B2D42]/60 font-montserrat font-extrabold uppercase tracking-wider">Saldo Esperado</p>
                        <p className="text-lg font-black font-mono text-[#2B2D42] mt-1">{formatBs(esperadoSessionBs)}</p>
                        <p className="text-[10px] text-[#1D3557] font-bold mt-0.5 font-mono">({formatUSD(esperadoSessionUsd)})</p>
                      </div>
                    </div>

                    {/* Manual Cash Movement Form */}
                    <div className="bg-[#F8F9FA] border border-gray-200 rounded-2xl p-5 relative overflow-hidden font-poppins">
                      {!activeSession && (
                        <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-10 p-6 text-center select-none">
                          <div className="max-w-xs space-y-2">
                            <Lock className="w-8 h-8 text-rose-500 mx-auto" />
                            <p className="text-xs font-montserrat font-extrabold uppercase text-[#1D3557] tracking-tight">Formulario Bloqueado</p>
                            <p className="text-[11px] text-[#2B2D42]/70 font-medium leading-relaxed">Debe aperturar la caja diaria para registrar ingresos o egresos manuales de caja.</p>
                          </div>
                        </div>
                      )}
                      
                      <h3 className="text-xs font-montserrat font-extrabold uppercase tracking-wider text-[#1D3557] mb-3">Registrar Movimiento de Caja Manual</h3>
                      
                      {cajaSuccessMsg && (
                        <div className="mb-4 p-3 bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
                          <Check className="w-4 h-4 shrink-0" />
                          <span>{cajaSuccessMsg}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[10px] font-montserrat font-extrabold text-[#2B2D42]/80 uppercase mb-1">Concepto o Descripción</label>
                          <input
                            type="text"
                            placeholder="Ej. Pago de Delivery / Repuestos"
                            value={newOpConcept}
                            onChange={(e) => setNewOpConcept(e.target.value)}
                            disabled={!activeSession}
                            className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-[#2B2D42] focus:border-[#1D3557] focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-montserrat font-extrabold text-[#2B2D42]/80 uppercase mb-1">Monto ($ USD)</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Monto USD"
                            value={newOpAmount}
                            onChange={(e) => setNewOpAmount(e.target.value)}
                            disabled={!activeSession}
                            className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs font-mono font-bold text-[#2B2D42] focus:border-[#1D3557] focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                          />
                          {newOpAmount && !isNaN(parseFloat(newOpAmount)) && (
                            <span className="text-[9px] text-[#2B2D42]/70 font-bold mt-1 block">
                              Equivale a: <span className="text-[#1D3557] font-mono">{(parseFloat(newOpAmount) * bcvRate).toFixed(2)} Bs.</span>
                            </span>
                          )}
                        </div>

                        <div>
                          <label className="block text-[10px] font-montserrat font-extrabold text-[#2B2D42]/80 uppercase mb-1">Tipo de Movimiento</label>
                          <select
                            value={newOpType}
                            onChange={(e) => setNewOpType(e.target.value as any)}
                            disabled={!activeSession}
                            className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-[#2B2D42] focus:border-[#1D3557] focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                          >
                            <option value="ingreso">Ingreso (+)</option>
                            <option value="egreso">Egreso (-)</option>
                          </select>
                        </div>
                      </div>

                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={handleRegisterManualMovement}
                          disabled={!activeSession}
                          className="px-5 py-2.5 bg-[#1D3557] hover:bg-[#152843] text-white text-xs font-montserrat font-extrabold uppercase tracking-wider rounded-xl transition cursor-pointer shadow-xs disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed active:scale-95"
                        >
                          Registrar Movimiento
                        </button>
                      </div>
                    </div>

                    {/* Cash Movements Table for current open session */}
                    <div className="bg-white border border-gray-200/80 rounded-2xl shadow-xs overflow-hidden font-poppins">
                      <div className="p-4 bg-[#F8F9FA] border-b border-gray-100">
                        <h3 className="text-xs font-montserrat font-extrabold uppercase text-[#1D3557] tracking-wider">Detalle de Operaciones de la Sesión Activa</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-[#1D3557] text-white font-montserrat font-extrabold text-[10px] uppercase tracking-wider">
                              <th className="p-3">ID</th>
                              <th className="p-3">Concepto</th>
                              <th className="p-3">Hora</th>
                              <th className="p-3 text-right">Ingreso (Bs. / $)</th>
                              <th className="p-3 text-right">Egreso (Bs. / $)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 font-medium text-[#2B2D42]">
                            {activeSessionOps.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="p-8 text-center text-gray-400 font-semibold italic">
                                  No hay movimientos registrados en la sesión actual. Las ventas o ingresos manuales aparecerán aquí.
                                </td>
                              </tr>
                            ) : (
                              activeSessionOps.map((op: any) => (
                                <tr key={op.id} className="hover:bg-[#F8F9FA]">
                                  <td className="p-3 text-gray-400 font-mono">#{op.id}</td>
                                  <td className="p-3 font-bold text-[#2B2D42]">{op.concept}</td>
                                  <td className="p-3 text-gray-400 font-mono">{op.time}</td>
                                  <td className="p-3 text-right text-emerald-600 font-black font-mono">
                                    {op.type === 'ingreso' ? (
                                      <div className="flex flex-col items-end">
                                        <span>+{formatBs(op.amount_bs || (op.amount * bcvRate))}</span>
                                        <span className="text-[10px] text-emerald-500 font-semibold">({formatUSD(op.amount)})</span>
                                      </div>
                                    ) : ''}
                                  </td>
                                  <td className="p-3 text-right text-rose-600 font-black font-mono">
                                    {op.type === 'egreso' ? (
                                      <div className="flex flex-col items-end">
                                        <span>-{formatBs(op.amount_bs || (op.amount * bcvRate))}</span>
                                        <span className="text-[10px] text-rose-500 font-semibold">({formatUSD(op.amount)})</span>
                                      </div>
                                    ) : ''}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* REPORT: RECENT SESSIONS HISTORY */}
                    <div className="bg-white border border-gray-200/80 rounded-2xl shadow-xs overflow-hidden mt-6 font-poppins">
                      <div className="p-4 bg-[#F8F9FA] border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h3 className="text-xs font-montserrat font-extrabold uppercase text-[#1D3557] tracking-wider">Historial Reciente de Sesiones y Arqueo (Reporte)</h3>
                          <p className="text-[10px] text-[#2B2D42]/70 font-medium">Consulte el registro histórico de cierres de caja, balances esperados y diferencias detectadas.</p>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-[#1D3557] text-white font-montserrat font-extrabold text-[10px] uppercase tracking-wider">
                              <th className="p-3">Apertura</th>
                              <th className="p-3">Cierre</th>
                              <th className="p-3 text-right">Apertura Bs.</th>
                              <th className="p-3 text-right">Cierre Bs.</th>
                              <th className="p-3 text-right">Diferencia</th>
                              <th className="p-3 text-center">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 font-medium text-[#2B2D42]">
                            {cashSessions.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="p-8 text-center text-gray-400 font-semibold italic">
                                  No hay historial de cierres de caja registrado.
                                </td>
                              </tr>
                            ) : (
                              cashSessions.map((session: any) => (
                                <tr key={session.id} className="hover:bg-[#F8F9FA]">
                                  <td className="p-3 font-bold text-[#2B2D42]">{session.apertura}</td>
                                  <td className="p-3 text-[#2B2D42]/70 font-semibold">{session.cierre || '—'}</td>
                                  <td className="p-3 text-right text-[#2B2D42] font-mono font-bold">
                                    {formatBs(session.apertura_bs)}
                                  </td>
                                  <td className="p-3 text-right text-[#2B2D42] font-mono font-bold">
                                    {formatBs(session.cierre_bs)}
                                  </td>
                                  <td className="p-3 text-right font-mono font-black">
                                    {session.diferencia_bs !== null && session.diferencia_bs !== undefined ? (
                                      <span className={session.diferencia_bs === 0 ? 'text-gray-500' : session.diferencia_bs > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                        {session.diferencia_bs > 0 ? '+' : ''}{formatBs(session.diferencia_bs)}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">—</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-center">
                                    {session.estado === 'abierta' ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full bg-blue-50 text-blue-800 border border-blue-100">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                                        <span>Abierta</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full bg-gray-50 text-gray-600 border border-gray-150">
                                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                        <span>Cerrada</span>
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* MODAL: APERTURAR CAJA */}
                    {showOpenCajaModal && (
                      <Suspense fallback={<AdminSubmoduleLoader name="Apertura de Caja" />}>
                        <OpenCashSessionModal
                          isOpen={showOpenCajaModal}
                          onClose={() => setShowOpenCajaModal(false)}
                          onConfirm={async ({ aperturaBs, observaciones, empleadoNombre }) => {
                            const openingUsd = aperturaBs / (bcvRate || 36.5);
                            const empName = empleadoNombre.trim() || currentUser?.name || currentUser?.email || 'Cajero de Turno';
                            const newSession = await dbService.createCashSession({
                              apertura_bs: aperturaBs,
                              apertura_usd: openingUsd,
                              observaciones: observaciones,
                              empleado_nombre: empName
                            });
                            await dbService.addCashOp({
                              session_id: newSession?.id,
                              type: 'ingreso',
                              concept: 'Apertura de Caja - Fondo Inicial',
                              amount: openingUsd,
                              amount_bs: aperturaBs,
                              empleado_nombre: empName
                            });
                            await fetchCajaData();
                            setShowOpenCajaModal(false);
                            alert(`¡Caja registradora abierta exitosamente por ${empName}!`);
                          }}
                          bcvRate={bcvRate}
                          currentUser={currentUser}
                          storeUsers={storeUsers}
                          initialBs={openCajaAmountBs}
                          initialObs={cajaObservaciones}
                        />
                      </Suspense>
                    )}

                    {/* MODAL: CERRAR CAJA / ARQUEO */}
                    {showCloseCajaModal && (
                      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs select-none font-poppins">
                        <div className="bg-white rounded-2xl border border-gray-150 max-w-md w-full shadow-2xl p-6 text-left">
                          <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4">
                            <h3 className="text-sm font-montserrat font-extrabold uppercase text-[#1D3557] flex items-center gap-2">
                              <Lock className="w-5 h-5 text-rose-600" />
                              <span>Cerrar Caja y Arqueo</span>
                            </h3>
                            <button onClick={() => setShowCloseCajaModal(false)} className="text-gray-400 hover:text-[#1D3557] cursor-pointer">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          
                          <div className="space-y-4">
                            <div className="p-3 bg-[#F8F9FA] border border-gray-150 rounded-xl space-y-1 text-xs font-mono">
                              <div className="flex justify-between text-[#2B2D42]/70 font-bold">
                                <span>Fondo Inicial:</span>
                                <span className="text-[#1D3557] font-black">{formatBs(initialFondoBs)}</span>
                              </div>
                              <div className="flex justify-between text-[#2B2D42]/70 font-bold">
                                <span>(+) Ingresos del Turno:</span>
                                <span className="text-emerald-600 font-black">+{formatBs(sessionIngressesBs)}</span>
                              </div>
                              <div className="flex justify-between text-[#2B2D42]/70 font-bold">
                                <span>(-) Egresos del Turno:</span>
                                <span className="text-rose-600 font-black">-{formatBs(sessionEgressesBs)}</span>
                              </div>
                              <hr className="border-gray-200 my-1 font-sans" />
                              <div className="flex justify-between text-[#1D3557] font-black text-sm font-montserrat">
                                <span>Saldo Esperado en Caja:</span>
                                <span className="text-[#00BFFF]">{formatBs(esperadoSessionBs)}</span>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-montserrat font-extrabold text-[#1D3557] uppercase mb-1">Monto Real Contado en Caja (Bs.)</label>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="Monto contado físicamente"
                                value={closeCajaAmountBs}
                                onChange={(e) => setCloseCajaAmountBs(e.target.value)}
                                className="w-full p-2.5 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-semibold text-[#2B2D42] font-mono focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                              />
                              {closeCajaAmountBs && !isNaN(parseFloat(closeCajaAmountBs)) && (
                                <div className="mt-2 p-2 rounded-lg text-[11px] font-bold">
                                  {(() => {
                                    const contado = parseFloat(closeCajaAmountBs);
                                    const dif = contado - esperadoSessionBs;
                                    if (dif === 0) {
                                      return (
                                        <div className="text-emerald-700 bg-emerald-50 border border-emerald-100 p-1.5 rounded-lg flex items-center gap-1">
                                          <Check className="w-3.5 h-3.5" />
                                          <span>La caja cuadra perfectamente (Diferencia: 0,00 Bs.)</span>
                                        </div>
                                      );
                                    } else if (dif > 0) {
                                      return (
                                        <div className="text-[#1D3557] bg-[#40E0D0]/20 border border-[#40E0D0]/40 p-1.5 rounded-lg flex items-center gap-1 font-montserrat">
                                          <Check className="w-3.5 h-3.5 text-[#1D3557]" />
                                          <span>Sobrante en Caja: +{formatBs(dif)}</span>
                                        </div>
                                      );
                                    } else {
                                      return (
                                        <div className="text-rose-700 bg-rose-50 border border-rose-100 p-1.5 rounded-lg flex items-center gap-1">
                                          <AlertTriangle className="w-3.5 h-3.5" />
                                          <span>Faltante en Caja: {formatBs(dif)}</span>
                                        </div>
                                      );
                                    }
                                  })()}
                                </div>
                              )}
                            </div>

                            <div>
                              <label className="block text-[10px] font-montserrat font-extrabold text-[#1D3557] uppercase mb-1">Observaciones de Cierre</label>
                              <textarea
                                rows={2}
                                placeholder="Ej. Todo en orden. Caja cuadrada."
                                value={cajaObservaciones}
                                onChange={(e) => setCajaObservaciones(e.target.value)}
                                className="w-full p-2.5 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-medium text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                              />
                            </div>
                          </div>

                          <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-3 font-montserrat font-extrabold">
                            <button
                              onClick={() => setShowCloseCajaModal(false)}
                              className="px-4 py-2 bg-[#F8F9FA] hover:bg-gray-100 text-[#2B2D42] text-xs rounded-xl transition cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => {
                                const bs = parseFloat(closeCajaAmountBs);
                                if (isNaN(bs) || bs < 0) {
                                  alert("Por favor, ingrese el monto real contado en caja.");
                                  return;
                                }
                                closeSession(bs, cajaObservaciones.trim());
                              }}
                              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-xs uppercase tracking-wider"
                            >
                              Confirmar Cierre de Caja
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* VIEW: CLIENTES CON IDENTIFICACIÓN VENEZOLANA */}
          {(currentMenu === 'clientes' || (currentMenu === 'clientes_proveedores' && contactsTab === 'clientes')) && (
            <div className="space-y-6 text-left font-poppins">
              {/* Unified Contact Tab Switcher */}
              <div className="flex items-center gap-2 p-1 bg-[#F8F9FA] rounded-2xl w-fit border border-gray-200 shadow-2xs font-montserrat font-extrabold">
                <button
                  type="button"
                  onClick={() => {
                    setContactsTab('clientes');
                    if (currentMenu !== 'clientes_proveedores') setCurrentMenu('clientes');
                  }}
                  className="px-4 py-2 rounded-xl text-xs uppercase transition-all flex items-center gap-2 cursor-pointer bg-[#1D3557] text-white shadow-xs"
                >
                  <Users className="w-4 h-4 text-[#40E0D0]" />
                  <span>Clientes ({dbClients.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setContactsTab('proveedores');
                    if (currentMenu === 'clientes') setCurrentMenu('proveedores');
                  }}
                  className="px-4 py-2 rounded-xl text-xs uppercase transition-all flex items-center gap-2 cursor-pointer text-[#2B2D42] hover:text-[#1D3557] hover:bg-white"
                >
                  <Truck className="w-4 h-4 text-[#00BFFF]" />
                  <span>Proveedores ({providers.length})</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-montserrat font-extrabold text-[#1D3557] uppercase tracking-tight flex items-center gap-2">
                    <Users className="w-6 h-6 text-[#00BFFF]" />
                    <span>Clientes</span>
                  </h2>
                  <p className="text-xs text-[#2B2D42]/70 font-medium">
                    Gestión de clientes con identificación venezolana
                  </p>
                </div>
                <div className="flex items-center gap-2 font-montserrat font-extrabold">
                  <button
                    type="button"
                    onClick={fetchClients}
                    disabled={loadingClients}
                    className="px-3.5 py-2.5 bg-[#F8F9FA] hover:bg-gray-100 text-[#1D3557] text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 border border-gray-200 active:scale-95 uppercase tracking-wider"
                    title="Recargar y sincronizar clientes con Supabase"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingClients ? 'animate-spin text-[#00BFFF]' : 'text-[#00BFFF]'}`} />
                    <span className="hidden sm:inline">Sincronizar</span>
                  </button>
                  <button
                    onClick={openAddClientModal}
                    className="px-4 py-2.5 bg-[#40E0D0] hover:bg-[#36cebe] text-[#1D3557] text-xs uppercase tracking-wider rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer active:scale-95 border-b-2 border-[#1D3557]/20"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>Nuevo cliente</span>
                  </button>
                </div>
              </div>

              {/* Search & Filter bar */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-xs p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#00BFFF]">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar por nombre, código o documento..."
                    className="w-full pl-9 pr-4 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-medium text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF] focus:bg-white transition"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                  />
                  {clientSearch && (
                    <button 
                      onClick={() => setClientSearch('')} 
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-[#1D3557]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="text-[10px] text-[#2B2D42]/60 font-montserrat font-bold uppercase shrink-0">
                  Total en directorio: <span className="text-[#1D3557] font-extrabold">{dbClients.length} clientes</span>
                </div>
              </div>

              {/* Table of Clientes */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#1D3557] text-white font-montserrat font-extrabold uppercase text-[11px] tracking-wider">
                        <th className="p-4">Código</th>
                        <th className="p-4">Documento</th>
                        <th className="p-4">Nombre</th>
                        <th className="p-4">Tipo</th>
                        <th className="p-4">Teléfono</th>
                        <th className="p-4">Correo</th>
                        <th className="p-4">Crédito USD</th>
                        <th className="p-4 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-[#2B2D42] font-semibold">
                      {loadingClients ? (
                        <tr>
                          <td colSpan={8} className="p-12 text-center text-gray-400 font-semibold">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#00BFFF]" />
                            Cargando directorio de clientes...
                          </td>
                        </tr>
                      ) : filteredDbClients.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-12 text-center text-gray-400 font-semibold">
                            Sin clientes registrados
                          </td>
                        </tr>
                      ) : (
                        filteredDbClients.map((client) => (
                          <tr key={client.id} className="hover:bg-[#F8F9FA] transition">
                            <td className="p-4">
                              <span className="bg-[#1D3557]/10 text-[#1D3557] text-[10px] font-montserrat font-black uppercase px-2 py-1 rounded-lg border border-[#1D3557]/20 font-mono">
                                {client.code}
                              </span>
                            </td>
                            <td className="p-4 font-mono font-bold text-[#2B2D42]">{client.document}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <span className="w-7 h-7 rounded-full bg-[#40E0D0]/20 text-[#1D3557] font-montserrat font-extrabold flex items-center justify-center text-[10px] shrink-0 uppercase border border-[#40E0D0]/40">
                                  {(client.name || '').substring(0, 2).toUpperCase()}
                                </span>
                                <span className="font-extrabold text-[#1D3557]">{client.name}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-montserrat font-extrabold uppercase ${
                                client.type === 'Jurídico' 
                                  ? 'bg-purple-50 text-purple-700 border border-purple-100' 
                                  : 'bg-[#40E0D0]/20 text-[#1D3557] border border-[#40E0D0]/40'
                              }`}>
                                {client.type || 'Natural'}
                              </span>
                            </td>
                            <td className="p-4 font-mono text-[#2B2D42]/80">{client.phone || 'Sin teléfono'}</td>
                            <td className="p-4 font-mono text-[#2B2D42]/80 max-w-[150px] truncate" title={client.email}>
                              {client.email || <span className="text-gray-350 italic text-[11px]">Sin correo</span>}
                            </td>
                            <td className="p-4 font-black text-[#1D3557]">
                              ${(client.credit_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => openEditClientModal(client)}
                                  className="p-1.5 bg-[#00BFFF]/10 text-[#00BFFF] hover:bg-[#00BFFF]/20 rounded-lg transition cursor-pointer"
                                  title="Editar Cliente"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteClient(client.id, client.name)}
                                  className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition cursor-pointer"
                                  title="Eliminar Cliente"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* -------------------- MODAL: NUEVO / EDITAR CLIENTE -------------------- */}
              {showClientModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none font-poppins">
                  <div className="bg-white rounded-3xl border border-gray-150 w-full max-w-md shadow-2xl overflow-hidden text-left flex flex-col">
                    <div className="p-4 bg-[#1D3557] text-white flex justify-between items-center">
                      <span className="text-xs font-montserrat font-extrabold uppercase tracking-wider flex items-center gap-2 text-white">
                        <Users className="w-4 h-4 text-[#40E0D0]" />
                        <span>{selectedClientForEdit ? 'Editar Cliente' : 'Nuevo Cliente'}</span>
                      </span>
                      <button 
                        onClick={() => setShowClientModal(false)}
                        className="p-1.5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg transition cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={handleSaveClient} className="p-5 space-y-4">
                      <div>
                        <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">Nombre Completo / Razón Social *</label>
                        <input
                          type="text"
                          required
                          value={clientFormName}
                          onChange={(e) => setClientFormName(e.target.value)}
                          placeholder="Ej: Inversiones Pérez C.A., María Gómez"
                          className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">Tipo Identificación *</label>
                          <select
                            value={clientFormType}
                            onChange={(e) => setClientFormType(e.target.value)}
                            className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                          >
                            <option value="Natural">Natural (V / E)</option>
                            <option value="Jurídico">Jurídico (J / G)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">Cédula o RIF *</label>
                          <input
                            type="text"
                            required
                            value={clientFormDocument}
                            onChange={(e) => setClientFormDocument(e.target.value)}
                            placeholder="Ej: V-12345678 o J-31456987-0"
                            className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">Teléfono / WhatsApp</label>
                          <input
                            type="text"
                            value={clientFormPhone}
                            onChange={(e) => setClientFormPhone(e.target.value)}
                            placeholder="Ej: 0412-5551234"
                            className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">Límite de Crédito (USD)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={clientFormCredit}
                            onChange={(e) => setClientFormCredit(Number(e.target.value))}
                            placeholder="Ej: 100.00"
                            className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">Correo Electrónico</label>
                        <input
                          type="email"
                          value={clientFormEmail}
                          onChange={(e) => setClientFormEmail(e.target.value)}
                          placeholder="Ej: cliente@ejemplo.com"
                          className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                        />
                      </div>

                      <div className="flex gap-2 pt-3 border-t border-gray-100 font-montserrat font-extrabold">
                        <button
                          type="button"
                          onClick={() => setShowClientModal(false)}
                          className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#2B2D42] text-xs rounded-xl transition cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-2.5 bg-[#40E0D0] hover:bg-[#36cebe] text-[#1D3557] font-extrabold text-xs uppercase rounded-xl transition cursor-pointer shadow-md border-b-2 border-[#1D3557]/20"
                        >
                          Guardar Cliente
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW: FINANZAS > BALANCE (REPORTES DIARIOS: VENTAS, CUENTAS, INVENTARIO) */}
          {currentMenu === 'reportes_balance' && (
            <Suspense fallback={<AdminSubmoduleLoader name="Reportes Diarios de Balance" />}>
              <ReportesDiariosPage
                products={products}
                orders={orders}
                cashOps={cashOps}
                bcvRate={bcvRate}
                currentUser={currentUser}
                storeUsers={storeUsers}
                onRefreshData={onRefreshData}
              />
            </Suspense>
          )}

          {/* VIEW: LIBROS Y REPORTES / GANANCIAS Y PÉRDIDAS */}
          {(currentMenu === 'reportes' || currentMenu === 'reportes_ganancias') && (
            <Suspense fallback={<AdminSubmoduleLoader name="Reportes y Estadísticas" />}>
              <ReportesDashboard
                products={products}
                orders={orders}
                cashOps={cashOps}
                bcvRate={bcvRate}
                activeCurrency={activeCurrency}
                currencyRates={currencyRates}
                onRefreshData={onRefreshData}
                onExportSeniatExcel={handleExportOrdersExcel}
                onPrintInventoryReport={handlePrintInventoryReport}
                onOpenConfigDashboard={() => {
                  setSystemConfigSubTab('dashboard');
                  setCurrentMenu('settings');
                }}
              />
            </Suspense>
          )}

          {/* VIEW: AUDITORÍA */}
          {currentMenu === 'audit' && (
            <div className="space-y-6 text-left">
              <div>
                <h2 className="text-xl font-black text-[#131921] uppercase tracking-tight flex items-center gap-2">
                  <Activity className="w-6 h-6 text-rose-600" />
                  <span>Bitácora de Auditoría de Sistemas</span>
                </h2>
                <p className="text-xs text-gray-500 font-medium">
                  Registro histórico de operaciones realizadas por los administradores y operadores autorizados.
                </p>
              </div>

              {/* Logs Timeline list */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-150 flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase text-gray-800 tracking-wider">Historial de Operaciones Administrativas</h3>
                  <span className="text-[9px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-100 font-bold">SEGURIDAD ALTA</span>
                </div>
                <div className="p-4 space-y-4">
                  {[
                    { id: 1, action: 'Modificación de Tasa Cambiaria', desc: `Tasa BCV actualizada a Bs. ${bcvRate.toFixed(2)} por operador Pedro España.`, date: 'Hace unos instantes', ip: '190.120.45.18', badge: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                    { id: 2, action: 'Inicio de Sesión Exitoso', desc: 'Acceso correcto del usuario Pedro España con rol GERENTE.', date: 'Hace 30 minutos', ip: '190.120.45.18', badge: 'bg-blue-50 text-blue-700 border-blue-100' },
                    { id: 3, action: 'Consulta de Facturación POS', desc: 'Descarga del consolidado de ventas del mes en formato XLSX.', date: 'Hace 1 hora', ip: '190.120.45.18', badge: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
                    { id: 4, action: 'Sincronización de Base de Datos', desc: 'Actualización y refresco completo de la tabla de artículos de catálogo y pedidos de clientes.', date: 'Hace 2 horas', ip: 'Servidor Interno', badge: 'bg-purple-50 text-purple-700 border-purple-100' }
                  ].map((log) => (
                    <div key={log.id} className="p-3 bg-gray-50 border border-gray-150 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-gray-900">{log.action}</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded border ${log.badge} font-bold`}>{log.ip}</span>
                        </div>
                        <p className="text-gray-500 font-medium leading-relaxed">{log.desc}</p>
                      </div>
                      <div className="text-right text-[10px] text-gray-400 font-mono font-semibold shrink-0">
                        {log.date}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* VIEW: MARKETING */}
          {currentMenu === 'marketing' && (
            <Suspense fallback={<AdminSubmoduleLoader name="Módulo de Marketing y Cupones" />}>
              <MarketingModule />
            </Suspense>
          )}

          {/* VIEW: PROVEEDORES */}
          {(currentMenu === 'proveedores' || (currentMenu === 'clientes_proveedores' && contactsTab === 'proveedores')) && (
            <div className="space-y-6 text-left font-poppins" id="module-proveedores">
              {/* Unified Contact Tab Switcher */}
              <div className="flex items-center gap-2 p-1 bg-[#F8F9FA] rounded-2xl w-fit border border-gray-200 shadow-2xs font-montserrat font-extrabold">
                <button
                  type="button"
                  onClick={() => {
                    setContactsTab('clientes');
                    if (currentMenu === 'proveedores') setCurrentMenu('clientes');
                  }}
                  className="px-4 py-2 rounded-xl text-xs uppercase transition-all flex items-center gap-2 cursor-pointer text-[#2B2D42] hover:text-[#1D3557] hover:bg-white"
                >
                  <Users className="w-4 h-4 text-[#00BFFF]" />
                  <span>Clientes ({dbClients.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setContactsTab('proveedores');
                    if (currentMenu !== 'clientes_proveedores') setCurrentMenu('proveedores');
                  }}
                  className="px-4 py-2 rounded-xl text-xs uppercase transition-all flex items-center gap-2 cursor-pointer bg-[#1D3557] text-white shadow-xs"
                >
                  <Truck className="w-4 h-4 text-[#40E0D0]" />
                  <span>Proveedores ({providers.length})</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-montserrat font-extrabold text-[#1D3557] uppercase tracking-tight flex items-center gap-2">
                    <Truck className="w-6 h-6 text-[#00BFFF]" />
                    <span>Proveedores</span>
                  </h2>
                  <p className="text-xs text-[#2B2D42]/70 font-medium">
                    Gestión de proveedores con datos fiscales venezolanos
                  </p>
                </div>
                <button
                  onClick={openAddProviderModal}
                  className="px-4 py-2.5 bg-[#40E0D0] hover:bg-[#36cebe] text-[#1D3557] font-montserrat font-extrabold text-xs uppercase tracking-wider rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer active:scale-95 border-b-2 border-[#1D3557]/20"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Nuevo proveedor</span>
                </button>
              </div>

              {/* Search & Filter bar */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-xs p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#00BFFF]">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar por razón social, RIF o código..."
                    className="w-full pl-9 pr-4 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-medium text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF] focus:bg-white transition"
                    value={providerSearch}
                    onChange={(e) => setProviderSearch(e.target.value)}
                  />
                  {providerSearch && (
                    <button 
                      onClick={() => setProviderSearch('')} 
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-[#1D3557]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="text-[10px] text-[#2B2D42]/60 font-montserrat font-bold uppercase shrink-0">
                  Total proveedores: <span className="text-[#1D3557] font-extrabold">{providers.length}</span>
                </div>
              </div>

              {/* Table of Proveedores */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#1D3557] text-white font-montserrat font-extrabold uppercase text-[11px] tracking-wider">
                        <th className="p-4">Código</th>
                        <th className="p-4">RIF</th>
                        <th className="p-4">Razón social</th>
                        <th className="p-4">Tipo</th>
                        <th className="p-4">Teléfono</th>
                        <th className="p-4">Banco</th>
                        <th className="p-4 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-[#2B2D42] font-semibold">
                      {loadingProviders ? (
                        <tr>
                          <td colSpan={7} className="p-12 text-center text-gray-400 font-semibold">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#00BFFF]" />
                            Cargando proveedores...
                          </td>
                        </tr>
                      ) : filteredProviders.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-16 text-center text-gray-400 font-medium text-sm">
                            Sin proveedores registrados
                          </td>
                        </tr>
                      ) : (
                        filteredProviders.map((prov) => (
                          <tr key={prov.id} className="hover:bg-[#F8F9FA] transition">
                            <td className="p-4">
                              <span className="bg-[#1D3557]/10 text-[#1D3557] text-[10px] font-montserrat font-black uppercase px-2 py-1 rounded-lg border border-[#1D3557]/20 font-mono">
                                {prov.code}
                              </span>
                            </td>
                            <td className="p-4 font-mono font-bold text-[#2B2D42]">{prov.rif}</td>
                            <td className="p-4 font-extrabold text-[#1D3557]">{prov.name}</td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-montserrat font-extrabold uppercase ${
                                prov.type === 'Jurídico' 
                                  ? 'bg-purple-50 text-purple-700 border border-purple-100' 
                                  : 'bg-[#40E0D0]/20 text-[#1D3557] border border-[#40E0D0]/40'
                              }`}>
                                {prov.type || 'Jurídico'}
                              </span>
                            </td>
                            <td className="p-4 font-mono text-[#2B2D42]/80">{prov.phone || 'Sin teléfono'}</td>
                            <td className="p-4 text-[#2B2D42]">{prov.bank_name || 'No especificado'}</td>
                            <td className="p-4">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => openEditProviderModal(prov)}
                                  className="p-1.5 bg-[#00BFFF]/10 text-[#00BFFF] hover:bg-[#00BFFF]/20 rounded-lg transition cursor-pointer"
                                  title="Editar Proveedor"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteProvider(prov.id, prov.name)}
                                  className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition cursor-pointer"
                                  title="Eliminar Proveedor"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* -------------------- MODAL: NUEVO / EDITAR PROVEEDOR -------------------- */}
              {showProviderModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none font-poppins">
                  <div className="bg-white rounded-3xl border border-gray-150 w-full max-w-md shadow-2xl overflow-hidden text-left flex flex-col">
                    <div className="p-4 bg-[#1D3557] text-white flex justify-between items-center">
                      <span className="text-xs font-montserrat font-extrabold uppercase tracking-wider flex items-center gap-2 text-white">
                        <Truck className="w-4 h-4 text-[#40E0D0]" />
                        <span>{selectedProviderForEdit ? 'Editar Proveedor' : 'Nuevo Proveedor'}</span>
                      </span>
                      <button 
                        onClick={() => setShowProviderModal(false)}
                        className="p-1.5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg transition cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={handleSaveProvider} className="p-5 space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-1">
                          <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">Código *</label>
                          <input
                            type="text"
                            required
                            value={providerFormCode}
                            onChange={(e) => setProviderFormCode(e.target.value)}
                            placeholder="PROV-001"
                            className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">Razón Social *</label>
                          <input
                            type="text"
                            required
                            value={providerFormName}
                            onChange={(e) => setProviderFormName(e.target.value)}
                            placeholder="Ej: Distribuidora Bella Vista C.A."
                            className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">Tipo de Firma *</label>
                          <select
                            value={providerFormType}
                            onChange={(e) => setProviderFormType(e.target.value)}
                            className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                          >
                            <option value="Jurídico">Jurídico (J / G)</option>
                            <option value="Natural">Natural (V / E)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">RIF / Cédula *</label>
                          <input
                            type="text"
                            required
                            value={providerFormRif}
                            onChange={(e) => setProviderFormRif(e.target.value)}
                            placeholder="Ej: J-12345678-9"
                            className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">Teléfono</label>
                          <input
                            type="text"
                            value={providerFormPhone}
                            onChange={(e) => setProviderFormPhone(e.target.value)}
                            placeholder="Ej: 0261-7000123"
                            className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">Banco Receptor</label>
                          <input
                            type="text"
                            value={providerFormBankName}
                            onChange={(e) => setProviderFormBankName(e.target.value)}
                            placeholder="Ej: Banesco, Banco de Venezuela"
                            className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 pt-3 border-t border-gray-100 font-montserrat font-extrabold">
                        <button
                          type="button"
                          onClick={() => setShowProviderModal(false)}
                          className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#2B2D42] text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-2.5 bg-[#40E0D0] hover:bg-[#36cebe] text-[#1D3557] font-extrabold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer shadow-md border-b-2 border-[#1D3557]/20"
                        >
                          Guardar Proveedor
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW: COMPRAS */}
          {currentMenu === 'compras' && (
            <Suspense fallback={<AdminSubmoduleLoader name="Módulo de Compras y Gastos" />}>
              <ComprasModule
                products={products}
                providers={providers}
                onRefreshData={onRefreshData}
                currencyRates={currencyRates}
                activeRole={activeRole}
              />
            </Suspense>
          )}

          {/* VIEW: USUARIOS Y ACCESOS DEL PERSONAL INTERNO */}
          {currentMenu === 'users' && (
            <div className="space-y-6 text-left font-poppins" id="module-usuarios">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                <div>
                  <h2 className="text-xl font-montserrat font-extrabold text-[#1D3557] uppercase tracking-tight flex items-center gap-2">
                    <UserCheck className="w-6 h-6 text-[#00BFFF]" />
                    <span>Configuración de Usuarios Internos y Permisos</span>
                  </h2>
                  <p className="text-xs text-[#2B2D42]/70 font-medium mt-1">
                    Administración exclusiva del personal de tienda, asignación de roles y activación/desactivación de botones de acceso por módulo.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {((activeRole as string) === 'Admin' || (activeRole as string) === 'Gerente' || activeRole === 'admin' || activeRole === 'vendedor') ? (
                    <button 
                      onClick={() => {
                        setEditingUserId(null);
                        setUserFormName('');
                        setUserFormEmail('');
                        setUserFormPassword('');
                        setUserFormRole('Cajero');
                        setUserFormClientCode('');
                        setUserFormError('');
                        setShowUserModal(true);
                      }}
                      className="px-4 py-2.5 bg-[#40E0D0] hover:bg-[#36cebe] text-[#1D3557] font-montserrat font-extrabold text-xs rounded-xl transition shadow-md uppercase tracking-wider flex items-center gap-2 shrink-0 cursor-pointer border-b-2 border-[#1D3557]/20 active:scale-95"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>+ Incorporar Nuevo Usuario Interno</span>
                    </button>
                  ) : (
                    <span className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold rounded-xl shrink-0">
                      🔒 Permisos Restringidos
                    </span>
                  )}
                </div>
              </div>

              {/* INTERNAL STAFF TABLE */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-xs p-4 relative pb-6">
                <div className="flex items-center justify-between gap-3 mb-4 border-b border-gray-100 pb-3">
                  <h3 className="text-sm font-montserrat font-extrabold text-[#1D3557] uppercase flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#00BFFF]" />
                    <span>Personal Registrado en la Tienda ({storeUsers.filter(u => u.role !== 'Cliente').length}):</span>
                  </h3>
                  <span className="text-[11px] text-[#2B2D42]/70 font-medium">
                    Haz clic en <span className="font-bold text-[#00BFFF]">🔑 Botones de Accesos</span> en cada fila para activar/desactivar módulos individuales.
                  </span>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#1D3557] text-white font-montserrat font-extrabold uppercase text-[11px] tracking-wider">
                        <th className="px-4 py-3">Nombre del Personal</th>
                        <th className="px-4 py-3">Correo / Usuario</th>
                        <th className="px-4 py-3">Contraseña</th>
                        <th className="px-4 py-3">Rol Interno</th>
                        <th className="px-4 py-3">Botones de Acceso / Permisos</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-[#2B2D42]">
                      {loadingUsers ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-500 font-medium">Cargando usuarios internos...</td>
                        </tr>
                      ) : storeUsers
                          .filter(u => u.role !== 'Cliente')
                          .filter(user => {
                            const isCurrentAdmin = (activeRole as string) === 'Admin' || (activeRole as string) === 'admin' || (activeRole as string) === 'Administrador';
                            const isCurrentGerente = (activeRole as string) === 'Gerente' || (activeRole as string) === 'gerente';
                            if (isCurrentAdmin && !isCurrentGerente && (user.role === 'Gerente' || user.role === 'gerente')) {
                              return false; // El gerente no será visible para el administrador
                            }
                            return true;
                          }).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-500 font-medium">No hay usuarios internos registrados.</td>
                        </tr>
                      ) : (
                        storeUsers
                          .filter(u => u.role !== 'Cliente')
                          .filter(user => {
                            const isCurrentAdmin = (activeRole as string) === 'Admin' || (activeRole as string) === 'admin' || (activeRole as string) === 'Administrador';
                            const isCurrentGerente = (activeRole as string) === 'Gerente' || (activeRole as string) === 'gerente';
                            if (isCurrentAdmin && !isCurrentGerente && (user.role === 'Gerente' || user.role === 'gerente')) {
                              return false; // El gerente no será visible para el administrador
                            }
                            return true;
                          })
                          .map(user => {
                            const currentPerms = user.permissions && user.permissions.length > 0 
                              ? user.permissions 
                              : getDefaultPermissionsForRole(user.role);

                            return (
                              <tr key={user.id || user.email} className={!user.is_active ? 'opacity-50 bg-[#F8F9FA]' : 'hover:bg-[#F8F9FA] transition'}>
                                <td className="px-4 py-3.5 font-extrabold text-[#1D3557]">{user.name}</td>
                                <td className="px-4 py-3.5 font-mono font-medium text-[#2B2D42]">{user.email}</td>
                                <td className="px-4 py-3.5 font-mono text-[#2B2D42]/80">
                                  <div className="flex items-center gap-2">
                                    <span>
                                      {visiblePasswords[user.id || user.email] 
                                        ? (user.password || 'Sin clave') 
                                        : '••••••••'}
                                    </span>
                                    <button 
                                      type="button"
                                      onClick={() => {
                                        const key = user.id || user.email;
                                        setVisiblePasswords(prev => ({ ...prev, [key]: !prev[key] }));
                                      }}
                                      className="text-[#00BFFF] hover:underline text-[10px] cursor-pointer font-sans"
                                    >
                                      {visiblePasswords[user.id || user.email] ? 'Ocultar' : 'Ver'}
                                    </button>
                                  </div>
                                </td>
                                <td className="px-4 py-3.5">
                                  <span className={`inline-block px-2.5 py-1 rounded-full border font-montserrat font-extrabold text-[10px] uppercase tracking-wider ${
                                    user.role === 'Gerente'
                                      ? 'border-purple-200 text-purple-700 bg-purple-50'
                                      : user.role === 'Admin' || user.role === 'Administrador'
                                      ? 'border-[#1D3557]/20 text-[#1D3557] bg-[#1D3557]/10'
                                      : user.role === 'Cajero'
                                      ? 'border-[#40E0D0]/40 text-[#1D3557] bg-[#40E0D0]/20'
                                      : user.role === 'Despachador'
                                      ? 'border-amber-200 text-amber-700 bg-amber-50'
                                      : 'border-[#00BFFF]/30 text-[#00BFFF] bg-[#00BFFF]/10'
                                  }`}>
                                    {user.role}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPermissionsModal(user)}
                                    className="px-3 py-1.5 bg-[#40E0D0]/10 hover:bg-[#40E0D0]/20 border border-[#40E0D0]/40 text-[#1D3557] rounded-xl font-montserrat font-extrabold text-[11px] transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5 text-[#00BFFF]" />
                                    <span>🔑 Botones de Accesos ({currentPerms.length} activos)</span>
                                  </button>
                                </td>
                                <td className="px-4 py-3.5 font-montserrat font-bold">
                                  {((activeRole as string) === 'Admin' || (activeRole as string) === 'Gerente' || activeRole === 'admin' || activeRole === 'vendedor') ? (
                                    <button 
                                      onClick={() => handleToggleStoreUserStatus(user.id || user.email, user.is_active)}
                                      className={`text-xs font-bold cursor-pointer px-2.5 py-1 rounded-full transition ${
                                        user.is_active 
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' 
                                          : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                                      }`}
                                    >
                                      {user.is_active ? '🟢 Activo' : '🔴 Inactivo'}
                                    </button>
                                  ) : (
                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${user.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                      {user.is_active ? '🟢 Activo' : '🔴 Inactivo'}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3.5 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button 
                                      onClick={() => handleOpenPermissionsModal(user)}
                                      className="p-1.5 text-[#00BFFF] hover:bg-[#00BFFF]/10 rounded-lg transition cursor-pointer"
                                      title="Configurar Botones de Permisos"
                                    >
                                      <ShieldCheck className="w-4 h-4" />
                                    </button>
                                    {((activeRole as string) === 'Admin' || (activeRole as string) === 'Gerente' || activeRole === 'admin' || activeRole === 'vendedor') && (
                                      <>
                                        <button 
                                          onClick={() => {
                                            setEditingUserId(user.id || user.email);
                                            setUserFormName(user.name);
                                            setUserFormEmail(user.email);
                                            setUserFormPassword(user.password || '');
                                            setUserFormRole(user.role);
                                            setUserFormClientCode(user.client_code || '');
                                            setUserFormError('');
                                            setShowUserModal(true);
                                          }}
                                          className="p-1.5 text-[#1D3557] hover:bg-[#1D3557]/10 rounded-lg transition cursor-pointer"
                                          title="Editar Usuario Interno"
                                        >
                                          <Edit3 className="w-4 h-4" />
                                        </button>
                                        <button 
                                          onClick={() => handleDeleteStoreUser(user.id || user.email, user.name)}
                                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                          title="Eliminar Usuario Interno"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </>
                                    )}
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

              {/* PERMISSIONS REFERENCE MATRIX */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden p-4">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                  <h3 className="text-xs font-montserrat font-extrabold text-[#1D3557] uppercase flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#00BFFF]" />
                    <span>Matriz de Referencia de Accesos Predeterminados por Rol</span>
                  </h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#1D3557] text-white font-montserrat font-extrabold uppercase text-[10px] tracking-wider">
                        <th className="px-3 py-2.5">Rol / Función</th>
                        <th className="px-3 py-2.5 text-center">Pedidos</th>
                        <th className="px-3 py-2.5 text-center">Facturación</th>
                        <th className="px-3 py-2.5 text-center">Productos</th>
                        <th className="px-3 py-2.5 text-center">Caja</th>
                        <th className="px-3 py-2.5 text-center">Clientes</th>
                        <th className="px-3 py-2.5 text-center">Proveedores</th>
                        <th className="px-3 py-2.5 text-center">Compras</th>
                        <th className="px-3 py-2.5 text-center">Reportes</th>
                        <th className="px-3 py-2.5 text-center">Configuración</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium text-[#2B2D42]">
                      <tr className="hover:bg-[#F8F9FA]">
                        <td className="px-3 py-2 font-montserrat font-extrabold text-purple-700">Gerente General</td>
                        <td className="px-3 py-2 text-center text-emerald-600 font-bold">✓ Acceso Total</td>
                        <td className="px-3 py-2 text-center text-emerald-600 font-bold">✓ Acceso Total</td>
                        <td className="px-3 py-2 text-center text-emerald-600 font-bold">✓ Acceso Total</td>
                        <td className="px-3 py-2 text-center text-emerald-600 font-bold">✓ Acceso Total</td>
                        <td className="px-3 py-2 text-center text-emerald-600 font-bold">✓ Acceso Total</td>
                        <td className="px-3 py-2 text-center text-emerald-600 font-bold">✓ Acceso Total</td>
                        <td className="px-3 py-2 text-center text-emerald-600 font-bold">✓ Acceso Total</td>
                        <td className="px-3 py-2 text-center text-emerald-600 font-bold">✓ Acceso Total</td>
                        <td className="px-3 py-2 text-center text-emerald-600 font-bold">✓ Acceso Total</td>
                      </tr>
                      <tr className="hover:bg-[#F8F9FA]">
                        <td className="px-3 py-2 font-montserrat font-extrabold text-[#1D3557]">Administrador</td>
                        <td className="px-3 py-2 text-center text-emerald-600 font-bold">✓ Activo</td>
                        <td className="px-3 py-2 text-center text-emerald-600 font-bold">✓ Activo</td>
                        <td className="px-3 py-2 text-center text-emerald-600 font-bold">✓ Activo</td>
                        <td className="px-3 py-2 text-center text-emerald-600 font-bold">✓ Activo</td>
                        <td className="px-3 py-2 text-center text-emerald-600 font-bold">✓ Activo</td>
                        <td className="px-3 py-2 text-center text-emerald-600 font-bold">✓ Activo</td>
                        <td className="px-3 py-2 text-center text-emerald-600 font-bold">✓ Activo</td>
                        <td className="px-3 py-2 text-center text-emerald-600 font-bold">✓ Activo</td>
                        <td className="px-3 py-2 text-center text-emerald-600 font-bold">✓ Activo</td>
                      </tr>
                      <tr className="hover:bg-[#F8F9FA]">
                        <td className="px-3 py-2 font-montserrat font-extrabold text-[#40E0D0] bg-[#1D3557] rounded-sm">Cajero (POS)</td>
                        <td className="px-3 py-2 text-center text-emerald-600 font-bold">✓ Activo</td>
                        <td className="px-3 py-2 text-center text-emerald-600 font-bold">✓ Activo</td>
                        <td className="px-3 py-2 text-center text-gray-300">-</td>
                        <td className="px-3 py-2 text-center text-emerald-600 font-bold">✓ Activo</td>
                        <td className="px-3 py-2 text-center text-emerald-600 font-bold">✓ Activo</td>
                        <td className="px-3 py-2 text-center text-gray-300">-</td>
                        <td className="px-3 py-2 text-center text-gray-300">-</td>
                        <td className="px-3 py-2 text-center text-gray-300">-</td>
                        <td className="px-3 py-2 text-center text-gray-300">-</td>
                      </tr>
                      <tr className="hover:bg-[#F8F9FA]">
                        <td className="px-3 py-2 font-montserrat font-extrabold text-amber-700">Despachador</td>
                        <td className="px-3 py-2 text-center text-gray-300">-</td>
                        <td className="px-3 py-2 text-center text-gray-300">-</td>
                        <td className="px-3 py-2 text-center text-emerald-600 font-bold">✓ Solo Productos</td>
                        <td className="px-3 py-2 text-center text-gray-300">-</td>
                        <td className="px-3 py-2 text-center text-gray-300">-</td>
                        <td className="px-3 py-2 text-center text-gray-300">-</td>
                        <td className="px-3 py-2 text-center text-gray-300">-</td>
                        <td className="px-3 py-2 text-center text-gray-300">-</td>
                        <td className="px-3 py-2 text-center text-gray-300">-</td>
                      </tr>
                      <tr className="hover:bg-[#F8F9FA]">
                        <td className="px-3 py-2 font-montserrat font-extrabold text-[#00BFFF]">Repartidor</td>
                        <td className="px-3 py-2 text-center text-emerald-600 font-bold">✓ Solo Pedidos</td>
                        <td className="px-3 py-2 text-center text-gray-300">-</td>
                        <td className="px-3 py-2 text-center text-gray-300">-</td>
                        <td className="px-3 py-2 text-center text-gray-300">-</td>
                        <td className="px-3 py-2 text-center text-gray-300">-</td>
                        <td className="px-3 py-2 text-center text-gray-300">-</td>
                        <td className="px-3 py-2 text-center text-gray-300">-</td>
                        <td className="px-3 py-2 text-center text-gray-300">-</td>
                        <td className="px-3 py-2 text-center text-gray-300">-</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: CONFIGURACIÓN */}
          {currentMenu === 'settings' && (
            <div className="space-y-6 text-left font-poppins">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                <div>
                  <h2 className="text-xl font-montserrat font-extrabold text-[#1D3557] uppercase tracking-tight flex items-center gap-2">
                    <Settings className="w-6 h-6 text-[#00BFFF]" />
                    <span>Configuración General</span>
                  </h2>
                  <p className="text-xs text-[#2B2D42]/70 font-medium mt-1">
                    Parámetros de tienda, tipo de cambio BCV, impuestos y datos institucionales
                  </p>
                </div>
                
                <button 
                  onClick={() => handleMenuChange('audit')}
                  className="bg-[#1D3557] text-white hover:bg-[#152741] font-montserrat font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition cursor-pointer shadow-xs uppercase tracking-wider"
                >
                  <Activity className="w-4 h-4 text-[#40E0D0]" />
                  Registro de Auditoría
                </button>
              </div>

              <Suspense fallback={<AdminSubmoduleLoader name="Panel de Configuración del Sistema" />}>
                <SystemConfigPanel
                  initialSubTab={systemConfigSubTab}
                  currentUser={currentUser}
                  activeCurrency={activeCurrency}
                  onCurrencyChange={onCurrencyChange}
                  currencyRates={currencyRates}
                  onUpdateCurrencyRate={onUpdateCurrencyRate}
                  bcvInputValue={bcvInputValue}
                  setBcvInputValue={setBcvInputValue}
                  adminTaxes={adminTaxes}
                  loadAdminTaxes={loadAdminTaxes}
                  configStoreName={configStoreName}
                  setConfigStoreName={setConfigStoreName}
                  configRif={configRif}
                  setConfigRif={setConfigRif}
                  configIva={configIva}
                  setConfigIva={setConfigIva}
                  configPhone={configPhone}
                  setConfigPhone={setConfigPhone}
                />
              </Suspense>
            </div>
          )}
          {currentMenu === 'products' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
                <div>
                  <h2 className="text-xl font-montserrat font-extrabold text-[#1D3557] uppercase tracking-tight flex items-center gap-2">
                    <Package className="w-6 h-6 text-[#00BFFF]" />
                    <span>Productos y Mercancías</span>
                  </h2>
                  <p className="text-xs text-[#2B2D42]/70 font-medium font-poppins">
                    Gestión completa de productos, categorías, inventario y marcas de la plataforma.
                  </p>
                </div>

                {/* Top actions */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handlePrintInventoryReport}
                    className="px-4 py-2.5 bg-[#1D3557] hover:bg-[#152742] text-white text-xs font-montserrat font-extrabold rounded-xl flex items-center gap-2 cursor-pointer shadow-xs hover:shadow-md transition active:scale-95 uppercase tracking-wider"
                  >
                    <Printer className="w-4 h-4 text-[#40E0D0]" />
                    <span>Imprimir Reporte</span>
                  </button>
                  
                  {activeTab === 'products' && (
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept=".xlsx, .xls"
                        onChange={handleImportExcel}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2.5 bg-white border border-[#1D3557]/20 hover:bg-[#F8F9FA] text-[#1D3557] text-xs font-montserrat font-extrabold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition active:scale-95 uppercase tracking-wider"
                        id="btn-import-products"
                      >
                        <Upload className="w-4 h-4 text-[#00BFFF]" />
                        <span>Importar Excel</span>
                      </button>
                      <button
                        onClick={handleExportExcel}
                        className="px-4 py-2.5 bg-white border border-[#1D3557]/20 hover:bg-[#F8F9FA] text-[#1D3557] text-xs font-montserrat font-extrabold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition active:scale-95 uppercase tracking-wider"
                        id="btn-export-products"
                      >
                        <Download className="w-4 h-4 text-[#00BFFF]" />
                        <span>Exportar Excel</span>
                      </button>
                      <button
                        onClick={() => handleOpenProductForm(null)}
                        className="px-4 py-2.5 bg-[#40E0D0] hover:bg-[#36cebe] text-[#1D3557] text-xs font-montserrat font-extrabold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md hover:shadow-lg transition active:scale-95 uppercase tracking-wider border-b-2 border-[#1D3557]/20"
                        id="btn-add-product"
                      >
                        <Plus className="w-4 h-4 text-[#1D3557] stroke-[3]" />
                        <span>Nuevo Producto</span>
                      </button>
                    </div>
                  )}

                  {activeTab === 'categories' && (
                    <button
                      onClick={() => handleOpenCategoryForm(null)}
                      className="px-4 py-2.5 bg-[#40E0D0] hover:bg-[#36cebe] text-[#1D3557] text-xs font-montserrat font-extrabold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md hover:shadow-lg transition active:scale-95 uppercase tracking-wider border-b-2 border-[#1D3557]/20"
                      id="btn-add-category"
                    >
                      <Plus className="w-4 h-4 text-[#1D3557] stroke-[3]" />
                      <span>Nueva Categoría</span>
                    </button>
                  )}

                  {activeTab === 'brands' && (
                    <button
                      onClick={() => handleOpenBrandForm(null)}
                      className="px-4 py-2.5 bg-[#40E0D0] hover:bg-[#36cebe] text-[#1D3557] text-xs font-montserrat font-extrabold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md hover:shadow-lg transition active:scale-95 uppercase tracking-wider border-b-2 border-[#1D3557]/20"
                      id="btn-add-brand"
                    >
                      <Plus className="w-4 h-4 text-[#1D3557] stroke-[3]" />
                      <span>Nueva Marca</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Tabs Navigation */}
              <div className="flex border-b border-gray-200 gap-1 font-montserrat">
                <button
                  onClick={() => handleTabClick('products')}
                  className={`px-5 py-3 text-xs font-extrabold uppercase tracking-wider transition rounded-t-xl ${
                    activeTab === 'products'
                      ? 'bg-[#1D3557] text-white shadow-xs'
                      : 'text-[#2B2D42]/70 hover:text-[#1D3557] hover:bg-[#F8F9FA]'
                  }`}
                >
                  Artículos del Catálogo ({totalProducts})
                </button>
                <button
                  onClick={() => handleTabClick('categories')}
                  className={`px-5 py-3 text-xs font-extrabold uppercase tracking-wider transition rounded-t-xl ${
                    activeTab === 'categories'
                      ? 'bg-[#1D3557] text-white shadow-xs'
                      : 'text-[#2B2D42]/70 hover:text-[#1D3557] hover:bg-[#F8F9FA]'
                  }`}
                >
                  Categorías ({totalCategories})
                </button>
                <button
                  onClick={() => handleTabClick('brands')}
                  className={`px-5 py-3 text-xs font-extrabold uppercase tracking-wider transition rounded-t-xl ${
                    activeTab === 'brands'
                      ? 'bg-[#1D3557] text-white shadow-xs'
                      : 'text-[#2B2D42]/70 hover:text-[#1D3557] hover:bg-[#F8F9FA]'
                  }`}
                >
                  Marcas ({totalBrands})
                </button>
              </div>
            </div>
          )}

          {/* VIEW: ORDERS */}
          {currentMenu === 'orders' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
                <div>
                  <h2 className="text-xl font-montserrat font-extrabold text-[#1D3557] uppercase tracking-tight flex items-center gap-2">
                    <ClipboardList className="w-6 h-6 text-[#00BFFF]" />
                    <span>Control de Pedidos</span>
                  </h2>
                  <p className="text-xs text-[#2B2D42]/70 font-medium">
                    Validación de pagos, despachos, estados de entrega y notificaciones en tiempo real al cliente.
                  </p>
                </div>

                {/* Orders top actions */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setPedidosFacturadosSearch('');
                      setPedidosFacturadosTab('todos');
                      setShowPedidosFacturadosModal(true);
                    }}
                    className="px-4 py-2.5 bg-[#1D3557] hover:bg-[#152742] text-white text-xs font-montserrat font-extrabold rounded-xl transition shadow-md hover:shadow-lg uppercase tracking-wider flex items-center gap-2 cursor-pointer active:scale-98"
                    id="btn-pedidos-facturados"
                  >
                    <FileText className="w-4 h-4 text-[#40E0D0]" />
                    <span>Pedidos Facturados</span>
                  </button>
                  <button
                    onClick={fetchOrders}
                    className="px-4 py-2.5 bg-white border border-[#1D3557]/20 hover:bg-[#F8F9FA] text-[#1D3557] text-xs font-montserrat font-extrabold rounded-xl transition shadow-xs hover:shadow-md uppercase tracking-wider flex items-center gap-2 cursor-pointer active:scale-98"
                    id="btn-refresh-orders"
                  >
                    <RefreshCw className={`w-4 h-4 text-[#00BFFF] ${loadingOrders ? 'animate-spin' : ''}`} />
                    <span>Actualizar Pedidos</span>
                  </button>
                  <button
                    onClick={handleExportOrdersExcel}
                    className="px-4 py-2.5 bg-[#40E0D0] hover:bg-[#36cebe] text-[#1D3557] text-xs font-montserrat font-black rounded-xl transition shadow-md hover:shadow-lg uppercase tracking-wider flex items-center gap-2 cursor-pointer active:scale-98 border-b-2 border-[#1D3557]/20"
                    id="btn-export-orders"
                  >
                    <Download className="w-4 h-4 text-[#1D3557]" />
                    <span>Exportar Pedidos</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Conditional rendering of table views */}
          {currentMenu === 'products' && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto shadow-sm">
        
        {/* Products Table */}
        {activeTab === 'products' && (
          <div>
            {/* Search Bar & Filter Controls */}
            <div className="p-3 bg-[#F8F9FA] border-b border-gray-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-[#00BFFF] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar ítems por nombre, SKU, marca..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-poppins font-medium text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Button & Popover */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className={`px-3.5 py-1.5 bg-white border rounded-xl text-xs font-montserrat font-extrabold text-[#1D3557] flex items-center gap-1.5 shadow-2xs cursor-pointer transition ${
                    showFilterDropdown || productFilterOption !== 'inventario_venta'
                      ? 'border-[#00BFFF] text-[#1D3557] bg-[#00BFFF]/10'
                      : 'border-gray-200 hover:bg-[#F8F9FA]'
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4 text-[#00BFFF]" />
                  <span>Filtros</span>
                  {productFilterOption !== 'inventario_venta' && (
                    <span className="w-2 h-2 rounded-full bg-[#40E0D0]" />
                  )}
                </button>

                {/* Popover Menu */}
                {showFilterDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-20" 
                      onClick={() => setShowFilterDropdown(false)} 
                    />
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-30 p-3 text-left space-y-2">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                        <span className="text-xs font-montserrat font-black text-[#1D3557] uppercase tracking-wide flex items-center gap-1.5">
                          <SlidersHorizontal className="w-3.5 h-3.5 text-[#00BFFF]" />
                          Filtros de Productos
                        </span>
                        {productFilterOption !== 'inventario_venta' && (
                          <button
                            type="button"
                            onClick={() => {
                              setProductFilterOption('inventario_venta');
                              setShowFilterDropdown(false);
                            }}
                            className="text-[11px] font-montserrat font-extrabold text-[#00BFFF] hover:underline cursor-pointer"
                          >
                            Restablecer
                          </button>
                        )}
                      </div>

                      <div className="space-y-1 text-xs font-poppins font-medium text-[#2B2D42]">
                        {[
                          { id: 'inventario_venta', label: 'Inventario de Venta (Por defecto)' },
                          { id: 'inventario_costo', label: 'Inventario de Costo' },
                          { id: 'stock_critico', label: 'Stock Crítico' },
                          { id: 'destacados', label: 'Destacados' },
                          { id: 'mas_vendidos', label: 'Más Vendidos' },
                          { id: 'sin_rotacion', label: 'Sin Rotación' },
                          { id: 'ubicacion', label: 'Ubicación' }
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setProductFilterOption(opt.id as any);
                              setShowFilterDropdown(false);
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition text-xs font-bold ${
                              productFilterOption === opt.id
                                ? 'bg-[#1D3557]/10 text-[#1D3557] font-montserrat font-extrabold border border-[#1D3557]/20'
                                : 'hover:bg-[#F8F9FA] text-[#2B2D42] border border-transparent'
                            }`}
                          >
                            <span>{opt.label}</span>
                            {productFilterOption === opt.id && (
                              <Check className="w-3.5 h-3.5 text-[#40E0D0]" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Products Table */}
            <table className="w-full text-left border-collapse text-xs font-poppins">
              <thead>
                <tr className="bg-[#1D3557] text-white font-montserrat font-extrabold uppercase text-[11px] tracking-wider">
                  <th className="p-3">SKU</th>
                  <th className="p-3">Nombre</th>
                  <th className="p-3">Categoría</th>
                  {productFilterOption === 'inventario_costo' ? (
                    <th className="p-3 text-right">Precio Costo</th>
                  ) : (
                    <th className="p-3 text-right">Precio Venta</th>
                  )}
                  <th className="p-3 text-center">Cantidad</th>
                  {(productFilterOption === 'mas_vendidos' || productFilterOption === 'sin_rotacion') && (
                    <th className="p-3 text-center">Unid. Vendidas</th>
                  )}
                  {productFilterOption === 'inventario_costo' ? (
                    <th className="p-3 text-right">Valor Inv. Costo</th>
                  ) : (
                    <th className="p-3 text-right">Valor Inventario</th>
                  )}
                  {productFilterOption === 'ubicacion' && (
                    <th className="p-3">Ubicación</th>
                  )}
                  <th className="p-3 text-right sticky right-0 bg-[#1D3557] z-10">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-[#2B2D42]">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-gray-400 font-semibold text-xs">
                      No se encontraron productos coincidentes para el filtro seleccionado.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((prod) => {
                    const cat = categories.find(c => c.id === prod.category_id)?.name || 'General';
                    const salePrice = prod.offer_price || prod.price || 0;
                    const costPrice = prod.cost_price || 0;
                    const saleInvValue = prod.stock * salePrice;
                    const costInvValue = prod.stock * costPrice;
                    const soldQty = productSalesMap[prod.id] || productSalesMap[prod.sku] || productSalesMap[prod.name] || 0;
                    const locationText = (prod as any).location || 'Almacén Principal';

                    return (
                      <tr key={prod.id} className="hover:bg-[#F8F9FA] transition">
                        <td className="p-3 font-mono font-bold text-gray-500">
                          <div>{prod.sku}</div>
                          {prod.barcode_qr && (
                            <div className="text-[10px] text-gray-400 font-normal mt-0.5 flex items-center gap-1">
                              <Barcode className="w-3 h-3 text-gray-400" />
                              <span>{prod.barcode_qr}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3 font-bold text-[#1D3557] truncate max-w-xs">
                          <div className="flex items-center gap-1.5">
                            <span>{prod.name}</span>
                            {prod.featured && (
                              <span className="px-1.5 py-0.2 bg-[#40E0D0]/20 text-[#1D3557] text-[9px] font-montserrat font-extrabold rounded uppercase">
                                Destacado
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 font-semibold text-[#2B2D42]/80">{cat}</td>

                        {/* Price Column */}
                        {productFilterOption === 'inventario_costo' ? (
                          <td className="p-3 font-bold text-[#2B2D42] text-right">
                            ${costPrice.toFixed(2)}
                          </td>
                        ) : (
                          <td className="p-3 font-black text-[#1D3557] text-right">
                            {prod.offer_price ? (
                              <div className="flex flex-col items-end">
                                <span className="text-[#00BFFF] font-black">${prod.offer_price.toFixed(2)}</span>
                                <span className="text-[10px] text-gray-400 line-through">${prod.price.toFixed(2)}</span>
                              </div>
                            ) : (
                              <span>${prod.price.toFixed(2)}</span>
                            )}
                          </td>
                        )}

                        {/* Stock Quantity */}
                        <td className="p-3 text-center">
                          <span className={`font-bold px-2 py-0.5 rounded ${
                            prod.stock === 0 
                              ? 'bg-red-100 text-red-600' 
                              : prod.stock <= ((prod as any).critical_stock || inventarioLowStockThreshold || 5)
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-[#40E0D0]/20 text-[#1D3557] border border-[#40E0D0]/40'
                          }`}>
                            {prod.stock} disp.
                          </span>
                        </td>

                        {/* Units Sold (if Mas Vendidos or Sin Rotacion) */}
                        {(productFilterOption === 'mas_vendidos' || productFilterOption === 'sin_rotacion') && (
                          <td className="p-3 text-center font-bold text-gray-700">
                            {soldQty} un.
                          </td>
                        )}

                        {/* Inv Value */}
                        {productFilterOption === 'inventario_costo' ? (
                          <td className="p-3 font-black text-[#00BFFF] text-right">
                            ${costInvValue.toFixed(2)}
                          </td>
                        ) : (
                          <td className="p-3 font-black text-[#1D3557] text-right">
                            ${saleInvValue.toFixed(2)}
                          </td>
                        )}

                        {/* Ubicación (only displayed when Ubicación filter is active) */}
                        {productFilterOption === 'ubicacion' && (
                          <td className="p-3 font-semibold text-gray-600">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-bold border border-blue-200 shadow-2xs">
                              <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>{locationText}</span>
                            </span>
                          </td>
                        )}

                        {/* Acciones */}
                        <td className="p-3 text-right space-x-1.5 whitespace-nowrap sticky right-0 bg-white z-10">
                          <button
                            type="button" 
                            onClick={(e) => { e.stopPropagation(); handleOpenProductForm(prod); }}
                            className="p-1.5 text-[#00BFFF] hover:bg-[#00BFFF]/10 rounded border border-transparent hover:border-[#00BFFF]/30 transition cursor-pointer inline-flex items-center gap-1"
                            title="Editar"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button" 
                            onClick={(e) => { e.stopPropagation(); setMovementModalProd(prod); setMovementQty(1); setMovementType('ingreso'); }}
                            className="p-1.5 text-[#1D3557] hover:bg-[#1D3557]/10 rounded border border-transparent hover:border-[#1D3557]/30 transition cursor-pointer inline-flex items-center gap-1"
                            title="Movimiento de Producto"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Categories Table */}
        {activeTab === 'categories' && (
          <table className="w-full text-left border-collapse text-xs font-poppins">
            <thead>
              <tr className="bg-[#1D3557] text-white font-montserrat font-extrabold uppercase text-[11px] tracking-wider">
                <th className="p-3">Miniatura</th>
                <th className="p-3">Nombre de Categoría</th>
                <th className="p-3">Slug Único</th>
                <th className="p-3 text-center">Visible</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-[#2B2D42]">
              {filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400 font-semibold">
                    No hay categorías registradas.
                  </td>
                </tr>
              ) : (
                filteredCategories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-[#F8F9FA] transition">
                    <td className="p-3">
                      <img 
                        src={cat.image_url} 
                        alt={cat.name} 
                        className="w-8 h-8 rounded object-cover border border-gray-100"
                        referrerPolicy="no-referrer"
                      />
                    </td>
                    <td className="p-3 font-bold text-[#1D3557]">{cat.name}</td>
                    <td className="p-3 font-mono text-gray-400">{cat.slug}</td>
                    <td className="p-3 text-center">
                      <button
                        type="button" onClick={(e) => { e.stopPropagation(); handleToggleActiveCategory(cat); }}
                        className="text-gray-400 hover:text-[#00BFFF] transition"
                        title={cat.active ?? true ? "Ocultar Categoría" : "Mostrar Categoría"}
                      >
                        {cat.active ?? true ? (
                          <ToggleRight className="w-6 h-6 mx-auto text-[#40E0D0]" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 mx-auto text-gray-300" />
                        )}
                      </button>
                    </td>
                    <td className="p-3 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenCategoryForm(cat)}
                        className="p-1 text-[#00BFFF] hover:bg-[#00BFFF]/10 rounded border border-transparent transition cursor-pointer"
                        title="Editar"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-200 transition cursor-pointer"
                        title="Eliminar"
                        disabled={activeRole === 'vendedor'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* Brands Table */}
        {activeTab === 'brands' && (
          <table className="w-full text-left border-collapse text-xs font-poppins">
            <thead>
              <tr className="bg-[#1D3557] text-white font-montserrat font-extrabold uppercase text-[11px] tracking-wider">
                <th className="p-3">Logo</th>
                <th className="p-3">Nombre de Marca</th>
                <th className="p-3 text-center">Visible</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-[#2B2D42]">
              {filteredBrands.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-400 font-semibold">
                    No hay marcas registradas.
                  </td>
                </tr>
              ) : (
                filteredBrands.map((b) => (
                  <tr key={b.id} className="hover:bg-[#F8F9FA] transition">
                    <td className="p-3">
                      <img 
                        src={b.logo_url} 
                        alt={b.name} 
                        className="w-10 h-6 rounded object-contain bg-gray-50 border border-gray-200 p-0.5"
                        referrerPolicy="no-referrer"
                      />
                    </td>
                    <td className="p-3 font-bold text-[#1D3557]">{b.name}</td>
                    <td className="p-3 text-center">
                      <button
                        type="button" onClick={(e) => { e.stopPropagation(); handleToggleActiveBrand(b); }}
                        className="text-gray-400 hover:text-[#00BFFF] transition"
                        title={b.active ?? true ? "Ocultar Marca" : "Mostrar Marca"}
                      >
                        {b.active ?? true ? (
                          <ToggleRight className="w-6 h-6 mx-auto text-[#40E0D0]" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 mx-auto text-gray-300" />
                        )}
                      </button>
                    </td>
                    <td className="p-3 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenBrandForm(b)}
                        className="p-1 text-[#00BFFF] hover:bg-[#00BFFF]/10 rounded border border-transparent transition cursor-pointer"
                        title="Editar"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteBrand(b.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-200 transition cursor-pointer"
                        title="Eliminar"
                        disabled={activeRole === 'vendedor'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    )}

        {/* Orders Table & Panel */}
        {currentMenu === 'orders' && (
          <div className="p-4 bg-[#F8F9FA]/60 space-y-4">
            
            {/* Header for Orders */}
            <div className="flex justify-end items-center mb-2">
              <button
                onClick={() => {
                  handleMenuChange('sales');
                  if (typeof setActiveTab === 'function') setActiveTab('sales');
                }}
                className="px-4 py-2.5 bg-[#40E0D0] hover:bg-[#36cebe] text-[#1D3557] text-xs font-montserrat font-black rounded-xl transition shadow-md hover:shadow-lg uppercase tracking-wider flex items-center gap-2 cursor-pointer active:scale-98 border-b-2 border-[#1D3557]/20"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Nuevo Pedido</span>
              </button>
            </div>

            {/* Orders Tab Subheader Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border border-[#1D3557]/15 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5 text-left">
                <div className="p-2.5 bg-[#1D3557]/10 text-[#1D3557] rounded-xl">
                  <ClipboardList className="w-5 h-5 text-[#00BFFF]" />
                </div>
                <div>
                  <p className="text-[10px] text-[#2B2D42]/60 font-montserrat font-extrabold uppercase tracking-wide">Total Pedidos</p>
                  <p className="text-xl font-montserrat font-black text-[#1D3557]">{totalOrdersCount}</p>
                </div>
              </div>

              <div className="bg-white border border-[#1D3557]/15 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5 text-left">
                <div className="p-2.5 bg-amber-500/10 text-amber-700 rounded-xl">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-[10px] text-[#2B2D42]/60 font-montserrat font-extrabold uppercase tracking-wide">Pendientes</p>
                  <p className="text-xl font-montserrat font-black text-amber-700">{pendingOrdersCount}</p>
                </div>
              </div>

              <div className="bg-white border border-[#1D3557]/15 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5 text-left">
                <div className="p-2.5 bg-[#40E0D0]/15 text-[#1D3557] rounded-xl">
                  <Check className="w-5 h-5 text-[#40E0D0]" />
                </div>
                <div>
                  <p className="text-[10px] text-[#2B2D42]/60 font-montserrat font-extrabold uppercase tracking-wide">Completados</p>
                  <p className="text-xl font-montserrat font-black text-[#1D3557]">{completedOrdersCount}</p>
                </div>
              </div>

              <div className="bg-white border border-[#1D3557]/15 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5 text-left">
                <div className="p-2.5 bg-[#00BFFF]/10 text-[#00BFFF] rounded-xl">
                  <Coins className="w-5 h-5 text-[#00BFFF]" />
                </div>
                <div>
                  <p className="text-[10px] text-[#2B2D42]/60 font-montserrat font-extrabold uppercase tracking-wide">Facturación Activa</p>
                  <p className="text-xl font-montserrat font-black text-[#1D3557]">${totalRevenue.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Sub-filters row */}
            <div className="bg-white p-4 border border-[#1D3557]/15 rounded-2xl flex flex-wrap gap-4 items-center justify-between text-xs text-left shadow-2xs">
              <div className="flex flex-wrap gap-3 items-center">
                <div>
                  <label className="block text-[10px] font-montserrat font-extrabold text-[#1D3557] uppercase tracking-wide mb-1">Estado de Entrega</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-[#F8F9FA] border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-[#00BFFF] focus:outline-none font-bold text-[#2B2D42]"
                  >
                    <option value="all">Todos los Estados</option>
                    <option value="recibido">Recibido</option>
                    <option value="preparando">Preparando</option>
                    <option value="listo para retirar">Listo para Retirar</option>
                    <option value="en camino">En Camino</option>
                    <option value="entregado">Entregado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-montserrat font-extrabold text-[#1D3557] uppercase tracking-wide mb-1">Estado de Pago</label>
                  <select
                    value={paymentStatusFilter}
                    onChange={(e) => setPaymentStatusFilter(e.target.value)}
                    className="bg-[#F8F9FA] border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-[#00BFFF] focus:outline-none font-bold text-[#2B2D42]"
                  >
                    <option value="all">Todos los Pagos</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="pagado">Pagado</option>
                    <option value="reembolsado">Reembolsado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-montserrat font-extrabold text-[#1D3557] uppercase tracking-wide mb-1">Método de Entrega</label>
                  <select
                    value={deliveryMethodFilter}
                    onChange={(e) => setDeliveryMethodFilter(e.target.value)}
                    className="bg-[#F8F9FA] border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-[#00BFFF] focus:outline-none font-bold text-[#2B2D42]"
                  >
                    <option value="all">Todos</option>
                    <option value="retiro">Retiro en Tienda</option>
                    <option value="b2c">Envío a Domicilio</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-montserrat font-extrabold text-[#1D3557] uppercase tracking-wide mb-1">Filtrar por Fecha</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="bg-[#F8F9FA] border border-gray-200 rounded-xl px-3 py-1 text-xs focus:ring-2 focus:ring-[#00BFFF] focus:outline-none font-bold text-[#2B2D42] h-[30px]"
                    />
                    {dateFilter && (
                      <button
                        onClick={() => setDateFilter('')}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-montserrat font-black uppercase tracking-wider shadow-xs transition cursor-pointer"
                        title="Limpiar fecha"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* View Mode & Audio Alert Controls */}
              <div className="flex items-center gap-2">
                {/* Audio Notification Toggle */}
                <button
                  type="button"
                  onClick={() => setSoundAlertEnabled(!soundAlertEnabled)}
                  className={`p-2 rounded-xl transition flex items-center justify-center cursor-pointer shadow-xs active:scale-98 ${
                    soundAlertEnabled
                      ? 'bg-[#40E0D0] hover:bg-[#36cebe] text-[#1D3557]'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  }`}
                  title={soundAlertEnabled ? 'Alerta sonora de pedidos activada (ON)' : 'Alerta sonora desactivada (OFF)'}
                >
                  {soundAlertEnabled ? (
                    <Volume2 className="w-4 h-4 stroke-[2.5] animate-pulse text-[#1D3557]" />
                  ) : (
                    <VolumeX className="w-4 h-4 stroke-[2.5]" />
                  )}
                </button>

                {/* View Switcher Toggle Buttons */}
                <div className="bg-[#F8F9FA] p-1 rounded-2xl border border-gray-200 flex items-center shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setOrdersViewMode('kanban')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-montserrat font-extrabold transition flex items-center gap-1.5 cursor-pointer uppercase tracking-wider ${
                      ordersViewMode === 'kanban'
                        ? 'bg-[#1D3557] text-white shadow-xs'
                        : 'text-[#2B2D42] hover:text-[#1D3557]'
                    }`}
                  >
                    <Kanban className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Kanban</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrdersViewMode('table')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-montserrat font-extrabold transition flex items-center gap-1.5 cursor-pointer uppercase tracking-wider ${
                      ordersViewMode === 'table'
                        ? 'bg-[#1D3557] text-white shadow-xs'
                        : 'text-[#2B2D42] hover:text-[#1D3557]'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Tabla</span>
                  </button>
                </div>

                <div className="text-[11px] text-[#2B2D42]/60 font-bold hidden lg:block ml-2">
                  {filteredOrders.length} / {orders.length} pedidos
                </div>
              </div>
            </div>

            {/* ORDERS VIEW CONTAINER: KANBAN vs TABLE */}
            {ordersViewMode === 'kanban' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 overflow-x-auto pb-4">
                {[
                  { id: 'recibido', title: 'Recibido', bg: 'bg-[#F8F9FA]', headerBg: 'bg-[#1D3557] text-white', border: 'border-[#1D3557]/15', badge: 'bg-[#1D3557]/10 text-[#1D3557]', nextStatus: 'preparando', nextLabel: 'Preparar ➡️', nextBtnBg: 'bg-amber-600 hover:bg-amber-700' },
                  { id: 'preparando', title: 'Preparando', bg: 'bg-amber-50/40', headerBg: 'bg-amber-600 text-white', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-900', nextStatus: 'listo para retirar', nextLabel: 'Listo ➡️', nextBtnBg: 'bg-[#00BFFF] hover:bg-[#009bd1]' },
                  { id: 'listo para retirar', title: 'Listo p/ Retiro', bg: 'bg-sky-50/40', headerBg: 'bg-[#00BFFF] text-white', border: 'border-sky-200', badge: 'bg-sky-100 text-sky-900', nextStatus: 'en camino', nextLabel: 'Despachar ➡️', nextBtnBg: 'bg-[#1D3557] hover:bg-[#152742]' },
                  { id: 'en camino', title: 'En Camino', bg: 'bg-[#1D3557]/5', headerBg: 'bg-[#1D3557] text-white', border: 'border-[#1D3557]/20', badge: 'bg-[#1D3557]/10 text-[#1D3557]', nextStatus: 'entregado', nextLabel: 'Entregado ➡️', nextBtnBg: 'bg-[#40E0D0] hover:bg-[#36cebe] text-[#1D3557]' },
                  { id: 'entregado', title: 'Entregado', bg: 'bg-[#40E0D0]/10', headerBg: 'bg-[#40E0D0] text-[#1D3557]', border: 'border-[#40E0D0]/30', badge: 'bg-[#40E0D0]/20 text-[#1D3557]', nextStatus: null, nextLabel: '', nextBtnBg: '' },
                  { id: 'cancelado', title: 'Cancelado', bg: 'bg-rose-50/40', headerBg: 'bg-rose-600 text-white', border: 'border-rose-200', badge: 'bg-rose-100 text-rose-900', nextStatus: null, nextLabel: '', nextBtnBg: '' }
                ].map((col) => {
                  const colOrders = filteredOrders.filter(o => {
                    const rawSt = pendingChanges[o.id]?.status ?? (o.status || 'recibido');
                    const st = normalizeOrderStatus(rawSt);
                    return st === col.id;
                  });
                  const colRevenue = colOrders.reduce((sum, o) => sum + Number(o.total_price || 0), 0);

                  return (
                    <div key={col.id} className={`${col.bg} border ${col.border} rounded-2xl p-2.5 flex flex-col min-w-[230px] max-h-[700px]`}>
                      {/* Column Header */}
                      <div className={`${col.headerBg} p-2.5 rounded-xl flex items-center justify-between mb-2 shadow-2xs`}>
                        <div>
                          <h3 className="font-montserrat font-extrabold text-xs tracking-tight uppercase flex items-center gap-1.5">
                            <span>{col.title}</span>
                          </h3>
                          <p className="text-[10px] opacity-80 font-mono">${colRevenue.toFixed(2)} USD</p>
                        </div>
                        <span className="text-xs font-montserrat font-black bg-white/20 px-2 py-0.5 rounded-full">
                          {colOrders.length}
                        </span>
                      </div>

                      {/* Cards Column Body */}
                      <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                        {loadingOrders ? (
                          <div className="p-4 text-center text-gray-400">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1 text-[#00BFFF]" />
                            <span className="text-[10px]">Cargando...</span>
                          </div>
                        ) : colOrders.length === 0 ? (
                          <div className="p-4 text-center text-gray-400 text-[11px] font-medium border border-dashed border-gray-300 rounded-xl my-2">
                            Sin pedidos
                          </div>
                        ) : (
                          colOrders.map((order) => {
                            const formattedNum = String(order.order_number || '').padStart(7, '0');
                            const isUpdating = updatingOrderId === order.id;
                            const currentPaymentStatus = pendingChanges[order.id]?.payment_status ?? (order.payment_status || 'pendiente');
                            const hasPendingChanges = Boolean(pendingChanges[order.id]);

                            return (
                              <div 
                                key={order.id} 
                                className="bg-white border border-gray-200 hover:border-[#00BFFF] rounded-2xl p-3.5 shadow-2xs transition flex flex-col justify-between text-left group"
                              >
                                {/* Top Row: Order # & Delivery Badge */}
                                <div className="flex items-center justify-between gap-1 mb-1.5">
                                  <span className="font-mono font-black text-xs text-[#1D3557]">
                                    #{formattedNum}
                                  </span>
                                  <span className={`text-[9px] font-montserrat font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                    order.delivery_method === 'retiro' 
                                      ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                                      : 'bg-[#1D3557]/10 text-[#1D3557] border border-[#1D3557]/20'
                                  }`}>
                                    {order.delivery_method === 'retiro' ? '🏪 Retiro' : '🛵 Envío'}
                                  </span>
                                </div>

                                {/* Customer Info */}
                                <div className="mb-2">
                                  <p className="font-montserrat font-bold text-xs text-[#2B2D42] truncate">
                                    {order.customer_name || 'Cliente general'}
                                  </p>
                                  {order.phone_number && (
                                    <p className="text-[10px] font-mono text-gray-500 truncate">
                                      📞 {order.phone_number}
                                    </p>
                                  )}
                                </div>

                                {/* Items snippet */}
                                {Array.isArray(order.items) && order.items.length > 0 && (
                                  <div className="bg-[#F8F9FA] p-2 rounded-xl text-[10px] text-[#2B2D42] mb-2 border border-gray-200 line-clamp-2">
                                    {order.items.map((it: any) => `${it.quantity || 1}x ${it.name || 'Producto'}`).join(', ')}
                                  </div>
                                )}

                                {/* Timer & Total */}
                                <div className="flex items-center justify-between border-t border-gray-100 pt-2 mb-2">
                                  <OrderTimer createdAt={order.created_at} status={order.status} currentTime={currentTime} />
                                  <div className="text-right">
                                    <span className="text-sm font-montserrat font-black text-[#1D3557] block">
                                      ${Number(order.total_price || 0).toFixed(2)}
                                    </span>
                                  </div>
                                </div>

                                {/* Payment Status Dropdown */}
                                <div className="mb-2 flex items-center justify-between gap-1">
                                  <span className="text-[10px] text-gray-400 font-bold uppercase">Pago:</span>
                                  <select
                                    disabled={isUpdating}
                                    value={(currentPaymentStatus || '').toLowerCase()}
                                    onChange={(e) => handlePendingChange(order.id, 'payment_status', e.target.value)}
                                    className={`text-[10px] font-extrabold rounded-lg px-2 py-0.5 border cursor-pointer ${
                                      (currentPaymentStatus || '').toLowerCase() === 'pendiente' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                                      (currentPaymentStatus || '').toLowerCase() === 'pagado' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                                      'bg-red-100 text-red-800 border-red-300'
                                    }`}
                                  >
                                    <option value="pendiente">⏳ Pendiente</option>
                                    <option value="pagado">✅ Pagado</option>
                                    <option value="reembolsado">↩️ Reembolsado</option>
                                  </select>
                                </div>

                                {/* Action Buttons Row */}
                                <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-gray-100">
                                  <button
                                    onClick={() => setSelectedOrder(order)}
                                    className="px-2.5 py-1 bg-[#1D3557] hover:bg-[#152742] text-white rounded-xl transition cursor-pointer text-[10px] font-montserrat font-bold uppercase tracking-wider shadow-xs flex items-center gap-1 active:scale-95"
                                    title="Ver detalle completo"
                                  >
                                    <Eye className="w-3.5 h-3.5 stroke-[2.5] text-[#00BFFF]" />
                                    <span>Detalle</span>
                                  </button>

                                  {hasPendingChanges ? (
                                    <button
                                      onClick={() => handleConfirmOrderChanges(order.id)}
                                      disabled={isUpdating}
                                      className="px-3 py-1 bg-[#40E0D0] hover:bg-[#36cebe] text-[#1D3557] font-montserrat font-black rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1 cursor-pointer shadow-md transition animate-pulse active:scale-95 border-b border-[#1D3557]/20"
                                    >
                                      <Check className="w-3 h-3 stroke-[3]" />
                                      <span>Confirmar</span>
                                    </button>
                                  ) : col.nextStatus ? (
                                    <button
                                      onClick={() => handlePendingChange(order.id, 'status', col.nextStatus!)}
                                      className={`px-3 py-1 ${col.nextBtnBg} text-[10px] font-montserrat font-extrabold rounded-xl shadow-xs transition cursor-pointer uppercase tracking-wider flex items-center gap-1 active:scale-95`}
                                      title={`Avanzar a ${col.nextStatus}`}
                                    >
                                      {col.nextLabel}
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Table View */
              <div className="bg-white border border-[#1D3557]/15 rounded-2xl shadow-xs overflow-x-auto max-h-[650px] overflow-y-auto">
              {loadingOrders ? (
                <div className="p-12 text-center text-gray-400">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[#00BFFF]" />
                  <p className="font-semibold text-xs">Cargando lista de pedidos desde la base de datos...</p>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-semibold text-xs">No se encontraron pedidos que coincidan con la búsqueda o filtros.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-20 bg-[#1D3557] shadow-xs">
                    <tr className="bg-[#1D3557] text-white">
                      <th className="p-3.5 font-montserrat font-extrabold">Pedido N°</th>
                      <th className="p-3.5 font-montserrat font-extrabold">Cliente / Contacto</th>
                      <th className="p-3.5 font-montserrat font-extrabold">Método Entrega</th>
                      <th className="p-3.5 font-montserrat font-extrabold">Método Pago</th>
                      <th className="p-3.5 font-montserrat font-extrabold text-right">Total (USD)</th>
                      <th className="p-3.5 font-montserrat font-extrabold text-left">Tiempo / Inicio</th>
                      <th className="p-3.5 font-montserrat font-extrabold text-center">Estado de la Entrega</th>
                      <th className="p-3.5 font-montserrat font-extrabold text-center">Estado del Pago</th>
                      <th className="p-3.5 font-montserrat font-extrabold text-right">Detalles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium text-[#2B2D42]">
                    {filteredOrders.map((order) => {
                      const formattedNum = String(order.order_number || '').padStart(7, '0');
                      const orderDate = order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A';
                      const isUpdating = updatingOrderId === order.id;

                      const currentStatus = pendingChanges[order.id]?.status ?? (order.status || 'recibido');
                      const currentPaymentStatus = pendingChanges[order.id]?.payment_status ?? (order.payment_status || 'pendiente');
                      const hasPendingChanges = !!pendingChanges[order.id];

                      return (
                        <tr key={order.id} className="hover:bg-[#F8F9FA] transition">
                          {/* Order number with padding */}
                          <td className="p-3 font-mono font-black text-[#1D3557] text-[13px]">
                            #{formattedNum}
                          </td>

                          {/* Customer contact info */}
                          <td className="p-3 text-left">
                            <div className="font-montserrat font-bold text-[#2B2D42]">{order.customer_name}</div>
                            <div className="text-gray-400 text-[10px] font-mono">{order.phone_number}</div>
                          </td>

                          {/* Delivery info */}
                          <td className="p-3 whitespace-nowrap text-left">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              order.delivery_method === 'retiro' 
                                ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                                : 'bg-sky-50 text-sky-700 border border-sky-200'
                            }`}>
                              {order.delivery_method === 'retiro' ? (
                                <Store className="w-3 h-3" />
                              ) : (
                                <Truck className="w-3 h-3" />
                              )}
                              {order.delivery_method === 'retiro' ? 'Retiro' : 'Envío'}
                            </span>
                          </td>

                          {/* Payment method */}
                          <td className="p-3 font-semibold text-gray-600 truncate max-w-[120px] text-left">
                            {order.payment_method || 'No especificado'}
                          </td>

                          {/* Total Price */}
                          <td className="p-3 text-right font-black text-gray-900 text-sm">
                            ${Number(order.total_price || 0).toFixed(2)}
                          </td>

                          {/* Creation Date / Timer */}
                          <td className="p-3 whitespace-nowrap text-left">
                            <OrderTimer createdAt={order.created_at} status={order.status} currentTime={currentTime} />
                          </td>

                          {/* Interactive Delivery Status select */}
                          <td className="p-3 text-center">
                            <div className="relative inline-block">
                              <select
                                disabled={isUpdating}
                                value={(currentStatus || '').toLowerCase()}
                                onChange={(e) => handlePendingChange(order.id, 'status', e.target.value)}
                                className={`text-[11px] font-black rounded-xl border px-2.5 py-1 focus:ring-2 focus:ring-[#00BFFF] focus:outline-none select-none cursor-pointer text-center ${
                                  (currentStatus || '').toLowerCase() === 'recibido' ? 'bg-[#F8F9FA] text-[#1D3557] border-[#1D3557]/20' :
                                  (currentStatus || '').toLowerCase() === 'preparando' ? 'bg-amber-50 text-amber-800 border-amber-300' :
                                  (currentStatus || '').toLowerCase() === 'listo para retirar' ? 'bg-sky-50 text-sky-800 border-sky-300' :
                                  (currentStatus || '').toLowerCase() === 'en camino' ? 'bg-[#1D3557]/10 text-[#1D3557] border-[#1D3557]/30' :
                                  (currentStatus || '').toLowerCase() === 'entregado' ? 'bg-[#40E0D0]/15 text-[#1D3557] border-[#40E0D0]/40 font-bold' :
                                  'bg-rose-50 text-rose-800 border-rose-300'
                                } ${pendingChanges[order.id]?.status ? 'ring-2 ring-[#40E0D0] ring-offset-1' : ''}`}
                              >
                                <option value="recibido">Recibido</option>
                                <option value="preparando">Preparando</option>
                                <option value="listo para retirar">Listo para Retirar</option>
                                <option value="en camino">En Camino</option>
                                <option value="entregado">Entregado</option>
                                <option value="cancelado">Cancelado</option>
                              </select>
                              {isUpdating && (
                                <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-xl">
                                  <RefreshCw className="w-3 h-3 animate-spin text-[#00BFFF]" />
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Interactive Payment Status select */}
                          <td className="p-3 text-center">
                            <div className="relative inline-block">
                              <select
                                disabled={isUpdating}
                                value={(currentPaymentStatus || '').toLowerCase()}
                                onChange={(e) => handlePendingChange(order.id, 'payment_status', e.target.value)}
                                className={`text-[11px] font-black rounded-xl border px-2.5 py-1 focus:ring-2 focus:ring-[#00BFFF] focus:outline-none select-none cursor-pointer text-center ${
                                  (currentPaymentStatus || '').toLowerCase() === 'pendiente' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                                  (currentPaymentStatus || '').toLowerCase() === 'pagado' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                                  'bg-red-100 text-red-800 border-red-300'
                                } ${pendingChanges[order.id]?.payment_status ? 'ring-2 ring-[#40E0D0] ring-offset-1' : ''}`}
                              >
                                <option value="pendiente">Pendiente</option>
                                <option value="pagado">Pagado</option>
                                <option value="reembolsado">Reembolsado</option>
                              </select>
                              {isUpdating && (
                                <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-xl">
                                  <RefreshCw className="w-3 h-3 animate-spin text-[#00BFFF]" />
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Actions - View Detail and Confirm Changes */}
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {hasPendingChanges && (
                                <button
                                  onClick={() => handleConfirmOrderChanges(order.id)}
                                  disabled={isUpdating}
                                  className="px-3 py-1 bg-[#40E0D0] hover:bg-[#36cebe] text-[#1D3557] font-montserrat font-black rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1 cursor-pointer shadow-md transition animate-pulse active:scale-95 border-b border-[#1D3557]/20"
                                  title="Confirmar cambios de estado en la base de datos"
                                >
                                  <Check className="w-3 h-3 stroke-[3]" />
                                  <span>Confirmar</span>
                                </button>
                              )}
                              <button
                                onClick={() => setSelectedOrder(order)}
                                className="px-2.5 py-1 bg-[#1D3557] hover:bg-[#152742] text-white rounded-xl transition cursor-pointer text-[10px] font-montserrat font-bold uppercase tracking-wider shadow-xs flex items-center gap-1 active:scale-95"
                                title="Ver Detalle"
                              >
                                <Eye className="w-3.5 h-3.5 stroke-[2.5] text-[#00BFFF]" />
                                <span>Detalle</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

        </div>
      )}

        </div> {/* End Right Content Pane */}
      </div> {/* End Left Sidebar flex-row container */}

      {/* ====================================
          MODAL DIALOGS FOR CRUD MANAGEMENT
          ==================================== */}

      {/* 1. PRODUCT CREATE/EDIT MODAL */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden text-left">
            <div className="bg-[#131921] text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-5 h-5 text-[#FF9900]" />
                {editingProduct ? 'Editar Producto del Catálogo' : 'Añadir Nuevo Producto'}
              </h3>
              <button onClick={() => setShowProductModal(false)} className="text-gray-400 hover:text-white transition cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* SKU */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1">Código SKU</label>
                  <input
                    type="text"
                    value={prodSku}
                    onChange={(e) => setProdSku(e.target.value)}
                    required
                    className="w-full bg-gray-50 border border-gray-300 rounded px-3 py-1.5 text-xs font-mono font-bold focus:ring-1 focus:ring-[#FF9900] focus:outline-none"
                  />
                </div>

                {/* Name */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1">Nombre Completo del Producto</label>
                  <input
                    type="text"
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    required
                    className="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#FF9900] focus:outline-none font-semibold"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1">Descripción y Detalles del Producto</label>
                <textarea
                  value={prodDescription}
                  onChange={(e) => setProdDescription(e.target.value)}
                  required
                  rows={3}
                  placeholder="Especificaciones, funcionalidades, para qué sirve, etc."
                  className="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#FF9900] focus:outline-none font-medium leading-relaxed"
                />
              </div>

              {/* Cost, Profit & Sale Price Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1">
                    Precio Costo ($ USD) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={prodCostPrice}
                    onChange={(e) => handleCostChange(e.target.value)}
                    required
                    placeholder="0.00"
                    className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-[#FF9900] focus:outline-none font-bold text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1">
                    % Ganancia *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={prodMargin1}
                      onChange={(e) => handleMarginChange(e.target.value)}
                      placeholder="30.00"
                      className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-[#FF9900] focus:outline-none font-black text-[#131921] pr-7"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xs pointer-events-none">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1">
                    Precio Final Ventas *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={prodPrice}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    required
                    placeholder="0.00"
                    className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-[#FF9900] focus:outline-none font-black text-gray-900"
                  />
                  <p className="text-[9px] text-emerald-700 font-bold mt-1">
                    💡 Ganancia neta: ${(
                      Math.max(0, (typeof prodPrice === 'number' ? prodPrice : parseFloat(String(prodPrice).replace(',', '.')) || 0) - (parseFloat(String(prodCostPrice).replace(',', '.')) || 0))
                    ).toFixed(2)} USD
                  </p>
                </div>
              </div>

              {/* Offer, Stock & Units Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1">
                    Precio Oferta
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={prodOfferPrice}
                    onChange={(e) => setProdOfferPrice(e.target.value)}
                    placeholder="Ninguno"
                    className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-[#FF9900] focus:outline-none font-bold text-red-600"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1">
                    Stock Actual *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={prodStock}
                    onChange={(e) => setProdStock(Number(e.target.value))}
                    required
                    className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-[#FF9900] focus:outline-none font-bold text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1">
                    Unidades *
                  </label>
                  <select
                    value={prodUnit}
                    onChange={(e) => setProdUnit(e.target.value)}
                    required
                    className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-[#FF9900] focus:outline-none font-bold text-gray-900 cursor-pointer"
                  >
                    {[
                      'Unidad',
                      'Pieza',
                      'Paquete',
                      'Caja',
                      'Docena',
                      'Kilogramo',
                      'Gramo',
                      'Litro',
                      'Mililitro',
                      'Metro',
                      'Centímetro',
                      'Rollo',
                      'Set / Juego',
                      'Bulto',
                      'Resma'
                    ].map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                    {prodUnit && ![
                      'Unidad',
                      'Pieza',
                      'Paquete',
                      'Caja',
                      'Docena',
                      'Kilogramo',
                      'Gramo',
                      'Litro',
                      'Mililitro',
                      'Metro',
                      'Centímetro',
                      'Rollo',
                      'Set / Juego',
                      'Bulto',
                      'Resma'
                    ].includes(prodUnit) && (
                      <option value={prodUnit}>{prodUnit}</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Category ID */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1">Categoría del Catálogo</label>
                  <select
                    value={prodCategoryId}
                    onChange={(e) => setProdCategoryId(e.target.value)}
                    required
                    className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-[#FF9900] focus:outline-none font-semibold cursor-pointer"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Brand ID */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1">Marca o Fabricante</label>
                  <select
                    value={prodBrandId}
                    onChange={(e) => setProdBrandId(e.target.value)}
                    required
                    className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-[#FF9900] focus:outline-none font-semibold cursor-pointer"
                  >
                    {brands.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Stock Crítico & Ubicación */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1">
                    Stock Crítico *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={prodCriticalStock}
                    onChange={(e) => setProdCriticalStock(e.target.value)}
                    required
                    placeholder="5"
                    className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-xs font-bold text-red-600 focus:ring-1 focus:ring-[#FF9900] focus:outline-none"
                  />
                  <p className="text-[9px] text-gray-400 font-medium mt-1">Umbral mínimo de alerta para reabastecimiento</p>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1">
                    Ubicación *
                  </label>
                  <select
                    value={prodLocation}
                    onChange={(e) => setProdLocation(e.target.value)}
                    required
                    className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-xs font-bold text-gray-900 focus:ring-1 focus:ring-[#FF9900] focus:outline-none cursor-pointer"
                  >
                    {businessBranchesList.map(branch => {
                      const displayLabel = branch.code ? `${branch.name} (${branch.code})` : branch.name;
                      return (
                        <option key={branch.id} value={displayLabel}>
                          {displayLabel}
                        </option>
                      );
                    })}

                    {/* Preserve custom or legacy selected location ONLY if valid and not forbidden */}
                    {prodLocation && 
                      !['caja principal', 'caja copias', 'sede principal - almacen', 'sede principal - almacén'].some(f => prodLocation.toLowerCase().includes(f)) &&
                      !businessBranchesList.some(b => (b.code ? `${b.name} (${b.code})` : b.name) === prodLocation || b.name === prodLocation) && (
                      <option value={prodLocation}>{prodLocation}</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Impuesto Trasladado a Factura & Fecha Expiración */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1">
                    Impuesto *
                  </label>
                  <select
                    value={prodTaxId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setProdTaxId(selectedId);
                      if (selectedId === 'exento' || selectedId === '0') {
                        setProdTaxRate(0);
                      } else {
                        const found = adminTaxes.find(t => t.id === selectedId);
                        setProdTaxRate(found ? found.rate : 0);
                      }
                    }}
                    className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-xs font-bold text-gray-900 focus:ring-1 focus:ring-[#FF9900] focus:outline-none cursor-pointer"
                  >
                    <option value="exento">Exento / Sin Impuesto (0%)</option>
                    {adminTaxes.filter(t => t.is_active !== false).map((tax) => (
                      <option key={tax.id} value={tax.id}>
                        {tax.name} ({tax.rate}%)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1">
                    Fecha Expiración (Opcional)
                  </label>
                  <input
                    type="date"
                    value={prodExpirationDate}
                    onChange={(e) => setProdExpirationDate(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-xs font-bold text-gray-900 focus:ring-1 focus:ring-[#FF9900] focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Image URL(s) */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1">
                  Enlace(s) de Imágenes (Múltiples separados por comas)
                </label>
                <input
                  type="text"
                  value={prodImageUrl}
                  onChange={(e) => setProdImageUrl(e.target.value)}
                  placeholder="https://example.com/img1.jpg, https://example.com/img2.jpg"
                  className="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#FF9900] focus:outline-none"
                />
                <p className="text-[10px] text-gray-400 mt-1">Sugerencia: puedes usar enlaces directos de Unsplash o cualquier servidor de imágenes.</p>
              </div>

              {/* Technical Sheet PDF link & Barcode/QR code */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1">Enlace de Ficha Técnica PDF Oficial (Opcional)</label>
                  <input
                    type="url"
                    value={prodTechUrl}
                    onChange={(e) => setProdTechUrl(e.target.value)}
                    placeholder="https://example.com/technical-specs.pdf"
                    className="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#FF9900] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Barcode className="w-3.5 h-3.5 text-gray-500" />
                      Código de Barras / QR (Opcional)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowProductFormScanner(true)}
                      className="text-[#FF9900] hover:text-[#e08800] text-[9px] font-black uppercase flex items-center gap-0.5 cursor-pointer bg-[#FF9900]/10 px-1.5 py-0.5 rounded-md"
                    >
                      📷 Escanear
                    </button>
                  </label>
                  <input
                    type="text"
                    value={prodBarcodeQr}
                    onChange={(e) => setProdBarcodeQr(e.target.value)}
                    placeholder="Ej: 7591234567890 o enlace QR"
                    className="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#FF9900] focus:outline-none font-mono"
                  />
                  {showProductFormScanner && (
                    <Suspense fallback={<AdminSubmoduleLoader name="Lector de Códigos" />}>
                      <BarcodeScannerModal
                        onClose={() => setShowProductFormScanner(false)}
                        products={products}
                        onCodeScanned={(code) => {
                          setProdBarcodeQr(code);
                          setShowProductFormScanner(false);
                        }}
                      />
                    </Suspense>
                  )}
                </div>
              </div>

              {/* Featured & Active checkboxes */}
              <div className="flex flex-col gap-3 p-3 bg-gray-50/50 border border-gray-900 rounded-lg">
                <div className="flex gap-6 items-center">
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prodFeatured}
                      onChange={(e) => setProdFeatured(e.target.checked)}
                      className="w-4 h-4 rounded text-[#FF9900] focus:ring-[#FF9900] accent-[#FF9900]"
                    />
                    <span>Destacar en Inicio (Oferta Principal)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prodActive}
                      onChange={(e) => setProdActive(e.target.checked)}
                      className="w-4 h-4 rounded text-[#FF9900] focus:ring-[#FF9900] accent-[#FF9900]"
                    />
                    <span>Activo y Visible en Catálogo Público</span>
                  </label>
                </div>
                
                {prodFeatured && (
                  <div className="flex gap-4 items-center border-t border-gray-200 pt-3 mt-1">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-[#FF9900] fill-[#FF9900]" />
                        Calificación Manual (Estrellas 1-5)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="5"
                        step="0.5"
                        value={prodRatingStars}
                        onChange={(e) => setProdRatingStars(Number(e.target.value))}
                        className="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#FF9900]"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Número de Usuarios (Reviews)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={prodRatingCount}
                        onChange={(e) => setProdRatingCount(Number(e.target.value))}
                        className="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#FF9900]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Save button */}
              <div className="pt-4 border-t border-gray-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded text-xs font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#FF9900] hover:bg-[#e68a00] text-[#131921] font-black rounded text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                  id="btn-save-product-modal"
                >
                  <Check className="w-4 h-4" />
                  {editingProduct ? 'Guardar Modificaciones' : 'Guardar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1.1 PRODUCT MOVEMENT MODAL */}
      {movementModalProd && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden text-left border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#131921] text-white p-4 flex justify-between items-center">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-[#FF9900]" />
                  <span>Movimiento de Inventario</span>
                </h3>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Ajustar stock de <span className="text-white font-bold">{movementModalProd.name}</span> (SKU: {movementModalProd.sku})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMovementModalProd(null)}
                className="text-gray-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProductMovement} className="p-5 space-y-4 text-xs text-gray-700">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-extrabold text-gray-400 uppercase block">Stock Actual</span>
                  <span className="text-lg font-black text-gray-900">{movementModalProd.stock} unidades</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-extrabold text-gray-400 uppercase block">Precio Venta</span>
                  <span className="text-sm font-black text-emerald-600">
                    ${(movementModalProd.offer_price || movementModalProd.price).toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1">
                  Tipo de Movimiento *
                </label>
                <select
                  value={movementType}
                  onChange={(e) => setMovementType(e.target.value as any)}
                  className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-xs font-bold text-gray-900 focus:ring-1 focus:ring-[#FF9900] focus:outline-none cursor-pointer"
                >
                  <option value="ingreso">Entrada / Carga (+) (Aumenta Stock)</option>
                  <option value="egreso">Salida / Descarga (-) (Disminuye Stock)</option>
                  <option value="ajuste">Ajuste Directo (Establece Stock Exacto)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1">
                  {movementType === 'ajuste' ? 'Nuevo Stock Total *' : 'Cantidad a Ajustar *'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={movementQty}
                  onChange={(e) => setMovementQty(e.target.value)}
                  required
                  className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-xs font-bold text-gray-900 focus:ring-1 focus:ring-[#FF9900] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1">
                  Concepto / Motivo
                </label>
                <input
                  type="text"
                  value={movementConcept}
                  onChange={(e) => setMovementConcept(e.target.value)}
                  placeholder="Ej: Recepción de mercancía, Merma, Conteo físico..."
                  className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-xs font-semibold text-gray-900 focus:ring-1 focus:ring-[#FF9900] focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-gray-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMovementModalProd(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded text-xs font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#FF9900] hover:bg-[#e68a00] text-[#131921] font-black rounded text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Check className="w-4 h-4" />
                  <span>Registrar Movimiento</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. CATEGORY CREATE/EDIT MODAL */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full text-left">
            <div className="bg-[#131921] text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-5 h-5 text-[#FF9900]" />
                {editingCategory ? 'Editar Categoría' : 'Añadir Nueva Categoría'}
              </h3>
              <button onClick={() => setShowCategoryModal(false)} className="text-gray-400 hover:text-white transition cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
              {/* Category Name */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1">Nombre de la Categoría</label>
                <input
                  type="text"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  required
                  placeholder="ej. Papelería, Consumibles"
                  className="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#FF9900] focus:outline-none font-bold"
                />
              </div>

              {/* Category Slug */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1">Slug Único (Opcional)</label>
                <input
                  type="text"
                  value={catSlug}
                  onChange={(e) => setCatSlug(e.target.value)}
                  placeholder="ej. papeleria-oficina"
                  className="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs font-mono focus:ring-1 focus:ring-[#FF9900] focus:outline-none"
                />
              </div>

              {/* Category Image */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1">Enlace de Imagen Representativa</label>
                <input
                  type="text"
                  value={catImageUrl}
                  onChange={(e) => setCatImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#FF9900] focus:outline-none"
                />
              </div>

              {/* Active Toggle */}
              <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer mt-4">
                <input
                  type="checkbox"
                  checked={catActive}
                  onChange={(e) => setCatActive(e.target.checked)}
                  className="w-4 h-4 rounded text-[#FF9900] focus:ring-[#FF9900] accent-[#FF9900]"
                />
                <span>Activo y Visible en Catálogo Público</span>
              </label>

              {/* Footer */}
              <div className="pt-4 border-t border-gray-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded text-xs font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#FF9900] hover:bg-[#e68a00] text-[#131921] font-black rounded text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                  id="btn-save-category-modal"
                >
                  <Check className="w-4 h-4" />
                  {editingCategory ? 'Guardar Modificaciones' : 'Guardar Categoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. BRAND CREATE/EDIT MODAL */}
      {showBrandModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full text-left">
            <div className="bg-[#131921] text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-5 h-5 text-[#FF9900]" />
                {editingBrand ? 'Editar Marca' : 'Añadir Nueva Marca'}
              </h3>
              <button onClick={() => setShowBrandModal(false)} className="text-gray-400 hover:text-white transition cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBrand} className="p-6 space-y-4">
              {/* Brand Name */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1">Nombre de la Marca</label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  required
                  placeholder="ej. Zeppelin, Faber-Castell"
                  className="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#FF9900] focus:outline-none font-bold"
                />
              </div>

              {/* Brand Logo URL */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1">Enlace del Logotipo</label>
                <input
                  type="text"
                  value={brandLogoUrl}
                  onChange={(e) => setBrandLogoUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#FF9900] focus:outline-none"
                />
              </div>

              {/* Active Toggle */}
              <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer mt-4">
                <input
                  type="checkbox"
                  checked={brandActive}
                  onChange={(e) => setBrandActive(e.target.checked)}
                  className="w-4 h-4 rounded text-[#FF9900] focus:ring-[#FF9900] accent-[#FF9900]"
                />
                <span>Activo y Visible en Catálogo Público</span>
              </label>

              {/* Footer */}
              <div className="pt-4 border-t border-gray-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBrandModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded text-xs font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#FF9900] hover:bg-[#e68a00] text-[#131921] font-black rounded text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                  id="btn-save-brand-modal"
                >
                  <Check className="w-4 h-4" />
                  {editingBrand ? 'Guardar Modificaciones' : 'Guardar Marca'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. ORDER DETAILS MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden text-left border border-gray-200">
            {/* Header */}
            <div className="bg-[#1D3557] text-white p-4 flex justify-between items-center">
              <div>
                <h3 className="font-montserrat font-extrabold text-sm uppercase tracking-wider flex items-center gap-2 text-white">
                  <ClipboardList className="w-5 h-5 text-[#40E0D0]" />
                  <span>Detalle de Pedido #{String(selectedOrder.order_number || '').padStart(7, '0')}</span>
                </h3>
                <p className="text-[10px] text-gray-200 mt-0.5 font-mono">
                  ID: {selectedOrder.id || 'N/A'} • Recibido: {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString() : 'N/A'}
                </p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-300 hover:text-white transition cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content (Scrollable Grid) */}
            <div className="p-5 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-12 gap-5 leading-normal text-xs text-[#2B2D42]">
              
              {/* Left Column: Customer and Payment details (col-span-5) */}
              <div className="md:col-span-5 space-y-4">
                
                {/* Section: Customer Info */}
                <div className="bg-[#F8F9FA] border border-gray-200 rounded-2xl p-4 space-y-2.5">
                  <h4 className="font-montserrat font-extrabold text-[#1D3557] uppercase tracking-wider text-[10px] border-b border-gray-200 pb-1.5 flex items-center gap-1.5">
                    Cliente / Contacto
                  </h4>
                  
                  <div className="space-y-1">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wide text-[9px]">Nombre completo</p>
                    <p className="font-montserrat font-black text-[#1D3557] text-sm">{selectedOrder.customer_name}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wide text-[9px]">Teléfono de contacto</p>
                    <p className="font-bold text-[#2B2D42] font-mono text-xs">{selectedOrder.phone_number}</p>
                  </div>

                  {/* WhatsApp contact template selector */}
                  <div className="pt-2 border-t border-gray-200 mt-2 space-y-2">
                    <label className="block text-[9px] font-montserrat font-extrabold text-[#1D3557] uppercase tracking-wider">
                      Plantilla de Mensaje (WhatsApp)
                    </label>
                    <select
                      value={waTemplate}
                      onChange={(e) => setWaTemplate(e.target.value as any)}
                      className="w-full text-xs font-bold bg-white border border-gray-300 rounded-xl p-2 text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF] cursor-pointer"
                    >
                      <option value="default">1. Predeterminado (Datos + Capture)</option>
                      <option value="availability">2. Disponibilidad de Producto</option>
                      <option value="validation">3. Validación de Pago Exitoso</option>
                      <option value="issue">4. Reportar Inconveniente</option>
                    </select>

                    {/* Simple Message Preview */}
                    <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl text-[10px] text-gray-700 max-h-24 overflow-y-auto whitespace-pre-line font-medium leading-relaxed">
                      <span className="font-bold text-emerald-800 text-[9px] block mb-1 uppercase tracking-wide">Vista previa del mensaje:</span>
                      {getWhatsAppMessageText(selectedOrder, waTemplate)}
                    </div>

                    <a
                      href={`https://wa.me/${selectedOrder.phone_number.replace(/\D/g, '')}?text=${encodeURIComponent(
                        getWhatsAppMessageText(selectedOrder, waTemplate)
                      )}`}
                      target="_blank"
                      referrerPolicy="no-referrer"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 w-full py-2.5 bg-[#25D366] hover:bg-[#128C7E] text-white font-montserrat font-black rounded-xl text-xs transition shadow-md hover:shadow-lg cursor-pointer text-center uppercase tracking-wider active:scale-98"
                    >
                      <span>💬 Contactar por WhatsApp</span>
                    </a>
                  </div>
                </div>

                {/* Section: Delivery info */}
                <div className="bg-[#F8F9FA] border border-gray-200 rounded-2xl p-4 space-y-2.5">
                  <h4 className="font-montserrat font-extrabold text-[#1D3557] uppercase tracking-wider text-[10px] border-b border-gray-200 pb-1.5 flex items-center gap-1.5">
                    Método de Entrega
                  </h4>

                  <div className="space-y-1">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wide text-[9px]">Tipo de entrega</p>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-montserrat font-extrabold ${
                      selectedOrder.delivery_method === 'retiro' 
                        ? 'bg-amber-100 text-amber-800' 
                        : 'bg-[#1D3557]/10 text-[#1D3557]'
                    }`}>
                      {selectedOrder.delivery_method === 'retiro' ? <Store className="w-3.5 h-3.5" /> : <Truck className="w-3.5 h-3.5" />}
                      {selectedOrder.delivery_method === 'retiro' ? 'Retiro en Tienda' : 'Envío a Domicilio'}
                    </span>
                  </div>

                  {selectedOrder.delivery_method !== 'retiro' && (
                    <div className="space-y-1">
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wide text-[9px]">Dirección de Envío</p>
                      <p className="font-bold text-[#2B2D42] text-xs bg-white border border-gray-150 p-2 rounded-xl leading-relaxed">
                        {selectedOrder.address_text || 'No proporcionada'}
                      </p>
                    </div>
                  )}

                  {selectedOrder.comments && (
                    <div className="space-y-1">
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wide text-[9px]">Comentarios / Observaciones</p>
                      <p className="text-xs text-gray-700 bg-amber-50 border border-amber-100 p-2 rounded-xl leading-relaxed italic">
                        "{selectedOrder.comments}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Section: Payment Info */}
                <div className="bg-[#F8F9FA] border border-gray-200 rounded-2xl p-4 space-y-2.5">
                  <h4 className="font-montserrat font-extrabold text-[#1D3557] uppercase tracking-wider text-[10px] border-b border-gray-200 pb-1.5 flex items-center gap-1.5">
                    Información de Pago
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wide text-[9px]">Método</p>
                      <p className="font-montserrat font-extrabold text-[#1D3557] capitalize text-xs">
                        {selectedOrder.payment_method || 'N/A'}
                      </p>
                    </div>

                    {selectedOrder.payment_amount_with && (
                      <div className="space-y-1">
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wide text-[9px]">Paga con</p>
                        <p className="font-montserrat font-black text-[#1D3557] text-xs">
                          ${selectedOrder.payment_amount_with.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>

                  {selectedOrder.points && (
                    <div className="bg-sky-50 border border-sky-100 p-2 rounded-xl text-sky-900 text-[11px] font-bold flex items-center gap-1.5">
                      <Star className="w-4 h-4 text-[#FF9900] fill-[#FF9900]" />
                      <span>Generó {selectedOrder.points} puntos de fidelidad.</span>
                    </div>
                  )}
                </div>

              </div>

              {/* Right Column: Ordered Items Table (col-span-7) */}
              <div className="md:col-span-7 border border-gray-200 rounded-2xl overflow-hidden flex flex-col h-full bg-white">
                <div className="bg-[#1D3557] text-white py-2.5 px-3.5 font-montserrat font-extrabold uppercase tracking-wide text-[10px]">
                  Artículos del Pedido
                </div>
                
                <div className="flex-1 overflow-y-auto divide-y divide-gray-100 max-h-[300px]">
                  {selectedOrder.items && selectedOrder.items.length > 0 ? (
                    selectedOrder.items.map((item, index) => (
                      <div key={index} className="p-3 flex justify-between items-center hover:bg-[#F8F9FA] transition gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-[#2B2D42] text-xs truncate" title={item.name}>{item.name}</p>
                          <p className="text-[10px] text-gray-400 font-mono font-bold mt-0.5">SKU: {item.sku}</p>
                        </div>
                        <div className="text-right flex-shrink-0 font-bold text-xs">
                          <span className="text-gray-400 font-semibold">{item.quantity} x </span>
                          <span className="text-[#2B2D42] font-bold">${item.price.toFixed(2)}</span>
                          <p className="text-[#00BFFF] font-black text-xs mt-0.5">
                            ${(item.quantity * item.price).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-gray-400">
                      No hay artículos detallados en este registro.
                    </div>
                  )}
                </div>

                {/* Subtotal & Total summaries */}
                <div className="bg-[#F8F9FA] p-4 border-t border-gray-200 space-y-2">
                  <div className="flex justify-between font-semibold text-gray-500 text-xs">
                    <span>Subtotal</span>
                    <span>${Number(selectedOrder.total_price || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-gray-500 text-xs">
                    <span>Cargos de Envío</span>
                    <span>$0.00</span>
                  </div>
                  <div className="flex justify-between font-montserrat font-black text-[#1D3557] text-sm border-t border-gray-200 pt-2">
                    <span>TOTAL GENERAL</span>
                    <span className="text-[#1D3557] font-montserrat font-black text-base">${Number(selectedOrder.total_price || 0).toFixed(2)} USD</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Quick States Updates in Footer */}
            <div className="p-4 bg-[#F8F9FA] border-t border-gray-200 flex flex-wrap items-center justify-between gap-4 text-xs">
              
              {/* Quick Status Selects inside modal */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="font-montserrat font-extrabold text-[#1D3557]">Estado de Entrega:</span>
                  <select
                    value={(pendingChanges[selectedOrder.id]?.status ?? (selectedOrder.status || 'recibido')).toLowerCase()}
                    onChange={(e) => handlePendingChange(selectedOrder.id, 'status', e.target.value)}
                    className={`font-black rounded-xl px-2.5 py-1 text-xs focus:ring-2 focus:ring-[#00BFFF] border cursor-pointer ${
                      (pendingChanges[selectedOrder.id]?.status ?? (selectedOrder.status || 'recibido')).toLowerCase() === 'recibido' ? 'bg-gray-100 text-gray-700 border-gray-300' :
                      (pendingChanges[selectedOrder.id]?.status ?? (selectedOrder.status || 'recibido')).toLowerCase() === 'preparando' ? 'bg-amber-50 text-amber-700 border-amber-300' :
                      (pendingChanges[selectedOrder.id]?.status ?? (selectedOrder.status || 'recibido')).toLowerCase() === 'listo para retirar' ? 'bg-sky-50 text-sky-700 border-sky-300' :
                      (pendingChanges[selectedOrder.id]?.status ?? (selectedOrder.status || 'recibido')).toLowerCase() === 'en camino' ? 'bg-[#1D3557]/10 text-[#1D3557] border-[#1D3557]/30' :
                      (pendingChanges[selectedOrder.id]?.status ?? (selectedOrder.status || 'recibido')).toLowerCase() === 'entregado' ? 'bg-[#40E0D0]/15 text-[#1D3557] border-[#40E0D0]/40' :
                      'bg-rose-50 text-rose-700 border-rose-300'
                    } ${(pendingChanges[selectedOrder.id]?.status) ? 'ring-2 ring-[#40E0D0]' : ''}`}
                  >
                    <option value="recibido">Recibido</option>
                    <option value="preparando">Preparando</option>
                    <option value="listo para retirar">Listo para Retirar</option>
                    <option value="en camino">En Camino</option>
                    <option value="entregado">Entregado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-montserrat font-extrabold text-[#1D3557]">Estado del Pago:</span>
                  <select
                    value={(pendingChanges[selectedOrder.id]?.payment_status ?? (selectedOrder.payment_status || 'pendiente')).toLowerCase()}
                    onChange={(e) => handlePendingChange(selectedOrder.id, 'payment_status', e.target.value)}
                    className={`font-black rounded-xl px-2.5 py-1 text-xs focus:ring-2 focus:ring-[#00BFFF] border cursor-pointer ${
                      (pendingChanges[selectedOrder.id]?.payment_status ?? (selectedOrder.payment_status || 'pendiente')).toLowerCase() === 'pendiente' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                      (pendingChanges[selectedOrder.id]?.payment_status ?? (selectedOrder.payment_status || 'pendiente')).toLowerCase() === 'pagado' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                      'bg-red-100 text-red-800 border-red-300'
                    } ${(pendingChanges[selectedOrder.id]?.payment_status) ? 'ring-2 ring-[#40E0D0]' : ''}`}
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="pagado">Pagado</option>
                    <option value="reembolsado">Reembolsado</option>
                  </select>
                </div>

                {pendingChanges[selectedOrder.id] && (
                  <button
                    type="button"
                    onClick={() => handleConfirmOrderChanges(selectedOrder.id)}
                    className="px-4 py-2 bg-[#40E0D0] hover:bg-[#36cebe] text-[#1D3557] font-montserrat font-black rounded-xl text-xs cursor-pointer shadow-md hover:shadow-lg flex items-center gap-1.5 transition uppercase tracking-wider active:scale-98 border-b border-[#1D3557]/20"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Confirmar Cambios</span>
                  </button>
                )}
              </div>

              {/* Close Button */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-5 py-2 bg-[#1D3557] hover:bg-[#152742] text-white font-montserrat font-extrabold rounded-xl text-xs cursor-pointer shadow-md hover:shadow-lg uppercase tracking-wider active:scale-98 transition"
                >
                  Cerrar Detalles
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* -------------------- MODAL: NUEVO / EDITAR USUARIO DEL SISTEMA -------------------- */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-gray-150 w-full max-w-md shadow-2xl overflow-hidden text-left flex flex-col animate-fadeIn">
            <div className="p-4 bg-[#1D3557] text-white border-b border-gray-100 flex justify-between items-center">
              <span className="text-xs font-montserrat font-extrabold uppercase tracking-wider flex items-center gap-2 text-white">
                <UserCheck className="w-4 h-4 text-[#40E0D0]" />
                <span>{editingUserId ? 'Editar Usuario del Sistema' : 'Nuevo Usuario del Sistema'}</span>
              </span>
              <button 
                type="button"
                onClick={() => setShowUserModal(false)}
                className="p-1.5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSaveStoreUser(); }} className="p-5 space-y-4 font-poppins">
              {userFormError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{userFormError}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">Nombre Completo del Usuario *</label>
                <input
                  type="text"
                  required
                  value={userFormName}
                  onChange={(e) => setUserFormName(e.target.value)}
                  placeholder="Ej: Pedro Pérez"
                  className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">Correo Electrónico (Usuario para Login) *</label>
                <input
                  type="email"
                  required
                  value={userFormEmail}
                  onChange={(e) => setUserFormEmail(e.target.value)}
                  placeholder="Ej: pedro@copiasbellavista.com"
                  className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">
                  Contraseña / Clave de Acceso {editingUserId ? '(Opcional para mantener)' : '*'}
                </label>
                <input
                  type="text"
                  required={!editingUserId}
                  value={userFormPassword}
                  onChange={(e) => setUserFormPassword(e.target.value)}
                  placeholder={editingUserId ? "Dejar en blanco para mantener la clave actual" : "Ej: ClaveSegura123"}
                  className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-mono font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                />
                <p className="text-[10px] text-gray-400 mt-1">El usuario usará su correo y esta contraseña para iniciar sesión.</p>
              </div>

              <div>
                <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">Rol de Acceso al Sistema *</label>
                <select
                  value={userFormRole}
                  onChange={(e) => {
                    const val = e.target.value;
                    setUserFormRole(val);
                    if (val !== 'Cliente') {
                      setUserFormClientCode('');
                    }
                  }}
                  className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                >
                  <option value="Admin">Admin (Control Total)</option>
                  <option value="Gerente">Gerente (Gestión General)</option>
                  <option value="Cajero">Cajero (Punto de Venta / Facturación)</option>
                  <option value="Despachador">Despachador (Procesar Pedidos)</option>
                  <option value="Repartidor">Repartidor (Entregas)</option>
                  <option value="Cliente">Cliente (Usuario Externo / Comprador)</option>
                </select>
              </div>

              {userFormRole === 'Cliente' && (
                <div>
                  <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">
                    Vincular con Cliente (por Código) *
                  </label>
                  <select
                    value={userFormClientCode}
                    required
                    onChange={(e) => {
                      const selectedCode = e.target.value;
                      setUserFormClientCode(selectedCode);
                      const matchedClient = dbClients.find(c => c.code === selectedCode);
                      if (matchedClient) {
                        if (!userFormName.trim() || userFormName === 'Pedro Pérez') {
                          setUserFormName(matchedClient.name);
                        }
                        if (!userFormEmail.trim() || userFormEmail === 'pedro@copiasbellavista.com') {
                          setUserFormEmail(matchedClient.email || '');
                        }
                      }
                    }}
                    className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                  >
                    <option value="">-- Seleccionar Cliente --</option>
                    {dbClients.map(c => (
                      <option key={c.id || c.code} value={c.code}>
                        {c.code} - {c.name} ({c.document || 'Sin documento'})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-[#00BFFF] mt-1 font-medium">
                    El usuario externo se vinculará a la cuenta de este cliente por su código.
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-3 border-t border-gray-100 font-montserrat font-extrabold">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#2B2D42] text-xs rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#40E0D0] hover:bg-[#36cebe] text-[#1D3557] text-xs uppercase rounded-xl transition cursor-pointer shadow-md flex items-center justify-center gap-1.5 border-b-2 border-[#1D3557]/20"
                >
                  <Save className="w-4 h-4 stroke-[3]" />
                  <span>Guardar Usuario</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------- MODAL: CREAR / EDITAR PANTALLA DE BANNER -------------------- */}
      {showSlideModal && editingSlide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-gray-150 w-full max-w-lg shadow-2xl overflow-hidden text-left flex flex-col animate-fadeIn">
            <div className="p-4 bg-[#1D3557] text-white border-b border-gray-100 flex justify-between items-center">
              <span className="text-xs font-montserrat font-extrabold uppercase tracking-wider flex items-center gap-2 text-white">
                <ImageIcon className="w-4 h-4 text-[#40E0D0]" />
                <span>{editingSlide.id ? 'Editar Pantalla del Banner' : 'Nueva Pantalla para el Banner'}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowSlideModal(false);
                  setEditingSlide(null);
                }}
                className="p-1.5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSlideForm} className="p-5 space-y-4 font-poppins">
              <div>
                <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">Título de la Pantalla *</label>
                <input
                  type="text"
                  required
                  value={editingSlide.title || ''}
                  onChange={(e) => setEditingSlide((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Ej: Ofertas Especiales en Papelería"
                  className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">Subtítulo / Descripción</label>
                <input
                  type="text"
                  value={editingSlide.subtitle || ''}
                  onChange={(e) => setEditingSlide((prev) => ({ ...prev, subtitle: e.target.value }))}
                  placeholder="Ej: Todo en fotocopias y útiles de oficina con 20% OFF"
                  className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-medium text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">Etiqueta / Badge</label>
                  <input
                    type="text"
                    value={editingSlide.badge || ''}
                    onChange={(e) => setEditingSlide((prev) => ({ ...prev, badge: e.target.value }))}
                    placeholder="Ej: ⚡ Servicio Rápido"
                    className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">Texto del Botón</label>
                  <input
                    type="text"
                    value={editingSlide.button_text || ''}
                    onChange={(e) => setEditingSlide((prev) => ({ ...prev, button_text: e.target.value }))}
                    placeholder="Ej: Ver Productos"
                    className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">URL Imagen del Banner *</label>
                <input
                  type="url"
                  required
                  value={editingSlide.image_url || ''}
                  onChange={(e) => setEditingSlide((prev) => ({ ...prev, image_url: e.target.value }))}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-medium text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-montserrat font-extrabold uppercase text-[#1D3557] mb-1">Categoría Destino</label>
                  <select
                    value={editingSlide.target_category || ''}
                    onChange={(e) => setEditingSlide((prev) => ({ ...prev, target_category: e.target.value }))}
                    className="w-full px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]"
                  >
                    <option value="">Ninguna / Todo el Catálogo</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="chk-target-offer"
                    checked={editingSlide.target_offer === true}
                    onChange={(e) => setEditingSlide((prev) => ({ ...prev, target_offer: e.target.checked }))}
                    className="w-4 h-4 text-[#00BFFF] rounded focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="chk-target-offer" className="text-xs font-bold text-[#2B2D42] cursor-pointer">
                    Filtro Ofertas Activo
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2 font-montserrat font-extrabold">
                <button
                  type="button"
                  onClick={() => {
                    setShowSlideModal(false);
                    setEditingSlide(null);
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-[#2B2D42] text-xs rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#40E0D0] hover:bg-[#36cebe] text-[#1D3557] text-xs font-black rounded-xl transition shadow-md cursor-pointer flex items-center gap-1.5 border-b-2 border-[#1D3557]/20"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Guardar Pantalla</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation Bar for Mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 py-2 px-2 flex justify-around items-center shadow-lg font-montserrat font-bold">
        <button
          onClick={() => {
            handleMenuChange('sales');
            setIsMobileDrawerOpen(false);
          }}
          className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full min-h-[38px] cursor-pointer transition ${
            currentMenu === 'sales' ? 'bg-[#1D3557] text-white font-extrabold shadow-xs' : 'text-[#2B2D42] hover:bg-[#F8F9FA]'
          }`}
        >
          <ShoppingBag className="w-4 h-4 shrink-0 text-[#00BFFF]" />
          <span className="text-[11px] tracking-tight">Venta Flash</span>
        </button>

        <button
          onClick={() => {
            handleMenuChange('caja');
            setIsMobileDrawerOpen(false);
          }}
          className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full min-h-[38px] cursor-pointer transition ${
            currentMenu === 'caja' ? 'bg-[#1D3557] text-white font-extrabold shadow-xs' : 'text-[#2B2D42] hover:bg-[#F8F9FA]'
          }`}
        >
          <Store className="w-4 h-4 shrink-0 text-[#00BFFF]" />
          <span className="text-[11px] tracking-tight">Caja</span>
        </button>

        <button
          onClick={() => {
            handleMenuChange('orders');
            setActiveTab('orders');
            fetchOrders();
            setIsMobileDrawerOpen(false);
          }}
          className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full min-h-[38px] cursor-pointer transition relative ${
            currentMenu === 'orders' ? 'bg-[#1D3557] text-white font-extrabold shadow-xs' : 'text-[#2B2D42] hover:bg-[#F8F9FA]'
          }`}
        >
          <ClipboardList className="w-4 h-4 shrink-0 text-[#00BFFF]" />
          {pendingOrdersCount > 0 && (
            <span className="bg-[#40E0D0] text-[#1D3557] font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center border border-white">
              {pendingOrdersCount}
            </span>
          )}
          <span className="text-[11px] tracking-tight">Pedidos</span>
        </button>

        <button
          onClick={() => {
            handleMenuChange('products');
            setActiveTab('products');
            setIsMobileDrawerOpen(false);
          }}
          className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full min-h-[38px] cursor-pointer transition ${
            currentMenu === 'products' ? 'bg-[#1D3557] text-white font-extrabold shadow-xs' : 'text-[#2B2D42] hover:bg-[#F8F9FA]'
          }`}
        >
          <Package className="w-4 h-4 shrink-0 text-[#00BFFF]" />
          <span className="text-[11px] tracking-tight">Productos</span>
        </button>

        <button
          onClick={() => setIsMobileDrawerOpen(true)}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full min-h-[38px] cursor-pointer text-[#2B2D42] hover:bg-[#F8F9FA] transition"
        >
          <Menu className="w-4 h-4 shrink-0 text-[#00BFFF]" />
          <span className="text-[11px] tracking-tight">Menú</span>
        </button>
      </div>

      {/* 📦 SECCIÓN DE IMPRESIÓN DEL INVENTARIO (OCULTO EN PANTALLA, ACTIVO EN IMPRESIÓN) */}
      {isPrintingInventory && (
        <div className="printable-area hidden print:block bg-white text-black p-6 font-sans text-xs">
          <div className="border-b-2 border-[#FF9900] pb-4 mb-5 text-left">
            <h1 className="text-xl font-bold text-gray-900">Copias Bella Vista - Inventario y Precios</h1>
            <div className="text-[11px] text-gray-500 mt-1">
              Fecha de Reporte: {new Date().toLocaleString('es-VE')} &nbsp;|&nbsp; 
              Total de Productos: {products.length} &nbsp;|&nbsp; 
              Moneda: Dólar Americano ($ / USD)
            </div>
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="p-2 border text-left font-bold">#</th>
                <th className="p-2 border text-left font-bold">SKU</th>
                <th className="p-2 border text-left font-bold">Nombre de Producto</th>
                <th className="p-2 border text-left font-bold">Marca</th>
                <th className="p-2 border text-left font-bold">Categoría</th>
                <th className="p-2 border text-right font-bold">Precio Standard</th>
                <th className="p-2 border text-right font-bold">Precio Oferta</th>
                <th className="p-2 border text-center font-bold">Existencia (Stock)</th>
                <th className="p-2 border text-center font-bold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, idx) => {
                const cat = categories.find(c => c.id === p.category_id)?.name || 'General';
                const brand = brands.find(b => b.id === p.brand_id)?.name || 'S/M';
                return (
                  <tr key={p.id} className="border-b border-gray-200">
                    <td className="p-2 border text-left">{idx + 1}</td>
                    <td className="p-2 border text-left font-mono font-bold">{p.sku}</td>
                    <td className="p-2 border text-left">{p.name}</td>
                    <td className="p-2 border text-left">{brand}</td>
                    <td className="p-2 border text-left">{cat}</td>
                    <td className="p-2 border text-right">${p.price.toFixed(2)}</td>
                    <td className="p-2 border text-right">{p.offer_price ? `$${p.offer_price.toFixed(2)}` : '-'}</td>
                    <td className={`p-2 border text-center font-bold ${p.stock === 0 ? 'text-red-600 bg-red-50' : ''}`}>{p.stock}</td>
                    <td className="p-2 border text-center">{p.active ? 'Activo' : 'Inactivo'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-8 text-center text-[10px] text-gray-400 border-t pt-2">
            © 2026 Copias Bella Vista. Barinitas, Venezuela. Reporte confidencial para uso interno.
          </div>
        </div>
      )}

      {/* 🧾 MODAL: HISTORIAL Y BÚSQUEDA DE PEDIDOS (Pedidos Facturados) */}
      {showPedidosFacturadosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl border border-gray-100 w-full max-w-5xl shadow-2xl overflow-hidden relative text-left my-8 flex flex-col max-h-[90vh]">
            {/* Header matching corporate identity */}
            <div className="bg-[#1D3557] p-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#40E0D0]/20 rounded-2xl">
                  <FileText className="w-6 h-6 text-[#40E0D0]" />
                </div>
                <div>
                  <h3 className="font-montserrat font-extrabold text-base tracking-tight text-white uppercase">
                    HISTORIAL Y BÚSQUEDA DE PEDIDOS
                  </h3>
                  <p className="text-xs text-gray-200 font-medium">
                    Consulta, filtra y busca pedidos registrados ({orders.length} registros en total)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchOrders()}
                  className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-montserrat font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingOrders ? 'animate-spin text-[#00BFFF]' : ''}`} />
                  <span>Actualizar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPedidosFacturadosModal(false)}
                  className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filter Toolbar matching corporate identity */}
            <div className="p-4 bg-[#F8F9FA] border-b border-gray-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shrink-0">
              {/* Search input */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-[#00BFFF] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por N° pedido, cliente o RIF/C.I..."
                  value={pedidosFacturadosSearch}
                  onChange={(e) => setPedidosFacturadosSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-2xl text-xs font-bold text-[#2B2D42] focus:outline-none focus:ring-2 focus:ring-[#00BFFF] shadow-2xs"
                />
              </div>

              {/* Tabs matching corporate identity */}
              <div className="flex items-center gap-1.5 bg-gray-200/60 p-1 rounded-2xl text-xs font-montserrat font-extrabold overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setPedidosFacturadosTab('todos')}
                  className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap uppercase tracking-wider ${
                    pedidosFacturadosTab === 'todos'
                      ? 'bg-[#1D3557] text-white shadow-xs'
                      : 'text-[#2B2D42] hover:text-[#1D3557]'
                  }`}
                >
                  Todos <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-md text-[10px]">{orders.length}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPedidosFacturadosTab('facturados')}
                  className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap uppercase tracking-wider ${
                    pedidosFacturadosTab === 'facturados'
                      ? 'bg-[#1D3557] text-white shadow-xs'
                      : 'text-[#2B2D42] hover:text-[#1D3557]'
                  }`}
                >
                  Facturados / Entregados <span className="ml-1 px-1.5 py-0.5 bg-[#40E0D0]/20 text-[#1D3557] rounded-md text-[10px]">{orders.filter(o => (o.status || '').toLowerCase() === 'entregado').length}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPedidosFacturadosTab('pendientes')}
                  className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap uppercase tracking-wider ${
                    pedidosFacturadosTab === 'pendientes'
                      ? 'bg-[#1D3557] text-white shadow-xs'
                      : 'text-[#2B2D42] hover:text-[#1D3557]'
                  }`}
                >
                  Pendientes <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[10px]">{pendingOrdersCount}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPedidosFacturadosTab('cancelados')}
                  className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap uppercase tracking-wider ${
                    pedidosFacturadosTab === 'cancelados'
                      ? 'bg-[#1D3557] text-white shadow-xs'
                      : 'text-[#2B2D42] hover:text-[#1D3557]'
                  }`}
                >
                  Cancelados <span className="ml-1 px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded-md text-[10px]">{orders.filter(o => (o.status || '').toLowerCase() === 'cancelado').length}</span>
                </button>
              </div>
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredPedidosFacturadosList.length === 0 ? (
                <div className="p-16 text-center text-gray-400">
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm font-bold text-gray-600">No se encontraron pedidos que coincidan con la búsqueda.</p>
                </div>
              ) : (
                <div className="overflow-x-auto bg-white border border-gray-100 rounded-2xl shadow-2xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#1D3557] text-white text-[10px] uppercase font-montserrat font-extrabold tracking-wider">
                        <th className="px-5 py-3.5">N° Pedido / Cliente</th>
                        <th className="px-5 py-3.5">Fecha</th>
                        <th className="px-5 py-3.5">Pago</th>
                        <th className="px-5 py-3.5">Entrega / Estado</th>
                        <th className="px-5 py-3.5">Total USD</th>
                        <th className="px-5 py-3.5 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs text-[#2B2D42] font-medium">
                      {filteredPedidosFacturadosList.map((order) => {
                        const orderNum = String(order.order_number || order.id || '').padStart(6, '0');
                        const isEntregado = (order.status || '').toLowerCase() === 'entregado';
                        const isCancelado = (order.status || '').toLowerCase() === 'cancelado';
                        const isPaid = (order.payment_status || '').toLowerCase() === 'pagado';
                        return (
                          <tr key={order.id} className="hover:bg-[#F8F9FA] transition">
                            <td className="px-5 py-3.5">
                              <div>
                                <span className="font-mono font-black text-[#1D3557]">#{orderNum}</span>
                                <p className="font-montserrat font-bold text-[#2B2D42]">{order.customer_name || 'Cliente'}</p>
                                <p className="text-[10px] text-gray-400">{order.phone_number || 'Sin teléfono'}</p>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-gray-500 font-bold whitespace-nowrap">
                              {order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-montserrat font-extrabold border ${
                                isPaid ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'
                              }`}>
                                {isPaid ? 'Pagado' : 'Pendiente Pago'}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-montserrat font-extrabold border ${
                                isEntregado ? 'bg-[#40E0D0]/15 border-[#40E0D0]/30 text-[#1D3557]' : isCancelado ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-amber-50 border-amber-200 text-amber-700'
                              }`}>
                                {isEntregado ? 'Facturado / Entregado' : isCancelado ? 'Cancelado' : (order.status || 'Recibido')}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 font-mono font-black text-[#1D3557] whitespace-nowrap">
                              ${Number(order.total_price || 0).toFixed(2)}
                            </td>
                            <td className="px-5 py-3.5 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-2">
                                {/* 👁️ VISTA DIGITAL / DETALLE (Image 2 trigger) */}
                                <button
                                  type="button"
                                  onClick={() => setSelectedPedidoDigitalView(order)}
                                  className="px-3.5 py-1.5 bg-[#1D3557] hover:bg-[#152742] text-white rounded-xl text-xs font-montserrat font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-2xs uppercase tracking-wider"
                                  title="Ver Vista Digital de Pedido"
                                >
                                  <FileText className="w-3.5 h-3.5 text-[#00BFFF]" />
                                  <span>Ver Detalle</span>
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
          </div>
        </div>
      )}

      {/* 📄 MODAL: VISTA DIGITAL DE PEDIDO (Image 2 style) */}
      {selectedPedidoDigitalView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl border border-gray-200 w-full max-w-lg shadow-2xl overflow-hidden relative text-left my-8 flex flex-col">
            {/* Header matching Image 2 */}
            <div className="bg-slate-900 p-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <FileText className="w-5 h-5 text-[#ffb700]" />
                </div>
                <h3 className="font-black text-sm tracking-wide text-white uppercase">
                  VISTA DIGITAL DE PEDIDO
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPedidoDigitalView(null)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Body matching Image 2 */}
            <div className="p-6 font-mono text-xs text-gray-800 space-y-4 max-h-[70vh] overflow-y-auto bg-gray-50/50">
              <div className="text-center space-y-1">
                <span className="inline-block px-3 py-1 bg-sky-100 text-sky-800 text-[10px] font-black uppercase rounded-full tracking-wider mb-2">
                  PEDIDO DE CLIENTE
                </span>
                <h4 className="font-black text-sm text-gray-900 tracking-wider">COPIAS BELLA VISTA, C.A.</h4>
                <p className="text-[10px] text-gray-500">
                  RIF: J-50987654-3<br/>
                  Sector bella vista, calle 20 entre carrera 3 y 4<br/>
                  Telf: +58 412-5043857
                </p>
              </div>

              <div className="border-t border-dashed border-gray-300 pt-3 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-gray-500 font-bold">CONTROL N°:</span>
                  <span className="font-black text-gray-900">#{String(selectedPedidoDigitalView.order_number || selectedPedidoDigitalView.id || '').padStart(6, '0')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-bold">FECHA EMISIÓN:</span>
                  <span className="font-bold text-gray-900">{selectedPedidoDigitalView.created_at ? new Date(selectedPedidoDigitalView.created_at).toLocaleString('es-VE') : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-bold">CLIENTE:</span>
                  <span className="font-bold text-gray-900">{selectedPedidoDigitalView.customer_name || 'Consumidor Final'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-bold">TELÉFONO:</span>
                  <span className="font-bold text-gray-900">{selectedPedidoDigitalView.phone_number || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-bold">MÉTODO PAGO:</span>
                  <span className="font-bold text-gray-900">{selectedPedidoDigitalView.payment_method || 'Efectivo / Transferencia'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-bold">ESTADO PAGO:</span>
                  <span className="font-bold uppercase text-emerald-600">{selectedPedidoDigitalView.payment_status || 'pendiente'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-bold">ESTADO ENTREGA:</span>
                  <span className="font-bold uppercase text-blue-600">{selectedPedidoDigitalView.status || 'recibido'}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-gray-300 pt-3">
                <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase pb-1 border-b border-gray-200">
                  <span>DETALLE</span>
                  <span>CANT</span>
                  <span>TOTAL</span>
                </div>
                <div className="py-2 space-y-2">
                  {selectedPedidoDigitalView.items && selectedPedidoDigitalView.items.length > 0 ? (
                    selectedPedidoDigitalView.items.map((item: any, idx: number) => {
                      const itemName = item.product_name || item.name || 'Artículo de pedido';
                      const itemQty = Number(item.quantity || item.qty || 1);
                      const itemPrice = Number(item.price || item.unit_price || 0);
                      const itemTotal = itemQty * itemPrice;
                      return (
                        <div key={idx} className="flex justify-between items-start gap-2 text-xs">
                          <span className="font-bold text-gray-800 flex-1">{itemName}</span>
                          <span className="font-bold text-gray-600 text-center w-12">x{itemQty}</span>
                          <span className="font-black text-gray-900 text-right w-20">${itemTotal.toFixed(2)}</span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-center text-gray-400 py-2 text-xs">Sin detalles de artículos registrados.</p>
                  )}
                </div>
              </div>

              <div className="border-t border-dashed border-gray-300 pt-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500 font-bold">SUBTOTAL:</span>
                  <span className="font-bold text-gray-900">${Number(selectedPedidoDigitalView.total_price || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-black pt-1 border-t border-gray-200 text-gray-900">
                  <span>TOTAL NETO:</span>
                  <span>${Number(selectedPedidoDigitalView.total_price || 0).toFixed(2)} USD</span>
                </div>
              </div>

              {/* Equivalentes para negocios en Venezuela - Estilo Ficha Digital (Imagen 2) */}
              <div className="bg-gray-50 rounded-xl p-2.5 mt-4 space-y-1 font-sans text-right shrink-0 border border-gray-100">
                <span className="text-[8px] text-gray-400 font-black uppercase block tracking-wider">PAGO EN DIVISAS / BS. BCV</span>
                <div className="text-xs font-black text-gray-800">
                  Bs. {(Number(selectedPedidoDigitalView.total_price || 0) * (selectedPedidoBcvRate || currencyRates?.VES || 36.5)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[9px] font-bold text-gray-500">
                  Tasa Oficial BCV: 1 USD = Bs. {(selectedPedidoBcvRate || currencyRates?.VES || 36.5).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div className="text-center text-[10px] text-gray-400 pt-2 space-y-1">
                <p>*** GRACIAS POR SU PREFERENCIA ***</p>
                <p>Este documento es una representación digital del pedido de cliente.</p>
              </div>
            </div>

            {/* Footer buttons matching Image 2 */}
            <div className="p-4 bg-white border-t border-gray-200 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => handlePrintOrderDigitalView(selectedPedidoDigitalView)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <Printer className="w-4 h-4 text-gray-700" />
                <span>Imprimir</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedPedidoDigitalView(null)}
                className="flex-1 py-3 bg-[#005da9] hover:bg-[#004b87] text-white rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <span>LISTO</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
