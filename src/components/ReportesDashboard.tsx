/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, Settings, Calendar, Download, RefreshCw, ChevronUp, ChevronDown, 
  GripVertical, Check, AlertCircle, TrendingUp, TrendingDown, DollarSign, 
  Users, ShoppingBag, Truck, User, ArrowRight, ArrowLeft, ArrowUpRight, 
  Layers, BarChart2, Briefcase, CreditCard, Home, ShoppingCart, HelpCircle, EyeOff, Radio, ChevronLeft, ChevronRight,
  PieChart, Info, X, Sparkles, Coins
} from 'lucide-react';
import { Product, Order, ReportModuleConfig, StoreUser, Category, BusinessProfile } from '../types';
import { dbService, supabase } from '../lib/supabase';
import { CurrencyCode, formatCurrency } from '../lib/currency';
import { 
  parseUniversalDate, 
  getLocalDateString, 
  getStartOfWeek, 
  getEndOfWeek, 
  getPeriodKeyForDate,
  formatWeekRangeSpanish 
} from '../lib/dateUtils';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { exportReportsToPdf } from '../lib/pdfExport';

/**
 * Helper to render an offscreen canvas Pie Chart for Expense Distribution
 * Returns base64 PNG data URL
 */
function generateExpensePieChartCanvas(expenses: Record<string, number>): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 650;
    canvas.height = 380;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Outer Border
    ctx.strokeStyle = '#D1D5DB';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

    // Header Background Accent Bar
    ctx.fillStyle = '#1B2631';
    ctx.fillRect(8, 8, canvas.width - 16, 44);

    // Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 15px Calibri, sans-serif';
    ctx.fillText('Distribución de Gastos de Operación', 20, 35);

    const entries = Object.entries(expenses).filter(([_, val]) => Number(val) > 0);
    const total = entries.reduce((acc, [_, val]) => acc + Number(val), 0);

    if (entries.length === 0 || total === 0) {
      ctx.fillStyle = '#6B7280';
      ctx.font = '14px Calibri, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Sin Gastos de Operación Registrados en el Período', canvas.width / 2, canvas.height / 2 + 15);
      return canvas.toDataURL('image/png');
    }

    const colors = [
      '#1B2631', '#16A085', '#2980B9', '#E67E22', '#8E44AD',
      '#D35400', '#27AE60', '#F39C12', '#C0392B', '#7F8C8D'
    ];

    // Draw Pie Chart / Donut
    const centerX = 165;
    const centerY = 215;
    const radius = 105;
    let startAngle = -0.5 * Math.PI;

    entries.forEach(([cat, val], idx) => {
      const sliceAngle = (Number(val) / total) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;
      const color = colors[idx % colors.length];

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();

      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      // Draw slice percentage label
      if (sliceAngle > 0.28) {
        const midAngle = startAngle + sliceAngle / 2;
        const textX = centerX + Math.cos(midAngle) * (radius * 0.68);
        const textY = centerY + Math.sin(midAngle) * (radius * 0.68);
        const pct = ((Number(val) / total) * 100).toFixed(1) + '%';
        
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px Calibri, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pct, textX, textY);
      }

      startAngle = endAngle;
    });

    // Donut Center
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.45, 0, 2 * Math.PI);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // Total text in center
    ctx.fillStyle = '#1B2631';
    ctx.font = 'bold 11px Calibri, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TOTAL', centerX, centerY - 9);
    ctx.font = 'bold 11px Calibri, sans-serif';
    ctx.fillStyle = '#16A085';
    ctx.fillText('$' + total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), centerX, centerY + 9);

    // Legend on Right
    let legendY = 75;
    const legendX = 320;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    entries.forEach(([cat, val], idx) => {
      if (legendY > canvas.height - 25) return;
      const color = colors[idx % colors.length];
      const pct = ((Number(val) / total) * 100).toFixed(1) + '%';
      const amountStr = '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      // Color box
      ctx.fillStyle = color;
      ctx.fillRect(legendX, legendY, 13, 13);
      ctx.strokeStyle = '#D1D5DB';
      ctx.lineWidth = 1;
      ctx.strokeRect(legendX, legendY, 13, 13);

      // Label
      ctx.fillStyle = '#1B2631';
      ctx.font = 'bold 11px Calibri, sans-serif';
      const truncatedCat = cat.length > 20 ? cat.substring(0, 18) + '..' : cat;
      ctx.fillText(truncatedCat, legendX + 20, legendY + 11);

      // Value & Pct
      ctx.fillStyle = '#566573';
      ctx.font = '11px Calibri, sans-serif';
      ctx.fillText(`${amountStr} (${pct})`, legendX + 175, legendY + 11);

      legendY += 26;
    });

    return canvas.toDataURL('image/png');
  } catch (e) {
    console.error("Error drawing pie chart canvas:", e);
    return '';
  }
}

/**
 * Helper to render an offscreen canvas Vertical Bar Chart for Sales by Seller/Channel
 * Returns base64 PNG data URL
 */
function generateSalesBarChartCanvas(sellers: { name: string; sales: number; count: number }[]): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 680;
    canvas.height = 380;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Outer Border
    ctx.strokeStyle = '#D1D5DB';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

    // Header Background Accent Bar
    ctx.fillStyle = '#1B2631';
    ctx.fillRect(8, 8, canvas.width - 16, 44);

    // Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 15px Calibri, sans-serif';
    ctx.fillText('Facturación por Vendedor / Canal', 20, 35);

    if (!sellers || sellers.length === 0) {
      ctx.fillStyle = '#6B7280';
      ctx.font = '14px Calibri, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Sin Datos de Ventas Registradas por Vendedor', canvas.width / 2, canvas.height / 2 + 15);
      return canvas.toDataURL('image/png');
    }

    const topSellers = sellers.slice(0, 10);
    const maxSales = Math.max(...topSellers.map(s => Number(s.sales) || 0), 1);

    const chartX = 70;
    const chartY = 75;
    const chartW = canvas.width - chartX - 30;
    const chartH = 225;

    // Horizontal Gridlines
    ctx.strokeStyle = '#F3F4F6';
    ctx.lineWidth = 1;
    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i++) {
      const y = chartY + chartH - (i * (chartH / gridSteps));
      ctx.beginPath();
      ctx.moveTo(chartX, y);
      ctx.lineTo(chartX + chartW, y);
      ctx.stroke();

      const val = (maxSales / gridSteps) * i;
      ctx.fillStyle = '#566573';
      ctx.font = '10px Calibri, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText('$' + Math.round(val).toLocaleString(), chartX - 8, y);
    }

    // Axes
    ctx.strokeStyle = '#9CA3AF';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(chartX, chartY);
    ctx.lineTo(chartX, chartY + chartH);
    ctx.lineTo(chartX + chartW, chartY + chartH);
    ctx.stroke();

    // Bars
    const barCount = topSellers.length;
    const slotW = chartW / barCount;
    const barW = Math.min(slotW * 0.52, 48);

    topSellers.forEach((s, idx) => {
      const sSales = Number(s.sales) || 0;
      const barH = (sSales / maxSales) * chartH;
      const x = chartX + (idx * slotW) + (slotW - barW) / 2;
      const y = chartY + chartH - barH;

      const barColor = idx === 0 ? '#16A085' : '#1B2631';
      
      ctx.fillStyle = barColor;
      ctx.fillRect(x, y, barW, barH);

      // Top cap accent
      ctx.fillStyle = idx === 0 ? '#1ABC9C' : '#34495E';
      ctx.fillRect(x, y, barW, 3);

      // Value label on top
      ctx.fillStyle = '#1B2631';
      ctx.font = 'bold 10px Calibri, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('$' + Math.round(sSales).toLocaleString(), x + barW / 2, y - 4);

      // Seller name
      ctx.fillStyle = '#1B2631';
      ctx.font = 'bold 10px Calibri, sans-serif';
      ctx.textBaseline = 'top';
      const shortName = s.name.length > 12 ? s.name.substring(0, 10) + '..' : s.name;
      ctx.fillText(shortName, x + barW / 2, chartY + chartH + 8);

      // Count
      ctx.fillStyle = '#566573';
      ctx.font = '9px Calibri, sans-serif';
      ctx.fillText(`${s.count} ops`, x + barW / 2, chartY + chartH + 22);
    });

    return canvas.toDataURL('image/png');
  } catch (e) {
    console.error("Error drawing bar chart canvas:", e);
    return '';
  }
}

/**
 * Helper to render an offscreen canvas Donut/Pie Chart for Payment Methods Distribution
 * Returns base64 PNG data URL
 */
function generatePaymentPieChartCanvas(payments: Record<string, { count: number; total: number }>): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 650;
    canvas.height = 380;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Outer Border
    ctx.strokeStyle = '#D1D5DB';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

    // Header Background Accent Bar
    ctx.fillStyle = '#1B2631';
    ctx.fillRect(8, 8, canvas.width - 16, 44);

    // Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 15px Calibri, sans-serif';
    ctx.fillText('Participación por Método de Pago', 20, 35);

    const entries = Object.entries(payments).filter(([_, data]) => data.total > 0);
    const totalSales = entries.reduce((acc, [_, data]) => acc + data.total, 0);

    if (entries.length === 0 || totalSales === 0) {
      ctx.fillStyle = '#6B7280';
      ctx.font = '14px Calibri, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Sin Transacciones de Ventas Registradas en el Período', canvas.width / 2, canvas.height / 2 + 15);
      return canvas.toDataURL('image/png');
    }

    const colors = [
      '#16A085', '#2980B9', '#1B2631', '#8E44AD', '#E67E22',
      '#D35400', '#27AE60', '#F39C12', '#C0392B', '#7F8C8D'
    ];

    // Draw Pie Chart / Donut
    const centerX = 165;
    const centerY = 215;
    const radius = 105;
    let startAngle = -0.5 * Math.PI;

    entries.forEach(([method, data], idx) => {
      const sliceAngle = (data.total / totalSales) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;
      const color = colors[idx % colors.length];

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();

      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      // Draw slice percentage label
      if (sliceAngle > 0.25) {
        const midAngle = startAngle + sliceAngle / 2;
        const textX = centerX + Math.cos(midAngle) * (radius * 0.68);
        const textY = centerY + Math.sin(midAngle) * (radius * 0.68);
        const pct = ((data.total / totalSales) * 100).toFixed(1) + '%';
        
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px Calibri, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pct, textX, textY);
      }

      startAngle = endAngle;
    });

    // Donut Center
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.45, 0, 2 * Math.PI);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // Total text in center
    ctx.fillStyle = '#1B2631';
    ctx.font = 'bold 11px Calibri, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VENTAS', centerX, centerY - 9);
    ctx.font = 'bold 11px Calibri, sans-serif';
    ctx.fillStyle = '#16A085';
    ctx.fillText('$' + totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), centerX, centerY + 9);

    // Legend on Right
    let legendY = 75;
    const legendX = 310;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    entries.forEach(([method, data], idx) => {
      if (legendY > canvas.height - 25) return;
      const color = colors[idx % colors.length];
      const pct = ((data.total / totalSales) * 100).toFixed(1) + '%';
      const amountStr = '$' + data.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      // Color box
      ctx.fillStyle = color;
      ctx.fillRect(legendX, legendY, 13, 13);
      ctx.strokeStyle = '#D1D5DB';
      ctx.lineWidth = 1;
      ctx.strokeRect(legendX, legendY, 13, 13);

      // Label
      ctx.fillStyle = '#1B2631';
      ctx.font = 'bold 11px Calibri, sans-serif';
      const truncated = method.length > 22 ? method.substring(0, 20) + '..' : method;
      ctx.fillText(truncated, legendX + 20, legendY + 11);

      // Value & Pct
      ctx.fillStyle = '#566573';
      ctx.font = '11px Calibri, sans-serif';
      ctx.fillText(`${amountStr} (${pct})`, legendX + 180, legendY + 11);

      legendY += 26;
    });

    return canvas.toDataURL('image/png');
  } catch (e) {
    console.error("Error drawing payment pie chart canvas:", e);
    return '';
  }
}

interface ReportesDashboardProps {
  products: Product[];
  orders: Order[];
  cashOps?: any[];
  bcvRate: number;
  activeCurrency: CurrencyCode;
  currencyRates: Record<CurrencyCode, number>;
  onCurrencyChange?: (currency: CurrencyCode) => void;
  onRefreshData?: () => void;
  onExportSeniatExcel?: () => void;
  onPrintInventoryReport?: () => void;
  onOpenConfigDashboard?: () => void;
}

export default function ReportesDashboard({
  products,
  orders,
  cashOps = [],
  bcvRate,
  activeCurrency,
  currencyRates,
  onCurrencyChange,
  onRefreshData,
  onExportSeniatExcel,
  onPrintInventoryReport,
  onOpenConfigDashboard
}: ReportesDashboardProps) {
  // Navigation: 'view' (Vista Principal) or 'config' (Configuración de Reportes)
  const [activeView, setActiveView] = useState<'view' | 'config'>('view');
  const [reportCurrency, setReportCurrency] = useState<CurrencyCode>(activeCurrency || 'USD');

  const effectiveRates = useMemo(() => ({
    ...currencyRates,
    VES: bcvRate || currencyRates?.VES || 1,
    COP: currencyRates?.COP || 1,
    EUR: currencyRates?.EUR || 1,
    USD: 1
  }), [currencyRates, bcvRate]);

  useEffect(() => {
    if (activeCurrency) {
      setReportCurrency(activeCurrency);
    }
  }, [activeCurrency]);

  const handleCurrencyChange = (newCurr: CurrencyCode) => {
    setReportCurrency(newCurr);
    if (onCurrencyChange) {
      onCurrencyChange(newCurr);
    }
  };

  const handleGoToConfigPanel = () => {
    if (onOpenConfigDashboard) {
      onOpenConfigDashboard();
    }
    window.dispatchEvent(new CustomEvent('bellavista_open_config_dashboard'));
  };
  
  // Local Config State
  const [reportConfigs, setReportConfigs] = useState<ReportModuleConfig[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Business Profile
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);

  // Global Filter State
  const [frequency, setFrequency] = useState<'diario' | 'semanal' | 'mensual' | 'anual'>('mensual');
  const [selectedPeriod, setSelectedPeriod] = useState<string>(''); // YYYY-MM or YYYY-MM-DD or YYYY

  // Real-time local state variables synchronized with Supabase
  const [localOrders, setLocalOrders] = useState<Order[]>(orders || []);
  const [localInvoices, setLocalInvoices] = useState<any[]>([]);
  const [localProducts, setLocalProducts] = useState<Product[]>(products || []);
  const [localCashOps, setLocalCashOps] = useState<any[]>(cashOps || []);
  const [localStoreUsers, setLocalStoreUsers] = useState<StoreUser[]>([]);
  const [localCategories, setLocalCategories] = useState<Category[]>([]);
  const [localCashSessions, setLocalCashSessions] = useState<any[]>([]);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // States for Quick Queries
  const [queryResponse, setQueryResponse] = useState<{
    title: string;
    type: 'summary' | 'text' | 'chart';
    content: React.ReactNode;
  } | null>(null);

  // Synchronize with parent props when they update
  useEffect(() => {
    if (orders && orders.length > 0) setLocalOrders(orders);
  }, [orders]);

  useEffect(() => {
    if (products && products.length > 0) setLocalProducts(products);
  }, [products]);

  useEffect(() => {
    if (cashOps && cashOps.length > 0) setLocalCashOps(cashOps);
  }, [cashOps]);

  // Helper to format date cleanly
  const getTodayLocalDateStr = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const classifyCategory = (text: string): string => {
    const lower = text.toLowerCase();
    if (lower.includes('arriendo') || lower.includes('alquiler') || lower.includes('renta')) return 'Alquiler';
    if (lower.includes('luz') || lower.includes('electricidad') || lower.includes('corpoelec')) return 'Electricidad / luz';
    if (lower.includes('agua')) return 'Agua';
    if (lower.includes('internet') || lower.includes('telefono') || lower.includes('teléfono') || lower.includes('cantv') || lower.includes('recarga')) return 'Internet / teléfono';
    if (lower.includes('patente') || lower.includes('permiso') || lower.includes('impuesto')) return 'Patente y permisos';
    if (lower.includes('sueldo') || lower.includes('salario') || lower.includes('nomina') || lower.includes('nómina')) return 'Sueldos y salarios';
    if (lower.includes('limpieza') || lower.includes('cloro') || lower.includes('desinfectante')) return 'Limpieza';
    if (lower.includes('mantenimiento') || lower.includes('reparación') || lower.includes('reparar')) return 'Mantenimiento y reparaciones';
    if (lower.includes('transporte') || lower.includes('combustible') || lower.includes('gasolina')) return 'Transporte / combustible';
    if (lower.includes('comision') || lower.includes('comisión') || lower.includes('banco') || lower.includes('punto')) return 'Comisiones bancarias / máquina de pago';
    if (lower.includes('contador') || lower.includes('contadora')) return 'Contador';
    if (lower.includes('publicidad') || lower.includes('marketing')) return 'Publicidad';
    return 'Otros gastos';
  };

  const handleQueryCuantoMes = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const monthlyExpenses = localCashOps.filter((op: any) => {
      if (op.type !== 'egreso') return false;
      const opDate = op.created_at ? new Date(op.created_at) : new Date();
      return opDate.getMonth() === currentMonth && opDate.getFullYear() === currentYear;
    });

    const totalUsd = monthlyExpenses.reduce((sum, op) => sum + (Number(op.amount) || 0), 0);
    const convertedMonthly = reportCurrency === 'USD' ? totalUsd : totalUsd * (currencyRates[reportCurrency] || 1);

    setQueryResponse({
      title: '¿Cuánto gasté este mes?',
      type: 'text',
      content: (
        <div className="space-y-2 mt-2">
          <p className="text-xs text-gray-600 font-bold leading-relaxed">
            Durante el mes actual de <span className="text-slate-900 font-extrabold capitalize">{today.toLocaleDateString('es-VE', { month: 'long' })}</span>, has registrado un total de <span className="text-slate-900 font-extrabold">{monthlyExpenses.length} gastos</span>.
          </p>
          <div className="bg-rose-50 border border-rose-100 p-3.5 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-black text-rose-500 tracking-wider">Total en {reportCurrency}</p>
              <p className="text-xl font-black text-rose-700 font-mono">{formatCurrency(convertedMonthly, reportCurrency, currencyRates)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase font-black text-rose-500 tracking-wider">Equivalente USD</p>
              <p className="text-sm font-black text-rose-600 font-mono">${totalUsd.toFixed(2)} USD</p>
            </div>
          </div>
        </div>
      )
    });
  };

  const handleQueryQueGasteMas = () => {
    const expenses = localCashOps.filter((op: any) => op.type === 'egreso');
    const categoryTotals: Record<string, number> = {};

    expenses.forEach((op) => {
      let cat = op.category;
      if (!cat && op.concept) {
        const match = op.concept.match(/\[Gasto\]\s*\[(.*?)\]/);
        if (match) {
          cat = match[1];
        } else {
          cat = classifyCategory(op.concept);
        }
      }
      cat = cat || 'Otros gastos';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(op.amount) || 0);
    });

    const sorted = Object.entries(categoryTotals)
      .map(([name, usd]) => ({ name, usd, bs: usd * bcvRate }))
      .sort((a, b) => b.usd - a.usd);

    if (sorted.length === 0) {
      setQueryResponse({
        title: '¿En qué gasté más?',
        type: 'text',
        content: <p className="text-xs text-gray-500 font-bold mt-2">Aún no hay gastos registrados para analizar categorías.</p>
      });
      return;
    }

    const highest = sorted[0];

    setQueryResponse({
      title: '¿En qué gasté más?',
      type: 'chart',
      content: (
        <div className="space-y-4 mt-2">
          <p className="text-xs text-gray-600 font-bold">
            La categoría con mayor gasto acumulado es <span className="text-rose-700 font-black">{highest.name}</span> con un total de <span className="font-mono text-slate-900 font-black">${highest.usd.toFixed(2)} USD</span>.
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {sorted.map((item, idx) => {
              const percentage = (item.usd / highest.usd) * 100;
              return (
                <div key={item.name} className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold text-gray-700">
                    <span className="truncate max-w-[180px]">{idx + 1}. {item.name}</span>
                    <span className="font-mono text-slate-900 font-black">${item.usd.toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-rose-600 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )
    });
  };

  const handleQueryResumenCompleto = () => {
    const todayStr = getTodayLocalDateStr();
    const today = new Date();
    
    const dailyExpenses = localCashOps.filter((op: any) => {
      if (op.type !== 'egreso') return false;
      const opDate = parseDateSafe(op.created_at || op.fecha || op.date);
      if (!opDate) return false;
      return getLocalDateString(opDate) === todayStr;
    });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const weeklyExpenses = localCashOps.filter((op: any) => {
      if (op.type !== 'egreso') return false;
      const opDate = parseDateSafe(op.created_at || op.fecha || op.date);
      if (!opDate) return false;
      return opDate >= sevenDaysAgo && opDate <= today;
    });

    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const monthlyExpenses = localCashOps.filter((op: any) => {
      if (op.type !== 'egreso') return false;
      const opDate = parseDateSafe(op.created_at || op.fecha || op.date);
      if (!opDate) return false;
      return opDate.getMonth() === currentMonth && opDate.getFullYear() === currentYear;
    });

    const categoryCounts: Record<string, number> = {};
    const categoryTotals: Record<string, number> = {};
    monthlyExpenses.forEach((op) => {
      let cat = op.category;
      if (!cat && op.concept) {
        const match = op.concept.match(/\[Gasto\]\s*\[(.*?)\]/);
        cat = match ? match[1] : classifyCategory(op.concept);
      }
      cat = cat || 'Otros gastos';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(op.amount) || 0);
    });

    const dailySum = dailyExpenses.reduce((sum, op) => sum + (Number(op.amount) || 0), 0);
    const weeklySum = weeklyExpenses.reduce((sum, op) => sum + (Number(op.amount) || 0), 0);
    const monthlySum = monthlyExpenses.reduce((sum, op) => sum + (Number(op.amount) || 0), 0);

    setQueryResponse({
      title: 'Resumen Consolidado de Gastos',
      type: 'summary',
      content: (
        <div className="space-y-4 text-left mt-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-2xl text-center">
              <p className="text-[9px] uppercase font-black text-gray-400">Hoy</p>
              <p className="text-sm font-black text-rose-700 font-mono">${dailySum.toFixed(2)}</p>
              <p className="text-[9px] text-gray-500 font-bold">{dailyExpenses.length} op</p>
            </div>
            <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-2xl text-center">
              <p className="text-[9px] uppercase font-black text-gray-400">7 Días</p>
              <p className="text-sm font-black text-rose-700 font-mono">${weeklySum.toFixed(2)}</p>
              <p className="text-[9px] text-gray-500 font-bold">{weeklyExpenses.length} op</p>
            </div>
            <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-2xl text-center">
              <p className="text-[9px] uppercase font-black text-gray-400">Este Mes</p>
              <p className="text-sm font-black text-rose-700 font-mono">${monthlySum.toFixed(2)}</p>
              <p className="text-[9px] text-gray-500 font-bold">{monthlyExpenses.length} op</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Gastos de este mes por Categoría</p>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {Object.entries(categoryTotals).length === 0 ? (
                <p className="text-xs text-gray-400 font-bold">No hay gastos en el mes actual.</p>
              ) : (
                Object.entries(categoryTotals)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, amount]) => (
                    <div key={cat} className="flex items-center justify-between text-[11px] font-bold border-b border-gray-50 pb-1">
                      <span className="text-gray-600 font-medium">{cat} ({categoryCounts[cat]})</span>
                      <span className="font-mono text-slate-900">${amount.toFixed(2)} USD</span>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )
    });
  };

  // Direct loader fetching freshest real data from Supabase / localStorage
  const fetchLatestFromDb = async () => {
    setIsSyncing(true);
    try {
      const [
        latestOrders, 
        latestInvoices, 
        latestProducts, 
        latestCashOps, 
        latestUsers, 
        latestCats, 
        latestSessions,
        profile
      ] = await Promise.all([
        dbService.getOrders(),
        dbService.getInvoices(),
        dbService.getProducts(),
        dbService.getCashOps(),
        dbService.getStoreUsers(),
        dbService.getCategories(),
        dbService.getCashSessions(),
        dbService.getBusinessProfile()
      ]);
      
      if (latestOrders) setLocalOrders(latestOrders);
      if (latestInvoices) setLocalInvoices(latestInvoices);
      if (latestProducts) setLocalProducts(latestProducts);
      if (latestCashOps) setLocalCashOps(latestCashOps);
      if (latestUsers) setLocalStoreUsers(latestUsers);
      if (latestCats) setLocalCategories(latestCats);
      if (latestSessions) setLocalCashSessions(latestSessions);
      if (profile) setBusinessProfile(profile);
      
      setLastSync(new Date());
      if (onRefreshData) {
        onRefreshData();
      }
    } catch (error) {
      console.error("Error performing real-time metrics refresh:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Setup Real-Time Subscriptions to Supabase Tables & Window Events
  useEffect(() => {
    fetchLatestFromDb();

    // Event listener for in-app updates (e.g. POS sales, manual expenses, catalog orders)
    const handleInAppUpdate = () => {
      fetchLatestFromDb();
    };

    window.addEventListener('bellavista_invoices_updated', handleInAppUpdate);
    window.addEventListener('bellavista_orders_updated', handleInAppUpdate);
    window.addEventListener('bellavista_cash_updated', handleInAppUpdate);
    window.addEventListener('bellavista_products_updated', handleInAppUpdate);
    window.addEventListener('bellavista_taxes_updated', handleInAppUpdate);
    window.addEventListener('storage', handleInAppUpdate);

    if (!supabase) {
      return () => {
        window.removeEventListener('bellavista_invoices_updated', handleInAppUpdate);
        window.removeEventListener('bellavista_orders_updated', handleInAppUpdate);
        window.removeEventListener('bellavista_cash_updated', handleInAppUpdate);
        window.removeEventListener('bellavista_products_updated', handleInAppUpdate);
        window.removeEventListener('bellavista_taxes_updated', handleInAppUpdate);
        window.removeEventListener('storage', handleInAppUpdate);
      };
    }

    // 1. Subscribe to 'orders' table
    const ordersChannel = supabase
      .channel('realtime:reports_orders_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        async () => {
          try {
            const freshOrders = await dbService.getOrders();
            if (freshOrders) {
              setLocalOrders(freshOrders);
              setLastSync(new Date());
            }
          } catch (e) {
            console.error(e);
          }
        }
      )
      .subscribe();

    // 2. Subscribe to 'invoices' table (Ventas Flash POS)
    const invoicesChannel = supabase
      .channel('realtime:reports_invoices_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoices' },
        async () => {
          try {
            const freshInvoices = await dbService.getInvoices();
            if (freshInvoices) {
              setLocalInvoices(freshInvoices);
              setLastSync(new Date());
            }
          } catch (e) {
            console.error(e);
          }
        }
      )
      .subscribe();

    // 3. Subscribe to 'products' table
    const productsChannel = supabase
      .channel('realtime:reports_products_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        async () => {
          try {
            const freshProducts = await dbService.getProducts();
            if (freshProducts) {
              setLocalProducts(freshProducts);
              setLastSync(new Date());
            }
          } catch (e) {
            console.error(e);
          }
        }
      )
      .subscribe();

    // 4. Subscribe to 'cash_ops' table (egresos / ingresos / transacciones de caja)
    const cashOpsChannel = supabase
      .channel('realtime:reports_cash_ops_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cash_ops' },
        async () => {
          try {
            const freshOps = await dbService.getCashOps();
            if (freshOps) {
              setLocalCashOps(freshOps);
              setLastSync(new Date());
            }
          } catch (e) {
            console.error(e);
          }
        }
      )
      .subscribe();

    // 5. Subscribe to 'cash_sessions' table
    const cashSessionsChannel = supabase
      .channel('realtime:reports_cash_sessions_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cash_sessions' },
        async () => {
          try {
            const freshSessions = await dbService.getCashSessions();
            if (freshSessions) {
              setLocalCashSessions(freshSessions);
              setLastSync(new Date());
            }
          } catch (e) {
            console.error(e);
          }
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('bellavista_invoices_updated', handleInAppUpdate);
      window.removeEventListener('bellavista_orders_updated', handleInAppUpdate);
      window.removeEventListener('bellavista_cash_updated', handleInAppUpdate);
      window.removeEventListener('bellavista_products_updated', handleInAppUpdate);
      window.removeEventListener('bellavista_taxes_updated', handleInAppUpdate);
      window.removeEventListener('storage', handleInAppUpdate);

      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(invoicesChannel);
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(cashOpsChannel);
      supabase.removeChannel(cashSessionsChannel);
    };
  }, []);

  // Load configuration from database
  const loadReportsConfig = async () => {
    try {
      setLoadingConfig(true);
      const configs = await dbService.getReportModulesConfig();
      setReportConfigs(configs);
    } catch (err) {
      console.error("Error loading report configs:", err);
      setErrorMsg("No se pudo cargar la configuración de reportes.");
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    loadReportsConfig();
    const handleModulesUpdated = () => {
      loadReportsConfig();
    };
    window.addEventListener('bellavista_report_modules_updated', handleModulesUpdated);
    return () => {
      window.removeEventListener('bellavista_report_modules_updated', handleModulesUpdated);
    };
  }, []);

  // Safe Date parsing using resilient universal date parser
  const parseDateSafe = (dateStr?: string | Date | number | null): Date | null => {
    return parseUniversalDate(dateStr);
  };

  // Sync available periods dynamically based on all real database records
  const availablePeriods = useMemo(() => {
    const periodsSet = new Set<string>();
    
    // Always include today's period
    const now = new Date();
    periodsSet.add(getPeriodKeyForDate(now, frequency));

    // For weekly frequency, ensure current week and past 8 weeks are always available for seamless browsing
    if (frequency === 'semanal') {
      for (let i = 0; i <= 8; i++) {
        const pastWeekDate = new Date(now);
        pastWeekDate.setDate(now.getDate() - (i * 7));
        periodsSet.add(getPeriodKeyForDate(pastWeekDate, 'semanal'));
      }
    }

    // For daily frequency, ensure past 7 days are available
    if (frequency === 'diario') {
      for (let i = 0; i <= 7; i++) {
        const pastDayDate = new Date(now);
        pastDayDate.setDate(now.getDate() - i);
        periodsSet.add(getPeriodKeyForDate(pastDayDate, 'diario'));
      }
    }

    // For weekly frequency, ensure past 8 weeks are available
    if (frequency === 'semanal') {
      for (let i = 0; i <= 8; i++) {
        const pastWeekDate = new Date(now);
        pastWeekDate.setDate(now.getDate() - (i * 7));
        periodsSet.add(getPeriodKeyForDate(pastWeekDate, 'semanal'));
      }
    }

    // For monthly frequency, ensure current year's months are available
    if (frequency === 'mensual') {
      const currentYear = now.getFullYear();
      for (let m = 1; m <= 12; m++) {
        periodsSet.add(`${currentYear}-${String(m).padStart(2, '0')}`);
      }
    }

    // For annual frequency, ensure current year and past 5 years are available
    if (frequency === 'anual') {
      const currentYear = now.getFullYear();
      for (let y = currentYear; y >= currentYear - 5; y--) {
        periodsSet.add(String(y));
      }
    }

    // Register dates from actual invoices (POS Venta Flash)
    localInvoices.forEach(inv => {
      const d = parseDateSafe(inv.created_at);
      if (d) periodsSet.add(getPeriodKeyForDate(d, frequency));
    });

    // Register dates from actual orders
    localOrders.forEach(order => {
      const d = parseDateSafe(order.created_at);
      if (d) periodsSet.add(getPeriodKeyForDate(d, frequency));
    });

    // Register dates from actual cash operations
    localCashOps.forEach(op => {
      const d = parseDateSafe(op.created_at);
      if (d) periodsSet.add(getPeriodKeyForDate(d, frequency));
    });

    const list = Array.from(periodsSet).sort().reverse();
    return list;
  }, [localInvoices, localOrders, localCashOps, frequency]);

  // Map of operation counts per period key for the current frequency
  const periodDataCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    localInvoices.forEach(inv => {
      const d = parseDateSafe(inv.created_at);
      if (d) {
        const k = getPeriodKeyForDate(d, frequency);
        counts[k] = (counts[k] || 0) + 1;
      }
    });
    localOrders.forEach(ord => {
      const d = parseDateSafe(ord.created_at);
      if (d) {
        const k = getPeriodKeyForDate(d, frequency);
        counts[k] = (counts[k] || 0) + 1;
      }
    });
    localCashOps.forEach(op => {
      const d = parseDateSafe(op.created_at);
      if (d) {
        const k = getPeriodKeyForDate(d, frequency);
        counts[k] = (counts[k] || 0) + 1;
      }
    });
    return counts;
  }, [localInvoices, localOrders, localCashOps, frequency]);

  const handleFrequencyChange = (newFreq: 'diario' | 'semanal' | 'mensual' | 'anual') => {
    setFrequency(newFreq);
    fetchLatestFromDb();

    // Map currently selected period to a base Date
    let baseDate: Date = new Date();
    if (selectedPeriod) {
      if (selectedPeriod.endsWith('_W')) {
        const clean = selectedPeriod.replace('_W', '');
        baseDate = parseUniversalDate(clean) || new Date();
      } else if (selectedPeriod.includes('-')) {
        const parts = selectedPeriod.split('-');
        if (parts.length === 2) {
          baseDate = parseUniversalDate(`${selectedPeriod}-01`) || new Date();
        } else if (parts.length === 3) {
          baseDate = parseUniversalDate(selectedPeriod) || new Date();
        }
      } else if (/^\d{4}$/.test(selectedPeriod)) {
        baseDate = parseUniversalDate(`${selectedPeriod}-01-01`) || new Date();
      }
    }

    const newKey = getPeriodKeyForDate(baseDate, newFreq);
    setSelectedPeriod(newKey);
  };

  // Auto-set the latest available period when frequency or available list changes
  useEffect(() => {
    if (!selectedPeriod || !availablePeriods.includes(selectedPeriod)) {
      const now = new Date();
      const currentKey = getPeriodKeyForDate(now, frequency);

      if (availablePeriods.includes(currentKey)) {
        setSelectedPeriod(currentKey);
      } else if (availablePeriods.length > 0) {
        const activePeriod = availablePeriods.find(p => (periodDataCounts[p] || 0) > 0);
        setSelectedPeriod(activePeriod || availablePeriods[0]);
      }
    }
  }, [frequency, availablePeriods, periodDataCounts, selectedPeriod]);

  // Translate code/label for the periods in Spanish
  const formatPeriodLabel = (period: string) => {
    if (!period) return '';
    const now = new Date();
    const todayStr = getLocalDateString(now);
    const currentWeekKey = getPeriodKeyForDate(now, 'semanal');
    const opCount = periodDataCounts[period] || 0;
    const countBadge = opCount > 0 ? ` • ${opCount} ops` : '';

    try {
      if (frequency === 'mensual') {
        const [y, m] = period.split('-');
        const monthNames = [
          'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        const isCurrentMonth = y === String(now.getFullYear()) && parseInt(m) === (now.getMonth() + 1);
        return `${monthNames[parseInt(m) - 1] || m} ${y}${isCurrentMonth ? ' (Mes Actual)' : ''}${countBadge}`;
      }
      if (frequency === 'diario') {
        const [y, m, d] = period.split('-');
        const isToday = period === todayStr;
        const monthNamesShort = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const mShort = monthNamesShort[parseInt(m) - 1] || m;
        return `${d} ${mShort} ${y}${isToday ? ' (Hoy)' : ''}${countBadge}`;
      }
      if (frequency === 'semanal') {
        const isCurrentWeek = period === currentWeekKey;
        const datePart = period.replace('_W', '');
        const [y, m, d] = datePart.split('-');
        const startDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        return `Semana del ${startDate.getDate()}/${startDate.getMonth() + 1} al ${endDate.getDate()}/${endDate.getMonth() + 1} (${y})${isCurrentWeek ? ' (Actual)' : ''}${countBadge}`;
      }
      return `Año ${period}${countBadge}`;
    } catch (e) {
      return period;
    }
  };

  // Navigate periods with buttons (previous / next)
  const handleNavigatePeriod = (direction: 'prev' | 'next') => {
    const currentIndex = availablePeriods.indexOf(selectedPeriod);
    if (currentIndex === -1) return;
    if (direction === 'prev' && currentIndex < availablePeriods.length - 1) {
      setSelectedPeriod(availablePeriods[currentIndex + 1]);
    } else if (direction === 'next' && currentIndex > 0) {
      setSelectedPeriod(availablePeriods[currentIndex - 1]);
    }
  };

  // Helper to safely fetch order totals in USD
  const getOrderTotalUSD = (order: Order): number => {
    if ('totalUSD' in order && typeof (order as any).totalUSD === 'number' && (order as any).totalUSD > 0) {
      return (order as any).totalUSD;
    }
    if (typeof order.total_price === 'number' && order.total_price > 0) {
      return order.total_price;
    }
    if (typeof order.total_price === 'string') {
      const parsed = parseFloat(order.total_price);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    if (order.items && Array.isArray(order.items) && order.items.length > 0) {
      return order.items.reduce((acc, it) => acc + (parseFloat(String(it.price)) || 0) * (parseFloat(String(it.quantity)) || 1), 0);
    }
    return 0;
  };

  // Helper to safely fetch invoice totals in USD
  const getInvoiceTotalUSD = (inv: any): number => {
    if (typeof inv.total === 'number') return inv.total;
    if (typeof inv.total === 'string') {
      const p = parseFloat(inv.total);
      if (!isNaN(p)) return p;
    }
    if (inv.items && Array.isArray(inv.items) && inv.items.length > 0) {
      return inv.items.reduce((acc: number, it: any) => {
        const q = parseFloat(String(it.qty || it.quantity || 1)) || 1;
        const pr = parseFloat(String(it.price || 0)) || 0;
        return acc + (q * pr);
      }, 0);
    }
    return 0;
  };

  // Helper to get active transaction exchange rate from database/settings
  const getTransactionRate = (item: any, targetCurrency: CurrencyCode): number => {
    if (targetCurrency === 'USD') return 1;
    return effectiveRates[targetCurrency] || currencyRates[targetCurrency] || (targetCurrency === 'VES' ? (bcvRate || 1) : 1);
  };

  const getTransactionAmountInCurrency = (item: any, targetCurrency: CurrencyCode): number => {
    let rawTotal = 0;
    if (typeof item.total === 'number') rawTotal = item.total;
    else if (typeof item.total === 'string') rawTotal = parseFloat(item.total) || 0;
    else if (typeof item.total_price === 'number') rawTotal = item.total_price;
    else if (typeof item.total_price === 'string') rawTotal = parseFloat(item.total_price) || 0;
    else if (typeof item.amount === 'number') rawTotal = item.amount;
    else if (typeof item.amount === 'string') rawTotal = parseFloat(item.amount) || 0;
    else if (item.items && Array.isArray(item.items) && item.items.length > 0) {
      rawTotal = item.items.reduce((acc: number, it: any) => {
        const q = parseFloat(String(it.qty || it.quantity || 1)) || 1;
        const pr = parseFloat(String(it.price || it.unit_price || 0)) || 0;
        return acc + (q * pr);
      }, 0);
    }

    if (rawTotal <= 0) return 0;

    const itemCurrency = (item.currency_code || 'USD').toUpperCase();
    
    // Normalize to base USD amount first using database rate if item was in local currency
    let usdAmount = rawTotal;
    if (itemCurrency === 'VES') {
      const invRate = Number(item.bcv_rate || currencyRates?.VES || bcvRate);
      usdAmount = invRate > 0 ? rawTotal / invRate : rawTotal;
    } else if (itemCurrency === 'EUR') {
      const invRate = Number(currencyRates?.EUR);
      usdAmount = invRate > 0 ? rawTotal / invRate : rawTotal;
    } else if (itemCurrency === 'COP') {
      const invRate = Number(currencyRates?.COP);
      usdAmount = invRate > 0 ? rawTotal / invRate : rawTotal;
    }

    if (targetCurrency === 'USD') return usdAmount;

    const rate = getTransactionRate(item, targetCurrency);
    return usdAmount * rate;
  };

  // -------------------------------------------------------------
  // REAL-TIME DATA CALCULATION & UNIFICATION ENGINE (WITH HISTORICAL TRANSACTION RATES)
  // -------------------------------------------------------------
  const metrics = useMemo(() => {
    let totalSales = 0;
    let totalCost = 0;
    let totalTransactions = 0;

    const productSalesMap: Record<string, { product_id?: string; name: string; sku: string; qty: number; sales: number; cost: number; category_id?: string }> = {};
    const clientSalesMap: Record<string, { name: string; count: number; total: number }> = {};
    const sellerSalesMap: Record<string, { name: string; count: number; sales: number }> = {};
    const categorySalesMap: Record<string, number> = {};

    // Track processed invoice IDs and control numbers to prevent double counting
    const processedInvoiceKeys = new Set<string>();

    // 1. PROCESS INVOICES (Ventas Flash POS) matching period
    const filteredInvoices = localInvoices.filter(inv => {
      const d = parseDateSafe(inv.created_at);
      if (!d) return false;
      return getPeriodKeyForDate(d, frequency) === selectedPeriod;
    });

    filteredInvoices.forEach(inv => {
      const invTotalReportCurr = getTransactionAmountInCurrency(inv, reportCurrency);
      if (invTotalReportCurr <= 0 && (!inv.items || inv.items.length === 0)) return;

      const rate = getTransactionRate(inv, reportCurrency);

      totalSales += invTotalReportCurr;
      totalTransactions += 1;

      const invKey = inv.control_number || inv.id;
      if (invKey) processedInvoiceKeys.add(String(invKey).toLowerCase());

      // Client
      const clientName = (inv.customer_name || '').trim() || 'Consumidor final';
      if (!clientSalesMap[clientName]) {
        clientSalesMap[clientName] = { name: clientName, count: 0, total: 0 };
      }
      clientSalesMap[clientName].count += 1;
      clientSalesMap[clientName].total += invTotalReportCurr;

      // Seller / Cashier
      let sellerName = inv.seller_name || '';
      if (!sellerName && inv.notes) {
        const match = inv.notes.match(/(?:Vendedor|Cajero|Atendido por):\s*([^|\n,]+)/i);
        if (match) sellerName = match[1].trim();
      }
      if (!sellerName) {
        sellerName = 'Venta Flash (Caja POS)';
      }
      if (!sellerSalesMap[sellerName]) {
        sellerSalesMap[sellerName] = { name: sellerName, count: 0, sales: 0 };
      }
      sellerSalesMap[sellerName].count += 1;
      sellerSalesMap[sellerName].sales += invTotalReportCurr;

      // Items
      let invCostReportCurr = 0;
      if (inv.items && Array.isArray(inv.items) && inv.items.length > 0) {
        inv.items.forEach((item: any) => {
          const qty = parseFloat(String(item.qty || item.quantity || 1)) || 1;
          const price = parseFloat(String(item.price || 0)) || 0;
          const itemTotalUSD = price * qty;
          const itemTotalReportCurr = itemTotalUSD * rate;

          // Match product in catalog
          const productRef = localProducts.find(p => 
            (item.product_id && p.id === item.product_id) || 
            (item.id && p.id === item.id) ||
            (item.sku && p.sku && p.sku.toLowerCase() === item.sku.toLowerCase()) ||
            (p.name && item.name && p.name.toLowerCase() === item.name.toLowerCase())
          );

          let itemUnitCostUSD = 0;
          if (productRef && typeof productRef.cost_price === 'number' && productRef.cost_price > 0) {
            itemUnitCostUSD = productRef.cost_price;
          } else if (item.cost_price && typeof item.cost_price === 'number' && item.cost_price > 0) {
            itemUnitCostUSD = item.cost_price;
          } else {
            const margin = productRef?.margin_1 ? Math.min(Math.max(productRef.margin_1, 5), 80) : 30;
            itemUnitCostUSD = price * (1 - margin / 100);
          }

          const itemTotalCostReportCurr = itemUnitCostUSD * qty * rate;
          invCostReportCurr += itemTotalCostReportCurr;

          const categoryId = productRef?.category_id || (productRef as any)?.category || '';
          if (categoryId) {
            categorySalesMap[categoryId] = (categorySalesMap[categoryId] || 0) + itemTotalReportCurr;
          }

          const key = item.product_id || item.id || item.sku || item.name || 'item';
          if (!productSalesMap[key]) {
            productSalesMap[key] = {
              product_id: item.product_id || item.id,
              name: item.name || productRef?.name || 'Artículo sin nombre',
              sku: item.sku || productRef?.sku || '',
              qty: 0,
              sales: 0,
              cost: 0,
              category_id: categoryId
            };
          }
          productSalesMap[key].qty += qty;
          productSalesMap[key].sales += itemTotalReportCurr;
          productSalesMap[key].cost += itemTotalCostReportCurr;
        });
      } else {
        invCostReportCurr = invTotalReportCurr * 0.7;
      }
      totalCost += invCostReportCurr;
    });

    // 2. PROCESS ORDERS (Tienda Online / Pedidos de Mostrador) matching period
    const filteredOrders = localOrders.filter(order => {
      const status = (order.status || '').toLowerCase();
      if (status === 'cancelado' || status === 'anulado' || status === 'rechazado') {
        return false;
      }
      const d = parseDateSafe(order.created_at);
      if (!d) return false;
      return getPeriodKeyForDate(d, frequency) === selectedPeriod;
    });

    filteredOrders.forEach(order => {
      const orderTotalReportCurr = getTransactionAmountInCurrency(order, reportCurrency);
      const rate = getTransactionRate(order, reportCurrency);

      totalSales += orderTotalReportCurr;
      totalTransactions += 1;

      // Client
      const clientName = (order.customer_name || '').trim() || 'Cliente Mostrador';
      if (!clientSalesMap[clientName]) {
        clientSalesMap[clientName] = { name: clientName, count: 0, total: 0 };
      }
      clientSalesMap[clientName].count += 1;
      clientSalesMap[clientName].total += orderTotalReportCurr;

      // Seller / Cashier
      let sellerName = order.seller_name || '';
      if (!sellerName && order.comments) {
        const match = order.comments.match(/(?:Vendedor|Cajero|Atendido por):\s*([^|\n,]+)/i);
        if (match) sellerName = match[1].trim();
      }
      if (!sellerName) {
        sellerName = 'Ventas Online / Mostrador';
      }
      if (!sellerSalesMap[sellerName]) {
        sellerSalesMap[sellerName] = { name: sellerName, count: 0, sales: 0 };
      }
      sellerSalesMap[sellerName].count += 1;
      sellerSalesMap[sellerName].sales += orderTotalReportCurr;

      // Items
      let orderCostReportCurr = 0;
      if (order.items && Array.isArray(order.items) && order.items.length > 0) {
        order.items.forEach(item => {
          const qty = parseFloat(String(item.quantity)) || 1;
          const price = parseFloat(String(item.price)) || 0;
          const itemTotalUSD = price * qty;
          const itemTotalReportCurr = itemTotalUSD * rate;

          const productRef = localProducts.find(p => 
            (item.product_id && p.id === item.product_id) || 
            (item.sku && p.sku && p.sku.toLowerCase() === item.sku.toLowerCase()) ||
            (p.name && item.name && p.name.toLowerCase() === item.name.toLowerCase())
          );

          let itemUnitCostUSD = 0;
          if (productRef && typeof productRef.cost_price === 'number' && productRef.cost_price > 0) {
            itemUnitCostUSD = productRef.cost_price;
          } else if (item.cost_price && typeof item.cost_price === 'number' && item.cost_price > 0) {
            itemUnitCostUSD = item.cost_price;
          } else {
            const margin = productRef?.margin_1 ? Math.min(Math.max(productRef.margin_1, 5), 80) : 30;
            itemUnitCostUSD = price * (1 - margin / 100);
          }

          const itemTotalCostReportCurr = itemUnitCostUSD * qty * rate;
          orderCostReportCurr += itemTotalCostReportCurr;

          const categoryId = productRef?.category_id || (productRef as any)?.category || '';
          if (categoryId) {
            categorySalesMap[categoryId] = (categorySalesMap[categoryId] || 0) + itemTotalReportCurr;
          }

          const key = item.product_id || item.sku || item.name || 'item';
          if (!productSalesMap[key]) {
            productSalesMap[key] = {
              product_id: item.product_id,
              name: item.name || productRef?.name || 'Artículo sin nombre',
              sku: item.sku || productRef?.sku || '',
              qty: 0,
              sales: 0,
              cost: 0,
              category_id: categoryId
            };
          }
          productSalesMap[key].qty += qty;
          productSalesMap[key].sales += itemTotalReportCurr;
          productSalesMap[key].cost += itemTotalCostReportCurr;
        });
      } else {
        orderCostReportCurr = orderTotalReportCurr * 0.7;
      }
      totalCost += orderCostReportCurr;
    });

    // 3. CHECK CASH OPS FOR ADDITIONAL INCOMES OR SALES (Synchronizing Balance)
    const filteredCashOps = localCashOps.filter(op => {
      const d = parseDateSafe(op.created_at);
      if (!d) return false;
      return getPeriodKeyForDate(d, frequency) === selectedPeriod;
    });

    filteredCashOps.forEach(op => {
      if (op.type === 'ingreso') {
        const concept = op.concept || '';
        // Skip opening cash session fund
        if (concept === 'Apertura de Caja - Fondo Inicial') return;

        // Check if this cash op was generated by an invoice that was already processed
        let isAlreadyProcessedInvoice = false;
        const facMatch = concept.match(/FAC-\d+/i);
        if (facMatch) {
          const facCode = facMatch[0].toLowerCase();
          if (processedInvoiceKeys.has(facCode)) {
            isAlreadyProcessedInvoice = true;
          }
        }

        // If not already counted in invoices, add it so revenue is 100% in sync with Balance
        if (!isAlreadyProcessedInvoice) {
          const amtReportCurr = getTransactionAmountInCurrency(op, reportCurrency);

          totalSales += amtReportCurr;
          totalCost += (amtReportCurr * 0.7);
          totalTransactions += 1;

          // Client from concept
          let clientName = 'Cliente Caja';
          const clientMatch = concept.match(/\((.*?)\)/);
          if (clientMatch && clientMatch[1]) {
            clientName = clientMatch[1].trim();
          }
          if (!clientSalesMap[clientName]) {
            clientSalesMap[clientName] = { name: clientName, count: 0, total: 0 };
          }
          clientSalesMap[clientName].count += 1;
          clientSalesMap[clientName].total += amtReportCurr;

          // Seller
          const sellerName = op.empleado_nombre || 'Cajero de Turno';
          if (!sellerSalesMap[sellerName]) {
            sellerSalesMap[sellerName] = { name: sellerName, count: 0, sales: 0 };
          }
          sellerSalesMap[sellerName].count += 1;
          sellerSalesMap[sellerName].sales += amtReportCurr;
        }
      }
    });

    // 4. PROCESS EXPENSES (Egresos de caja)
    let totalExpenses = 0;
    const expensesByCategory: Record<string, number> = {};

    filteredCashOps.forEach(op => {
      if (op.type === 'egreso') {
        const concept = op.concept || '';
        // Skip closing session transfer if needed
        if (concept === 'Cierre de Caja - Entrega de Efectivo (Arqueo)') return;

        const amountReportCurr = getTransactionAmountInCurrency(op, reportCurrency);

        totalExpenses += amountReportCurr;

        const lowerConcept = concept.toLowerCase();
        const cat = (op.category || '').trim();

        let categoryName = cat;
        if (!categoryName) {
          if (lowerConcept.includes('nomina') || lowerConcept.includes('nómina') || lowerConcept.includes('sueldo') || lowerConcept.includes('salario')) {
            categoryName = 'Nómina y Sueldos';
          } else if (lowerConcept.includes('compra') || lowerConcept.includes('mercancia') || lowerConcept.includes('mercancía') || lowerConcept.includes('proveedor') || lowerConcept.includes('inventario')) {
            categoryName = 'Mercancía y Proveedores';
          } else if (lowerConcept.includes('alquiler') || lowerConcept.includes('arriendo') || lowerConcept.includes('local')) {
            categoryName = 'Alquiler / Arriendo';
          } else if (lowerConcept.includes('luz') || lowerConcept.includes('agua') || lowerConcept.includes('internet') || lowerConcept.includes('servicio')) {
            categoryName = 'Servicios Públicos';
          } else if (lowerConcept.includes('delivery') || lowerConcept.includes('transporte') || lowerConcept.includes('flete') || lowerConcept.includes('gasolina')) {
            categoryName = 'Transporte y Envíos';
          } else if (lowerConcept.includes('papel') || lowerConcept.includes('toner') || lowerConcept.includes('insumo') || lowerConcept.includes('material')) {
            categoryName = 'Materiales e Insumos';
          } else {
            categoryName = 'Otros Gastos Operativos';
          }
        }

        expensesByCategory[categoryName] = (expensesByCategory[categoryName] || 0) + amountReportCurr;
      }
    });

    const totalProfit = Math.max(0, totalSales - totalCost);
    const marginPercent = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;
    const avgSale = totalTransactions > 0 ? totalSales / totalTransactions : 0;

    // 5. TOP 10 PRODUCTS RANKED
    const topProducts = Object.values(productSalesMap)
      .map(item => ({
        ...item,
        profit: Math.max(0, item.sales - item.cost)
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);

    // 6. TOP 10 CLIENTS RANKED
    const topClients = Object.values(clientSalesMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // 7. TOP 10 EMPLOYEES / EQUIPOS RANKED
    let topEmployees = Object.values(sellerSalesMap)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);

    if (topEmployees.length === 0 && localStoreUsers.length > 0) {
      localStoreUsers.forEach(u => {
        topEmployees.push({
          name: u.name || u.email || 'Usuario',
          count: 0,
          sales: 0
        });
      });
      topEmployees = topEmployees.slice(0, 10);
    }

    // 8. LEADING CATEGORY
    let leadingCategoryName = 'General';
    let maxCatSales = -1;
    Object.entries(categorySalesMap).forEach(([catId, sales]) => {
      if (sales > maxCatSales) {
        maxCatSales = sales;
        const foundCat = localCategories.find(c => c.id === catId);
        leadingCategoryName = foundCat?.name || catId;
      }
    });
    if (leadingCategoryName === 'General' && topProducts.length > 0) {
      leadingCategoryName = 'Papelería y Oficina';
    }

    // 9. DYNAMIC TREND POINTS FOR CHARTS
    const evolutionPoints = availablePeriods.slice(0, 6).reverse().map(periodKey => {
      let pSales = 0;

      // Invoices
      localInvoices.forEach(inv => {
        const d = parseDateSafe(inv.created_at);
        if (d && getPeriodKeyForDate(d, frequency) === periodKey) {
          pSales += getTransactionAmountInCurrency(inv, reportCurrency);
        }
      });

      // Orders
      localOrders.forEach(o => {
        const st = (o.status || '').toLowerCase();
        if (st === 'cancelado' || st === 'anulado') return;
        const d = parseDateSafe(o.created_at);
        if (d && getPeriodKeyForDate(d, frequency) === periodKey) {
          pSales += getTransactionAmountInCurrency(o, reportCurrency);
        }
      });

      // Cash Ops
      localCashOps.forEach(op => {
        if (op.type === 'ingreso' && op.concept !== 'Apertura de Caja - Fondo Inicial') {
          const d = parseDateSafe(op.created_at);
          if (d && getPeriodKeyForDate(d, frequency) === periodKey) {
            const facMatch = (op.concept || '').match(/FAC-\d+/i);
            if (!facMatch) {
              pSales += getTransactionAmountInCurrency(op, reportCurrency);
            }
          }
        }
      });

      const pProfit = pSales * 0.4;

      let label = periodKey;
      if (frequency === 'mensual') {
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const parts = periodKey.split('-');
        if (parts[1]) label = monthNames[parseInt(parts[1]) - 1] || parts[1];
      } else if (frequency === 'diario') {
        const parts = periodKey.split('-');
        if (parts[2]) label = `${parts[2]}/${parts[1]}`;
      } else if (frequency === 'semanal') {
        const datePart = periodKey.replace('_W', '');
        const parts = datePart.split('-');
        label = `${parts[2]}/${parts[1]}`;
      }

      return {
        key: periodKey,
        label,
        sales: pSales,
        profit: pProfit
      };
    });

    // Multi-Currency Breakdown Tracking
    const multiCurrencySummary: Record<'USD' | 'VES' | 'EUR' | 'COP', { native: number; inReportCurrency: number; count: number }> = {
      USD: { native: 0, inReportCurrency: 0, count: 0 },
      VES: { native: 0, inReportCurrency: 0, count: 0 },
      EUR: { native: 0, inReportCurrency: 0, count: 0 },
      COP: { native: 0, inReportCurrency: 0, count: 0 }
    };
    const paymentMethodsMap: Record<string, { method: string; currency: CurrencyCode; nativeTotal: number; inReportCurrencyTotal: number; count: number }> = {};
    let splitPaymentsCount = 0;

    const registerPaymentBreakdown = (
      methodName: string, 
      itemTotalUSD: number, 
      itemSplitPayments?: any[] | null, 
      itemCurrencyCode?: string | null, 
      itemRates?: Record<string, number> | null,
      itemRecord?: any
    ) => {
      const histRate = (c: CurrencyCode) => {
        if (c === 'USD') return 1;
        if (itemRates && itemRates[c]) return Number(itemRates[c]);
        if (itemRecord) return getTransactionRate(itemRecord, c);
        return currencyRates[c] || 1;
      };
      const targetRate = histRate(reportCurrency);

      if (itemSplitPayments && Array.isArray(itemSplitPayments) && itemSplitPayments.length > 0) {
        splitPaymentsCount += 1;
        itemSplitPayments.forEach(sp => {
          const spMethod = sp.method || 'Multimétodo';
          const spCurr = (sp.currency as CurrencyCode) || (spMethod.toLowerCase().includes('bs') || spMethod.toLowerCase().includes('pago móvil') || spMethod.toLowerCase().includes('punto') ? 'VES' : 'USD');
          const activeR = histRate(spCurr);
          const spUsd = sp.amount_usd || (spCurr === 'USD' ? sp.amount : sp.amount / activeR);
          const spNative = sp.amount || (spUsd * activeR);
          const spReportCurr = reportCurrency === 'USD' ? spUsd : spUsd * targetRate;

          if (multiCurrencySummary[spCurr]) {
            multiCurrencySummary[spCurr].native += spNative;
            multiCurrencySummary[spCurr].inReportCurrency += spReportCurr;
            multiCurrencySummary[spCurr].count += 1;
          }

          const methodKey = `${spMethod} (${spCurr})`;
          if (!paymentMethodsMap[methodKey]) {
            paymentMethodsMap[methodKey] = {
              method: spMethod,
              currency: spCurr,
              nativeTotal: 0,
              inReportCurrencyTotal: 0,
              count: 0
            };
          }
          paymentMethodsMap[methodKey].nativeTotal += spNative;
          paymentMethodsMap[methodKey].inReportCurrencyTotal += spReportCurr;
          paymentMethodsMap[methodKey].count += 1;
        });
      } else {
        const lowerMethod = (methodName || 'Efectivo').toLowerCase();
        let curr: CurrencyCode = 'USD';
        if (itemCurrencyCode && ['USD', 'VES', 'EUR', 'COP'].includes(itemCurrencyCode)) {
          curr = itemCurrencyCode as CurrencyCode;
        } else if (lowerMethod.includes('ves') || lowerMethod.includes('bs') || lowerMethod.includes('pago móvil') || lowerMethod.includes('punto') || lowerMethod.includes('biopago')) {
          curr = 'VES';
        } else if (lowerMethod.includes('eur') || lowerMethod.includes('euro')) {
          curr = 'EUR';
        } else if (lowerMethod.includes('cop') || lowerMethod.includes('peso')) {
          curr = 'COP';
        }

        const currRate = histRate(curr);
        const nativeAmt = curr === 'USD' ? itemTotalUSD : itemTotalUSD * currRate;
        const reportCurrAmt = reportCurrency === 'USD' ? itemTotalUSD : itemTotalUSD * targetRate;

        if (multiCurrencySummary[curr]) {
          multiCurrencySummary[curr].native += nativeAmt;
          multiCurrencySummary[curr].inReportCurrency += reportCurrAmt;
          multiCurrencySummary[curr].count += 1;
        }

        const methodKey = `${methodName || 'Efectivo'} (${curr})`;
        if (!paymentMethodsMap[methodKey]) {
          paymentMethodsMap[methodKey] = {
            method: methodName || 'Efectivo',
            currency: curr,
            nativeTotal: 0,
            inReportCurrencyTotal: 0,
            count: 0
          };
        }
        paymentMethodsMap[methodKey].nativeTotal += nativeAmt;
        paymentMethodsMap[methodKey].inReportCurrencyTotal += reportCurrAmt;
        paymentMethodsMap[methodKey].count += 1;
      }
    };

    // Calculate multi-currency breakdowns across all sales
    filteredInvoices.forEach(inv => {
      registerPaymentBreakdown(inv.payment_method, getInvoiceTotalUSD(inv), inv.split_payments, inv.currency_code, inv.currency_rates_snapshot, inv);
    });

    filteredOrders.forEach(o => {
      registerPaymentBreakdown(o.payment_method || 'Online', getOrderTotalUSD(o), o.split_payments, o.currency_code, o.currency_rates_snapshot, o);
    });

    filteredCashOps.forEach(op => {
      if (op.type === 'ingreso' && op.concept !== 'Apertura de Caja - Fondo Inicial') {
        const facMatch = (op.concept || '').match(/FAC-\d+/i);
        if (!facMatch) {
          const amt = parseFloat(String(op.amount)) || 0;
          registerPaymentBreakdown(op.payment_method || 'Caja Directa', amt, op.split_payments, op.currency_code, op.currency_rates_snapshot, op);
        }
      }
    });

    const paymentMethodsBreakdown = Object.values(paymentMethodsMap)
      .map(pm => ({
        ...pm,
        percentage: totalSales > 0 ? (pm.inReportCurrencyTotal / totalSales) * 100 : 0
      }))
      .sort((a, b) => b.inReportCurrencyTotal - a.inReportCurrencyTotal);

    return {
      totalSales,
      totalCost,
      totalProfit,
      marginPercent,
      totalTransactions,
      avgSale,
      topProducts,
      topClients,
      topEmployees,
      totalExpenses,
      expensesByCategory,
      leadingCategory: leadingCategoryName,
      evolutionPoints,
      totalTransactionsCount: totalTransactions,
      multiCurrencySummary,
      paymentMethodsBreakdown,
      splitPaymentsCount
    };
  }, [
    localInvoices, 
    localOrders, 
    localCashOps, 
    localProducts, 
    localStoreUsers, 
    localCategories, 
    frequency, 
    selectedPeriod, 
    availablePeriods, 
    reportCurrency, 
    currencyRates
  ]);

  // Convert values to formatted currency string
  const formatValue = (val: number) => {
    return formatCurrency(val, reportCurrency, currencyRates);
  };

  // Handle reordering / switches in Config view
  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= reportConfigs.length) return;

    const updated = [...reportConfigs];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    const sorted = updated.map((item, idx) => ({ ...item, sort_order: idx + 1 }));
    setReportConfigs(sorted);
  };

  const toggleItemActive = (id: string) => {
    const updated = reportConfigs.map(item => {
      if (item.id === id) {
        return { ...item, enabled: !item.enabled };
      }
      return item;
    });
    setReportConfigs(updated);
  };

  const handleSaveConfig = async () => {
    try {
      setSavingConfig(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      
      await dbService.saveReportModulesConfig(reportConfigs);
      
      setSuccessMsg("¡Configuración guardada exitosamente en la base de datos!");
      setTimeout(() => {
        setActiveView('view');
        setSuccessMsg(null);
      }, 1000);
    } catch (err) {
      console.error("Error saving reports config:", err);
      setErrorMsg("Ocurrió un error al guardar las preferencias.");
    } finally {
      setSavingConfig(false);
    }
  };

  // Drag & Drop HTML5 Handlers for Reordering
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const updated = [...reportConfigs];
    const temp = updated[draggedIndex];
    updated.splice(draggedIndex, 1);
    updated.splice(index, 0, temp);

    setDraggedIndex(index);
    setReportConfigs(updated.map((item, idx) => ({ ...item, sort_order: idx + 1 })));
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Export data to professional 3-tab Excel (.xlsx) format with real metrics using ExcelJS
  const handleExportExcel = async () => {
    if (isExportingExcel) return;
    setIsExportingExcel(true);
    try {
      const mainBusinessName = businessProfile?.name || 'Copias Bella Vista, C.A.';
      const storeNameUpper = mainBusinessName.toUpperCase();
      const rifStr = businessProfile?.rif || 'J-12345678-9';
      const freqUpper = frequency.toUpperCase();
      const periodLabel = formatPeriodLabel(selectedPeriod);
      const dateStr = new Date().toLocaleString('es-VE');

      const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

      const totalSales = round2(metrics.totalSales);
      const totalCost = round2(metrics.totalCost);
      const totalProfit = round2(metrics.totalProfit);
      const marginPercent = totalSales > 0 ? (totalProfit / totalSales) : 0;
      const totalExpenses = round2(metrics.totalExpenses);
      const netProfitUSD = round2(totalProfit - totalExpenses);
      const netMarginPercent = totalSales > 0 ? (netProfitUSD / totalSales) : 0;
      const avgSale = round2(metrics.avgSale);
      const totalTransactions = metrics.totalTransactions;

      const workbook = new ExcelJS.Workbook();
      workbook.creator = mainBusinessName;
      workbook.lastModifiedBy = 'Motor Ejecutivo de Reportes';
      workbook.created = new Date();

      // Palette & Style definitions (Strict Corporate Design)
      const NAVY_HEADER_FILL: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1B2631' } // HEX #1B2631
      };

      const GREEN_HIGHLIGHT_FILL: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8F8F5' } // Soft Executive Green Background
      };

      const HEADER_FONT: Partial<ExcelJS.Font> = {
        name: 'Calibri',
        size: 10,
        bold: true,
        color: { argb: 'FFFFFFFF' } // White text
      };

      const TITLE_FONT: Partial<ExcelJS.Font> = {
        name: 'Calibri',
        size: 16,
        bold: true,
        color: { argb: 'FF1B2631' }
      };

      const SUBTITLE_FONT: Partial<ExcelJS.Font> = {
        name: 'Calibri',
        size: 10,
        italic: true,
        color: { argb: 'FF566573' } // HEX #566573
      };

      const BORDER_TOTALS: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'FF1B2631' } },
        bottom: { style: 'double', color: { argb: 'FF1B2631' } } // Accounting double border
      };

      // ==========================================
      // HOJA 1: "Dashboard Resumen"
      // ==========================================
      const ws1 = workbook.addWorksheet('Dashboard Resumen', {
        views: [{ showGridLines: true }]
      });

      // Title Block
      ws1.getCell('A1').value = `Tu Gestión - ${mainBusinessName}`;
      ws1.getCell('A1').font = TITLE_FONT;

      ws1.getCell('A2').value = `Reporte Ejecutivo (${freqUpper}) - ${periodLabel}`;
      ws1.getCell('A2').font = SUBTITLE_FONT;

      ws1.getCell('A3').value = `RIF: ${rifStr}  |  Frecuencia: ${freqUpper}  |  Fecha de Generación: ${dateStr}`;
      ws1.getCell('A3').font = { name: 'Calibri', size: 9, color: { argb: 'FF566573' } };

      // Table 1: Métricas Clave
      const t1HeaderRow = ws1.getRow(5);
      t1HeaderRow.values = ["Métrica clave", "Monto / Valor ($)", "Detalle / Operaciones", "Comentarios"];
      t1HeaderRow.font = HEADER_FONT;
      t1HeaderRow.height = 24;
      [1, 2, 3, 4].forEach(colIdx => {
        const cell = t1HeaderRow.getCell(colIdx);
        cell.fill = NAVY_HEADER_FILL;
        cell.alignment = { vertical: 'middle', horizontal: colIdx === 2 ? 'right' : colIdx === 3 ? 'center' : 'left' };
      });

      const expenseEntries = Object.entries(metrics.expensesByCategory);

      const metricsData = [
        ["Ventas Totales (Facturado)", totalSales, totalTransactions, `${totalTransactions} transacciones registradas`],
        ["Costo Estimado de Ventas", totalCost, "-", "Costo de mercancía/materiales"],
        ["Ganancia Bruta (Margen)", { formula: 'B6-B7', result: totalProfit }, { formula: 'B8/B6', result: marginPercent }, "Margen Bruto General"],
        ["Ticket Promedio", avgSale, "-", "Promedio por transacción"],
        ["Gastos Operativos (Egresos)", totalExpenses, expenseEntries.length, "Gastos de operación de caja"],
        ["Utilidad Operativa Neta", { formula: 'B8-B10', result: netProfitUSD }, { formula: 'B11/B6', result: netMarginPercent }, "Ganancia Bruta - Gastos Operativos"]
      ];

      metricsData.forEach((rowVals, idx) => {
        const rowNum = 6 + idx;
        const row = ws1.getRow(rowNum);
        row.values = rowVals;
        row.height = 20;

        const cellA = row.getCell(1);
        const cellB = row.getCell(2);
        const cellC = row.getCell(3);
        const cellD = row.getCell(4);

        cellA.alignment = { vertical: 'middle', horizontal: 'left' };
        cellB.alignment = { vertical: 'middle', horizontal: 'right' };
        cellC.alignment = { vertical: 'middle', horizontal: 'center' };
        cellD.alignment = { vertical: 'middle', horizontal: 'left' };

        cellA.font = { name: 'Calibri', size: 10, bold: rowNum === 11 || rowNum === 8 };
        cellB.font = { name: 'Calibri', size: 10, bold: rowNum === 11 || rowNum === 8 };
        cellC.font = { name: 'Calibri', size: 10 };
        cellD.font = { name: 'Calibri', size: 10 };

        cellB.numFmt = '$#,##0.00';

        if (rowNum === 8) {
          cellC.numFmt = '0.0%';
        }

        if (rowNum === 11) {
          // Utilidad Operativa Neta Highlighted
          cellC.numFmt = '0.0%';
          [cellA, cellB, cellC, cellD].forEach(c => {
            c.fill = GREEN_HIGHLIGHT_FILL;
            c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF16A085' } };
            c.border = BORDER_TOTALS;
          });
        }
      });

      // Table 2: Top 10 Productos más Vendidos
      ws1.getCell('A13').value = "Top 10 Productos más Vendidos";
      ws1.getCell('A13').font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1B2631' } };

      const t2HeaderRow = ws1.getRow(14);
      t2HeaderRow.values = ["Posición", "Producto / Descripción", "SKU", "Unidades Ventas", "Ganancia Total ($)"];
      t2HeaderRow.font = HEADER_FONT;
      t2HeaderRow.height = 22;
      [1, 2, 3, 4, 5].forEach(colIdx => {
        const cell = t2HeaderRow.getCell(colIdx);
        cell.fill = NAVY_HEADER_FILL;
        cell.alignment = { vertical: 'middle', horizontal: colIdx === 1 || colIdx === 3 ? 'center' : colIdx >= 4 ? 'right' : 'left' };
      });

      const topProds = metrics.topProducts.slice(0, 10);
      let nextRow = 15;
      if (topProds.length > 0) {
        topProds.forEach((p, idx) => {
          const rNum = nextRow++;
          const r = ws1.getRow(rNum);
          r.values = [idx + 1, p.name, p.sku || 'N/A', p.qty, round2(p.profit)];
          r.height = 19;

          r.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
          r.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
          r.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
          r.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
          r.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };

          r.getCell(4).numFmt = '#,##0';
          r.getCell(5).numFmt = '$#,##0.00';
        });

        // Total Row Top 10
        const totRow = ws1.getRow(nextRow++);
        const topStartRow = 15;
        const topEndRow = nextRow - 2;
        const topQtySum = topProds.reduce((sum, p) => sum + p.qty, 0);
        const topProfitSum = topProds.reduce((sum, p) => sum + p.profit, 0);

        totRow.values = [
          "",
          "TOTAL TOP 10",
          "",
          { formula: `SUM(D${topStartRow}:D${topEndRow})`, result: topQtySum },
          { formula: `SUM(E${topStartRow}:E${topEndRow})`, result: topProfitSum }
        ];
        totRow.height = 20;

        [1, 2, 3, 4, 5].forEach(cIdx => {
          const cell = totRow.getCell(cIdx);
          cell.font = { name: 'Calibri', size: 10, bold: true };
          cell.border = BORDER_TOTALS;
        });
        totRow.getCell(4).numFmt = '#,##0';
        totRow.getCell(5).numFmt = '$#,##0.00';
      } else {
        const r = ws1.getRow(15);
        r.values = [1, "Sin ventas de productos registradas en este período", "N/A", 0, 0];
        r.getCell(5).numFmt = '$#,##0.00';
        nextRow = 16;
      }

      nextRow++; // Blank row

      // Table 3: Gastos de Operación
      ws1.getCell(`A${nextRow}`).value = "Egresos y Gastos de Operación";
      ws1.getCell(`A${nextRow}`).font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1B2631' } };
      nextRow++;

      const t3HeaderRow = ws1.getRow(nextRow++);
      t3HeaderRow.values = ["Categoría de Gasto", "Monto ($)", "% del Total Gastos"];
      t3HeaderRow.font = HEADER_FONT;
      t3HeaderRow.height = 22;
      [1, 2, 3].forEach(colIdx => {
        const cell = t3HeaderRow.getCell(colIdx);
        cell.fill = NAVY_HEADER_FILL;
        cell.alignment = { vertical: 'middle', horizontal: colIdx === 1 ? 'left' : 'right' };
      });

      const expStartRow = nextRow;

      if (expenseEntries.length > 0) {
        expenseEntries.forEach(([cat, val]) => {
          const rNum = nextRow++;
          const r = ws1.getRow(rNum);
          const expVal = round2(Number(val) || 0);
          r.values = [
            cat,
            expVal,
            { formula: `B${rNum}/$B$${expStartRow + expenseEntries.length}`, result: totalExpenses > 0 ? expVal / totalExpenses : 0 }
          ];
          r.height = 19;

          r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
          r.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
          r.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };

          r.getCell(2).numFmt = '$#,##0.00';
          r.getCell(3).numFmt = '0.0%';
        });

        // Expense Total Row
        const expEndRow = nextRow - 1;
        const totExpRow = ws1.getRow(nextRow++);
        totExpRow.values = [
          "TOTAL EGRESOS",
          { formula: `SUM(B${expStartRow}:B${expEndRow})`, result: totalExpenses },
          1.0
        ];
        totExpRow.height = 20;

        [1, 2, 3].forEach(cIdx => {
          const cell = totExpRow.getCell(cIdx);
          cell.font = { name: 'Calibri', size: 10, bold: true };
          cell.border = BORDER_TOTALS;
        });
        totExpRow.getCell(2).numFmt = '$#,##0.00';
        totExpRow.getCell(3).numFmt = '0.0%';
      } else {
        const r = ws1.getRow(nextRow++);
        r.values = ["Sin gastos de operación registrados en el período", 0, 0];
        r.getCell(2).numFmt = '$#,##0.00';
        r.getCell(3).numFmt = '0.0%';
      }

      // Add Pie Chart at G5 on Sheet 1 (Distribución de Gastos de Operación)
      const pieCanvasBase64 = generateExpensePieChartCanvas(metrics.expensesByCategory);
      if (pieCanvasBase64) {
        const cleanBase64 = pieCanvasBase64.replace(/^data:image\/[a-z]+;base64,/, '');
        const pieImgId = workbook.addImage({
          base64: cleanBase64,
          extension: 'png'
        });
        ws1.addImage(pieImgId, {
          tl: { col: 6, row: 4 }, // Cell G5 (Cleanly positioned to the right of tables)
          ext: { width: 540, height: 320 }
        });
      }

      // Auto-fit Column Widths Sheet 1
      [1, 2, 3, 4, 5].forEach(colIdx => {
        let maxLen = 15;
        ws1.getColumn(colIdx).eachCell({ includeEmpty: false }, (cell) => {
          const valStr = cell.value ? cell.value.toString() : '';
          if (valStr.length > maxLen) maxLen = valStr.length;
        });
        ws1.getColumn(colIdx).width = Math.min(Math.max(maxLen + 4, 16), 40);
      });


      // ==========================================
      // HOJA 2: "Ventas y Desempeño"
      // ==========================================
      const ws2 = workbook.addWorksheet('Ventas y Desempeño', {
        views: [{ showGridLines: true }]
      });

      // Title Block
      ws2.getCell('A1').value = `Desempeño del Equipo de Ventas y Canales (${freqUpper}) - ${mainBusinessName}`;
      ws2.getCell('A1').font = TITLE_FONT;

      ws2.getCell('A2').value = `Análisis de Facturación (${freqUpper}) - ${periodLabel}`;
      ws2.getCell('A2').font = SUBTITLE_FONT;

      // Table 1: Desempeño Vendedores / Canales
      const s1HeaderRow = ws2.getRow(4);
      s1HeaderRow.values = ["Vendedor / Canal", "Rol / Tipo", "N° Operaciones", "Total Facturado ($)", "% del Total"];
      s1HeaderRow.font = HEADER_FONT;
      s1HeaderRow.height = 24;
      [1, 2, 3, 4, 5].forEach(colIdx => {
        const cell = s1HeaderRow.getCell(colIdx);
        cell.fill = NAVY_HEADER_FILL;
        cell.alignment = { vertical: 'middle', horizontal: colIdx === 2 || colIdx === 3 ? 'center' : colIdx >= 4 ? 'right' : 'left' };
      });

      const employees = metrics.topEmployees;
      let sNextRow = 5;
      if (employees.length > 0) {
        employees.forEach((emp, idx) => {
          const rNum = sNextRow++;
          const r = ws2.getRow(rNum);
          const empSales = round2(emp.sales);
          r.values = [
            emp.name,
            idx === 0 ? "Líder del Período" : "Operador",
            emp.count,
            empSales,
            { formula: `D${rNum}/$D$${5 + employees.length}`, result: totalSales > 0 ? empSales / totalSales : 0 }
          ];
          r.height = 20;

          r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
          r.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
          r.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
          r.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
          r.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };

          r.getCell(3).numFmt = '#,##0';
          r.getCell(4).numFmt = '$#,##0.00';
          r.getCell(5).numFmt = '0.0%';
        });

        // Total Row Vendedores
        const empEndRow = sNextRow - 1;
        const totEmpRow = ws2.getRow(sNextRow++);
        const empOpsSum = employees.reduce((sum, e) => sum + e.count, 0);

        totEmpRow.values = [
          "TOTAL FACTURADO",
          "",
          { formula: `SUM(C5:C${empEndRow})`, result: empOpsSum },
          { formula: `SUM(D5:D${empEndRow})`, result: totalSales },
          1.0
        ];
        totEmpRow.height = 22;

        [1, 2, 3, 4, 5].forEach(cIdx => {
          const cell = totEmpRow.getCell(cIdx);
          cell.font = { name: 'Calibri', size: 10, bold: true };
          cell.border = BORDER_TOTALS;
        });
        totEmpRow.getCell(3).numFmt = '#,##0';
        totEmpRow.getCell(4).numFmt = '$#,##0.00';
        totEmpRow.getCell(5).numFmt = '0.0%';
      } else {
        const r = ws2.getRow(5);
        r.values = ["Sin operaciones registradas", "Operador", 0, 0, 0];
        r.getCell(4).numFmt = '$#,##0.00';
        r.getCell(5).numFmt = '0.0%';
        sNextRow = 6;
      }

      sNextRow++; // Blank row

      // Table 2: Top Clientes
      ws2.getCell(`A${sNextRow}`).value = "Top Clientes del Período";
      ws2.getCell(`A${sNextRow}`).font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1B2631' } };
      sNextRow++;

      const cHeaderRow = ws2.getRow(sNextRow++);
      cHeaderRow.values = ["Cliente", "Tipo / Estatus", "N° Compras", "Monto Total ($)"];
      cHeaderRow.font = HEADER_FONT;
      cHeaderRow.height = 22;
      [1, 2, 3, 4].forEach(colIdx => {
        const cell = cHeaderRow.getCell(colIdx);
        cell.fill = NAVY_HEADER_FILL;
        cell.alignment = { vertical: 'middle', horizontal: colIdx === 2 || colIdx === 3 ? 'center' : colIdx === 4 ? 'right' : 'left' };
      });

      const clients = metrics.topClients;
      const clientStartRow = sNextRow;

      if (clients.length > 0) {
        clients.forEach((c) => {
          const rNum = sNextRow++;
          const r = ws2.getRow(rNum);
          r.values = [
            c.name,
            "Cliente Frecuente",
            c.count,
            round2(c.total)
          ];
          r.height = 19;

          r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
          r.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
          r.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
          r.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };

          r.getCell(3).numFmt = '#,##0';
          r.getCell(4).numFmt = '$#,##0.00';
        });

        // Total Row Top Clientes
        const clientEndRow = sNextRow - 1;
        const totClientRow = ws2.getRow(sNextRow++);
        const clientCountSum = clients.reduce((sum, c) => sum + c.count, 0);
        const clientTotalSum = clients.reduce((sum, c) => sum + c.total, 0);

        totClientRow.values = [
          "TOTAL TOP CLIENTES",
          "",
          { formula: `SUM(C${clientStartRow}:C${clientEndRow})`, result: clientCountSum },
          { formula: `SUM(D${clientStartRow}:D${clientEndRow})`, result: clientTotalSum }
        ];
        totClientRow.height = 20;

        [1, 2, 3, 4].forEach(cIdx => {
          const cell = totClientRow.getCell(cIdx);
          cell.font = { name: 'Calibri', size: 10, bold: true };
          cell.border = BORDER_TOTALS;
        });
        totClientRow.getCell(3).numFmt = '#,##0';
        totClientRow.getCell(4).numFmt = '$#,##0.00';
      } else {
        const r = ws2.getRow(sNextRow++);
        r.values = ["Consumidor final", "Cliente Frecuente", 0, 0];
        r.getCell(4).numFmt = '$#,##0.00';
      }

      // Add Vertical Bar Chart at G4 on Sheet 2 (Facturación por Vendedor / Canal)
      const barCanvasBase64 = generateSalesBarChartCanvas(metrics.topEmployees);
      if (barCanvasBase64) {
        const cleanBase64 = barCanvasBase64.replace(/^data:image\/[a-z]+;base64,/, '');
        const barImgId = workbook.addImage({
          base64: cleanBase64,
          extension: 'png'
        });
        ws2.addImage(barImgId, {
          tl: { col: 6, row: 3 }, // Cell G4 (Cleanly positioned to the right of tables)
          ext: { width: 580, height: 320 }
        });
      }

      // Auto-fit Column Widths Sheet 2
      [1, 2, 3, 4, 5].forEach(colIdx => {
        let maxLen = 15;
        ws2.getColumn(colIdx).eachCell({ includeEmpty: false }, (cell) => {
          const valStr = cell.value ? cell.value.toString() : '';
          if (valStr.length > maxLen) maxLen = valStr.length;
        });
        ws2.getColumn(colIdx).width = Math.min(Math.max(maxLen + 4, 18), 42);
      });


      // ==========================================
      // HOJA 3: "Estado de Resultados" (P&L)
      // ==========================================
      const ws3 = workbook.addWorksheet('Estado de Resultados', {
        views: [{ showGridLines: true }]
      });

      // Title Block
      ws3.getCell('A1').value = `Estado de Resultados P&L (${freqUpper}) - ${mainBusinessName}`;
      ws3.getCell('A1').font = TITLE_FONT;

      ws3.getCell('A2').value = `Estado de Pérdidas y Ganancias Operativo (${freqUpper}) - Período: ${periodLabel}`;
      ws3.getCell('A2').font = SUBTITLE_FONT;

      // Header Row
      const pnlHeaderRow = ws3.getRow(4);
      pnlHeaderRow.values = ["Concepto Financiero", "Monto ($)", "% sobre Ventas"];
      pnlHeaderRow.font = HEADER_FONT;
      pnlHeaderRow.height = 24;
      [1, 2, 3].forEach(colIdx => {
        const cell = pnlHeaderRow.getCell(colIdx);
        cell.fill = NAVY_HEADER_FILL;
        cell.alignment = { vertical: 'middle', horizontal: colIdx === 1 ? 'left' : 'right' };
      });

      // P&L Content
      // Row 5: Ventas Brutas Totales
      const r5 = ws3.getRow(5);
      r5.values = ["Ventas Brutas Totales", totalSales, 1.0];
      r5.height = 20;
      r5.getCell(1).font = { name: 'Calibri', size: 10, bold: true };
      r5.getCell(2).font = { name: 'Calibri', size: 10, bold: true };
      r5.getCell(3).font = { name: 'Calibri', size: 10, bold: true };
      r5.getCell(2).numFmt = '$#,##0.00';
      r5.getCell(3).numFmt = '0.0%';

      // Row 6: (-) Costo de Ventas / Mercancía
      const r6 = ws3.getRow(6);
      r6.values = ["(-) Costo de Ventas / Mercancía", -totalCost, { formula: 'ABS(B6)/$B$5', result: totalSales > 0 ? totalCost / totalSales : 0 }];
      r6.height = 19;
      r6.getCell(2).numFmt = '$#,##0.00';
      r6.getCell(3).numFmt = '0.0%';

      // Row 7: GANANCIA BRUTA (MARGEN)
      const r7 = ws3.getRow(7);
      r7.values = ["GANANCIA BRUTA (MARGEN)", { formula: 'B5+B6', result: totalProfit }, { formula: 'B7/$B$5', result: marginPercent }];
      r7.height = 22;
      [1, 2, 3].forEach(cIdx => {
        const cell = r7.getCell(cIdx);
        cell.font = { name: 'Calibri', size: 10, bold: true };
        cell.border = { top: { style: 'thin', color: { argb: 'FF1B2631' } } };
      });
      r7.getCell(2).numFmt = '$#,##0.00';
      r7.getCell(3).numFmt = '0.0%';

      // Row 8: (-) Gastos Operativos de Caja
      const r8 = ws3.getRow(8);
      r8.values = ["(-) Gastos Operativos de Caja", "", ""];
      r8.height = 18;
      r8.getCell(1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF566573' } };

      let pnlRowIndex = 9;
      if (expenseEntries.length > 0) {
        expenseEntries.forEach(([cat, val]) => {
          const rNum = pnlRowIndex++;
          const r = ws3.getRow(rNum);
          const expVal = round2(Number(val) || 0);
          r.values = [
            `  - ${cat}`,
            -expVal,
            { formula: `ABS(B${rNum})/$B$5`, result: totalSales > 0 ? expVal / totalSales : 0 }
          ];
          r.height = 19;
          r.getCell(2).numFmt = '$#,##0.00';
          r.getCell(3).numFmt = '0.0%';
        });
      } else {
        const r = ws3.getRow(pnlRowIndex++);
        r.values = ["  - Sin gastos de operación registrados", 0, 0];
        r.getCell(2).numFmt = '$#,##0.00';
        r.getCell(3).numFmt = '0.0%';
      }

      // Total Gastos de Operación Row
      const pnlExpEndRow = pnlRowIndex - 1;
      const totPnlExpRow = ws3.getRow(pnlRowIndex++);
      const totPnlExpRowIndex = pnlRowIndex - 1;
      totPnlExpRow.values = [
        "TOTAL GASTOS DE OPERACIÓN",
        { formula: `SUM(B9:B${pnlExpEndRow})`, result: -totalExpenses },
        { formula: `ABS(B${totPnlExpRowIndex})/$B$5`, result: totalSales > 0 ? totalExpenses / totalSales : 0 }
      ];
      totPnlExpRow.height = 20;
      [1, 2, 3].forEach(cIdx => {
        const cell = totPnlExpRow.getCell(cIdx);
        cell.font = { name: 'Calibri', size: 10, bold: true };
        cell.border = { top: { style: 'thin', color: { argb: 'FF1B2631' } } };
      });
      totPnlExpRow.getCell(2).numFmt = '$#,##0.00';
      totPnlExpRow.getCell(3).numFmt = '0.0%';

      // Utilidad Operativa Neta Row
      const netProfitRow = ws3.getRow(pnlRowIndex++);
      const netProfitRowIndex = pnlRowIndex - 1;
      netProfitRow.values = [
        "UTILIDAD OPERATIVA NETA",
        { formula: `B7+B${totPnlExpRowIndex}`, result: netProfitUSD },
        { formula: `B${netProfitRowIndex}/$B$5`, result: netMarginPercent }
      ];
      netProfitRow.height = 24;
      [1, 2, 3].forEach(cIdx => {
        const cell = netProfitRow.getCell(cIdx);
        cell.fill = GREEN_HIGHLIGHT_FILL;
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF16A085' } };
        cell.border = BORDER_TOTALS;
      });
      netProfitRow.getCell(2).numFmt = '$#,##0.00';
      netProfitRow.getCell(3).numFmt = '0.0%';

      // Alignments P&L
      for (let r = 5; r <= netProfitRowIndex; r++) {
        const row = ws3.getRow(r);
        row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
        row.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
        row.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
      }

      // Auto-fit Column Widths Sheet 3
      [1, 2, 3].forEach(colIdx => {
        let maxLen = 20;
        ws3.getColumn(colIdx).eachCell({ includeEmpty: false }, (cell) => {
          const valStr = cell.value ? cell.value.toString() : '';
          if (valStr.length > maxLen) maxLen = valStr.length;
        });
        ws3.getColumn(colIdx).width = Math.min(Math.max(maxLen + 4, 22), 48);
      });

      // Write to Buffer & Trigger Download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const safeStoreName = storeNameUpper.replace(/[^A-Z0-9]/gi, '_');
      const safePeriod = selectedPeriod.replace(/[^A-Z0-9]/gi, '_');
      const fileName = `Reporte_Ejecutivo_${freqUpper}_${safeStoreName}_${safePeriod}.xlsx`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

    } catch (err) {
      console.error("Error generating executive Excel report:", err);
      alert("Error al generar el reporte ejecutivo de Excel.");
    } finally {
      setIsExportingExcel(false);
    }
  };

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingSalesReport, setIsExportingSalesReport] = useState(false);

  const round2 = (num: number): number => Math.round((Number(num) + Number.EPSILON) * 100) / 100;

  const normalizePaymentMethod = (method?: string): string => {
    if (!method) return 'EFECTIVO USD';
    const m = String(method).toUpperCase().trim();
    if (m.includes('PAGO MÓVIL') || m.includes('PAGOMOVIL') || m.includes('TRANSFERENCIA')) return 'PAGO MÓVIL / TRANSFERENCIA';
    if (m.includes('ZELLE')) return 'ZELLE';
    if (m.includes('PUNTO') || m.includes('TARJETA') || m.includes('POS')) return 'PUNTO DE VENTA / TARJETA';
    if (m.includes('BIOPAGO')) return 'BIOPAGO';
    if (m.includes('DIVISA') || m.includes('USD') || m.includes('EFECTIVO')) return 'EFECTIVO USD';
    if (m.includes('BS') || m.includes('BOLIVAR')) return 'EFECTIVO BS';
    return 'OTRO / MIXTO';
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const mainBusinessName = businessProfile?.name || 'Inversiones y Copias Bella Vista, C.A.';
      const rifStr = businessProfile?.tax_id || businessProfile?.rif || 'J-50348921-0';
      const periodLabel = formatPeriodLabel(selectedPeriod);
      const dateStr = new Date().toLocaleString('es-VE');
      const currSymbol = reportCurrency === 'USD' ? '$' : reportCurrency === 'VES' ? 'Bs' : reportCurrency === 'EUR' ? '€' : 'COP$';
      const rate = reportCurrency === 'USD' ? 1 : (reportCurrency === 'VES' ? (bcvRate || effectiveRates['VES'] || 1) : (effectiveRates[reportCurrency] || 1));

      // Track Channel metrics
      const channelMetrics: Record<string, { channel: string; type: string; count: number; total: number }> = {
        'Caja POS Flash': { channel: 'Caja POS Flash', type: 'Punto de Venta Físico', count: 0, total: 0 },
        'Tienda Online': { channel: 'Tienda Online', type: 'Comercio Electrónico', count: 0, total: 0 },
        'Mostrador / Caja Directa': { channel: 'Mostrador / Caja Directa', type: 'Caja Operativa', count: 0, total: 0 }
      };

      // Filter local data for selected period
      const filteredInvoices = localInvoices.filter(inv => {
        const d = parseDateSafe(inv.created_at);
        if (!d) return false;
        return getPeriodKeyForDate(d, frequency) === selectedPeriod;
      });

      const filteredOrders = localOrders.filter(order => {
        const status = (order.status || '').toLowerCase();
        if (status === 'cancelado' || status === 'anulado' || status === 'rechazado') return false;
        const d = parseDateSafe(order.created_at);
        if (!d) return false;
        return getPeriodKeyForDate(d, frequency) === selectedPeriod;
      });

      const filteredCashOps = localCashOps.filter(op => {
        const d = parseDateSafe(op.created_at);
        if (!d) return false;
        return getPeriodKeyForDate(d, frequency) === selectedPeriod;
      });

      let incomes: any[] = [];
      let egresses: any[] = [];

      // Call Backend API route for strict transaction processing and deduplication
      try {
        const res = await fetch('/api/reports/process-transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoices: filteredInvoices,
            orders: filteredOrders,
            cashOps: filteredCashOps,
            currency: reportCurrency,
            currencyRates: effectiveRates,
            bcvRate
          })
        });
        const data = await res.json();
        if (data.success) {
          incomes = data.incomes || [];
          egresses = data.egresses || [];
        }
      } catch (backendErr) {
        console.warn("Backend API /api/reports/process-transactions unavailable, using client fallback", backendErr);
      }

      // Fallback client-side processing if backend call fails or offline
      if (incomes.length === 0 && (filteredInvoices.length > 0 || filteredOrders.length > 0)) {
        filteredInvoices.forEach(inv => {
          const totalUSD = getInvoiceTotalUSD(inv);
          if (totalUSD <= 0 && (!inv.items || inv.items.length === 0)) return;

          const isNota = inv.document_type === 'nota_entrega' || (inv.control_number && String(inv.control_number).startsWith('NE-'));
          const docPrefix = isNota ? 'NE' : 'FAC';
          const docNum = String(inv.control_number || inv.invoice_number || inv.id || '000').padStart(6, '0');
          const docType = isNota ? 'Nota de Entrega' : (inv.document_type || 'Factura');
          const clientName = (inv.customer_name || '').trim() || 'Consumidor Final';
          const d = parseDateSafe(inv.created_at) || new Date();
          const amt = totalUSD * rate;

          incomes.push({
            id: `${docPrefix}-${docNum}`,
            date: d.toLocaleDateString('es-VE'),
            channel: isNota ? 'Nota de Entrega' : 'Factura POS',
            description: `${docType} #${docNum} - ${clientName}`,
            paymentMethod: normalizePaymentMethod(inv.payment_method || inv.paymentMethod),
            amount: amt,
            seller: inv.seller_name || inv.cashier_name || 'Cajero POS',
            status: 'Completado'
          });
        });

        filteredOrders.forEach(order => {
          const totalUSD = getOrderTotalUSD(order);
          if (totalUSD <= 0) return;

          const orderNum = String(order.order_number || order.id || '000').padStart(6, '0');
          const clientName = (order.customer_name || '').trim() || 'Cliente Mostrador';
          const d = parseDateSafe(order.created_at) || new Date();
          const amt = totalUSD * rate;

          incomes.push({
            id: `ORD-${orderNum}`,
            date: d.toLocaleDateString('es-VE'),
            channel: 'Tienda Online',
            description: `Orden Pedido #${orderNum} - ${clientName}`,
            paymentMethod: normalizePaymentMethod(order.payment_method),
            amount: amt,
            seller: order.seller_name || 'Ventas Online',
            status: order.status || 'Completado'
          });
        });
      }

      if (egresses.length === 0 && filteredCashOps.length > 0) {
        filteredCashOps.forEach(op => {
          const concept = op.concept || '';
          const d = parseDateSafe(op.created_at) || new Date();
          const rawAmt = parseFloat(String(op.amount)) || 0;
          const amt = rawAmt * rate;

          if (op.type === 'egreso') {
            if (concept === 'Cierre de Caja - Entrega de Efectivo (Arqueo)') return;

            const lowerConcept = concept.toLowerCase();
            let cat = (op.category || '').trim();
            if (!cat) {
              if (lowerConcept.includes('nomina') || lowerConcept.includes('sueldo')) cat = 'Nómina y Sueldos';
              else if (lowerConcept.includes('alquiler')) cat = 'Alquiler y Espacio Físico';
              else if (lowerConcept.includes('luz') || lowerConcept.includes('agua') || lowerConcept.includes('servicio')) cat = 'Servicios Públicos e Internet';
              else if (lowerConcept.includes('compra') || lowerConcept.includes('proveedor')) cat = 'Mercancía y Proveedores';
              else cat = 'Otros Gastos Operativos';
            }

            egresses.push({
              id: `EGR-${String(op.id || '').substring(0, 6)}`,
              date: d.toLocaleDateString('es-VE'),
              category: cat,
              description: concept || 'Gasto operativo de caja',
              paymentMethod: normalizePaymentMethod(op.payment_method),
              amount: amt,
              operator: op.empleado_nombre || 'Administrador',
              status: 'Pagado'
            });
          }
        });
      }

      // Populate channel metrics
      filteredInvoices.forEach(inv => {
        const totalUSD = getInvoiceTotalUSD(inv);
        if (totalUSD > 0) {
          channelMetrics['Caja POS Flash'].count += 1;
          channelMetrics['Caja POS Flash'].total += totalUSD * rate;
        }
      });
      filteredOrders.forEach(order => {
        const totalUSD = getOrderTotalUSD(order);
        if (totalUSD > 0) {
          channelMetrics['Tienda Online'].count += 1;
          channelMetrics['Tienda Online'].total += totalUSD * rate;
        }
      });

      // Prepare Channel Performance
      const totalSalesValue = metrics.totalSales > 0 ? metrics.totalSales : 1;
      const channelPerformance = Object.values(channelMetrics)
        .filter(c => c.count > 0 || c.total > 0)
        .map(c => ({
          channel: c.channel,
          type: c.type,
          count: c.count,
          total: c.total,
          percentage: (c.total / totalSalesValue) * 100,
          avgTicket: c.count > 0 ? c.total / c.count : 0
        }));

      if (channelPerformance.length === 0) {
        channelPerformance.push({
          channel: 'Caja POS Flash',
          type: 'Punto de Venta Físico',
          count: metrics.totalTransactions,
          total: metrics.totalSales,
          percentage: 100,
          avgTicket: metrics.avgSale
        });
      }

      // Prepare Team Performance
      const teamPerformance = metrics.topEmployees.map(emp => ({
        name: emp.name,
        role: 'Operador / Ventas',
        count: emp.count,
        sales: emp.sales,
        percentage: totalSalesValue > 0 ? (emp.sales / totalSalesValue) * 100 : 0,
        avgTicket: emp.count > 0 ? emp.sales / emp.count : 0
      }));

      // Prepare Expense Categories Array for Income Statement
      const expensesByCategory = Object.entries(metrics.expensesByCategory).map(([category, rawAmount]) => {
        const amt = Number(rawAmount) || 0;
        return {
          category,
          amount: amt,
          percentage: metrics.totalSales > 0 ? (amt / metrics.totalSales) * 100 : 0
        };
      });

      const netOperatingProfit = metrics.totalProfit - metrics.totalExpenses;
      const netMarginPercent = metrics.totalSales > 0 ? (netOperatingProfit / metrics.totalSales) * 100 : 0;

      exportReportsToPdf({
        businessName: mainBusinessName,
        rif: rifStr,
        periodLabel: periodLabel,
        frequency: frequency,
        selectedPeriod: selectedPeriod,
        generatedAt: dateStr,
        currency: reportCurrency,
        currencySymbol: currSymbol,
        totalSales: metrics.totalSales,
        totalCost: metrics.totalCost,
        grossProfit: metrics.totalProfit,
        grossMarginPercent: metrics.marginPercent,
        totalExpenses: metrics.totalExpenses,
        netProfit: netOperatingProfit,
        netMarginPercent: netMarginPercent,
        totalOrdersCount: metrics.totalTransactions,
        averageTicket: metrics.avgSale,
        expensesByCategory: expensesByCategory,
        teamPerformance: teamPerformance,
        channelPerformance: channelPerformance,
        topProducts: metrics.topProducts.map(p => ({
          name: p.name,
          sku: p.sku,
          quantity: p.qty,
          total: p.sales,
          profit: p.profit
        })),
        incomes: incomes,
        egresses: egresses
      });
    } catch (error) {
      console.error('Error generating PDF report:', error);
      alert('Ocurrió un error al generar el PDF del reporte.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportSalesReport = async () => {
    setIsExportingSalesReport(true);
    try {
      const mainBusinessName = businessProfile?.name || 'Copias Bella Vista, C.A.';
      const rifStr = businessProfile?.tax_id || businessProfile?.rif || 'J-50348921-0';
      const periodLabel = formatPeriodLabel(selectedPeriod);
      const dateStr = new Date().toLocaleString('es-VE');

      // 1. Collect all real sales transactions matching selected period
      const transactions: {
        concepto: string;
        ref: string;
        valor: number;
        medio: string;
        fecha: string;
        timestamp: number;
      }[] = [];

      // Process Invoices (POS Flash Sales)
      const filteredInvoices = localInvoices.filter(inv => {
        const d = parseDateSafe(inv.created_at);
        if (!d) return false;
        return getPeriodKeyForDate(d, frequency) === selectedPeriod;
      });

      filteredInvoices.forEach(inv => {
        const totalUSD = getInvoiceTotalUSD(inv);
        if (totalUSD <= 0 && (!inv.items || inv.items.length === 0)) return;

        const docNum = String(inv.control_number || inv.invoice_number || inv.id || '000').padStart(6, '0');
        const docType = inv.document_type || 'Factura';
        const clientName = (inv.customer_name || '').trim() || 'Consumidor Final';
        const concepto = `${docType} #${docNum} - ${clientName} (POS Venta Flash)`;

        const ref = String(inv.session_id || inv.control_number || inv.id || 'SES-001');
        const medio = normalizePaymentMethod(inv.payment_method || inv.paymentMethod || 'EFECTIVO USD');
        const d = parseDateSafe(inv.created_at) || new Date();
        const fecha = d.toLocaleString('es-VE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

        transactions.push({
          concepto,
          ref,
          valor: round2(totalUSD),
          medio,
          fecha,
          timestamp: d.getTime()
        });
      });

      // Process Orders (Tienda Online)
      const filteredOrders = localOrders.filter(order => {
        const status = (order.status || '').toLowerCase();
        if (status === 'cancelado' || status === 'anulado' || status === 'rechazado') return false;
        const d = parseDateSafe(order.created_at);
        if (!d) return false;
        return getPeriodKeyForDate(d, frequency) === selectedPeriod;
      });

      filteredOrders.forEach(order => {
        const totalUSD = getOrderTotalUSD(order);
        if (totalUSD <= 0) return;

        const orderNum = String(order.order_number || order.id || '000').padStart(6, '0');
        const clientName = (order.customer_name || '').trim() || 'Cliente Pedido';
        const concepto = `Pedido #${orderNum} - ${clientName} (Tienda Online)`;

        const ref = order.order_number ? `ORD-${order.order_number}` : String(order.id || 'ORD-001');
        const medio = normalizePaymentMethod(order.payment_method || 'PAGO MÓVIL');
        const d = parseDateSafe(order.created_at) || new Date();
        const fecha = d.toLocaleString('es-VE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

        transactions.push({
          concepto,
          ref,
          valor: round2(totalUSD),
          medio,
          fecha,
          timestamp: d.getTime()
        });
      });

      // Sort transactions chronologically
      transactions.sort((a, b) => b.timestamp - a.timestamp);

      // Group payment methods summary
      const paymentSummary: Record<string, { count: number; total: number }> = {};
      let totalSalesVal = 0;

      transactions.forEach(tx => {
        totalSalesVal += tx.valor;
        if (!paymentSummary[tx.medio]) {
          paymentSummary[tx.medio] = { count: 0, total: 0 };
        }
        paymentSummary[tx.medio].count += 1;
        paymentSummary[tx.medio].total += tx.valor;
      });

      // Create ExcelJS workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = mainBusinessName;
      workbook.created = new Date();

      const TITLE_FONT = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF1B2631' } };
      const SUBTITLE_FONT = { name: 'Calibri', size: 11, italic: true, color: { argb: 'FF566573' } };
      const HEADER_FONT = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      const NAVY_HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2631' } };
      const ZEBRA_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F4F4' } };

      const BORDER_ACCOUNTING_TOTAL: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'FF16A085' } },
        bottom: { style: 'double', color: { argb: 'FF16A085' } }
      };

      // ==========================================
      // HOJA 1: "Resumen de Ventas"
      // ==========================================
      const ws1 = workbook.addWorksheet('Resumen de Ventas', {
        views: [{ showGridLines: true }]
      });

      // Title Block
      ws1.getCell('A1').value = `Reporte Corporativo de Ventas - ${mainBusinessName}`;
      ws1.getCell('A1').font = TITLE_FONT;

      ws1.getCell('A2').value = `Consolidado General de Ventas (${frequency.toUpperCase()}) - ${periodLabel}`;
      ws1.getCell('A2').font = SUBTITLE_FONT;

      ws1.getCell('A3').value = `RIF: ${rifStr}  |  Operaciones: ${transactions.length}  |  Fecha de Generación: ${dateStr}`;
      ws1.getCell('A3').font = { name: 'Calibri', size: 9, color: { argb: 'FF566573' } };

      // KPI Cards Block (Rows 5-9)
      ws1.getCell('A5').value = "KPIs GENERALES DE VENTAS";
      ws1.getCell('A5').font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1B2631' } };

      const kpiHeader = ws1.getRow(6);
      kpiHeader.values = ["Métrica", "Fórmula / Indicador", "Valor ($ / Cantidad)"];
      kpiHeader.font = HEADER_FONT;
      kpiHeader.height = 22;
      [1, 2, 3].forEach(c => {
        const cell = kpiHeader.getCell(c);
        cell.fill = NAVY_HEADER_FILL;
        cell.alignment = { vertical: 'middle', horizontal: c === 3 ? 'right' : 'left' };
      });

      const txCount = transactions.length;

      // Row 7: Ventas Totales
      const kpi1 = ws1.getRow(7);
      kpi1.values = [
        "Ventas Totales ($)",
        txCount > 0 ? `=SUM('Detalle de Ventas'!C5:C${4 + txCount})` : "-",
        { formula: txCount > 0 ? `=SUM('Detalle de Ventas'!C5:C${4 + txCount})` : "0", result: totalSalesVal }
      ];
      kpi1.height = 20;
      kpi1.getCell(3).numFmt = '$#,##0.00';
      kpi1.getCell(3).alignment = { horizontal: 'right' };
      kpi1.getCell(3).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF16A085' } };

      // Row 8: N° Transacciones
      const kpi2 = ws1.getRow(8);
      kpi2.values = [
        "Total Operaciones Registradas",
        txCount > 0 ? `=COUNTA('Detalle de Ventas'!A5:A${4 + txCount})` : "-",
        { formula: txCount > 0 ? `=COUNTA('Detalle de Ventas'!A5:A${4 + txCount})` : "0", result: txCount }
      ];
      kpi2.height = 20;
      kpi2.getCell(3).numFmt = '#,##0';
      kpi2.getCell(3).alignment = { horizontal: 'right' };
      kpi2.getCell(3).font = { name: 'Calibri', size: 11, bold: true };

      // Row 9: Ticket Promedio
      const kpi3 = ws1.getRow(9);
      kpi3.values = [
        "Ticket Promedio por Venta ($)",
        txCount > 0 ? `=AVERAGE('Detalle de Ventas'!C5:C${4 + txCount})` : "-",
        { formula: txCount > 0 ? `=AVERAGE('Detalle de Ventas'!C5:C${4 + txCount})` : "0", result: txCount > 0 ? totalSalesVal / txCount : 0 }
      ];
      kpi3.height = 20;
      kpi3.getCell(3).numFmt = '$#,##0.00';
      kpi3.getCell(3).alignment = { horizontal: 'right' };
      kpi3.getCell(3).font = { name: 'Calibri', size: 11, bold: true };

      // Summary Table by Payment Method (Starts at Row 12)
      ws1.getCell('A12').value = "Resumen de Totales por Método de Pago";
      ws1.getCell('A12').font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1B2631' } };

      const pmHeader = ws1.getRow(13);
      pmHeader.values = ["Medio de Pago", "N° Transacciones", "Total ($)", "% del Total"];
      pmHeader.font = HEADER_FONT;
      pmHeader.height = 24;
      [1, 2, 3, 4].forEach(c => {
        const cell = pmHeader.getCell(c);
        cell.fill = NAVY_HEADER_FILL;
        cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : c === 2 ? 'center' : 'right' };
      });

      const paymentEntries = Object.entries(paymentSummary);
      let pmNextRow = 14;

      if (paymentEntries.length > 0) {
        paymentEntries.forEach(([method, data]) => {
          const rNum = pmNextRow++;
          const r = ws1.getRow(rNum);
          r.values = [
            method,
            { formula: txCount > 0 ? `=COUNTIF('Detalle de Ventas'!$D$5:$D$${4 + txCount}, "${method}")` : "0", result: data.count },
            { formula: txCount > 0 ? `=SUMIF('Detalle de Ventas'!$D$5:$D$${4 + txCount}, "${method}", 'Detalle de Ventas'!$C$5:$C$${4 + txCount})` : "0", result: data.total },
            { formula: txCount > 0 ? `=C${rNum}/$C$${14 + paymentEntries.length}` : "0", result: totalSalesVal > 0 ? data.total / totalSalesVal : 0 }
          ];
          r.height = 20;

          r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
          r.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
          r.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
          r.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };

          r.getCell(2).numFmt = '#,##0';
          r.getCell(3).numFmt = '$#,##0.00';
          r.getCell(4).numFmt = '0.0%';
        });

        // Total Row Payment Methods
        const pmEndRow = pmNextRow - 1;
        const totPmRow = ws1.getRow(pmNextRow++);
        totPmRow.values = [
          "TOTAL GENERAL",
          { formula: `=SUM(B14:B${pmEndRow})`, result: txCount },
          { formula: `=SUM(C14:C${pmEndRow})`, result: totalSalesVal },
          1.0
        ];
        totPmRow.height = 22;

        [1, 2, 3, 4].forEach(cIdx => {
          const cell = totPmRow.getCell(cIdx);
          cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF16A085' } };
          cell.border = BORDER_ACCOUNTING_TOTAL;
        });
        totPmRow.getCell(2).numFmt = '#,##0';
        totPmRow.getCell(3).numFmt = '$#,##0.00';
        totPmRow.getCell(4).numFmt = '0.0%';
      } else {
        const r = ws1.getRow(14);
        r.values = ["Sin transacciones registradas", 0, 0, 0];
        r.getCell(3).numFmt = '$#,##0.00';
        r.getCell(4).numFmt = '0.0%';
        pmNextRow = 15;
      }

      // Add Donut/Pie Chart image for Payment Methods (Placed at F5 on Sheet 1, zero overlap!)
      const paymentChartCanvasBase64 = generatePaymentPieChartCanvas(paymentSummary);
      if (paymentChartCanvasBase64) {
        const cleanBase64 = paymentChartCanvasBase64.replace(/^data:image\/[a-z]+;base64,/, '');
        const chartImgId = workbook.addImage({
          base64: cleanBase64,
          extension: 'png'
        });
        ws1.addImage(chartImgId, {
          tl: { col: 5, row: 4 }, // Cell F5
          ext: { width: 560, height: 320 }
        });
      }

      // Auto-fit Column Widths Sheet 1
      ws1.getColumn(1).width = 38;
      ws1.getColumn(2).width = 30;
      ws1.getColumn(3).width = 25;
      ws1.getColumn(4).width = 18;

      // ==========================================
      // HOJA 2: "Detalle de Ventas"
      // ==========================================
      const ws2 = workbook.addWorksheet('Detalle de Ventas', {
        views: [{ showGridLines: true }]
      });

      // Title Block
      ws2.getCell('A1').value = `Detalle Transaccional de Ventas - ${mainBusinessName}`;
      ws2.getCell('A1').font = TITLE_FONT;

      ws2.getCell('A2').value = `Listado de Operaciones (${frequency.toUpperCase()}) - ${periodLabel} | Total: ${txCount} registros`;
      ws2.getCell('A2').font = SUBTITLE_FONT;

      // Header Row (Row 4)
      const dtHeader = ws2.getRow(4);
      dtHeader.values = ["CONCEPTO", "SESIÓN / REF", "VALOR ($)", "MEDIO DE PAGO", "FECHA Y HORA"];
      dtHeader.font = HEADER_FONT;
      dtHeader.height = 25;
      [1, 2, 3, 4, 5].forEach(c => {
        const cell = dtHeader.getCell(c);
        cell.fill = NAVY_HEADER_FILL;
        cell.alignment = { 
          vertical: 'middle', 
          horizontal: c === 1 ? 'left' : c === 3 ? 'right' : 'center' 
        };
      });

      let dtNextRow = 5;

      if (transactions.length > 0) {
        transactions.forEach((tx, idx) => {
          const rNum = dtNextRow++;
          const r = ws2.getRow(rNum);
          r.values = [
            tx.concepto,
            tx.ref,
            tx.valor,
            tx.medio,
            tx.fecha
          ];
          r.height = 20;

          // Apply alternating Zebra striping
          if (idx % 2 === 1) {
            [1, 2, 3, 4, 5].forEach(c => {
              r.getCell(c).fill = ZEBRA_FILL;
            });
          }

          r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
          r.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
          r.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
          r.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
          r.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };

          r.getCell(3).numFmt = '$#,##0.00';
        });

        // Total Row "Detalle de Ventas"
        const dtEndRow = dtNextRow - 1;
        const totDtRow = ws2.getRow(dtNextRow++);
        totDtRow.values = [
          "TOTAL GENERAL",
          "",
          { formula: `=SUM(C5:C${dtEndRow})`, result: totalSalesVal },
          "",
          ""
        ];
        totDtRow.height = 24;

        [1, 2, 3, 4, 5].forEach(cIdx => {
          const cell = totDtRow.getCell(cIdx);
          cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF16A085' } };
          cell.border = BORDER_ACCOUNTING_TOTAL;
        });
        totDtRow.getCell(3).numFmt = '$#,##0.00';
      } else {
        const r = ws2.getRow(5);
        r.values = ["Sin datos de ventas registradas en el período", "-", 0, "-", "-"];
        r.getCell(3).numFmt = '$#,##0.00';
        dtNextRow = 6;
      }

      // Set Exact Column Widths for Detalle de Ventas
      ws2.getColumn(1).width = 58; // CONCEPTO
      ws2.getColumn(2).width = 22; // SESIÓN / REF
      ws2.getColumn(3).width = 22; // VALOR ($)
      ws2.getColumn(4).width = 28; // MEDIO DE PAGO
      ws2.getColumn(5).width = 22; // FECHA Y HORA

      // Save File
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const safeStoreName = mainBusinessName.toUpperCase().replace(/[^A-Z0-9]/gi, '_');
      const safePeriod = selectedPeriod.replace(/[^A-Z0-9]/gi, '_');
      const fileName = `Reporte_Ventas_${frequency.toUpperCase()}_${safeStoreName}_${safePeriod}.xlsx`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

    } catch (err) {
      console.error("Error generating sales report excel:", err);
      alert("Error al generar el reporte de ventas de Excel.");
    } finally {
      setIsExportingSalesReport(false);
    }
  };

  // Filter modules into their active sections for rendering
  const activeModules = useMemo(() => {
    return reportConfigs.filter(item => item.enabled);
  }, [reportConfigs]);

  const isModuleEnabled = (id: string) => {
    const config = reportConfigs.find(c => c.id === id);
    return config ? config.enabled : false;
  };

  const hasActiveModules = activeModules.length > 0;

  // Max value in evolution points for SVG bar scaling
  const maxEvolutionValue = useMemo(() => {
    const maxVal = Math.max(...metrics.evolutionPoints.map(p => p.profit), 1);
    return maxVal;
  }, [metrics.evolutionPoints]);

  return (
    <div className="bg-[#F9FAFB] min-h-screen p-4 md:p-6 select-none font-sans text-gray-800">
      
      {/* -------------------------------------------------------------
          VIEW: CONFIGURATION PANEL
          ------------------------------------------------------------- */}
      {activeView === 'config' ? (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between border-b border-gray-200 pb-4">
            <button 
              onClick={() => setActiveView('view')}
              className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-teal-600 transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver al Tablero</span>
            </button>
            <span className="text-[10px] bg-teal-50 border border-teal-150 text-teal-700 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Modo Personalización
            </span>
          </div>

          <div className="space-y-1 text-left">
            <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Layers className="w-6 h-6 text-teal-600 shrink-0" />
              <span>Tu Gestión</span>
            </h1>
            <p className="text-xs text-gray-500 font-medium max-w-xl">
              Arrastra y reordena los módulos para estructurar tu panel a tu gusto. Activa o desactiva qué estadísticas ver con los switches de la derecha.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {loadingConfig ? (
            <div className="space-y-4 py-8">
              <div className="h-10 bg-gray-200 rounded-xl animate-pulse"></div>
              <div className="h-20 bg-gray-200 rounded-xl animate-pulse"></div>
              <div className="h-20 bg-gray-200 rounded-xl animate-pulse"></div>
            </div>
          ) : (
            <div className="space-y-8 text-left">
              
              {/* SECTION 1: GRÁFICAS PRINCIPALES */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-gray-400 tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span>1. Gráficas Principales</span>
                  </h3>
                  <span className="text-[9px] bg-blue-50 text-blue-600 border border-blue-100 font-extrabold px-2 py-0.5 rounded uppercase">
                    Layout: 2 Columnas
                  </span>
                </div>
                <div className="bg-white border border-gray-100 rounded-xl p-2.5 space-y-2 shadow-xs">
                  {reportConfigs.filter(c => c.section === 'graficas').map((item) => {
                    const globalIdx = reportConfigs.findIndex(r => r.id === item.id);
                    return (
                      <div 
                        key={item.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, globalIdx)}
                        onDragOver={(e) => handleDragOver(e, globalIdx)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center justify-between p-3 border rounded-xl transition-all ${
                          item.enabled 
                            ? 'border-emerald-500 bg-emerald-50/10 shadow-2xs' 
                            : 'border-gray-200 bg-white opacity-80'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Drag Handle & Up/Down fallbacks */}
                          <div className="flex items-center gap-1">
                            <div className="cursor-grab text-gray-400 p-1 hover:text-gray-600 shrink-0">
                              <GripVertical className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <button 
                                onClick={() => moveItem(globalIdx, 'up')}
                                disabled={globalIdx === 0}
                                className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30 cursor-pointer"
                              >
                                <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                              </button>
                              <button 
                                onClick={() => moveItem(globalIdx, 'down')}
                                disabled={globalIdx === reportConfigs.length - 1}
                                className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30 cursor-pointer"
                              >
                                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                              </button>
                            </div>
                          </div>

                          <div className="min-w-0">
                            <h4 className="text-xs font-black text-gray-800 leading-tight">{item.title}</h4>
                            <p className="text-[10px] text-gray-400 font-medium truncate">{item.description}</p>
                          </div>
                        </div>

                        {/* Toggle Switch */}
                        <button
                          onClick={() => toggleItemActive(item.id)}
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

              {/* SECTION 2: COMPARATIVOS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-gray-400 tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    <span>2. Comparativos y Listados</span>
                  </h3>
                  <span className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-100 font-extrabold px-2 py-0.5 rounded uppercase">
                    Layout: 3 Columnas
                  </span>
                </div>
                <div className="bg-white border border-gray-100 rounded-xl p-2.5 space-y-2 shadow-xs">
                  {reportConfigs.filter(c => c.section === 'comparativos').map((item) => {
                    const globalIdx = reportConfigs.findIndex(r => r.id === item.id);
                    return (
                      <div 
                        key={item.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, globalIdx)}
                        onDragOver={(e) => handleDragOver(e, globalIdx)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center justify-between p-3 border rounded-xl transition-all ${
                          item.enabled 
                            ? 'border-emerald-500 bg-emerald-50/10 shadow-2xs' 
                            : 'border-gray-200 bg-white opacity-80'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex items-center gap-1">
                            <div className="cursor-grab text-gray-400 p-1 hover:text-gray-600 shrink-0">
                              <GripVertical className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <button 
                                onClick={() => moveItem(globalIdx, 'up')}
                                disabled={globalIdx === 0}
                                className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30 cursor-pointer"
                              >
                                <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                              </button>
                              <button 
                                onClick={() => moveItem(globalIdx, 'down')}
                                disabled={globalIdx === reportConfigs.length - 1}
                                className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30 cursor-pointer"
                              >
                                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                              </button>
                            </div>
                          </div>

                          <div className="min-w-0">
                            <h4 className="text-xs font-black text-gray-800 leading-tight">{item.title}</h4>
                            <p className="text-[10px] text-gray-400 font-medium truncate">{item.description}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => toggleItemActive(item.id)}
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

              {/* SECTION 3: DETALLE */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-gray-400 tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span>3. Detalle de Gastos</span>
                  </h3>
                  <span className="text-[9px] bg-rose-50 text-rose-600 border border-rose-100 font-extrabold px-2 py-0.5 rounded uppercase">
                    Layout: Ancho Completo
                  </span>
                </div>
                <div className="bg-white border border-gray-100 rounded-xl p-2.5 space-y-2 shadow-xs">
                  {reportConfigs.filter(c => c.section === 'detalle').map((item) => {
                    const globalIdx = reportConfigs.findIndex(r => r.id === item.id);
                    return (
                      <div 
                        key={item.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, globalIdx)}
                        onDragOver={(e) => handleDragOver(e, globalIdx)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center justify-between p-3 border rounded-xl transition-all ${
                          item.enabled 
                            ? 'border-emerald-500 bg-emerald-50/10 shadow-2xs' 
                            : 'border-gray-200 bg-white opacity-80'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex items-center gap-1">
                            <div className="cursor-grab text-gray-400 p-1 hover:text-gray-600 shrink-0">
                              <GripVertical className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <button 
                                onClick={() => moveItem(globalIdx, 'up')}
                                disabled={globalIdx === 0}
                                className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30 cursor-pointer"
                              >
                                <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                              </button>
                              <button 
                                onClick={() => moveItem(globalIdx, 'down')}
                                disabled={globalIdx === reportConfigs.length - 1}
                                className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30 cursor-pointer"
                              >
                                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                              </button>
                            </div>
                          </div>

                          <div className="min-w-0">
                            <h4 className="text-xs font-black text-gray-800 leading-tight">{item.title}</h4>
                            <p className="text-[10px] text-gray-400 font-medium truncate">{item.description}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => toggleItemActive(item.id)}
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

              {/* ACTION: GUARDAR CAMBIOS */}
              <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
                <p className="text-xs text-gray-400 font-medium">
                  {activeModules.length} de {reportConfigs.length} módulos activados
                </p>

                <button
                  onClick={handleSaveConfig}
                  disabled={savingConfig}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {savingConfig ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Guardar cambios</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          )}
        </div>
      ) : (

        /* -------------------------------------------------------------
           VIEW: PRINCIPAL DASHBOARD
           ------------------------------------------------------------- */
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* HEADER SECTION */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-5">
            <div className="space-y-1 text-left">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                  <BarChart2 className="w-6 h-6 text-teal-600 shrink-0" />
                  <span>Tu Gestión</span>
                </h1>
                {businessProfile?.name && (
                  <span className="px-2.5 py-0.5 bg-blue-50 border border-blue-200 text-[#005da9] text-[11px] font-black rounded-lg">
                    {businessProfile.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 font-medium">
                Monitorea en tiempo real todas tus ventas de caja POS, pedidos online, egresos de caja y métricas de desempeño.
              </p>
            </div>

            {/* CONTROLS & ACTIONS */}
            <div className="flex flex-wrap items-center gap-2.5">
              
              {/* Interactive Currency Selector for Reports */}
              <div className="flex items-center bg-gray-150/70 p-1 rounded-xl border border-gray-200 text-xs font-bold shadow-2xs">
                <span className="text-[10px] font-black uppercase text-gray-500 px-1.5 hidden sm:inline flex items-center gap-1">
                  <Coins className="w-3 h-3 text-[#005da9]" />
                  <span>Moneda:</span>
                </span>
                {(['USD', 'VES', 'EUR', 'COP'] as CurrencyCode[]).map((curr) => {
                  const isSelected = reportCurrency === curr;
                  const symbol = curr === 'USD' ? '$' : curr === 'VES' ? 'Bs' : curr === 'EUR' ? '€' : 'COP$';
                  return (
                    <button
                      key={curr}
                      type="button"
                      onClick={() => handleCurrencyChange(curr)}
                      title={`Ver todos los reportes en ${curr} (Tasa: ${currencyRates[curr] || 1})`}
                      className={`px-2.5 py-1 rounded-lg transition text-xs flex items-center gap-1 cursor-pointer ${
                        isSelected 
                          ? 'bg-[#005da9] text-white shadow-xs font-black ring-1 ring-[#004b87]' 
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      <span className="font-mono text-[11px] opacity-80">{symbol}</span>
                      <span className="font-bold">{curr}</span>
                    </button>
                  );
                })}
              </div>

              {/* Frequency Selector */}
              <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs font-bold">
                {(['diario', 'semanal', 'mensual', 'anual'] as const).map((freq) => (
                  <button
                    key={freq}
                    onClick={() => handleFrequencyChange(freq)}
                    className={`px-3 py-1 rounded-lg transition capitalize cursor-pointer ${
                      frequency === freq 
                        ? 'bg-white text-gray-900 shadow-xs font-extrabold' 
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {freq}
                  </button>
                ))}
              </div>

              {/* Period Navigator with Dropdown & Prev/Next */}
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-0.5 shadow-xs">
                <button
                  onClick={() => handleNavigatePeriod('prev')}
                  disabled={availablePeriods.indexOf(selectedPeriod) >= availablePeriods.length - 1}
                  title="Período anterior"
                  className="p-1 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-30 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="relative">
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="bg-transparent text-gray-800 text-xs font-bold px-2 py-1 pr-7 focus:outline-none cursor-pointer appearance-none"
                  >
                    {availablePeriods.map((p) => (
                      <option key={p} value={p}>
                        {formatPeriodLabel(p)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                <button
                  onClick={() => handleNavigatePeriod('next')}
                  disabled={availablePeriods.indexOf(selectedPeriod) <= 0}
                  title="Período siguiente"
                  className="p-1 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-30 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Refresh Button */}
              <button
                onClick={fetchLatestFromDb}
                disabled={isSyncing}
                title="Sincronizar con base de datos"
                className="p-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1 text-xs font-bold px-2.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-teal-600' : ''}`} />
                <span className="hidden sm:inline">Sincronizar</span>
              </button>

              {/* Export PDF Button */}
              <button
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                title={`Exportar reporte ejecutivo en PDF`}
                className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 text-xs font-bold px-3 py-1.5 rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isExportingPdf ? (
                  <RefreshCw className="w-3.5 h-3.5 text-rose-600 animate-spin" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-rose-600" />
                )}
                <span>PDF</span>
              </button>

              {/* Export Excel Button */}
              <button
                onClick={handleExportExcel}
                disabled={isExportingExcel}
                title={`Exportar reporte ejecutivo en Excel`}
                className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isExportingExcel ? (
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span>Excel</span>
              </button>

              {/* Customize / Config Button */}
              <button
                onClick={handleGoToConfigPanel}
                title="Personalizar Panel"
                className="flex items-center justify-center bg-teal-600 hover:bg-teal-700 text-white p-2 rounded-xl transition shadow-xs cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* DYNAMIC RENDERING OF MODULES */}
          {loadingConfig ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-44 bg-gray-200 rounded-2xl animate-pulse"></div>
              <div className="h-44 bg-gray-200 rounded-2xl animate-pulse"></div>
            </div>
          ) : !hasActiveModules ? (
            
            /* EMPTY STATE */
            <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center max-w-xl mx-auto shadow-sm space-y-4">
              <div className="w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto border border-dashed border-gray-200">
                <EyeOff className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-gray-800">No tienes estadísticas seleccionadas</h3>
                <p className="text-xs text-gray-400 font-medium">
                  Haz clic en el botón Personalizar para activar los reportes que deseas visualizar en tu negocio.
                </p>
              </div>
              <button
                onClick={handleGoToConfigPanel}
                className="inline-flex items-center gap-1.5 bg-[#005da9] hover:bg-[#004e8c] text-white text-xs font-black px-4.5 py-2 rounded-xl transition shadow-xs cursor-pointer"
              >
                <Settings className="w-4 h-4" />
                <span>Personalizar Panel</span>
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              
              {/* SECTION 1: GRÁFICAS PRINCIPALES (Grid of 2) */}
              {activeModules.some(m => m.section === 'graficas') && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
                  
                  {/* CARD: TU GANANCIA */}
                  {isModuleEnabled('tu_ganancia') && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4 relative overflow-hidden flex flex-col justify-between min-h-[310px]">
                      
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Tu Ganancia Bruta (Margen)</span>
                          <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 font-black px-2 py-0.5 rounded-full">
                            {metrics.totalTransactionsCount} transacciones
                          </span>
                        </div>
                        <p className="text-3xl font-black text-gray-900 leading-none">
                          {formatValue(metrics.totalProfit)}
                        </p>
                      </div>

                      {/* Dynamic Real Evolution SVG Column Chart */}
                      <div className="w-full h-28 mt-2 flex flex-col justify-end">
                        <div className="w-full h-20 flex items-end justify-between gap-2 px-1 border-b border-gray-100 pb-1">
                          {metrics.evolutionPoints.length === 0 ? (
                            <div className="w-full text-center text-xs text-gray-400 py-4 font-medium">
                              Sin registros en este rango
                            </div>
                          ) : (
                            metrics.evolutionPoints.map((item, idx) => {
                              const heightPercent = maxEvolutionValue > 0 
                                ? Math.max(12, Math.min(100, Math.round((item.profit / maxEvolutionValue) * 100)))
                                : 12;
                              const isCurrent = item.key === selectedPeriod;

                              return (
                                <button
                                  type="button"
                                  key={idx}
                                  onClick={() => setSelectedPeriod(item.key)}
                                  title={`Ver reporte de: ${item.label}`}
                                  className="flex-1 flex flex-col items-center gap-1 group relative cursor-pointer focus:outline-none transition-transform hover:-translate-y-0.5"
                                >
                                  {/* Tooltip on hover */}
                                  <div className="absolute -top-8 bg-gray-900 text-white text-[9px] font-bold py-0.5 px-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-md flex items-center gap-1">
                                    <span>{item.label}:</span>
                                    <span className="text-emerald-300 font-mono">{formatValue(item.profit)}</span>
                                  </div>

                                  {/* Bar column */}
                                  <div className={`w-full max-w-[28px] h-20 flex items-end justify-center rounded-t-md p-0.5 transition-all ${
                                    isCurrent ? 'bg-emerald-100 ring-2 ring-emerald-500' : 'bg-gray-50 group-hover:bg-emerald-50/50'
                                  }`}>
                                    <div 
                                      className={`w-full rounded-t-md transition-all duration-300 ${
                                        isCurrent 
                                          ? 'bg-emerald-600 shadow-sm' 
                                          : 'bg-emerald-400/80 group-hover:bg-emerald-500'
                                      }`}
                                      style={{ height: `${heightPercent}%` }}
                                    />
                                  </div>

                                  {/* X Axis Label */}
                                  <span className={`text-[8px] font-bold uppercase transition-colors ${
                                    isCurrent ? 'text-emerald-700 font-black underline underline-offset-2' : 'text-gray-400 group-hover:text-gray-700'
                                  }`}>
                                    {item.label}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Footer Metrics */}
                      <div className="grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 text-center">
                        <div>
                          <p className="text-[9px] text-gray-400 font-extrabold uppercase">Vendido</p>
                          <p className="text-xs font-black text-gray-800">{formatValue(metrics.totalSales)}</p>
                        </div>
                        <div className="border-x border-gray-100">
                          <p className="text-[9px] text-gray-400 font-extrabold uppercase">Costo Estimado</p>
                          <p className="text-xs font-black text-red-600">{formatValue(metrics.totalCost)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-400 font-extrabold uppercase">Margen Bruto</p>
                          <p className="text-xs font-black text-teal-700">{(metrics.marginPercent).toFixed(1)}%</p>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* CARD: TUS VENTAS */}
                  {isModuleEnabled('tus_ventas') && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4 relative overflow-hidden flex flex-col justify-between min-h-[310px]">
                      
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Ventas Totales</span>
                          <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-100 font-black px-2 py-0.5 rounded-full">
                            {metrics.totalTransactions} {metrics.totalTransactions === 1 ? 'venta' : 'ventas'}
                          </span>
                        </div>
                        <p className="text-3xl font-black text-gray-900 leading-none">
                          {formatValue(metrics.totalSales)}
                        </p>
                      </div>

                      {/* Dynamic Real Trend Area Chart */}
                      <div className="w-full h-28 mt-2 flex flex-col justify-end">
                        <div className="w-full h-20 flex items-end justify-between gap-2 px-1 border-b border-gray-100 pb-1">
                          {metrics.evolutionPoints.length === 0 ? (
                            <div className="w-full text-center text-xs text-gray-400 py-4 font-medium">
                              Sin registros en este rango
                            </div>
                          ) : (
                            metrics.evolutionPoints.map((item, idx) => {
                              const maxSales = Math.max(...metrics.evolutionPoints.map(p => p.sales), 1);
                              const heightPercent = maxSales > 0 
                                ? Math.max(12, Math.min(100, Math.round((item.sales / maxSales) * 100)))
                                : 12;
                              const isCurrent = item.key === selectedPeriod;

                              return (
                                <button
                                  type="button"
                                  key={idx}
                                  onClick={() => setSelectedPeriod(item.key)}
                                  title={`Ver reporte de: ${item.label}`}
                                  className="flex-1 flex flex-col items-center gap-1 group relative cursor-pointer focus:outline-none transition-transform hover:-translate-y-0.5"
                                >
                                  {/* Tooltip on hover */}
                                  <div className="absolute -top-8 bg-blue-950 text-white text-[9px] font-bold py-0.5 px-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-md flex items-center gap-1">
                                    <span>{item.label}:</span>
                                    <span className="text-blue-300 font-mono">{formatValue(item.sales)}</span>
                                  </div>

                                  {/* Bar column */}
                                  <div className={`w-full max-w-[28px] h-20 flex items-end justify-center rounded-t-md p-0.5 transition-all ${
                                    isCurrent ? 'bg-blue-100 ring-2 ring-blue-500' : 'bg-blue-50/40 group-hover:bg-blue-50'
                                  }`}>
                                    <div 
                                      className={`w-full rounded-t-md transition-all duration-300 ${
                                        isCurrent 
                                          ? 'bg-blue-600 shadow-sm' 
                                          : 'bg-blue-400/80 group-hover:bg-blue-500'
                                      }`}
                                      style={{ height: `${heightPercent}%` }}
                                    />
                                  </div>

                                  {/* X Axis Label */}
                                  <span className={`text-[8px] font-bold uppercase transition-colors ${
                                    isCurrent ? 'text-blue-700 font-black underline underline-offset-2' : 'text-gray-400 group-hover:text-gray-700'
                                  }`}>
                                    {item.label}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Footer Metrics */}
                      <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 text-center">
                        <div className="border-r border-gray-100">
                          <p className="text-[9px] text-gray-400 font-extrabold uppercase">Total Facturado</p>
                          <p className="text-sm font-black text-gray-800">{metrics.totalTransactions} operaciones</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-400 font-extrabold uppercase">Ticket Promedio</p>
                          <p className="text-sm font-black text-blue-700">{formatValue(metrics.avgSale)}</p>
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              )}

              {/* SECTION 2: COMPARATIVOS / LISTAS (Grid of 3) */}
              {activeModules.some(m => m.section === 'comparativos') && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
                  
                  {/* CARD: TOP PRODUCTOS */}
                  {isModuleEnabled('top_productos') && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Top Productos</span>
                          <span className="text-[8px] bg-amber-50 text-amber-700 border border-amber-100 font-extrabold px-1.5 py-0.5 rounded">
                            Más vendidos
                          </span>
                        </div>

                        {metrics.topProducts.length === 0 ? (
                          <div className="text-center py-8 text-xs text-gray-400 font-medium">
                            No hay productos facturados en este período.
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {metrics.topProducts.map((p, idx) => (
                              <div key={idx} className="flex items-center gap-2.5 justify-between p-2 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-8 h-8 bg-blue-50 text-[#005da9] font-black text-[10px] rounded-lg flex items-center justify-center shrink-0 border border-blue-100">
                                    {idx + 1}º
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-black text-gray-800 leading-tight truncate">{p.name}</p>
                                    <p className="text-[9px] text-gray-400 font-bold uppercase leading-none mt-1">SKU: {p.sku || 'N/A'}</p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-[11px] font-black text-gray-900">{p.qty} u.</p>
                                  <p className="text-[8px] text-emerald-600 font-bold mt-0.5">{formatValue(p.profit)} ganancia</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                        <span className="text-[9px] text-gray-400 font-extrabold uppercase">Categoría Principal</span>
                        <span className="text-[10px] text-gray-700 font-black truncate max-w-[160px]">{metrics.leadingCategory}</span>
                      </div>
                    </div>
                  )}

                  {/* CARD: TOP CLIENTES */}
                  {isModuleEnabled('top_clientes') && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Top Clientes</span>
                          <span className="text-[8px] bg-teal-50 text-teal-700 border border-teal-100 font-extrabold px-1.5 py-0.5 rounded">
                            Mayor Consumo
                          </span>
                        </div>

                        {metrics.topClients.length === 0 ? (
                          <div className="text-center py-8 text-xs text-gray-400 font-medium">
                            No hay compras registradas en este período.
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {metrics.topClients.map((c, idx) => (
                              <div key={idx} className="flex items-center gap-2.5 justify-between p-2 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-8 h-8 bg-teal-50 text-teal-600 font-black text-[10px] rounded-lg flex items-center justify-center shrink-0 border border-teal-100">
                                    <User className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-black text-gray-800 leading-tight truncate">{c.name}</p>
                                    <p className="text-[9px] text-gray-400 font-bold uppercase leading-none mt-1">{c.count} {c.count === 1 ? 'compra' : 'compras'}</p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-[11px] font-black text-gray-900">{formatValue(c.total)}</p>
                                  <p className="text-[8px] text-teal-600 font-bold mt-0.5">Cliente Frecuente</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                        <span className="text-[9px] text-gray-400 font-extrabold uppercase">Cliente Principal</span>
                        <span className="text-[10px] text-gray-700 font-black truncate max-w-[150px]">
                          {metrics.topClients[0]?.name || 'Ninguno'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* CARD: TOP EMPLEADOS */}
                  {isModuleEnabled('top_empleados') && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Desempeño Equipo</span>
                          <span className="text-[8px] bg-purple-50 text-purple-700 border border-purple-100 font-extrabold px-1.5 py-0.5 rounded">
                            Facturación Vendedores
                          </span>
                        </div>

                        {metrics.topEmployees.length === 0 ? (
                          <div className="text-center py-8 text-xs text-gray-400 font-medium">
                            No hay operadores registrados en este período.
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {metrics.topEmployees.map((e, idx) => (
                              <div key={idx} className="flex items-center gap-2.5 justify-between p-2 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-8 h-8 bg-purple-50 text-purple-600 font-black text-[10px] rounded-lg flex items-center justify-center shrink-0 border border-purple-100">
                                    <Users className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-black text-gray-800 leading-tight truncate">{e.name}</p>
                                    <p className="text-[9px] text-gray-400 font-bold uppercase leading-none mt-1">{e.count} operaciones</p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-[11px] font-black text-gray-900">{formatValue(e.sales)}</p>
                                  <p className="text-[8px] text-purple-600 font-bold mt-0.5">
                                    {idx === 0 ? 'Líder del Período' : 'Operador'}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                        <span className="text-[9px] text-gray-400 font-extrabold uppercase">Total Facturado</span>
                        <span className="text-[10px] text-gray-700 font-black">{formatValue(metrics.totalSales)}</span>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* SECTION 3: DETALLE (Grid of 1 / Full Width) */}
              {activeModules.some(m => m.section === 'detalle') && (
                <div className="grid grid-cols-1 gap-6 text-left">
                  
                  {/* CARD: TUS GASTOS */}
                  {isModuleEnabled('tus_gastos') && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                      
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Gastos de Operación</span>
                        <span className="text-[8px] bg-red-50 text-red-700 border border-red-100 font-extrabold px-1.5 py-0.5 rounded">
                          Egresos de caja
                        </span>
                      </div>

                      {/* QUICK CONSULTATION BUTTONS */}
                      <div className="bg-gray-50/50 border border-gray-150 rounded-xl p-3.5 space-y-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[9px] font-black uppercase text-gray-400 mr-1">Consultar:</span>
                          <button
                            type="button"
                            onClick={handleQueryCuantoMes}
                            className="px-2.5 py-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-[10px] font-black rounded-lg transition flex items-center gap-1 cursor-pointer shadow-2xs"
                          >
                            <HelpCircle className="w-3 h-3 text-[#005da9]" />
                            <span>¿Cuánto gasté este mes?</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleQueryQueGasteMas}
                            className="px-2.5 py-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-[10px] font-black rounded-lg transition flex items-center gap-1 cursor-pointer shadow-2xs"
                          >
                            <PieChart className="w-3 h-3 text-[#005da9]" />
                            <span>¿En qué gasté más?</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleQueryResumenCompleto}
                            className="px-2.5 py-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-[10px] font-black rounded-lg transition flex items-center gap-1 cursor-pointer shadow-2xs"
                          >
                            <Info className="w-3 h-3 text-[#005da9]" />
                            <span>Resumen de Gastos</span>
                          </button>
                        </div>

                        {/* QUERY RESPONSE PANEL */}
                        {queryResponse && (
                          <div id="assistant-response-panel" className="bg-white border border-gray-200/85 rounded-xl p-3 relative text-left">
                            <button
                              type="button"
                              onClick={() => setQueryResponse(null)}
                              className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 p-0.5 rounded-md hover:bg-gray-100 transition cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Sparkles className="w-4 h-4 text-[#005da9]" />
                              <h4 className="text-[10px] font-black text-slate-900 tracking-tight uppercase">{queryResponse.title}</h4>
                            </div>
                            {queryResponse.content}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                        
                        {/* Highlights */}
                        <div className="md:col-span-4 space-y-2">
                          <p className="text-3xl font-black text-red-600 leading-none">
                            {formatValue(metrics.totalExpenses)}
                          </p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                            Total egresos registrados en caja
                          </p>
                          <div className="p-3 bg-red-50/50 rounded-xl border border-red-100 text-[10px] text-red-700 font-medium">
                            Los gastos representan un {(metrics.totalSales > 0 ? (metrics.totalExpenses / metrics.totalSales) * 100 : 0).toFixed(1)}% del valor total de las ventas brutas del período actual.
                          </div>
                        </div>

                        {/* Category List */}
                        <div className="md:col-span-8 space-y-3.5">
                          {Object.keys(metrics.expensesByCategory).length === 0 ? (
                            <div className="text-center py-6 text-xs text-gray-400 font-medium bg-gray-50 rounded-xl border border-gray-100">
                              No se han registrado egresos de caja para este período.
                            </div>
                          ) : (
                            Object.entries(metrics.expensesByCategory).map(([cat, val], idx) => {
                              const numericVal = val as number;
                              const percent = metrics.totalExpenses > 0 ? (numericVal / metrics.totalExpenses) * 100 : 0;
                              
                              let icon = <ShoppingCart className="w-4 h-4 text-blue-500" />;
                              if (cat.includes('Nómina')) icon = <Briefcase className="w-4 h-4 text-emerald-500" />;
                              if (cat.includes('Arriendo') || cat.includes('Alquiler')) icon = <Home className="w-4 h-4 text-amber-500" />;
                              if (cat.includes('Servicios')) icon = <CreditCard className="w-4 h-4 text-purple-500" />;

                              return (
                                <div key={idx} className="space-y-1.5">
                                  <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                      <div className="p-1.5 bg-gray-50 border border-gray-150 rounded-lg shrink-0">
                                        {icon}
                                      </div>
                                      <span className="font-extrabold text-gray-700">{cat}</span>
                                    </div>
                                    <div className="text-right">
                                      <span className="font-mono font-bold text-gray-900">{formatValue(numericVal)}</span>
                                      <span className="text-[9px] text-gray-400 font-bold ml-1.5">({percent.toFixed(0)}%)</span>
                                    </div>
                                  </div>
                                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                    <div 
                                      className="bg-red-500 h-full rounded-full transition-all duration-500" 
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                      </div>

                    </div>
                  )}

                  {/* CARD: DIVISAS Y MULTIMONEDA */}
                  {isModuleEnabled('report_multimoneda') && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-5">
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-blue-50 border border-blue-150 rounded-lg">
                            <Coins className="w-4 h-4 text-[#005da9]" />
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-gray-900 uppercase tracking-tight">Recaudación por Divisas y Multimoneda</h4>
                            <p className="text-[10px] text-gray-400 font-medium">Desglose de ingresos según moneda original de pago y métodos mixtos</p>
                          </div>
                        </div>
                        <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-100 font-black px-2 py-0.5 rounded-full">
                          Multidivisa en Vivo
                        </span>
                      </div>

                      {/* 4 Currency KPI Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        
                        {/* USD Card */}
                        <div className="bg-gradient-to-br from-emerald-50/60 to-emerald-100/30 border border-emerald-150 rounded-xl p-3.5 space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-black uppercase text-emerald-800 tracking-wider">
                            <span>🇺🇸 Dólares (USD)</span>
                            <span className="bg-emerald-100/80 px-1.5 py-0.5 rounded text-[9px] font-mono">1.00 USD</span>
                          </div>
                          <p className="text-xl font-black text-emerald-950 font-mono">
                            ${(metrics.multiCurrencySummary?.USD?.native || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <div className="flex items-center justify-between text-[9px] text-emerald-700 font-bold pt-1 border-t border-emerald-200/60">
                            <span>Equivalente {reportCurrency}:</span>
                            <span className="font-mono">{formatCurrency(metrics.multiCurrencySummary?.USD?.inReportCurrency || 0, reportCurrency, currencyRates)}</span>
                          </div>
                          <p className="text-[8px] text-emerald-600 font-bold">{metrics.multiCurrencySummary?.USD?.count || 0} cobros en USD</p>
                        </div>

                        {/* VES Card */}
                        <div className="bg-gradient-to-br from-blue-50/60 to-blue-100/30 border border-blue-150 rounded-xl p-3.5 space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-black uppercase text-blue-800 tracking-wider">
                            <span>🇻🇪 Bolívares (VES)</span>
                            <span className="bg-blue-100/80 px-1.5 py-0.5 rounded text-[9px] font-mono">{currencyRates.VES || bcvRate} Bs/$</span>
                          </div>
                          <p className="text-xl font-black text-blue-950 font-mono">
                            Bs. {(metrics.multiCurrencySummary?.VES?.native || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <div className="flex items-center justify-between text-[9px] text-blue-700 font-bold pt-1 border-t border-blue-200/60">
                            <span>Equivalente {reportCurrency}:</span>
                            <span className="font-mono">{formatCurrency(metrics.multiCurrencySummary?.VES?.inReportCurrency || 0, reportCurrency, currencyRates)}</span>
                          </div>
                          <p className="text-[8px] text-blue-600 font-bold">{metrics.multiCurrencySummary?.VES?.count || 0} cobros en Bs.</p>
                        </div>

                        {/* EUR Card */}
                        <div className="bg-gradient-to-br from-indigo-50/60 to-indigo-100/30 border border-indigo-150 rounded-xl p-3.5 space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-black uppercase text-indigo-800 tracking-wider">
                            <span>🇪🇺 Euros (EUR)</span>
                            <span className="bg-indigo-100/80 px-1.5 py-0.5 rounded text-[9px] font-mono">{currencyRates.EUR || 0.92} €/$</span>
                          </div>
                          <p className="text-xl font-black text-indigo-950 font-mono">
                            €{(metrics.multiCurrencySummary?.EUR?.native || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <div className="flex items-center justify-between text-[9px] text-indigo-700 font-bold pt-1 border-t border-indigo-200/60">
                            <span>Equivalente {reportCurrency}:</span>
                            <span className="font-mono">{formatCurrency(metrics.multiCurrencySummary?.EUR?.inReportCurrency || 0, reportCurrency, currencyRates)}</span>
                          </div>
                          <p className="text-[8px] text-indigo-600 font-bold">{metrics.multiCurrencySummary?.EUR?.count || 0} cobros en EUR</p>
                        </div>

                        {/* COP Card */}
                        <div className="bg-gradient-to-br from-amber-50/60 to-amber-100/30 border border-amber-150 rounded-xl p-3.5 space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-black uppercase text-amber-800 tracking-wider">
                            <span>🇨🇴 Pesos (COP)</span>
                            <span className="bg-amber-100/80 px-1.5 py-0.5 rounded text-[9px] font-mono">{currencyRates.COP || 4100} COP/$</span>
                          </div>
                          <p className="text-xl font-black text-amber-950 font-mono">
                            COP$ {(metrics.multiCurrencySummary?.COP?.native || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                          <div className="flex items-center justify-between text-[9px] text-amber-700 font-bold pt-1 border-t border-amber-200/60">
                            <span>Equivalente {reportCurrency}:</span>
                            <span className="font-mono">{formatCurrency(metrics.multiCurrencySummary?.COP?.inReportCurrency || 0, reportCurrency, currencyRates)}</span>
                          </div>
                          <p className="text-[8px] text-amber-600 font-bold">{metrics.multiCurrencySummary?.COP?.count || 0} cobros en COP</p>
                        </div>

                      </div>

                      {/* Payment Methods Breakdown Table */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">
                            Desglose por Métodos de Pago y Moneda
                          </span>
                          {metrics.splitPaymentsCount > 0 && (
                            <span className="text-[9px] font-bold text-[#005da9] bg-blue-50 px-2 py-0.5 rounded border border-blue-150">
                              {metrics.splitPaymentsCount} transacciones con pago mixto/multimoneda
                            </span>
                          )}
                        </div>

                        {(!metrics.paymentMethodsBreakdown || metrics.paymentMethodsBreakdown.length === 0) ? (
                          <div className="text-center py-6 text-xs text-gray-400 font-medium bg-gray-50 rounded-xl border border-gray-100">
                            No hay transacciones registradas en este período.
                          </div>
                        ) : (
                          <div className="overflow-x-auto border border-gray-150 rounded-xl">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="bg-gray-50 text-[9px] uppercase font-black text-gray-400 border-b border-gray-200">
                                  <th className="py-2.5 px-3">Método / Canal</th>
                                  <th className="py-2.5 px-3">Moneda</th>
                                  <th className="py-2.5 px-3 text-right">Recaudación Nativa</th>
                                  <th className="py-2.5 px-3 text-right">Equivalente ({reportCurrency})</th>
                                  <th className="py-2.5 px-3 text-center">Transacciones</th>
                                  <th className="py-2.5 px-3 text-right">% Participación</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 font-medium">
                                {metrics.paymentMethodsBreakdown.map((pm: any, idx: number) => {
                                  const symbol = pm.currency === 'USD' ? '$' : pm.currency === 'VES' ? 'Bs.' : pm.currency === 'EUR' ? '€' : 'COP$';
                                  return (
                                    <tr key={idx} className="hover:bg-gray-50/80 transition">
                                      <td className="py-2.5 px-3 font-extrabold text-gray-800 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-[#005da9]" />
                                        <span>{pm.method}</span>
                                      </td>
                                      <td className="py-2.5 px-3 font-bold text-gray-600">
                                        <span className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-[9px] font-mono">
                                          {pm.currency}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">
                                        {symbol} {Number(pm.nativeTotal).toLocaleString(pm.currency === 'VES' ? 'es-VE' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#005da9]">
                                        {formatCurrency(pm.inReportCurrencyTotal, reportCurrency, currencyRates)}
                                      </td>
                                      <td className="py-2.5 px-3 text-center text-gray-500 font-bold">
                                        {pm.count}
                                      </td>
                                      <td className="py-2.5 px-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                          <div className="w-12 bg-gray-100 h-1.5 rounded-full overflow-hidden hidden sm:block">
                                            <div 
                                              className="bg-[#005da9] h-full rounded-full" 
                                              style={{ width: `${Math.min(100, Math.max(0, pm.percentage))}%` }}
                                            />
                                          </div>
                                          <span className="font-bold text-gray-700 text-[10px] w-9 text-right">
                                            {pm.percentage.toFixed(1)}%
                                          </span>
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
                  )}

                </div>
              )}

            </div>
          )}

          {/* FISCAL/FORMAL REPORTING FOOTER */}
          {activeView === 'view' && hasActiveModules && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm text-left mt-6">
              <h3 className="text-xs font-black uppercase text-gray-800 tracking-wider mb-3">Descarga</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 border border-gray-150 rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-extrabold text-gray-800 font-sans">Reporte Ejecutivo (PDF)</h4>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-medium">Informe formateado para impresión con KPIs, desglose y transacciones.</p>
                  </div>
                  <button
                    onClick={handleExportPdf}
                    disabled={isExportingPdf}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] uppercase rounded-lg shadow-xs cursor-pointer transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isExportingPdf ? (
                      <RefreshCw className="w-3 h-3 animate-spin text-white" />
                    ) : (
                      <FileText className="w-3 h-3 text-white" />
                    )}
                    <span>PDF</span>
                  </button>
                </div>

                <div className="p-4 bg-gray-50 border border-gray-150 rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-extrabold text-gray-800 font-sans">Reporte de Ventas (Excel)</h4>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-medium">Consolidado corporativo en Excel con KPIs y detalle transaccional.</p>
                  </div>
                  <button
                    onClick={handleExportSalesReport}
                    disabled={isExportingSalesReport}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase rounded-lg shadow-xs cursor-pointer transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isExportingSalesReport ? (
                      <RefreshCw className="w-3 h-3 animate-spin text-white" />
                    ) : (
                      <Download className="w-3 h-3 text-white" />
                    )}
                    <span>Excel</span>
                  </button>
                </div>

                {onPrintInventoryReport && (
                  <div className="p-4 bg-gray-50 border border-gray-150 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-extrabold text-gray-800 font-sans">Stock Crítico (PDF)</h4>
                      <p className="text-[10px] text-gray-400 mt-0.5 font-medium">Listado detallado de productos próximos a agotarse.</p>
                    </div>
                    <button
                      onClick={onPrintInventoryReport}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-900 text-white font-black text-[10px] uppercase rounded-lg shadow-xs cursor-pointer transition"
                    >
                      Imprimir
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
