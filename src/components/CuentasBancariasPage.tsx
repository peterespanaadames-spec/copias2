import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Landmark, 
  Plus, 
  Minus, 
  ArrowLeftRight, 
  Coins, 
  Trash2, 
  Edit2, 
  PlusCircle, 
  DollarSign, 
  Calendar, 
  RotateCw, 
  Download, 
  Check, 
  HelpCircle, 
  Info, 
  X,
  FileText,
  Lock,
  Unlock,
  CreditCard,
  Smartphone,
  Banknote,
  CheckCircle2,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { dbService } from '../lib/supabase';
import { BankAccount, BankTransfer, PaymentMethodConfig } from '../types';

interface AssociatedMethod {
  id?: string;
  code?: string;
  name: string;
  currency?: string;
  type?: string;
  incomingCommission: number;
  outgoingCommission: number;
}

interface CuentasBancariasPageProps {
  bcvRate: number;
  currentUser?: any;
  onRefreshData?: () => void;
}

export default function CuentasBancariasPage({ 
  bcvRate = 45.0, 
  currentUser,
  onRefreshData 
}: CuentasBancariasPageProps) {
  // --- States ---
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transfers, setTransfers] = useState<BankTransfer[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // System payment methods
  const [systemPaymentMethods, setSystemPaymentMethods] = useState<PaymentMethodConfig[]>([]);

  // Filter dates for details view
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // Default to 1st of current month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // --- Modals States ---
  const [showNewAccountModal, setShowNewAccountModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showPaymentMethodsModal, setShowPaymentMethodsModal] = useState(false);

  // --- Custom Non-Blocking Toast & Confirm States (prevents iframe sandboxing issues) ---
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<BankAccount | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // --- Form fields for NEW ACCOUNT / EDIT ACCOUNT ---
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountName, setAccountName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountCurrency, setAccountCurrency] = useState<'USD' | 'VES'>('VES');
  const [initialBalance, setInitialBalance] = useState('');
  const [accountPaymentMethods, setAccountPaymentMethods] = useState<AssociatedMethod[]>([]);
  
  // Selection of existing system payment method inside the Account modal
  const [selectedSystemMethodId, setSelectedSystemMethodId] = useState('');
  const [selectedIncomingCommission, setSelectedIncomingCommission] = useState('0');
  const [selectedOutgoingCommission, setSelectedOutgoingCommission] = useState('0');

  // Inline Create New Method inside Account Modal
  const [showCreateNewMethodForm, setShowCreateNewMethodForm] = useState(false);
  const [newCustomMethodName, setNewCustomMethodName] = useState('');
  const [newCustomMethodCurrency, setNewCustomMethodCurrency] = useState<'USD' | 'VES'>('VES');
  const [newCustomMethodType, setNewCustomMethodType] = useState<'movil' | 'transferencia' | 'efectivo' | 'punto' | 'digital' | 'otro'>('movil');
  const [newCustomMethodIncoming, setNewCustomMethodIncoming] = useState('0');
  const [newCustomMethodOutgoing, setNewCustomMethodOutgoing] = useState('0');

  // --- Form fields for TRANSFER ---
  const [transferFromId, setTransferFromId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferCommission, setTransferCommission] = useState('0');
  const [transferCommissionType, setTransferCommissionType] = useState<'fixed' | 'percent'>('fixed');
  const [transferReference, setTransferReference] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [customExchangeRate, setCustomExchangeRate] = useState(String(bcvRate));

  // --- Form fields for DEPOSIT / WITHDRAWAL ---
  const [transactionAccountId, setTransactionAccountId] = useState('');
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionReference, setTransactionReference] = useState('');
  const [transactionNotes, setTransactionNotes] = useState('');

  // --- Form fields for System Payment Method Manager Modal ---
  const [mgrNewName, setMgrNewName] = useState('');
  const [mgrNewCurrency, setMgrNewCurrency] = useState<'VES' | 'USD'>('VES');
  const [mgrNewType, setMgrNewType] = useState<'movil' | 'transferencia' | 'efectivo' | 'punto' | 'digital' | 'otro'>('movil');
  const [mgrTargetAccountId, setMgrTargetAccountId] = useState('');

  // Helper to parse associated methods from account notes
  const parseAccountPaymentMethods = (account: BankAccount): AssociatedMethod[] => {
    if (!account.notes) return [];
    try {
      const parsed = JSON.parse(account.notes);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
    return [];
  };

  // Load All Data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [accs, trans, pms] = await Promise.all([
        dbService.getBankAccounts(),
        dbService.getBankTransfers(),
        dbService.getPaymentMethods()
      ]);

      let currentAccs = accs;

      // Seed initial accounts if empty to match screenshots
      if (accs.length === 0) {
        const seedAccounts: BankAccount[] = [
          {
            id: 'seed-acc-usd',
            name: 'Cuenta Dólares',
            bank_name: 'Cuenta Dólares',
            currency: 'USD',
            balance: 2857.60,
            is_active: true,
            notes: JSON.stringify([
              { id: 'pm-efectivo-usd', name: 'Efectivo Dólares (USD)', incomingCommission: 0, outgoingCommission: 0, currency: 'USD', type: 'efectivo' },
              { id: 'pm-zelle', name: 'Zelle (USD)', incomingCommission: 0, outgoingCommission: 0, currency: 'USD', type: 'digital' }
            ]),
            created_at: new Date().toISOString()
          },
          {
            id: 'seed-acc-ves',
            name: 'Cuenta Bolívares',
            bank_name: 'Cuenta Bolívares',
            currency: 'VES',
            balance: 78331.44,
            is_active: true,
            notes: JSON.stringify([
              { id: 'pm-efectivo-ves', name: 'Efectivo Bolívares (Bs.)', incomingCommission: 0, outgoingCommission: 0, currency: 'VES', type: 'efectivo' },
              { id: 'pm-transferencia-ves', name: 'Transferencia Bancaria Nacional (Bs.)', incomingCommission: 0, outgoingCommission: 0, currency: 'VES', type: 'transferencia' }
            ]),
            created_at: new Date().toISOString()
          },
          {
            id: 'seed-acc-bnc',
            name: 'BNC',
            bank_name: 'Banco Nacional de Crédito',
            currency: 'VES',
            balance: 5000.00,
            is_active: true,
            notes: JSON.stringify([
              { id: 'pm-pagomovil', name: 'Pago Móvil Interbancario (VES)', incomingCommission: 0, outgoingCommission: 0, currency: 'VES', type: 'movil' },
              { id: 'pm-punto-venta', name: 'Punto de Venta / Tarjeta Débito (POS)', incomingCommission: 0, outgoingCommission: 0, currency: 'VES', type: 'punto' }
            ]),
            created_at: new Date().toISOString()
          }
        ];
        
        for (const sa of seedAccounts) {
          await dbService.saveBankAccount(sa);
        }
        
        currentAccs = await dbService.getBankAccounts();
      }

      setAccounts(currentAccs);
      setTransfers(trans);

      // Reconcile and fix system payment methods with their bank accounts
      let updatedPms = [...pms];
      let pmsChanged = false;

      currentAccs.forEach(acc => {
        const associated = parseAccountPaymentMethods(acc);
        associated.forEach(m => {
          const matchIndex = updatedPms.findIndex(p => p.id === m.id || p.name.toLowerCase() === m.name.toLowerCase());
          if (matchIndex > -1) {
            if (updatedPms[matchIndex].bank_account_id !== acc.id || updatedPms[matchIndex].bank_account_name !== acc.name) {
              updatedPms[matchIndex] = {
                ...updatedPms[matchIndex],
                bank_account_id: acc.id,
                bank_account_name: acc.name,
                incoming_commission: m.incomingCommission,
                outgoing_commission: m.outgoingCommission
              };
              pmsChanged = true;
            }
          }
        });
      });

      if (pmsChanged) {
        localStorage.setItem('copias_bellavista_payment_methods', JSON.stringify(updatedPms));
      }
      setSystemPaymentMethods(updatedPms);

    } catch (err) {
      console.error('Error loading bank accounts data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sync selected account state with accounts array
  useEffect(() => {
    if (selectedAccount) {
      const updated = accounts.find(a => a.id === selectedAccount.id);
      if (updated) {
        setSelectedAccount(updated);
      }
    }
  }, [accounts]);

  // Total balance calculation across all accounts in USD
  const getTotalBalanceUSD = () => {
    return accounts.reduce((total, acc) => {
      if (acc.currency === 'USD') {
        return total + acc.balance;
      } else {
        return total + (acc.balance / (bcvRate || 1));
      }
    }, 0);
  };

  // Notification helper
  const showNotification = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => {
      setToast(current => current?.msg === msg ? null : current);
    }, 4500);
  };

  // Helper to get which account has a payment method fixed/locked
  const getMethodBoundAccount = (pm: PaymentMethodConfig, currentEditingId?: string | null) => {
    // 1. Check direct bank_account_id attribute
    if (pm.bank_account_id) {
      const acc = accounts.find(a => a.id === pm.bank_account_id);
      return {
        isBound: true,
        isCurrentAccount: currentEditingId ? pm.bank_account_id === currentEditingId : false,
        accountName: acc?.name || pm.bank_account_name || 'Cuenta del sistema',
        accountId: pm.bank_account_id
      };
    }

    // 2. Check across accounts notes
    for (const acc of accounts) {
      const pms = parseAccountPaymentMethods(acc);
      const isPresent = pms.some(m => m.id === pm.id || m.name.toLowerCase() === pm.name.toLowerCase());
      if (isPresent) {
        return {
          isBound: true,
          isCurrentAccount: currentEditingId ? acc.id === currentEditingId : false,
          accountName: acc.name,
          accountId: acc.id
        };
      }
    }

    return {
      isBound: false,
      isCurrentAccount: false,
      accountName: null,
      accountId: null
    };
  };

  // --------------------------------------------------------------------------
  // ACCOUNT CRUD OPERATIONS
  // --------------------------------------------------------------------------

  const resetAccountForm = () => {
    setEditingAccountId(null);
    setAccountName('');
    setBankName('');
    setAccountCurrency('VES');
    setInitialBalance('');
    setAccountPaymentMethods([]);
    setSelectedSystemMethodId('');
    setSelectedIncomingCommission('0');
    setSelectedOutgoingCommission('0');
    setShowCreateNewMethodForm(false);
    setNewCustomMethodName('');
    setNewCustomMethodIncoming('0');
    setNewCustomMethodOutgoing('0');
    setShowNewAccountModal(false);
  };

  const handleOpenNewAccount = () => {
    resetAccountForm();
    setShowNewAccountModal(true);
  };

  const handleOpenEditAccount = (acc: BankAccount) => {
    setEditingAccountId(acc.id);
    setAccountName(acc.name);
    setBankName(acc.bank_name);
    setAccountCurrency(acc.currency as 'USD' | 'VES');
    setInitialBalance(String(acc.balance));
    setAccountPaymentMethods(parseAccountPaymentMethods(acc));
    setSelectedSystemMethodId('');
    setSelectedIncomingCommission('0');
    setSelectedOutgoingCommission('0');
    setShowCreateNewMethodForm(false);
    setShowNewAccountModal(true);
  };

  // Add existing system payment method to the account form
  const handleAssociateSystemMethod = () => {
    if (!selectedSystemMethodId) {
      showNotification('Seleccione un método de pago del sistema para asociar.', 'error');
      return;
    }

    const sysMethod = systemPaymentMethods.find(m => m.id === selectedSystemMethodId);
    if (!sysMethod) return;

    // Verify if already fixed to another account
    const boundInfo = getMethodBoundAccount(sysMethod, editingAccountId);
    if (boundInfo.isBound && !boundInfo.isCurrentAccount) {
      showNotification(`El método "${sysMethod.name}" ya está fijado exclusivamente a la cuenta "${boundInfo.accountName}". Para asociarlo aquí, primero desvinculélo de esa cuenta.`, 'error');
      return;
    }

    // Verify if already added in current form list
    const alreadyAdded = accountPaymentMethods.some(m => m.id === sysMethod.id || m.name.toLowerCase() === sysMethod.name.toLowerCase());
    if (alreadyAdded) {
      showNotification('Este método de pago ya está en la lista de esta cuenta.', 'error');
      return;
    }

    const newAssociated: AssociatedMethod = {
      id: sysMethod.id,
      code: sysMethod.code,
      name: sysMethod.name,
      currency: sysMethod.currency,
      type: sysMethod.type,
      incomingCommission: parseFloat(selectedIncomingCommission) || 0,
      outgoingCommission: parseFloat(selectedOutgoingCommission) || 0
    };

    setAccountPaymentMethods([...accountPaymentMethods, newAssociated]);
    setSelectedSystemMethodId('');
    setSelectedIncomingCommission('0');
    setSelectedOutgoingCommission('0');
  };

  // Create a brand new method on the fly and associate it to this account
  const handleCreateAndAssociateNewMethod = async () => {
    if (!newCustomMethodName.trim()) {
      showNotification('Ingrese el nombre del nuevo método de pago.', 'error');
      return;
    }

    const newId = `pm-${Date.now()}`;
    const newPm: PaymentMethodConfig = {
      id: newId,
      code: newCustomMethodName.toUpperCase().replace(/[^A-Z0-9]/g, '_'),
      name: newCustomMethodName.trim(),
      currency: newCustomMethodCurrency,
      type: newCustomMethodType,
      is_active: true,
      requires_reference: true,
      allow_pos: true,
      allow_online: true,
      bank_account_name: accountName || 'Esta cuenta',
      incoming_commission: parseFloat(newCustomMethodIncoming) || 0,
      outgoing_commission: parseFloat(newCustomMethodOutgoing) || 0,
      sort_order: systemPaymentMethods.length + 1
    };

    try {
      await dbService.savePaymentMethod(newPm);
      const updatedSystem = [...systemPaymentMethods, newPm];
      setSystemPaymentMethods(updatedSystem);

      const newAssociated: AssociatedMethod = {
        id: newId,
        code: newPm.code,
        name: newPm.name,
        currency: newPm.currency,
        type: newPm.type,
        incomingCommission: parseFloat(newCustomMethodIncoming) || 0,
        outgoingCommission: parseFloat(newCustomMethodOutgoing) || 0
      };

      setAccountPaymentMethods([...accountPaymentMethods, newAssociated]);
      setNewCustomMethodName('');
      setNewCustomMethodIncoming('0');
      setNewCustomMethodOutgoing('0');
      setShowCreateNewMethodForm(false);
    } catch (err) {
      console.error('Error creating new payment method:', err);
      showNotification('Error al registrar el método de pago en el sistema.', 'error');
    }
  };

  // Remove / unbind method from current account form
  const handleUnbindMethodFromForm = (index: number) => {
    const updated = [...accountPaymentMethods];
    updated.splice(index, 1);
    setAccountPaymentMethods(updated);
  };

  // Save Account (Create or Edit) and Lock/Fix all associated payment methods to this account
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim() || !bankName.trim()) {
      showNotification('Por favor complete los campos obligatorios.', 'error');
      return;
    }

    try {
      const serializedMethods = JSON.stringify(accountPaymentMethods);
      const accountId = editingAccountId || `acc-${Date.now()}`;

      const accToSave: BankAccount = {
        id: accountId,
        name: accountName.trim(),
        bank_name: bankName.trim(),
        currency: accountCurrency,
        balance: parseFloat(initialBalance) || 0,
        is_active: true,
        notes: serializedMethods,
        account_type: 'corriente'
      };

      const saved = await dbService.saveBankAccount(accToSave);
      const targetId = saved.id || accountId;

      // Update and Fix all payment methods in the system for this account
      let allSystemPms = await dbService.getPaymentMethods();
      const updatedSystemPms = allSystemPms.map(pm => {
        // Is this method currently associated with this account?
        const isAssociated = accountPaymentMethods.some(m => m.id === pm.id || m.name.toLowerCase() === pm.name.toLowerCase());
        
        if (isAssociated) {
          const assocData = accountPaymentMethods.find(m => m.id === pm.id || m.name.toLowerCase() === pm.name.toLowerCase());
          return {
            ...pm,
            bank_account_id: targetId,
            bank_account_name: saved.name,
            incoming_commission: assocData?.incomingCommission ?? 0,
            outgoing_commission: assocData?.outgoingCommission ?? 0
          };
        } else if (pm.bank_account_id === targetId) {
          // It was previously bound to this account, but removed: free it
          return {
            ...pm,
            bank_account_id: undefined,
            bank_account_name: undefined
          };
        }
        return pm;
      });

      localStorage.setItem('copias_bellavista_payment_methods', JSON.stringify(updatedSystemPms));
      setSystemPaymentMethods(updatedSystemPms);

      // Save updated methods to DB
      for (const pm of updatedSystemPms) {
        if (pm.bank_account_id === targetId || (!pm.bank_account_id && allSystemPms.find(x => x.id === pm.id)?.bank_account_id === targetId)) {
          await dbService.savePaymentMethod(pm);
        }
      }

      // If initial balance > 0 on new account, record initial deposit
      if (!editingAccountId && parseFloat(initialBalance) > 0) {
        const initialTransfer: BankTransfer = {
          to_account_id: targetId,
          to_account_name: saved.name,
          amount: parseFloat(initialBalance),
          currency: accountCurrency,
          notes: 'Saldo inicial de apertura de la cuenta bancaria',
          reference: 'APERTURA',
          created_by: currentUser?.name || 'Administrador'
        };
        await dbService.transferBetweenAccounts(initialTransfer);
      }

      window.dispatchEvent(new CustomEvent('bellavista_payment_methods_updated'));
      showNotification(editingAccountId ? 'Cuenta bancaria actualizada y métodos fijados correctamente.' : 'Cuenta bancaria creada y métodos de pago fijados con éxito.');
      resetAccountForm();
      loadData();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error(err);
      showNotification('Error al guardar la cuenta bancaria.', 'error');
    }
  };

  const handleDeleteAccount = async (id: string) => {
    const acc = accounts.find(a => a.id === id);
    if (!acc) return;
    setAccountToDelete(acc);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDeleteAccount = async () => {
    if (!accountToDelete) return;
    const id = accountToDelete.id;
    try {
      // Free all methods associated to this account
      const updatedSystem = systemPaymentMethods.map(pm => {
        if (pm.bank_account_id === id) {
          return { ...pm, bank_account_id: undefined, bank_account_name: undefined };
        }
        return pm;
      });
      localStorage.setItem('copias_bellavista_payment_methods', JSON.stringify(updatedSystem));
      setSystemPaymentMethods(updatedSystem);

      await dbService.deleteBankAccount(id);
      window.dispatchEvent(new CustomEvent('bellavista_payment_methods_updated'));
      showNotification('Cuenta bancaria eliminada y métodos liberados.');
      setSelectedAccount(null);
      setShowDeleteConfirm(false);
      setAccountToDelete(null);
      loadData();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error(err);
      showNotification('Error al eliminar la cuenta.', 'error');
    }
  };

  // --------------------------------------------------------------------------
  // FINANCIAL OPERATIONS (TRANSFERS, DEPOSITS, WITHDRAWALS)
  // --------------------------------------------------------------------------

  // Transfer with custom division rule
  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferFromId || !transferToId || !transferAmount) {
      showNotification('Por favor ingrese todos los campos obligatorios.', 'error');
      return;
    }
    if (transferFromId === transferToId) {
      showNotification('La cuenta de origen y destino no pueden ser la misma.', 'error');
      return;
    }

    const fromAcc = accounts.find(a => a.id === transferFromId);
    const toAcc = accounts.find(a => a.id === transferToId);
    if (!fromAcc || !toAcc) return;

    const amt = parseFloat(transferAmount);
    if (isNaN(amt) || amt <= 0) {
      showNotification('Monto inválido.', 'error');
      return;
    }

    const commVal = parseFloat(transferCommission) || 0;
    let debitFromSource = amt;
    let commAmt = 0;
    if (commVal > 0) {
      if (transferCommissionType === 'fixed') {
        commAmt = commVal;
      } else {
        commAmt = amt * (commVal / 100);
      }
      debitFromSource = amt + commAmt;
    }

    if (fromAcc.balance < debitFromSource) {
      showNotification(`Saldo insuficiente incluyendo comisión. Disponible: ${fromAcc.currency === 'USD' ? '$' : ''}${fromAcc.balance.toFixed(2)} ${fromAcc.currency !== 'USD' ? 'Bs.' : ''}`, 'error');
      return;
    }

    try {
      const rate = parseFloat(customExchangeRate) || bcvRate;
      let convertedAmount = amt;

      // SPECIFIC CONVERSION RULE REQUESTED BY USER:
      if (fromAcc.currency === 'USD' && toAcc.currency === 'VES') {
        convertedAmount = amt * rate; // Multiplicado por la tasa oficial
      } else if (fromAcc.currency === 'VES' && toAcc.currency === 'USD') {
        convertedAmount = amt / rate; // Dividido por la tasa oficial
      }

      const transferObj: BankTransfer = {
        from_account_id: transferFromId,
        from_account_name: fromAcc.name,
        to_account_id: transferToId,
        to_account_name: toAcc.name,
        amount: debitFromSource,
        currency: fromAcc.currency,
        exchange_rate: rate,
        converted_amount: convertedAmount,
        reference: transferReference,
        notes: transferNotes || `Transferencia (Monto: ${amt.toFixed(2)} + Comisión: ${commAmt.toFixed(2)})`,
        created_by: currentUser?.name || 'Administrador'
      };

      await dbService.transferBetweenAccounts(transferObj);
      showNotification('Transferencia ejecutada con éxito.');
      setShowTransferModal(false);
      resetTransferForm();
      loadData();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error(err);
      showNotification('Error al ejecutar la transferencia.', 'error');
    }
  };

  const resetTransferForm = () => {
    setTransferFromId('');
    setTransferToId('');
    setTransferAmount('');
    setTransferCommission('0');
    setTransferCommissionType('fixed');
    setTransferReference('');
    setTransferNotes('');
    setCustomExchangeRate(String(bcvRate));
  };

  // Deposit
  const handleExecuteDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionAccountId || !transactionAmount) {
      showNotification('Por favor ingrese todos los campos obligatorios.', 'error');
      return;
    }

    const acc = accounts.find(a => a.id === transactionAccountId);
    if (!acc) return;

    const amt = parseFloat(transactionAmount);
    if (isNaN(amt) || amt <= 0) {
      showNotification('Monto inválido.', 'error');
      return;
    }

    try {
      const depositObj: BankTransfer = {
        to_account_id: transactionAccountId,
        to_account_name: acc.name,
        amount: amt,
        converted_amount: amt,
        currency: acc.currency,
        reference: transactionReference,
        notes: transactionNotes || 'Ingreso manual de saldo',
        created_by: currentUser?.name || 'Administrador'
      };

      await dbService.transferBetweenAccounts(depositObj);
      showNotification('Saldo ingresado exitosamente.');
      setShowDepositModal(false);
      resetTransactionForm();
      loadData();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error(err);
      showNotification('Error al ingresar el saldo.', 'error');
    }
  };

  // Withdrawal
  const handleExecuteWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionAccountId || !transactionAmount) {
      showNotification('Por favor ingrese todos los campos obligatorios.', 'error');
      return;
    }

    const acc = accounts.find(a => a.id === transactionAccountId);
    if (!acc) return;

    const amt = parseFloat(transactionAmount);
    if (isNaN(amt) || amt <= 0) {
      showNotification('Monto inválido.', 'error');
      return;
    }

    if (acc.balance < amt) {
      showNotification('Saldo insuficiente en la cuenta para realizar el retiro.', 'error');
      return;
    }

    try {
      const withdrawObj: BankTransfer = {
        from_account_id: transactionAccountId,
        from_account_name: acc.name,
        amount: amt,
        currency: acc.currency,
        reference: transactionReference,
        notes: transactionNotes || 'Retiro manual de saldo',
        created_by: currentUser?.name || 'Administrador'
      };

      await dbService.transferBetweenAccounts(withdrawObj);
      showNotification('Retiro realizado exitosamente.');
      setShowWithdrawModal(false);
      resetTransactionForm();
      loadData();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error(err);
      showNotification('Error al efectuar el retiro.', 'error');
    }
  };

  const resetTransactionForm = () => {
    setTransactionAccountId('');
    setTransactionAmount('');
    setTransactionReference('');
    setTransactionNotes('');
  };

  // Create payment method from the global manager modal
  const handleCreateManagerPaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mgrNewName.trim()) return;

    const newId = `pm-${Date.now()}`;
    const targetAcc = accounts.find(a => a.id === mgrTargetAccountId);

    const newPm: PaymentMethodConfig = {
      id: newId,
      code: mgrNewName.toUpperCase().replace(/[^A-Z0-9]/g, '_'),
      name: mgrNewName.trim(),
      currency: mgrNewCurrency,
      type: mgrNewType,
      is_active: true,
      requires_reference: true,
      allow_pos: true,
      allow_online: true,
      bank_account_id: targetAcc?.id || undefined,
      bank_account_name: targetAcc?.name || undefined,
      incoming_commission: 0,
      outgoing_commission: 0,
      sort_order: systemPaymentMethods.length + 1
    };

    try {
      await dbService.savePaymentMethod(newPm);
      
      // If an account was assigned, also update that account's notes
      if (targetAcc) {
        const existingMethods = parseAccountPaymentMethods(targetAcc);
        const updated = [
          ...existingMethods,
          {
            id: newId,
            code: newPm.code,
            name: newPm.name,
            currency: newPm.currency,
            type: newPm.type,
            incomingCommission: 0,
            outgoingCommission: 0
          }
        ];
        await dbService.saveBankAccount({
          ...targetAcc,
          notes: JSON.stringify(updated)
        });
      }

      showNotification('Método de pago registrado exitosamente.');
      setMgrNewName('');
      setMgrTargetAccountId('');
      loadData();
    } catch (err) {
      console.error(err);
      showNotification('Error al crear el método de pago.', 'error');
    }
  };

  // Helper to filter movements
  const getFilteredAccountMovements = (accId: string) => {
    return transfers.filter(t => {
      const isMatch = t.from_account_id === accId || t.to_account_id === accId;
      if (!isMatch) return false;

      if (t.created_at) {
        const tDate = t.created_at.split('T')[0];
        return tDate >= startDate && tDate <= endDate;
      }
      return true;
    });
  };

  // Helper to calculate exact display amount for a specific account
  const calculateMovementDisplayAmount = (t: BankTransfer, acc: BankAccount) => {
    const isIncoming = t.to_account_id === acc.id;
    const isInterbank = !!(t.from_account_id && t.to_account_id && t.from_account_id !== t.to_account_id);
    const isAccountVES = acc.currency === 'VES';
    const rate = Number(t.exchange_rate) || bcvRate || 1;

    if (isInterbank) {
      if (isIncoming) {
        if (isAccountVES) {
          return t.converted_amount || (t.currency === 'USD' ? t.amount * rate : t.amount);
        } else {
          return t.converted_amount || (t.currency === 'VES' ? t.amount / rate : t.amount);
        }
      } else {
        return t.amount;
      }
    }

    // Direct single account movement (Cobro CxC, Pago CxP, Pago Gasto, Deposito, Retiro, POS)
    if (isAccountVES) {
      // If amount was small (< 50) and rate is high (> 50), it was entered in USD and must be in Bs
      if (rate > 50 && Number(t.amount) > 0 && Number(t.amount) < 50) {
        return Number(t.amount) * rate;
      }
      if (t.currency === 'USD') {
        return Number(t.amount) * rate;
      }
      if (t.converted_amount && Number(t.converted_amount) > Number(t.amount) && Number(t.amount) < 50) {
        return Number(t.converted_amount);
      }
      return Number(t.amount) || Number(t.converted_amount) || 0;
    } else {
      // USD Account
      if (t.currency === 'VES' && rate > 0) {
        return (Number(t.amount) || 0) / rate;
      }
      if (rate > 50 && Number(t.amount) > 500) {
        return Number(t.amount) / rate;
      }
      return Number(t.amount) || Number(t.converted_amount) || 0;
    }
  };

  // Transfer simulation
  const getTransferSimulationValues = () => {
    const fromAcc = accounts.find(a => a.id === transferFromId);
    const toAcc = accounts.find(a => a.id === transferToId);
    const amt = parseFloat(transferAmount) || 0;
    const rate = parseFloat(customExchangeRate) || bcvRate;

    if (!fromAcc || !toAcc || amt <= 0) return null;

    let debited = amt;
    let credited = amt;

    if (fromAcc.currency === 'USD' && toAcc.currency === 'VES') {
      credited = amt * rate;
    } else if (fromAcc.currency === 'VES' && toAcc.currency === 'USD') {
      credited = amt / rate;
    }

    const commVal = parseFloat(transferCommission) || 0;
    let commSource = 0;
    if (commVal > 0) {
      if (transferCommissionType === 'fixed') {
        commSource = commVal;
      } else {
        commSource = amt * (commVal / 100);
      }
    }

    return {
      debitAmount: debited + commSource,
      creditAmount: credited,
      commissionAmount: commSource,
      fromCurrency: fromAcc.currency,
      toCurrency: toAcc.currency
    };
  };

  const simulation = getTransferSimulationValues();

  // Helper for Payment Method Icons
  const renderMethodIcon = (type?: string) => {
    switch (type) {
      case 'movil': return <Smartphone className="w-3.5 h-3.5 text-violet-600" />;
      case 'efectivo': return <Banknote className="w-3.5 h-3.5 text-emerald-600" />;
      case 'transferencia': return <Landmark className="w-3.5 h-3.5 text-blue-600" />;
      case 'punto': return <CreditCard className="w-3.5 h-3.5 text-amber-600" />;
      default: return <Coins className="w-3.5 h-3.5 text-gray-500" />;
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      
      {/* ==========================================
          HEADER PANEL DE CONTROL 
          ========================================== */}
      {!selectedAccount ? (
        <div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <Coins className="w-6 h-6 text-violet-700" />
                <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">CUENTAS BANCARIAS</h1>
              </div>
              <p className="text-gray-500 text-xs mt-1">
                Gestión de cuentas bancarias y métodos de cobro fijados exclusivamente a cada cuenta.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={handleOpenNewAccount}
                className="px-4 py-2 bg-[#005da9] text-white font-extrabold text-xs rounded-xl hover:bg-opacity-95 shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Nueva cuenta</span>
              </button>
              <button 
                onClick={() => setShowPaymentMethodsModal(true)}
                className="px-4 py-2 bg-violet-700 text-white font-extrabold text-xs rounded-xl hover:bg-violet-800 shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>Métodos de pago del sistema</span>
              </button>
            </div>
          </div>

          {/* ==========================================
              BARRA DE ACCIONES FINANCIERAS
              ========================================== */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white p-4 rounded-xl border border-gray-100 shadow-xs">
            <div className="flex flex-wrap items-center gap-3">
              <button 
                onClick={() => {
                  resetTransferForm();
                  setShowTransferModal(true);
                }}
                className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-black text-xs rounded-xl transition flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>Transferir entre cuentas</span>
              </button>
              
              <button 
                onClick={() => {
                  resetTransactionForm();
                  setShowWithdrawModal(true);
                }}
                className="px-4 py-2 bg-white hover:bg-gray-50 text-violet-700 border border-violet-200 font-extrabold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer shadow-2xs"
              >
                <Minus className="w-4 h-4" />
                <span>- Retirar Saldo</span>
              </button>

              <button 
                onClick={() => {
                  resetTransactionForm();
                  setShowDepositModal(true);
                }}
                className="px-4 py-2 bg-white hover:bg-gray-50 text-violet-700 border border-violet-200 font-extrabold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer shadow-2xs"
              >
                <Plus className="w-4 h-4" />
                <span>+ Ingresar saldo</span>
              </button>
            </div>

            <div className="bg-violet-50 text-violet-800 px-4 py-2 rounded-xl font-bold text-xs border border-violet-100 shadow-2xs flex items-center gap-2">
              <span>Total consolidado:</span>
              <strong className="text-sm font-black text-violet-900">
                ${getTotalBalanceUSD().toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>
          </div>

          {/* ==========================================
              LISTADO DE TARJETAS DE CUENTAS BANCARIAS
              ========================================== */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {accounts.map(acc => {
              const pms = parseAccountPaymentMethods(acc);
              const equivalentUSD = acc.currency === 'VES' ? (acc.balance / (bcvRate || 1)) : acc.balance;
              
              return (
                <div 
                  key={acc.id}
                  onClick={() => setSelectedAccount(acc)}
                  className="bg-white rounded-2xl border border-gray-200 shadow-xs hover:shadow-md transition p-5 flex flex-col justify-between cursor-pointer group hover:border-[#005da9]"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center">
                          <Landmark className="w-4 h-4 text-violet-700" />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-gray-800 text-sm group-hover:text-[#005da9]">{acc.name}</h3>
                          <p className="text-[10px] text-gray-400 font-medium">{acc.bank_name}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${acc.currency === 'USD' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                        {acc.currency}
                      </span>
                    </div>

                    <div className="my-4">
                      {acc.currency === 'USD' ? (
                        <p className="text-2xl font-black text-gray-900">
                          ${acc.balance.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      ) : (
                        <div>
                          <p className="text-2xl font-black text-gray-900">
                            Bs. {acc.balance.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs font-bold text-gray-400 mt-0.5">
                            Ref: ${equivalentUSD.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* MÉTODOS DE COBRO FIJADOS A ESTA CUENTA */}
                    <div className="border-t border-gray-100 pt-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1">
                          <Lock className="w-3 h-3 text-violet-600" />
                          Métodos fijados ({pms.length})
                        </span>
                      </div>
                      
                      {pms.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {pms.map((pm, i) => (
                            <span 
                              key={i}
                              className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-violet-50 text-violet-800 px-2 py-0.5 rounded-md border border-violet-100"
                            >
                              {renderMethodIcon(pm.type)}
                              <span>{pm.name}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-amber-600 font-semibold italic flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Sin métodos fijados
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-violet-700 group-hover:underline flex items-center gap-1">
                      Ver movimientos
                      <ExternalLink className="w-3 h-3" />
                    </span>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditAccount(acc);
                      }}
                      className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition"
                      title="Editar cuenta y métodos asociados"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ==========================================
            VISTA DETALLE DE CUENTA BANCARIA
            ========================================== */
        <div>
          {/* Top Bar navigation */}
          <div className="flex items-center justify-between mb-6">
            <button 
              onClick={() => setSelectedAccount(null)}
              className="flex items-center gap-2 text-xs font-black text-gray-600 hover:text-gray-900 bg-white px-3.5 py-2 rounded-xl border border-gray-200 shadow-2xs hover:bg-gray-50 transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a cuentas</span>
            </button>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleOpenEditAccount(selectedAccount)}
                className="px-3.5 py-2 bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 text-xs font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                <span>Editar cuenta y métodos</span>
              </button>
              <button 
                onClick={() => handleDeleteAccount(selectedAccount.id)}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar cuenta</span>
              </button>
            </div>
          </div>

          {/* Account Detail Header */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center">
                <Landmark className="w-7 h-7 text-violet-700" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black text-gray-900">{selectedAccount.name}</h1>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${selectedAccount.currency === 'USD' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                    {selectedAccount.currency}
                  </span>
                </div>
                <p className="text-xs font-semibold text-gray-500 mt-0.5">{selectedAccount.bank_name}</p>
                
                {/* Methods locked to this account */}
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] font-black text-gray-400 uppercase">Métodos fijados:</span>
                  <div className="flex flex-wrap gap-1">
                    {parseAccountPaymentMethods(selectedAccount).map((m, i) => (
                      <span key={i} className="text-[10px] font-extrabold bg-violet-50 text-violet-800 px-2 py-0.5 rounded border border-violet-100 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" />
                        {m.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="text-right border-t md:border-t-0 md:border-l border-gray-150 pt-4 md:pt-0 md:pl-8">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1">Saldo Actual</span>
              {selectedAccount.currency === 'USD' ? (
                <p className="text-3xl font-black text-gray-900">
                  ${selectedAccount.balance.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              ) : (
                <div>
                  <p className="text-3xl font-black text-gray-900">
                    Bs. {selectedAccount.balance.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs font-bold text-gray-400 mt-1">
                    Equivalente: ${(selectedAccount.balance / (bcvRate || 1)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Movements Filters */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-black text-gray-500">Desde:</label>
                <input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 bg-gray-50"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-black text-gray-500">Hasta:</label>
                <input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 bg-gray-50"
                />
              </div>
            </div>

            <button 
              onClick={() => window.print()}
              className="px-4 py-2 bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 text-xs font-black rounded-xl transition flex items-center gap-2 cursor-pointer shadow-3xs"
            >
              <Download className="w-4 h-4 text-gray-500" />
              <span>Exportar PDF</span>
            </button>
          </div>

          {/* Table of Movements */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Cuenta</th>
                  <th className="py-3.5 px-4">Fecha</th>
                  <th className="py-3.5 px-4">Usuario</th>
                  <th className="py-3.5 px-4">Tipo</th>
                  <th className="py-3.5 px-4">Detalle / Referencia</th>
                  <th className="py-3.5 px-4">Tasa</th>
                  <th className="py-3.5 px-4">Comisión</th>
                  <th className="py-3.5 px-4 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {getFilteredAccountMovements(selectedAccount.id).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400 font-bold">
                      No hay movimientos registrados en el período seleccionado para esta cuenta.
                    </td>
                  </tr>
                ) : (
                  getFilteredAccountMovements(selectedAccount.id).map((t, idx) => {
                    const isIncoming = t.to_account_id === selectedAccount.id;
                    const amountVal = calculateMovementDisplayAmount(t, selectedAccount);

                    return (
                      <tr key={t.id || idx} className="hover:bg-gray-50/50 transition">
                        <td className="py-3 px-4 font-extrabold text-gray-700">{selectedAccount.name}</td>
                        <td className="py-3 px-4 text-gray-500 font-semibold">
                          {t.created_at ? new Date(t.created_at).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Reciente'}
                        </td>
                        <td className="py-3 px-4 text-gray-600 font-bold">{t.created_by || 'Cajero'}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-wider ${isIncoming ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                            {isIncoming ? 'Entrada' : 'Salida'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600 max-w-xs truncate font-medium">{t.notes} {t.reference ? `(Ref: ${t.reference})` : ''}</td>
                        <td className="py-3 px-4 text-gray-500 font-bold">{t.exchange_rate ? `${t.exchange_rate.toFixed(2)} Bs/$` : '-'}</td>
                        <td className="py-3 px-4 text-gray-500 font-semibold">Bs 0.00</td>
                        <td className={`py-3 px-4 text-right font-black ${isIncoming ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {isIncoming ? '+' : '-'}{amountVal.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedAccount.currency}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: NUEVA / EDITAR CUENTA BANCARIA CON ASOCIACIÓN DE MÉTODOS DEL SISTEMA
          ========================================================================= */}
      {showNewAccountModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl border border-gray-100 overflow-hidden my-8 animate-fadeIn">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-150 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-[#005da9]" />
                <h3 className="font-extrabold text-gray-800 text-sm">
                  {editingAccountId ? 'Editar cuenta bancaria' : 'Nueva cuenta bancaria'}
                </h3>
              </div>
              <button onClick={resetAccountForm} className="p-1 hover:bg-gray-200 rounded-lg transition cursor-pointer">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Nombre de la cuenta bancaria *</label>
                <div className="relative">
                  <input 
                    type="text"
                    required
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Ej: Banesco, Mercantil, Cuenta Dólares, BNC"
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#005da9] text-xs font-semibold"
                  />
                  {accountName && <Check className="absolute right-3 top-2.5 w-4 h-4 text-emerald-500" />}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Banco / Proveedor Financiero *</label>
                <input 
                  type="text"
                  required
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Ej: Banesco Banco Universal, BNC, Zelle, Mercantil"
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#005da9] text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Moneda de la cuenta *</label>
                  <select 
                    value={accountCurrency}
                    onChange={(e) => setAccountCurrency(e.target.value as 'USD' | 'VES')}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#005da9] text-xs font-semibold"
                  >
                    <option value="VES">Bolívar venezolano (VES)</option>
                    <option value="USD">Dólar estadounidense (USD)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Saldo inicial *</label>
                  <div className="relative">
                    <input 
                      type="number"
                      step="any"
                      required
                      value={initialBalance}
                      disabled={!!editingAccountId}
                      onChange={(e) => setInitialBalance(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-3 pr-10 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#005da9] text-xs font-bold"
                    />
                    <span className="absolute right-3 top-2.5 text-[10px] font-black text-gray-400">{accountCurrency}</span>
                  </div>
                </div>
              </div>

              {/* ==========================================================
                  SECCIÓN: ASOCIACIÓN DE MÉTODOS DE PAGO DEL SISTEMA
                  ========================================================== */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-violet-700" />
                    <label className="block text-[11px] font-black text-gray-800 uppercase">
                      Crear y Asociar Nuevo Método de Pago
                    </label>
                  </div>
                </div>
                
                <p className="text-[10px] text-gray-500 mb-3 leading-relaxed">
                  Cree los métodos de cobro que pertenezcan a esta cuenta bancaria. Los métodos creados aquí quedarán fijados de forma exclusiva para esta cuenta.
                </p>

                {/* FORMULARIO INLINE PARA CREAR NUEVO MÉTODO SI NO EXISTE EN EL SISTEMA */}
                <div className="bg-gray-100 rounded-xl border border-gray-300 p-3.5 space-y-2.5 mb-3">
                  <p className="text-[10px] font-black text-gray-700 uppercase">Especificaciones del nuevo método a vincular:</p>
                  
                  <div>
                    <input 
                      type="text"
                      value={newCustomMethodName}
                      onChange={(e) => setNewCustomMethodName(e.target.value)}
                      placeholder="Ej: Pago móvil Mercantil, Transferencia BNC..."
                      className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#005da9]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-black text-gray-600 uppercase mb-0.5">Moneda</label>
                        <select 
                          value={newCustomMethodCurrency}
                          onChange={(e) => setNewCustomMethodCurrency(e.target.value as 'USD' | 'VES')}
                          className="w-full px-2 py-1 bg-white border border-gray-200 rounded-md text-xs font-semibold"
                        >
                          <option value="VES">Bolívares (VES)</option>
                          <option value="USD">Dólares (USD)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-black text-gray-600 uppercase mb-0.5">Tipo</label>
                        <select 
                          value={newCustomMethodType}
                          onChange={(e) => setNewCustomMethodType(e.target.value as any)}
                          className="w-full px-2 py-1 bg-white border border-gray-200 rounded-md text-xs font-semibold"
                        >
                          <option value="movil">Pago Móvil</option>
                          <option value="transferencia">Transferencia</option>
                          <option value="punto">Punto de Venta</option>
                          <option value="efectivo">Efectivo</option>
                          <option value="digital">Digital (Zelle / Binance)</option>
                          <option value="otro">Otro</option>
                        </select>
                      </div>
                    </div>

                    <button 
                      type="button"
                      onClick={handleCreateAndAssociateNewMethod}
                      className="w-full py-1.5 bg-[#005da9] text-white font-black text-xs rounded-lg hover:bg-opacity-90 transition cursor-pointer"
                    >
                      Guardar y fijar a esta cuenta
                    </button>
                  </div>

                {/* LISTADO DE MÉTODOS ASOCIADOS Y FIJADOS A ESTA CUENTA */}
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {accountPaymentMethods.length === 0 ? (
                    <div className="p-3 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
                      <p className="text-[11px] text-gray-500 font-medium">
                        No hay métodos de pago fijados a esta cuenta aún.
                      </p>
                    </div>
                  ) : (
                    accountPaymentMethods.map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white rounded-lg p-2.5 border border-violet-150 shadow-3xs">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-violet-100 flex items-center justify-center">
                            {renderMethodIcon(m.type)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-black text-gray-800">{m.name}</p>
                              <span className="text-[9px] font-black text-violet-700 bg-violet-50 px-1.5 py-0.2 rounded border border-violet-200 flex items-center gap-0.5">
                                <Lock className="w-2 h-2" />
                                Fijado
                              </span>
                            </div>
                            <p className="text-[9px] text-gray-400 font-semibold">
                              {m.currency || 'VES'} • Comisiones: Ing: {m.incomingCommission}% | Egr: {m.outgoingCommission}%
                            </p>
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={() => handleUnbindMethodFromForm(idx)}
                          className="p-1 hover:bg-rose-50 text-rose-600 rounded-md transition"
                          title="Desvincular y liberar método"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-150 flex items-center justify-end gap-3">
                <button 
                  type="button" 
                  onClick={resetAccountForm}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-600 text-xs font-extrabold rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-[#005da9] text-white text-xs font-black rounded-xl hover:bg-opacity-95 shadow-sm cursor-pointer"
                >
                  {editingAccountId ? 'Guardar Cambios' : 'Confirmar ingreso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: TRANSFERENCIA ENTRE CUENTAS
          ========================================== */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-150 flex items-center justify-between">
              <h3 className="font-extrabold text-gray-800 text-sm">Transferencia entre cuentas</h3>
              <button onClick={() => setShowTransferModal(false)} className="p-1 hover:bg-gray-200 rounded-lg transition cursor-pointer">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Cuenta de origen *</label>
                <select 
                  required
                  value={transferFromId}
                  onChange={(e) => setTransferFromId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-violet-500 text-xs font-semibold"
                >
                  <option value="">Seleccione...</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency} - Disp: {acc.balance.toFixed(2)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Cuenta de destino *</label>
                <select 
                  required
                  value={transferToId}
                  onChange={(e) => setTransferToId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-violet-500 text-xs font-semibold"
                >
                  <option value="">Seleccione...</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Monto a transferir *</label>
                <input 
                  type="number"
                  step="any"
                  required
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-violet-500 text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Tasa de Cambio Oficial *</label>
                  <input 
                    type="number"
                    step="any"
                    required
                    value={customExchangeRate}
                    onChange={(e) => setCustomExchangeRate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-violet-500 text-xs font-bold text-gray-700 bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Comisión de origen</label>
                  <input 
                    type="number"
                    step="any"
                    value={transferCommission}
                    onChange={(e) => setTransferCommission(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-violet-500 text-xs font-bold text-gray-700"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black text-gray-600 uppercase">Tipo de comisión:</span>
                <label className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700 cursor-pointer">
                  <input 
                    type="radio"
                    name="commType"
                    checked={transferCommissionType === 'fixed'}
                    onChange={() => setTransferCommissionType('fixed')}
                    className="text-violet-600 focus:ring-violet-500"
                  />
                  <span>Fija</span>
                </label>
                <label className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700 cursor-pointer">
                  <input 
                    type="radio"
                    name="commType"
                    checked={transferCommissionType === 'percent'}
                    onChange={() => setTransferCommissionType('percent')}
                    className="text-violet-600 focus:ring-violet-500"
                  />
                  <span>Porcentual (%)</span>
                </label>
              </div>

              {/* SIMULACIÓN DE CONVERSIÓN CON LA REGLA DE DIVISIÓN */}
              {simulation && (
                <div className="bg-violet-50 rounded-xl p-4 border border-violet-100 space-y-1.5 text-xs font-bold text-violet-900 shadow-3xs">
                  <p>Cantidad a debitar en cuenta origen: <strong className="text-violet-950 font-black">{simulation.debitAmount.toFixed(2)} {simulation.fromCurrency}</strong></p>
                  <p>Cantidad a acreditar en cuenta destino: <strong className="text-emerald-700 font-black">{simulation.creditAmount.toFixed(2)} {simulation.toCurrency}</strong></p>
                  {simulation.commissionAmount > 0 && (
                    <p className="text-[10px] text-violet-500">Comisión aplicada: {simulation.commissionAmount.toFixed(2)} {simulation.fromCurrency}</p>
                  )}
                  {simulation.fromCurrency === 'USD' && simulation.toCurrency === 'VES' && (
                    <p className="text-[9px] text-violet-600 italic font-medium mt-1">
                      ℹ️ Tasa aplicada: se multiplicó el monto en dólares por {parseFloat(customExchangeRate) || bcvRate} Bs/$ para acreditar bolívares.
                    </p>
                  )}
                  {simulation.fromCurrency === 'VES' && simulation.toCurrency === 'USD' && (
                    <p className="text-[9px] text-violet-600 italic font-medium mt-1">
                      ℹ️ Tasa aplicada: se dividió el monto en bolívares entre {parseFloat(customExchangeRate) || bcvRate} Bs/$ para acreditar dólares.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Referencia / Comprobante</label>
                <input 
                  type="text"
                  value={transferReference}
                  onChange={(e) => setTransferReference(e.target.value)}
                  placeholder="Ej: Ref 492042"
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-violet-500 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Concepto / Notas</label>
                <textarea 
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="Ingrese una nota descriptiva de la operación"
                  rows={2}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-violet-500 text-xs font-semibold"
                />
              </div>

              <div className="pt-4 border-t border-gray-150 flex items-center justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-600 text-xs font-extrabold rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-black rounded-xl shadow-xs cursor-pointer"
                >
                  Confirmar transferencia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: INGRESAR SALDO (DEPOSITO)
          ========================================== */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-150 flex items-center justify-between">
              <h3 className="font-extrabold text-gray-800 text-sm">Ingresar Saldo</h3>
              <button onClick={() => setShowDepositModal(false)} className="p-1 hover:bg-gray-200 rounded-lg transition cursor-pointer">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleExecuteDeposit} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Cuenta de Destino *</label>
                <select 
                  required
                  value={transactionAccountId}
                  onChange={(e) => setTransactionAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-violet-500 text-xs font-semibold"
                >
                  <option value="">Seleccione...</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Monto a Ingresar *</label>
                <input 
                  type="number"
                  step="any"
                  required
                  value={transactionAmount}
                  onChange={(e) => setTransactionAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-violet-500 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Referencia / Comprobante</label>
                <input 
                  type="text"
                  value={transactionReference}
                  onChange={(e) => setTransactionReference(e.target.value)}
                  placeholder="Ej: Depósito #0294"
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-violet-500 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Concepto / Notas</label>
                <textarea 
                  value={transactionNotes}
                  onChange={(e) => setTransactionNotes(e.target.value)}
                  placeholder="Ej: Aporte de capital, ingresos por ventas externas"
                  rows={2}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-violet-500 text-xs font-semibold"
                />
              </div>

              <div className="pt-4 border-t border-gray-150 flex items-center justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowDepositModal(false)}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-600 text-xs font-extrabold rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-[#005da9] text-white text-xs font-black rounded-xl hover:bg-opacity-95 shadow-sm cursor-pointer"
                >
                  Confirmar ingreso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: RETIRAR SALDO
          ========================================== */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-150 flex items-center justify-between">
              <h3 className="font-extrabold text-gray-800 text-sm">Retirar Saldo</h3>
              <button onClick={() => setShowWithdrawModal(false)} className="p-1 hover:bg-gray-200 rounded-lg transition cursor-pointer">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleExecuteWithdrawal} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Cuenta de Origen *</label>
                <select 
                  required
                  value={transactionAccountId}
                  onChange={(e) => setTransactionAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-violet-500 text-xs font-semibold"
                >
                  <option value="">Seleccione...</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency} - Disp: {acc.balance.toFixed(2)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Monto a Retirar *</label>
                <input 
                  type="number"
                  step="any"
                  required
                  value={transactionAmount}
                  onChange={(e) => setTransactionAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-violet-500 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Referencia / Comprobante</label>
                <input 
                  type="text"
                  value={transactionReference}
                  onChange={(e) => setTransactionReference(e.target.value)}
                  placeholder="Ej: Pago de nómina, gastos operativos"
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-violet-500 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Concepto / Notas</label>
                <textarea 
                  value={transactionNotes}
                  onChange={(e) => setTransactionNotes(e.target.value)}
                  placeholder="Ej: Pago de servicios, retiro personal, etc."
                  rows={2}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-violet-500 text-xs font-semibold"
                />
              </div>

              <div className="pt-4 border-t border-gray-150 flex items-center justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowWithdrawModal(false)}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-600 text-xs font-extrabold rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-rose-600 text-white text-xs font-black rounded-xl hover:bg-rose-700 shadow-sm cursor-pointer"
                >
                  Confirmar retiro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: GESTOR DE MÉTODOS DE PAGO DEL SISTEMA (CONFIGURACIÓN GLOBAL)
          ========================================================================= */}
      {showPaymentMethodsModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-xl border border-gray-100 overflow-hidden my-8 animate-fadeIn">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-150 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-violet-700" />
                <h3 className="font-extrabold text-gray-800 text-sm">Métodos de Pago del Sistema</h3>
              </div>
              <button onClick={() => setShowPaymentMethodsModal(false)} className="p-1 hover:bg-gray-200 rounded-lg transition cursor-pointer">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <p className="text-xs text-gray-600 font-medium">
                Aquí puede ver todos los métodos de cobro registrados en el sistema y a cuál cuenta bancaria están fijados actualmente.
              </p>

              {/* Form to create system level payment method */}
              <form onSubmit={handleCreateManagerPaymentMethod} className="bg-violet-50/70 rounded-xl border border-violet-200 p-4 space-y-3">
                <span className="text-[10px] font-black text-violet-900 uppercase tracking-wider block">Registrar nuevo método de pago:</span>
                
                <div>
                  <label className="block text-[9px] font-black text-gray-700 uppercase mb-1">Nombre del método *</label>
                  <input 
                    type="text"
                    required
                    value={mgrNewName}
                    onChange={(e) => setMgrNewName(e.target.value)}
                    placeholder="Ej: Pago móvil Banesco, Zelle Empresa"
                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-violet-600"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[9px] font-black text-gray-700 uppercase mb-1">Moneda</label>
                    <select 
                      value={mgrNewCurrency}
                      onChange={(e) => setMgrNewCurrency(e.target.value as any)}
                      className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold"
                    >
                      <option value="VES">Bolívares (VES)</option>
                      <option value="USD">Dólares (USD)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-gray-700 uppercase mb-1">Tipo</label>
                    <select 
                      value={mgrNewType}
                      onChange={(e) => setMgrNewType(e.target.value as any)}
                      className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold"
                    >
                      <option value="movil">Pago Móvil</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="punto">Punto de Venta</option>
                      <option value="efectivo">Efectivo</option>
                      <option value="digital">Digital (Zelle/Binance)</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-gray-700 uppercase mb-1">Fijar a cuenta</label>
                    <select 
                      value={mgrTargetAccountId}
                      onChange={(e) => setMgrTargetAccountId(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold"
                    >
                      <option value="">-- Sin fijar aún --</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full py-2 bg-violet-700 text-white font-black text-xs rounded-lg hover:bg-violet-800 transition cursor-pointer shadow-2xs"
                >
                  Registrar método en el sistema
                </button>
              </form>

              {/* List of existing payment methods with their locked accounts */}
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase mb-2">Métodos y Cuentas Vinculadas</p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {systemPaymentMethods.map((pm) => {
                    const bound = getMethodBoundAccount(pm);
                    return (
                      <div key={pm.id} className="flex items-center justify-between bg-white rounded-xl p-3 border border-gray-200 shadow-3xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                            {renderMethodIcon(pm.type)}
                          </div>
                          <div>
                            <p className="text-xs font-black text-gray-900">{pm.name}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase">{pm.currency} • {pm.type}</p>
                          </div>
                        </div>

                        <div className="text-right">
                          {bound.isBound ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-violet-50 text-violet-800 border border-violet-200">
                              <Lock className="w-3 h-3 text-violet-600" />
                              Fijado a: {bound.accountName}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">
                              <Unlock className="w-3 h-3 text-gray-400" />
                              Disponible (Sin cuenta)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-150 flex items-center justify-end">
                <button 
                  type="button" 
                  onClick={() => setShowPaymentMethodsModal(false)}
                  className="px-5 py-2 bg-white border border-gray-200 text-gray-600 text-xs font-extrabold rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL DE CONFIRMACIÓN DE ELIMINACIÓN 
          ========================================== */}
      {showDeleteConfirm && accountToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <h3 className="text-base font-black uppercase text-gray-900 tracking-tight">¿Eliminar Cuenta Bancaria?</h3>
            </div>
            
            <p className="text-xs font-semibold text-gray-600 leading-relaxed">
              ¿Está seguro de que desea eliminar la cuenta bancaria <strong className="text-gray-900 font-extrabold">"{accountToDelete.name}"</strong>? 
              Los métodos de pago vinculados a esta cuenta quedarán liberados en el sistema. Esta acción no se puede deshacer.
            </p>

            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setAccountToDelete(null);
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-xs rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAccount}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                Sí, eliminar cuenta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          TOAST DE NOTIFICACIONES PREMIUM
          ========================================== */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-white rounded-2xl border border-gray-200 shadow-xl p-4 flex items-start gap-3.5 animate-in slide-in-from-bottom-5 duration-350">
          <div className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-extrabold text-gray-900 uppercase tracking-tight">{toast.type === 'success' ? 'Éxito' : 'Error'}</p>
            <p className="text-xs font-bold text-gray-500 mt-0.5 leading-normal">{toast.msg}</p>
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
