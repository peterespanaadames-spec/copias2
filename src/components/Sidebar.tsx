/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Filter, RotateCcw, Check, ShoppingBag, Grid, BookOpen } from 'lucide-react';
import { Category, Brand } from '../types.ts';
import { useI18n } from '../lib/i18n.ts';

interface SidebarProps {
  categories: Category[];
  brands: Brand[];
  selectedCategory: string;
  setSelectedCategory: (id: string) => void;
  selectedBrand: string;
  setSelectedBrand: (id: string) => void;
  minPrice: number;
  setMinPrice: (price: number) => void;
  maxPrice: number;
  setMaxPrice: (price: number) => void;
  onlyInStock: boolean;
  setOnlyInStock: (val: boolean) => void;
  onlyFeatured: boolean;
  setOnlyFeatured: (val: boolean) => void;
  onResetFilters: () => void;
}

export default function Sidebar({
  categories,
  brands,
  selectedCategory,
  setSelectedCategory,
  selectedBrand,
  setSelectedBrand,
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
  onlyInStock,
  setOnlyInStock,
  onlyFeatured,
  setOnlyFeatured,
  onResetFilters
}: SidebarProps) {
  const { t } = useI18n();

  return (
    <aside className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm sticky top-24 max-h-[85vh] overflow-y-auto select-none">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
        <h2 className="font-bold text-sm text-[#131921] uppercase tracking-wider flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#FF9900]" />
          {t('sidebar.filters_title', 'Filtros de Búsqueda')}
        </h2>
        <button
          onClick={onResetFilters}
          className="text-xs text-[#007185] hover:text-[#FF9900] flex items-center gap-1 font-semibold transition cursor-pointer"
          title={t('sidebar.clear', 'Limpiar')}
          id="btn-reset-filters"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {t('sidebar.clear', 'Limpiar')}
        </button>
      </div>

      {/* Category Filter */}
      <div className="mb-6">
        <h3 className="font-bold text-xs text-[#0F1111] uppercase tracking-wider mb-2">
          {t('sidebar.category', 'Categoría')}
        </h3>
        <div className="space-y-1">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition flex items-center justify-between cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#EAEDED] font-bold text-[#131921]'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span>{t('sidebar.all_items', 'Todos los artículos')}</span>
            {selectedCategory === 'all' && <Check className="w-3.5 h-3.5 text-[#FF9900]" />}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition flex items-center justify-between cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-[#EAEDED] font-bold text-[#131921]'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="truncate">{cat.name}</span>
              {selectedCategory === cat.id && <Check className="w-3.5 h-3.5 text-[#FF9900]" />}
            </button>
          ))}
        </div>
      </div>

      {/* Brand Filter */}
      <div className="mb-6">
        <h3 className="font-bold text-xs text-[#0F1111] uppercase tracking-wider mb-2">
          {t('sidebar.brand', 'Marca / Fabricante')}
        </h3>
        <div className="space-y-1">
          <button
            onClick={() => setSelectedBrand('all')}
            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition flex items-center justify-between cursor-pointer ${
              selectedBrand === 'all'
                ? 'bg-[#EAEDED] font-bold text-[#131921]'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span>{t('sidebar.all_brands', 'Todas las marcas')}</span>
            {selectedBrand === 'all' && <Check className="w-3.5 h-3.5 text-[#FF9900]" />}
          </button>
          {brands.map((brand) => (
            <button
              key={brand.id}
              onClick={() => setSelectedBrand(brand.id)}
              className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition flex items-center justify-between cursor-pointer ${
                selectedBrand === brand.id
                  ? 'bg-[#EAEDED] font-bold text-[#131921]'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>{brand.name}</span>
              {selectedBrand === brand.id && <Check className="w-3.5 h-3.5 text-[#FF9900]" />}
            </button>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div className="mb-6">
        <h3 className="font-bold text-xs text-[#0F1111] uppercase tracking-wider mb-3">
          {t('sidebar.price_range', 'Rango de Precio')} ($ USD)
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-2 justify-between">
            <div className="w-1/2">
              <label className="text-[10px] text-gray-400 font-bold block uppercase">{t('sidebar.min_price', 'Mínimo')} ($)</label>
              <input
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(Math.max(0, Number(e.target.value)))}
                className="w-full bg-gray-50 border border-gray-300 rounded px-2 py-1 text-xs text-[#0F1111] focus:outline-none focus:ring-1 focus:ring-[#FF9900]"
              />
            </div>
            <div className="w-1/2">
              <label className="text-[10px] text-gray-400 font-bold block uppercase">{t('sidebar.max_price', 'Máximo')} ($)</label>
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Math.max(0, Number(e.target.value)))}
                className="w-full bg-gray-50 border border-gray-300 rounded px-2 py-1 text-xs text-[#0F1111] focus:outline-none focus:ring-1 focus:ring-[#FF9900]"
              />
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="1000"
            step="10"
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            className="w-full accent-[#FF9900] h-1.5 bg-gray-200 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* Inventory & Status Filters */}
      <div className="space-y-3 pt-3 border-t border-gray-100">
        {/* Only In Stock checkbox */}
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyInStock}
            onChange={(e) => setOnlyInStock(e.target.checked)}
            className="rounded border-gray-300 text-[#FF9900] focus:ring-[#FF9900] w-4 h-4 accent-[#FF9900]"
            id="chk-only-stock"
          />
          <span>{t('sidebar.in_stock_only', 'Solo productos en stock')}</span>
        </label>

        {/* Only Featured checkbox */}
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyFeatured}
            onChange={(e) => setOnlyFeatured(e.target.checked)}
            className="rounded border-gray-300 text-[#FF9900] focus:ring-[#FF9900] w-4 h-4 accent-[#FF9900]"
            id="chk-only-featured"
          />
          <span className="flex items-center gap-1">
            <span>{t('sidebar.featured_only', 'Solo productos destacados')}</span>
          </span>
        </label>
      </div>
    </aside>
  );
}
