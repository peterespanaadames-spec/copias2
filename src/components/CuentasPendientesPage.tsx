import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Search, ArrowLeftRight, TrendingUp, TrendingDown, DollarSign, 
  Calendar, Check, X, MoreVertical, FileText, AlertCircle, Clock, 
  Wallet, Building2, CreditCard, Receipt, ArrowDownRight, ArrowUpRight,
  ShieldCheck, RefreshCw, Printer, Trash2, Edit3, User, ChevronRight, CheckCircle2
} from 'lucide-react';
import { dbService } from '../lib/supabase';
import { AccountPayable, AccountPayablePayment, AccountReceivable, AccountReceivablePayment, BankAccount, StoreUser } from '../types';

const formatAmount = (val: number | undefined | null) => {
  const num = Number(val) || 0;
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

interface CuentasPendientesPageProps {
  bcvRate: number;
  currentUser?: StoreUser | null;
  onRefreshData?: () => void;
}

// Initial seed if no accounts exist in database or localStorage
const SEED_ACCOUNTS_PAYABLE: AccountPayable[] = [
  {
    id: 'cxp-seed-1',
    entity_name: 'mercado plaza',
    provider_name: 'mercado plaza',
    subject: 'carne',
    description: 'Cuenta por pagar generada por ingreso a inventario del item carne.',
    total_amount: 500.00,
    paid_amount: 0,
    remaining_amount: 500.00,
    status: 'pendiente',
    issue_date: '2024-07-10T13:48:00.000Z',
    due_date: new Date().toISOString(), // Today
    created_at: '2024-07-10T13:48:00.000Z'
  },
  {
    id: 'cxp-seed-2',
    entity_name: 'mercado plaza',
    provider_name: 'mercado plaza',
    subject: 'lechuga',
    description: 'Cuenta por pagar generada por ingreso a inventario del item lechuga.',
    total_amount: 150.00,
    paid_amount: 0,
    remaining_amount: 150.00,
    status: 'pendiente',
    issue_date: '2024-07-10T13:49:00.000Z',
    due_date: new Date().toISOString(), // Today
    created_at: '2024-07-10T13:49:00.000Z'
  },
  {
    id: 'cxp-seed-3',
    entity_name: 'vendedor: Sebastian',
    provider_name: 'vendedor: Sebastian',
    subject: 'Factura #00001',
    description: 'Cuenta por pagar generada por servicios del personal en venta de productos.',
    total_amount: 17.50,
    paid_amount: 0,
    remaining_amount: 17.50,
    status: 'pendiente',
    issue_date: '2024-07-10T12:05:00.000Z',
    due_date: '',
    created_at: '2024-07-10T12:05:00.000Z'
  },
  {
    id: 'cxp-seed-4',
    entity_name: 'vendedor: Sebastian',
    provider_name: 'vendedor: Sebastian',
    subject: 'Factura #00002',
    description: 'Cuenta por pagar generada por servicios del personal en venta de productos.',
    total_amount: 0.90,
    paid_amount: 0,
    remaining_amount: 0.90,
    status: 'pendiente',
    issue_date: '2024-07-10T14:36:00.000Z',
    due_date: '',
    created_at: '2024-07-10T14:36:00.000Z'
  }
];

const SEED_ACCOUNTS_RECEIVABLE: AccountReceivable[] = [
  {
    id: 'cxc-seed-1',
    entity_name: 'Inversiones Los Andes C.A.',
    client_name: 'Inversiones Los Andes C.A.',
    customer_name: 'Inversiones Los Andes C.A.',
    subject: 'Factura #00451',
    description: 'Crédito otorgado por venta de material de oficina e impresiones corporativas.',
    total_amount: 320.00,
    paid_amount: 100.00,
    remaining_amount: 220.00,
    status: 'parcial',
    issue_date: '2024-07-08T10:30:00.000Z',
    due_date: new Date(Date.now() + 86400000 * 2).toISOString(),
    created_at: '2024-07-08T10:30:00.000Z'
  },
  {
    id: 'cxc-seed-2',
    entity_name: 'Dra. Valentina Mendoza',
    client_name: 'Dra. Valentina Mendoza',
    customer_name: 'Dra. Valentina Mendoza',
    subject: 'Pedido #00892',
    description: 'Trabajos de diseño gráfico y encuadernado para congreso médico.',
    total_amount: 85.00,
    paid_amount: 0,
    remaining_amount: 85.00,
    status: 'pendiente',
    issue_date: '2024-07-12T15:20:00.000Z',
    due_date: new Date().toISOString(),
    created_at: '2024-07-12T15:20:00.000Z'
  }
];

export default function CuentasPendientesPage({
  bcvRate = 1,
  currentUser,
  onRefreshData
}: CuentasPendientesPageProps) {
  // Navigation tabs: 'pagar' (CxP) | 'cobrar' (CxC)
  const [activeTab, setActiveTab] = useState<'pagar' | 'cobrar'>('pagar');
  
  // Toggle: Ocultar cuentas en cero
  const [hideZeroBalance, setHideZeroBalance] = useState(false);
  
  // Search query
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [accountsPayable, setAccountsPayable] = useState<AccountPayable[]>([]);
  const [accountsReceivable, setAccountsReceivable] = useState<AccountReceivable[]>([]);
  const [paymentsPayable, setPaymentsPayable] = useState<AccountPayablePayment[]>([]);
  const [paymentsReceivable, setPaymentsReceivable] = useState<AccountReceivablePayment[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Selected entity for bottom detail table
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<{
    type: 'group' | 'single';
    entityName: string;
    account?: AccountPayable | AccountReceivable;
    totalPending: number;
  } | null>(null);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyTargetAccount, setHistoryTargetAccount] = useState<AccountPayable | AccountReceivable | null>(null);

  // Load all accounts and bank accounts
  const loadData = async () => {
    try {
      setIsLoading(true);
      const [cxpList, cxcList, cxpPayments, cxcPayments, banks] = await Promise.all([
        dbService.getAccountsPayable().catch(() => []),
        dbService.getAccountsReceivable().catch(() => []),
        dbService.getAccountsPayablePayments().catch(() => []),
        dbService.getAccountsReceivablePayments().catch(() => []),
        dbService.getBankAccounts().catch(() => [])
      ]);

      // Seed if empty
      let finalCxP = cxpList;
      if (!finalCxP || finalCxP.length === 0) {
        finalCxP = SEED_ACCOUNTS_PAYABLE;
        localStorage.setItem('copias_bellavista_accounts_payable', JSON.stringify(SEED_ACCOUNTS_PAYABLE));
        SEED_ACCOUNTS_PAYABLE.forEach(item => dbService.saveAccountPayable(item).catch(() => {}));
      }

      let finalCxC = cxcList;
      if (!finalCxC || finalCxC.length === 0) {
        finalCxC = SEED_ACCOUNTS_RECEIVABLE;
        localStorage.setItem('copias_bellavista_accounts_receivable', JSON.stringify(SEED_ACCOUNTS_RECEIVABLE));
        SEED_ACCOUNTS_RECEIVABLE.forEach(item => dbService.saveAccountReceivable(item).catch(() => {}));
      }

      setAccountsPayable(finalCxP);
      setAccountsReceivable(finalCxC);
      setPaymentsPayable(cxpPayments || []);
      setPaymentsReceivable(cxcPayments || []);
      setBankAccounts(banks || []);
    } catch (e) {
      console.error('Error loading accounts:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleCxPUpdate = (e: any) => {
      if (e.detail) setAccountsPayable(e.detail);
      else loadData();
    };
    const handleCxCUpdate = (e: any) => {
      if (e.detail) setAccountsReceivable(e.detail);
      else loadData();
    };
    const handlePaymentsUpdate = () => loadData();
    const handleBankUpdate = () => loadData();

    window.addEventListener('bellavista_accounts_payable_updated', handleCxPUpdate);
    window.addEventListener('bellavista_accounts_receivable_updated', handleCxCUpdate);
    window.addEventListener('bellavista_accounts_payable_payments_updated', handlePaymentsUpdate);
    window.addEventListener('bellavista_accounts_receivable_payments_updated', handlePaymentsUpdate);
    window.addEventListener('bellavista_bank_accounts_updated', handleBankUpdate);

    return () => {
      window.removeEventListener('bellavista_accounts_payable_updated', handleCxPUpdate);
      window.removeEventListener('bellavista_accounts_receivable_updated', handleCxCUpdate);
      window.removeEventListener('bellavista_accounts_payable_payments_updated', handlePaymentsUpdate);
      window.removeEventListener('bellavista_accounts_receivable_payments_updated', handlePaymentsUpdate);
      window.removeEventListener('bellavista_bank_accounts_updated', handleBankUpdate);
    };
  }, []);

  // Calculate helpers for days remaining
  const calculateDaysRemaining = (dueDate?: string) => {
    if (!dueDate) return { label: '--', type: 'none' };
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: 'Expirado', type: 'expired' };
    if (diffDays === 0) return { label: 'Hoy', type: 'today' };
    if (diffDays === 1) return { label: 'Mañana', type: 'soon' };
    return { label: `${diffDays} días`, type: 'normal' };
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '--';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('es-ES', { 
        month: 'numeric', 
        day: 'numeric', 
        year: '2-digit', 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      });
    } catch {
      return dateStr;
    }
  };

  // Grouped items calculation
  interface EntityGroup {
    entityName: string;
    itemCount: number;
    totalPending: number;
    totalAmount: number;
    earliestDue?: string;
    items: (AccountPayable | AccountReceivable)[];
  }

  const currentList = activeTab === 'pagar' ? accountsPayable : accountsReceivable;

  const filteredList = useMemo(() => {
    return currentList.filter(item => {
      const entity = (item.entity_name || (item as any).provider_name || (item as any).client_name || (item as any).customer_name || '').toLowerCase();
      const subject = (item.subject || (item as any).invoice_number || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();
      const q = searchQuery.toLowerCase().trim();

      const matchesSearch = !q || entity.includes(q) || subject.includes(q) || desc.includes(q);
      const matchesZero = !hideZeroBalance || (Number(item.remaining_amount) > 0);

      return matchesSearch && matchesZero;
    });
  }, [currentList, searchQuery, hideZeroBalance]);

  const groupedEntities: EntityGroup[] = useMemo(() => {
    const map = new Map<string, EntityGroup>();

    filteredList.forEach(item => {
      const entity = item.entity_name || (item as any).provider_name || (item as any).client_name || (item as any).customer_name || 'Sin Asunto';
      
      if (!map.has(entity)) {
        map.set(entity, {
          entityName: entity,
          itemCount: 0,
          totalPending: 0,
          totalAmount: 0,
          earliestDue: undefined,
          items: []
        });
      }

      const group = map.get(entity)!;
      group.items.push(item);
      group.itemCount += 1;
      group.totalPending += Number(item.remaining_amount || 0);
      group.totalAmount += Number(item.total_amount || 0);

      if (item.due_date) {
        if (!group.earliestDue || new Date(item.due_date) < new Date(group.earliestDue)) {
          group.earliestDue = item.due_date;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalPending - a.totalPending);
  }, [filteredList]);

  // Default selection to first group if none or invalid
  useEffect(() => {
    if (groupedEntities.length > 0) {
      if (!selectedEntity || !groupedEntities.some(g => g.entityName === selectedEntity)) {
        setSelectedEntity(groupedEntities[0].entityName);
      }
    } else {
      setSelectedEntity(null);
    }
  }, [groupedEntities, selectedEntity]);

  // Selected group items for detail view
  const selectedGroup = useMemo(() => {
    if (!selectedEntity) return null;
    return groupedEntities.find(g => g.entityName === selectedEntity) || null;
  }, [groupedEntities, selectedEntity]);

  // Grand Totals
  const totalPendingCxP = useMemo(() => {
    return accountsPayable.reduce((acc, item) => acc + Number(item.remaining_amount || 0), 0);
  }, [accountsPayable]);

  const totalPendingCxC = useMemo(() => {
    return accountsReceivable.reduce((acc, item) => acc + Number(item.remaining_amount || 0), 0);
  }, [accountsReceivable]);

  const currentTabTotalPending = useMemo(() => {
    return filteredList.reduce((acc, item) => acc + Number(item.remaining_amount || 0), 0);
  }, [filteredList]);

  // Handler to open group payment
  const handleOpenGroupPayment = (group: EntityGroup, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPaymentTarget({
      type: 'group',
      entityName: group.entityName,
      totalPending: group.totalPending
    });
    setShowPaymentModal(true);
  };

  // Handler to open single item payment
  const handleOpenSinglePayment = (item: AccountPayable | AccountReceivable, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPaymentTarget({
      type: 'single',
      entityName: item.entity_name || (item as any).provider_name || (item as any).client_name || '',
      account: item,
      totalPending: Number(item.remaining_amount || 0)
    });
    setShowPaymentModal(true);
  };

  // Delete account
  const handleDeleteAccount = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este registro de cuenta pendiente?')) return;
    if (activeTab === 'pagar') {
      await dbService.deleteAccountPayable(id);
    } else {
      await dbService.deleteAccountReceivable(id);
    }
    loadData();
    if (onRefreshData) onRefreshData();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. TOP HEADER & METRIC SUMMARY */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600 shadow-xs">
              <Receipt className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">
                  Cuentas Pendientes
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-violet-100 text-violet-700">
                  CxC & CxP
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Control y liquidación de deudas con proveedores y créditos a clientes en tiempo real
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 bg-[#6C2BD9] hover:bg-[#5B21B6] text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Agregar cuenta pendiente</span>
            </button>
          </div>
        </div>

        {/* Mini KPI Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
          <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-rose-600">Por Pagar (CxP)</span>
              <p className="text-xl font-black text-rose-950 mt-1">${formatAmount(totalPendingCxP)}</p>
              <p className="text-[11px] font-medium text-rose-600/80">Bs. {formatAmount(totalPendingCxP * bcvRate)}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-100/80 text-rose-600 flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Por Cobrar (CxC)</span>
              <p className="text-xl font-black text-emerald-950 mt-1">${formatAmount(totalPendingCxC)}</p>
              <p className="text-[11px] font-medium text-emerald-600/80">Bs. {formatAmount(totalPendingCxC * bcvRate)}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100/80 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Balance Neto</span>
              <p className={`text-xl font-black mt-1 ${totalPendingCxC >= totalPendingCxP ? 'text-emerald-700' : 'text-rose-700'}`}>
                ${formatAmount(totalPendingCxC - totalPendingCxP)}
              </p>
              <p className="text-[11px] font-medium text-indigo-600/80">
                {totalPendingCxC >= totalPendingCxP ? 'Superávit crediticio' : 'Déficit exigible'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-100/80 text-indigo-600 flex items-center justify-center">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Tasa BCV Oficial</span>
              <p className="text-xl font-black text-amber-950 mt-1">Bs. {formatAmount(bcvRate)}</p>
              <p className="text-[11px] font-medium text-amber-700/80">Conversión en vivo</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-100/80 text-amber-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. TABS & FILTER BAR (Exactly as in screenshot) */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        {/* Main Tab Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 px-6 pt-4 pb-0 gap-4">
          <div className="flex items-center gap-8">
            <button
              onClick={() => setActiveTab('pagar')}
              className={`pb-3.5 text-sm font-bold transition-all relative ${
                activeTab === 'pagar' 
                  ? 'text-[#6C2BD9]' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Cuentas por pagar
              {activeTab === 'pagar' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6C2BD9] rounded-t-full" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('cobrar')}
              className={`pb-3.5 text-sm font-bold transition-all relative ${
                activeTab === 'cobrar' 
                  ? 'text-[#6C2BD9]' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Cuentas por cobrar
              {activeTab === 'cobrar' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6C2BD9] rounded-t-full" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 pb-3.5 sm:pb-0">
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hideZeroBalance}
                onChange={(e) => setHideZeroBalance(e.target.checked)}
                className="w-4 h-4 text-violet-600 rounded border-gray-300 focus:ring-violet-500"
              />
              <span>Ocultar cuentas en cero</span>
            </label>
          </div>
        </div>

        {/* Subheader, Search Bar and Total Badge */}
        <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-base font-black text-[#6C2BD9] tracking-tight">
            {activeTab === 'pagar' ? 'Cuentas pendientes por pagar' : 'Cuentas pendientes por cobrar'}
          </h2>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1 max-w-xl justify-end">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Búsqueda de texto completo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50/70 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="bg-[#EDE9FE] text-[#6C2BD9] font-black px-6 py-2 rounded-2xl text-sm flex items-center justify-center whitespace-nowrap shadow-xs">
              Total: ${formatAmount(currentTabTotalPending)}
            </div>
          </div>
        </div>

        {/* 3. GROUPED UPPER TABLE (Matches Screenshot Layout) */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider bg-gray-50/50">
                <th className="py-3 px-6 w-12 text-center"></th>
                <th className="py-3 px-6">Asunto</th>
                <th className="py-3 px-6 text-center">Cuentas pendientes</th>
                <th className="py-3 px-6 text-right">
                  {activeTab === 'pagar' ? 'Por pagar' : 'Por cobrar'}
                </th>
                <th className="py-3 px-6 text-center">Días restantes</th>
                <th className="py-3 px-6 text-center w-36">
                  {activeTab === 'pagar' ? 'Pago' : 'Cobro'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {groupedEntities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Receipt className="w-8 h-8 text-gray-300" />
                      <p className="font-semibold text-gray-500">No hay cuentas pendientes registradas</p>
                      <button
                        onClick={() => setShowAddModal(true)}
                        className="text-xs text-violet-600 font-bold hover:underline"
                      >
                        + Agregar la primera cuenta
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                groupedEntities.map((group) => {
                  const isSelected = selectedEntity === group.entityName;
                  const days = calculateDaysRemaining(group.earliestDue);

                  return (
                    <tr
                      key={group.entityName}
                      onClick={() => setSelectedEntity(group.entityName)}
                      className={`cursor-pointer transition-colors group ${
                        isSelected 
                          ? 'bg-violet-50/60 ring-2 ring-violet-500/80 ring-inset' 
                          : 'hover:bg-gray-50/80'
                      }`}
                    >
                      {/* Checkbox / Radio Selection */}
                      <td className="py-4 px-6 text-center">
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                          isSelected 
                            ? 'bg-[#6C2BD9] text-white shadow-xs' 
                            : 'border-2 border-gray-300 group-hover:border-gray-400'
                        }`}>
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </td>

                      {/* Asunto */}
                      <td className="py-4 px-6 font-bold text-gray-900">
                        <div className="flex items-center gap-2">
                          <span className="capitalize">{group.entityName}</span>
                        </div>
                      </td>

                      {/* Cuentas Pendientes Count */}
                      <td className="py-4 px-6 text-center">
                        <span className="inline-flex items-center justify-center gap-1 font-bold text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded-full text-xs">
                          {group.itemCount}
                        </span>
                      </td>

                      {/* Por pagar / Por cobrar */}
                      <td className="py-4 px-6 text-right font-black text-gray-900">
                        ${formatAmount(group.totalPending)}
                      </td>

                      {/* Días restantes */}
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                          days.type === 'expired' ? 'bg-rose-100 text-rose-700' :
                          days.type === 'today' ? 'bg-amber-100 text-amber-700' :
                          days.type === 'soon' ? 'bg-orange-100 text-orange-700' :
                          'text-gray-500'
                        }`}>
                          {days.label}
                        </span>
                      </td>

                      {/* Pagar Todo / Cobrar Todo Button (Matches Gradient in Image) */}
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={(e) => handleOpenGroupPayment(group, e)}
                          disabled={group.totalPending <= 0}
                          className="w-full bg-gradient-to-r from-[#EC4899] to-[#F43F5E] hover:from-[#DB2777] hover:to-[#E11D48] text-white font-bold text-xs py-2 px-4 rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {activeTab === 'pagar' ? 'Pagar todo' : 'Cobrar todo'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. LOWER DETAIL SECTION (Matches Image 1 & 3) */}
      {selectedGroup && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded bg-[#6C2BD9] text-white flex items-center justify-center shadow-xs">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <h3 className="text-sm font-bold text-gray-900">
                Detalle de <span className="text-violet-700 font-extrabold capitalize">{selectedGroup.entityName}</span>
              </h3>
            </div>

            <div className="text-xs text-gray-500 font-medium">
              {selectedGroup.items.length} {selectedGroup.items.length === 1 ? 'cuenta asociada' : 'cuentas asociadas'}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Asunto</th>
                  <th className="py-3 px-4">Emisión</th>
                  <th className="py-3 px-4">Expiración</th>
                  <th className="py-3 px-4 text-center">Días restantes</th>
                  <th className="py-3 px-4">Descripción</th>
                  <th className="py-3 px-4 text-right">Monto</th>
                  <th className="py-3 px-4 text-center w-48">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {selectedGroup.items.map((item) => {
                  const days = calculateDaysRemaining(item.due_date);

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                      {/* Asunto / Item concept */}
                      <td className="py-3.5 px-4 font-bold text-gray-800">
                        {item.subject || (item as any).invoice_number || (item as any).purchase_id || 'Concepto'}
                      </td>

                      {/* Emisión */}
                      <td className="py-3.5 px-4 text-gray-600 whitespace-nowrap">
                        {formatDate(item.issue_date || item.created_at)}
                      </td>

                      {/* Expiración */}
                      <td className="py-3.5 px-4 text-gray-600 whitespace-nowrap">
                        {item.due_date ? formatDate(item.due_date) : '--'}
                      </td>

                      {/* Días restantes */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[11px] ${
                          days.type === 'expired' ? 'bg-rose-100 text-rose-700' :
                          days.type === 'today' ? 'bg-amber-100 text-amber-700' :
                          days.type === 'soon' ? 'bg-orange-100 text-orange-700' :
                          'text-gray-500'
                        }`}>
                          {days.label}
                        </span>
                      </td>

                      {/* Descripción */}
                      <td className="py-3.5 px-4 text-gray-500 max-w-xs truncate">
                        {item.description || 'Sin descripción'}
                      </td>

                      {/* Monto pendiente */}
                      <td className="py-3.5 px-4 text-right font-black text-gray-900 whitespace-nowrap">
                        ${formatAmount(item.remaining_amount)}
                      </td>

                      {/* Action Buttons: Pagar/Cobrar + Historial (Sin 3 puntos) */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => handleOpenSinglePayment(item, e)}
                            disabled={Number(item.remaining_amount) <= 0}
                            className="bg-gradient-to-r from-[#EC4899] to-[#F43F5E] hover:from-[#DB2777] hover:to-[#E11D48] text-white font-bold text-xs py-1.5 px-3.5 rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            {activeTab === 'pagar' ? 'Pagar' : 'Cobrar'}
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setHistoryTargetAccount(item);
                              setShowHistoryModal(true);
                            }}
                            title="Ver historial de pagos / abonos"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 text-gray-700 font-bold rounded-xl border border-gray-200/80 transition-all active:scale-95 text-xs whitespace-nowrap"
                          >
                            <FileText className="w-3.5 h-3.5 text-gray-500 hover:text-violet-600" />
                            <span>Historial</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. PAYMENT / COBRO MODAL (Matches Image 2 Exactly) */}
      {showPaymentModal && paymentTarget && (
        <PaymentModal
          type={activeTab}
          target={paymentTarget}
          bankAccounts={bankAccounts}
          bcvRate={bcvRate}
          currentUser={currentUser}
          onClose={() => {
            setShowPaymentModal(false);
            setPaymentTarget(null);
          }}
          onSuccess={() => {
            setShowPaymentModal(false);
            setPaymentTarget(null);
            loadData();
            if (onRefreshData) onRefreshData();
          }}
        />
      )}

      {/* 6. ADD ACCOUNT MODAL */}
      {showAddModal && (
        <AddAccountModal
          defaultType={activeTab}
          bcvRate={bcvRate}
          currentUser={currentUser}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadData();
            if (onRefreshData) onRefreshData();
          }}
        />
      )}

      {/* 7. HISTORY MODAL */}
      {showHistoryModal && historyTargetAccount && (
        <HistoryModal
          account={historyTargetAccount}
          type={activeTab}
          bcvRate={bcvRate}
          onClose={() => {
            setShowHistoryModal(false);
            setHistoryTargetAccount(null);
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// MODAL: PAGO / COBRO DE CUENTAS ASOCIADAS (Matches Image 2)
// ============================================================================
interface PaymentModalProps {
  type: 'pagar' | 'cobrar';
  target: {
    type: 'group' | 'single';
    entityName: string;
    account?: AccountPayable | AccountReceivable;
    totalPending: number;
  };
  bankAccounts: BankAccount[];
  bcvRate: number;
  currentUser?: StoreUser | null;
  onClose: () => void;
  onSuccess: () => void;
}

function PaymentModal({
  type,
  target,
  bankAccounts,
  bcvRate,
  currentUser,
  onClose,
  onSuccess
}: PaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<string>('EFECTIVO');
  const [amountUsd, setAmountUsd] = useState<string>(target.totalPending.toString());
  
  // Intelligent default bank account based on payment method / first available
  const [selectedBankId, setSelectedBankId] = useState<string>(() => {
    if (!bankAccounts || bankAccounts.length === 0) return '';
    return bankAccounts[0].id;
  });
  
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const numAmount = parseFloat(amountUsd) || 0;
  const numAmountBs = numAmount * bcvRate;

  // Selected bank object
  const selectedBank = bankAccounts?.find(b => b.id === selectedBankId);
  const isBankVES = selectedBank?.currency === 'VES';
  const amountForBank = isBankVES ? numAmountBs : numAmount;

  // Update bank selection when payment method changes if not manually picked
  const handlePaymentMethodChange = (newMethod: string) => {
    setPaymentMethod(newMethod);
    if (!bankAccounts || bankAccounts.length === 0) return;

    if (newMethod === 'PAGO MÓVIL' || newMethod === 'PUNTO DE VENTA' || newMethod === 'TRANSFERENCIA') {
      const vesBank = bankAccounts.find(b => b.currency === 'VES');
      if (vesBank) setSelectedBankId(vesBank.id);
    } else if (newMethod === 'ZELLE') {
      const usdBank = bankAccounts.find(b => b.currency === 'USD');
      if (usdBank) setSelectedBankId(usdBank.id);
    }
  };

  // Title matching Image 2: "Pago de cuentas asociadas a mercado plaza"
  const modalTitle = target.type === 'group'
    ? `${type === 'pagar' ? 'Pago' : 'Cobro'} de cuentas asociadas a ${target.entityName}`
    : `${type === 'pagar' ? 'Pago' : 'Cobro'} de cuenta: ${target.account?.subject || target.entityName}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) {
      setErrorMsg('Por favor ingresa un monto válido mayor a 0');
      return;
    }
    if (numAmount > target.totalPending + 0.01) {
      setErrorMsg(`El monto ingresado ($${numAmount}) no puede exceder el total pendiente ($${target.totalPending.toFixed(2)})`);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      const basePayment = {
        amount_bs: numAmountBs,
        payment_method: paymentMethod,
        bank_account_id: selectedBankId || undefined,
        payment_date: new Date().toISOString(),
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        created_by: currentUser?.name || 'Administrador'
      };

      if (type === 'pagar') {
        if (target.type === 'single' && target.account) {
          await dbService.payAccountPayable({
            id: crypto.randomUUID(),
            account_payable_id: target.account.id,
            cxp_id: target.account.id,
            amount: numAmount,
            ...basePayment
          });
        } else {
          await dbService.payBatchAccountsPayable(target.entityName, numAmount, basePayment);
        }
      } else {
        if (target.type === 'single' && target.account) {
          await dbService.payAccountReceivable({
            id: crypto.randomUUID(),
            account_receivable_id: target.account.id,
            cxc_id: target.account.id,
            amount: numAmount,
            ...basePayment
          });
        } else {
          await dbService.payBatchAccountsReceivable(target.entityName, numAmount, basePayment);
        }
      }

      window.dispatchEvent(new CustomEvent('bellavista_bank_accounts_updated'));
      window.dispatchEvent(new CustomEvent('bellavista_bank_transfers_updated'));

      onSuccess();
    } catch (err: any) {
      console.error('Error processing payment:', err);
      setErrorMsg(err.message || 'Ocurrió un error al procesar la transacción');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-150 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 tracking-tight">
            {modalTitle}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Top Quick Summary */}
          <div className="bg-violet-50/60 border border-violet-100 rounded-xl p-3.5 flex items-center justify-between text-xs">
            <div>
              <span className="text-gray-500 font-medium">Deuda total pendiente:</span>
              <p className="text-base font-black text-violet-950">${formatAmount(target.totalPending)}</p>
            </div>
            <div className="text-right">
              <span className="text-gray-500 font-medium">Equivalente en Bs:</span>
              <p className="text-xs font-bold text-violet-700">Bs. {formatAmount(target.totalPending * bcvRate)}</p>
            </div>
          </div>

          {/* Row matching Image 2: Método de pago + Monto (USD) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Método de pago:
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => handlePaymentMethodChange(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 shadow-xs"
              >
                <option value="EFECTIVO">EFECTIVO</option>
                <option value="PAGO MÓVIL">PAGO MÓVIL</option>
                <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                <option value="PUNTO DE VENTA">PUNTO DE VENTA</option>
                <option value="ZELLE">ZELLE</option>
                <option value="DÉBITO BANCARIO">DÉBITO BANCARIO</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Monto (USD):
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={target.totalPending}
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
                placeholder="200"
                required
                className="w-full px-3.5 py-2.5 text-xs font-bold text-gray-900 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 shadow-xs"
              />
            </div>
          </div>

          {/* Bank Account Selection */}
          {bankAccounts && bankAccounts.length > 0 && (
            <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-3 space-y-2">
              <label className="block text-xs font-bold text-gray-800">
                Cuenta Bancaria (Afectar saldo y registrar movimiento):
              </label>
              <select
                value={selectedBankId}
                onChange={(e) => setSelectedBankId(e.target.value)}
                className="w-full px-3.5 py-2 text-xs font-medium bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 shadow-xs"
              >
                <option value="">-- No vincular a cuenta bancaria (Solo registro contable) --</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bank_name || b.name} ({b.currency}) • Saldo: {b.currency === 'USD' ? '$' : 'Bs.'} {formatAmount(b.balance)}
                  </option>
                ))}
              </select>

              {selectedBank && numAmount > 0 && (
                <div className="text-[11px] bg-white border border-violet-100 rounded-lg p-2 text-gray-600 flex items-center justify-between">
                  <span>
                    {type === 'pagar' ? 'Se debitará:' : 'Se acreditará:'}{' '}
                    <strong className="text-violet-700">
                      {isBankVES ? `Bs. ${formatAmount(amountForBank)}` : `$${formatAmount(amountForBank)}`}
                    </strong>{' '}
                    en {selectedBank.bank_name || selectedBank.name}
                  </span>
                  <span className="text-gray-400 font-mono text-[10px]">
                    Saldo final:{' '}
                    <strong className={type === 'pagar' ? 'text-amber-700' : 'text-emerald-700'}>
                      {isBankVES ? 'Bs. ' : '$'}
                      {formatAmount(
                        type === 'pagar'
                          ? Number(selectedBank.balance) - amountForBank
                          : Number(selectedBank.balance) + amountForBank
                      )}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Reference & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Referencia bancaria:
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Ej. 948271"
                className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Nota / Observación:
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Abono o liquidación"
                className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              />
            </div>
          </div>

          {/* Amount in Bs Preview */}
          <div className="text-right text-[11px] text-gray-500">
            Total en Bolívares equivalente: <span className="font-bold text-gray-900">Bs. {formatAmount(numAmountBs)}</span>
          </div>

          {/* Confirm Button (Purple #6C2BD9 matching Image 2) */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-[#6C2BD9] hover:bg-[#5B21B6] text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-98 disabled:opacity-50"
            >
              {isSubmitting ? 'Procesando...' : type === 'pagar' ? 'Confirmar pago' : 'Confirmar cobro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// MODAL: AGREGAR CUENTA PENDIENTE (+ Nueva CxP o CxC)
// ============================================================================
interface AddAccountModalProps {
  defaultType: 'pagar' | 'cobrar';
  bcvRate: number;
  currentUser?: StoreUser | null;
  onClose: () => void;
  onSuccess: () => void;
}

function AddAccountModal({
  defaultType,
  bcvRate,
  currentUser,
  onClose,
  onSuccess
}: AddAccountModalProps) {
  const [accountType, setAccountType] = useState<'pagar' | 'cobrar'>(defaultType);
  const [entityName, setEntityName] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [initialPayment, setInitialPayment] = useState('0');
  const [issueDate, setIssueDate] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [dueDate, setDueDate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numTotal = parseFloat(totalAmount);
    const numPaid = parseFloat(initialPayment) || 0;

    if (!entityName.trim()) {
      setErrorMsg('Por favor ingresa el Asunto / Entidad principal (Proveedor o Cliente)');
      return;
    }
    if (!subject.trim()) {
      setErrorMsg('Por favor ingresa el Concepto / Sub-asunto (ej. Factura #, Insumo)');
      return;
    }
    if (isNaN(numTotal) || numTotal <= 0) {
      setErrorMsg('Por favor ingresa un monto total válido');
      return;
    }
    if (numPaid > numTotal) {
      setErrorMsg('El abono inicial no puede ser mayor que el monto total');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      const remaining = numTotal - numPaid;
      const status = remaining <= 0 ? 'pagado' : numPaid > 0 ? 'parcial' : 'pendiente';

      if (accountType === 'pagar') {
        const newCxP: AccountPayable = {
          id: crypto.randomUUID(),
          entity_name: entityName.trim(),
          provider_name: entityName.trim(),
          subject: subject.trim(),
          description: description.trim() || `Cuenta por pagar generada para ${entityName.trim()}.`,
          total_amount: numTotal,
          paid_amount: numPaid,
          remaining_amount: remaining,
          status: status as any,
          issue_date: issueDate ? new Date(issueDate).toISOString() : new Date().toISOString(),
          due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
          created_at: new Date().toISOString()
        };
        await dbService.saveAccountPayable(newCxP);
      } else {
        const newCxC: AccountReceivable = {
          id: crypto.randomUUID(),
          entity_name: entityName.trim(),
          client_name: entityName.trim(),
          customer_name: entityName.trim(),
          subject: subject.trim(),
          description: description.trim() || `Cuenta por cobrar generada para ${entityName.trim()}.`,
          total_amount: numTotal,
          paid_amount: numPaid,
          remaining_amount: remaining,
          status: status as any,
          issue_date: issueDate ? new Date(issueDate).toISOString() : new Date().toISOString(),
          due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
          created_at: new Date().toISOString()
        };
        await dbService.saveAccountReceivable(newCxC);
      }

      onSuccess();
    } catch (err: any) {
      console.error('Error saving account:', err);
      setErrorMsg(err.message || 'Error al guardar la cuenta');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-150 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
              <Plus className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">
              Agregar Cuenta Pendiente
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Type Switcher */}
          <div>
            <label className="block font-bold text-gray-700 mb-1.5">Tipo de Cuenta:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAccountType('pagar')}
                className={`py-2 px-3 rounded-xl font-bold border transition-all ${
                  accountType === 'pagar'
                    ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-xs'
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                }`}
              >
                Cuenta por Pagar (CxP)
              </button>
              <button
                type="button"
                onClick={() => setAccountType('cobrar')}
                className={`py-2 px-3 rounded-xl font-bold border transition-all ${
                  accountType === 'cobrar'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-xs'
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                }`}
              >
                Cuenta por Cobrar (CxC)
              </button>
            </div>
          </div>

          {/* Entity Name (Asunto Principal) */}
          <div>
            <label className="block font-bold text-gray-700 mb-1">
              Asunto / Entidad Principal ({accountType === 'pagar' ? 'Proveedor / Acreedor' : 'Cliente / Deudor'}):
            </label>
            <input
              type="text"
              required
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
              placeholder="Ej. mercado plaza, vendedor: Sebastian, Distribuidora Polar..."
              className="w-full px-3.5 py-2 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 font-semibold"
            />
          </div>

          {/* Concept / Item / Invoice */}
          <div>
            <label className="block font-bold text-gray-700 mb-1">
              Concepto / Sub-asunto (ej. carne, lechuga, Factura #00001):
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ej. carne, lechuga, Factura #12345, Honorarios..."
              className="w-full px-3.5 py-2 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 font-semibold"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block font-semibold text-gray-600 mb-1">
              Descripción detallada:
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Cuenta por pagar generada por ingreso a inventario..."
              className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
            />
          </div>

          {/* Montos */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 mb-1">
                Monto Total (USD):
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="500.00"
                className="w-full px-3.5 py-2 bg-white border border-gray-300 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-600 mb-1">
                Abono Inicial (Opcional):
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={initialPayment}
                onChange={(e) => setInitialPayment(e.target.value)}
                placeholder="0.00"
                className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-600 mb-1">
                Fecha de Emisión:
              </label>
              <input
                type="datetime-local"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-600 mb-1">
                Fecha de Expiración / Vencimiento:
              </label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              />
            </div>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-[#6C2BD9] hover:bg-[#5B21B6] text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-98 disabled:opacity-50"
            >
              {isSubmitting ? 'Guardando...' : 'Crear Cuenta Pendiente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// MODAL: HISTORIAL DE ABONOS Y PAGOS
// ============================================================================
interface HistoryModalProps {
  account: AccountPayable | AccountReceivable;
  type: 'pagar' | 'cobrar';
  bcvRate: number;
  onClose: () => void;
}

function HistoryModal({ account, type, bcvRate, onClose }: HistoryModalProps) {
  const [payments, setPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        setIsLoading(true);
        if (type === 'pagar') {
          const all = await dbService.getAccountsPayablePayments();
          setPayments(all.filter(p => p.account_payable_id === account.id || p.cxp_id === account.id));
        } else {
          const all = await dbService.getAccountsReceivablePayments();
          setPayments(all.filter(p => p.account_receivable_id === account.id || p.cxc_id === account.id));
        }
      } catch (e) {
        console.error('Error fetching payments:', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPayments();
  }, [account, type]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-150">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">
              Historial de Abonos y Pagos
            </h3>
            <p className="text-xs text-gray-500 font-medium">
              {account.subject} - {account.entity_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {/* Summary Box */}
          <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-xl text-center text-xs">
            <div>
              <span className="text-gray-400 text-[10px] font-bold block uppercase">Total</span>
              <span className="font-black text-gray-900">${formatAmount(account.total_amount)}</span>
            </div>
            <div>
              <span className="text-emerald-500 text-[10px] font-bold block uppercase">Pagado</span>
              <span className="font-black text-emerald-600">${formatAmount(account.paid_amount)}</span>
            </div>
            <div>
              <span className="text-rose-500 text-[10px] font-bold block uppercase">Pendiente</span>
              <span className="font-black text-rose-600">${formatAmount(account.remaining_amount)}</span>
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 text-xs">
            {isLoading ? (
              <p className="py-6 text-center text-gray-400">Cargando pagos...</p>
            ) : payments.length === 0 ? (
              <p className="py-6 text-center text-gray-400">No se han registrado abonos aún para esta cuenta</p>
            ) : (
              payments.map((p, idx) => (
                <div key={p.id || idx} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-800">${formatAmount(p.amount)}</p>
                    <p className="text-[11px] text-gray-500">{p.payment_method} {p.reference ? `• Ref: ${p.reference}` : ''}</p>
                    {p.notes && <p className="text-[10px] text-gray-400 italic mt-0.5">{p.notes}</p>}
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-gray-500 block">
                      {new Date(p.payment_date || p.created_at).toLocaleDateString('es-ES')}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                      Abonado
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-4 mt-2 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
