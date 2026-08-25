/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  User, Lock, ShieldCheck, Activity, Settings, Coins, Megaphone, 
  Save, Printer, Clock, Truck, FileText, Sliders, Bell, Volume2, 
  Trash2, Plus, Search, Image as ImageIcon, FileCheck, Check, AlertTriangle, 
  HelpCircle, Sparkles, Code, Copy, LayoutDashboard, Database,
  Building2, Monitor, Edit2, X, CheckCircle2, Power, MapPin, Phone, Globe, Mail,
  GripVertical, ChevronUp, ChevronDown, Layers, BarChart2, RefreshCw,
  CreditCard, Smartphone, Banknote, Landmark, QrCode, ToggleLeft, ToggleRight
} from 'lucide-react';
import { StoreUser, Tax, BannerSlide, LandingConfig, HomeCarouselCardItem, BusinessProfile, BusinessBranch, BusinessTerminal, ReportModuleConfig, PaymentMethodConfig } from '../types.ts';
import { dbService } from '../lib/supabase.ts';
import { playCashRegisterSound, playLowStockBeep } from '../lib/soundEffects.ts';
import { useI18n, LanguageCode, ThemeCode, setStoredLanguage, applyTheme, getStoredLanguage, getStoredTheme } from '../lib/i18n.ts';
import { CurrencyCode, CURRENCIES, DEFAULT_RATES, formatCurrency, saveCurrency } from '../lib/currency.ts';

interface SystemConfigPanelProps {
  currentUser: StoreUser | null;
  activeCurrency?: CurrencyCode;
  onCurrencyChange?: (currency: CurrencyCode) => void;
  currencyRates?: Record<CurrencyCode, number>;
  onUpdateCurrencyRate: (code: string, rate: number) => Promise<void>;
  bcvInputValue: string;
  setBcvInputValue: (val: string) => void;
  adminTaxes: Tax[];
  loadAdminTaxes: () => Promise<void>;
  configStoreName: string;
  setConfigStoreName: (val: string) => void;
  configRif: string;
  setConfigRif: (val: string) => void;
  configIva: number;
  setConfigIva: (val: number) => void;
  configPhone: string;
  setConfigPhone: (val: string) => void;
  initialSubTab?: 'mi_cuenta' | 'mi_negocio' | 'facturacion' | 'inventario' | 'impresion' | 'dashboard' | 'notificaciones' | 'planes_suscripcion';
}

export const SystemConfigPanel: React.FC<SystemConfigPanelProps> = ({
  currentUser,
  activeCurrency = 'USD',
  onCurrencyChange,
  currencyRates = DEFAULT_RATES,
  onUpdateCurrencyRate,
  bcvInputValue,
  setBcvInputValue,
  adminTaxes,
  loadAdminTaxes,
  configStoreName,
  setConfigStoreName,
  configRif,
  setConfigRif,
  configIva,
  setConfigIva,
  configPhone,
  setConfigPhone,
  initialSubTab
}) => {
  // ⚙️ SUB-TABS INTERNOS DE CONFIGURACIÓN
  const { t, lang, theme, setLang: setGlobalLang } = useI18n();
  const [configSubTab, setConfigSubTab] = useState<'mi_cuenta' | 'mi_negocio' | 'facturacion' | 'inventario' | 'impresion' | 'dashboard' | 'notificaciones' | 'planes_suscripcion'>(initialSubTab || 'mi_negocio');

  useEffect(() => {
    if (initialSubTab) {
      setConfigSubTab(initialSubTab);
    }
  }, [initialSubTab]);
  
  // 👤 1. MI CUENTA (Ajustes de Usuario)
  const [userPerfilNombre, setUserPerfilNombre] = useState<string>(currentUser?.name || '');
  const [userPerfilDoc, setUserPerfilDoc] = useState<string>(currentUser?.document || currentUser?.documento || '');
  const [userPerfilPhone, setUserPerfilPhone] = useState<string>(currentUser?.phone || currentUser?.telefono || '');
  const [userPerfilEmail, setUserPerfilEmail] = useState<string>(currentUser?.email || '');
  const [userPerfilPhoto, setUserPerfilPhoto] = useState<string>('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150');
  
  const [userPassword, setUserPassword] = useState<string>('');
  const [userNewPassword, setUserNewPassword] = useState<string>('');
  const [userConfirmPassword, setUserConfirmPassword] = useState<string>('');
  const [user2FA, setUser2FA] = useState<boolean>(false);
  const [userInterfaceLang, setUserInterfaceLang] = useState<LanguageCode>(getStoredLanguage);
  const [userInterfaceTheme, setUserInterfaceTheme] = useState<ThemeCode>(getStoredTheme);

  useEffect(() => {
    setUserInterfaceLang(lang);
    setUserInterfaceTheme(theme);
  }, [lang, theme]);
  const [activeSessions, setActiveSessions] = useState<any[]>([
    { id: '1', device: 'Chrome / Windows 11', ip: '190.142.34.8', active: true, date: 'Ahora mismo' },
    { id: '2', device: 'Safari / iPhone 13', ip: '186.24.112.50', active: false, date: 'Hace 3 horas' }
  ]);

  // 🏢 2. MI NEGOCIO (Parámetros Generales)
  const [businessLogo, setBusinessLogo] = useState<string>('');
  const [businessAddress, setBusinessAddress] = useState<string>(() => localStorage.getItem('business_address') || 'Sector bella vista, a una cuadra subiendo de la Cruz roja, calle 20 entre carrera 3 y 4');
  const [businessCity, setBusinessCity] = useState<string>(() => localStorage.getItem('business_city') || 'Barinitas');
  const [businessEmail, setBusinessEmail] = useState<string>(() => localStorage.getItem('business_email') || 'Fotocopiasfyp@gmail.com');
  const [businessBusinessType, setBusinessBusinessType] = useState<string>(() => localStorage.getItem('business_type') || 'Papelería y libros');
  const [businessWebsite, setBusinessWebsite] = useState<string>(() => localStorage.getItem('business_website') || 'https://copiasbellavista.vercel.app/');
  const [businessSlogan, setBusinessSlogan] = useState<string>('Equipando Tus Proyectos');
  const [businessSaaSPlan, setBusinessSaaSPlan] = useState<'gratuito' | 'basico' | 'pro' | 'enterprise'>('pro');
  const [businessBranches, setBusinessBranches] = useState<BusinessBranch[]>([
    { id: 'branch_main_barinitas', name: 'Tienda Bella Vista', code: 'SP-01', address: 'Carrera 6 entre calle 19 y 20, Barinitas, Edo. Barinas', phone: '+58 412-5043857', active: true },
    { id: 'branch_agua_dulce', name: 'Almacén Agua Dulce', code: 'SUC-02', address: 'Sector Agua Dulce, Barinitas, Edo. Barinas', phone: '+58 412-5043857', active: true },
    { id: 'branch_online', name: 'Tienda Online - Almacén', code: 'SUC-03', address: 'Barinitas, Edo. Barinas', phone: '+58 412-5043857', active: true }
  ]);
  const [businessCajas, setBusinessCajas] = useState<BusinessTerminal[]>([
    { id: 'term_main_01', name: 'Caja Principal (Mostrador)', code: 'C1', branch_id: 'branch_main_barinitas', active: true },
    { id: 'term_main_02', name: 'Caja Copias e Impresiones', code: 'C2', branch_id: 'branch_main_barinitas', active: true }
  ]);

  // Modal states for Branches & Terminals
  const [showBranchModal, setShowBranchModal] = useState<boolean>(false);
  const [editingBranch, setEditingBranch] = useState<Partial<BusinessBranch> | null>(null);
  const [showTerminalModal, setShowTerminalModal] = useState<boolean>(false);
  const [selectedBranchForTerminals, setSelectedBranchForTerminals] = useState<BusinessBranch | null>(null);
  const [editingTerminal, setEditingTerminal] = useState<Partial<BusinessTerminal> | null>(null);
  const [isSavingBusiness, setIsSavingBusiness] = useState<boolean>(false);

  // In-app Delete Confirmation Dialog states (avoids browser iframe confirm issues)
  const [branchToDelete, setBranchToDelete] = useState<BusinessBranch | null>(null);
  const [terminalToDelete, setTerminalToDelete] = useState<BusinessTerminal | null>(null);
  const [isDeletingBranch, setIsDeletingBranch] = useState<boolean>(false);
  const [isDeletingTerminal, setIsDeletingTerminal] = useState<boolean>(false);

  // 💳 3. FACTURACIÓN Y TRANSACCIONES
  const [facturacionMultiCurrency, setFacturacionMultiCurrency] = useState<boolean>(true);
  const [facturacionMainCurrency, setFacturacionMainCurrency] = useState<CurrencyCode>(activeCurrency || 'VES');
  const [facturacionExchangeAuto, setFacturacionExchangeAuto] = useState<boolean>(false);
  const [facturacionExenciones, setFacturacionExenciones] = useState<string>('Servicios Educativos, Fotocopias Escolares');
  const [facturacionRetencionesISLR, setFacturacionRetencionesISLR] = useState<number>(2);
  const [facturacionRetencionesIGTF, setFacturacionRetencionesIGTF] = useState<number>(3);
  const [facturacionCorrelativoFactura, setFacturacionCorrelativoFactura] = useState<number>(1024);
  const [facturacionCorrelativoCotizacion, setFacturacionCorrelativoCotizacion] = useState<number>(350);
  const [facturacionCorrelativoTicket, setFacturacionCorrelativoTicket] = useState<number>(5412);
  const [newTaxName, setNewTaxName] = useState<string>('');
  const [newTaxRate, setNewTaxRate] = useState<string>('');
  const [taxMessage, setTaxMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 💱 TASAS DE CAMBIO MANUALES Y MONEDA PRINCIPAL
  const [manualRates, setManualRates] = useState<Record<CurrencyCode, string>>({
    USD: '1.00',
    VES: currencyRates?.VES ? currencyRates.VES.toString() : (bcvInputValue || '45.50'),
    EUR: currencyRates?.EUR ? currencyRates.EUR.toString() : '0.92',
    COP: currencyRates?.COP ? currencyRates.COP.toString() : '4100'
  });

  const [rateSavingStatus, setRateSavingStatus] = useState<Record<string, { loading?: boolean, message?: { type: 'success' | 'error', text: string } }>>({});
  const [isFetchingLiveBCV, setIsFetchingLiveBCV] = useState<boolean>(false);
  const [mainCurrencySuccessMsg, setMainCurrencySuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      const sysConfig = localStorage.getItem('copias_bellavista_sys_config');
      if (sysConfig) {
        const parsed = JSON.parse(sysConfig);
        if (parsed.facturacionMainCurrency) {
          setFacturacionMainCurrency(parsed.facturacionMainCurrency);
        } else {
          setFacturacionMainCurrency('VES');
        }
      } else {
        setFacturacionMainCurrency('VES');
      }
    } catch (e) {
      setFacturacionMainCurrency('VES');
    }
  }, []);

  useEffect(() => {
    setManualRates(prev => ({
      ...prev,
      VES: currencyRates?.VES ? currencyRates.VES.toString() : (bcvInputValue || prev.VES),
      EUR: currencyRates?.EUR ? currencyRates.EUR.toString() : prev.EUR,
      COP: currencyRates?.COP ? currencyRates.COP.toString() : prev.COP,
    }));
  }, [currencyRates, bcvInputValue]);

  const handleSelectMainCurrency = (code: CurrencyCode) => {
    setFacturacionMainCurrency(code);
    if (onCurrencyChange) {
      onCurrencyChange(code);
    }
    window.dispatchEvent(new CustomEvent('bellavista_currency_changed', { detail: code }));

    setMainCurrencySuccessMsg(`¡Moneda principal cambiada a ${CURRENCIES[code]?.label || code}! Todos los precios del catálogo, vitrina, notas de entrega, facturación y pedidos operarán con esta divisa temporalmente.`);
    setTimeout(() => {
      setMainCurrencySuccessMsg(null);
    }, 4500);
  };

  const handleSaveManualRate = async (code: CurrencyCode) => {
    const rawVal = manualRates[code];
    const val = parseFloat(rawVal);
    if (isNaN(val) || val <= 0) {
      setRateSavingStatus(prev => ({
        ...prev,
        [code]: {
          loading: false,
          message: { type: 'error', text: 'Por favor ingrese un valor numérico válido mayor a 0.' }
        }
      }));
      return;
    }

    try {
      setRateSavingStatus(prev => ({
        ...prev,
        [code]: { loading: true, message: undefined }
      }));

      await onUpdateCurrencyRate(code, val);
      if (code === 'VES') {
        setBcvInputValue(val.toString());
      }

      setRateSavingStatus(prev => ({
        ...prev,
        [code]: {
          loading: false,
          message: {
            type: 'success',
            text: `Tasa ${code} guardada en el sistema: ${val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}.`
          }
        }
      }));

      setTimeout(() => {
        setRateSavingStatus(prev => ({
          ...prev,
          [code]: { loading: false, message: undefined }
        }));
      }, 4000);
    } catch (err: any) {
      console.error(`Error updating rate for ${code}:`, err);
      setRateSavingStatus(prev => ({
        ...prev,
        [code]: {
          loading: false,
          message: { type: 'error', text: 'No se pudo guardar la tasa. Verifique su conexión.' }
        }
      }));
    }
  };

  const handleFetchLiveBCVRate = async () => {
    setIsFetchingLiveBCV(true);
    try {
      const res = await fetch('https://ve.dolarapi.com/v1/dolares');
      if (!res.ok) throw new Error('Error al consultar DolarAPI');
      const data = await res.json();
      if (Array.isArray(data)) {
        const oficial = data.find((item: any) => item && item.fuente === 'oficial');
        if (oficial && typeof oficial.promedio === 'number') {
          const liveRate = oficial.promedio;
          setManualRates(prev => ({ ...prev, VES: liveRate.toString() }));
          setBcvInputValue(liveRate.toString());
          await onUpdateCurrencyRate('VES', liveRate);
          setRateSavingStatus(prev => ({
            ...prev,
            VES: {
              loading: false,
              message: {
                type: 'success',
                text: `Tasa oficial BCV obtenida en vivo (Bs. ${liveRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}) y guardada en el sistema.`
              }
            }
          }));
          setTimeout(() => {
            setRateSavingStatus(prev => ({
              ...prev,
              VES: { loading: false, message: undefined }
            }));
          }, 4500);
        } else {
          throw new Error('Formato de tasa no reconocido');
        }
      }
    } catch (err: any) {
      setRateSavingStatus(prev => ({
        ...prev,
        VES: {
          loading: false,
          message: {
            type: 'error',
            text: 'No se pudo consultar la API en línea. Puede ingresar la tasa manualmente en el campo.'
          }
        }
      }));
    } finally {
      setIsFetchingLiveBCV(false);
    }
  };

  // 💳 MÉTODOS DE PAGO (CONFIGURACIÓN DINÁMICA)
  const [paymentMethodsList, setPaymentMethodsList] = useState<PaymentMethodConfig[]>([]);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState<boolean>(true);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState<boolean>(false);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<Partial<PaymentMethodConfig> | null>(null);
  const [paymentMethodToDelete, setPaymentMethodToDelete] = useState<PaymentMethodConfig | null>(null);
  const [paymentMethodMsg, setPaymentMethodMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadPaymentMethods = async () => {
    try {
      setLoadingPaymentMethods(true);
      const methods = await dbService.getPaymentMethods();
      setPaymentMethodsList(methods);
    } catch (err) {
      console.error('Error loading payment methods:', err);
    } finally {
      setLoadingPaymentMethods(false);
    }
  };

  useEffect(() => {
    loadPaymentMethods();
    const handlePmUpdated = () => loadPaymentMethods();
    window.addEventListener('bellavista_payment_methods_updated', handlePmUpdated);
    return () => {
      window.removeEventListener('bellavista_payment_methods_updated', handlePmUpdated);
    };
  }, []);

  const handleOpenAddPaymentMethod = () => {
    setEditingPaymentMethod({
      id: '',
      code: '',
      name: '',
      currency: 'VES',
      type: 'movil',
      description: '',
      instructions: '',
      account_details: '',
      is_active: true,
      requires_reference: true,
      allow_pos: true,
      allow_online: true
    });
    setShowPaymentMethodModal(true);
  };

  const handleOpenEditPaymentMethod = (pm: PaymentMethodConfig) => {
    setEditingPaymentMethod({ ...pm });
    setShowPaymentMethodModal(true);
  };

  const handleSavePaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPaymentMethod || !editingPaymentMethod.name?.trim()) {
      setPaymentMethodMsg({ type: 'error', text: 'El nombre del método de pago es obligatorio.' });
      return;
    }
    try {
      await dbService.savePaymentMethod(editingPaymentMethod);
      setShowPaymentMethodModal(false);
      setEditingPaymentMethod(null);
      setPaymentMethodMsg({ type: 'success', text: `Método de pago "${editingPaymentMethod.name}" guardado correctamente.` });
      await loadPaymentMethods();
      setTimeout(() => setPaymentMethodMsg(null), 3500);
    } catch (err: any) {
      setPaymentMethodMsg({ type: 'error', text: err.message || 'Error al guardar el método de pago.' });
    }
  };

  const handleTogglePaymentMethod = async (pm: PaymentMethodConfig) => {
    try {
      await dbService.savePaymentMethod({ ...pm, is_active: !pm.is_active });
      await loadPaymentMethods();
    } catch (err: any) {
      alert(`Error al cambiar estado: ${err.message}`);
    }
  };

  const confirmDeletePaymentMethod = async () => {
    if (!paymentMethodToDelete) return;
    try {
      await dbService.deletePaymentMethod(paymentMethodToDelete.id);
      setPaymentMethodToDelete(null);
      setPaymentMethodMsg({ type: 'success', text: `Método "${paymentMethodToDelete.name}" eliminado.` });
      await loadPaymentMethods();
      setTimeout(() => setPaymentMethodMsg(null), 3000);
    } catch (err: any) {
      alert(`Error al eliminar: ${err.message}`);
    }
  };

  // 📦 4. INVENTARIO Y CATÁLOGO
  const [inventarioLowStockThreshold, setInventarioLowStockThreshold] = useState<number>(5);
  const [inventarioBlockNoStockSale, setInventarioBlockNoStockSale] = useState<boolean>(false);
  const [inventarioVirtualLink, setInventarioVirtualLink] = useState<string>('https://bellavista.sistemapos.com/tienda');
  const [inventarioScheduleMonFri, setInventarioScheduleMonFri] = useState<string>('08:00 - 18:00');
  const [inventarioScheduleSat, setInventarioScheduleSat] = useState<string>('09:00 - 14:00');
  const [inventarioScheduleSun, setInventarioScheduleSun] = useState<string>('Cerrado');
  const [inventarioHideOutOfStock, setInventarioHideOutOfStock] = useState<boolean>(false);
  const [inventarioGlobalUnits, setInventarioGlobalUnits] = useState<string[]>(['Unidades', 'Metros', 'Kilos', 'Servicios', 'Resmas']);
  const [newGlobalUnit, setNewGlobalUnit] = useState<string>('');

  // 📢 PUBLICIDAD COMPATIBILITY INSIDE INVENTORY TAB
  const [adSubTab, setAdSubTab] = useState<'banner' | 'carrusel' | 'landing'>('banner');
  const [bannerSlidesList, setBannerSlidesList] = useState<BannerSlide[]>([]);
  const [homeCarouselCardsList, setHomeCarouselCardsList] = useState<HomeCarouselCardItem[]>([]);
  const [landingConfigState, setLandingConfigState] = useState<LandingConfig>({
    is_active: true,
    title: '¡Novedad Dulce! Tres Leches Especial Gourmet',
    subtitle: 'Disfruta de nuestra exquisita torta Tres Leches artesanal preparada con la receta original Bella Vista.',
    badge: '🍰 Novedad Especial',
    image_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=600&h=400',
    button_text: 'Explorar Colección Gourmet'
  });
  const [showSlideModal, setShowSlideModal] = useState(false);
  const [editingSlide, setEditingSlide] = useState<Partial<BannerSlide> | null>(null);
  const [adSaveSuccessMsg, setAdSaveSuccessMsg] = useState<string | null>(null);

  // 🖨️ 5. IMPRESIÓN Y TICKET (Hardware)
  const [impresionTicketFormat, setImpresionTicketFormat] = useState<'80mm' | '58mm' | 'carta' | 'pdf'>('58mm');
  const [impresionGreeting, setImpresionGreeting] = useState<string>('¡Gracias por su compra en Bella Vista!');
  const [impresionWarranty, setImpresionWarranty] = useState<string>('Conserve su ticket para cambios dentro de las 48 horas.');
  const [impresionPrinterConnected, setImpresionPrinterConnected] = useState<boolean>(true);
  const [impresionTriggerDrawer, setImpresionTriggerDrawer] = useState<boolean>(true);
  const [isScanningPrinters, setIsScanningPrinters] = useState<boolean>(false);
  const [discoveredPrinters, setDiscoveredPrinters] = useState<string[]>([]);

  // 📊 6. PANEL Y ESTADÍSTICAS
  const [dashboardShowProfits, setDashboardShowProfits] = useState<boolean>(true);
  const [dashboardShowSales, setDashboardShowSales] = useState<boolean>(true);
  const [dashboardShowExpenses, setDashboardShowExpenses] = useState<boolean>(true);
  const [dashboardShowEmployeeSales, setDashboardShowEmployeeSales] = useState<boolean>(true);
  const [dashboardEmailReports, setDashboardEmailReports] = useState<'ninguno' | 'diario' | 'semanal' | 'mensual'>('diario');
  const [dashboardEmailReportsAddress, setDashboardEmailReportsAddress] = useState<string>('administracion@bellavista.com');

  // Local state for Reportes "Tu Gestión" modules configuration
  const [reportConfigs, setReportConfigs] = useState<ReportModuleConfig[]>([]);
  const [loadingReportConfigs, setLoadingReportConfigs] = useState<boolean>(true);
  const [savingReportConfigs, setSavingReportConfigs] = useState<boolean>(false);
  const [reportConfigSuccessMsg, setReportConfigSuccessMsg] = useState<string | null>(null);
  const [draggedConfigIndex, setDraggedConfigIndex] = useState<number | null>(null);

  const loadReportConfigs = async () => {
    try {
      setLoadingReportConfigs(true);
      const configs = await dbService.getReportModulesConfig();
      setReportConfigs(configs);
    } catch (err) {
      console.error("Error loading report configs in SystemConfigPanel:", err);
    } finally {
      setLoadingReportConfigs(false);
    }
  };

  useEffect(() => {
    loadReportConfigs();
    const handleUpdate = () => loadReportConfigs();
    window.addEventListener('bellavista_report_modules_updated', handleUpdate);
    return () => {
      window.removeEventListener('bellavista_report_modules_updated', handleUpdate);
    };
  }, []);

  const moveReportItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= reportConfigs.length) return;

    const updated = [...reportConfigs];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    const sorted = updated.map((item, idx) => ({ ...item, sort_order: idx + 1 }));
    setReportConfigs(sorted);
  };

  const toggleReportItemActive = (id: string) => {
    const updated = reportConfigs.map(item => {
      if (item.id === id) {
        return { ...item, enabled: !item.enabled };
      }
      return item;
    });
    setReportConfigs(updated);
  };

  const handleDragStartConfig = (e: React.DragEvent, index: number) => {
    setDraggedConfigIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverConfig = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedConfigIndex === null || draggedConfigIndex === index) return;

    const updated = [...reportConfigs];
    const temp = updated[draggedConfigIndex];
    updated.splice(draggedConfigIndex, 1);
    updated.splice(index, 0, temp);

    setDraggedConfigIndex(index);
    setReportConfigs(updated.map((item, idx) => ({ ...item, sort_order: idx + 1 })));
  };

  const handleDragEndConfig = () => {
    setDraggedConfigIndex(null);
  };

  const handleSaveReportConfigs = async () => {
    try {
      setSavingReportConfigs(true);
      await dbService.saveReportModulesConfig(reportConfigs);
      setReportConfigSuccessMsg("¡Configuración del panel de gráficas guardada con éxito!");
      setTimeout(() => setReportConfigSuccessMsg(null), 3000);
    } catch (err) {
      console.error("Error saving report configs:", err);
    } finally {
      setSavingReportConfigs(false);
    }
  };

  // 🔔 7. SISTEMA Y NOTIFICACIONES
  const [notifSoundOnSale, setNotifSoundOnSale] = useState<boolean>(true);
  const [notifAlertUnopenedCash, setNotifAlertUnopenedCash] = useState<boolean>(true);
  const [notifPushLowStock, setNotifPushLowStock] = useState<boolean>(true);
  const [notifPushDailyClose, setNotifPushDailyClose] = useState<boolean>(true);

  const [configSaved, setConfigSaved] = useState<boolean>(false);
  const [billingCycle, setBillingCycle] = useState<'mensual' | 'trimestral' | 'anual'>('mensual');
  const [selectedPlanId, setSelectedPlanId] = useState<'gratuito' | 'basico' | 'pro' | 'enterprise'>('pro');

  // LOAD VALUES ON MOUNT
  useEffect(() => {
    try {
      // 1. Load real Business Profile from Supabase / localStorage
      dbService.getBusinessProfile().then(p => {
        if (p) {
          if (p.name) setConfigStoreName(p.name);
          if (p.business_type) setBusinessBusinessType(p.business_type);
          if (p.address) setBusinessAddress(p.address);
          if (p.city) setBusinessCity(p.city);
          if (p.phone) setConfigPhone(p.phone);
          if (p.email) setBusinessEmail(p.email);
          if (p.rif) setConfigRif(p.rif);
          if (p.website) setBusinessWebsite(p.website);
          if (p.logo_url) setBusinessLogo(p.logo_url);
          if (p.slogan) setBusinessSlogan(p.slogan);
          if (p.saas_plan) {
            setBusinessSaaSPlan(p.saas_plan as any);
            setSelectedPlanId(p.saas_plan as any);
          }
        }
      });

      // 2. Load real Branches and Terminals
      dbService.getBusinessBranches().then(branches => {
        if (branches) setBusinessBranches(branches);
      });
      dbService.getBusinessTerminals().then(terminals => {
        if (terminals) setBusinessCajas(terminals);
      });

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

      // Load marketing/publicidad lists
      dbService.getBannerSlides().then(slides => setBannerSlidesList(slides || []));
      dbService.getLandingConfig().then(cfg => {
        if (cfg) setLandingConfigState(cfg);
      });
      dbService.getHomeCarouselCards().then(cards => setHomeCarouselCardsList(cards || []));
    } catch (e) {
      console.error("Error loading config inside SystemConfigPanel:", e);
    }
  }, [currentUser]);

  // SAVE CORE CONFIG ROUTINE
  const handleSaveAll = async () => {
    setIsSavingBusiness(true);
    const payload = {
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
      businessCity,
      businessEmail,
      businessBusinessType,
      businessWebsite,
      businessSlogan,
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

    // Save locally
    localStorage.setItem('copias_bellavista_sys_config', JSON.stringify(payload));
    setStoredLanguage(userInterfaceLang);
    applyTheme(userInterfaceTheme);
    localStorage.setItem('copias_bellavista_sound_on_sale', String(notifSoundOnSale));
    localStorage.setItem('copias_bellavista_push_low_stock', String(notifPushLowStock));
    localStorage.setItem('copias_bellavista_block_no_stock_sale', String(inventarioBlockNoStockSale));
    localStorage.setItem('business_address', businessAddress);
    localStorage.setItem('business_city', businessCity);
    localStorage.setItem('business_email', businessEmail);
    localStorage.setItem('business_type', businessBusinessType);
    localStorage.setItem('business_website', businessWebsite);

    // Apply properties to parent states
    setConfigStoreName(configStoreName);
    setConfigRif(configRif);
    setConfigIva(configIva);
    setConfigPhone(configPhone);

    // 🌟 Save real Business Profile and Report Modules Config to Supabase
    try {
      if (reportConfigs && reportConfigs.length > 0) {
        await dbService.saveReportModulesConfig(reportConfigs);
      }
      await dbService.saveBusinessProfile({
        name: configStoreName,
        business_type: businessBusinessType,
        address: businessAddress,
        city: businessCity,
        phone: configPhone,
        email: businessEmail,
        rif: configRif,
        website: businessWebsite,
        logo_url: businessLogo,
        slogan: businessSlogan,
        saas_plan: businessSaaSPlan
      });
    } catch (e) {
      console.warn("dbService saveBusinessProfile/reportConfigs error:", e);
    }

    // Sync generic app_config as well
    const { supabase } = dbService as any;
    try {
      if (supabase) {
        await supabase.from('app_config').upsert({
          key: 'sys_config',
          value: payload,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      }
    } catch (e) {
      console.warn("Supabase configs upsert failed:", e);
    }

    // Dispatch events
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('bellavista_settings_updated'));
    window.dispatchEvent(new CustomEvent('bellavista_theme_updated'));

    setIsSavingBusiness(false);
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 4000);
    alert('¡Información del negocio y ajustes del sistema guardados exitosamente en Supabase!');
  };

  // 📍 BRANCH CRUD METHODS
  const handleSaveBranch = async (branchData: Partial<BusinessBranch>) => {
    if (!branchData.name?.trim() || !branchData.code?.trim()) {
      alert('Por favor ingrese el código y nombre de la sede.');
      return;
    }
    const id = branchData.id || `branch_${Date.now()}`;
    const branchToSave: BusinessBranch = {
      id,
      code: branchData.code.trim().toUpperCase(),
      name: branchData.name.trim(),
      address: branchData.address || '',
      phone: branchData.phone || '',
      active: branchData.active !== undefined ? branchData.active : true,
      created_at: branchData.created_at || new Date().toISOString()
    };

    try {
      await dbService.saveBusinessBranch(branchToSave);
      const updated = await dbService.getBusinessBranches();
      setBusinessBranches(updated);
      setShowBranchModal(false);
      setEditingBranch(null);
    } catch (err: any) {
      console.warn('Error al guardar sede:', err);
    }
  };

  const confirmDeleteBranch = async () => {
    if (!branchToDelete) return;
    setIsDeletingBranch(true);
    const targetId = branchToDelete.id;
    try {
      // Optimistic update
      setBusinessBranches(prev => prev.filter(b => b.id !== targetId));
      setBusinessCajas(prev => prev.filter(t => t.branch_id !== targetId));
      
      await dbService.deleteBusinessBranch(targetId);
      const updatedBranches = await dbService.getBusinessBranches();
      setBusinessBranches(updatedBranches);
      const updatedTerminals = await dbService.getBusinessTerminals();
      setBusinessCajas(updatedTerminals);
      if (selectedBranchForTerminals?.id === targetId) {
        setShowTerminalModal(false);
        setSelectedBranchForTerminals(null);
      }
    } catch (err: any) {
      console.warn('Error al eliminar sede de Supabase:', err);
    } finally {
      setIsDeletingBranch(false);
      setBranchToDelete(null);
    }
  };

  // 💻 TERMINAL CRUD METHODS
  const handleSaveTerminal = async (terminalData: Partial<BusinessTerminal>) => {
    if (!terminalData.name?.trim() || !terminalData.code?.trim() || !terminalData.branch_id) {
      alert('Por favor ingrese el código, nombre y asigne una sede a la caja.');
      return;
    }
    const id = terminalData.id || `term_${Date.now()}`;
    const terminalToSave: BusinessTerminal = {
      id,
      branch_id: terminalData.branch_id,
      code: terminalData.code.trim().toUpperCase(),
      name: terminalData.name.trim(),
      active: terminalData.active !== undefined ? terminalData.active : true,
      created_at: terminalData.created_at || new Date().toISOString()
    };

    try {
      await dbService.saveBusinessTerminal(terminalToSave);
      const updated = await dbService.getBusinessTerminals();
      setBusinessCajas(updated);
      setEditingTerminal(null);
    } catch (err: any) {
      console.warn('Error al guardar terminal:', err);
    }
  };

  const confirmDeleteTerminal = async () => {
    if (!terminalToDelete) return;
    setIsDeletingTerminal(true);
    const targetId = terminalToDelete.id;
    try {
      // Optimistic update
      setBusinessCajas(prev => prev.filter(c => c.id !== targetId));
      
      await dbService.deleteBusinessTerminal(targetId);
      const updated = await dbService.getBusinessTerminals();
      setBusinessCajas(updated);
    } catch (err: any) {
      console.warn('Error al eliminar terminal de Supabase:', err);
    } finally {
      setIsDeletingTerminal(false);
      setTerminalToDelete(null);
    }
  };

  // ADD NEW TAX METHOD
  const handleAddTax = async (e: React.FormEvent) => {
    e.preventDefault();
    const rateVal = parseFloat(newTaxRate);
    if (!newTaxName || isNaN(rateVal)) {
      setTaxMessage({ type: 'error', text: 'Complete los campos correctamente.' });
      return;
    }
    try {
      await dbService.saveTax({ name: newTaxName, rate: rateVal, is_active: true });
      setNewTaxName('');
      setNewTaxRate('');
      setTaxMessage({ type: 'success', text: `Impuesto "${newTaxName}" guardado correctamente.` });
      await loadAdminTaxes();
      setTimeout(() => setTaxMessage(null), 3000);
    } catch (err: any) {
      setTaxMessage({ type: 'error', text: err.message || 'Error al guardar.' });
    }
  };

  // TOGGLE TAX METHOD
  const handleToggleTax = async (tax: Tax) => {
    try {
      await dbService.saveTax({ ...tax, is_active: !tax.is_active });
      await loadAdminTaxes();
    } catch (err: any) {
      alert(`Error al cambiar estado del impuesto: ${err.message}`);
    }
  };

  // SCAN PRINTERS MOCK METHOD
  const handleScanPrinters = () => {
    setIsScanningPrinters(true);
    setDiscoveredPrinters([]);
    setTimeout(() => {
      setIsScanningPrinters(false);
      setDiscoveredPrinters([
        '🖨️ XP-58 POS Thermal Printer (Bluetooth 4.0)',
        '🖨️ Epson TM-T88VI Ticket Dispenser (USB/LAN)',
        '🖨️ Star Micronics TSP143III (Wireless)'
      ]);
    }, 2000);
  };

  // MARKETING SAVES FOR SLIDES & CAROUSELS
  const handleSaveLandingConfig = async () => {
    try {
      await dbService.saveLandingConfig(landingConfigState);
      setAdSaveSuccessMsg('¡Configuración de Landing guardada exitosamente en Supabase!');
      setTimeout(() => setAdSaveSuccessMsg(null), 4000);
    } catch (e) {
      alert('Error saving landing config');
    }
  };

  const menuItems = [
    { id: 'mi_cuenta', label: `👤 ${t('account.my_account_tab', 'Mi Cuenta')}`, desc: t('account.my_account_desc', 'Perfil, seguridad y contraseña') },
    { id: 'mi_negocio', label: `🏢 ${t('business.my_business_tab', 'Mi Negocio')}`, desc: t('business.my_business_desc', 'Empresa, SaaS, sedes y cajas') },
    { id: 'planes_suscripcion', label: `💳 ${t('saas.subscription_tab', 'Plan de Suscripción')}`, desc: t('saas.subscription_desc', 'Gestionar licencia, Free, Básico o Pro') },
    { id: 'facturacion', label: `💳 ${t('billing.billing_tab', 'Facturación')}`, desc: t('billing.billing_desc', 'Monedas, tasas e impuestos') },
    { id: 'inventario', label: `📦 ${t('inventory.inventory_tab', 'Inventario / Catálogo')}`, desc: t('inventory.inventory_desc', 'Stock, e-commerce y banners') },
    { id: 'impresion', label: `🖨️ ${t('print.printing_tab', 'Impresión / Hardware')}`, desc: t('print.printing_desc', 'Ticket, garantía e impresoras') },
    { id: 'dashboard', label: `📊 ${t('dash.dashboard_tab', 'Panel de Gráficas')}`, desc: t('dash.dashboard_desc', 'Personalizar reportes y vistas') },
    { id: 'notificaciones', label: `🔔 ${t('notif.notifications_tab', 'Sistema y Alertas')}`, desc: t('notif.notifications_desc', 'Sonidos, correos y alertas') },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs text-left" id="general_system_configuration_center">
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 pb-5 mb-6">
        <div>
          <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#005da9]" />
            <span>{t('config.control_center_title', 'Centro de Control de Configuraciones')}</span>
          </h3>
          <p className="text-xs text-gray-500 font-medium">
            {t('config.control_center_subtitle', 'Personalice y administre el comportamiento global de su plataforma. Cada cambio se aplica inmediatamente.')}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveAll}
            className="px-5 py-2.5 bg-[#005da9] hover:bg-[#004a87] text-white text-xs font-extrabold rounded-xl flex items-center gap-2 transition shadow-md cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{t('app.save_changes', 'Guardar Cambios')}</span>
          </button>
        </div>
      </div>

      {configSaved && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2 animate-pulse">
          <Check className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>¡Sincronización Completada! Los ajustes se guardaron en la caché local y en la base de datos de Supabase.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* SIDE BAR BUTTONS FOR LAYOUT */}
        <div className="lg:col-span-1 space-y-1.5 border-r border-gray-100 pr-0 lg:pr-4">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-2 px-3">Menú de Ajustes</span>
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setConfigSubTab(item.id as any)}
              className={`w-full text-left px-3.5 py-3 rounded-xl transition-all flex flex-col gap-0.5 cursor-pointer border ${
                configSubTab === item.id
                  ? 'bg-gradient-to-r from-blue-50 to-[#005da9]/5 border-[#005da9]/20 text-[#005da9]'
                  : 'bg-white hover:bg-gray-50 border-transparent text-gray-700'
              }`}
            >
              <span className="font-extrabold text-xs">{item.label}</span>
              <span className="text-[10px] text-gray-400 font-medium">{item.desc}</span>
            </button>
          ))}
        </div>

        {/* ACTIVE SUB-TAB CONTAINER */}
        <div className="lg:col-span-3 space-y-6">
          {/* TAB 1: MI CUENTA */}
          {configSubTab === 'mi_cuenta' && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 pb-3">
                <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider">👤 {t('account.title', 'Ajustes de Cuenta y Perfil')}</h4>
                <p className="text-xs text-gray-400">{t('account.subtitle', 'Configure los datos del usuario conectado, seguridad de acceso y personalice el idioma de la aplicación.')}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">{t('account.full_name', 'Nombre Completo')}</label>
                  <input
                    type="text"
                    value={userPerfilNombre}
                    onChange={(e) => setUserPerfilNombre(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-[#005da9]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">{t('account.id_doc', 'Documento de Identidad / Cédula')}</label>
                  <input
                    type="text"
                    value={userPerfilDoc}
                    onChange={(e) => setUserPerfilDoc(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-[#005da9]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">{t('account.phone', 'Número de Teléfono')}</label>
                  <input
                    type="text"
                    value={userPerfilPhone}
                    onChange={(e) => setUserPerfilPhone(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-[#005da9]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">{t('account.email', 'Correo Electrónico')}</label>
                  <input
                    type="email"
                    value={userPerfilEmail}
                    onChange={(e) => setUserPerfilEmail(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-[#005da9]"
                  />
                </div>
              </div>

              {/* SECURITY & 2FA */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/50 space-y-4">
                <h5 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-slate-600" />
                  <span>{t('account.2fa_title', 'Seguridad y Acceso en 2 Pasos')}</span>
                </h5>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-gray-700 block">{t('account.2fa_title', 'Doble Factor de Autenticación (2FA)')}</span>
                    <span className="text-[10px] text-gray-500 font-medium">{t('account.2fa_desc', 'Añada una capa de seguridad extra requiriendo un código temporal en su teléfono.')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUser2FA(!user2FA)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      user2FA ? 'bg-[#005da9]' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      user2FA ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {user2FA && (
                  <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-start gap-4 animate-fadeIn">
                    <div className="bg-gray-100 p-2 rounded-lg font-mono text-[10px] border border-gray-200">
                      [ QR CODE SIMULADO ]
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-black text-gray-800 block">Llave de configuración manual:</span>
                      <code className="text-[10px] font-mono text-[#005da9] bg-[#005da9]/5 px-2 py-0.5 rounded font-black">BELLA-VISTA-SECURITY-KEY-2026</code>
                      <p className="text-[10px] text-gray-400 font-medium">Escanee el código QR con Google Authenticator o Duo Mobile para sincronizar sus códigos.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* SESSIONS */}
              <div className="space-y-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">{t('account.active_sessions', 'Sesiones Activas')}</span>
                <div className="border border-gray-150 rounded-2xl overflow-hidden bg-white shadow-3xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-150 text-[10px] font-black uppercase text-gray-400">
                        <th className="px-4 py-2.5">{t('account.device', 'Dispositivo / Sistema')}</th>
                        <th className="px-4 py-2.5">{t('account.ip_address', 'Dirección IP')}</th>
                        <th className="px-4 py-2.5">{t('app.status', 'Estado')}</th>
                        <th className="px-4 py-2.5 text-right">{t('app.actions', 'Acción')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {activeSessions.map(sess => (
                        <tr key={sess.id}>
                          <td className="px-4 py-3 font-bold text-gray-800">{sess.device}</td>
                          <td className="px-4 py-3 font-mono text-gray-500">{sess.ip}</td>
                          <td className="px-4 py-3">
                            {sess.active ? (
                              <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full text-[10px] font-black border border-emerald-200">Actual</span>
                            ) : (
                              <span className="text-gray-400 font-medium">{sess.date}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {!sess.active && (
                              <button
                                onClick={() => setActiveSessions(activeSessions.filter(s => s.id !== sess.id))}
                                className="text-rose-600 hover:text-rose-800 text-[10px] font-black cursor-pointer"
                              >
                                {t('account.unlink', 'Desvincular')}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PREFERENCES */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-gray-100">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">{t('account.system_language', 'Idioma del Sistema')}</label>
                  <select
                    value={userInterfaceLang}
                    onChange={(e) => {
                      const val = e.target.value as LanguageCode;
                      setUserInterfaceLang(val);
                      setStoredLanguage(val);
                    }}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-[#005da9]"
                  >
                    <option value="es">{t('account.lang_es', 'Español (Castellano)')}</option>
                    <option value="en">{t('account.lang_en', 'English (United States)')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">{t('account.visual_theme', 'Tema Visual')}</label>
                  <select
                    value={userInterfaceTheme}
                    onChange={(e) => {
                      const val = e.target.value as ThemeCode;
                      setUserInterfaceTheme(val);
                      applyTheme(val);
                    }}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-[#005da9]"
                  >
                    <option value="claro">{t('account.theme_light', '☀️ Opción 1: Tema Claro Operativo (Azul Bellavista / Alta Legibilidad)')}</option>
                    <option value="minimalista_premium">{t('account.theme_minimalista_premium', '✨ MINIMALISTA PREMIUM')}</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MI NEGOCIO */}
          {configSubTab === 'mi_negocio' && (
            <div className="space-y-6">
              {/* Encabezado fuera de la tarjeta */}
              <div className="flex items-center justify-between pb-1">
                <div>
                  <h3 className="text-base font-black text-gray-900 tracking-tight flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-[#005da9]" />
                    <span>Información del negocio</span>
                  </h3>
                  <p className="text-xs text-gray-500">Datos fiscales, comerciales y de contacto utilizados en encabezados, reportes e impresiones de comprobantes.</p>
                </div>
              </div>

              {/* Contenedor Principal (Tarjeta / Card) */}
              <div className="bg-white border border-gray-200/90 rounded-2xl p-6 shadow-xs space-y-6">
                
                {/* 1. Botón de Carga de Logo */}
                <div className="flex items-center gap-4">
                  <label className="w-28 h-28 border-2 border-dashed border-blue-400 bg-blue-50/40 hover:bg-blue-50 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all shrink-0 relative group overflow-hidden">
                    {businessLogo ? (
                      <img src={businessLogo} alt="Logo del negocio" className="w-full h-full object-contain p-2 rounded-2xl" />
                    ) : (
                      <div className="flex flex-col items-center text-center p-2">
                        <span className="text-xl font-bold text-blue-600 mb-1">↑</span>
                        <span className="text-[11px] font-bold text-blue-600 leading-tight">Carga tu logo</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setBusinessLogo(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-gray-800">Logo del negocio</h4>
                    <p className="text-xs text-gray-500">Aparece en el encabezado principal, tickets de venta, cotizaciones y reportes contables.</p>
                    {businessLogo && (
                      <button
                        type="button"
                        onClick={() => setBusinessLogo('')}
                        className="text-xs text-rose-600 hover:text-rose-700 font-bold underline cursor-pointer pt-0.5"
                      >
                        Quitar logo actual
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Formulario en 2 Columnas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Nombre del negocio */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Nombre del negocio*</label>
                    <input
                      type="text"
                      value={configStoreName}
                      onChange={(e) => setConfigStoreName(e.target.value)}
                      placeholder="Copias Bella Vista, C.A."
                      className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                    />
                  </div>

                  {/* Tipo de negocio (Select con categorías completas) */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Tipo de negocio*</label>
                    <select
                      value={businessBusinessType}
                      onChange={(e) => setBusinessBusinessType(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                    >
                      <option value="Papelería y libros">Papelería y libros</option>
                      <optgroup label="1. Alimentos y Bebidas (Venta Directa / Al Por Menor)">
                        <option value="Bodega">Bodega</option>
                        <option value="Minimercado">Minimercado</option>
                        <option value="Carnicería">Carnicería</option>
                        <option value="Charcutería">Charcutería</option>
                        <option value="Panadería y Repostería">Panadería y Repostería</option>
                        <option value="Licorería">Licorería</option>
                        <option value="Tienda naturista y/o suplementos">Tienda naturista y/o suplementos</option>
                      </optgroup>
                      <optgroup label="2. Gastronomía y Servicios de Comida">
                        <option value="Restaurante o comida rápida">Restaurante o comida rápida</option>
                        <option value="Cafetería">Cafetería</option>
                        <option value="Bar">Bar</option>
                      </optgroup>
                      <optgroup label="3. Moda, Calzado y Accesorios Personales">
                        <option value="Ropa y calzado">Ropa y calzado</option>
                        <option value="Artículos de belleza">Artículos de belleza</option>
                        <option value="Accesorios y bisutería">Accesorios y bisutería</option>
                        <option value="Tiendas de regalo (Variedades)">Tiendas de regalo (Variedades)</option>
                      </optgroup>
                      <optgroup label="4. Salud, Belleza y Cuidado Personal">
                        <option value="Farmacia y droguería">Farmacia y droguería</option>
                        <option value="Barbería y salón de belleza">Barbería y salón de belleza</option>
                        <option value="Estética y salud">Estética y salud</option>
                        <option value="Gimnasio">Gimnasio</option>
                        <option value="Tatuajes y piercings">Tatuajes y piercings</option>
                      </optgroup>
                      <optgroup label="5. Hogar, Papelería y Tecnología">
                        <option value="Artículos para el hogar">Artículos para el hogar</option>
                        <option value="Papelería y libros">Papelería y libros</option>
                        <option value="Electrónica e informática">Electrónica e informática</option>
                      </optgroup>
                      <optgroup label="6. Automotriz y Ferretería">
                        <option value="Venta de automóviles">Venta de automóviles</option>
                        <option value="Artículos automotrices">Artículos automotrices</option>
                        <option value="Taller automotriz">Taller automotriz</option>
                        <option value="Ferretería y construcción">Ferretería y construcción</option>
                      </optgroup>
                      <optgroup label="7. Agropecuario y Mascotas">
                        <option value="Insumos agropecuarios">Insumos agropecuarios</option>
                        <option value="Tienda de mascotas o vet">Tienda de mascotas o vet</option>
                      </optgroup>
                      <optgroup label="8. Comercio al Por Mayor y Cadena de Suministro">
                        <option value="Distribuidora mayorista">Distribuidora mayorista</option>
                        <option value="Industria o manufactura">Industria o manufactura</option>
                        <option value="Transporte y logística">Transporte y logística</option>
                      </optgroup>
                      <optgroup label="9. Servicios Profesionales, Financieros y Otros">
                        <option value="Servicios educativos">Servicios educativos</option>
                        <option value="Organización de eventos">Organización de eventos</option>
                        <option value="Marketing y publicidad">Marketing y publicidad</option>
                        <option value="Préstamos y financiamiento">Préstamos y financiamiento</option>
                        <option value="Reparaciones y mantenimiento">Reparaciones y mantenimiento</option>
                        <option value="Entretenimiento y ocio">Entretenimiento y ocio</option>
                        <option value="Hoteles y turismo">Hoteles y turismo</option>
                      </optgroup>
                    </select>
                  </div>

                  {/* Dirección / Dirección fiscal */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Dirección fiscal</label>
                    <input
                      type="text"
                      value={businessAddress}
                      onChange={(e) => setBusinessAddress(e.target.value)}
                      placeholder="Sector bella vista, a una cuadra subiendo de la Cruz roja, calle 20 entre carrera 3 y 4"
                      className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                    />
                  </div>

                  {/* Ciudad */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Ciudad</label>
                    <input
                      type="text"
                      value={businessCity}
                      onChange={(e) => setBusinessCity(e.target.value)}
                      placeholder="Barinitas"
                      className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                    />
                  </div>

                  {/* Número de celular / Contacto (WhatsApp) */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Número de celular (WhatsApp)</label>
                    <div className="flex items-center gap-2 border border-gray-300 rounded-xl p-1 bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
                      <div className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 rounded-lg text-xs font-bold text-gray-700 shrink-0 border border-gray-200">
                        <span>🇻🇪</span>
                        <span>+58</span>
                      </div>
                      <input
                        type="text"
                        value={configPhone}
                        onChange={(e) => setConfigPhone(e.target.value)}
                        placeholder="4125043857"
                        className="w-full p-1 bg-transparent text-xs font-medium outline-none"
                      />
                    </div>
                  </div>

                  {/* Correo electrónico */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Correo electrónico</label>
                    <input
                      type="email"
                      value={businessEmail}
                      onChange={(e) => setBusinessEmail(e.target.value)}
                      placeholder="Fotocopiasfyp@gmail.com"
                      className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                    />
                  </div>

                  {/* Número de documento / RIF */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Número de documento / RIF</label>
                    <input
                      type="text"
                      value={configRif}
                      onChange={(e) => setConfigRif(e.target.value)}
                      placeholder="J-50987654-3"
                      className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                    />
                  </div>

                  {/* Lema / Slogan del Encabezado */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Lema / Slogan (Encabezado)</label>
                    <input
                      type="text"
                      value={businessSlogan}
                      onChange={(e) => setBusinessSlogan(e.target.value)}
                      placeholder="Equipando Tus Proyectos"
                      className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                    />
                  </div>

                  {/* Sitio web */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Sitio web</label>
                    <input
                      type="text"
                      value={businessWebsite}
                      onChange={(e) => setBusinessWebsite(e.target.value)}
                      placeholder="https://copiasbellavista.vercel.app/"
                      className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                    />
                  </div>
                </div>

                {/* Zona de Acción Crítica / Advertencia (Pie de la tarjeta) */}
                <div className="pt-5 border-t border-gray-150 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <p className="text-gray-400 font-medium">Una vez confirmado el guardado, los datos se actualizarán en tiempo real en la barra principal, reportes e impresiones.</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('¿Deseas reiniciar los datos de tu negocio a los valores por defecto?')) {
                        setConfigStoreName('Copias Bella Vista, C.A.');
                        setBusinessAddress('Sector bella vista, a una cuadra subiendo de la Cruz roja, calle 20 entre carrera 3 y 4');
                        setBusinessCity('Barinitas');
                        setBusinessEmail('Fotocopiasfyp@gmail.com');
                        setConfigPhone('+58 412-5043857');
                        setConfigRif('J-50987654-3');
                        setBusinessWebsite('https://copiasbellavista.vercel.app/');
                        setBusinessSlogan('Equipando Tus Proyectos');
                      }
                    }}
                    className="text-rose-600 hover:text-rose-700 font-bold underline cursor-pointer shrink-0 transition-colors"
                  >
                    Restablecer campos
                  </button>
                </div>
              </div>

              {/* Barra de Acciones Globales (Footer fuera de la tarjeta) */}
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    dbService.getBusinessProfile().then(p => {
                      if (p) {
                        setConfigStoreName(p.name);
                        setBusinessBusinessType(p.business_type);
                        setBusinessAddress(p.address);
                        setBusinessCity(p.city);
                        setConfigPhone(p.phone);
                        setBusinessEmail(p.email);
                        setConfigRif(p.rif);
                        setBusinessWebsite(p.website);
                        setBusinessLogo(p.logo_url);
                        setBusinessSlogan(p.slogan || 'Equipando Tus Proyectos');
                      }
                    });
                  }}
                  className="px-5 py-2.5 bg-gray-200/80 hover:bg-gray-300 text-gray-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  onClick={handleSaveAll}
                  disabled={isSavingBusiness}
                  className="px-6 py-2.5 bg-[#005da9] hover:bg-[#004a87] text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingBusiness ? 'Guardando en Supabase...' : 'Guardar cambios'}</span>
                </button>
              </div>

              {/* 📍 SUCURSALES Y SEDES (DATOS REALES Y CRUD COMPLETO) */}
              <div className="space-y-4 pt-6 border-t border-gray-200/80 text-left">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-[#005da9]" />
                      <span>Sedes y Terminales (Puntos de Venta)</span>
                    </h4>
                    <p className="text-xs text-gray-500">Cree, modifique y gestione las sucursales físicas y sus puntos de venta asociados con sincronización a Supabase.</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingBranch({
                        code: `SUC-0${businessBranches.length + 1}`,
                        name: '',
                        address: '',
                        phone: '',
                        active: true
                      });
                      setShowBranchModal(true);
                    }}
                    className="px-3.5 py-2 bg-[#005da9] hover:bg-[#004a87] text-white text-xs font-black rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Agregar Sede</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {businessBranches.map(branch => {
                    const branchTerminals = businessCajas.filter(c => c.branch_id === branch.id);
                    return (
                      <div 
                        key={branch.id} 
                        className="p-5 bg-white rounded-2xl border border-gray-200 hover:border-gray-300 transition-all shadow-xs flex flex-col justify-between gap-4"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-mono text-gray-400 font-bold uppercase tracking-wider block mb-0.5">
                              {branch.code}
                            </span>
                            <h6 className="text-sm font-black text-gray-900 leading-snug">{branch.name}</h6>
                            <span className="text-xs text-gray-500 font-medium block mt-1">
                              {branch.address || 'Sin dirección física especificada'}
                            </span>
                            {branch.phone && (
                              <span className="text-[11px] text-gray-400 font-medium block mt-0.5 flex items-center gap-1">
                                📞 {branch.phone}
                              </span>
                            )}
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border shrink-0 ${
                            branch.active 
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                              : 'bg-gray-100 border-gray-300 text-gray-500'
                          }`}>
                            {branch.active ? 'Habilitada' : 'Inactiva'}
                          </span>
                        </div>

                        {/* Actions for this Sede */}
                        <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBranchForTerminals(branch);
                              setShowTerminalModal(true);
                            }}
                            className="text-[#005da9] hover:text-[#004a87] font-extrabold flex items-center gap-1.5 bg-blue-50/70 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                          >
                            <Monitor className="w-3.5 h-3.5" />
                            <span>Gestionar Cajas ({branchTerminals.length})</span>
                          </button>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBranch(branch);
                                setShowBranchModal(true);
                              }}
                              className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                              title="Modificar Sede"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setBranchToDelete(branch)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Eliminar Sede"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FACTURACIÓN */}
          {configSubTab === 'facturacion' && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 pb-3">
                <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider">💳 Motor de Facturación, Impuestos y Monedas</h4>
                <p className="text-xs text-gray-400">Configure los valores fiscales de la empresa, correlativos de comprobantes y gestione las tasas del BCV en tiempo real.</p>
              </div>

              {/* 1. SELECCIÓN DE MONEDA PRINCIPAL DEL SISTEMA */}
              <div className="p-5 bg-gradient-to-br from-[#005da9]/5 via-white to-sky-50/30 border border-[#005da9]/20 rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#005da9]/10 pb-3">
                  <div>
                    <h5 className="text-xs font-black text-[#005da9] uppercase flex items-center gap-2 tracking-wide">
                      <Coins className="w-4 h-4 text-[#005da9]" />
                      <span>Moneda Principal de la Plataforma (Precios, Facturación y Pedidos)</span>
                    </h5>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Seleccione la divisa principal por defecto en la que se fijarán y mostrarán los precios del catálogo en línea, notas de entrega, facturas, tickets y pedidos.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Activa:</span>
                    <span className="text-xs font-black text-[#005da9] flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      {CURRENCIES[facturacionMainCurrency]?.label || facturacionMainCurrency} ({CURRENCIES[facturacionMainCurrency]?.symbol})
                    </span>
                  </div>
                </div>

                {mainCurrencySuccessMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2 animate-fadeIn">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{mainCurrencySuccessMsg}</span>
                  </div>
                )}

                {/* Tarjetas de Selección Interactiva de Moneda Principal */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                  {(['USD', 'VES', 'EUR', 'COP'] as CurrencyCode[]).map((code) => {
                    const cfg = CURRENCIES[code];
                    const isSelected = facturacionMainCurrency === code;
                    const samplePrice = formatCurrency(25, code, currencyRates);

                    return (
                      <div
                        key={code}
                        onClick={() => handleSelectMainCurrency(code)}
                        className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer relative flex flex-col justify-between select-none ${
                          isSelected
                            ? 'bg-blue-50/70 border-[#005da9] shadow-sm ring-2 ring-[#005da9]/20'
                            : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">
                              {code === 'USD' ? '🇺🇸' : code === 'VES' ? '🇻🇪' : code === 'EUR' ? '🇪🇺' : '🇨🇴'}
                            </span>
                            <div>
                              <span className="text-xs font-black text-gray-900 block leading-tight">{cfg.label}</span>
                              <span className="text-[10px] font-bold text-gray-400 font-mono">Símbolo: {cfg.symbol}</span>
                            </div>
                          </div>
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected ? 'bg-[#005da9] border-[#005da9] text-white' : 'border-gray-300 bg-white'
                          }`}>
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                          <span className="text-[10px] text-gray-500 font-medium">Ejemplo $25:</span>
                          <span className={`text-xs font-black font-mono ${isSelected ? 'text-[#005da9]' : 'text-gray-700'}`}>
                            {samplePrice}
                          </span>
                        </div>

                        {isSelected && (
                          <div className="mt-2 text-center bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase py-0.5 rounded-md tracking-wider">
                            ✓ Moneda Principal Activa
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. GESTIÓN Y ACTUALIZACIÓN MANUAL DE TASAS DE CAMBIO */}
              <div className="p-5 bg-white border border-gray-200 rounded-2xl space-y-4 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <div>
                    <h5 className="text-xs font-black text-gray-800 uppercase flex items-center gap-2 tracking-wide">
                      <Banknote className="w-4 h-4 text-emerald-600" />
                      <span>Actualización Manual de Tasas de Cambio del Sistema</span>
                    </h5>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Fije manualmente o consulte en vivo las tasas de conversión para cada divisa con respecto a $1.00 USD (Moneda Base).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleFetchLiveBCVRate}
                    disabled={isFetchingLiveBCV}
                    className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isFetchingLiveBCV ? 'animate-spin' : ''}`} />
                    <span>{isFetchingLiveBCV ? 'Consultando BCV...' : 'Consultar BCV Online (DolarAPI)'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* CARD 1: BOLÍVARES (VES / BCV) */}
                  <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">🇻🇪</span>
                          <span className="text-xs font-black text-gray-900">Bolívar Venezolano (VES)</span>
                        </div>
                        <span className="text-[10px] font-black px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md font-mono">
                          Bs. {(currencyRates.VES || 45.5).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 font-medium">
                        Tasa Oficial BCV utilizada en comprobantes, ventas flash y pedidos digitales.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-gray-600 uppercase">Tasa Manual (Bs. por 1 USD)</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-400 font-extrabold text-xs">Bs.</span>
                        </div>
                        <input
                          type="text"
                          value={manualRates.VES}
                          onChange={(e) => setManualRates(prev => ({ ...prev, VES: e.target.value }))}
                          placeholder="Ej: 45.50"
                          className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold font-mono focus:ring-2 focus:ring-[#005da9] focus:outline-hidden"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSaveManualRate('VES')}
                          disabled={rateSavingStatus.VES?.loading}
                          className="flex-1 py-2 px-3 bg-[#005da9] hover:bg-[#004a87] text-white text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                        >
                          {rateSavingStatus.VES?.loading ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          <span>Guardar Tasa</span>
                        </button>
                      </div>

                      {rateSavingStatus.VES?.message && (
                        <div className={`p-2 text-[10px] font-bold rounded-lg ${
                          rateSavingStatus.VES.message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                          {rateSavingStatus.VES.message.text}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CARD 2: EURO (EUR) */}
                  <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">🇪🇺</span>
                          <span className="text-xs font-black text-gray-900">Euro (EUR)</span>
                        </div>
                        <span className="text-[10px] font-black px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md font-mono">
                          € {(currencyRates.EUR || 0.92).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 font-medium">
                        Tasa de conversión para transacciones y pagos en Euros.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-gray-600 uppercase">Tasa Manual (€ por 1 USD)</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-400 font-extrabold text-xs">€</span>
                        </div>
                        <input
                          type="text"
                          value={manualRates.EUR}
                          onChange={(e) => setManualRates(prev => ({ ...prev, EUR: e.target.value }))}
                          placeholder="Ej: 0.92"
                          className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold font-mono focus:ring-2 focus:ring-[#005da9] focus:outline-hidden"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSaveManualRate('EUR')}
                          disabled={rateSavingStatus.EUR?.loading}
                          className="flex-1 py-2 px-3 bg-[#005da9] hover:bg-[#004a87] text-white text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                        >
                          {rateSavingStatus.EUR?.loading ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          <span>Guardar Tasa</span>
                        </button>
                      </div>

                      {rateSavingStatus.EUR?.message && (
                        <div className={`p-2 text-[10px] font-bold rounded-lg ${
                          rateSavingStatus.EUR.message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                          {rateSavingStatus.EUR.message.text}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CARD 3: PESO COLOMBIANO (COP) */}
                  <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">🇨🇴</span>
                          <span className="text-xs font-black text-gray-900">Peso Colombiano (COP)</span>
                        </div>
                        <span className="text-[10px] font-black px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md font-mono">
                          COP$ {(currencyRates.COP || 4100).toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 font-medium">
                        Tasa de conversión para operaciones en Pesos Colombianos.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-gray-600 uppercase">Tasa Manual (COP por 1 USD)</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-400 font-extrabold text-[10px]">COP</span>
                        </div>
                        <input
                          type="text"
                          value={manualRates.COP}
                          onChange={(e) => setManualRates(prev => ({ ...prev, COP: e.target.value }))}
                          placeholder="Ej: 4100"
                          className="w-full pl-11 pr-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold font-mono focus:ring-2 focus:ring-[#005da9] focus:outline-hidden"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSaveManualRate('COP')}
                          disabled={rateSavingStatus.COP?.loading}
                          className="flex-1 py-2 px-3 bg-[#005da9] hover:bg-[#004a87] text-white text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                        >
                          {rateSavingStatus.COP?.loading ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          <span>Guardar Tasa</span>
                        </button>
                      </div>

                      {rateSavingStatus.COP?.message && (
                        <div className={`p-2 text-[10px] font-bold rounded-lg ${
                          rateSavingStatus.COP.message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                          {rateSavingStatus.COP.message.text}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* TABLA RESUMEN DE CONVERSIÓN EN TIEMPO REAL */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <span className="text-[11px] font-black text-gray-700 uppercase tracking-wide block mb-2">
                    Resumen de Equivalencias del Sistema (Base: 1.00 USD)
                  </span>
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="px-3 py-2">Moneda</th>
                          <th className="px-3 py-2">Código</th>
                          <th className="px-3 py-2">Símbolo</th>
                          <th className="px-3 py-2">Tasa / 1 USD</th>
                          <th className="px-3 py-2">Ejemplo ($50 USD)</th>
                          <th className="px-3 py-2 text-right">Rol</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        <tr>
                          <td className="px-3 py-2 font-bold text-gray-900 flex items-center gap-1.5">
                            <span>🇺🇸</span> Dólar Americano
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-gray-600">USD</td>
                          <td className="px-3 py-2 font-mono font-bold text-gray-900">$</td>
                          <td className="px-3 py-2 font-mono font-black text-gray-900">1.0000</td>
                          <td className="px-3 py-2 font-mono font-bold text-emerald-600">$ 50.00</td>
                          <td className="px-3 py-2 text-right">
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md font-bold text-[10px]">
                              Base Global
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-bold text-gray-900 flex items-center gap-1.5">
                            <span>🇻🇪</span> Bolívar Venezolano
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-gray-600">VES</td>
                          <td className="px-3 py-2 font-mono font-bold text-gray-900">Bs.</td>
                          <td className="px-3 py-2 font-mono font-black text-blue-600">
                            {(currencyRates.VES || 45.5).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-blue-700">
                            Bs. {(50 * (currencyRates.VES || 45.5)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-bold text-[10px]">
                              Oficial BCV
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-bold text-gray-900 flex items-center gap-1.5">
                            <span>🇪🇺</span> Euro
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-gray-600">EUR</td>
                          <td className="px-3 py-2 font-mono font-bold text-gray-900">€</td>
                          <td className="px-3 py-2 font-mono font-black text-indigo-600">
                            {(currencyRates.EUR || 0.92).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-indigo-700">
                            {(50 * (currencyRates.EUR || 0.92)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md font-bold text-[10px]">
                              Divisa
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-bold text-gray-900 flex items-center gap-1.5">
                            <span>🇨🇴</span> Peso Colombiano
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-gray-600">COP</td>
                          <td className="px-3 py-2 font-mono font-bold text-gray-900">COP$</td>
                          <td className="px-3 py-2 font-mono font-black text-amber-600">
                            {(currencyRates.COP || 4100).toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-amber-700">
                            COP$ {(50 * (currencyRates.COP || 4100)).toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md font-bold text-[10px]">
                              Divisa
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* TAXES MANAGEMENT */}
              <div className="space-y-4">
                <span className="text-xs font-black text-gray-800 uppercase block">Gestión de Impuestos Vigentes</span>
                
                {taxMessage && (
                  <div className={`p-3 text-xs font-bold rounded-lg flex items-center gap-2 ${
                    taxMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                  }`}>
                    <span>{taxMessage.text}</span>
                  </div>
                )}

                <form onSubmit={handleAddTax} className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                  <input
                    type="text"
                    placeholder="Nombre del Impuesto (ej: IVA Reducido)"
                    value={newTaxName}
                    onChange={(e) => setNewTaxName(e.target.value)}
                    className="p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-bold"
                  />
                  <input
                    type="text"
                    placeholder="Porcentaje (ej: 8)"
                    value={newTaxRate}
                    onChange={(e) => setNewTaxRate(e.target.value)}
                    className="p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-bold"
                  />
                  <button
                    type="submit"
                    className="bg-[#005da9] hover:bg-[#004a87] text-white rounded-lg text-xs font-black cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar Impuesto</span>
                  </button>
                </form>

                <div className="border border-gray-150 rounded-2xl overflow-hidden bg-white shadow-3xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-150 text-[10px] font-black uppercase text-gray-400">
                        <th className="px-4 py-2.5">Impuesto</th>
                        <th className="px-4 py-2.5 text-center">Porcentaje (%)</th>
                        <th className="px-4 py-2.5 text-center">Estado</th>
                        <th className="px-4 py-2.5 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {adminTaxes.map(tax => (
                        <tr key={tax.id}>
                          <td className="px-4 py-3 font-bold text-gray-800">{tax.name}</td>
                          <td className="px-4 py-3 text-center font-mono font-bold">{tax.rate}%</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                              tax.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'
                            }`}>
                              {tax.is_active ? 'Vigente' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleToggleTax(tax)}
                              className={`text-xs font-bold ${
                                tax.is_active ? 'text-gray-400 hover:text-gray-600' : 'text-[#005da9] hover:text-[#004a87]'
                              } cursor-pointer`}
                            >
                              {tax.is_active ? 'Desactivar' : 'Habilitar'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 💳 GESTIÓN DE MÉTODOS DE PAGO */}
              <div className="space-y-4 pt-4 border-t border-gray-150">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-black text-gray-800 uppercase flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-[#005da9]" />
                      <span>Configuración de Métodos de Pago</span>
                    </span>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Incorpore, modifique datos bancarios/instrucciones, active o desactive pasarelas y formas de cobro.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenAddPaymentMethod}
                    className="px-4 py-2 bg-[#005da9] hover:bg-[#004a87] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Incorporar Método</span>
                  </button>
                </div>

                {paymentMethodMsg && (
                  <div className={`p-3 text-xs font-bold rounded-xl flex items-center gap-2 ${
                    paymentMethodMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}>
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{paymentMethodMsg.text}</span>
                  </div>
                )}

                <div className="border border-gray-150 rounded-2xl overflow-hidden bg-white shadow-3xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-150 text-[10px] font-black uppercase text-gray-400">
                        <th className="px-4 py-2.5">Método / Canal</th>
                        <th className="px-3 py-2.5 text-center">Tipo</th>
                        <th className="px-3 py-2.5 text-center">Moneda</th>
                        <th className="px-3 py-2.5 text-center">Canales</th>
                        <th className="px-3 py-2.5 text-center">Estado</th>
                        <th className="px-4 py-2.5 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {loadingPaymentMethods ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-400 font-bold">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1 text-[#005da9]" />
                            Cargando métodos de pago...
                          </td>
                        </tr>
                      ) : paymentMethodsList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-400 font-medium">
                            No hay métodos de pago configurados. Haga clic en "Incorporar Método" para agregar uno.
                          </td>
                        </tr>
                      ) : (
                        paymentMethodsList.map(pm => (
                          <tr key={pm.id} className="hover:bg-gray-50/60 transition">
                            <td className="px-4 py-3">
                              <div className="font-bold text-gray-900 flex items-center gap-1.5">
                                {pm.type === 'movil' && <Smartphone className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                                {pm.type === 'efectivo' && <Banknote className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                                {pm.type === 'transferencia' && <Landmark className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                                {pm.type === 'punto' && <CreditCard className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                                {pm.type === 'digital' && <QrCode className="w-3.5 h-3.5 text-purple-600 shrink-0" />}
                                <span>{pm.name}</span>
                              </div>
                              {pm.account_details && (
                                <div className="text-[11px] text-gray-500 font-mono mt-0.5 truncate max-w-xs">
                                  {pm.account_details}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-gray-100 text-gray-600">
                                {pm.type}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                pm.currency === 'USD' ? 'bg-emerald-50 text-emerald-700' :
                                pm.currency === 'VES' ? 'bg-blue-50 text-blue-700' :
                                'bg-amber-50 text-amber-700'
                              }`}>
                                {pm.currency}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {pm.allow_pos && (
                                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[9px] font-bold" title="Habilitado en Caja / POS">
                                    POS
                                  </span>
                                )}
                                {pm.allow_online && (
                                  <span className="px-1.5 py-0.5 bg-sky-100 text-sky-700 rounded text-[9px] font-bold" title="Habilitado en Tienda Online">
                                    WEB
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                                pm.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-400 border border-gray-200'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${pm.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></span>
                                {pm.is_active ? 'Activo' : 'Desactivado'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleTogglePaymentMethod(pm)}
                                  className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition cursor-pointer ${
                                    pm.is_active 
                                      ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' 
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  }`}
                                  title={pm.is_active ? 'Desactivar método' : 'Activar método'}
                                >
                                  {pm.is_active ? 'Desactivar' : 'Activar'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditPaymentMethod(pm)}
                                  className="p-1.5 text-gray-500 hover:text-[#005da9] hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                  title="Modificar Método de Pago"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPaymentMethodToDelete(pm)}
                                  className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="Eliminar Método de Pago"
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

              {/* SERIES & CORRELATIVES */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-gray-100">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Próximo Núm. Factura</label>
                  <input
                    type="number"
                    value={facturacionCorrelativoFactura}
                    onChange={(e) => setFacturacionCorrelativoFactura(parseInt(e.target.value) || 0)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Próximo Núm. Cotización</label>
                  <input
                    type="number"
                    value={facturacionCorrelativoCotizacion}
                    onChange={(e) => setFacturacionCorrelativoCotizacion(parseInt(e.target.value) || 0)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Próximo Núm. Ticket Venta</label>
                  <input
                    type="number"
                    value={facturacionCorrelativoTicket}
                    onChange={(e) => setFacturacionCorrelativoTicket(parseInt(e.target.value) || 0)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: INVENTARIO */}
          {configSubTab === 'inventario' && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 pb-3">
                <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider">📦 Control de Stock y Catálogo Virtual</h4>
                <p className="text-xs text-gray-400">Personalice los umbrales de reabastecimiento, bloquee de ventas sin stock y edite la vitrina digital externa.</p>
              </div>

              {/* PARAMETERS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Alerta de Inventario Crítico (Umbral)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={inventarioLowStockThreshold}
                      onChange={(e) => setInventarioLowStockThreshold(parseInt(e.target.value) || 0)}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
                    />
                    <span className="absolute right-3 top-3 text-[10px] text-gray-400 font-extrabold">Unidades</span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-gray-800 block">Bloquear Venta sin Stock</span>
                    <p className="text-[10px] text-gray-400 font-medium">Impide añadir artículos al carrito si su saldo disponible es menor o igual a cero.</p>
                  </div>
                  <button
                    onClick={() => setInventarioBlockNoStockSale(!inventarioBlockNoStockSale)}
                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      inventarioBlockNoStockSale ? 'bg-[#005da9]' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-3xs ring-0 transition duration-200 ease-in-out ${
                      inventarioBlockNoStockSale ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>

              {/* ADVERTISING MODULE INTEGRATION */}
              <div className="pt-4 border-t border-gray-100 space-y-4">
                <h5 className="text-xs font-extrabold text-gray-800 uppercase flex items-center gap-1.5">
                  <Megaphone className="w-4 h-4 text-[#FF9900]" />
                  <span>Vitrinas de Publicidad (Landing & Banners)</span>
                </h5>

                <div className="flex gap-2 p-1.5 bg-gray-100 rounded-xl border border-gray-200">
                  <button
                    onClick={() => setAdSubTab('landing')}
                    className={`flex-1 py-2 text-center text-xs font-black rounded-lg transition ${
                      adSubTab === 'landing' ? 'bg-[#005da9] text-white' : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Editar Landing Page
                  </button>
                  <button
                    onClick={() => setAdSubTab('banner')}
                    className={`flex-1 py-2 text-center text-xs font-black rounded-lg transition ${
                      adSubTab === 'banner' ? 'bg-[#005da9] text-white' : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Banners Principales
                  </button>
                </div>

                {adSaveSuccessMsg && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-200">
                    {adSaveSuccessMsg}
                  </div>
                )}

                {adSubTab === 'landing' && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Título Promocional</label>
                      <input
                        type="text"
                        value={landingConfigState.title}
                        onChange={(e) => setLandingConfigState({ ...landingConfigState, title: e.target.value })}
                        className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Subtítulo / Mensaje descriptivo</label>
                      <textarea
                        rows={2}
                        value={landingConfigState.subtitle}
                        onChange={(e) => setLandingConfigState({ ...landingConfigState, subtitle: e.target.value })}
                        className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-800"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={handleSaveLandingConfig}
                        className="px-4 py-2 bg-[#005da9] hover:bg-[#004a87] text-white text-xs font-black rounded-lg transition"
                      >
                        Sincronizar Landing
                      </button>
                    </div>
                  </div>
                )}

                {adSubTab === 'banner' && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-gray-500 block">Listado de Pantallas Cargadas:</span>
                    <div className="divide-y divide-gray-100 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-3xs">
                      {bannerSlidesList.map((slide, idx) => (
                        <div key={slide.id || idx} className="p-3 flex items-center justify-between gap-4 hover:bg-gray-50/50">
                          <div className="flex items-center gap-3">
                            <img src={slide.image_url} className="w-12 h-10 object-cover rounded-lg border" referrerPolicy="no-referrer" />
                            <div>
                              <span className="text-xs font-black text-gray-800">{slide.title}</span>
                              <p className="text-[10px] text-gray-400 font-medium">{slide.subtitle}</p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-gray-400">Orden {slide.sort_order}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: IMPRESIÓN */}
          {configSubTab === 'impresion' && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 pb-3">
                <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider">🖨️ Impresión, Tickets y Periféricos</h4>
                <p className="text-xs text-gray-400">Defina el formato por defecto de los comprobantes y administre las impresoras de tickets conectadas.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Formato de Comprobante por Defecto</label>
                  <select
                    value={impresionTicketFormat}
                    onChange={(e) => setImpresionTicketFormat(e.target.value as any)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-[#005da9]"
                  >
                    <option value="58mm">Ticket Térmico (58mm - Compacto)</option>
                    <option value="80mm">Ticket Térmico (80mm - Estándar)</option>
                    <option value="carta">Documento Carta (Para cotizaciones)</option>
                    <option value="pdf">Descargar PDF Automatizado</option>
                  </select>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-gray-800 block">Disparo de Cajón Monedero</span>
                    <p className="text-[10px] text-gray-400 font-medium">Envía la señal de apertura de gaveta automáticamente al imprimir comprobante.</p>
                  </div>
                  <button
                    onClick={() => setImpresionTriggerDrawer(!impresionTriggerDrawer)}
                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      impresionTriggerDrawer ? 'bg-[#005da9]' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-3xs ring-0 transition duration-200 ease-in-out ${
                      impresionTriggerDrawer ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Mensaje de Encabezado / Bienvenida</label>
                  <input
                    type="text"
                    value={impresionGreeting}
                    onChange={(e) => setImpresionGreeting(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-[#005da9]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Garantía / Términos de Compra (Pie)</label>
                  <input
                    type="text"
                    value={impresionWarranty}
                    onChange={(e) => setImpresionWarranty(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-[#005da9]"
                  />
                </div>
              </div>

              {/* PRINTER SCANNER */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                    <Printer className="w-4 h-4 text-slate-600" />
                    <span>Hardware e Impresoras Térmicas</span>
                  </span>
                  <button
                    onClick={handleScanPrinters}
                    disabled={isScanningPrinters}
                    className="px-3 py-1 bg-[#005da9] hover:bg-[#004a87] disabled:bg-gray-300 text-white text-[10px] font-black rounded-lg transition"
                  >
                    {isScanningPrinters ? 'Buscando puertos...' : 'Buscar Impresoras'}
                  </button>
                </div>

                {discoveredPrinters.length > 0 ? (
                  <div className="space-y-1.5">
                    {discoveredPrinters.map((printer, idx) => (
                      <div key={idx} className="p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-extrabold text-gray-700 flex items-center justify-between">
                        <span>{printer}</span>
                        <span className="bg-emerald-50 text-emerald-700 text-[9px] px-2 py-0.5 rounded-full border border-emerald-200">Sincronizada</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-400 font-medium">Haga clic en "Buscar Impresoras" para escanear dispositivos térmicos USB, LAN o Bluetooth en la red local.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: DASHBOARD */}
          {configSubTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-[#005da9]" />
                    <span>Formulario Panel de Gráficas ("Tu Gestión")</span>
                  </h4>
                  <p className="text-xs text-gray-400">
                    Arrastre y reordene los módulos para estructurar el panel a su gusto. Active o desactive qué estadísticas visualizar en el informe financiero.
                  </p>
                </div>
                <span className="text-[10px] bg-blue-50 border border-blue-200 text-[#005da9] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider self-start md:self-auto">
                  Modo Personalización
                </span>
              </div>

              {reportConfigSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold">{reportConfigSuccessMsg}</span>
                </div>
              )}

              {loadingReportConfigs ? (
                <div className="space-y-3 py-4">
                  <div className="h-12 bg-gray-100 rounded-xl animate-pulse"></div>
                  <div className="h-12 bg-gray-100 rounded-xl animate-pulse"></div>
                  <div className="h-12 bg-gray-100 rounded-xl animate-pulse"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* SECCIÓN 1: GRÁFICAS PRINCIPALES */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-black uppercase text-gray-500 tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span>1. Gráficas Principales</span>
                      </h5>
                      <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 font-extrabold px-2.5 py-0.5 rounded uppercase">
                        Layout: 2 Columnas
                      </span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-2.5 space-y-2">
                      {reportConfigs.filter(c => c.section === 'graficas').map((item) => {
                        const globalIdx = reportConfigs.findIndex(r => r.id === item.id);
                        return (
                          <div 
                            key={item.id}
                            draggable
                            onDragStart={(e) => handleDragStartConfig(e, globalIdx)}
                            onDragOver={(e) => handleDragOverConfig(e, globalIdx)}
                            onDragEnd={handleDragEndConfig}
                            className={`flex items-center justify-between p-3 border rounded-xl transition-all ${
                              item.enabled 
                                ? 'border-emerald-500/50 bg-white shadow-3xs' 
                                : 'border-gray-200 bg-gray-50/50 opacity-70'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex items-center gap-1">
                                <div className="cursor-grab text-gray-400 p-1 hover:text-gray-600 shrink-0" title="Arrastrar para reordenar">
                                  <GripVertical className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <button 
                                    type="button"
                                    onClick={() => moveReportItem(globalIdx, 'up')}
                                    disabled={globalIdx === 0}
                                    className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30 cursor-pointer"
                                  >
                                    <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => moveReportItem(globalIdx, 'down')}
                                    disabled={globalIdx === reportConfigs.length - 1}
                                    className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30 cursor-pointer"
                                  >
                                    <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                                  </button>
                                </div>
                              </div>

                              <div className="min-w-0">
                                <h6 className="text-xs font-black text-gray-800 leading-tight">{item.title}</h6>
                                <p className="text-[10px] text-gray-400 font-medium truncate">{item.description}</p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => toggleReportItemActive(item.id)}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                item.enabled ? 'bg-emerald-600' : 'bg-gray-300'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                  item.enabled ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* SECCIÓN 2: COMPARATIVOS Y LISTADOS */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-black uppercase text-gray-500 tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                        <span>2. Comparativos y Listados</span>
                      </h5>
                      <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-extrabold px-2.5 py-0.5 rounded uppercase">
                        Layout: 3 Columnas
                      </span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-2.5 space-y-2">
                      {reportConfigs.filter(c => c.section === 'comparativos').map((item) => {
                        const globalIdx = reportConfigs.findIndex(r => r.id === item.id);
                        return (
                          <div 
                            key={item.id}
                            draggable
                            onDragStart={(e) => handleDragStartConfig(e, globalIdx)}
                            onDragOver={(e) => handleDragOverConfig(e, globalIdx)}
                            onDragEnd={handleDragEndConfig}
                            className={`flex items-center justify-between p-3 border rounded-xl transition-all ${
                              item.enabled 
                                ? 'border-emerald-500/50 bg-white shadow-3xs' 
                                : 'border-gray-200 bg-gray-50/50 opacity-70'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex items-center gap-1">
                                <div className="cursor-grab text-gray-400 p-1 hover:text-gray-600 shrink-0" title="Arrastrar para reordenar">
                                  <GripVertical className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <button 
                                    type="button"
                                    onClick={() => moveReportItem(globalIdx, 'up')}
                                    disabled={globalIdx === 0}
                                    className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30 cursor-pointer"
                                  >
                                    <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => moveReportItem(globalIdx, 'down')}
                                    disabled={globalIdx === reportConfigs.length - 1}
                                    className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30 cursor-pointer"
                                  >
                                    <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                                  </button>
                                </div>
                              </div>

                              <div className="min-w-0">
                                <h6 className="text-xs font-black text-gray-800 leading-tight">{item.title}</h6>
                                <p className="text-[10px] text-gray-400 font-medium truncate">{item.description}</p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => toggleReportItemActive(item.id)}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                item.enabled ? 'bg-emerald-600' : 'bg-gray-300'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                  item.enabled ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* SECCIÓN 3: DETALLE DE GASTOS */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-black uppercase text-gray-500 tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        <span>3. Detalle de Gastos</span>
                      </h5>
                      <span className="text-[9px] bg-rose-50 text-rose-700 border border-rose-200 font-extrabold px-2.5 py-0.5 rounded uppercase">
                        Layout: Ancho Completo
                      </span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-2.5 space-y-2">
                      {reportConfigs.filter(c => c.section === 'detalle').map((item) => {
                        const globalIdx = reportConfigs.findIndex(r => r.id === item.id);
                        return (
                          <div 
                            key={item.id}
                            draggable
                            onDragStart={(e) => handleDragStartConfig(e, globalIdx)}
                            onDragOver={(e) => handleDragOverConfig(e, globalIdx)}
                            onDragEnd={handleDragEndConfig}
                            className={`flex items-center justify-between p-3 border rounded-xl transition-all ${
                              item.enabled 
                                ? 'border-emerald-500/50 bg-white shadow-3xs' 
                                : 'border-gray-200 bg-gray-50/50 opacity-70'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex items-center gap-1">
                                <div className="cursor-grab text-gray-400 p-1 hover:text-gray-600 shrink-0" title="Arrastrar para reordenar">
                                  <GripVertical className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <button 
                                    type="button"
                                    onClick={() => moveReportItem(globalIdx, 'up')}
                                    disabled={globalIdx === 0}
                                    className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30 cursor-pointer"
                                  >
                                    <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => moveReportItem(globalIdx, 'down')}
                                    disabled={globalIdx === reportConfigs.length - 1}
                                    className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30 cursor-pointer"
                                  >
                                    <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                                  </button>
                                </div>
                              </div>

                              <div className="min-w-0">
                                <h6 className="text-xs font-black text-gray-800 leading-tight">{item.title}</h6>
                                <p className="text-[10px] text-gray-400 font-medium truncate">{item.description}</p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => toggleReportItemActive(item.id)}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                item.enabled ? 'bg-emerald-600' : 'bg-gray-300'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                  item.enabled ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* MÁS OPCIONES: REPORTES AUTOMÁTICOS POR CORREO */}
                  <div className="p-4 bg-amber-50/50 border border-amber-200/80 rounded-2xl space-y-3">
                    <span className="text-xs font-black text-amber-900 uppercase tracking-wider block">
                      📬 Reportes de Cierre y Correo Automático
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">
                          Frecuencia de Envío por Correo
                        </label>
                        <select
                          value={dashboardEmailReports}
                          onChange={(e) => setDashboardEmailReports(e.target.value as any)}
                          className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold focus:outline-[#005da9]"
                        >
                          <option value="ninguno">No enviar reportes</option>
                          <option value="diario">Resumen Diario al Cierre</option>
                          <option value="semanal">Resumen Semanal los Domingos</option>
                          <option value="mensual">Resumen Mensual de Fin de Mes</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">
                          Correo Electrónico Destinatario
                        </label>
                        <input
                          type="email"
                          value={dashboardEmailReportsAddress}
                          onChange={(e) => setDashboardEmailReportsAddress(e.target.value)}
                          className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold focus:outline-[#005da9]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* BOTÓN DE GUARDAR ESPECÍFICO */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-150">
                    <span className="text-xs font-bold text-gray-400">
                      {reportConfigs.filter(r => r.enabled).length} de {reportConfigs.length} módulos activados
                    </span>

                    <button
                      type="button"
                      onClick={handleSaveReportConfigs}
                      disabled={savingReportConfigs}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {savingReportConfigs ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Guardando...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Guardar Configuración de Gráficas</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: NOTIFICACIONES */}
          {configSubTab === 'notificaciones' && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[#005da9]" />
                    <span>Alertas Visuales, Sonoras y Push</span>
                  </h4>
                  <p className="text-xs text-gray-400">
                    Controle los efectos de sonido y alertas acústicas al completar ventas o detectar bajo stock.
                  </p>
                </div>
                <span className="text-[10px] bg-sky-50 border border-sky-200 text-[#005da9] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider self-start md:self-auto">
                  Audio & Alertas POS
                </span>
              </div>

              <div className="space-y-4">
                {/* 1. SONIDO DE CAJA REGISTRADORA AL VENDER */}
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition hover:border-slate-300">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl shrink-0 mt-0.5">
                      <Volume2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-gray-900">
                          Sonido de Caja Registradora al Vender
                        </span>
                        <span className="bg-emerald-50 text-emerald-700 text-[9px] font-extrabold px-2 py-0.5 rounded-md border border-emerald-200">
                          Cha-Ching! 🔔
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                        Genera el timbre característico de caja registradora a través de los altavoces al completar una venta o cobro.
                      </p>

                      <button
                        type="button"
                        onClick={() => playCashRegisterSound()}
                        className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-[11px] font-extrabold rounded-xl transition shadow-3xs cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>🔊 Probar Sonido de Caja Registradora</span>
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !notifSoundOnSale;
                      setNotifSoundOnSale(nextVal);
                      if (nextVal) playCashRegisterSound();
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out self-end sm:self-center ${
                      notifSoundOnSale ? 'bg-[#005da9]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-3xs ring-0 transition duration-200 ease-in-out ${
                        notifSoundOnSale ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* 2. ALERTA CRÍTICA DE BAJO STOCK (BEEP) */}
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition hover:border-slate-300">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-gray-900">
                          Alerta Crítica de Bajo Stock (Beep)
                        </span>
                        <span className="bg-amber-50 text-amber-800 text-[9px] font-extrabold px-2 py-0.5 rounded-md border border-amber-200">
                          Aviso Acústico ⚠️
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                        Emite un tono acústico de advertencia (Beep) y notificación en pantalla cuando un artículo alcanza o baja del umbral crítico configurado.
                      </p>

                      <button
                        type="button"
                        onClick={() => playLowStockBeep()}
                        className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 text-amber-800 hover:bg-amber-50 text-[11px] font-extrabold rounded-xl transition shadow-3xs cursor-pointer"
                      >
                        <Bell className="w-3.5 h-3.5 text-amber-600" />
                        <span>🔔 Probar Alerta (Beep)</span>
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !notifPushLowStock;
                      setNotifPushLowStock(nextVal);
                      if (nextVal) playLowStockBeep();
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out self-end sm:self-center ${
                      notifPushLowStock ? 'bg-[#005da9]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-3xs ring-0 transition duration-200 ease-in-out ${
                        notifPushLowStock ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {configSubTab === 'planes_suscripcion' && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
                    <Coins className="w-4 h-4 text-emerald-600" />
                    <span>Planes de Suscripción</span>
                  </h4>
                  <p className="text-xs text-gray-400">Seleccione el plan que mejor se adapte a las necesidades operativas de su negocio.</p>
                </div>
                <div className="px-3 py-1 bg-sky-50 text-sky-700 text-[10px] font-black rounded-full uppercase tracking-wider">
                  SaaS Licenciamiento
                </div>
              </div>

              {/* BILLING CYCLE SELECTOR */}
              <div className="flex justify-center my-4">
                <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 w-full max-w-md">
                  <button
                    onClick={() => setBillingCycle('mensual')}
                    className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      billingCycle === 'mensual' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Mensual
                  </button>
                  <button
                    onClick={() => setBillingCycle('trimestral')}
                    className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      billingCycle === 'trimestral' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Trimestral</span>
                    <span className="bg-rose-100 text-rose-700 text-[9px] font-black px-1.5 py-0.5 rounded-md">-10%</span>
                  </button>
                  <button
                    onClick={() => setBillingCycle('anual')}
                    className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      billingCycle === 'anual' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Anual</span>
                    <span className="bg-rose-100 text-rose-700 text-[9px] font-black px-1.5 py-0.5 rounded-md">-25%</span>
                  </button>
                </div>
              </div>

              {/* PLANS CONTAINER */}
              <div className="space-y-4 max-w-3xl mx-auto">
                
                {/* 1. PLAN PRO */}
                <div 
                  onClick={() => setSelectedPlanId('pro')}
                  className={`p-4 border rounded-2xl cursor-pointer transition-all flex items-center justify-between gap-4 ${
                    selectedPlanId === 'pro' 
                      ? 'border-emerald-500 bg-emerald-50/20 shadow-sm' 
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      selectedPlanId === 'pro' ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                    }`}>
                      {selectedPlanId === 'pro' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-gray-900">Plan Pro</span>
                        <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                          <span>Recomendado</span>
                        </span>
                        <span className="bg-sky-100 text-sky-800 text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                          App + Web
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">Acceso a terminales ilimitados, sincronización web y backups continuos en la nube.</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="bg-sky-50 text-sky-700 text-xs font-black px-2.5 py-1 rounded-xl">
                      {billingCycle === 'mensual' && '$19.99 / mensual'}
                      {billingCycle === 'trimestral' && '$17.99 / mensual'}
                      {billingCycle === 'anual' && '$14.99 / mensual'}
                    </span>
                  </div>
                </div>

                {/* 2. PLAN BASICO */}
                <div 
                  onClick={() => setSelectedPlanId('basico')}
                  className={`p-4 border rounded-2xl cursor-pointer transition-all flex items-center justify-between gap-4 ${
                    selectedPlanId === 'basico' 
                      ? 'border-emerald-500 bg-emerald-50/20 shadow-sm' 
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      selectedPlanId === 'basico' ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                    }`}>
                      {selectedPlanId === 'basico' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-gray-900">Plan básico</span>
                        <span className="bg-teal-100 text-teal-800 text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                          App
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">Perfecto para una única sede de ventas local con respaldo estándar de inventario.</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="bg-sky-50 text-sky-700 text-xs font-black px-2.5 py-1 rounded-xl">
                      {billingCycle === 'mensual' && '$9.99 / mensual'}
                      {billingCycle === 'trimestral' && '$8.99 / mensual'}
                      {billingCycle === 'anual' && '$7.49 / mensual'}
                    </span>
                  </div>
                </div>

                {/* 3. PLAN GRATUITO */}
                <div 
                  onClick={() => setSelectedPlanId('gratuito')}
                  className={`p-4 border rounded-2xl cursor-pointer transition-all flex items-center justify-between gap-4 ${
                    selectedPlanId === 'gratuito' 
                      ? 'border-emerald-500 bg-emerald-50/20 shadow-sm' 
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      selectedPlanId === 'gratuito' ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                    }`}>
                      {selectedPlanId === 'gratuito' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-gray-900">Plan Free / Demostración</span>
                        <span className="bg-gray-100 text-gray-600 text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                          Prueba local
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">Ideal para probar la aplicación offline con catálogo y reportes simplificados.</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="bg-slate-100 text-slate-700 text-xs font-black px-2.5 py-1 rounded-xl">
                      $0.00 / mensual
                    </span>
                  </div>
                </div>

              </div>

              {/* ACTION BUTTON IN THE FORM OF FOOTER INDICATOR */}
              <div className="mt-8 pt-4 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => {
                    setBusinessSaaSPlan(selectedPlanId as any);
                    setTimeout(() => {
                      handleSaveAll();
                    }, 50);
                  }}
                  className="w-full max-w-sm px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl flex items-center justify-between shadow-lg hover:shadow-xl transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="bg-slate-800 text-slate-300 w-6 h-6 rounded-lg text-[11px] font-bold flex items-center justify-center">
                      {selectedPlanId === 'pro' ? '2' : selectedPlanId === 'basico' ? '1' : '0'}
                    </span>
                    <span>Actualizar plan</span>
                  </div>
                  <span className="font-extrabold text-sm flex items-center gap-1 text-emerald-400">
                    {selectedPlanId === 'pro' && (billingCycle === 'mensual' ? '$19.99' : billingCycle === 'trimestral' ? '$17.99' : '$14.99')}
                    {selectedPlanId === 'basico' && (billingCycle === 'mensual' ? '$9.99' : billingCycle === 'trimestral' ? '$8.99' : '$7.49')}
                    {selectedPlanId === 'gratuito' && '$0.00'}
                    <span>&nbsp;›</span>
                  </span>
                </button>
              </div>

              {/* PLAN SUMMARY CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="p-4 bg-slate-50 rounded-2xl border border-gray-100 space-y-2">
                  <div className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                    <span>Beneficios Free</span>
                  </div>
                  <ul className="text-[10px] text-gray-500 space-y-1 text-left list-disc list-inside">
                    <li>1 Terminal de venta</li>
                    <li>Hasta 50 productos</li>
                    <li>Soporte comunitario</li>
                    <li>Reportes simplificados</li>
                  </ul>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-gray-100 space-y-2">
                  <div className="text-xs font-bold text-teal-800 flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-teal-500" />
                    <span>Beneficios Básico</span>
                  </div>
                  <ul className="text-[10px] text-gray-500 space-y-1 text-left list-disc list-inside">
                    <li>Hasta 2 Terminales</li>
                    <li>Hasta 1,000 productos</li>
                    <li>Soporte WhatsApp</li>
                    <li>Respaldo diario nube</li>
                  </ul>
                </div>
                <div className="p-4 bg-sky-50/40 rounded-2xl border border-sky-100/50 space-y-2">
                  <div className="text-xs font-bold text-sky-800 flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                    <span>Beneficios Pro</span>
                  </div>
                  <ul className="text-[10px] text-gray-500 space-y-1 text-left list-disc list-inside">
                    <li>Terminales ILIMITADOS</li>
                    <li>Productos ILIMITADOS</li>
                    <li>E-Commerce Integrado</li>
                    <li>Ejecutivo dedicado 24/7</li>
                  </ul>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* 📍 MODAL: CREAR / EDITAR SEDE */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 text-left">
          <div className="bg-white rounded-3xl border border-gray-200 w-full max-w-lg p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h4 className="text-sm font-black text-gray-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#005da9]" />
                <span>{editingBranch?.id && editingBranch.id.length > 5 ? 'Editar Sede / Sucursal' : 'Nueva Sede / Sucursal'}</span>
              </h4>
              <button
                onClick={() => {
                  setShowBranchModal(false);
                  setEditingBranch(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Código*</label>
                  <input
                    type="text"
                    value={editingBranch?.code || ''}
                    onChange={(e) => setEditingBranch({ ...editingBranch, code: e.target.value })}
                    placeholder="SP-01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl font-mono uppercase font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Nombre de la Sede*</label>
                  <input
                    type="text"
                    value={editingBranch?.name || ''}
                    onChange={(e) => setEditingBranch({ ...editingBranch, name: e.target.value })}
                    placeholder="Sede Principal Bella Vista"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Dirección Física</label>
                <input
                  type="text"
                  value={editingBranch?.address || ''}
                  onChange={(e) => setEditingBranch({ ...editingBranch, address: e.target.value })}
                  placeholder="Calle 72 con Av. Bella Vista"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Teléfono / Celular de Contacto</label>
                <input
                  type="text"
                  value={editingBranch?.phone || ''}
                  onChange={(e) => setEditingBranch({ ...editingBranch, phone: e.target.value })}
                  placeholder="+58 412-5043857"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <span className="font-bold text-gray-800 block text-xs">Estado de la Sede</span>
                  <span className="text-[10px] text-gray-500">Permite realizar cobros y asociar terminales activos</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingBranch({ ...editingBranch, active: !(editingBranch?.active ?? true) })}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                    (editingBranch?.active ?? true)
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-gray-300 text-gray-700'
                  }`}
                >
                  {(editingBranch?.active ?? true) ? 'Habilitada' : 'Inactiva'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setShowBranchModal(false);
                  setEditingBranch(null);
                }}
                className="px-4 py-2 bg-gray-150 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (editingBranch) handleSaveBranch(editingBranch);
                }}
                className="px-5 py-2 bg-[#005da9] hover:bg-[#004a87] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Sede</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 💻 MODAL: GESTIONAR CAJAS / TERMINALES DE UNA SEDE */}
      {showTerminalModal && selectedBranchForTerminals && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 text-left">
          <div className="bg-white rounded-3xl border border-gray-200 w-full max-w-xl p-6 shadow-2xl relative space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h4 className="text-sm font-black text-gray-900 flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-[#005da9]" />
                  <span>Terminales y Cajas: {selectedBranchForTerminals.name}</span>
                </h4>
                <p className="text-xs text-gray-400 font-mono">Código Sede: {selectedBranchForTerminals.code}</p>
              </div>
              <button
                onClick={() => {
                  setShowTerminalModal(false);
                  setSelectedBranchForTerminals(null);
                  setEditingTerminal(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario para Crear / Editar Caja */}
            <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl space-y-3">
              <span className="text-xs font-black text-[#005da9] block">
                {editingTerminal?.id ? 'Modificar Terminal / Caja' : '+ Agregar Nueva Terminal a esta Sede'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-700 mb-1">Código*</label>
                  <input
                    type="text"
                    value={editingTerminal?.code || ''}
                    onChange={(e) => setEditingTerminal({ ...(editingTerminal || {}), code: e.target.value, branch_id: selectedBranchForTerminals.id })}
                    placeholder="C1"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-mono uppercase font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-gray-700 mb-1">Nombre descriptivo*</label>
                  <input
                    type="text"
                    value={editingTerminal?.name || ''}
                    onChange={(e) => setEditingTerminal({ ...(editingTerminal || {}), name: e.target.value, branch_id: selectedBranchForTerminals.id })}
                    placeholder="Caja Principal #1 (Mostrador)"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                {editingTerminal && (
                  <button
                    type="button"
                    onClick={() => setEditingTerminal(null)}
                    className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 font-bold"
                  >
                    Cancelar edición
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (editingTerminal) {
                      handleSaveTerminal({
                        ...editingTerminal,
                        branch_id: selectedBranchForTerminals.id
                      });
                    } else {
                      alert('Por favor ingrese los datos de la terminal.');
                    }
                  }}
                  className="px-4 py-2 bg-[#005da9] hover:bg-[#004a87] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{editingTerminal?.id ? 'Guardar Cambios' : 'Registrar Caja'}</span>
                </button>
              </div>
            </div>

            {/* Listado de Cajas existentes de esta sede */}
            <div className="space-y-2">
              <span className="text-xs font-black text-gray-800 uppercase block">Cajas registradas en esta sede</span>
              {businessCajas.filter(c => c.branch_id === selectedBranchForTerminals.id).length === 0 ? (
                <div className="p-6 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-250 text-gray-400 text-xs">
                  No hay cajas registradas para esta sede. Utiliza el formulario superior para crear la primera.
                </div>
              ) : (
                <div className="border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100 bg-white">
                  {businessCajas
                    .filter(c => c.branch_id === selectedBranchForTerminals.id)
                    .map(terminal => (
                      <div key={terminal.id} className="p-3 flex items-center justify-between hover:bg-gray-50/80 transition">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-mono font-bold text-xs text-slate-700">
                            {terminal.code}
                          </div>
                          <div>
                            <h6 className="text-xs font-bold text-gray-900">{terminal.name}</h6>
                            <span className={`text-[10px] font-bold ${terminal.active ? 'text-emerald-600' : 'text-gray-400'}`}>
                              {terminal.active ? '● Activa y en servicio' : '○ Inactiva'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveTerminal({ ...terminal, active: !terminal.active })}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                              terminal.active 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                                : 'bg-gray-100 text-gray-600 border-gray-250 hover:bg-gray-200'
                            }`}
                          >
                            {terminal.active ? 'Desactivar' : 'Activar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTerminal(terminal)}
                            className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                            title="Editar Caja"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setTerminalToDelete(terminal)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Eliminar Caja"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowTerminalModal(false);
                  setSelectedBranchForTerminals(null);
                  setEditingTerminal(null);
                }}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ MODAL CONFIRMACIÓN: ELIMINAR SEDE */}
      {branchToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 text-left">
          <div className="bg-white rounded-3xl border border-rose-150 w-full max-w-md p-6 shadow-2xl relative space-y-4 animate-scaleUp">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-gray-900">¿Eliminar Sede?</h4>
                <p className="text-xs text-gray-500 font-medium">Esta acción eliminará la sede y sus terminales asociadas en Supabase.</p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-1 text-xs">
              <p className="font-bold text-rose-900">
                {branchToDelete.name} ({branchToDelete.code})
              </p>
              {branchToDelete.address && (
                <p className="text-[11px] text-rose-700">{branchToDelete.address}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingBranch}
                onClick={() => setBranchToDelete(null)}
                className="px-4 py-2.5 bg-gray-150 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingBranch}
                onClick={confirmDeleteBranch}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingBranch ? 'Eliminando...' : 'Sí, Eliminar Sede'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ MODAL CONFIRMACIÓN: ELIMINAR TERMINAL / CAJA */}
      {terminalToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 text-left">
          <div className="bg-white rounded-3xl border border-rose-150 w-full max-w-md p-6 shadow-2xl relative space-y-4 animate-scaleUp">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-gray-900">¿Eliminar Terminal / Caja?</h4>
                <p className="text-xs text-gray-500 font-medium">Esta acción eliminará el punto de venta de la base de datos.</p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-1 text-xs">
              <p className="font-bold text-rose-900">
                {terminalToDelete.name} ({terminalToDelete.code})
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingTerminal}
                onClick={() => setTerminalToDelete(null)}
                className="px-4 py-2.5 bg-gray-150 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingTerminal}
                onClick={confirmDeleteTerminal}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingTerminal ? 'Eliminando...' : 'Sí, Eliminar Caja'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 💳 MODAL: INCORPORAR / MODIFICAR MÉTODO DE PAGO */}
      {showPaymentMethodModal && editingPaymentMethod && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 text-left">
          <div className="bg-white rounded-3xl border border-gray-150 w-full max-w-xl p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto animate-scaleUp">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#005da9] flex items-center justify-center font-black">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-gray-900">
                    {editingPaymentMethod.id ? 'Modificar Método de Pago' : 'Incorporar Nuevo Método de Pago'}
                  </h4>
                  <p className="text-[11px] text-gray-500">Configure los datos, moneda y condiciones de pago para los clientes y cajeros.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPaymentMethodModal(false);
                  setEditingPaymentMethod(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePaymentMethod} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Nombre del Método *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Pago Móvil C2P, Banesco Panamá, etc."
                    value={editingPaymentMethod.name || ''}
                    onChange={(e) => setEditingPaymentMethod({ ...editingPaymentMethod, name: e.target.value })}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:bg-white focus:border-[#005da9] transition outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Código Identificador</label>
                  <input
                    type="text"
                    placeholder="Ej: PAGOMOVIL_01, ZELLE_02"
                    value={editingPaymentMethod.code || ''}
                    onChange={(e) => setEditingPaymentMethod({ ...editingPaymentMethod, code: e.target.value.toUpperCase() })}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:bg-white focus:border-[#005da9] transition outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Tipo de Canal</label>
                  <select
                    value={editingPaymentMethod.type || 'otro'}
                    onChange={(e) => setEditingPaymentMethod({ ...editingPaymentMethod, type: e.target.value as any })}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:bg-white focus:border-[#005da9] transition outline-none"
                  >
                    <option value="movil">Pago Móvil (Interbancario)</option>
                    <option value="efectivo">Efectivo (Físico en Caja)</option>
                    <option value="transferencia">Transferencia Bancaria</option>
                    <option value="punto">Punto de Venta / POS (Tarjeta)</option>
                    <option value="digital">Billetera Digital / Cripto / Zelle</option>
                    <option value="otro">Otro Método</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Moneda de Recepción</label>
                  <select
                    value={editingPaymentMethod.currency || 'VES'}
                    onChange={(e) => setEditingPaymentMethod({ ...editingPaymentMethod, currency: e.target.value as any })}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:bg-white focus:border-[#005da9] transition outline-none"
                  >
                    <option value="VES">Bolívares (Bs. / VES)</option>
                    <option value="USD">Dólares (USD $)</option>
                    <option value="EUR">Euros (€ / EUR)</option>
                    <option value="COP">Pesos Colombianos (COP)</option>
                    <option value="MULTIMONEDA">Multimoneda (Acepta Varias)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Datos Bancarios / Cuenta / Cédula / Teléfono</label>
                <textarea
                  rows={2}
                  placeholder="Ej: Banesco 0134-xxxx | CI: V-12345678 | Tlf: 0412-1234567 | Titular: Papelería Bella Vista"
                  value={editingPaymentMethod.account_details || ''}
                  onChange={(e) => setEditingPaymentMethod({ ...editingPaymentMethod, account_details: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:bg-white focus:border-[#005da9] transition outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Instrucciones para el Cliente o Cajero</label>
                <input
                  type="text"
                  placeholder="Ej: Adjuntar captura o indicar número de comprobante de 6 dígitos."
                  value={editingPaymentMethod.instructions || ''}
                  onChange={(e) => setEditingPaymentMethod({ ...editingPaymentMethod, instructions: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:bg-white focus:border-[#005da9] transition outline-none"
                />
              </div>

              {/* TOGGLES */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-200">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                  <input
                    type="checkbox"
                    checked={editingPaymentMethod.is_active !== false}
                    onChange={(e) => setEditingPaymentMethod({ ...editingPaymentMethod, is_active: e.target.checked })}
                    className="w-4 h-4 rounded text-[#005da9] focus:ring-0"
                  />
                  <span>Método Activo</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                  <input
                    type="checkbox"
                    checked={editingPaymentMethod.requires_reference === true}
                    onChange={(e) => setEditingPaymentMethod({ ...editingPaymentMethod, requires_reference: e.target.checked })}
                    className="w-4 h-4 rounded text-[#005da9] focus:ring-0"
                  />
                  <span>Pide Referencia</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                  <input
                    type="checkbox"
                    checked={editingPaymentMethod.allow_online !== false}
                    onChange={(e) => setEditingPaymentMethod({ ...editingPaymentMethod, allow_online: e.target.checked })}
                    className="w-4 h-4 rounded text-[#005da9] focus:ring-0"
                  />
                  <span>Disponible en Web</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentMethodModal(false);
                    setEditingPaymentMethod(null);
                  }}
                  className="px-4 py-2.5 bg-gray-150 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#005da9] hover:bg-[#004a87] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Configuración</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ⚠️ MODAL CONFIRMACIÓN: ELIMINAR MÉTODO DE PAGO */}
      {paymentMethodToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 text-left">
          <div className="bg-white rounded-3xl border border-rose-150 w-full max-w-md p-6 shadow-2xl relative space-y-4 animate-scaleUp">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-gray-900">¿Eliminar Método de Pago?</h4>
                <p className="text-xs text-gray-500 font-medium">Esta acción eliminará el método de pago de la lista activa.</p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-1 text-xs">
              <p className="font-bold text-rose-900">
                {paymentMethodToDelete.name} ({paymentMethodToDelete.currency})
              </p>
              {paymentMethodToDelete.account_details && (
                <p className="text-[11px] text-rose-700">{paymentMethodToDelete.account_details}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPaymentMethodToDelete(null)}
                className="px-4 py-2.5 bg-gray-150 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeletePaymentMethod}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sí, Eliminar Método</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemConfigPanel;
