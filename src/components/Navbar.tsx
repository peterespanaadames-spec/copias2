/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Search, MapPin, ShieldAlert, Laptop, UserCheck, Settings, RefreshCw, ShoppingCart, Globe, Lock, LogOut, User, Menu, X, ChevronRight, DollarSign } from 'lucide-react';
import { dbService, currentSettings } from '../lib/supabase.ts';
import { CurrencyCode } from '../lib/currency';
import { StoreUser, Category, BusinessProfile } from '../types.ts';
import { useI18n } from '../lib/i18n.ts';

interface NavbarProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  activeRole: 'admin' | 'vendedor' | 'cliente';
  onOpenSettings: () => void;
  onNavigateToAdmin: () => void;
  isAdminView: boolean;
  onExitAdminView: () => void;
  selectedCategory: string;
  setSelectedCategory: (val: string) => void;
  categories?: Category[];
  onlyOffers: boolean;
  setOnlyOffers: (val: boolean) => void;
  onResetFilters: () => void;
  onSelectCategoryByName: (keyword: string) => void;
  cartItemsCount: number;
  onOpenCart: () => void;
  onClearFiltersOnly?: () => void;
  activeCurrency: CurrencyCode;
  onCurrencyChange: (currency: CurrencyCode) => void;
  currencyRates: Record<CurrencyCode, number>;
  onOpenTresLechesLanding?: () => void;
  onOpenScanner?: () => void;
  currentUser?: StoreUser | null;
  onOpenLoginModal?: () => void;
  onLogout?: () => void;
  onOpenCustomerDashboard?: () => void;
  onOpenMobileCurrencyModal?: () => void;
}

export default function Navbar({
  searchTerm,
  setSearchTerm,
  activeRole,
  onOpenSettings,
  onNavigateToAdmin,
  isAdminView,
  onExitAdminView,
  selectedCategory,
  setSelectedCategory,
  categories = [],
  onlyOffers,
  setOnlyOffers,
  onResetFilters,
  onSelectCategoryByName,
  cartItemsCount,
  onOpenCart,
  onClearFiltersOnly,
  activeCurrency,
  onCurrencyChange,
  currencyRates,
  onOpenTresLechesLanding,
  onOpenScanner,
  currentUser,
  onOpenLoginModal,
  onLogout,
  onOpenCustomerDashboard,
  onOpenMobileCurrencyModal
}: NavbarProps) {
  const { t } = useI18n();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [disabledSettings, setDisabledSettings] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('copias_bellavista_disabled_settings');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>({
    name: 'Copias Bella Vista, C.A.',
    business_type: 'Papelería y libros',
    address: 'Sector bella vista, a una cuadra subiendo de la Cruz roja, calle 20 entre carrera 3 y 4',
    city: 'Barinitas',
    phone: '+58 412-5043857',
    email: 'Fotocopiasfyp@gmail.com',
    rif: 'J-50987654-3',
    website: 'https://copiasbellavista.vercel.app/',
    logo_url: '',
    slogan: 'Equipando Tus Proyectos'
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const p = await dbService.getBusinessProfile();
        if (p && p.name) {
          setBusinessProfile(p);
        }
      } catch (e) {
        console.warn("Could not load business profile in Navbar:", e);
      }
    };
    loadProfile();

    const handleProfileUpdate = (e: any) => {
      if (e.detail) {
        setBusinessProfile(e.detail);
      } else {
        loadProfile();
      }
    };

    window.addEventListener('bellavista_business_profile_updated', handleProfileUpdate);
    window.addEventListener('bellavista_settings_updated', loadProfile);
    window.addEventListener('storage', loadProfile);

    return () => {
      window.removeEventListener('bellavista_business_profile_updated', handleProfileUpdate);
      window.removeEventListener('bellavista_settings_updated', loadProfile);
      window.removeEventListener('storage', loadProfile);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 40) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const load = () => {
      try {
        const saved = localStorage.getItem('copias_bellavista_disabled_settings');
        if (saved) setDisabledSettings(JSON.parse(saved));
      } catch (e) {}
    };
    window.addEventListener('storage', load);
    window.addEventListener('bellavista_settings_updated', load);
    return () => {
      window.removeEventListener('storage', load);
      window.removeEventListener('bellavista_settings_updated', load);
    };
  }, []);

  const scrollToProducts = () => {
    setTimeout(() => {
      const element = document.getElementById('products-display-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
  };

  const escolarCategory = categories.find(c => {
    const cName = (c.name || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return cName.includes('escolar') || cName.includes('utiles');
  });
  const isEscolarActive = (selectedCategory === 'cat-2' || (escolarCategory && selectedCategory === escolarCategory.id)) && !onlyOffers;

  // Split business name into high-contrast 2 parts (first word white, rest in orange/gold)
  const businessName = (businessProfile.name || 'Copias Bella Vista').trim();
  const nameParts = businessName.split(' ');
  const firstWord = nameParts[0] || 'Copias';
  const restWords = nameParts.slice(1).join(' ') || (nameParts.length === 1 ? '' : 'Bella Vista');

  return (
    <header className={`sticky top-0 z-50 bg-[#131921] text-white select-none transition-all duration-300 ${isScrolled ? 'shadow-xl' : ''}`}>
      {/* Main Navbar */}
      {!isAdminView && (
        <div className="max-w-[1480px] mx-auto px-2.5 sm:px-4 md:px-6 py-2 md:py-0 min-h-[48px] md:min-h-[56px] flex flex-nowrap items-center gap-2 sm:gap-3 md:gap-4">
          {/* Logo & Hamburger Header (Single line on mobile) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Hamburger Button (Mobile Only) */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-1.5 sm:p-2 text-white hover:text-[#FF9900] active:scale-95 rounded-xl transition cursor-pointer flex items-center justify-center bg-[#232F3E] border border-gray-700 shadow-xs shrink-0"
              aria-label="Abrir Menú"
              id="btn-hamburger-menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5 text-[#FF9900]" /> : <Menu className="w-5 h-5 text-white" />}
            </button>

            <div 
              onClick={() => {
                onExitAdminView();
                scrollToProducts();
              }} 
              className="cursor-pointer group flex flex-row items-center gap-2 shrink-0 max-w-[200px] sm:max-w-[260px] md:max-w-none"
              id="nav-logo"
            >
              {/* Optional Business Logo from Database */}
              {businessProfile.logo_url && (
                <div className="h-8 md:h-10 w-8 md:w-10 rounded-lg overflow-hidden bg-white/10 p-0.5 border border-white/20 shrink-0 flex items-center justify-center">
                  <img 
                    src={businessProfile.logo_url} 
                    alt={businessProfile.name} 
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              {/* Mobile 2-line dynamic stacked logo */}
              <div className="flex flex-col md:hidden text-left leading-tight font-black tracking-tight uppercase truncate">
                <span className="text-[11px] text-white truncate">{firstWord}</span>
                <span className="text-[11px] text-[#FF9900] truncate">{restWords || firstWord}</span>
              </div>

              {/* Desktop single line logo with dynamic slogan */}
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center uppercase leading-none whitespace-nowrap">
                  {firstWord} {restWords && <span className="text-[#FF9900] ml-1.5">{restWords}</span>}
                </span>
                <span className="text-[10px] text-[#FF9900] font-bold uppercase tracking-widest mt-0.5">
                  {businessProfile.slogan || 'Equipando Tus Proyectos'}
                </span>
              </div>
            </div>
          </div>

          {/* Location Info (Desktop Only) */}
          <div className="hidden lg:flex items-center gap-2 text-left text-sm max-w-[200px] shrink-0">
            <MapPin className="text-[#FF9900] w-5 h-5 shrink-0" />
            <div className="leading-tight flex flex-col">
              <span className="text-[11px] text-gray-400 opacity-70">Entregar en</span>
              <span className="font-bold text-white text-xs flex items-center gap-0.5">
                Venezuela (USD)
              </span>
            </div>
          </div>

          {/* Search Bar (Expands in same row on mobile) */}
          <div className="flex-1 relative h-[36px] md:h-[38px] min-w-0 m-0">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (onClearFiltersOnly) onClearFiltersOnly();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (onClearFiltersOnly) onClearFiltersOnly();
                  scrollToProducts();
                }
              }}
              placeholder={t('nav.search_placeholder', 'Buscar productos...')}
              className="w-full pl-3 pr-10 h-full bg-white text-[#0F1111] placeholder-gray-400 rounded focus:outline-none focus:ring-2 focus:ring-[#FF9900] text-xs sm:text-sm md:text-base font-medium border border-gray-300 shadow-inner"
              id="input-global-search"
            />
            <button 
              type="button"
              onClick={() => {
                if (onClearFiltersOnly) onClearFiltersOnly();
                scrollToProducts();
              }}
              className="absolute right-0 top-0 h-full bg-[#FF9900] hover:bg-[#e68a00] text-[#131921] px-3 rounded-r flex items-center justify-center cursor-pointer transition-colors border-l border-gray-300"
            >
              <Search className="w-4 h-4 md:w-5 md:h-5 font-bold" />
            </button>
          </div>

          {/* Action Controls */}
          <div className="hidden md:flex items-center gap-4 justify-end w-auto">
            {/* Shopping Cart Button */}
            {!isAdminView && (
              <button
                onClick={onOpenCart}
                className="relative p-2 text-white hover:text-[#FF9900] transition cursor-pointer flex items-center gap-1.5 hover:scale-105 active:scale-95 duration-150 mr-1"
                id="btn-navbar-cart"
                title={t('nav.cart', 'Carrito')}
              >
                <div className="relative">
                  <ShoppingCart className="w-6 h-6 text-white hover:text-[#FF9900] transition" />
                  {cartItemsCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-[#FF9900] text-[#131921] text-[10px] font-black rounded-full h-4.5 w-4.5 flex items-center justify-center border-2 border-[#131921] animate-bounce">
                      {cartItemsCount}
                    </span>
                  )}
                </div>
                <span className="text-xs font-extrabold uppercase tracking-wider">{t('nav.cart', 'Carrito')}</span>
              </button>
            )}

            {/* User Session / Login Button */}
            {currentUser ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenCustomerDashboard) onOpenCustomerDashboard();
                  }}
                  className="flex items-center gap-2 bg-[#232F3E] hover:bg-[#2c3b4e] border border-gray-700/80 px-2.5 py-1 rounded-xl transition cursor-pointer"
                  title={t('nav.my_account', 'Mi Cuenta')}
                >
                  <div className="w-6 h-6 rounded-full bg-[#005da9] flex items-center justify-center text-white text-[11px] font-black shrink-0">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden md:flex flex-col text-left">
                    <span className="text-[11px] font-extrabold text-white leading-none max-w-[120px] truncate">
                      {currentUser.name}
                    </span>
                    <span className="text-[9px] font-bold text-[#FF9900] uppercase tracking-wider">
                      {currentUser.role}
                    </span>
                  </div>
                </button>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="p-1.5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-xl transition cursor-pointer"
                    title={t('nav.logout', 'Cerrar Sesión')}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={onOpenLoginModal}
                className="px-3.5 py-2 bg-[#FF9900] hover:bg-[#e68a00] text-[#131921] text-xs font-black rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer border border-[#FF9900]/30 hover:scale-105 active:scale-95 duration-150"
                id="btn-navbar-login"
                title={t('nav.login', 'Acceso / Iniciar Sesión')}
              >
                <User className="w-4 h-4 fill-[#131921] text-[#131921] shrink-0" />
                <span className="text-xs uppercase tracking-wider">{t('nav.login', 'Acceso')}</span>
              </button>
            )}

            {/* Admin Navigation Button */}
            {isAdminView && (
              <button
                onClick={onExitAdminView}
                className="px-4 py-1.5 bg-[#FF9900] text-[#131921] font-bold rounded hover:bg-[#e68a00] transition text-xs shadow cursor-pointer flex items-center gap-1 z-50 relative"
                id="btn-exit-admin"
              >
                <Laptop className="w-4 h-4" />
                {t('nav.client_dashboard', 'Ver Catálogo Público')}
              </button>
            )}

            {!isAdminView && (
              <>
                {(activeRole === 'admin' || activeRole === 'vendedor') && (
                  <button
                    onClick={onNavigateToAdmin}
                    className="px-4 py-1.5 bg-red-600 text-white font-bold rounded hover:bg-red-700 transition text-xs shadow-md cursor-pointer flex items-center gap-1 animate-pulse"
                    id="btn-go-admin"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    {t('nav.admin_panel', 'Panel Admin')}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Mobile Hamburger Drawer Overlay */}
      {isMobileMenuOpen && !isAdminView && (
        <div className="md:hidden bg-[#1a232e] border-t border-b border-gray-800 animate-fadeIn text-left select-none shadow-2xl">
          <div className="p-4 space-y-4">
            {/* Header / User summary in drawer */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-700/60">
              <span className="text-xs font-black uppercase tracking-wider text-[#FF9900] flex items-center gap-2">
                <Menu className="w-4 h-4" /> Menú Principal
              </span>
              <div className="flex items-center gap-1 bg-[#232F3E] px-2 py-1 rounded border border-gray-700 text-xs shrink-0 shadow-sm">
                <Globe className="w-3.5 h-3.5 text-[#FF9900]" />
                <span className="text-[10px] text-gray-300 font-bold uppercase">Moneda:</span>
                <select
                  value={activeCurrency}
                  onChange={(e) => onCurrencyChange(e.target.value as CurrencyCode)}
                  className="bg-[#232F3E] text-white text-xs font-black cursor-pointer focus:outline-none"
                >
                  {!disabledSettings.curr_usd && <option value="USD">USD ($)</option>}
                  {!disabledSettings.curr_eur && <option value="EUR">EUR (€)</option>}
                  {!disabledSettings.curr_ves && <option value="VES">VES (Bs.)</option>}
                  {!disabledSettings.curr_cop && <option value="COP">COP ($)</option>}
                </select>
              </div>
            </div>

            {/* Categories list in drawer */}
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-2">Categorías de Productos</p>
              
              <button
                onClick={() => {
                  onResetFilters();
                  scrollToProducts();
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                  selectedCategory === 'all' && !onlyOffers
                    ? 'bg-[#FF9900] text-[#131921]'
                    : 'bg-[#232F3E] text-white hover:bg-[#2c3b4e]'
                }`}
              >
                <span>📦 Todos los Productos</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setOnlyOffers(true);
                  setSelectedCategory('all');
                  setSearchTerm('');
                  scrollToProducts();
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                  onlyOffers
                    ? 'bg-[#FF9900] text-[#131921]'
                    : 'bg-[#232F3E] text-white hover:bg-[#2c3b4e]'
                }`}
              >
                <span>🔥 Ofertas Especiales</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  onSelectCategoryByName('Papelería y Oficina');
                  scrollToProducts();
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                  selectedCategory === 'cat-3' && !onlyOffers
                    ? 'bg-[#FF9900] text-[#131921]'
                    : 'bg-[#232F3E] text-white hover:bg-[#2c3b4e]'
                }`}
              >
                <span>✏️ Papelería y Oficina</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  onSelectCategoryByName('Impresiones y Copiado');
                  scrollToProducts();
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                  selectedCategory === 'cat-1' && !onlyOffers
                    ? 'bg-[#FF9900] text-[#131921]'
                    : 'bg-[#232F3E] text-white hover:bg-[#2c3b4e]'
                }`}
              >
                <span>🖨️ Impresiones y Copiado</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  onSelectCategoryByName('Escolares y utiles');
                  scrollToProducts();
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                  isEscolarActive
                    ? 'bg-[#FF9900] text-[#131921]'
                    : 'bg-[#232F3E] text-white hover:bg-[#2c3b4e]'
                }`}
              >
                <span>🎒 Escolares y útiles</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  onSelectCategoryByName('Postres');
                  scrollToProducts();
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                  selectedCategory === 'c5fd6476-9639-4cd6-af3e-8515f366fd07' && !onlyOffers
                    ? 'bg-[#FF9900] text-[#131921]'
                    : 'bg-[#232F3E] text-white hover:bg-[#2c3b4e]'
                }`}
              >
                <span>🍰 Postres y Dulces</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              {onOpenTresLechesLanding && (
                <button
                  onClick={() => {
                    onOpenTresLechesLanding();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold bg-amber-500/20 text-[#FF9900] border border-amber-500/40 hover:bg-amber-500/30 transition"
                >
                  <span>✨ Especial: Tres Leches Choco Arequipe</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick Actions & User Controls in drawer */}
            <div className="pt-3 border-t border-gray-700/60 space-y-2">
              {(activeRole === 'admin' || activeRole === 'vendedor') && (
                <button
                  onClick={() => {
                    onNavigateToAdmin();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full py-2.5 bg-[#FF9900] hover:bg-[#e68a00] text-[#131921] font-black text-xs uppercase rounded-xl flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                >
                  <ShieldAlert className="w-4 h-4 fill-[#131921]" />
                  <span>Acceder al Panel Admin</span>
                </button>
              )}

              {currentUser ? (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => {
                      if (onOpenCustomerDashboard) onOpenCustomerDashboard();
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex-1 py-2 bg-[#005da9] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Mi Cuenta</span>
                  </button>
                  {onLogout && (
                    <button
                      onClick={() => {
                        onLogout();
                        setIsMobileMenuOpen(false);
                      }}
                      className="px-3 py-2 bg-red-500/20 text-red-300 font-bold text-xs rounded-xl flex items-center justify-center"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (onOpenLoginModal) onOpenLoginModal();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full py-2.5 bg-[#FF9900] hover:bg-[#e68a00] text-[#131921] font-black text-xs uppercase rounded-xl flex items-center justify-center gap-2 transition"
                >
                  <User className="w-4 h-4 fill-[#131921]" />
                  <span>Iniciar Sesión / Registro</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sub-navigation bar (Dark Navy - Desktop Only) */}
      {!isAdminView && (
        <nav className="hidden md:block bg-[#232F3E] text-white border-t border-gray-800">
          <div className="max-w-[1480px] mx-auto px-4 md:px-6 h-[39px] text-xs md:text-sm font-medium flex items-center gap-4 overflow-x-auto whitespace-nowrap">
            <div 
              onClick={() => {
                onResetFilters();
                scrollToProducts();
              }}
              className={`flex items-center gap-1 cursor-pointer transition px-2 py-0.5 border rounded ${
                selectedCategory === 'all' && !onlyOffers
                  ? 'border-[#FF9900] text-[#FF9900] font-extrabold bg-[#131921]'
                  : 'border-transparent hover:border-gray-700 hover:text-[#FF9900]'
              }`}
              id="nav-sub-todo"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16"/></svg>
              <span>Todo</span>
            </div>
            <span className="text-gray-500">|</span>
            <span 
              onClick={() => {
                setOnlyOffers(true);
                setSelectedCategory('all');
                setSearchTerm('');
                scrollToProducts();
              }}
              className={`cursor-pointer transition px-2 py-0.5 rounded border ${
                onlyOffers
                  ? 'border-[#FF9900] text-[#FF9900] font-extrabold bg-[#131921]'
                  : 'border-transparent hover:border-gray-700 hover:text-[#FF9900]'
              }`}
              id="nav-sub-offers"
            >
              Ofertas
            </span>
            <span 
              onClick={() => {
                onSelectCategoryByName('Papelería y Oficina');
                scrollToProducts();
              }}
              className={`cursor-pointer transition px-2 py-0.5 rounded border ${
                selectedCategory === 'cat-3' && !onlyOffers
                  ? 'border-[#FF9900] text-[#FF9900] font-extrabold bg-[#131921]'
                  : 'border-transparent hover:border-gray-700 hover:text-[#FF9900]'
              }`}
              id="nav-sub-stationery"
            >
              Papelería
            </span>
            <span 
              onClick={() => {
                onSelectCategoryByName('Impresiones y Copiado');
                scrollToProducts();
              }}
              className={`cursor-pointer transition px-2 py-0.5 rounded border ${
                selectedCategory === 'cat-1' && !onlyOffers
                  ? 'border-[#FF9900] text-[#FF9900] font-extrabold bg-[#131921]'
                  : 'border-transparent hover:border-gray-700 hover:text-[#FF9900]'
              }`}
              id="nav-sub-copias"
            >
              Copias
            </span>
            <span 
              onClick={() => {
                onSelectCategoryByName('Escolares y utiles');
                scrollToProducts();
              }}
              className={`cursor-pointer transition px-2 py-0.5 rounded border ${
                isEscolarActive
                  ? 'border-[#FF9900] text-[#FF9900] font-extrabold bg-[#131921]'
                  : 'border-transparent hover:border-gray-700 hover:text-[#FF9900]'
              }`}
              id="nav-sub-supplies"
            >
              Escolares y útiles
            </span>
            <span 
              onClick={() => {
                onSelectCategoryByName('Postres');
                scrollToProducts();
              }}
              className={`cursor-pointer transition px-2 py-0.5 rounded border ${
                selectedCategory === 'c5fd6476-9639-4cd6-af3e-8515f366fd07' && !onlyOffers
                  ? 'border-[#FF9900] text-[#FF9900] font-extrabold bg-[#131921]'
                  : 'border-transparent hover:border-gray-700 hover:text-[#FF9900]'
              }`}
              id="nav-sub-postres"
            >
              Postres
            </span>
            {onOpenTresLechesLanding && (
              <span 
                onClick={onOpenTresLechesLanding}
                className="cursor-pointer transition px-2 py-0.5 rounded border border-amber-500/30 bg-amber-950/20 text-[#FF9900] font-bold hover:bg-amber-950/40 hover:border-amber-500 flex items-center gap-1 shrink-0 animate-pulse"
                id="nav-sub-tres-leches"
                title="Ver Landing Especial"
              >
                🍰 Especial: Tres Leches Choco Arequipe
              </span>
            )}
            <div className="flex-1"></div>
            <div className="flex items-center gap-3">
              {/* Currency Selector */}
              <div className="flex items-center gap-1.5 bg-[#131921] px-2.5 py-1 rounded border border-gray-800">
                <Globe className="w-3.5 h-3.5 text-[#FF9900]" />
                <span className="text-[11px] text-gray-400 font-bold uppercase mr-1">Moneda:</span>
                <select
                  value={activeCurrency}
                  onChange={(e) => onCurrencyChange(e.target.value as CurrencyCode)}
                  className="bg-[#131921] text-white text-xs font-black cursor-pointer focus:outline-none"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="VES">VES (Bs.)</option>
                  <option value="COP">COP (COP$)</option>
                </select>
              </div>

              {/* Rates Badges */}
              <div className="hidden lg:flex items-center gap-2">
                <span className="text-[10px] text-gray-400 font-bold uppercase">Tasa BCV:</span>
                <span className="text-[10px] font-bold text-gray-300 bg-[#131921] px-2.5 py-1 rounded border border-gray-800" title="Tasa oficial BCV (VES)">
                  Bs. {Number(currencyRates.VES).toFixed(2)}
                </span>
                <span className="text-[10px] text-gray-400 font-bold uppercase ml-1.5">EUR:</span>
                <span className="text-[10px] font-bold text-gray-300 bg-[#131921] px-2.5 py-1 rounded border border-gray-800" title="Referencia Euro">
                  {Number(currencyRates.EUR).toFixed(2)} €
                </span>
                <span className="text-[10px] text-gray-400 font-bold uppercase ml-1.5">COP:</span>
                <span className="text-[10px] font-bold text-gray-300 bg-[#131921] px-2.5 py-1 rounded border border-gray-800" title="Referencia Peso Colombiano">
                  COP$ {Number(currencyRates.COP).toFixed(0)}
                </span>
              </div>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
