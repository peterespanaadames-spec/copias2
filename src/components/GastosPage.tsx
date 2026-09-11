import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, Coins, DollarSign, Calendar, Search, Plus, Trash2, 
  AlertCircle, CheckCircle2, X, Clock, HelpCircle, AlertTriangle, 
  Check, Loader2, MoreVertical, CreditCard, Receipt, Printer, FileText,
  Sparkles, ChevronDown
} from 'lucide-react';
import { dbService } from '../lib/supabase';
import { GastoFijo, GastoFijoPayment, BankAccount, StoreUser } from '../types';

interface GastosPageProps {
  bcvRate: number;
  currentUser?: StoreUser | null;
  onRefreshData?: () => void;
}

export default function GastosPage({
  bcvRate,
  currentUser,
  onRefreshData
}: GastosPageProps) {
  // Database states
  const [gastos, setGastos] = useState<GastoFijo[]>([]);
  const [payments, setPayments] = useState<GastoFijoPayment[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter state
  const [timeFilter, setTimeFilter] = useState<'mes_actual' | '3_meses' | '6_meses' | 'todos'>('mes_actual');
  const [searchQuery, setSearchQuery] = useState('');

  // Notification / Toast state
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Create Gasto Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [gastoName, setGastoName] = useState('');
  const [gastoAmount, setGastoAmount] = useState('');
  const [gastoType, setGastoType] = useState<'fijo' | 'variable'>('fijo');
  const [gastoCategory, setGastoCategory] = useState('Otros gastos');
  const [gastoNotes, setGastoNotes] = useState('');
  
  // Fixed gasto form fields
  const [fixedPayDay, setFixedPayDay] = useState('');
  const [fixedFrequency, setFixedFrequency] = useState('Mensual');

  // Variable gasto form fields
  const [variableAccountId, setVariableAccountId] = useState('');
  const [variablePayDate, setVariablePayDate] = useState('');

  // Pay Fixed Gasto Modal state
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedGastoToPay, setSelectedGastoToPay] = useState<GastoFijo | null>(null);
  const [payAccountId, setPayAccountId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payReference, setPayReference] = useState('');
  const [payNotes, setPayNotes] = useState('');

  // Dropdown options state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Helper to show notification
  const showNotification = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => {
      setToast(current => current?.msg === msg ? null : current);
    }, 4000);
  };

  // Load database data
  const loadData = async () => {
    try {
      setIsLoading(true);
      const [gList, pList, bList] = await Promise.all([
        dbService.getGastosFijos().catch(() => []),
        dbService.getGastoFijoPayments().catch(() => []),
        dbService.getBankAccounts().catch(() => [])
      ]);
      setGastos(gList);
      setPayments(pList);
      
      const activeBanks = bList.filter(a => a.is_active);
      setBankAccounts(activeBanks);

      // Auto select first bank account for variable / payment forms
      if (activeBanks.length > 0) {
        if (!variableAccountId) setVariableAccountId(activeBanks[0].id);
        if (!payAccountId) setPayAccountId(activeBanks[0].id);
      }
    } catch (e) {
      showNotification('Error al cargar datos financieros', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Event listeners for real-time sync
    const handleGastosUpdated = () => loadData();
    const handleAccountsUpdated = () => loadData();
    const handlePaymentsUpdated = () => loadData();

    window.addEventListener('bellavista_gastos_fijos_updated', handleGastosUpdated);
    window.addEventListener('bellavista_gastos_fijos_payments_updated', handlePaymentsUpdated);
    window.addEventListener('bellavista_bank_accounts_updated', handleAccountsUpdated);

    return () => {
      window.removeEventListener('bellavista_gastos_fijos_updated', handleGastosUpdated);
      window.removeEventListener('bellavista_gastos_fijos_payments_updated', handlePaymentsUpdated);
      window.removeEventListener('bellavista_bank_accounts_updated', handleAccountsUpdated);
    };
  }, []);

  // Utility to parse dates consistently
  const parseDateString = (dateStr?: string): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      // YYYY-MM-DD local format
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    return new Date(dateStr);
  };

  // Format date Spanish style: "21, dic 2024"
  const formatDateDisplay = (dateStr?: string): string => {
    if (!dateStr) return '--';
    const d = parseDateString(dateStr);
    if (!d || isNaN(d.getTime())) return '--';
    
    const day = d.getDate();
    const month = d.toLocaleString('es-ES', { month: 'short' });
    const year = d.getFullYear();
    return `${day < 10 ? '0' + day : day}, ${month} ${year}`;
  };

  // Utility to calculate days remaining dynamically
  const calculateDaysRemaining = (dueDateStr?: string, status?: string): { days: number; text: string; isExpired: boolean; isWarning: boolean } => {
    if (!dueDateStr) {
      return { days: 999, text: '--', isExpired: false, isWarning: false };
    }
    
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const due = parseDateString(dueDateStr);
    if (!due || isNaN(due.getTime())) {
      return { days: 999, text: '--', isExpired: false, isWarning: false };
    }
    due.setHours(0,0,0,0);

    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { days: diffDays, text: 'Expirado', isExpired: true, isWarning: true };
    } else if (diffDays === 0) {
      return { days: 0, text: '0', isExpired: false, isWarning: true };
    } else {
      return { 
        days: diffDays, 
        text: `${diffDays}`, 
        isExpired: false, 
        isWarning: diffDays <= 5 // ALERTA O RECORDATORIO DE GASTOS CON 5 DÍAS DE ANTICIPACIÓN
      };
    }
  };

  // Filter based on selected time range
  const filteredGastos = useMemo(() => {
    let list = gastos;

    // Search query filter
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      list = list.filter(g => g.name.toLowerCase().includes(q) || (g.category && g.category.toLowerCase().includes(q)));
    }

    // Time filter
    if (timeFilter === 'todos') return list;

    const today = new Date();
    const filterLimitDate = new Date();

    if (timeFilter === 'mes_actual') {
      // Start of current month
      filterLimitDate.setDate(1);
      filterLimitDate.setHours(0,0,0,0);
    } else if (timeFilter === '3_meses') {
      filterLimitDate.setMonth(today.getMonth() - 3);
    } else if (timeFilter === '6_meses') {
      filterLimitDate.setMonth(today.getMonth() - 6);
    }

    return list.filter(g => {
      const gDate = parseDateString(g.created_at || g.next_due_date || g.last_paid_date);
      return gDate ? gDate >= filterLimitDate : true;
    });
  }, [gastos, timeFilter, searchQuery]);

  // Statistics calculations based on filtered list
  const stats = useMemo(() => {
    let fixedTotal = 0;
    let variableTotal = 0;

    filteredGastos.forEach(g => {
      if (g.type === 'fijo') {
        fixedTotal += g.amount;
      } else {
        variableTotal += g.amount;
      }
    });

    const total = fixedTotal + variableTotal;

    return {
      total,
      fixed: fixedTotal,
      variable: variableTotal
    };
  }, [filteredGastos]);

  // Alert check: count of fixed expenses with <= 5 days remaining
  const pendingAlertCount = useMemo(() => {
    return gastos.filter(g => {
      if (g.type !== 'fijo') return false;
      
      const remaining = calculateDaysRemaining(g.next_due_date, g.status);
      return (remaining.isWarning || remaining.isExpired) && g.status !== 'pagado';
    }).length;
  }, [gastos]);

  // Handle Save New Gasto (Fixed or Variable)
  const handleCreateGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gastoName.trim() || !gastoAmount) {
      showNotification('Complete los campos obligatorios', 'error');
      return;
    }

    const amtVal = parseFloat(gastoAmount);
    if (isNaN(amtVal) || amtVal <= 0) {
      showNotification('Monto inválido', 'error');
      return;
    }

    try {
      const newId = crypto.randomUUID();
      const currentIso = new Date().toISOString();

      if (gastoType === 'fijo') {
        // 1. Prepare Fixed Expense
        const nextDate = fixedPayDay || new Date().toISOString().split('T')[0];
        const fixedPayload: GastoFijo = {
          id: newId,
          name: gastoName,
          category: gastoCategory,
          amount: amtVal,
          amount_bs: amtVal * bcvRate,
          type: 'fijo',
          frequency: fixedFrequency || 'Mensual',
          status: 'pendiente',
          next_due_date: nextDate,
          notes: gastoNotes,
          created_at: currentIso,
          updated_at: currentIso
        };

        await dbService.saveGastoFijo(fixedPayload);
        showNotification(`Gasto fijo "${gastoName}" programado a 30 días exitosamente.`);
      } else {
        // 2. Variable Expense - deducted immediately on creation
        if (!variableAccountId) {
          showNotification('Seleccione una cuenta bancaria para debitar el gasto variable', 'error');
          return;
        }

        const selectedAcc = bankAccounts.find(a => a.id === variableAccountId);
        if (!selectedAcc) return;

        if (selectedAcc.balance < amtVal) {
          showNotification(`Saldo insuficiente en "${selectedAcc.name}". Saldo disponible: $${selectedAcc.balance.toFixed(2)}`, 'error');
          return;
        }

        // Create paid variable expense record
        const varPayload: GastoFijo = {
          id: newId,
          name: gastoName,
          category: gastoCategory,
          amount: amtVal,
          amount_bs: amtVal * bcvRate,
          type: 'variable',
          status: 'pagado',
          notes: gastoNotes,
          last_paid_date: variablePayDate || new Date().toISOString().split('T')[0],
          created_at: currentIso,
          updated_at: currentIso
        };

        await dbService.saveGastoFijo(varPayload);

        // Register payment & debit from bank account immediately
        const payPayload: GastoFijoPayment = {
          id: crypto.randomUUID(),
          gasto_fijo_id: newId,
          gasto_name: gastoName,
          amount: amtVal,
          amount_bs: amtVal * bcvRate,
          payment_method: selectedAcc.name,
          bank_account_id: selectedAcc.id,
          bank_account_name: selectedAcc.name,
          payment_date: variablePayDate || new Date().toISOString().split('T')[0],
          notes: gastoNotes || 'Pago inmediato de gasto variable',
          created_by: currentUser?.name || 'Administrador',
          created_at: currentIso
        };

        await dbService.payGastoFijo(payPayload, 'pagado');
        showNotification(`Gasto variable "${gastoName}" cancelado y debitado de "${selectedAcc.name}".`);
      }

      // Reset form & close
      setGastoName('');
      setGastoAmount('');
      setGastoNotes('');
      setFixedPayDay('');
      setVariablePayDate('');
      setShowCreateModal(false);
      if (onRefreshData) onRefreshData();
    } catch (e) {
      showNotification('Error al registrar el gasto en Supabase', 'error');
    }
  };

  // Open pay modal for fixed gasto
  const handleOpenPayModal = (gasto: GastoFijo) => {
    setSelectedGastoToPay(gasto);
    setPayAmount(gasto.amount.toString());
    setPayNotes(`Pago de gasto fijo: ${gasto.name}`);
    if (bankAccounts.length > 0 && !payAccountId) {
      setPayAccountId(bankAccounts[0].id);
    }
    setShowPayModal(true);
  };

  // Submit payment for fixed gasto (re-schedules to 30 days)
  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGastoToPay || !payAmount || !payAccountId) {
      showNotification('Complete todos los campos del pago', 'error');
      return;
    }

    const payAmtVal = parseFloat(payAmount);
    if (isNaN(payAmtVal) || payAmtVal <= 0) {
      showNotification('Monto inválido', 'error');
      return;
    }

    const selectedAcc = bankAccounts.find(a => a.id === payAccountId);
    if (!selectedAcc) {
      showNotification('Seleccione una cuenta válida', 'error');
      return;
    }

    if (selectedAcc.balance < payAmtVal) {
      showNotification(`Saldo insuficiente en "${selectedAcc.name}". Saldo disponible: $${selectedAcc.balance.toFixed(2)}`, 'error');
      return;
    }

    try {
      const todayIso = new Date().toISOString().split('T')[0];

      // 1. Calculate next due date (automatically advances exactly 30 days / 1 month)
      const currentDue = parseDateString(selectedGastoToPay.next_due_date || todayIso) || new Date();
      const nextDue = new Date(currentDue);
      nextDue.setDate(nextDue.getDate() + 30); // REGLA: Los gastos fijos se fijan a 30 días
      const nextDueStr = nextDue.toISOString().split('T')[0];

      const paymentObj: GastoFijoPayment = {
        id: crypto.randomUUID(),
        gasto_fijo_id: selectedGastoToPay.id,
        gasto_name: selectedGastoToPay.name,
        amount: payAmtVal,
        amount_bs: payAmtVal * bcvRate,
        payment_method: selectedAcc.name,
        bank_account_id: selectedAcc.id,
        bank_account_name: selectedAcc.name,
        payment_date: todayIso,
        reference: payReference,
        notes: payNotes,
        created_by: currentUser?.name || 'Administrador',
        created_at: new Date().toISOString()
      };

      // 2. Register payment, debit bank account balance in Supabase, and advance next_due_date
      await dbService.payGastoFijo(paymentObj, 'pagado', nextDueStr);

      showNotification(`Pago realizado con éxito. Siguiente fecha de pago fijada a 30 días (${formatDateDisplay(nextDueStr)}).`);
      setShowPayModal(false);
      setSelectedGastoToPay(null);
      setPayReference('');
      setPayNotes('');
      if (onRefreshData) onRefreshData();
    } catch (e) {
      showNotification('Error al procesar el pago', 'error');
    }
  };

  // Delete expense record
  const handleDeleteGasto = async (id: string) => {
    const item = gastos.find(g => g.id === id);
    if (!item) return;

    if (confirm(`¿Está seguro de eliminar el gasto "${item.name}"?`)) {
      try {
        await dbService.deleteGastoFijo(id);
        showNotification(`Gasto "${item.name}" eliminado correctamente.`);
        setActiveMenuId(null);
        if (onRefreshData) onRefreshData();
      } catch (e) {
        showNotification('Error al eliminar el gasto', 'error');
      }
    }
  };

  return (
    <div className="space-y-6 select-none" id="gastos-module-container">
      
      {/* HEADER SECTION (Matching Image 1) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-150 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-700 shadow-2xs">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-black uppercase text-gray-900 tracking-tight">GASTOS FIJOS/VARIABLES</h1>
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Control financiero y programación a 30 días</p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          {/* Time dropdown */}
          <div className="relative">
            <select 
              value={timeFilter}
              onChange={(e: any) => setTimeFilter(e.target.value)}
              className="appearance-none pl-4 pr-9 py-2.5 bg-gray-50 hover:bg-gray-100/80 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:border-violet-600 cursor-pointer transition shadow-2xs"
            >
              <option value="mes_actual">Mes actual</option>
              <option value="3_meses">Últimos 3 meses</option>
              <option value="6_meses">Últimos 6 meses</option>
              <option value="todos">Todos los registros</option>
            </select>
            <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* "+ Agregar gasto" button */}
          <button 
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-[#6C2BD9] hover:bg-[#5B21B6] text-white font-bold text-xs rounded-xl shadow-xs hover:shadow-md transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar gasto</span>
          </button>
        </div>
      </div>

      {/* 5-DAY ADVANCE NOTIFICATION BANNER */}
      {pendingAlertCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3.5 animate-pulse shadow-2xs">
          <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-extrabold text-amber-900 uppercase tracking-tight">Recordatorio de Gastos Fijos (Alerta 5 Días de Anticipación)</h4>
            <p className="text-xs font-semibold text-amber-800 mt-0.5 leading-relaxed">
              Tienes <strong className="text-amber-950 font-black">{pendingAlertCount}</strong> gasto(s) fijo(s) que vencen en los próximos 5 días o se encuentran en fecha de pago. Presiona <span className="font-bold underline">Pagar</span> para debitar de tu cuenta bancaria y reprogramar automáticamente a 30 días.
            </p>
          </div>
        </div>
      )}

      {/* METRICS DASHBOARD (Matching Image 1: Gastos Totales, Gastos Fijos, Gastos Variables with Trend Badges) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* TOTAL EXPENSES */}
        <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 block mb-1">Gastos Totales</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-gray-900 tracking-tight">${stats.total.toFixed(2)}</span>
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                <TrendingUp className="w-3 h-3" />
                154.55%
              </span>
            </div>
            <span className="text-[10px] text-gray-400 font-semibold block mt-1">
              ≈ {(stats.total * bcvRate).toFixed(2)} VES (BCV)
            </span>
          </div>
        </div>

        {/* FIXED EXPENSES */}
        <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 block mb-1">Gastos Fijos</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-gray-900 tracking-tight">${stats.fixed.toFixed(2)}</span>
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                <TrendingUp className="w-3 h-3" />
                58.54%
              </span>
            </div>
            <span className="text-[10px] text-gray-400 font-semibold block mt-1">
              ≈ {(stats.fixed * bcvRate).toFixed(2)} VES (BCV)
            </span>
          </div>
        </div>

        {/* VARIABLE EXPENSES */}
        <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 block mb-1">Gastos Variables</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-gray-900 tracking-tight">${stats.variable.toFixed(2)}</span>
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                <TrendingUp className="w-3 h-3" />
                435.71%
              </span>
            </div>
            <span className="text-[10px] text-gray-400 font-semibold block mt-1">
              ≈ {(stats.variable * bcvRate).toFixed(2)} VES (BCV)
            </span>
          </div>
        </div>

      </div>

      {/* FILTER SEARCH BAR */}
      <div className="bg-white p-3.5 rounded-2xl border border-gray-150 shadow-2xs flex items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-gray-400" />
          <input 
            type="text"
            placeholder="Buscar gasto por nombre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-violet-600 text-xs font-semibold text-gray-800"
          />
        </div>
      </div>

      {/* =======================================================================
          SECTION 1: GASTOS FIJOS (Matching Image 1 & 4)
          ======================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase text-gray-800 tracking-wider">GASTOS FIJOS</h2>
          <button 
            type="button" 
            onClick={() => {
              setGastoType('fijo');
              setShowCreateModal(true);
            }}
            className="w-8 h-8 rounded-lg bg-[#6C2BD9] hover:bg-[#5B21B6] text-white flex items-center justify-center shadow-xs transition cursor-pointer"
            title="Agregar Gasto Fijo"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-150 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-150 text-gray-600 text-xs font-bold bg-white">
                  <th className="py-4 px-6 font-bold">Nombre</th>
                  <th className="py-4 px-6 font-bold">Monto</th>
                  <th className="py-4 px-6 font-bold">Fecha de pago</th>
                  <th className="py-4 px-6 font-bold">Última fecha de pago</th>
                  <th className="py-4 px-6 font-bold text-center">Días restantes</th>
                  <th className="py-4 px-6 font-bold text-center">Acciones</th>
                  <th className="py-4 px-4 w-10"></th>
                </tr>
              </thead>
              <tbody className="text-xs text-gray-800">
                {filteredGastos.filter(g => g.type === 'fijo').length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-gray-400 font-semibold">
                      No hay gastos fijos registrados. Presione "+ Agregar gasto" para comenzar.
                    </td>
                  </tr>
                ) : (
                  filteredGastos.filter(g => g.type === 'fijo').map(g => {
                    const remaining = calculateDaysRemaining(g.next_due_date, g.status);
                    const isPaidForNow = g.status === 'pagado' && remaining.days > 5;

                    return (
                      <tr 
                        key={g.id} 
                        className={`border-b border-gray-100 hover:bg-gray-50/60 transition ${
                          remaining.isWarning || remaining.isExpired ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        {/* Nombre */}
                        <td className="py-4 px-6 font-semibold text-gray-900">
                          {g.name}
                        </td>

                        {/* Monto */}
                        <td className="py-4 px-6 font-bold text-gray-900">
                          ${g.amount.toFixed(2)}
                        </td>

                        {/* Fecha de pago */}
                        <td className="py-4 px-6 text-gray-700">
                          {formatDateDisplay(g.next_due_date)}
                        </td>

                        {/* Última fecha de pago */}
                        <td className="py-4 px-6 text-gray-600">
                          {g.last_paid_date ? formatDateDisplay(g.last_paid_date) : '--'}
                        </td>

                        {/* Días restantes */}
                        <td className="py-4 px-6 text-center">
                          {remaining.isExpired ? (
                            <span className="font-bold text-rose-600">Expirado</span>
                          ) : (
                            <span className={`font-semibold ${remaining.isWarning ? 'text-amber-600 font-bold' : 'text-gray-800'}`}>
                              {remaining.text}
                            </span>
                          )}
                        </td>

                        {/* Status / Pagar Button */}
                        <td className="py-4 px-6 text-center">
                          {isPaidForNow ? (
                            <span className="text-gray-700 font-semibold">Pagado</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenPayModal(g)}
                              className="px-4 py-1.5 border border-[#8B5CF6] text-[#6C2BD9] hover:bg-[#6C2BD9] hover:text-white rounded-lg font-bold transition text-xs cursor-pointer shadow-2xs"
                            >
                              Pagar
                            </button>
                          )}
                        </td>

                        {/* Options Menu Toggle */}
                        <td className="py-4 px-4 text-right">
                          <div className="relative inline-block">
                            <button
                              type="button"
                              onClick={() => setActiveMenuId(activeMenuId === g.id ? null : g.id)}
                              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {activeMenuId === g.id && (
                              <div className="absolute right-0 mt-1 z-40 bg-white border border-gray-200 rounded-xl shadow-lg w-32 py-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteGasto(g.id)}
                                  className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 font-bold flex items-center gap-2 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Eliminar
                                </button>
                              </div>
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
      </div>

      {/* =======================================================================
          SECTION 2: GASTOS VARIABLES (Matching Image 1)
          ======================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase text-gray-800 tracking-wider">GASTOS VARIABLES</h2>
          <button 
            type="button" 
            onClick={() => {
              setGastoType('variable');
              setShowCreateModal(true);
            }}
            className="w-8 h-8 rounded-lg bg-[#6C2BD9] hover:bg-[#5B21B6] text-white flex items-center justify-center shadow-xs transition cursor-pointer"
            title="Agregar Gasto Variable"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-150 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-150 text-gray-600 text-xs font-bold bg-white">
                  <th className="py-4 px-6 font-bold">Nombre</th>
                  <th className="py-4 px-6 font-bold">Monto</th>
                  <th className="py-4 px-6 font-bold">Fecha de pago</th>
                  <th className="py-4 px-6 font-bold">Cuenta debitada</th>
                  <th className="py-4 px-6 font-bold">Descripción</th>
                  <th className="py-4 px-6 font-bold text-center">Estado</th>
                  <th className="py-4 px-4 w-10"></th>
                </tr>
              </thead>
              <tbody className="text-xs text-gray-800">
                {filteredGastos.filter(g => g.type === 'variable').length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-gray-400 font-semibold">
                      No hay gastos variables registrados.
                    </td>
                  </tr>
                ) : (
                  filteredGastos.filter(g => g.type === 'variable').map(g => {
                    const linkedPayment = payments.find(p => p.gasto_fijo_id === g.id);

                    return (
                      <tr key={g.id} className="border-b border-gray-100 hover:bg-gray-50/60 transition">
                        {/* Nombre */}
                        <td className="py-4 px-6 font-semibold text-gray-900">
                          {g.name}
                        </td>

                        {/* Monto */}
                        <td className="py-4 px-6 font-bold text-gray-900">
                          ${g.amount.toFixed(2)}
                        </td>

                        {/* Fecha de pago */}
                        <td className="py-4 px-6 text-gray-700">
                          {formatDateDisplay(g.last_paid_date || g.created_at)}
                        </td>

                        {/* Cuenta debitada */}
                        <td className="py-4 px-6 text-gray-700 font-medium">
                          {linkedPayment?.bank_account_name || 'Caja en Efectivo $'}
                        </td>

                        {/* Descripción */}
                        <td className="py-4 px-6 text-gray-500 max-w-xs truncate">
                          {g.notes || '--'}
                        </td>

                        {/* Estado */}
                        <td className="py-4 px-6 text-center">
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full text-[11px]">
                            <Check className="w-3 h-3" />
                            Pagado
                          </span>
                        </td>

                        {/* Delete option */}
                        <td className="py-4 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteGasto(g.id)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                            title="Eliminar gasto"
                          >
                            <Trash2 className="w-4 h-4" />
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
      </div>

      {/* =======================================================================
          MODAL: AGREGAR GASTO (Matching Image 2 & Image 5)
          ======================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <form 
            onSubmit={handleCreateGasto}
            className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-150 overflow-hidden"
          >
            {/* Modal Header */}
            <div className="px-6 py-5 flex items-center justify-between border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Agregar gasto</h3>
              <button 
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              
              {/* Row 1: Nombre and Monto (with green checkmarks when valid) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nombre</label>
                  <div className="relative">
                    <input 
                      type="text"
                      required
                      value={gastoName}
                      onChange={(e) => setGastoName(e.target.value)}
                      placeholder="alquiler las mercedes"
                      className="w-full pl-3.5 pr-9 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-500 text-xs font-medium text-gray-800 placeholder-gray-400"
                    />
                    {gastoName.trim().length > 0 && (
                      <Check className="absolute right-3 top-3 w-4 h-4 text-emerald-500 stroke-[2.5]" />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Monto</label>
                  <div className="relative">
                    <input 
                      type="number"
                      required
                      step="any"
                      value={gastoAmount}
                      onChange={(e) => setGastoAmount(e.target.value)}
                      placeholder="100"
                      className="w-full pl-3.5 pr-12 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-500 text-xs font-medium text-gray-800 placeholder-gray-400"
                    />
                    <div className="absolute right-3 top-2.5 flex items-center gap-1">
                      {parseFloat(gastoAmount) > 0 && (
                        <Check className="w-4 h-4 text-emerald-500 stroke-[2.5]" />
                      )}
                      <span className="text-xs font-semibold text-gray-400">$</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Radio Gasto Fijo vs Gasto Variable */}
              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-800 cursor-pointer">
                  <input 
                    type="radio" 
                    name="gastoType"
                    checked={gastoType === 'fijo'}
                    onChange={() => setGastoType('fijo')}
                    className="w-4 h-4 text-[#6C2BD9] accent-[#6C2BD9]"
                  />
                  <span>Gasto Fijo</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-800 cursor-pointer">
                  <input 
                    type="radio" 
                    name="gastoType"
                    checked={gastoType === 'variable'}
                    onChange={() => setGastoType('variable')}
                    className="w-4 h-4 text-[#6C2BD9] accent-[#6C2BD9]"
                  />
                  <span>Gasto Variable</span>
                </label>
              </div>

              {/* Row 3: Conditional Fields */}
              {gastoType === 'fijo' ? (
                /* GASTO FIJO FIELDS (Image 2) */
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Dia del mes a pagar (Opcional)</label>
                    <div className="relative">
                      <input 
                        type="date"
                        value={fixedPayDay}
                        onChange={(e) => setFixedPayDay(e.target.value)}
                        className="w-full pl-3.5 pr-9 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-500 text-xs font-medium text-gray-800"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Frecuencia de pago (Opcional)</label>
                    <div className="relative">
                      <select 
                        value={fixedFrequency}
                        onChange={(e) => setFixedFrequency(e.target.value)}
                        className="w-full appearance-none pl-3.5 pr-9 py-2.5 bg-white border border-[#C4B5FD] rounded-xl focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-500 text-xs font-medium text-gray-800 cursor-pointer"
                      >
                        <option value="Mensual">Mensual</option>
                        <option value="Semanal">Semanal</option>
                        <option value="Quincenal">Quincenal</option>
                        <option value="Anual">Anual</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              ) : (
                /* GASTO VARIABLE FIELDS (Image 5) */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">Cuenta a debitar</label>
                      <div className="relative">
                        <select 
                          required
                          value={variableAccountId}
                          onChange={(e) => setVariableAccountId(e.target.value)}
                          className="w-full appearance-none pl-3.5 pr-9 py-2.5 bg-white border border-[#C4B5FD] rounded-xl focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-500 text-xs font-medium text-gray-800 cursor-pointer"
                        >
                          {bankAccounts.length === 0 ? (
                            <option value="">CAJA EN EFECTIVO $</option>
                          ) : (
                            bankAccounts.map(a => (
                              <option key={a.id} value={a.id}>
                                {a.name} (Disp: ${a.balance.toFixed(2)})
                              </option>
                            ))
                          )}
                        </select>
                        <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">Fecha de pago (Opcional)</label>
                      <input 
                        type="date"
                        value={variablePayDate}
                        onChange={(e) => setVariablePayDate(e.target.value)}
                        className="w-full pl-3.5 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-500 text-xs font-medium text-gray-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Descripción</label>
                    <textarea 
                      rows={3}
                      value={gastoNotes}
                      onChange={(e) => setGastoNotes(e.target.value)}
                      placeholder="Detalle o descripción del gasto variable..."
                      className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-violet-600 text-xs font-medium text-gray-800 resize-none"
                    />
                  </div>
                </div>
              )}

            </div>

            {/* Bottom Button (Matching Images 2 & 5) */}
            <div className="p-6 pt-2 flex justify-center">
              <button 
                type="submit"
                className="px-8 py-2.5 bg-[#6C2BD9] hover:bg-[#5B21B6] text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition cursor-pointer"
              >
                Confirmar gasto
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =======================================================================
          MODAL: PAGAR GASTO FIJO (Matching Image 3)
          ======================================================================= */}
      {showPayModal && selectedGastoToPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <form 
            onSubmit={handleConfirmPayment}
            className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-150 overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-5 flex items-center justify-between border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900">Gasto fijo: {selectedGastoToPay.name}</h3>
                <p className="text-xs font-semibold text-gray-600 mt-1">
                  Total {selectedGastoToPay.amount}$ faltan 0$
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setShowPayModal(false)}
                className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              
              {/* Row: Metodo de pago & Monto (USD) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Metodo de pago</label>
                  <div className="relative">
                    <select 
                      required
                      value={payAccountId}
                      onChange={(e) => setPayAccountId(e.target.value)}
                      className="w-full appearance-none pl-3.5 pr-9 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-500 text-xs font-medium text-gray-800 cursor-pointer"
                    >
                      {bankAccounts.length === 0 ? (
                        <option value="">EFECTIVO EN DOLARES</option>
                      ) : (
                        bankAccounts.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.name} (${a.balance.toFixed(2)})
                          </option>
                        ))
                      )}
                    </select>
                    <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Monto (USD)</label>
                  <div className="relative">
                    <input 
                      type="number"
                      required
                      step="any"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="w-full pl-3.5 pr-12 py-2.5 bg-white border border-[#C4B5FD] rounded-xl focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-500 text-xs font-medium text-gray-800"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-semibold text-gray-400">USD</span>
                  </div>
                </div>
              </div>

              {/* Referencia & Notas */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Referencia (Opcional)</label>
                <input 
                  type="text"
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  placeholder="Ej: Ref #92819"
                  className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-violet-600 text-xs font-medium text-gray-800"
                />
              </div>

            </div>

            {/* Bottom Centered Button (Matching Image 3) */}
            <div className="p-6 pt-2 flex justify-center">
              <button 
                type="submit"
                className="px-8 py-2.5 bg-[#6C2BD9] hover:bg-[#5B21B6] text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition cursor-pointer"
              >
                Confirmar pago
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TOAST SYSTEM */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-white rounded-2xl border border-gray-200 shadow-xl p-4 flex items-start gap-3.5 animate-in slide-in-from-bottom-5 duration-200">
          <div className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-extrabold text-gray-900 uppercase tracking-tight">{toast.type === 'success' ? 'Éxito' : 'Error'}</p>
            <p className="text-xs font-semibold text-gray-600 mt-0.5 leading-normal">{toast.msg}</p>
          </div>
          <button 
            type="button" 
            onClick={() => setToast(null)}
            className="text-gray-400 hover:text-gray-600 transition p-1 rounded-lg hover:bg-gray-50 shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

    </div>
  );
}

