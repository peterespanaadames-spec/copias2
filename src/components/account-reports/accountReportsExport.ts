import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { BankAccount, AccountReceivable, AccountReceivablePayment, AccountPayable, AccountPayablePayment, BusinessProfile } from '../../types';

interface BankStatementExportParams {
  account: BankAccount;
  startDate: string;
  endDate: string;
  initialBalance: number;
  finalBalance: number;
  totalIncome: number;
  totalExpense: number;
  totalCommissions: number;
  movements: Array<{
    date: string;
    reference: string;
    type: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    amountVES?: number;
  }>;
  businessProfile?: BusinessProfile | null;
  bcvRate: number;
}

// --------------------------------------------------------------------------
// 1. ESTADO DE CUENTA BANCARIA: PDF & EXCEL
// --------------------------------------------------------------------------
export const exportBankStatementPDF = ({
  account,
  startDate,
  endDate,
  initialBalance,
  finalBalance,
  totalIncome,
  totalExpense,
  totalCommissions,
  movements,
  businessProfile,
  bcvRate
}: BankStatementExportParams) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const primaryColor: [number, number, number] = [29, 53, 87]; // #1D3557
  const accentColor: [number, number, number] = [230, 57, 70]; // #E63946
  const darkGray: [number, number, number] = [43, 45, 66];

  // Header Banner
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 216, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text((businessProfile?.name || 'COPIAS BELLA VISTA, C.A.').toUpperCase(), 14, 11);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`RIF: ${businessProfile?.rif || 'J-50987654-3'}  |  Tasa BCV Referencial: Bs. ${bcvRate.toFixed(2)}`, 14, 18);
  doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-VE')} ${new Date().toLocaleTimeString('es-VE')}`, 14, 23);

  // Title Box
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('ESTADO DE CUENTA BANCARIO OFICIAL', 202, 12, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Período: ${startDate} al ${endDate}`, 202, 18, { align: 'right' });
  doc.text(`Moneda: ${account.currency}`, 202, 23, { align: 'right' });

  // Account Information Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 32, 188, 22, 2, 2, 'FD');

  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`INSTITUCIÓN: ${account.bank_name || account.name}`, 18, 38);
  doc.text(`N° CUENTA: ${account.account_number || 'N/D'}`, 18, 44);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkGray);
  doc.text(`Tipo / Identificador: ${account.name} (${account.account_type || 'Corriente'})`, 18, 50);

  // Summary KPI box right side
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text(`Saldo Inicial: ${account.currency === 'USD' ? '$' : 'Bs.'} ${initialBalance.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 120, 38);
  doc.setTextColor(16, 185, 129); // Green
  doc.text(`Total Ingresos (+): ${account.currency === 'USD' ? '$' : 'Bs.'} ${totalIncome.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 120, 44);
  doc.setTextColor(225, 29, 72); // Red
  doc.text(`Total Egresos (-): ${account.currency === 'USD' ? '$' : 'Bs.'} ${totalExpense.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 120, 50);

  // Saldo Final Pill
  doc.setFillColor(29, 53, 87);
  doc.roundedRect(14, 57, 188, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(
    `SALDO DISPONIBLE AL CORTE: ${account.currency === 'USD' ? '$' : 'Bs.'} ${finalBalance.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    18,
    63.5
  );
  if (account.currency === 'USD') {
    doc.setFontSize(8.5);
    doc.text(`(Equivalente BCV: Bs. ${(finalBalance * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`, 130, 63.5);
  } else {
    doc.setFontSize(8.5);
    doc.text(`(Equivalente USD: $ ${(bcvRate > 0 ? finalBalance / bcvRate : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`, 130, 63.5);
  }

  // Movements Table
  const tableRows = movements.map(m => [
    m.date,
    m.reference || 'N/A',
    m.type,
    m.description,
    m.debit > 0 ? `-${m.debit.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
    m.credit > 0 ? `+${m.credit.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
    `${m.balance.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  ]);

  autoTable(doc, {
    startY: 70,
    head: [['Fecha', 'Referencia', 'Operación', 'Concepto / Beneficiario', 'Débito (-)', 'Crédito (+)', 'Saldo']],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 24, halign: 'center' },
      2: { cellWidth: 24, halign: 'center' },
      3: { cellWidth: 60 },
      4: { cellWidth: 20, halign: 'right', textColor: [225, 29, 72] },
      5: { cellWidth: 20, halign: 'right', textColor: [16, 185, 129] },
      6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 14, right: 14 }
  });

  // Footer / Signatures
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Página ${i} de ${pageCount}  •  Sistema Administrativo Copias Bella Vista  •  Documento Confidencial`, 108, 272, { align: 'center' });
  }

  doc.save(`Estado_Cuenta_${account.bank_name || account.name}_${startDate}_${endDate}.pdf`);
};

export const exportBankStatementExcel = ({
  account,
  startDate,
  endDate,
  initialBalance,
  finalBalance,
  totalIncome,
  totalExpense,
  movements,
  businessProfile,
  bcvRate
}: BankStatementExportParams) => {
  const wb = XLSX.utils.book_new();

  const data: any[][] = [
    [businessProfile?.name || 'COPIAS BELLA VISTA, C.A.'],
    ['ESTADO DE CUENTA BANCARIO OFICIAL'],
    [`Institución: ${account.bank_name || account.name}`, `N° Cuenta: ${account.account_number || 'N/A'}`],
    [`Período: ${startDate} al ${endDate}`, `Moneda: ${account.currency}`, `Tasa BCV: Bs. ${bcvRate.toFixed(2)}`],
    [],
    ['RESUMEN FINANCIERO'],
    ['Saldo Inicial', initialBalance],
    ['Total Ingresos (+)', totalIncome],
    ['Total Egresos (-)', totalExpense],
    ['Saldo Final al Corte', finalBalance],
    [],
    ['Fecha / Hora', 'Referencia', 'Tipo Operación', 'Concepto / Descripción', 'Débito (-)', 'Crédito (+)', 'Saldo Progresivo']
  ];

  movements.forEach(m => {
    data.push([
      m.date,
      m.reference || 'N/A',
      m.type,
      m.description,
      m.debit > 0 ? m.debit : 0,
      m.credit > 0 ? m.credit : 0,
      m.balance
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Estado_de_Cuenta');
  XLSX.writeFile(wb, `Estado_Cuenta_${account.bank_name || account.name}_${startDate}_${endDate}.xlsx`);
};

// --------------------------------------------------------------------------
// 2. ESTADO DE CUENTAS POR COBRAR (CxC): PDF & EXCEL
// --------------------------------------------------------------------------
interface CxCExportParams {
  mode: 'consolidado' | 'por_cliente' | 'por_vencer' | 'detallado' | 'historial';
  selectedClientName?: string;
  startDate: string;
  endDate: string;
  totals: {
    totalPendingUSD: number;
    totalPendingVES: number;
    totalOriginalUSD: number;
    totalPaidUSD: number;
    overdueCount: number;
    overdueAmountUSD: number;
    activeClientsCount: number;
  };
  receivables: AccountReceivable[];
  payments: AccountReceivablePayment[];
  businessProfile?: BusinessProfile | null;
  bcvRate: number;
}

export const exportCxCPDF = ({
  mode,
  selectedClientName,
  startDate,
  endDate,
  totals,
  receivables,
  payments,
  businessProfile,
  bcvRate
}: CxCExportParams) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const primaryColor: [number, number, number] = [29, 53, 87];

  // Header Banner
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 216, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text((businessProfile?.name || 'COPIAS BELLA VISTA, C.A.').toUpperCase(), 14, 10);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`RIF: ${businessProfile?.rif || 'J-50987654-3'}  |  Tasa BCV: Bs. ${bcvRate.toFixed(2)}`, 14, 16);
  doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-VE')} ${new Date().toLocaleTimeString('es-VE')}`, 14, 21);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  const modeTitle =
    mode === 'por_cliente'
      ? `ESTADO DE CUENTA: ${selectedClientName || 'CLIENTE'}`
      : mode === 'por_vencer'
      ? 'REPORTE DE CUENTAS POR COBRAR POR VENCER'
      : mode === 'historial'
      ? 'HISTORIAL CRONOLÓGICO DE ABONOS RECIBIDOS'
      : 'REPORTE CONSOLIDADO DE CUENTAS POR COBRAR';
  doc.text(modeTitle, 202, 12, { align: 'right' });
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Período: ${startDate} al ${endDate}`, 202, 18, { align: 'right' });

  // Summary Metric Badges
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 30, 188, 20, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryColor);
  doc.text(`TOTAL PENDIENTE: $${totals.totalPendingUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 18, 37);
  doc.text(`Bs. ${totals.totalPendingVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, 18, 43);

  doc.setTextColor(71, 85, 105);
  doc.text(`Total Facturado a Crédito: $${totals.totalOriginalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 85, 37);
  doc.setTextColor(16, 185, 129);
  doc.text(`Total Cobrado / Recuperado: $${totals.totalPaidUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 85, 43);

  doc.setTextColor(225, 29, 72);
  doc.text(`Cuentas Vencidas: ${totals.overdueCount} ($${totals.overdueAmountUSD.toFixed(2)})`, 150, 37);
  doc.setTextColor(71, 85, 105);
  doc.text(`Clientes Deudores: ${totals.activeClientsCount}`, 150, 43);

  if (mode === 'historial') {
    // Payments history table
    const tableRows = payments.map(p => [
      p.payment_date ? p.payment_date.substring(0, 10) : '—',
      p.account_receivable_id || '—',
      p.payment_method || 'Efectivo',
      p.reference || 'N/A',
      `$${Number(p.amount || 0).toFixed(2)}`,
      `Bs. ${(Number(p.amount_bs || 0) || Number(p.amount || 0) * bcvRate).toFixed(2)}`,
      p.notes || 'Abono registrado'
    ]);

    autoTable(doc, {
      startY: 55,
      head: [['Fecha', 'Documento', 'Método de Pago', 'Referencia', 'Monto ($)', 'Monto (Bs.)', 'Detalle']],
      body: tableRows,
      theme: 'striped',
      headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontSize: 7.5, halign: 'center' },
      bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
      columnStyles: {
        0: { cellWidth: 22, halign: 'center' },
        1: { cellWidth: 28 },
        2: { cellWidth: 26 },
        3: { cellWidth: 24, halign: 'center' },
        4: { cellWidth: 22, halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] },
        5: { cellWidth: 24, halign: 'right' },
        6: { cellWidth: 42 }
      },
      margin: { left: 14, right: 14 }
    });
  } else {
    // Accounts Receivable Table
    const tableRows = receivables.map(r => {
      const clientName = r.client_name || r.customer_name || r.entity_name || 'Cliente';
      const isOverdue = r.due_date && new Date(r.due_date) < new Date() && Number(r.remaining_amount || 0) > 0;
      return [
        r.invoice_number || r.subject || 'Crédito',
        clientName,
        r.issue_date ? r.issue_date.substring(0, 10) : '—',
        r.due_date ? r.due_date.substring(0, 10) : 'Al Válido',
        `$${Number(r.total_amount || 0).toFixed(2)}`,
        `$${Number(r.paid_amount || 0).toFixed(2)}`,
        `$${Number(r.remaining_amount || 0).toFixed(2)}`,
        isOverdue ? 'VENCIDO' : r.status ? r.status.toUpperCase() : 'PENDIENTE'
      ];
    });

    autoTable(doc, {
      startY: 55,
      head: [['Doc / Factura', 'Cliente / Deudor', 'Emisión', 'Vence', 'Total ($)', 'Abonado ($)', 'Pendiente ($)', 'Estado']],
      body: tableRows,
      theme: 'striped',
      headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontSize: 7.5, halign: 'center' },
      bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 50 },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 18, halign: 'right' },
        5: { cellWidth: 18, halign: 'right', textColor: [16, 185, 129] },
        6: { cellWidth: 20, halign: 'right', fontStyle: 'bold', textColor: [225, 29, 72] },
        7: { cellWidth: 20, halign: 'center', fontStyle: 'bold' }
      },
      margin: { left: 14, right: 14 }
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Página ${i} de ${pageCount}  •  Reporte de Cuentas por Cobrar  •  Copias Bella Vista`, 108, 272, { align: 'center' });
  }

  doc.save(`Reporte_CxC_${mode}_${startDate}_${endDate}.pdf`);
};

export const exportCxCExcel = ({
  mode,
  selectedClientName,
  startDate,
  endDate,
  totals,
  receivables,
  payments,
  businessProfile,
  bcvRate
}: CxCExportParams) => {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Receivables
  const data: any[][] = [
    [businessProfile?.name || 'COPIAS BELLA VISTA, C.A.'],
    ['REPORTE OFICIAL DE CUENTAS POR COBRAR (CxC)'],
    [`Modalidad: ${mode.toUpperCase()}`, `Cliente Filtro: ${selectedClientName || 'Todos'}`],
    [`Período: ${startDate} al ${endDate}`, `Tasa BCV: Bs. ${bcvRate.toFixed(2)}`],
    [],
    ['RESUMEN DE COBRANZAS'],
    ['Total Saldo Pendiente ($ USD)', totals.totalPendingUSD],
    ['Total Saldo Pendiente (Bs. VES)', totals.totalPendingVES],
    ['Total Facturado Crédito ($)', totals.totalOriginalUSD],
    ['Total Cobrado / Recuperado ($)', totals.totalPaidUSD],
    ['Cuentas Vencidas', totals.overdueCount],
    ['Monto en Mora ($)', totals.overdueAmountUSD],
    [],
    ['Documento / Factura', 'Cliente / Deudor', 'Teléfono', 'Fecha Emisión', 'Fecha Vencimiento', 'Monto Total ($)', 'Monto Abonado ($)', 'Saldo Pendiente ($)', 'Saldo Pendiente (Bs.)', 'Estado']
  ];

  receivables.forEach(r => {
    const clientName = r.client_name || r.customer_name || r.entity_name || 'Cliente';
    const isOverdue = r.due_date && new Date(r.due_date) < new Date() && Number(r.remaining_amount || 0) > 0;
    data.push([
      r.invoice_number || r.subject || 'Crédito',
      clientName,
      r.client_phone || r.customer_phone || 'N/A',
      r.issue_date ? r.issue_date.substring(0, 10) : '',
      r.due_date ? r.due_date.substring(0, 10) : '',
      Number(r.total_amount || 0),
      Number(r.paid_amount || 0),
      Number(r.remaining_amount || 0),
      Number(r.remaining_amount || 0) * bcvRate,
      isOverdue ? 'VENCIDO' : r.status || 'PENDIENTE'
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Cuentas_Por_Cobrar');

  // Sheet 2: Payments History
  if (payments && payments.length > 0) {
    const payData: any[][] = [
      ['HISTORIAL DE ABONOS RECIBIDOS EN CxC'],
      ['Fecha', 'ID Crédito', 'Método de Pago', 'Referencia', 'Monto ($ USD)', 'Monto (Bs. VES)', 'Notas / Detalle', 'Registrado Por']
    ];
    payments.forEach(p => {
      payData.push([
        p.payment_date ? p.payment_date.substring(0, 10) : '',
        p.account_receivable_id || '',
        p.payment_method || '',
        p.reference || 'N/A',
        Number(p.amount || 0),
        Number(p.amount_bs || 0) || Number(p.amount || 0) * bcvRate,
        p.notes || '',
        p.created_by || ''
      ]);
    });
    const wsPay = XLSX.utils.aoa_to_sheet(payData);
    XLSX.utils.book_append_sheet(wb, wsPay, 'Historial_Abonos');
  }

  XLSX.writeFile(wb, `Reporte_CxC_${mode}_${startDate}_${endDate}.xlsx`);
};

// --------------------------------------------------------------------------
// 3. ESTADO DE CUENTAS POR PAGAR (CxP): PDF & EXCEL
// --------------------------------------------------------------------------
interface CxPExportParams {
  mode: 'consolidado' | 'por_proveedor' | 'por_vencer' | 'detallado' | 'historial';
  selectedProviderName?: string;
  startDate: string;
  endDate: string;
  totals: {
    totalPendingUSD: number;
    totalPendingVES: number;
    totalOriginalUSD: number;
    totalPaidUSD: number;
    overdueCount: number;
    overdueAmountUSD: number;
    activeProvidersCount: number;
  };
  payables: AccountPayable[];
  payments: AccountPayablePayment[];
  businessProfile?: BusinessProfile | null;
  bcvRate: number;
}

export const exportCxPPDF = ({
  mode,
  selectedProviderName,
  startDate,
  endDate,
  totals,
  payables,
  payments,
  businessProfile,
  bcvRate
}: CxPExportParams) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const primaryColor: [number, number, number] = [29, 53, 87];

  // Header Banner
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 216, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text((businessProfile?.name || 'COPIAS BELLA VISTA, C.A.').toUpperCase(), 14, 10);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`RIF: ${businessProfile?.rif || 'J-50987654-3'}  |  Tasa BCV: Bs. ${bcvRate.toFixed(2)}`, 14, 16);
  doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-VE')} ${new Date().toLocaleTimeString('es-VE')}`, 14, 21);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  const modeTitle =
    mode === 'por_proveedor'
      ? `ESTADO DE CUENTA: PROVEEDOR ${selectedProviderName || ''}`
      : mode === 'por_vencer'
      ? 'REPORTE DE CUENTAS POR PAGAR POR VENCER'
      : mode === 'historial'
      ? 'HISTORIAL DE PAGOS A PROVEEDORES'
      : 'REPORTE CONSOLIDADO DE CUENTAS POR PAGAR';
  doc.text(modeTitle, 202, 12, { align: 'right' });
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Período: ${startDate} al ${endDate}`, 202, 18, { align: 'right' });

  // Summary Metrics
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 30, 188, 20, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryColor);
  doc.text(`TOTAL POR PAGAR: $${totals.totalPendingUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 18, 37);
  doc.text(`Bs. ${totals.totalPendingVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, 18, 43);

  doc.setTextColor(71, 85, 105);
  doc.text(`Compras a Crédito: $${totals.totalOriginalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 85, 37);
  doc.setTextColor(16, 185, 129);
  doc.text(`Total Liquidado / Pagado: $${totals.totalPaidUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 85, 43);

  doc.setTextColor(225, 29, 72);
  doc.text(`Facturas Vencidas: ${totals.overdueCount} ($${totals.overdueAmountUSD.toFixed(2)})`, 150, 37);
  doc.setTextColor(71, 85, 105);
  doc.text(`Proveedores Acreedores: ${totals.activeProvidersCount}`, 150, 43);

  if (mode === 'historial') {
    // Payments history table
    const tableRows = payments.map(p => [
      p.payment_date ? p.payment_date.substring(0, 10) : '—',
      p.account_payable_id || '—',
      p.payment_method || 'Transferencia',
      p.reference || 'N/A',
      `$${Number(p.amount || 0).toFixed(2)}`,
      `Bs. ${(Number(p.amount_bs || 0) || Number(p.amount || 0) * bcvRate).toFixed(2)}`,
      p.notes || 'Liquidación a proveedor'
    ]);

    autoTable(doc, {
      startY: 55,
      head: [['Fecha', 'Factura / CxP', 'Método Pago', 'Referencia', 'Monto ($)', 'Monto (Bs.)', 'Detalles']],
      body: tableRows,
      theme: 'striped',
      headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontSize: 7.5, halign: 'center' },
      bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
      columnStyles: {
        0: { cellWidth: 22, halign: 'center' },
        1: { cellWidth: 28 },
        2: { cellWidth: 26 },
        3: { cellWidth: 24, halign: 'center' },
        4: { cellWidth: 22, halign: 'right', fontStyle: 'bold', textColor: [225, 29, 72] },
        5: { cellWidth: 24, halign: 'right' },
        6: { cellWidth: 42 }
      },
      margin: { left: 14, right: 14 }
    });
  } else {
    // Accounts Payable Table
    const tableRows = payables.map(p => {
      const providerName = p.provider_name || p.entity_name || 'Proveedor';
      const isOverdue = p.due_date && new Date(p.due_date) < new Date() && Number(p.remaining_amount || 0) > 0;
      return [
        p.invoice_number || p.subject || 'Compra',
        providerName,
        p.issue_date ? p.issue_date.substring(0, 10) : '—',
        p.due_date ? p.due_date.substring(0, 10) : 'Inmediato',
        `$${Number(p.total_amount || 0).toFixed(2)}`,
        `$${Number(p.paid_amount || 0).toFixed(2)}`,
        `$${Number(p.remaining_amount || 0).toFixed(2)}`,
        isOverdue ? 'VENCIDA' : p.status ? p.status.toUpperCase() : 'PENDIENTE'
      ];
    });

    autoTable(doc, {
      startY: 55,
      head: [['Doc / Factura', 'Proveedor', 'Emisión', 'Vencimiento', 'Total ($)', 'Pagado ($)', 'Por Pagar ($)', 'Estado']],
      body: tableRows,
      theme: 'striped',
      headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontSize: 7.5, halign: 'center' },
      bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 50 },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 18, halign: 'right' },
        5: { cellWidth: 18, halign: 'right', textColor: [16, 185, 129] },
        6: { cellWidth: 20, halign: 'right', fontStyle: 'bold', textColor: [225, 29, 72] },
        7: { cellWidth: 20, halign: 'center', fontStyle: 'bold' }
      },
      margin: { left: 14, right: 14 }
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Página ${i} de ${pageCount}  •  Reporte de Cuentas por Pagar  •  Copias Bella Vista`, 108, 272, { align: 'center' });
  }

  doc.save(`Reporte_CxP_${mode}_${startDate}_${endDate}.pdf`);
};

export const exportCxPExcel = ({
  mode,
  selectedProviderName,
  startDate,
  endDate,
  totals,
  payables,
  payments,
  businessProfile,
  bcvRate
}: CxPExportParams) => {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Payables
  const data: any[][] = [
    [businessProfile?.name || 'COPIAS BELLA VISTA, C.A.'],
    ['REPORTE OFICIAL DE CUENTAS POR PAGAR (CxP)'],
    [`Modalidad: ${mode.toUpperCase()}`, `Proveedor Filtro: ${selectedProviderName || 'Todos'}`],
    [`Período: ${startDate} al ${endDate}`, `Tasa BCV: Bs. ${bcvRate.toFixed(2)}`],
    [],
    ['RESUMEN DE CUENTAS POR PAGAR'],
    ['Total Deuda Pendiente ($ USD)', totals.totalPendingUSD],
    ['Total Deuda Pendiente (Bs. VES)', totals.totalPendingVES],
    ['Total Compras a Crédito ($)', totals.totalOriginalUSD],
    ['Total Pagado / Liquidado ($)', totals.totalPaidUSD],
    ['Facturas Vencidas', totals.overdueCount],
    ['Monto Vencido ($)', totals.overdueAmountUSD],
    [],
    ['Documento / Factura', 'Proveedor', 'Fecha Emisión', 'Fecha Vencimiento', 'Monto Total ($)', 'Monto Pagado ($)', 'Saldo Por Pagar ($)', 'Saldo Por Pagar (Bs.)', 'Estado']
  ];

  payables.forEach(p => {
    const providerName = p.provider_name || p.entity_name || 'Proveedor';
    const isOverdue = p.due_date && new Date(p.due_date) < new Date() && Number(p.remaining_amount || 0) > 0;
    data.push([
      p.invoice_number || p.subject || 'Compra',
      providerName,
      p.issue_date ? p.issue_date.substring(0, 10) : '',
      p.due_date ? p.due_date.substring(0, 10) : '',
      Number(p.total_amount || 0),
      Number(p.paid_amount || 0),
      Number(p.remaining_amount || 0),
      Number(p.remaining_amount || 0) * bcvRate,
      isOverdue ? 'VENCIDA' : p.status || 'PENDIENTE'
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Cuentas_Por_Pagar');

  // Sheet 2: Payments
  if (payments && payments.length > 0) {
    const payData: any[][] = [
      ['HISTORIAL DE DESEMBOLSOS Y PAGOS A PROVEEDORES'],
      ['Fecha', 'Factura / CxP', 'Método de Pago', 'Referencia', 'Monto ($ USD)', 'Monto (Bs. VES)', 'Detalles', 'Registrado Por']
    ];
    payments.forEach(p => {
      payData.push([
        p.payment_date ? p.payment_date.substring(0, 10) : '',
        p.account_payable_id || '',
        p.payment_method || '',
        p.reference || 'N/A',
        Number(p.amount || 0),
        Number(p.amount_bs || 0) || Number(p.amount || 0) * bcvRate,
        p.notes || '',
        p.created_by || ''
      ]);
    });
    const wsPay = XLSX.utils.aoa_to_sheet(payData);
    XLSX.utils.book_append_sheet(wb, wsPay, 'Historial_Pagos');
  }

  XLSX.writeFile(wb, `Reporte_CxP_${mode}_${startDate}_${endDate}.xlsx`);
};
