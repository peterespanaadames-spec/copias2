import React, { useState, useEffect, useMemo } from 'react';
import { Unlock, X, User, Loader2, ChevronDown } from 'lucide-react';
import { StoreUser } from '../types';
import { dbService } from '../lib/supabase';

interface OpenCashSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { aperturaBs: number; observaciones: string; empleadoNombre: string }) => Promise<void>;
  bcvRate: number;
  currentUser?: StoreUser | null;
  storeUsers?: StoreUser[];
  initialBs?: string;
  initialObs?: string;
}

export default function OpenCashSessionModal({
  isOpen,
  onClose,
  onConfirm,
  bcvRate,
  currentUser,
  storeUsers = [],
  initialBs = '10.00',
  initialObs = ''
}: OpenCashSessionModalProps) {
  const [aperturaBsInput, setAperturaBsInput] = useState<string>(initialBs);
  const [aperturaObsInput, setAperturaObsInput] = useState<string>(initialObs);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [localUsers, setLocalUsers] = useState<StoreUser[]>([]);

  useEffect(() => {
    if (isOpen) {
      setAperturaBsInput(initialBs || '10.00');
      setAperturaObsInput(initialObs || '');
    }
  }, [isOpen, initialBs, initialObs]);

  useEffect(() => {
    if (storeUsers && storeUsers.length > 0) {
      setLocalUsers(storeUsers);
    } else if (isOpen) {
      dbService.getStoreUsers().then(users => {
        if (users && users.length > 0) {
          setLocalUsers(users);
        }
      }).catch(console.error);
    }
  }, [storeUsers, isOpen]);

  // Authorized caja personnel
  const authorizedCajaUsers = useMemo(() => {
    const list = localUsers.length > 0 ? localUsers : (storeUsers || []);
    return list.filter(u => {
      if (u.is_active === false) return false;
      const role = (u.role || '').toLowerCase();
      if (role === 'cliente') return false;

      if (role === 'gerente' || role === 'admin' || role === 'administrador' || role === 'cajero') {
        return true;
      }

      if (u.permissions && u.permissions.length > 0) {
        return u.permissions.some(p => p === 'caja' || p === 'sales' || p === 'orders');
      }

      return false;
    });
  }, [localUsers, storeUsers]);

  // Unified list of options for dropdown
  const employeeOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    authorizedCajaUsers.forEach(u => {
      const val = (u.name || u.email || '').trim();
      if (val && !opts.some(o => o.value === val)) {
        opts.push({ value: val, label: `${val} — [${u.role || 'Cajero'}]` });
      }
    });
    if (currentUser && currentUser.role !== 'Cliente') {
      const val = (currentUser.name || currentUser.email || '').trim();
      if (val && !opts.some(o => o.value === val)) {
        opts.unshift({ value: val, label: `${val} — [${currentUser.role || 'Usuario Actual'}]` });
      }
    }
    if (opts.length === 0) {
      opts.push({ value: 'Cajero Responsable', label: 'Cajero Responsable' });
    }
    return opts;
  }, [authorizedCajaUsers, currentUser]);

  // Set default employee when opening
  useEffect(() => {
    if (isOpen) {
      if (employeeOptions.length > 0) {
        const found = employeeOptions.find(o => o.value === selectedEmployee);
        if (!found) {
          setSelectedEmployee(employeeOptions[0].value);
        }
      } else {
        setSelectedEmployee('Cajero Responsable');
      }
    }
  }, [isOpen, employeeOptions, selectedEmployee]);

  if (!isOpen) return null;

  const bsVal = parseFloat(aperturaBsInput) || 0;
  const rateToUse = bcvRate > 0 ? bcvRate : 36.5;
  const approxUsd = bsVal / rateToUse;

  const handleSubmit = async (e: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    const empName = selectedEmployee.trim() || (employeeOptions.length > 0 ? employeeOptions[0].value : 'Cajero Responsable');
    
    if (isNaN(bsVal) || bsVal < 0) {
      alert('Por favor ingrese un monto de apertura válido.');
      return;
    }

    setIsSaving(true);
    try {
      await onConfirm({
        aperturaBs: bsVal,
        observaciones: aperturaObsInput.trim(),
        empleadoNombre: empName
      });
      onClose();
    } catch (err: any) {
      console.error("Error opening cash session:", err);
      alert("Error al aperturar caja: " + (err.message || "Intente de nuevo"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/65 z-50 flex items-center justify-center p-4 backdrop-blur-xs select-none animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-gray-100 text-left">
        {/* GREEN HEADER matching Image 2 */}
        <div className="bg-[#00a650] px-5 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
              <Unlock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight leading-tight">
                Apertura de Caja Registradora
              </h3>
              <p className="text-[11px] text-emerald-100 font-medium">
                Asigne el fondo inicial para iniciar operaciones de venta.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/20 p-1.5 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FORM BODY */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Empleado responsable */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-black text-gray-700 uppercase tracking-wider">
                Empleado Responsable del Turno *
              </label>
              <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80">
                {authorizedCajaUsers.length} Habilitados
              </span>
            </div>

            <div className="relative">
              {employeeOptions.length > 0 ? (
                <div className="relative">
                  <select
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className="w-full pl-9 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition cursor-pointer appearance-none"
                  >
                    {employeeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              ) : (
                <input
                  type="text"
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  placeholder="Nombre del Cajero / Empleado Responsable"
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              )}
              <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
            <p className="text-[10px] text-gray-400 mt-1 font-medium">
              Se muestran exclusivamente los usuarios registrados activos con permisos de caja/venta.
            </p>
          </div>

          {/* Fondo inicial Bs */}
          <div>
            <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
              Fondo Inicial en Efectivo (Bs) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">
                Bs
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={aperturaBsInput}
                onChange={(e) => setAperturaBsInput(e.target.value)}
                placeholder="10,00"
                className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
            </div>
            <p className="text-[10px] text-emerald-700 font-bold mt-1">
              Equivalente aprox: ${approxUsd.toFixed(2)} USD (Tasa BCV: {rateToUse.toFixed(2)} Bs/$)
            </p>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
              Observaciones / Notas de Apertura
            </label>
            <input
              type="text"
              value={aperturaObsInput}
              onChange={(e) => setAperturaObsInput(e.target.value)}
              placeholder="Ej: Billetes sencillos para cambio..."
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-5 py-2.5 border border-gray-200 text-gray-600 font-bold text-xs rounded-xl hover:bg-gray-50 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-[#00a650] hover:bg-[#008d43] text-white text-xs font-black rounded-xl transition flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20 active:scale-[0.98] disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Unlock className="w-4 h-4" />
              )}
              <span>Confirmar y Abrir Caja</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
