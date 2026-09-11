import React from 'react';
import {
  Package,
  Award,
  Search,
  Sparkles,
  TrendingUp,
  ShoppingBag,
  ArrowUpDown,
  Layers,
  FileText,
  Truck,
  Globe,
  CreditCard
} from 'lucide-react';

export interface TopProductItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  totalUnits: number;
  totalRevenueUsd: number;
  totalRevenueVes: number;
  ticketsCount: number;
  currentStock: number | string;
  avgPriceUsd: number;
  percentage: number;
  unitsBySource: {
    facturas: number;
    notas: number;
    pedidos: number;
    credito: number;
  };
  revenueBySource: {
    facturas: number;
    notas: number;
    pedidos: number;
    credito: number;
  };
}

interface SalesTopProductosTabProps {
  topProductsList: TopProductItem[];
  filteredTopProducts: TopProductItem[];
  productCategories: string[];
  productCategoryFilter: string;
  setProductCategoryFilter: (cat: string) => void;
  productSortBy: 'units' | 'revenue';
  setProductSortBy: (sort: 'units' | 'revenue') => void;
  productSearchTerm: string;
  setProductSearchTerm: (term: string) => void;
  topProductsLimit?: 'top10' | 'top20' | 'all';
  setTopProductsLimit?: (lim: 'top10' | 'top20' | 'all') => void;
  topProductsTotals: {
    totalGrandUnits: number;
    totalGrandRevenueUsd: number;
    totalGrandRevenueVes: number;
  };
}

export default function SalesTopProductosTab({
  topProductsList,
  filteredTopProducts,
  productCategories,
  productCategoryFilter,
  setProductCategoryFilter,
  productSortBy,
  setProductSortBy,
  productSearchTerm,
  setProductSearchTerm,
  topProductsLimit = 'top10',
  setTopProductsLimit,
  topProductsTotals
}: SalesTopProductosTabProps) {
  // Top 3 for podium
  const top1 = topProductsList[0];
  const top2 = topProductsList[1];
  const top3 = topProductsList[2];

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* 1. CHANNEL AUDIT BANNER */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-gradient-to-r from-[#1D3557] via-[#2B4C7E] to-[#457B9D] rounded-2xl p-4 text-white shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-300">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-black tracking-tight">
                Auditoría Unificada: Top 10 Productos Más Vendidos
              </h3>
              <p className="text-xs text-slate-200">
                Consolidando ventas de 4 fuentes: Facturas Normales, Notas de Entrega, Pedidos Online y Cuentas por Cobrar (Crédito)
              </p>
            </div>
          </div>

          {/* Quick source pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
            <span className="bg-white/15 px-2.5 py-1 rounded-lg flex items-center gap-1">
              <FileText className="w-3 h-3 text-blue-300" /> Facturas
            </span>
            <span className="bg-white/15 px-2.5 py-1 rounded-lg flex items-center gap-1">
              <Truck className="w-3 h-3 text-amber-300" /> Notas Entrega
            </span>
            <span className="bg-white/15 px-2.5 py-1 rounded-lg flex items-center gap-1">
              <Globe className="w-3 h-3 text-emerald-300" /> Pedidos Web
            </span>
            <span className="bg-white/15 px-2.5 py-1 rounded-lg flex items-center gap-1">
              <CreditCard className="w-3 h-3 text-purple-300" /> Crédito CxC
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. TOP 3 PODIUM SPOTLIGHT */}
      {/* ------------------------------------------------------------- */}
      {topProductsList.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Rank 1: Gold */}
          {top1 && (
            <div className="bg-gradient-to-br from-amber-500/10 via-amber-100/30 to-white rounded-2xl p-5 border-2 border-amber-300/80 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-sm shadow-xs">
                    🥇
                  </span>
                  <span className="text-xs font-black uppercase text-amber-800 tracking-wider">Top #1 Más Vendido</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                  {top1.category}
                </span>
              </div>
              <h4 className="text-base font-black text-slate-900 mt-2.5 truncate" title={top1.name}>
                {top1.name}
              </h4>
              <div className="mt-2 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-black text-amber-900 font-mono">
                    ${top1.totalRevenueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="block text-[11px] text-amber-800 font-semibold font-mono">
                    Bs. {top1.totalRevenueVes.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-slate-900 font-mono block">
                    {top1.totalUnits} <span className="text-xs font-normal text-slate-500">unids</span>
                  </span>
                  <span className="text-[10px] font-bold text-amber-700">
                    {top1.percentage.toFixed(1)}% de ventas
                  </span>
                </div>
              </div>
              {/* Channel Mini Badges */}
              {top1.unitsBySource && (
                <div className="mt-3 pt-2.5 border-t border-amber-200/60 flex flex-wrap gap-1 text-[10px] font-bold">
                  {top1.unitsBySource.facturas > 0 && <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">Fac: {top1.unitsBySource.facturas}</span>}
                  {top1.unitsBySource.notas > 0 && <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">NE: {top1.unitsBySource.notas}</span>}
                  {top1.unitsBySource.pedidos > 0 && <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Ped: {top1.unitsBySource.pedidos}</span>}
                  {top1.unitsBySource.credito > 0 && <span className="text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">CxC: {top1.unitsBySource.credito}</span>}
                </div>
              )}
            </div>
          )}

          {/* Rank 2: Silver */}
          {top2 && (
            <div className="bg-gradient-to-br from-slate-200/30 via-slate-100/40 to-white rounded-2xl p-5 border border-slate-300 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-slate-400 text-white flex items-center justify-center font-black text-sm shadow-xs">
                    🥈
                  </span>
                  <span className="text-xs font-black uppercase text-slate-700 tracking-wider">Top #2 Más Vendido</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                  {top2.category}
                </span>
              </div>
              <h4 className="text-base font-black text-slate-900 mt-2.5 truncate" title={top2.name}>
                {top2.name}
              </h4>
              <div className="mt-2 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-black text-slate-800 font-mono">
                    ${top2.totalRevenueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="block text-[11px] text-slate-600 font-semibold font-mono">
                    Bs. {top2.totalRevenueVes.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-slate-900 font-mono block">
                    {top2.totalUnits} <span className="text-xs font-normal text-slate-500">unids</span>
                  </span>
                  <span className="text-[10px] font-bold text-slate-600">
                    {top2.percentage.toFixed(1)}% de ventas
                  </span>
                </div>
              </div>
              {/* Channel Mini Badges */}
              {top2.unitsBySource && (
                <div className="mt-3 pt-2.5 border-t border-slate-200 flex flex-wrap gap-1 text-[10px] font-bold">
                  {top2.unitsBySource.facturas > 0 && <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">Fac: {top2.unitsBySource.facturas}</span>}
                  {top2.unitsBySource.notas > 0 && <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">NE: {top2.unitsBySource.notas}</span>}
                  {top2.unitsBySource.pedidos > 0 && <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Ped: {top2.unitsBySource.pedidos}</span>}
                  {top2.unitsBySource.credito > 0 && <span className="text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">CxC: {top2.unitsBySource.credito}</span>}
                </div>
              )}
            </div>
          )}

          {/* Rank 3: Bronze */}
          {top3 && (
            <div className="bg-gradient-to-br from-amber-700/10 via-amber-600/5 to-white rounded-2xl p-5 border border-amber-700/30 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-amber-700 text-white flex items-center justify-center font-black text-sm shadow-xs">
                    🥉
                  </span>
                  <span className="text-xs font-black uppercase text-amber-900 tracking-wider">Top #3 Más Vendido</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800">
                  {top3.category}
                </span>
              </div>
              <h4 className="text-base font-black text-slate-900 mt-2.5 truncate" title={top3.name}>
                {top3.name}
              </h4>
              <div className="mt-2 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-black text-amber-950 font-mono">
                    ${top3.totalRevenueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="block text-[11px] text-amber-900 font-semibold font-mono">
                    Bs. {top3.totalRevenueVes.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-slate-900 font-mono block">
                    {top3.totalUnits} <span className="text-xs font-normal text-slate-500">unids</span>
                  </span>
                  <span className="text-[10px] font-bold text-amber-800">
                    {top3.percentage.toFixed(1)}% de ventas
                  </span>
                </div>
              </div>
              {/* Channel Mini Badges */}
              {top3.unitsBySource && (
                <div className="mt-3 pt-2.5 border-t border-amber-200/60 flex flex-wrap gap-1 text-[10px] font-bold">
                  {top3.unitsBySource.facturas > 0 && <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">Fac: {top3.unitsBySource.facturas}</span>}
                  {top3.unitsBySource.notas > 0 && <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">NE: {top3.unitsBySource.notas}</span>}
                  {top3.unitsBySource.pedidos > 0 && <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Ped: {top3.unitsBySource.pedidos}</span>}
                  {top3.unitsBySource.credito > 0 && <span className="text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">CxC: {top3.unitsBySource.credito}</span>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. RANKING TABLE & FILTER BAR */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Filter Controls */}
        <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {/* Top 10 / 20 / All selector */}
            {setTopProductsLimit && (
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
                {(
                  [
                    { id: 'top10', label: 'Top 10' },
                    { id: 'top20', label: 'Top 20' },
                    { id: 'all', label: 'Todos' }
                  ] as const
                ).map(lim => (
                  <button
                    key={lim.id}
                    onClick={() => setTopProductsLimit(lim.id)}
                    className={`px-3 py-1 text-xs font-black rounded-lg transition-colors cursor-pointer ${
                      topProductsLimit === lim.id
                        ? 'bg-[#1D3557] text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {lim.label}
                  </button>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="relative min-w-[200px] flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por producto, código o categoría..."
                value={productSearchTerm}
                onChange={e => setProductSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1D3557]"
              />
            </div>

            {/* Category Filter */}
            <select
              value={productCategoryFilter}
              onChange={e => setProductCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#1D3557] cursor-pointer"
            >
              <option value="all">Todas las categorías</option>
              {productCategories.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Sort Toggle */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
              <button
                onClick={() => setProductSortBy('revenue')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  productSortBy === 'revenue' ? 'bg-[#1D3557] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Mayor Recaudación ($)
              </button>
              <button
                onClick={() => setProductSortBy('units')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  productSortBy === 'units' ? 'bg-[#1D3557] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Más Unidades Vendidas
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Mostrando <strong>{filteredTopProducts.length}</strong> productos en ranking
          </div>
        </div>

        {/* Top Products Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                <th className="py-3 px-3 text-center">Posición</th>
                <th className="py-3 px-4">Producto / Artículo</th>
                <th className="py-3 px-3">Categoría</th>
                <th className="py-3 px-3 text-center">Total Unids</th>
                <th className="py-3 px-4">Desglose por Canal de Venta</th>
                <th className="py-3 px-3 text-right">P. Promedio</th>
                <th className="py-3 px-3 text-right">Total USD ($)</th>
                <th className="py-3 px-3 text-right">Total VES (Bs.)</th>
                <th className="py-3 px-3 text-right">% Part.</th>
                <th className="py-3 px-3 text-center">Tickets</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTopProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Package className="w-8 h-8 text-slate-300" />
                      <p>No se encontraron productos en el período o filtros seleccionados.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTopProducts.map((prod, idx) => {
                  const rank = idx + 1;
                  const isTop3 = rank <= 3;

                  return (
                    <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Rank Position */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-black text-xs ${
                            rank === 1
                              ? 'bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs'
                              : rank === 2
                              ? 'bg-slate-200 text-slate-800 border border-slate-300'
                              : rank === 3
                              ? 'bg-amber-700/10 text-amber-900 border border-amber-700/30'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {rank}
                        </span>
                      </td>

                      {/* Product Name & SKU */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-xs">
                            {prod.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            SKU: {prod.sku}
                          </span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
                          {prod.category}
                        </span>
                      </td>

                      {/* Units Sold */}
                      <td className="py-3 px-3 text-center font-mono font-black text-slate-900 text-sm">
                        {prod.totalUnits}
                      </td>

                      {/* Multi-channel audit breakdown */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1 text-[10px] font-semibold">
                          <span className={`px-1.5 py-0.5 rounded font-mono ${prod.unitsBySource?.facturas > 0 ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' : 'bg-slate-50 text-slate-400'}`} title="Facturas Normales">
                            Fac: {prod.unitsBySource?.facturas || 0}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded font-mono ${prod.unitsBySource?.notas > 0 ? 'bg-amber-50 text-amber-800 font-bold border border-amber-200' : 'bg-slate-50 text-slate-400'}`} title="Notas de Entrega">
                            NE: {prod.unitsBySource?.notas || 0}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded font-mono ${prod.unitsBySource?.pedidos > 0 ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200' : 'bg-slate-50 text-slate-400'}`} title="Pedidos Online">
                            Ped: {prod.unitsBySource?.pedidos || 0}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded font-mono ${prod.unitsBySource?.credito > 0 ? 'bg-purple-50 text-purple-700 font-bold border border-purple-200' : 'bg-slate-50 text-slate-400'}`} title="Cuentas por Cobrar (Crédito)">
                            CxC: {prod.unitsBySource?.credito || 0}
                          </span>
                        </div>
                      </td>

                      {/* Avg Price */}
                      <td className="py-3 px-3 text-right font-mono text-slate-600 font-medium">
                        ${prod.avgPriceUsd.toFixed(2)}
                      </td>

                      {/* Total USD */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 text-sm">
                        ${prod.totalRevenueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Total VES */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-[#1D3557]">
                        Bs. {prod.totalRevenueVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Percentage Share */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className="h-full rounded-full bg-emerald-600"
                              style={{ width: `${Math.min(100, Math.max(0, prod.percentage))}%` }}
                            />
                          </div>
                          <span className="font-bold text-slate-700 text-xs">
                            {prod.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </td>

                      {/* Ticket Count */}
                      <td className="py-3 px-3 text-center font-mono text-slate-600 font-semibold">
                        {prod.ticketsCount}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Dark Total Footer */}
            {filteredTopProducts.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-950">
                  <td colSpan={3} className="py-3.5 px-4 font-black tracking-wide">
                    TOTAL GENERAL PRODUCTOS EN RANKING
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono text-amber-300 text-sm">
                    {topProductsTotals.totalGrandUnits} unids
                  </td>
                  <td className="py-3.5 px-4 text-xs font-normal text-slate-400">
                    Auditado en 4 canales
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-slate-400">—</td>
                  <td className="py-3.5 px-3 text-right font-mono text-emerald-400 text-sm">
                    ${topProductsTotals.totalGrandRevenueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-slate-200">
                    Bs. {topProductsTotals.totalGrandRevenueVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-amber-400">
                    100.0%
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono text-white">
                    {topProductsList.length}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
