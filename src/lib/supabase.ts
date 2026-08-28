/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';
import { 
  Category, Brand, Product, ProductImage, SystemSettings, Order, Provider, Purchase, PurchaseItem, PurchaseInstallment,
  AccountPayable, AccountPayablePayment, AccountReceivable, AccountReceivablePayment,
  BankAccount, BankTransfer, GastoFijo, GastoFijoPayment,
  DiscountCode, LoyaltySettings, LoyaltyReward, StoreUser, WishlistItem, 
  BannerSlide, LandingConfig, HomeCarouselCardItem, Quote, QuoteItem, Tax, 
  PaymentMethodConfig, Invoice,
  ReportModuleConfig, BusinessProfile, BusinessBranch, BusinessTerminal 
} from '../types';
import { sortProductsByPriority } from './searchUtils';

// Helper to robustly parse items that may be stringified or double-stringified
const parseInvoiceItems = (itemsVal: any): any[] => {
  if (Array.isArray(itemsVal)) return itemsVal;
  if (!itemsVal) return [];
  try {
    let parsed = typeof itemsVal === 'string' ? JSON.parse(itemsVal) : itemsVal;
    let limit = 5; // Prevent infinite loop in case of weird cycles
    while (typeof parsed === 'string' && limit > 0) {
      parsed = JSON.parse(parsed);
      limit--;
    }
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Error parsing invoice items:", e);
    return [];
  }
};

// Read configuration from localStorage or initial environment
const getInitialSettings = (): SystemSettings => {
  const defaultUrl = 'https://absmxrciaasihyqpinlm.supabase.co';
  const defaultKey = 'sb_publishable_rn_0iwmTGj_z1ZaneXBdpw_eSvlUIU_';
  try {
    const saved = localStorage.getItem('copias_bellavista_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        supabaseUrl: parsed.supabaseUrl || (import.meta as any).env.VITE_SUPABASE_URL || defaultUrl,
        supabaseAnonKey: parsed.supabaseAnonKey || (import.meta as any).env.VITE_SUPABASE_ANON_KEY || defaultKey,
        useSupabase: parsed.useSupabase !== undefined ? parsed.useSupabase === true : true
      };
    }
  } catch (e) {
    console.error("Error reading settings", e);
  }

  const envUrl = (import.meta as any).env.VITE_SUPABASE_URL;
  const envKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

  return {
    supabaseUrl: envUrl || defaultUrl,
    supabaseAnonKey: envKey || defaultKey,
    useSupabase: true
  };
};

export const currentSettings = getInitialSettings();

// Helper to sanitize Supabase URL (strips trailing slashes and /rest/v1 if present)
const sanitizeSupabaseUrl = (url: string): string => {
  if (!url) return '';
  let cleaned = url.trim();
  if (cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }
  if (cleaned.endsWith('/rest/v1')) {
    cleaned = cleaned.slice(0, -8);
  }
  if (cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }
  return cleaned;
};

// Initialize actual Supabase client optionally
export const supabase = (currentSettings.useSupabase && currentSettings.supabaseUrl && currentSettings.supabaseAnonKey)
  ? createClient(sanitizeSupabaseUrl(currentSettings.supabaseUrl), currentSettings.supabaseAnonKey)
  : null;

// Initial Local Storage setup for settings only
const initializeLocalDb = () => {
  if (!localStorage.getItem('copias_bellavista_settings')) {
    localStorage.setItem('copias_bellavista_settings', JSON.stringify({
      supabaseUrl: 'https://absmxrciaasihyqpinlm.supabase.co',
      supabaseAnonKey: 'sb_publishable_rn_0iwmTGj_z1ZaneXBdpw_eSvlUIU_',
      useSupabase: true
    }));
  }
};

initializeLocalDb();

// Helper to rebuild address_text with parsed extras serialized cleanly
const rebuildAddressWithExtras = (
  currentAddress: string,
  extras: {
    payment_method?: string;
    payment_amount_with?: number;
    comments?: string;
    payment_status?: string;
    customer_email?: string;
  }
) => {
  let cleanAddress = (currentAddress || '')
    .replace(/\[Método Pago:[^\]\n]+\]/g, '')
    .replace(/\[Paga con:[^\]\n]+\]/g, '')
    .replace(/\[Comentarios:[^\]\n]+\]/g, '')
    .replace(/\[Estado Pago:[^\]\n]+\]/g, '')
    .replace(/\[Email:[^\]\n]+\]/g, '')
    .trim();

  let serializedExtra = '';
  if (extras.payment_method) serializedExtra += `\n[Método Pago: ${extras.payment_method}]`;
  if (extras.payment_amount_with) serializedExtra += `\n[Paga con: US$ ${extras.payment_amount_with}]`;
  if (extras.comments) serializedExtra += `\n[Comentarios: ${extras.comments}]`;
  if (extras.payment_status) serializedExtra += `\n[Estado Pago: ${extras.payment_status}]`;
  if (extras.customer_email) serializedExtra += `\n[Email: ${extras.customer_email}]`;

  return `${cleanAddress}${serializedExtra}`.trim();
};

// ==========================================
// DB SERVICE METHODS (REAL DATABASE)
// ==========================================

export const dbService = {
  // Get active settings
  getSettings(): SystemSettings {
    return getInitialSettings();
  },

  // Save active settings
  saveSettings(settings: SystemSettings) {
    localStorage.setItem('copias_bellavista_settings', JSON.stringify(settings));
    // Reload page to re-evaluate Supabase client creation
    window.location.reload();
  },

  // Helper for offline data
  _getLocalFallback<T>(key: string, defaultValue: T): T {
    try {
      const stored = localStorage.getItem('copias_bellavista_' + key);
      if (stored) return JSON.parse(stored) as T;
    } catch (e) {
      console.warn(`Error reading local fallback for ${key}:`, e);
    }
    return defaultValue;
  },

  // Category Operations
  async getCategories(): Promise<Category[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase.from('categories').select('*').order('name');
      if (error) {
        console.warn("Notice fetching categories:", error.message || error);
        return [];
      }
      return (data || []) as Category[];
    } catch (e) {
      console.warn("getCategories exception:", e);
      return [];
    }
  },

  async createCategory(category: Omit<Category, 'id'>): Promise<Category> {
    if (!supabase) throw new Error('Supabase is not configured');
    const newCategory: Category = {
      ...category,
      id: crypto.randomUUID()
    };
    const { data, error } = await supabase.from('categories').insert([newCategory]).select();
    if (error) throw error;
    return data[0] as Category;
  },

  async updateCategory(id: string, category: Partial<Category>): Promise<Category> {
    if (!supabase) throw new Error('Supabase is not configured');
    const { data, error } = await supabase.from('categories').update(category).eq('id', id).select();
    if (error) throw error;
    return data[0] as Category;
  },

  async deleteCategory(id: string): Promise<boolean> {
    if (!supabase) throw new Error('Supabase is not configured');
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // Brand Operations
  async getBrands(): Promise<Brand[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase.from('brands').select('*').order('name');
      if (error) {
        console.warn("Notice fetching brands:", error.message || error);
        return [];
      }
      return (data || []) as Brand[];
    } catch (e) {
      console.warn("getBrands exception:", e);
      return [];
    }
  },

  async createBrand(brand: Omit<Brand, 'id'>): Promise<Brand> {
    if (!supabase) throw new Error('Supabase is not configured');
    const newBrand: Brand = {
      ...brand,
      id: crypto.randomUUID()
    };
    const { data, error } = await supabase.from('brands').insert([newBrand]).select();
    if (error) throw error;
    return data[0] as Brand;
  },

  async updateBrand(id: string, brand: Partial<Brand>): Promise<Brand> {
    if (!supabase) throw new Error('Supabase is not configured');
    const { data, error } = await supabase.from('brands').update(brand).eq('id', id).select();
    if (error) throw error;
    return data[0] as Brand;
  },

  async deleteBrand(id: string): Promise<boolean> {
    if (!supabase) throw new Error('Supabase is not configured');
    const { error } = await supabase.from('brands').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  async getProductsPaginated(params: {
    page: number;
    pageSize: number;
    searchTerm?: string;
    categoryId?: string;
    brandId?: string;
    onlyAvailable?: boolean;
    onlyFeatured?: boolean;
    onlyOffers?: boolean;
    minPrice?: number;
    maxPrice?: number;
  }): Promise<{ data: Product[], count: number }> {
    if (!supabase) return { data: [], count: 0 };
    
    let categoriesList: Category[] = [];
    let brandsList: Brand[] = [];
    let matchedCategoryIds: string[] = [];
    let matchedBrandIds: string[] = [];

    const term = (params.searchTerm || '').trim();

    if (term) {
      try {
        const [{ data: cats }, { data: brs }] = await Promise.all([
          supabase.from('categories').select('*'),
          supabase.from('brands').select('*')
        ]);
        categoriesList = (cats || []) as Category[];
        brandsList = (brs || []) as Brand[];

        matchedCategoryIds = categoriesList
          .filter(c => (c.name || '').toLowerCase().includes(term.toLowerCase()))
          .map(c => c.id);

        matchedBrandIds = brandsList
          .filter(b => (b.name || '').toLowerCase().includes(term.toLowerCase()))
          .map(b => b.id);
      } catch (err) {
        console.warn("Could not load categories/brands for search expansion:", err);
      }
    }

    const buildQuery = (includeBarcode: boolean) => {
      let query = supabase.from('products').select('*', { count: 'exact' });
      query = query.eq('active', true);

      if (term) {
        const orParts = [
          `name.ilike.%${term}%`,
          `description.ilike.%${term}%`,
          `sku.ilike.%${term}%`
        ];

        if (includeBarcode) {
          orParts.push(`barcode_qr.ilike.%${term}%`);
        }

        matchedCategoryIds.forEach(id => {
          orParts.push(`category_id.eq.${id}`);
        });

        matchedBrandIds.forEach(id => {
          orParts.push(`brand_id.eq.${id}`);
        });

        query = query.or(orParts.join(','));
      }
      if (params.categoryId && params.categoryId !== 'all') {
        query = query.eq('category_id', params.categoryId);
      }
      if (params.brandId && params.brandId !== 'all') {
        query = query.eq('brand_id', params.brandId);
      }
      if (params.onlyAvailable) {
        query = query.gt('stock', 0);
      }
      if (params.onlyFeatured) {
        query = query.eq('featured', true);
      }
      if (params.onlyOffers) {
        query = query.not('offer_price', 'is', null);
      }
      if (params.minPrice !== undefined && params.minPrice > 0) {
        query = query.gte('price', params.minPrice);
      }
      if (params.maxPrice !== undefined && params.maxPrice < 1000) {
        query = query.lte('price', params.maxPrice);
      }

      query = query.order('featured', { ascending: false }).order('created_at', { ascending: false });

      const from = params.page * params.pageSize;
      const to = from + params.pageSize - 1;
      return query.range(from, to);
    };

    try {
      let { data, error, count } = await buildQuery(true);
      if (error) {
        if (error.code === '42703' || error.message?.includes('barcode_qr')) {
          // Retry without barcode_qr column
          const retry = await buildQuery(false);
          if (!retry.error) {
            data = retry.data;
            count = retry.count;
          }
        } else {
          console.error("Error in getProductsPaginated:", error);
          return { data: [], count: 0 };
        }
      }

      const storedMeta = this.getStoredProductMeta();
      const isForbiddenLoc = (loc?: string | null): boolean => {
        if (!loc) return true;
        const l = loc.toLowerCase().trim();
        return l.includes('caja principal') || l.includes('caja copias') || l.includes('sede principal - almacen') || l.includes('sede principal - almacén');
      };

      const productsList = (data || []).map((p: any) => {
        const meta = storedMeta[p.id] || {};
        const metaLoc = (meta.location && !isForbiddenLoc(meta.location)) ? meta.location : null;
        const dbLoc = (p.location && !isForbiddenLoc(p.location)) ? p.location : null;
        return {
          ...p,
          location: metaLoc || dbLoc || 'Tienda Bella Vista (SP-01)',
          critical_stock: meta.critical_stock !== undefined ? meta.critical_stock : (p.critical_stock !== undefined && p.critical_stock !== null ? p.critical_stock : 5),
          expiration_date: meta.expiration_date !== undefined ? meta.expiration_date : (p.expiration_date || null),
          tax_id: meta.tax_id || p.tax_id || (p.tax_rate && p.tax_rate > 0 ? 'default-iva' : 'exento'),
          tax_rate: meta.tax_rate !== undefined ? meta.tax_rate : (p.tax_rate !== undefined && p.tax_rate !== null ? parseFloat(p.tax_rate) : 0)
        };
      }) as Product[];

      if (term) {
        const sorted = sortProductsByPriority(productsList, term, categoriesList, brandsList);
        return { data: sorted, count: count || 0 };
      }

      return { data: productsList, count: count || 0 };
    } catch (e) {
      console.error("getProductsPaginated exception:", e);
      return { data: [], count: 0 };
    }
  },

  getStoredProductMeta(): Record<string, Partial<Product>> {
    try {
      const saved = localStorage.getItem('copias_bellavista_prod_meta');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  },

  saveStoredProductMeta(id: string, meta: Partial<Product>): void {
    try {
      const current = this.getStoredProductMeta();
      current[id] = { ...current[id], ...meta };
      localStorage.setItem('copias_bellavista_prod_meta', JSON.stringify(current));
    } catch (e) {
      console.warn("Error saving local product metadata:", e);
    }
  },

  // Product Operations
  async getProducts(): Promise<Product[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      if (error) {
        console.warn("Notice fetching products:", error.message || error);
        return [];
      }
      const storedMeta = this.getStoredProductMeta();
      const isForbiddenLoc = (loc?: string | null): boolean => {
        if (!loc) return true;
        const l = loc.toLowerCase().trim();
        return l.includes('caja principal') || l.includes('caja copias') || l.includes('sede principal - almacen') || l.includes('sede principal - almacén');
      };

      return (data || []).map((p: any) => {
        const meta = storedMeta[p.id] || {};
        const metaLoc = (meta.location && !isForbiddenLoc(meta.location)) ? meta.location : null;
        const dbLoc = (p.location && !isForbiddenLoc(p.location)) ? p.location : null;
        return {
          ...p,
          location: metaLoc || dbLoc || 'Tienda Bella Vista (SP-01)',
          critical_stock: meta.critical_stock !== undefined ? meta.critical_stock : (p.critical_stock !== undefined && p.critical_stock !== null ? p.critical_stock : 5),
          expiration_date: meta.expiration_date !== undefined ? meta.expiration_date : (p.expiration_date || null),
          tax_id: meta.tax_id || p.tax_id || (p.tax_rate && p.tax_rate > 0 ? 'default-iva' : 'exento'),
          tax_rate: meta.tax_rate !== undefined ? meta.tax_rate : (p.tax_rate !== undefined && p.tax_rate !== null ? parseFloat(p.tax_rate) : 0)
        };
      }) as Product[];
    } catch (e) {
      console.warn("getProducts exception:", e);
      return [];
    }
  },

  async createProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
    if (!supabase) throw new Error('Supabase is not configured');
    const sanitizedProduct = {
      ...product,
      category_id: product.category_id === '' ? null : product.category_id,
      brand_id: product.brand_id === '' ? null : product.brand_id,
      tax_id: product.tax_id || 'exento',
      tax_rate: product.tax_rate !== undefined && product.tax_rate !== null ? Number(product.tax_rate) : 0
    };
    
    // rating_stars and rating_count do not exist in database products table
    delete (sanitizedProduct as any).rating_stars;
    delete (sanitizedProduct as any).rating_count;

    const newProduct = {
      ...sanitizedProduct,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // If barcode_qr is empty or null, remove it from the payload to avoid error if column does not exist
    if (!newProduct.barcode_qr || newProduct.barcode_qr.trim() === '') {
      delete (newProduct as any).barcode_qr;
    }
    
    if (newProduct.id) {
      this.saveStoredProductMeta(newProduct.id, {
        location: newProduct.location,
        critical_stock: newProduct.critical_stock,
        expiration_date: newProduct.expiration_date,
        tax_id: newProduct.tax_id,
        tax_rate: newProduct.tax_rate
      });
    }

    try {
      const { data, error } = await supabase.from('products').insert([newProduct]).select();
      if (error) throw error;
      return data[0] as Product;
    } catch (err: any) {
      if (err && (err.code === '42703' || (err.message && (err.message.includes('barcode_qr') || err.message.includes('cost_price') || err.message.includes('margin') || err.message.includes('unit') || err.message.includes('tax_id') || err.message.includes('tax_rate') || err.message.includes('expiration_date') || err.message.includes('critical_stock') || err.message.includes('location'))))) {
        const fallback = { ...newProduct };
        delete (fallback as any).cost_price;
        delete (fallback as any).margin_1;
        delete (fallback as any).margin_2;
        delete (fallback as any).margin_3;
        delete (fallback as any).selected_margin_type;
        delete (fallback as any).barcode_qr;
        delete (fallback as any).unit;
        delete (fallback as any).units;
        delete (fallback as any).tax_id;
        delete (fallback as any).tax_rate;
        delete (fallback as any).expiration_date;
        delete (fallback as any).critical_stock;
        delete (fallback as any).location;
        
        const { data: fbData, error: fbErr } = await supabase.from('products').insert([fallback]).select();
        if (!fbErr && fbData && fbData[0]) {
          return {
            ...fbData[0],
            tax_id: newProduct.tax_id,
            tax_rate: newProduct.tax_rate,
            expiration_date: newProduct.expiration_date,
            critical_stock: newProduct.critical_stock,
            location: newProduct.location,
            unit: (newProduct as any).unit || (newProduct as any).units || 'Unidad'
          } as Product;
        }

        throw new Error('Se requiere actualizar el esquema de la base de datos en Supabase (campos cost_price, margin_1, unit, tax_id, tax_rate, expiration_date). Por favor, ejecuta la consulta SQL disponible en Configuración en el SQL Editor de Supabase.');
      }
      throw err;
    }
  },

  async updateProduct(id: string, product: Partial<Product>): Promise<Product> {
    if (!supabase) throw new Error('Supabase is not configured');
    const sanitizedProduct = { ...product };
    if (product.category_id === '') sanitizedProduct.category_id = null;
    if (product.brand_id === '') sanitizedProduct.brand_id = null;
    
    // rating_stars and rating_count do not exist in database products table
    delete (sanitizedProduct as any).rating_stars;
    delete (sanitizedProduct as any).rating_count;

    const updatedFields = {
      ...sanitizedProduct,
      updated_at: new Date().toISOString()
    };

    // If barcode_qr is empty or null, remove it from the payload to avoid error if column does not exist
    if (!updatedFields.barcode_qr || String(updatedFields.barcode_qr).trim() === '') {
      delete (updatedFields as any).barcode_qr;
    }

    if (id) {
      this.saveStoredProductMeta(id, {
        location: updatedFields.location,
        critical_stock: updatedFields.critical_stock,
        expiration_date: updatedFields.expiration_date,
        tax_id: updatedFields.tax_id,
        tax_rate: updatedFields.tax_rate
      });
    }

    try {
      const { data, error } = await supabase.from('products').update(updatedFields).eq('id', id).select();
      if (error) throw error;
      return data[0] as Product;
    } catch (err: any) {
      if (err && (err.code === '42703' || (err.message && (err.message.includes('barcode_qr') || err.message.includes('cost_price') || err.message.includes('margin') || err.message.includes('unit') || err.message.includes('tax_id') || err.message.includes('tax_rate') || err.message.includes('expiration_date') || err.message.includes('critical_stock') || err.message.includes('location'))))) {
        const fallback = { ...updatedFields };
        delete (fallback as any).cost_price;
        delete (fallback as any).margin_1;
        delete (fallback as any).margin_2;
        delete (fallback as any).margin_3;
        delete (fallback as any).selected_margin_type;
        delete (fallback as any).barcode_qr;
        delete (fallback as any).unit;
        delete (fallback as any).units;
        delete (fallback as any).tax_id;
        delete (fallback as any).tax_rate;
        delete (fallback as any).expiration_date;
        delete (fallback as any).critical_stock;
        delete (fallback as any).location;

        const { data: fbData, error: fbErr } = await supabase.from('products').update(fallback).eq('id', id).select();
        if (!fbErr && fbData && fbData[0]) {
          return {
            ...fbData[0],
            tax_id: updatedFields.tax_id,
            tax_rate: updatedFields.tax_rate,
            expiration_date: updatedFields.expiration_date,
            critical_stock: updatedFields.critical_stock,
            location: updatedFields.location,
            unit: (updatedFields as any).unit || (updatedFields as any).units || 'Unidad'
          } as Product;
        }

        throw new Error('Se requiere actualizar el esquema de la base de datos en Supabase (campos cost_price, margin_1, unit, tax_id, tax_rate, expiration_date). Por favor, ejecuta la consulta SQL disponible en Configuración en el SQL Editor de Supabase.');
      }
      throw err;
    }
  },

  async deleteProduct(id: string): Promise<boolean> {
    if (!supabase) throw new Error('Supabase is not configured');
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
    // Also delete associated images
    await supabase.from('product_images').delete().eq('product_id', id);
    return true;
  },

  // Product Images Operations
  async getProductImages(productId?: string): Promise<ProductImage[]> {
    if (!supabase) return [];
    try {
      let query = supabase.from('product_images').select('*').order('sort_order');
      if (productId) {
        query = query.eq('product_id', productId);
      }
      const { data, error } = await query;
      if (error) {
        console.warn("Notice fetching product_images:", error.message || error);
        return [];
      }
      return (data || []) as ProductImage[];
    } catch (e) {
      console.warn("getProductImages exception:", e);
      return [];
    }
  },

  async addProductImage(productImage: Omit<ProductImage, 'id'>): Promise<ProductImage> {
    if (!supabase) throw new Error('Supabase is not configured');
    const newImage: ProductImage = {
      ...productImage,
      id: crypto.randomUUID()
    };
    const { data, error } = await supabase.from('product_images').insert([newImage]).select();
    if (error) throw error;
    return data[0] as ProductImage;
  },

  async removeProductImage(id: string): Promise<boolean> {
    if (!supabase) throw new Error('Supabase is not configured');
    const { error } = await supabase.from('product_images').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // Helper for offline orders fallback
  getLocalOrders(): Order[] {
    try {
      const saved = localStorage.getItem('copias_bellavista_local_orders');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  },

  saveLocalOrders(orders: Order[]): void {
    try {
      localStorage.setItem('copias_bellavista_local_orders', JSON.stringify(orders));
    } catch (e) {
      console.error("Error saving local orders:", e);
    }
  },

  // Order Operations
  async createOrder(order: Omit<Order, 'id' | 'created_at'>): Promise<Order> {
    const localOrders = this.getLocalOrders();
    const calculatedOrderNumber = localOrders.length + 1;

    const newOrder: Order = {
      ...order,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      order_number: calculatedOrderNumber
    };

    // Save locally as backup / immediate fallback
    localOrders.push(newOrder);
    this.saveLocalOrders(localOrders);

    if (!supabase) {
      console.warn("Supabase is not configured. Saving order locally only.");
      return newOrder;
    }
    
    try {
      const { data, error } = await supabase.from('orders').insert([newOrder]).select();
      if (error) {
        // If column doesn't exist error (42703 or undefined_column), fall back to serialized data in address_text
        if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('does not exist')) {
          console.warn("New columns not found in orders table. Retrying with self-healing serialized fallback inside address_text.");
          
          const fallbackOrder = {
            id: newOrder.id,
            customer_name: newOrder.customer_name,
            phone_number: newOrder.phone_number,
            delivery_method: newOrder.delivery_method,
            total_price: newOrder.total_price,
            status: newOrder.status,
            created_at: newOrder.created_at,
            items: newOrder.items,
            address_text: rebuildAddressWithExtras(newOrder.address_text || '', {
              payment_method: order.payment_method,
              payment_amount_with: order.payment_amount_with,
              comments: order.comments,
              payment_status: order.payment_status || 'pendiente',
              customer_email: order.customer_email || undefined
            })
          };
          
          const { data: fallbackData, error: fallbackError } = await supabase.from('orders').insert([fallbackOrder]).select();
          if (fallbackError) throw fallbackError;
          
          const returnedOrder = fallbackData[0] as Order;
          returnedOrder.order_number = calculatedOrderNumber;
          returnedOrder.payment_method = order.payment_method;
          returnedOrder.payment_amount_with = order.payment_amount_with;
          returnedOrder.comments = order.comments;
          returnedOrder.payment_status = order.payment_status || 'pendiente';
          returnedOrder.points = order.points;
          returnedOrder.customer_email = order.customer_email;

          // Sync client from order
          try {
            await this.syncClientFromOrder(returnedOrder.customer_name, returnedOrder.phone_number, order.customer_email || '');
          } catch (syncErr) {
            console.error("Failed to sync client during order fallback:", syncErr);
          }

          // Update local copy with synced metadata
          const latestLocals = this.getLocalOrders();
          const idx = latestLocals.findIndex(o => o.id === newOrder.id);
          if (idx !== -1) {
            latestLocals[idx] = returnedOrder;
            this.saveLocalOrders(latestLocals);
          }

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('bellavista_orders_updated'));
          }
          return returnedOrder;
        }
        throw error;
      }
      
      const resultOrder = data[0] as Order;
      if (!resultOrder.order_number) resultOrder.order_number = calculatedOrderNumber;

      // Sync client from order
      try {
        await this.syncClientFromOrder(resultOrder.customer_name, resultOrder.phone_number, order.customer_email || '');
      } catch (syncErr) {
        console.error("Failed to sync client during order creation:", syncErr);
      }

      // Update local copy with synced metadata
      const latestLocals = this.getLocalOrders();
      const idx = latestLocals.findIndex(o => o.id === newOrder.id);
      if (idx !== -1) {
        latestLocals[idx] = resultOrder;
        this.saveLocalOrders(latestLocals);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bellavista_orders_updated'));
      }

      return resultOrder;
    } catch (err) {
      console.warn("Supabase order creation failed, but order was saved in local storage fallback:", err);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bellavista_orders_updated'));
      }
      return newOrder;
    }
  },

  async getOrder(id: string): Promise<Order | null> {
    // Validate that id is a valid UUID, or handle 'temp-last-order' gracefully
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      if (id !== 'temp-last-order') {
        console.warn(`Invalid UUID format for order ID: ${id}`);
      }
      // Check local storage fallback first
      return this.getLocalOrders().find(o => o.id === id) || null;
    }

    if (!supabase) {
      return this.getLocalOrders().find(o => o.id === id) || null;
    }

    try {
      const { data, error } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
      if (error) {
        console.warn("Error fetching order by ID from Supabase. Falling back to local storage:", error);
        return this.getLocalOrders().find(o => o.id === id) || null;
      }
      if (!data) {
        return this.getLocalOrders().find(o => o.id === id) || null;
      }

      const order = data as Order;
      
      // Parse the self-healing serialized extra information from address_text if columns are missing
      if (order && order.address_text) {
        const addr = order.address_text;
        const methodMatch = addr.match(/\[Método Pago:\s*([^\]\n]+)\]/);
        const amountMatch = addr.match(/\[Paga con:\s*US\$\s*([\d\.]+)\]/);
        const commentsMatch = addr.match(/\[Comentarios:\s*([^\]\n]+)\]/);
        const paymentStatusMatch = addr.match(/\[Estado Pago:\s*([^\]\n]+)\]/);
        const emailMatch = addr.match(/\[Email:\s*([^\]\n]+)\]/);
        
        if (methodMatch && !order.payment_method) order.payment_method = methodMatch[1];
        if (amountMatch && !order.payment_amount_with) order.payment_amount_with = parseFloat(amountMatch[1]);
        if (commentsMatch && !order.comments) order.comments = commentsMatch[1];
        if (paymentStatusMatch && !order.payment_status) order.payment_status = paymentStatusMatch[1];
        if (emailMatch && !order.customer_email) order.customer_email = emailMatch[1];
      }
      
      // Calculate sequential order number on the fly if it is not saved or null
      if (order && !order.order_number) {
        try {
          const { count } = await supabase
            .from('orders')
            .select('*', { head: true, count: 'exact' })
            .lte('created_at', order.created_at || '');
          order.order_number = count || 1;
        } catch (e) {
          order.order_number = 1;
        }
      }
      
      // Default values
      if (order && !order.payment_status) {
        order.payment_status = 'pendiente';
      }
      if (order && (order.points === undefined || order.points === null)) {
        order.points = 0;
      }

      return order;
    } catch (err) {
      console.warn("Exception fetching order by ID. Falling back to local storage:", err);
      return this.getLocalOrders().find(o => o.id === id) || null;
    }
  },

  async getOrders(): Promise<Order[]> {
    if (!supabase) {
      return this.getLocalOrders();
    }

    try {
      const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (error) {
        console.warn("Error fetching orders from Supabase. Falling back to local storage:", error);
        return this.getLocalOrders();
      }
      if (!data || data.length === 0) {
        return this.getLocalOrders();
      }
      
      // Map self-healing attributes and missing fields
      const parsedOrders = data.map((order: any, index: number, array: any[]) => {
        // Parse items if string
        if (typeof order.items === 'string') {
          try {
            order.items = JSON.parse(order.items);
          } catch (e) {
            order.items = [];
          }
        }
        if (!Array.isArray(order.items)) {
          order.items = [];
        }

        // Parse numerical totals safely
        if (order.total_price !== undefined && order.total_price !== null) {
          order.total_price = parseFloat(String(order.total_price)) || 0;
        } else if (order.total !== undefined && order.total !== null) {
          order.total_price = parseFloat(String(order.total)) || 0;
        } else if (order.items && order.items.length > 0) {
          order.total_price = order.items.reduce((acc: number, it: any) => acc + (parseFloat(it.price) || 0) * (parseFloat(it.quantity) || 1), 0);
        } else {
          order.total_price = 0;
        }

        if (order.address_text) {
          const addr = order.address_text;
          const methodMatch = addr.match(/\[Método Pago:\s*([^\]\n]+)\]/);
          const amountMatch = addr.match(/\[Paga con:\s*US\$\s*([\d\.]+)\]/);
          const commentsMatch = addr.match(/\[Comentarios:\s*([^\]\n]+)\]/);
          const paymentStatusMatch = addr.match(/\[Estado Pago:\s*([^\]\n]+)\]/);
          const emailMatch = addr.match(/\[Email:\s*([^\]\n]+)\]/);
          const sellerMatch = addr.match(/\[Vendedor:\s*([^\]\n]+)\]/);
          
          if (methodMatch && !order.payment_method) order.payment_method = methodMatch[1];
          if (amountMatch && !order.payment_amount_with) order.payment_amount_with = parseFloat(amountMatch[1]);
          if (commentsMatch && !order.comments) order.comments = commentsMatch[1];
          if (paymentStatusMatch && !order.payment_status) order.payment_status = paymentStatusMatch[1];
          if (emailMatch && !order.customer_email) order.customer_email = emailMatch[1];
          if (sellerMatch && !order.seller_name) order.seller_name = sellerMatch[1];
        }

        // Check if comments contains seller info (e.g. "Vendedor: Carlos")
        if (order.comments && !order.seller_name) {
          const vMatch = order.comments.match(/Vendedor:\s*([^.|,\n]+)/i);
          if (vMatch) {
            order.seller_name = vMatch[1].trim();
          }
        }
        
        if (!order.order_number) {
          order.order_number = array.length - index;
        }
        
        if (!order.payment_status) {
          order.payment_status = 'pendiente';
        }
        if (order.points === undefined || order.points === null) {
          order.points = 0;
        }
        
        return order as Order;
      });

      // Synchronize with local storage copy
      this.saveLocalOrders(parsedOrders);
      return parsedOrders;
    } catch (err) {
      console.warn("Exception fetching orders. Falling back to local storage:", err);
      return this.getLocalOrders();
    }
  },

  async updateOrder(id: string, updates: Partial<Order>): Promise<Order> {
    // 1. Update in local storage first
    const localOrders = this.getLocalOrders();
    const localIdx = localOrders.findIndex(o => o.id === id);
    let updatedLocalOrder: Order | null = null;
    if (localIdx !== -1) {
      localOrders[localIdx] = { ...localOrders[localIdx], ...updates };
      updatedLocalOrder = localOrders[localIdx];
      this.saveLocalOrders(localOrders);
    }

    if (!supabase) {
      if (updatedLocalOrder) return updatedLocalOrder;
      throw new Error('Supabase is not configured and order not found in local storage.');
    }
    
    const sanitizedUpdates: any = { ...updates };
    
    try {
      const { data, error } = await supabase.from('orders').update(sanitizedUpdates).eq('id', id).select();
      if (error) {
        if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('does not exist')) {
          const currentOrder = await dbService.getOrder(id);
          if (!currentOrder) throw new Error('Order not found to update');

          const mergedExtras = {
            payment_method: updates.payment_method !== undefined ? updates.payment_method : currentOrder.payment_method,
            payment_amount_with: updates.payment_amount_with !== undefined ? updates.payment_amount_with : currentOrder.payment_amount_with,
            comments: updates.comments !== undefined ? updates.comments : currentOrder.comments,
            payment_status: updates.payment_status !== undefined ? updates.payment_status : currentOrder.payment_status
          };

          const updatedAddress = rebuildAddressWithExtras(currentOrder.address_text || '', mergedExtras);

          const safeUpdates: any = {};
          if (updates.status !== undefined) safeUpdates.status = updates.status;
          safeUpdates.address_text = updatedAddress;
          
          const { data: safeData, error: safeError } = await supabase.from('orders').update(safeUpdates).eq('id', id).select();
          if (safeError) throw safeError;
          
          if (!safeData || safeData.length === 0) {
            if (updatedLocalOrder) return updatedLocalOrder;
            throw new Error('La base de datos Supabase rechazó la actualización.');
          }
          
          const returnedOrder = { ...safeData[0], ...updates } as Order;
          returnedOrder.payment_status = mergedExtras.payment_status || 'pendiente';
          returnedOrder.payment_method = mergedExtras.payment_method;
          returnedOrder.payment_amount_with = mergedExtras.payment_amount_with;
          returnedOrder.comments = mergedExtras.comments;

          if (localIdx !== -1) {
            localOrders[localIdx] = returnedOrder;
            this.saveLocalOrders(localOrders);
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('bellavista_orders_updated'));
          }
          return returnedOrder;
        }
        throw error;
      }
      
      if (!data || data.length === 0) {
        if (updatedLocalOrder) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('bellavista_orders_updated'));
          }
          return updatedLocalOrder;
        }
        throw new Error('La base de datos Supabase rechazó la actualización.');
      }
      
      const returnedOrder = data[0] as Order;
      if (localIdx !== -1) {
        localOrders[localIdx] = returnedOrder;
        this.saveLocalOrders(localOrders);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bellavista_orders_updated'));
      }
      return returnedOrder;
    } catch (err) {
      console.warn("Supabase update failed, but updated local copy:", err);
      if (updatedLocalOrder) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('bellavista_orders_updated'));
        }
        return updatedLocalOrder;
      }
      throw err;
    }
  },

  async getLatestBcvRate(): Promise<{ id: string; rate: number; created_at: string; created_by: string } | null> {
    if (!supabase) throw new Error('Supabase is not configured');
    const { data, error } = await supabase
      .from('bcv_rates')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('Error fetching latest BCV rate:', error);
      return null;
    }
    return data;
  },

  async updateBcvRate(rate: number, createdBy: string): Promise<any> {
    if (!supabase) throw new Error('Supabase is not configured');
    const newRate = {
      id: crypto.randomUUID(),
      rate: rate,
      created_by: createdBy || 'Sistema',
      created_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('bcv_rates').insert([newRate]).select();
    if (error) throw error;
    return data ? data[0] : null;
  },

  async getBcvRatesHistory(): Promise<any[]> {
    if (!supabase) throw new Error('Supabase is not configured');
    const { data, error } = await supabase
      .from('bcv_rates')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(15);
    if (error) {
      console.error('Error fetching BCV rates history:', error);
      return [];
    }
    return data || [];
  },

  async getBcvRateForDate(targetDateStr?: string, fallbackRate: number = 36.5): Promise<number> {
    if (!supabase) return fallbackRate;
    try {
      if (!targetDateStr) {
        const latest = await this.getLatestBcvRate();
        return latest && latest.rate ? Number(latest.rate) : fallbackRate;
      }
      const targetDate = new Date(targetDateStr);
      if (isNaN(targetDate.getTime())) {
        const latest = await this.getLatestBcvRate();
        return latest && latest.rate ? Number(latest.rate) : fallbackRate;
      }

      // 1. Try finding the rate recorded on or before the target timestamp
      const { data, error } = await supabase
        .from('bcv_rates')
        .select('*')
        .lte('created_at', targetDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0 && data[0].rate) {
        return Number(data[0].rate);
      }

      // 2. Try finding any rate recorded on the exact same day
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: sameDayData, error: sameDayErr } = await supabase
        .from('bcv_rates')
        .select('*')
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (!sameDayErr && sameDayData && sameDayData.length > 0 && sameDayData[0].rate) {
        return Number(sameDayData[0].rate);
      }

      // 3. Fallback to latest available rate
      const latest = await this.getLatestBcvRate();
      return latest && latest.rate ? Number(latest.rate) : fallbackRate;
    } catch (e) {
      console.warn('Error fetching BCV rate for date:', e);
      return fallbackRate;
    }
  },

  async getAllCurrencyRates(): Promise<any[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('currency_rates')
        .select('*');
      if (error) {
        // Fallback or retry using legacy bcv_rates for VES
        console.warn('Could not fetch currency_rates table, using fallbacks', error);
        return [];
      }
      return data || [];
    } catch (e) {
      console.error('Error getting currency rates:', e);
      return [];
    }
  },

  async updateCurrencyRate(code: string, rate: number, updatedBy: string): Promise<any> {
    if (!supabase) throw new Error('Supabase is not configured');
    
    // First, sync to bcv_rates legacy if code is VES
    if (code === 'VES') {
      try {
        await this.updateBcvRate(rate, updatedBy);
      } catch (err) {
        console.error('Failed to sync to legacy bcv_rates:', err);
      }
    }

    const { data, error } = await supabase
      .from('currency_rates')
      .upsert({
        code: code,
        rate: rate,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy || 'Sistema'
      }, { onConflict: 'code' })
      .select();

    if (error) {
      throw error;
    }
    return data ? data[0] : null;
  },

  async getInvoices(): Promise<any[]> {
    let apiInvoices: any[] = [];
    if (supabase) {
      try {
        let fetchedData: any[] | null = null;
        // 1. Try querying 'invoices' table
        try {
          const { data, error } = await supabase
            .from('invoices')
            .select('*')
            .order('created_at', { ascending: false });
          if (!error && data && data.length > 0) {
            fetchedData = data;
          } else if (error) {
            const retry = await supabase.from('invoices').select('*');
            if (!retry.error && retry.data && retry.data.length > 0) {
              fetchedData = retry.data;
            }
          }
        } catch (e) {
          console.warn('Error fetching from invoices table:', e);
        }

        // 2. Fallback to 'facturas' if empty
        if (!fetchedData || fetchedData.length === 0) {
          try {
            const { data: dFacturas, error: errFacturas } = await supabase.from('facturas').select('*');
            if (!errFacturas && dFacturas && dFacturas.length > 0) {
              fetchedData = dFacturas;
            }
          } catch (e) {
            // Ignore
          }
        }

        if (fetchedData && fetchedData.length > 0) {
          apiInvoices = fetchedData.map(inv => ({
            ...inv,
            id: inv.id || inv.control_number || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `inv-${Date.now()}`),
            control_number: inv.control_number || inv.numero || inv.invoice_number || `FAC-${inv.id}`,
            document_type: inv.document_type || (inv.control_number && inv.control_number.toString().startsWith('NE-') ? 'nota_entrega' : 'factura'),
            customer_name: inv.customer_name || inv.cliente || inv.nombre_cliente || 'Consumidor final',
            payment_method: inv.payment_method || inv.metodo_pago || 'Efectivo',
            subtotal: parseFloat(String(inv.subtotal ?? inv.total ?? 0)) || 0,
            iva: parseFloat(String(inv.iva ?? 0)) || 0,
            total: parseFloat(String(inv.total ?? inv.subtotal ?? 0)) || 0,
            items: parseInvoiceItems(inv.items),
            notes: inv.notes || inv.notas || '',
            created_at: inv.created_at || inv.fecha || new Date().toISOString()
          }));
        }
      } catch (e) {
        console.warn('Error in getInvoices (Supabase):', e);
      }
    }

    // Load from localStorage
    let localInvoices: any[] = [];
    try {
      const saved = localStorage.getItem('copias_bellavista_local_invoices');
      if (saved) {
        localInvoices = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading local invoices:', e);
    }

    // Merge both lists, avoiding duplicates by control_number or id
    const mergedMap = new Map<string, any>();
    localInvoices.forEach(inv => {
      const key = (inv.control_number || inv.id || '').toString().trim().toUpperCase();
      if (key) mergedMap.set(key, inv);
    });
    apiInvoices.forEach(inv => {
      const key = (inv.control_number || inv.id || '').toString().trim().toUpperCase();
      if (key) mergedMap.set(key, inv);
    });

    // 3. Scan cash operations (cash_ops) to recover any historical POS invoices that were registered in Cash but missing from table
    try {
      let cashOpsList: any[] = [];
      const savedOps = localStorage.getItem('copias_bellavista_cash_ops');
      if (savedOps) cashOpsList = JSON.parse(savedOps);

      cashOpsList.forEach((op: any) => {
        const concept = op.concept || '';
        // Match e.g. "Venta Flash - Factura FAC-1045 (Consumidor final)" or "Venta Flash - Nota de Entrega NE-1002 (Juan)"
        const match = concept.match(/(?:Factura|Nota de Entrega)\s+(FAC-\d+|NE-\d+|[A-Z0-9-]+)\s*(?:\((.*?)\))?/i);
        if (match) {
          const docCode = match[1].toUpperCase().trim();
          let clientName = match[2] ? match[2].trim() : 'Consumidor final';
          if (!mergedMap.has(docCode)) {
            const isNota = docCode.startsWith('NE-');
            const recoveredInvoice = {
              id: `recovered-${docCode}`,
              control_number: docCode,
              document_type: isNota ? 'nota_entrega' : 'factura',
              customer_name: clientName || 'Consumidor final',
              payment_method: op.payment_method || 'Efectivo',
              subtotal: parseFloat(String(op.amount || 0)) || 0,
              iva: 0,
              total: parseFloat(String(op.amount || 0)) || 0,
              items: [],
              notes: `${concept} (Sincronizado de arqueo de caja)`,
              created_at: op.created_at || new Date().toISOString()
            };
            mergedMap.set(docCode, recoveredInvoice);
          }
        }
      });
    } catch (recoverErr) {
      console.warn("Notice recovering invoices from cash ops:", recoverErr);
    }

    const resultList = Array.from(mergedMap.values()).map(inv => ({
      ...inv,
      items: parseInvoiceItems(inv.items)
    })).sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });

    // Keep localStorage cache completely in sync with the consolidated list
    try {
      localStorage.setItem('copias_bellavista_local_invoices', JSON.stringify(resultList));
    } catch (saveErr) {
      // Ignore
    }

    return resultList;
  },

  async createInvoice(invoice: any): Promise<any> {
    const docType = invoice.document_type || 'factura';

    // Generate strict consecutive control number based on MAX existing number
    let calculatedControlNumber = '';
    try {
      const allInvoices = await this.getInvoices();
      let cashOpsList: any[] = [];
      try {
        const savedOps = localStorage.getItem('copias_bellavista_cash_ops');
        if (savedOps) cashOpsList = JSON.parse(savedOps);
      } catch (e) {}

      let configuredBase = 1000;
      try {
        const sysCfg = localStorage.getItem('copias_bellavista_sys_config');
        if (sysCfg) {
          const parsed = JSON.parse(sysCfg);
          if (docType === 'nota_entrega') {
            configuredBase = Number(parsed.facturacionCorrelativoTicket || 1000);
          } else {
            configuredBase = Number(parsed.facturacionCorrelativoFactura || 1000);
          }
        }
      } catch (e) {}

      const foundNumbers: number[] = [configuredBase];

      if (docType === 'nota_entrega') {
        // Collect from invoices
        allInvoices.forEach(i => {
          const code = (i.control_number || '').toString().toUpperCase();
          const match = code.match(/NE-(\d+)/);
          if (match) foundNumbers.push(parseInt(match[1], 10));
        });
        // Collect from cash ops
        cashOpsList.forEach(op => {
          const match = (op.concept || '').match(/NE-(\d+)/i);
          if (match) foundNumbers.push(parseInt(match[1], 10));
        });

        const maxNum = Math.max(...foundNumbers, 1000);
        calculatedControlNumber = `NE-${maxNum + 1}`;
      } else {
        // Collect from invoices
        allInvoices.forEach(i => {
          const code = (i.control_number || '').toString().toUpperCase();
          const match = code.match(/FAC-(\d+)/);
          if (match) foundNumbers.push(parseInt(match[1], 10));
        });
        // Collect from cash ops
        cashOpsList.forEach(op => {
          const match = (op.concept || '').match(/FAC-(\d+)/i);
          if (match) foundNumbers.push(parseInt(match[1], 10));
        });

        const maxNum = Math.max(...foundNumbers, 1000);
        calculatedControlNumber = `FAC-${maxNum + 1}`;
      }
    } catch (e) {
      const prefix = docType === 'nota_entrega' ? 'NE' : 'FAC';
      calculatedControlNumber = `${prefix}-${Date.now().toString().slice(-4)}`;
    }

    const newInvoice = {
      id: invoice.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `local-inv-${Date.now()}-${Math.floor(Math.random() * 10000)}`),
      ...invoice,
      document_type: docType,
      control_number: invoice.control_number || calculatedControlNumber,
      created_at: invoice.created_at || new Date().toISOString()
    };

    let savedInvoice = newInvoice;

    // Immediately save locally to guarantee no data loss
    try {
      const saved = localStorage.getItem('copias_bellavista_local_invoices');
      const localInvoices = saved ? JSON.parse(saved) : [];
      const updatedLocals = [newInvoice, ...localInvoices.filter((i: any) => (i.control_number || i.id) !== (newInvoice.control_number || newInvoice.id))];
      localStorage.setItem('copias_bellavista_local_invoices', JSON.stringify(updatedLocals));
    } catch (localErr) {
      console.error("Failed to save invoice to localStorage:", localErr);
    }

    if (supabase) {
      try {
        let { data, error } = await supabase.from('invoices').insert([newInvoice]).select();
        
        // If column document_type doesn't exist in Supabase table yet, retry without document_type field
        if (error && (error.code === '42703' || error.message?.includes('document_type'))) {
          console.warn("Supabase column 'document_type' not found in invoices table. Retrying insert without column:", error);
          const { document_type, ...invoiceWithoutDocType } = newInvoice;
          const retryRes = await supabase.from('invoices').insert([invoiceWithoutDocType]).select();
          data = retryRes.data;
          error = retryRes.error;
        }

        if (!error && data && data[0]) {
          savedInvoice = { ...newInvoice, ...data[0] };
        } else {
          console.warn("Supabase insert invoice notice:", error);
        }
      } catch (e) {
        console.warn("Supabase insert invoice exception:", e);
      }
    }

    // Sync client from invoice
    try {
      await this.syncClientFromOrder(newInvoice.customer_name, '');
    } catch (syncErr) {
      console.error("Error syncing client from invoice:", syncErr);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bellavista_invoices_updated'));
      window.dispatchEvent(new CustomEvent('bellavista_orders_updated'));
      window.dispatchEvent(new CustomEvent('bellavista_cash_updated'));
    }

    return savedInvoice;
  },

  async getDraftInvoices(): Promise<any[]> {
    let apiDrafts: any[] = [];
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('draft_invoices')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) {
          apiDrafts = data;
        } else {
          console.warn('Error fetching draft invoices from Supabase:', error);
        }
      } catch (e) {
        console.warn('Error in getDraftInvoices (Supabase):', e);
      }
    }

    // Load from localStorage
    let localDrafts: any[] = [];
    try {
      const saved = localStorage.getItem('copias_bellavista_local_drafts');
      if (saved) {
        localDrafts = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading local drafts:', e);
    }

    // Merge both
    const mergedMap = new Map<string, any>();
    localDrafts.forEach(d => {
      mergedMap.set(d.id, d);
    });
    apiDrafts.forEach(d => {
      mergedMap.set(d.id, d);
    });

    // Filter out blacklisted/deleted drafts
    let allDrafts = Array.from(mergedMap.values()).map(d => ({
      ...d,
      items: parseInvoiceItems(d.items)
    }));
    try {
      const deletedSaved = localStorage.getItem('copias_bellavista_deleted_drafts');
      if (deletedSaved) {
        const deletedIds = JSON.parse(deletedSaved);
        if (Array.isArray(deletedIds)) {
          allDrafts = allDrafts.filter(d => !deletedIds.includes(d.id));
        }
      }
    } catch (e) {
      console.error("Error filtering deleted drafts:", e);
    }

    return allDrafts.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });
  },

  async createDraftInvoice(draft: any): Promise<any> {
    const newDraft = {
      id: draft.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `local-draft-${Math.floor(Math.random() * 1000000)}`),
      ...draft,
      created_at: new Date().toISOString()
    };

    let savedDraft = newDraft;

    if (supabase) {
      try {
        const { data, error } = await supabase.from('draft_invoices').insert([newDraft]).select();
        if (!error && data && data[0]) {
          savedDraft = data[0];
        } else {
          console.warn("Supabase insert draft invoice failed. Saving to localStorage fallback:", error);
          const saved = localStorage.getItem('copias_bellavista_local_drafts');
          const localDrafts = saved ? JSON.parse(saved) : [];
          localDrafts.push(newDraft);
          localStorage.setItem('copias_bellavista_local_drafts', JSON.stringify(localDrafts));
        }
      } catch (e) {
        console.warn("Supabase insert draft error. Saving to localStorage fallback:", e);
        try {
          const saved = localStorage.getItem('copias_bellavista_local_drafts');
          const localDrafts = saved ? JSON.parse(saved) : [];
          localDrafts.push(newDraft);
          localStorage.setItem('copias_bellavista_local_drafts', JSON.stringify(localDrafts));
        } catch (localErr) {
          console.error("Failed to save draft to localStorage:", localErr);
        }
      }
    } else {
      try {
        const saved = localStorage.getItem('copias_bellavista_local_drafts');
        const localDrafts = saved ? JSON.parse(saved) : [];
        localDrafts.push(newDraft);
        localStorage.setItem('copias_bellavista_local_drafts', JSON.stringify(localDrafts));
      } catch (localErr) {
        console.error("Failed to save draft to localStorage:", localErr);
      }
    }

    // Remove from blacklist if recreating or updating
    try {
      const deletedSaved = localStorage.getItem('copias_bellavista_deleted_drafts');
      if (deletedSaved) {
        let deletedIds = JSON.parse(deletedSaved);
        if (Array.isArray(deletedIds) && deletedIds.includes(newDraft.id)) {
          deletedIds = deletedIds.filter(id => id !== newDraft.id);
          localStorage.setItem('copias_bellavista_deleted_drafts', JSON.stringify(deletedIds));
        }
      }
    } catch (e) {
      console.error("Failed to clean blacklist during draft creation:", e);
    }

    return savedDraft;
  },

  async deleteDraftInvoice(id: string): Promise<boolean> {
    // 1. Add to local blacklist to hide instantly and permanently
    try {
      const deletedSaved = localStorage.getItem('copias_bellavista_deleted_drafts');
      const deletedIds = deletedSaved ? JSON.parse(deletedSaved) : [];
      if (!deletedIds.includes(id)) {
        deletedIds.push(id);
        localStorage.setItem('copias_bellavista_deleted_drafts', JSON.stringify(deletedIds));
      }
    } catch (e) {
      console.error("Failed to save deleted draft to blacklist:", e);
    }

    // 2. Try deleting from Supabase
    if (supabase && id && !String(id).startsWith('local-')) {
      try {
        const { error } = await supabase.from('draft_invoices').delete().eq('id', id);
        if (error) {
          console.warn("Supabase delete draft failed (likely RLS). Relying on blacklist fallback:", error);
        }
      } catch (e) {
        console.warn("Supabase delete draft error. Relying on blacklist fallback:", e);
      }
    }

    // 3. Try deleting from local storage drafts list
    try {
      const saved = localStorage.getItem('copias_bellavista_local_drafts');
      if (saved) {
        let localDrafts = JSON.parse(saved);
        localDrafts = localDrafts.filter((d: any) => d.id !== id);
        localStorage.setItem('copias_bellavista_local_drafts', JSON.stringify(localDrafts));
      }
    } catch (e) {
      console.error("Failed to delete draft from localStorage:", e);
    }
    return true;
  },

  async getClients(): Promise<any[]> {
    let apiClients: any[] = [];
    if (supabase) {
      try {
        let fetchedData: any[] | null = null;

        // 1. Try querying 'clients' table with order
        try {
          const { data, error } = await supabase
            .from('clients')
            .select('*')
            .order('created_at', { ascending: false });
          if (!error && data && data.length > 0) {
            fetchedData = data;
          } else if (error) {
            // Retry without order in case created_at column does not exist
            const retry = await supabase.from('clients').select('*');
            if (!retry.error && retry.data && retry.data.length > 0) {
              fetchedData = retry.data;
            }
          }
        } catch (e) {
          console.warn('Error fetching from clients table:', e);
        }

        // 2. If 'clients' table yielded no records or failed, try 'clientes'
        if (!fetchedData || fetchedData.length === 0) {
          try {
            const { data: dClientes, error: errClientes } = await supabase.from('clientes').select('*');
            if (!errClientes && dClientes && dClientes.length > 0) {
              fetchedData = dClientes;
            }
          } catch (e) {
            // Ignore
          }
        }

        // 3. If still empty, try 'customers'
        if (!fetchedData || fetchedData.length === 0) {
          try {
            const { data: dCustomers, error: errCustomers } = await supabase.from('customers').select('*');
            if (!errCustomers && dCustomers && dCustomers.length > 0) {
              fetchedData = dCustomers;
            }
          } catch (e) {
            // Ignore
          }
        }

        if (fetchedData && fetchedData.length > 0) {
          apiClients = fetchedData.map(c => {
            let phone = c.phone || c.telefono || '';
            let email = c.email || c.correo || '';
            if (phone.includes(' | email:')) {
              const parts = phone.split(' | email:');
              phone = parts[0].trim();
              if (!email) email = parts[1].trim();
            }
            return {
              ...c,
              id: c.id,
              name: c.name || c.nombre || c.razon_social || c.cliente || 'Cliente',
              document: c.document || c.documento || c.cedula || c.rif || '',
              phone,
              email: email ? email.trim().toLowerCase() : '',
              correo: email ? email.trim().toLowerCase() : '',
              code: c.code || c.codigo || '',
              type: c.type || c.tipo || 'Natural',
              credit_usd: Number(c.credit_usd ?? c.credito ?? c.saldo ?? 0),
              created_at: c.created_at || c.fecha || new Date().toISOString()
            };
          });
        }

        // 4. Also merge any users registered with role 'Cliente' from store_users
        try {
          const { data: suData } = await supabase.from('store_users').select('*').ilike('role', 'Cliente');
          if (suData && suData.length > 0) {
            suData.forEach(u => {
              const uEmail = (u.email || u.correo || '').trim().toLowerCase();
              const uDoc = u.document || u.documento || u.cedula || u.rif || '';
              const alreadyExists = apiClients.some(existing => 
                (u.id && existing.id === u.id) ||
                (uDoc && existing.document && existing.document.toLowerCase() === uDoc.toLowerCase()) ||
                (uEmail && (existing.email === uEmail || existing.correo === uEmail))
              );
              if (!alreadyExists) {
                apiClients.push({
                  id: u.id,
                  name: u.name || u.nombre || 'Cliente',
                  document: uDoc,
                  doc_type: u.doc_type || 'V',
                  doc_number: u.doc_number || uDoc,
                  phone: u.phone || u.telefono || '',
                  email: uEmail,
                  correo: uEmail,
                  code: u.client_code || u.code || '',
                  type: (u.doc_type === 'J' || u.doc_type === 'G') ? 'Jurídico' : 'Natural',
                  credit_usd: Number(u.credit_usd || 0),
                  created_at: u.created_at || new Date().toISOString(),
                  is_active: u.is_active !== false
                });
              }
            });
          }
        } catch (e) {
          console.warn('Store users client query warning:', e);
        }
      } catch (e) {
        console.warn('Error fetching clients from Supabase:', e);
      }
    }

    // Load from localStorage
    let localClients: any[] = [];
    try {
      const saved = localStorage.getItem('copias_bellavista_local_clients');
      if (saved) {
        localClients = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading local clients:', e);
    }

    // Merge both lists, avoiding duplicates by document or code
    const mergedMap = new Map<string, any>();
    localClients.forEach(c => {
      mergedMap.set(c.id || c.document || c.code, c);
    });
    apiClients.forEach(c => {
      mergedMap.set(c.id || c.document || c.code, c);
    });

    return Array.from(mergedMap.values()).map(c => {
      let phone = c.phone || '';
      let email = c.email || c.correo || '';
      if (phone.includes(' | email:')) {
        const parts = phone.split(' | email:');
        phone = parts[0].trim();
        email = parts[1].trim();
      }

      const cleanEmail = (email || '').trim().toLowerCase();

      let docType = c.doc_type || c.tipo_documento || '';
      let docNumber = c.doc_number || c.documento || '';
      let docStr = c.document || c.rif || '';

      if (!docStr) {
        if (docType && docNumber) {
          docStr = `${docType}-${docNumber}`;
        } else if (docNumber) {
          docStr = docNumber;
        }
      }

      if (docStr && (!docType || !docNumber)) {
        if (docStr.includes('-')) {
          const parts = docStr.split('-');
          if (!docType) docType = parts[0].toUpperCase();
          if (!docNumber) docNumber = parts.slice(1).join('-');
        } else {
          const match = docStr.match(/^([a-zA-Z])[-_\s]?(.*)$/);
          if (match && match[2]) {
            if (!docType) docType = match[1].toUpperCase();
            if (!docNumber) docNumber = match[2];
          } else {
            if (!docType) docType = 'V';
            if (!docNumber) docNumber = docStr;
          }
        }
      }

      if (!docStr && (docType || docNumber)) {
        docStr = `${docType || 'V'}-${docNumber || ''}`;
      }

      return {
        ...c,
        phone,
        email: cleanEmail,
        correo: cleanEmail,
        document: docStr,
        doc_type: docType || 'V',
        doc_number: docNumber,
        tipo_documento: docType || 'V',
        documento: docNumber,
        rif: docStr
      };
    }).sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });
  },

  async createClient(client: any): Promise<any> {
    // Generate sequential code
    let calculatedCode = client.code;
    if (!calculatedCode) {
      try {
        const allClients = await this.getClients();
        calculatedCode = `CLI-${1001 + allClients.length}`;
      } catch (e) {
        calculatedCode = `CLI-${Math.floor(Math.random() * 90000) + 10000}`;
      }
    }

    const phoneWithEmail = client.email 
      ? `${client.phone || ''} | email:${client.email}` 
      : (client.phone || '');

    let docType = client.doc_type || client.tipo_documento || '';
    let docNumber = client.doc_number || client.documento || '';
    let docStr = client.document || client.rif || '';

    if (!docStr && docNumber) {
      docStr = `${docType || 'V'}-${docNumber}`;
    } else if (docStr && (!docType || !docNumber)) {
      if (docStr.includes('-')) {
        const parts = docStr.split('-');
        docType = parts[0].toUpperCase();
        docNumber = parts.slice(1).join('-');
      } else {
        const match = docStr.match(/^([a-zA-Z])[-_\s]?(.*)$/);
        if (match && match[2]) {
          docType = match[1].toUpperCase();
          docNumber = match[2];
        } else {
          docType = 'V';
          docNumber = docStr;
        }
      }
    }

    const cleanClientEmail = (client.email || client.correo || '').trim().toLowerCase();

    const newClient = {
      id: client.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `local-${Math.floor(Math.random() * 1000000)}`),
      name: client.name,
      document: docStr,
      doc_type: docType || 'V',
      doc_number: docNumber,
      tipo_documento: docType || 'V',
      documento: docNumber,
      type: client.type || (docType === 'J' || docType === 'G' ? 'Jurídico' : 'Natural'),
      phone: phoneWithEmail,
      email: cleanClientEmail,
      correo: cleanClientEmail,
      password: client.password || '',
      credit_usd: client.credit_usd || 0,
      code: calculatedCode,
      is_active: client.is_active !== false,
      created_at: new Date().toISOString()
    };

    if (supabase) {
      try {
        const { data, error } = await supabase.from('clients').insert([newClient]).select();
        if (!error && data && data[0]) {
          let p = data[0].phone || '';
          let em = '';
          if (p.includes(' | email:')) {
            const pts = p.split(' | email:');
            p = pts[0];
            em = pts[1];
          }
          return { ...data[0], phone: p, email: em };
        } else {
          console.warn("Supabase insert client failed (likely RLS). Saving to localStorage fallback:", error);
        }
      } catch (e) {
        console.warn("Supabase insert client error. Saving to localStorage fallback:", e);
      }
    }

    // Save to localStorage as fallback
    try {
      const saved = localStorage.getItem('copias_bellavista_local_clients');
      const localClients = saved ? JSON.parse(saved) : [];
      localClients.push(newClient);
      localStorage.setItem('copias_bellavista_local_clients', JSON.stringify(localClients));
    } catch (e) {
      console.error("Failed to save client to localStorage:", e);
    }

    let p = newClient.phone || '';
    let em = '';
    if (p.includes(' | email:')) {
      const pts = p.split(' | email:');
      p = pts[0];
      em = pts[1];
    }
    return { ...newClient, phone: p, email: em };
  },

  async updateClient(id: string, updates: any): Promise<any> {
    const updatedPayload = { ...updates };
    if ('email' in updates || 'phone' in updates) {
      const phone = 'phone' in updates ? updates.phone : '';
      const email = 'email' in updates ? updates.email : '';
      updatedPayload.phone = email ? `${phone} | email:${email}` : phone;
      delete updatedPayload.email;
    }

    if (supabase && id && !String(id).startsWith('local-')) {
      try {
        const { data, error } = await supabase
          .from('clients')
          .update(updatedPayload)
          .eq('id', id)
          .select();
        if (!error && data && data[0]) {
          let p = data[0].phone || '';
          let em = '';
          if (p.includes(' | email:')) {
            const pts = p.split(' | email:');
            p = pts[0];
            em = pts[1];
          }
          return { ...data[0], phone: p, email: em };
        }
      } catch (e) {
        console.warn("Supabase update client error. Updating local copy instead:", e);
      }
    }

    // Update in local storage
    try {
      const saved = localStorage.getItem('copias_bellavista_local_clients');
      if (saved) {
        let localClients = JSON.parse(saved);
        localClients = localClients.map((c: any) => {
          if (c.id === id) {
            return { ...c, ...updatedPayload };
          }
          return c;
        });
        localStorage.setItem('copias_bellavista_local_clients', JSON.stringify(localClients));
        
        const found = localClients.find((c: any) => c.id === id);
        if (found) {
          let p = found.phone || '';
          let em = '';
          if (p.includes(' | email:')) {
            const pts = p.split(' | email:');
            p = pts[0];
            em = pts[1];
          }
          return { ...found, phone: p, email: em };
        }
      }
    } catch (e) {
      console.error("Failed to update client in localStorage:", e);
    }

    return null;
  },

  async deleteClient(id: string): Promise<boolean> {
    if (supabase && id && !String(id).startsWith('local-')) {
      try {
        const { error } = await supabase.from('clients').delete().eq('id', id);
        if (!error) return true;
      } catch (e) {
        console.warn("Supabase delete client failed. Deleting from local copy:", e);
      }
    }

    try {
      const saved = localStorage.getItem('copias_bellavista_local_clients');
      if (saved) {
        let localClients = JSON.parse(saved);
        localClients = localClients.filter((c: any) => c.id !== id);
        localStorage.setItem('copias_bellavista_local_clients', JSON.stringify(localClients));
      }
    } catch (e) {
      console.error("Failed to delete client from localStorage:", e);
    }
    return true;
  },

  // --- CASH REGISTER (CAJA) OPERATIONS ---
  async getCashSessions(): Promise<any[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('cash_sessions').select('*').order('created_at', { ascending: false });
        if (!error && data) {
          localStorage.setItem('copias_bellavista_cash_sessions', JSON.stringify(data));
          return data;
        } else {
          console.warn("Notice fetching cash_sessions from Supabase, loading localStorage:", error);
        }
      } catch (err) {
        console.warn("Exception fetching cash_sessions, loading localStorage:", err);
      }
    }
    try {
      const saved = localStorage.getItem('copias_bellavista_cash_sessions');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Error reading cash sessions:", e);
    }
    // Seed default session matching Image 1
    const defaultSessions = [
      {
        id: "seed-session-1",
        apertura: "20/7/2026, 12:26:48 a. m.",
        cierre: "20/7/2026, 08:00:00 p. m.",
        apertura_bs: 10.00,
        cierre_bs: 10.00,
        diferencia_bs: 0,
        estado: "cerrada",
        apertura_usd: 0.22,
        cierre_usd: 0.22,
        observaciones: "Fondo inicial de apertura"
      }
    ];
    localStorage.setItem('copias_bellavista_cash_sessions', JSON.stringify(defaultSessions));
    return defaultSessions;
  },

  async createCashSession(session: any): Promise<any> {
    const newSession = {
      id: crypto.randomUUID(),
      empleado_nombre: session.empleado_nombre || session.user_name || 'Cajero de Turno',
      empleado_id: session.empleado_id || null,
      apertura: new Date().toLocaleString('es-VE'),
      cierre: '—',
      apertura_bs: session.apertura_bs || 0,
      cierre_bs: null,
      esperado_bs: session.apertura_bs || 0,
      esperado_usd: session.apertura_usd || 0,
      diferencia_bs: null,
      estado: 'abierta',
      estado_arqueo: null,
      apertura_usd: session.apertura_usd || 0,
      cierre_usd: null,
      observaciones: session.observaciones || '',
      created_at: new Date().toISOString()
    };

    // Save to local storage first for resilience
    try {
      const sessions = await this.getCashSessions();
      // Mark any other open sessions as closed just in case
      const updatedSessions = sessions.map(s => s.estado === 'abierta' ? { ...s, estado: 'cerrada', cierre: new Date().toLocaleString('es-VE') } : s);
      updatedSessions.unshift(newSession);
      localStorage.setItem('copias_bellavista_cash_sessions', JSON.stringify(updatedSessions));
    } catch (e) {
      console.error("Error saving cash session locally:", e);
    }

    if (supabase) {
      try {
        // Also update open sessions in Supabase if any to closed
        await supabase.from('cash_sessions').update({ estado: 'cerrada', cierre: new Date().toLocaleString('es-VE') }).eq('estado', 'abierta');
        const { data, error } = await supabase.from('cash_sessions').insert([newSession]).select();
        if (!error && data && data[0]) {
          return data[0];
        } else {
          console.warn("Failed to create cash_session in Supabase, trying core payload fallback:", error);
          if (error && (error.code === '42703' || String(error.message).includes('column') || String(error.message).includes('does not exist'))) {
            const corePayload = {
              id: newSession.id,
              apertura: newSession.apertura,
              cierre: newSession.cierre,
              apertura_bs: newSession.apertura_bs,
              cierre_bs: newSession.cierre_bs,
              diferencia_bs: newSession.diferencia_bs,
              estado: newSession.estado,
              apertura_usd: newSession.apertura_usd,
              cierre_usd: newSession.cierre_usd,
              esperado_bs: newSession.esperado_bs,
              esperado_usd: newSession.esperado_usd,
              observaciones: newSession.observaciones,
              created_at: newSession.created_at
            };
            const { data: retryData, error: retryError } = await supabase.from('cash_sessions').insert([corePayload]).select();
            if (!retryError && retryData && retryData[0]) {
              return { ...newSession, ...retryData[0] };
            } else {
              console.warn("Failed retry with core payload cash_session:", retryError);
            }
          }
        }
      } catch (err) {
        console.warn("Exception creating cash_session in Supabase:", err);
      }
    }
    return newSession;
  },

  async updateCashSession(id: string, updates: any): Promise<any> {
    let localResult: any = null;
    try {
      const sessions = await this.getCashSessions();
      const updatedSessions = sessions.map(s => {
        if (s.id === id) {
          const u = { ...s, ...updates };
          localResult = u;
          return u;
        }
        return s;
      });
      localStorage.setItem('copias_bellavista_cash_sessions', JSON.stringify(updatedSessions));
    } catch (e) {
      console.error("Error updating cash session locally:", e);
    }

    if (supabase) {
      try {
        const { data, error } = await supabase.from('cash_sessions').update(updates).eq('id', id).select();
        if (!error && data && data[0]) {
          return data[0];
        } else {
          console.warn("Failed to update cash_session in Supabase, trying core payload fallback:", error);
          if (error && (error.code === '42703' || String(error.message).includes('column') || String(error.message).includes('does not exist'))) {
            // Remove non-standard keys
            const coreUpdates: any = { ...updates };
            delete coreUpdates.empleado_nombre;
            delete coreUpdates.empleado_id;
            delete coreUpdates.estado_arqueo;

            const { data: retryData, error: retryError } = await supabase.from('cash_sessions').update(coreUpdates).eq('id', id).select();
            if (!retryError && retryData && retryData[0]) {
              return { ...localResult, ...retryData[0] };
            } else {
              console.warn("Failed retry with core updates cash_session:", retryError);
            }
          }
        }
      } catch (err) {
        console.warn("Exception updating cash_session in Supabase:", err);
      }
    }
    return localResult || { id, ...updates };
  },

  async getActiveCashSession(): Promise<any | null> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('cash_sessions').select('*').eq('estado', 'abierta').order('created_at', { ascending: false }).limit(1);
        if (!error && data && data.length > 0) {
          return data[0];
        }
      } catch (err) {
        console.warn("Exception fetching active cash session from Supabase:", err);
      }
    }
    const sessions = await this.getCashSessions();
    return sessions.find(s => s.estado === 'abierta') || null;
  },

  async getCashOps(): Promise<any[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('cash_ops').select('*').order('created_at', { ascending: false });
        if (!error && data) {
          const parsed = data.map((op: any) => ({
            ...op,
            amount: parseFloat(String(op.amount)) || 0,
            amount_bs: parseFloat(String(op.amount_bs)) || 0,
            created_at: op.created_at || new Date().toISOString()
          }));
          localStorage.setItem('copias_bellavista_cash_ops', JSON.stringify(parsed));
          return parsed;
        } else {
          console.warn("Notice fetching cash_ops from Supabase, loading localStorage:", error);
        }
      } catch (err) {
        console.warn("Exception fetching cash_ops from Supabase, loading localStorage:", err);
      }
    }
    try {
      const saved = localStorage.getItem('copias_bellavista_cash_ops');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Error reading cash operations:", e);
    }
    // Seed default operations corresponding to the open seed session
    const defaultOps = [
      { id: "1", type: "ingreso", concept: "Apertura de Caja - Fondo Inicial", amount: 0.22, amount_bs: 10.00, time: "12:26 a. m.", session_id: "seed-session-1", created_at: "2026-07-20T00:26:48.000Z" }
    ];
    localStorage.setItem('copias_bellavista_cash_ops', JSON.stringify(defaultOps));
    return defaultOps;
  },

  async addCashOp(op: any): Promise<any> {
    const activeSession = await this.getActiveCashSession();
    const newOp = {
      id: crypto.randomUUID(),
      type: op.type, // 'ingreso' | 'egreso'
      concept: op.concept,
      amount: op.amount || 0, // in USD
      amount_bs: op.amount_bs || 0, // in Bs
      amount_eur: op.amount_eur || 0,
      amount_cop: op.amount_cop || 0,
      currency_code: op.currency_code || 'USD',
      currency_rates_snapshot: op.currency_rates_snapshot || null,
      split_payments: op.split_payments || null,
      time: op.time || new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true }),
      session_id: op.session_id || (activeSession ? activeSession.id : null),
      empleado_nombre: op.empleado_nombre || op.user_name || (activeSession ? activeSession.empleado_nombre : null) || 'Cajero',
      payment_method: op.payment_method || null,
      category: op.category || null,
      observation: op.observation || op.notes || null,
      created_at: op.created_at || new Date().toISOString()
    };

    // Save locally first
    try {
      const ops = await this.getCashOps();
      const updated = [newOp, ...ops.filter((existing: any) => existing.id !== newOp.id)];
      localStorage.setItem('copias_bellavista_cash_ops', JSON.stringify(updated));
    } catch (e) {
      console.error("Error adding cash operation locally:", e);
    }

    if (supabase) {
      try {
        const { data, error } = await supabase.from('cash_ops').insert([newOp]).select();
        if (error) {
          console.warn("Notice adding cash_op in Supabase, trying core payload fallback:", error.message);
          const corePayload = {
            id: newOp.id,
            type: newOp.type,
            concept: newOp.concept,
            amount: newOp.amount,
            amount_bs: newOp.amount_bs,
            time: newOp.time,
            session_id: newOp.session_id,
            payment_method: newOp.payment_method,
            created_at: newOp.created_at
          };
          const { data: fbData } = await supabase.from('cash_ops').insert([corePayload]).select();
          if (fbData && fbData[0]) {
            window.dispatchEvent(new CustomEvent('bellavista_cash_updated'));
            return { ...newOp, ...fbData[0] };
          }
        } else if (data && data[0]) {
          window.dispatchEvent(new CustomEvent('bellavista_cash_updated'));
          return data[0];
        }
      } catch (err) {
        console.warn("Exception adding cash_op in Supabase:", err);
      }
    }

    window.dispatchEvent(new CustomEvent('bellavista_cash_updated'));
    return newOp;
  },

  async deleteCashOp(id: string): Promise<boolean> {
    try {
      const ops = await this.getCashOps();
      const updatedOps = ops.filter((op: any) => op.id !== id);
      localStorage.setItem('copias_bellavista_cash_ops', JSON.stringify(updatedOps));
    } catch (e) {
      console.error("Error deleting cash operation locally:", e);
    }

    if (supabase) {
      try {
        const { error } = await supabase.from('cash_ops').delete().eq('id', id);
        if (error) {
          console.warn("Failed to delete cash_op from Supabase:", error);
        }
      } catch (err) {
        console.warn("Exception deleting cash_op in Supabase:", err);
      }
    }
    window.dispatchEvent(new CustomEvent('bellavista_cash_updated'));
    return true;
  },

  async syncClientFromOrder(customerName: string, phoneNumber: string, email: string = ''): Promise<any> {
    try {
      const cleanName = (customerName || '').trim();
      const cleanPhone = (phoneNumber || '').trim();
      const cleanEmail = (email || '').trim();
      if (!cleanName || cleanName === 'Consumidor final') return null;

      // Fetch all clients (from both Supabase and localStorage) to find matches
      const allClients = await this.getClients();
      
      // Look for match by exact/similar name or phone
      const existing = allClients.find(c => 
        (c.name && c.name.toLowerCase().includes(cleanName.toLowerCase())) || 
        (c.phone && c.phone === cleanPhone)
      );

      if (existing) {
        // Update client phone/email if changed
        let currentPhone = existing.phone || '';
        let currentEmail = existing.email || '';
        
        const finalEmail = cleanEmail || currentEmail;
        const finalPhone = cleanPhone || currentPhone;
        
        if (currentPhone !== finalPhone || currentEmail !== finalEmail) {
          await this.updateClient(existing.id, {
            phone: finalPhone,
            email: finalEmail
          });
        }
        return existing;
      }

      // Create new client
      const randomDocNum = Math.floor(Math.random() * 25000000) + 5000000;
      const nextCode = `CLI-${1001 + allClients.length}`;

      const newClient = {
        name: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        document: `V-${randomDocNum}`,
        type: 'Natural',
        credit_usd: 0,
        code: nextCode
      };

      return await this.createClient(newClient);
    } catch (e) {
      console.error('Error in syncClientFromOrder:', e);
      return null;
    }
  },

  // --- MARKETING OPERATIONS ---
  async getDiscountCodes(): Promise<DiscountCode[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase.from('discount_codes').select('*').order('created_at', { ascending: false });
      if (error) {
        console.warn('Could not fetch discount codes. Table might not exist yet.', error.message);
        return [];
      }
      return data as DiscountCode[];
    } catch (err) {
      return [];
    }
  }

, async saveDiscountCode(code: Partial<DiscountCode>): Promise<DiscountCode> {
    if (!supabase) throw new Error("No supabase instance");
    
    if (code.id) {
      const { data, error } = await supabase.from('discount_codes').update(code).eq('id', code.id).select().single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase.from('discount_codes').insert(code).select().single();
      if (error) throw error;
      return data;
    }
  }

, async deleteDiscountCode(id: string): Promise<void> {
    if (!supabase) throw new Error("No supabase instance");
    const { error } = await supabase.from('discount_codes').delete().eq('id', id);
    if (error) throw error;
  }

, async getLoyaltySettings(): Promise<LoyaltySettings | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.from('loyalty_settings').select('*').limit(1).single();
      if (error) {
        console.warn('Could not fetch loyalty settings. Table might not exist yet.', error.message);
        return null;
      }
      return data as LoyaltySettings;
    } catch (err) {
      return null;
    }
  }

, async saveLoyaltySettings(settings: Partial<LoyaltySettings>): Promise<LoyaltySettings> {
    if (!supabase) throw new Error("No supabase instance");
    
    if (settings.id) {
      const { data, error } = await supabase.from('loyalty_settings').update(settings).eq('id', settings.id).select().single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase.from('loyalty_settings').insert(settings).select().single();
      if (error) throw error;
      return data;
    }
  }

, async getLoyaltyRewards(): Promise<LoyaltyReward[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase.from('loyalty_rewards').select('*').order('points_cost', { ascending: true });
      if (error) return [];
      return data as LoyaltyReward[];
    } catch (err) {
      return [];
    }
  }

, async saveLoyaltyReward(reward: Partial<LoyaltyReward>): Promise<LoyaltyReward> {
    if (!supabase) throw new Error("No supabase instance");
    
    if (reward.id) {
      const { data, error } = await supabase.from('loyalty_rewards').update(reward).eq('id', reward.id).select().single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase.from('loyalty_rewards').insert(reward).select().single();
      if (error) throw error;
      return data;
    }
  }

, async deleteLoyaltyReward(id: string): Promise<void> {
    if (!supabase) throw new Error("No supabase instance");
    const { error } = await supabase.from('loyalty_rewards').delete().eq('id', id);
    if (error) throw error;
  }
  
, async getCustomerPoints(phoneNumber: string): Promise<number> {
    if (!supabase) return 0;
    try {
      const { data, error } = await supabase.from('customer_points').select('points').eq('phone_number', phoneNumber).single();
      if (error) return 0;
      return data?.points || 0;
    } catch (err) {
      return 0;
    }
  }

, async addCustomerPoints(phoneNumber: string, pointsToAdd: number): Promise<void> {
    if (!supabase) return;
    try {
      const { data: existing } = await supabase.from('customer_points').select('*').eq('phone_number', phoneNumber).single();
      if (existing) {
        await supabase.from('customer_points').update({ points: existing.points + pointsToAdd }).eq('phone_number', phoneNumber);
      } else {
        await supabase.from('customer_points').insert({ phone_number: phoneNumber, points: pointsToAdd });
      }
    } catch (e) {
      console.warn('Could not add points', e);
    }
  }

, async subtractCustomerPoints(phoneNumber: string, pointsToSubtract: number): Promise<void> {
    if (!supabase) return;
    try {
      const { data: existing } = await supabase.from('customer_points').select('*').eq('phone_number', phoneNumber).single();
      if (existing && existing.points >= pointsToSubtract) {
        await supabase.from('customer_points').update({ points: existing.points - pointsToSubtract }).eq('phone_number', phoneNumber);
      }
    } catch (e) {
      console.warn('Could not subtract points', e);
    }
  }

  // --- WISHLIST OPERATIONS (REAL SUPABASE + LOCALSTORAGE FALLBACK) ---
  , async getWishlist(email: string): Promise<WishlistItem[]> {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) return [];

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('wishlist')
          .select('*')
          .eq('user_email', cleanEmail);
        if (!error && data) {
          const list = data as WishlistItem[];
          return list.filter((item: any) => 
            item && 
            item.product_id && 
            typeof item.product_id === 'string' && 
            item.product_id !== '[object Object]' &&
            item.product_id.trim() !== ''
          );
        }
      } catch (e) {
        console.warn("Could not query wishlist from Supabase, falling back to LocalStorage:", e);
      }
    }

    try {
      const saved = localStorage.getItem('copias_bellavista_wishlist');
      if (saved) {
        const list = JSON.parse(saved);
        return list.filter((item: any) => 
          item &&
          (item.user_email || '').toLowerCase() === cleanEmail &&
          item.product_id &&
          typeof item.product_id === 'string' &&
          item.product_id !== '[object Object]' &&
          item.product_id.trim() !== ''
        );
      }
    } catch (e) {
      console.warn('Error reading wishlist from localStorage:', e);
    }
    return [];
  }

  , async addToWishlist(email: string, productId: string): Promise<boolean> {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !productId) return false;

    const newItem: WishlistItem = {
      id: crypto.randomUUID(),
      user_email: cleanEmail,
      product_id: productId,
      created_at: new Date().toISOString()
    };

    let savedLocally = false;
    try {
      const saved = localStorage.getItem('copias_bellavista_wishlist');
      const list = saved ? JSON.parse(saved) : [];
      if (!list.some((item: any) => (item.user_email || '').toLowerCase() === cleanEmail && item.product_id === productId)) {
        list.push(newItem);
        localStorage.setItem('copias_bellavista_wishlist', JSON.stringify(list));
      }
      savedLocally = true;
    } catch (e) {
      console.warn("Error updating wishlist in localStorage:", e);
    }

    if (supabase) {
      try {
        const { data: existing } = await supabase
          .from('wishlist')
          .select('id')
          .eq('user_email', cleanEmail)
          .eq('product_id', productId)
          .maybeSingle();

        if (!existing) {
          await supabase.from('wishlist').insert([newItem]);
        }
        return true;
      } catch (e) {
        console.warn("Could not insert wishlist item into Supabase, used local storage fallback:", e);
      }
    }

    return savedLocally;
  }

  , async removeFromWishlist(email: string, productId: string): Promise<boolean> {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !productId) return false;

    let savedLocally = false;
    try {
      const saved = localStorage.getItem('copias_bellavista_wishlist');
      if (saved) {
        let list = JSON.parse(saved);
        list = list.filter((item: any) => !((item.user_email || '').toLowerCase() === cleanEmail && item.product_id === productId));
        localStorage.setItem('copias_bellavista_wishlist', JSON.stringify(list));
      }
      savedLocally = true;
    } catch (e) {
      console.warn("Error removing wishlist item from localStorage:", e);
    }

    if (supabase) {
      try {
        await supabase
          .from('wishlist')
          .delete()
          .eq('user_email', cleanEmail)
          .eq('product_id', productId);
        return true;
      } catch (e) {
        console.warn("Could not delete wishlist item from Supabase, used local storage fallback:", e);
      }
    }

    return savedLocally;
  }

  // Helper to check if string is a valid UUID
  , isUUID(str?: string): boolean {
    if (!str) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }

  // --- STORE USERS OPERATIONS ---
  , async getStoreUsers(): Promise<StoreUser[]> {
    let dbUsers: StoreUser[] = [];
    if (supabase) {
      try {
        const { data, error } = await supabase.from('store_users').select('*').order('created_at', { ascending: false });
        if (!error && data) {
          dbUsers = data;
        }
      } catch (e) {
        console.warn('Could not fetch store users from Supabase', e);
      }
    }

    let localUsers: StoreUser[] = [];
    try {
      const local = localStorage.getItem('copias_bellavista_store_users');
      if (local) {
        localUsers = JSON.parse(local);
      }
    } catch (e) {
      console.warn('Error reading store users from localStorage', e);
    }

    // Merge strategy: Start with localUsers, override or append with dbUsers
    const userMap = new Map<string, StoreUser>();
    
    // Add local users first
    localUsers.forEach(u => {
      const key = (u.id || u.email || '').toLowerCase();
      if (key) userMap.set(key, u);
    });

    // Add/override with DB users
    dbUsers.forEach(u => {
      const keyByEmail = (u.email || '').toLowerCase();
      const keyById = (u.id || '').toLowerCase();
      if (keyById && userMap.has(keyById)) {
        userMap.set(keyById, { ...userMap.get(keyById), ...u });
      } else if (keyByEmail && userMap.has(keyByEmail)) {
        userMap.set(keyByEmail, { ...userMap.get(keyByEmail), ...u });
      } else {
        userMap.set(keyById || keyByEmail, u);
      }
    });

    let combined = Array.from(userMap.values());

    // Filter out default "Cajero Bella Vista" / "Copias Bella vista" if present
    combined = combined.filter(u => {
      const nameLower = (u.name || '').toLowerCase();
      const emailLower = (u.email || '').toLowerCase();
      return !nameLower.includes('cajero bella vista') && 
             !nameLower.includes('copias bella vista') && 
             emailLower !== 'cajero@copiasbellavista.com';
    });

    // Default Seed Users if empty
    if (combined.length === 0) {
      combined = [
        {
          id: 'user-admin-default',
          name: 'Administrador Principal',
          email: 'admin@copiasbellavista.com',
          password: 'admin123',
          role: 'Admin',
          permissions: ['orders', 'sales', 'products', 'caja', 'clientes', 'proveedores', 'compras', 'reportes', 'settings', 'marketing'],
          is_active: true,
          created_at: new Date().toISOString()
        },
        {
          id: 'user-gerente-default',
          name: 'Gerente General',
          email: 'gerente@copiasbellavista.com',
          password: 'gerente123',
          role: 'Gerente',
          permissions: ['orders', 'sales', 'products', 'caja', 'clientes', 'proveedores', 'compras', 'reportes', 'settings', 'marketing'],
          is_active: true,
          created_at: new Date().toISOString()
        },
        {
          id: 'user-despachador-default',
          name: 'Despachador Almacén',
          email: 'despacho@copiasbellavista.com',
          password: 'despacho123',
          role: 'Despachador',
          permissions: ['products'],
          is_active: true,
          created_at: new Date().toISOString()
        },
        {
          id: 'user-repartidor-default',
          name: 'Repartidor Motorizado',
          email: 'repartidor@copiasbellavista.com',
          password: 'repartidor123',
          role: 'Repartidor',
          permissions: ['orders'],
          is_active: true,
          created_at: new Date().toISOString()
        }
      ];
    }

    // Normalize all returned store users emails to lowercase
    combined = combined.map(u => ({
      ...u,
      email: (u.email || '').trim().toLowerCase()
    }));

    // Save consolidated list back to LocalStorage
    try {
      localStorage.setItem('copias_bellavista_store_users', JSON.stringify(combined));
    } catch (e) {}

    return combined;
  }

  , async normalizeAllUserEmailsToLowerCase(): Promise<void> {
    try {
      // 1. LocalStorage store_users
      const storeUsersRaw = localStorage.getItem('copias_bellavista_store_users');
      if (storeUsersRaw) {
        let list = JSON.parse(storeUsersRaw);
        if (Array.isArray(list)) {
          let updated = false;
          list = list.map((u: any) => {
            if (u.email && u.email !== u.email.trim().toLowerCase()) {
              updated = true;
              return { ...u, email: u.email.trim().toLowerCase() };
            }
            return u;
          });
          if (updated) {
            localStorage.setItem('copias_bellavista_store_users', JSON.stringify(list));
          }
        }
      }

      // 2. LocalStorage clients
      const clientsRaw = localStorage.getItem('copias_bellavista_local_clients');
      if (clientsRaw) {
        let list = JSON.parse(clientsRaw);
        if (Array.isArray(list)) {
          let updated = false;
          list = list.map((c: any) => {
            let change = false;
            let newObj = { ...c };
            if (newObj.email && newObj.email !== newObj.email.trim().toLowerCase()) {
              newObj.email = newObj.email.trim().toLowerCase();
              change = true;
            }
            if (newObj.correo && newObj.correo !== newObj.correo.trim().toLowerCase()) {
              newObj.correo = newObj.correo.trim().toLowerCase();
              change = true;
            }
            if (change) updated = true;
            return newObj;
          });
          if (updated) {
            localStorage.setItem('copias_bellavista_local_clients', JSON.stringify(list));
          }
        }
      }

      // 3. Supabase database tables (if connected)
      if (supabase) {
        const { data: suData } = await supabase.from('store_users').select('*');
        if (suData && Array.isArray(suData)) {
          for (const u of suData) {
            if (u.email && u.email !== u.email.trim().toLowerCase()) {
              const cleanE = u.email.trim().toLowerCase();
              await supabase.from('store_users').update({ email: cleanE }).eq('id', u.id);
            }
          }
        }
        const { data: cData } = await supabase.from('clients').select('*');
        if (cData && Array.isArray(cData)) {
          for (const c of cData) {
            if (c.email && c.email !== c.email.trim().toLowerCase()) {
              const cleanE = c.email.trim().toLowerCase();
              await supabase.from('clients').update({ email: cleanE, correo: cleanE }).eq('id', c.id);
            } else if (c.correo && c.correo !== c.correo.trim().toLowerCase()) {
              const cleanE = c.correo.trim().toLowerCase();
              await supabase.from('clients').update({ email: cleanE, correo: cleanE }).eq('id', c.id);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Error normalizing user emails in database:', e);
    }
  }

  , async addStoreUser(user: Omit<StoreUser, 'id' | 'created_at'> & { id?: string }): Promise<StoreUser | null> {
    const cleanUserPayload: Record<string, any> = {
      name: (user.name || '').trim(),
      email: (user.email || '').trim().toLowerCase(),
      password: (user.password || '123456').trim(),
      role: user.role || 'Cajero',
      is_active: user.is_active !== false,
      created_at: new Date().toISOString()
    };

    if (user.phone) cleanUserPayload.phone = user.phone;
    if (user.telefono) cleanUserPayload.telefono = user.telefono;
    if (user.document) cleanUserPayload.document = user.document;
    if (user.doc_type) cleanUserPayload.doc_type = user.doc_type;
    if (user.doc_number) cleanUserPayload.doc_number = user.doc_number;
    if (user.tipo_documento) cleanUserPayload.tipo_documento = user.tipo_documento;
    if (user.documento) cleanUserPayload.documento = user.documento;
    if (user.client_code) cleanUserPayload.client_code = user.client_code;
    if (user.permissions) cleanUserPayload.permissions = user.permissions;

    let savedDbUser: StoreUser | null = null;
    if (supabase) {
      try {
        const { data, error } = await supabase.from('store_users').upsert([cleanUserPayload], { onConflict: 'email' }).select().single();
        if (!error && data) {
          savedDbUser = data;
        } else if (error) {
          console.warn('Supabase store_users insert error:', error.message);
          const { data: d2 } = await supabase.from('store_users').insert([cleanUserPayload]).select().single();
          if (d2) savedDbUser = d2;
        }
      } catch (e) {
        console.warn('Could not add store user to Supabase', e);
      }
    }

    const finalUser: StoreUser = savedDbUser || {
      id: user.id || 'usr-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      ...user,
      ...cleanUserPayload
    };

    // Update LocalStorage
    try {
      let localUsers: StoreUser[] = [];
      const local = localStorage.getItem('copias_bellavista_store_users');
      if (local) localUsers = JSON.parse(local);
      const updatedUsers = [finalUser, ...localUsers.filter(u => u.email !== finalUser.email && u.id !== finalUser.id)];
      localStorage.setItem('copias_bellavista_store_users', JSON.stringify(updatedUsers));
    } catch (e) {}

    return finalUser;
  }

  , async updateStoreUser(id: string, updates: Partial<StoreUser>): Promise<boolean> {
    const cleanId = (id || '').toString();
    const cleanUpdates: Record<string, any> = {
      updated_at: new Date().toISOString()
    };
    if (updates.name !== undefined && updates.name !== null) cleanUpdates.name = String(updates.name).trim();
    if (updates.email !== undefined && updates.email !== null) cleanUpdates.email = String(updates.email).trim().toLowerCase();
    if (updates.password !== undefined && updates.password !== null && String(updates.password).trim()) cleanUpdates.password = String(updates.password).trim();
    if (updates.role !== undefined) cleanUpdates.role = updates.role;
    if (updates.is_active !== undefined) cleanUpdates.is_active = updates.is_active;
    if (updates.phone !== undefined) cleanUpdates.phone = updates.phone;
    if (updates.telefono !== undefined) cleanUpdates.telefono = updates.telefono;
    if (updates.client_code !== undefined) cleanUpdates.client_code = updates.client_code;
    if (updates.permissions !== undefined) cleanUpdates.permissions = updates.permissions;

    let success = false;
    if (supabase && cleanId) {
      try {
        if (this.isUUID(cleanId)) {
          const { error, data } = await supabase.from('store_users').update(cleanUpdates).eq('id', cleanId).select();
          if (!error && data && data.length > 0) {
            success = true;
          }
        }

        const targetEmail = (cleanId.includes('@') ? cleanId : updates.email || '').toLowerCase();
        if (!success && targetEmail) {
          const { error, data } = await supabase.from('store_users').update(cleanUpdates).ilike('email', targetEmail).select();
          if (!error && data && data.length > 0) {
            success = true;
          }
        }

        // Upsert fallback if user row didn't exist in Supabase yet
        if (!success && (updates.name || updates.email)) {
          const localList = await this.getStoreUsers();
          const target = localList.find(u => u.id === cleanId || u.email === cleanId || (u.email && (u.email || '').toLowerCase() === cleanId.toLowerCase()));
          const fullPayload = {
            name: updates.name || target?.name || 'Usuario',
            email: (updates.email || target?.email || cleanId).toLowerCase(),
            password: updates.password || target?.password || '123456',
            role: updates.role || target?.role || 'Cajero',
            is_active: updates.is_active !== undefined ? updates.is_active : (target?.is_active !== false),
            ...cleanUpdates
          };
          if (fullPayload.email) {
            const { error } = await supabase.from('store_users').upsert([fullPayload], { onConflict: 'email' });
            if (!error) success = true;
          }
        }
      } catch (e) {
        console.warn('Could not update store user in Supabase', e);
      }
    }

    // Always update LocalStorage
    try {
      let localUsers: StoreUser[] = [];
      const local = localStorage.getItem('copias_bellavista_store_users');
      if (local) localUsers = JSON.parse(local);

      let found = false;
      const updatedUsers = localUsers.map(u => {
        const matches = (u.id && cleanId && u.id === cleanId) || (u.email && cleanId && u.email === cleanId) || (!!u.email && (u.email || '').toLowerCase() === cleanId.toLowerCase());
        if (matches) {
          found = true;
          return { ...u, ...updates };
        }
        return u;
      });

      if (!found && cleanId) {
        updatedUsers.push({
          id: cleanId.includes('@') ? 'usr-' + Date.now() : cleanId,
          name: updates.name || 'Usuario',
          email: updates.email || (cleanId.includes('@') ? cleanId : ''),
          password: updates.password || '123456',
          role: updates.role || 'Cajero',
          is_active: updates.is_active !== undefined ? updates.is_active : true,
          ...updates
        });
      }

      localStorage.setItem('copias_bellavista_store_users', JSON.stringify(updatedUsers));
      success = true;
    } catch (e) {}

    return success;
  }

  , async deleteStoreUser(id: string): Promise<boolean> {
    const cleanId = (id || '').toString();
    let success = false;
    if (supabase && cleanId) {
      try {
        if (this.isUUID(cleanId)) {
          await supabase.from('store_users').delete().eq('id', cleanId);
        }
        const targetEmail = cleanId.includes('@') ? cleanId : '';
        if (targetEmail) {
          await supabase.from('store_users').delete().ilike('email', targetEmail);
        }
      } catch (e) {
        console.warn('Could not delete store user from Supabase', e);
      }
    }

    // Delete from LocalStorage
    try {
      let localUsers: StoreUser[] = [];
      const local = localStorage.getItem('copias_bellavista_store_users');
      if (local) localUsers = JSON.parse(local);

      const updatedUsers = localUsers.filter(u => u.id !== cleanId && u.email !== cleanId && (u.email || '').toLowerCase() !== cleanId.toLowerCase());
      localStorage.setItem('copias_bellavista_store_users', JSON.stringify(updatedUsers));
      success = true;
    } catch (e) {}

    return success;
  }

  , async loginStoreUser(email: string, password?: string): Promise<StoreUser | null> {
    const users = await this.getStoreUsers();
    const normalizedEmail = (email || '').trim().toLowerCase();
    const found = users.find(u => u.email && u.email.trim().toLowerCase() === normalizedEmail && u.is_active);
    if (!found) return null;

    if (found.password) {
      if (password && found.password === password) {
        return found;
      }
      return null;
    }
    
    // Fallback if user was created without password
    return found;
  }

  , async resetPasswordStoreUser(email: string, newPassword?: string): Promise<{ success: boolean; message: string }> {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const updatedPass = newPassword ? newPassword.trim() : '123456';

    let dbUpdated = false;
    if (supabase) {
      try {
        const { error } = await supabase
          .from('store_users')
          .update({ password: updatedPass, updated_at: new Date().toISOString() })
          .ilike('email', normalizedEmail);
        if (!error) dbUpdated = true;
      } catch (e) {
        console.warn('Could not update store_users password in Supabase:', e);
      }
    }

    const users = await this.getStoreUsers();
    const found = users.find(u => (u.email || '').trim().toLowerCase() === normalizedEmail);

    if (found) {
      await this.updateStoreUser(found.id!, { password: updatedPass });
      return { success: true, message: `Contraseña restablecida con éxito para ${normalizedEmail}. Ya puedes iniciar sesión.` };
    }

    if (dbUpdated) {
      return { success: true, message: `Contraseña restablecida con éxito en la base de datos para ${normalizedEmail}. Ya puedes iniciar sesión.` };
    }

    return { success: false, message: 'No se encontró ninguna cuenta registrada con este correo electrónico.' };
  }

  // --- CLIENT AUTHENTICATION & SECURITY METHODS ---
  , async findClientByIdentifier(identifier: string): Promise<any | null> {
    if (!identifier || !identifier.trim()) return null;
    const clean = identifier.trim().toLowerCase();
    const docClean = clean.replace(/[^a-z0-9]/gi, '');

    // 1. Check directly in Supabase DB if available
    if (supabase) {
      try {
        // Query clients table in Supabase
        const { data: clientsData } = await supabase
          .from('clients')
          .select('*');

        if (clientsData && clientsData.length > 0) {
          const match = clientsData.find(c => {
            let phone = c.phone || '';
            let email = (c.email || '').toLowerCase();
            if (phone.includes(' | email:')) {
              const parts = phone.split(' | email:');
              if (!email) email = parts[1].trim().toLowerCase();
            }
            const cDoc = (c.doc_number || c.documento || c.document || c.rif || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
            const cType = (c.doc_type || c.tipo_documento || 'V').toLowerCase();
            const fullDoc = `${cType}-${cDoc}`.replace(/[^a-z0-9]/gi, '');

            return email === clean || cDoc === docClean || fullDoc === docClean || (c.document || '').toLowerCase().replace(/[^a-z0-9]/gi, '') === docClean;
          });

          if (match) {
            let phone = match.phone || '';
            let email = match.email || '';
            if (phone.includes(' | email:')) {
              const parts = phone.split(' | email:');
              phone = parts[0].trim();
              if (!email) email = parts[1].trim();
            }
            const docType = match.doc_type || match.tipo_documento || 'V';
            const docNum = match.doc_number || match.documento || (match.document ? match.document.replace(/^[a-zA-Z]-?/, '') : '');

            return {
              id: match.id,
              doc_type: docType,
              doc_number: docNum,
              tipo_documento: docType,
              documento: docNum,
              document: match.document || `${docType}-${docNum}`,
              rif: match.document || `${docType}-${docNum}`,
              name: match.name,
              nombres: match.name,
              apellidos: '',
              correo: email || clean,
              email: email || clean,
              phone: phone,
              telefono: phone,
              password: match.password || '',
              estado: match.is_active !== false,
              is_active: match.is_active !== false
            };
          }
        }

        // Query store_users table in Supabase
        const { data: storeUsersData } = await supabase
          .from('store_users')
          .select('*');

        if (storeUsersData && storeUsersData.length > 0) {
          const matchU = storeUsersData.find(u => {
            const uEmail = (u.email || '').toLowerCase();
            const uDoc = (u.document || u.doc_number || u.documento || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
            return uEmail === clean || (uDoc && uDoc === docClean);
          });

          if (matchU) {
            const uDocType = matchU.doc_type || matchU.tipo_documento || 'V';
            const uDocNum = matchU.doc_number || matchU.documento || '';

            return {
              id: matchU.id,
              doc_type: uDocType,
              doc_number: uDocNum,
              tipo_documento: uDocType,
              documento: uDocNum,
              document: matchU.document || `${uDocType}-${uDocNum}`,
              rif: matchU.document || `${uDocType}-${uDocNum}`,
              name: matchU.name,
              nombres: matchU.name,
              apellidos: '',
              correo: matchU.email,
              email: matchU.email,
              phone: matchU.phone || matchU.telefono || '',
              telefono: matchU.phone || matchU.telefono || '',
              password: matchU.password || '',
              estado: matchU.is_active !== false,
              is_active: matchU.is_active !== false
            };
          }
        }
      } catch (e) {
        console.warn("Error querying client directly from Supabase:", e);
      }
    }

    // 2. Local fallback check
    try {
      const clients = await this.getClients();
      const matchClient = clients.find(c => {
        const cEmail = (c.email || c.correo || '').toLowerCase();
        const cDoc = (c.doc_number || c.documento || c.rif || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
        const cFullDoc = `${(c.doc_type || c.tipo_documento || '').toLowerCase()}${cDoc}`;
        return cEmail === clean || cDoc === docClean || cFullDoc === docClean;
      });

      if (matchClient) return matchClient;

      const storeUsers = await this.getStoreUsers();
      const matchUser = storeUsers.find(u => {
        const uEmail = (u.email || '').toLowerCase();
        const uDoc = (u.document || u.doc_number || u.documento || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
        return uEmail === clean || (uDoc && uDoc === docClean);
      });

      if (matchUser) {
        const uDocType = matchUser.doc_type || (matchUser as any).tipo_documento || 'V';
        const uDocNum = matchUser.doc_number || (matchUser as any).documento || '';

        return {
          id: matchUser.id,
          doc_type: uDocType,
          doc_number: uDocNum,
          tipo_documento: uDocType,
          documento: uDocNum,
          document: matchUser.document || `${uDocType}-${uDocNum}`,
          rif: matchUser.document || `${uDocType}-${uDocNum}`,
          name: matchUser.name,
          nombres: matchUser.name,
          apellidos: '',
          correo: matchUser.email,
          email: matchUser.email,
          phone: matchUser.phone || matchUser.telefono || '',
          telefono: matchUser.phone || matchUser.telefono || '',
          password: matchUser.password || '',
          estado: matchUser.is_active !== false,
          is_active: matchUser.is_active !== false
        };
      }
    } catch (err) {
      console.error("Error finding client by identifier:", err);
    }
    return null;
  },

  async loginClient(identifier: string, password?: string): Promise<{ success: boolean; client?: any; message: string }> {
    const client = await this.findClientByIdentifier(identifier);
    if (!client) {
      return { success: false, message: 'No encontramos ninguna cuenta asociada a este correo o documento.' };
    }

    if (client.estado === false || client.is_active === false) {
      return { success: false, message: 'Esta cuenta se encuentra inactiva. Contacta a soporte para reactivarla.' };
    }

    if (!password) {
      return { success: true, client, message: 'Cliente encontrado.' };
    }

    // Check password
    if (client.password && client.password !== password) {
      await this.recordSecurityLog('cliente', client.correo || client.email || identifier, 'failed_login', 'Contraseña incorrecta');
      return { success: false, message: 'La contraseña ingresada es incorrecta.' };
    }

    // Log successful login
    await this.recordSecurityLog('cliente', client.correo || client.email || identifier, 'login', 'Inicio de sesión exitoso');
    await this.createSession('cliente', client.id || client.correo, client.correo || client.email || identifier);

    return { success: true, client, message: 'Bienvenido(a)' };
  },

  async registerClientUser(data: {
    tipo_documento: string;
    documento: string;
    nombres: string;
    apellidos: string;
    correo: string;
    telefono: string;
    password?: string;
  }): Promise<{ success: boolean; client?: any; message: string; isAlreadyRegistered?: boolean }> {
    try {
      const cleanEmail = (data?.correo || '').trim().toLowerCase();
      const docType = data?.tipo_documento || 'V';
      const docNum = (data?.documento || '').trim();
      const formattedDoc = `${docType}-${docNum}`;

      // 1. Verify email uniqueness
      const existingByEmail = await this.findClientByIdentifier(cleanEmail);
      if (existingByEmail) {
        if (data.password && existingByEmail.password && existingByEmail.password === data.password) {
          return {
            success: true,
            client: existingByEmail,
            message: '¡Cuenta registrada encontrada! Iniciando sesión...'
          };
        }
        return { 
          success: false, 
          isAlreadyRegistered: true,
          client: existingByEmail,
          message: 'El correo electrónico ya está registrado. Por favor ingresa tu contraseña para iniciar sesión.' 
        };
      }

      // 2. Verify document uniqueness
      const existingByDoc = await this.findClientByIdentifier(formattedDoc);
      if (existingByDoc) {
        if (data.password && existingByDoc.password && existingByDoc.password === data.password) {
          return {
            success: true,
            client: existingByDoc,
            message: '¡Cuenta registrada encontrada! Iniciando sesión...'
          };
        }
        return { 
          success: false, 
          isAlreadyRegistered: true,
          client: existingByDoc,
          message: 'El número de documento / RIF ya está registrado con otra cuenta.' 
        };
      }

      const clientName = `${data.nombres.trim()} ${data.apellidos.trim()}`.trim();

      // 3. Create record in clients table
      const newClient = await this.createClient({
        name: clientName,
        document: formattedDoc,
        doc_type: docType,
        doc_number: docNum,
        tipo_documento: docType,
        documento: docNum,
        rif: formattedDoc,
        type: docType === 'J' || docType === 'G' ? 'Jurídico' : 'Natural',
        phone: data.telefono.trim(),
        email: cleanEmail,
        password: data.password || '123456',
        is_active: true
      });

      // 4. Sync to store_users table with role 'Cliente'
      await this.addStoreUser({
        name: clientName,
        email: cleanEmail,
        phone: data.telefono.trim(),
        telefono: data.telefono.trim(),
        document: formattedDoc,
        doc_type: docType,
        doc_number: docNum,
        tipo_documento: docType,
        documento: docNum,
        password: data.password || '123456',
        role: 'Cliente',
        is_active: true,
        client_code: newClient?.code || ''
      });

      await this.recordSecurityLog('cliente', cleanEmail, 'register', 'Registro de cliente completado en base de datos');
      return { success: true, client: newClient, message: '¡Cuenta creada exitosamente en la base de datos!' };
    } catch (err: any) {
      console.error("Error registering client:", err);
      return { success: false, message: 'Error al registrar cliente: ' + (err.message || 'Error del servidor') };
    }
  },

  async resetClientPassword(emailOrDoc: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const client = await this.findClientByIdentifier(emailOrDoc);
    if (!client) {
      return { success: false, message: 'No se encontró ninguna cuenta registrada con este correo electrónico o documento.' };
    }

    const email = (client.correo || client.email || '').trim().toLowerCase();
    if (!email) {
      return { success: false, message: 'No hay un correo electrónico asociado a esta cuenta.' };
    }

    const updatedPass = newPassword.trim();

    // 1. Update in clients table in Supabase
    if (supabase) {
      try {
        await supabase
          .from('clients')
          .update({ password: updatedPass })
          .eq('id', client.id);

        await supabase
          .from('clients')
          .update({ password: updatedPass })
          .ilike('email', email);
      } catch (e) {
        console.warn("Could not update clients table password in Supabase:", e);
      }
    }

    // 2. Update in store_users table
    await this.resetPasswordStoreUser(email, updatedPass);
    await this.recordSecurityLog('cliente', email, 'password_reset', 'Restablecimiento de contraseña de cliente exitoso');

    return { success: true, message: '¡Contraseña actualizada correctamente! Ya puedes iniciar sesión con tu nueva contraseña.' };
  },

  // --- SECURITY LOGS & SESSION MANAGEMENT ---
  async recordSecurityLog(userType: 'interno' | 'cliente', email: string, action: string, details: string) {
    const log = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user_type: userType,
      user_email: email,
      action,
      ip: '127.0.0.1 (VPN / Cloud Run)',
      details
    };
    try {
      const saved = localStorage.getItem('copias_bellavista_security_logs');
      const logs = saved ? JSON.parse(saved) : [];
      logs.unshift(log);
      if (logs.length > 100) logs.pop();
      localStorage.setItem('copias_bellavista_security_logs', JSON.stringify(logs));
    } catch (e) {
      console.error("Error recording security log:", e);
    }
  },

  async getSecurityLogs(): Promise<any[]> {
    try {
      const saved = localStorage.getItem('copias_bellavista_security_logs');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  },

  async createSession(userType: 'interno' | 'cliente', userId: string, email: string): Promise<any> {
    const session = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sess-${Date.now()}`,
      usuario_tipo: userType,
      usuario_id: userId,
      usuario_email: email,
      token: `jwt-token-${Math.random().toString(36).substring(2)}-${Date.now()}`,
      ip: '127.0.0.1',
      navegador: typeof navigator !== 'undefined' ? navigator.userAgent : 'Browser Agent',
      fecha_inicio: new Date().toISOString(),
      fecha_expira: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    try {
      const saved = localStorage.getItem('copias_bellavista_active_sessions');
      const sessions = saved ? JSON.parse(saved) : [];
      sessions.unshift(session);
      localStorage.setItem('copias_bellavista_active_sessions', JSON.stringify(sessions));
    } catch (e) {}
    return session;
  },

  async getSessions(userEmail: string): Promise<any[]> {
    try {
      const saved = localStorage.getItem('copias_bellavista_active_sessions');
      const sessions = saved ? JSON.parse(saved) : [];
      return sessions.filter((s: any) => s.usuario_email === userEmail);
    } catch (e) {
      return [];
    }
  },

  async terminateAllSessions(userEmail: string): Promise<boolean> {
    try {
      const saved = localStorage.getItem('copias_bellavista_active_sessions');
      if (saved) {
        let sessions = JSON.parse(saved);
        sessions = sessions.filter((s: any) => s.usuario_email !== userEmail);
        localStorage.setItem('copias_bellavista_active_sessions', JSON.stringify(sessions));
      }
      await this.recordSecurityLog('cliente', userEmail, 'logout_all', 'Sesiones cerradas en todos los dispositivos');
      return true;
    } catch (e) {
      return false;
    }
  }

  // --- PROVIDER OPERATIONS ---
, async getProviders(): Promise<Provider[]> {
    let apiProviders: Provider[] = [];
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('providers')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) {
          apiProviders = data as Provider[];
        }
      } catch (e) {
        console.warn('Error fetching providers from Supabase:', e);
      }
    }

    // Load from localStorage
    let localProviders: Provider[] = [];
    try {
      const saved = localStorage.getItem('copias_bellavista_local_providers');
      if (saved) {
        localProviders = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading local providers:', e);
    }

    // Merge lists
    const mergedMap = new Map<string, Provider>();
    localProviders.forEach(p => {
      mergedMap.set(p.id || p.rif || p.code, p);
    });
    apiProviders.forEach(p => {
      mergedMap.set(p.id || p.rif || p.code, p);
    });

    return Array.from(mergedMap.values()).sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });
  },

  async createProvider(provider: Omit<Provider, 'id'> & { id?: string }): Promise<Provider> {
    // Generate consecutive sequential code
    let calculatedCode = provider.code?.trim();
    if (!calculatedCode) {
      try {
        const allProviders = await this.getProviders();
        let maxNum = 0;
        allProviders.forEach(p => {
          if (!p.code) return;
          const match = p.code.match(/(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          }
        });
        const nextNum = maxNum + 1;
        calculatedCode = nextNum < 1000 ? `PROV-${String(nextNum).padStart(3, '0')}` : `PROV-${nextNum}`;
      } catch (e) {
        calculatedCode = 'PROV-001';
      }
    }

    const newProvider: Provider = {
      id: provider.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `local-${Math.floor(Math.random() * 1000000)}`),
      code: calculatedCode,
      rif: provider.rif,
      name: provider.name,
      type: provider.type || 'Jurídico',
      phone: provider.phone,
      bank_name: provider.bank_name || '',
      created_at: new Date().toISOString()
    };

    if (supabase) {
      try {
        const { data, error } = await supabase.from('providers').insert([newProvider]).select();
        if (!error && data && data[0]) {
          return data[0] as Provider;
        } else {
          console.warn("Supabase insert provider failed (RLS/schema). Using local fallback:", error);
        }
      } catch (e) {
        console.warn("Supabase insert provider error. Using local fallback:", e);
      }
    }

    try {
      const saved = localStorage.getItem('copias_bellavista_local_providers');
      const localProviders = saved ? JSON.parse(saved) : [];
      localProviders.push(newProvider);
      localStorage.setItem('copias_bellavista_local_providers', JSON.stringify(localProviders));
    } catch (e) {
      console.error("Failed to save provider to localStorage:", e);
    }

    return newProvider;
  },

  async updateProvider(id: string, updates: Partial<Provider>): Promise<Provider | null> {
    if (supabase && id && !String(id).startsWith('local-')) {
      try {
        const { data, error } = await supabase
          .from('providers')
          .update(updates)
          .eq('id', id)
          .select();
        if (!error && data && data[0]) {
          return data[0] as Provider;
        }
      } catch (e) {
        console.warn("Supabase update provider error. Updating local copy instead:", e);
      }
    }

    try {
      const saved = localStorage.getItem('copias_bellavista_local_providers');
      if (saved) {
        let localProviders = JSON.parse(saved);
        localProviders = localProviders.map((p: any) => {
          if (p.id === id) {
            return { ...p, ...updates };
          }
          return p;
        });
        localStorage.setItem('copias_bellavista_local_providers', JSON.stringify(localProviders));
        return localProviders.find((p: any) => p.id === id) || null;
      }
    } catch (e) {
      console.error("Failed to update provider in localStorage:", e);
    }
    return null;
  },

  async deleteProvider(id: string): Promise<boolean> {
    if (supabase && id && !String(id).startsWith('local-')) {
      try {
        const { error } = await supabase.from('providers').delete().eq('id', id);
        if (!error) return true;
      } catch (e) {
        console.warn("Supabase delete provider failed. Deleting from local copy:", e);
      }
    }

    try {
      const saved = localStorage.getItem('copias_bellavista_local_providers');
      if (saved) {
        let localProviders = JSON.parse(saved);
        localProviders = localProviders.filter((p: any) => p.id !== id);
        localStorage.setItem('copias_bellavista_local_providers', JSON.stringify(localProviders));
      }
    } catch (e) {
      console.error("Failed to delete provider from localStorage:", e);
    }
    return true;
  },

  // ==========================================
  // COMPRAS E INVENTARIO (PURCHASES & STOCK)
  // ==========================================
  async getPurchases(): Promise<Purchase[]> {
    let apiPurchases: Purchase[] = [];
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('purchases')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) {
          apiPurchases = data.map((p: any) => ({
            ...p,
            items: typeof p.items === 'string' ? JSON.parse(p.items) : (p.items || [])
          })) as Purchase[];
        }
      } catch (e) {
        console.warn('Error fetching purchases from Supabase:', e);
      }
    }

    let localPurchases: Purchase[] = [];
    try {
      const saved = localStorage.getItem('copias_bellavista_local_purchases');
      if (saved) {
        localPurchases = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading local purchases:', e);
    }

    const mergedMap = new Map<string, Purchase>();
    localPurchases.forEach(p => mergedMap.set(p.id, p));
    apiPurchases.forEach(p => mergedMap.set(p.id, p));

    return Array.from(mergedMap.values()).sort((a, b) => {
      const dateA = new Date(a.date || a.created_at || 0).getTime();
      const dateB = new Date(b.date || b.created_at || 0).getTime();
      return dateB - dateA;
    });
  },

  async createPurchase(
    purchaseData: Omit<Purchase, 'id'> & { id?: string },
    updateProductCost: boolean = false
  ): Promise<{ purchase: Purchase; updatedProducts: Product[] }> {
    const allPurchases = await this.getPurchases();
    const purchaseSeq = String(allPurchases.length + 1).padStart(5, '0');
    const newId = purchaseData.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `pur-${Date.now()}`);

    const newPurchase: Purchase = {
      id: newId,
      purchase_number: purchaseData.purchase_number || `CMP-${purchaseSeq}`,
      invoice_number: purchaseData.invoice_number || `FAC-${purchaseSeq}`,
      provider_id: purchaseData.provider_id || '',
      provider_name: purchaseData.provider_name || 'Proveedor General',
      provider_rif: purchaseData.provider_rif || '',
      date: purchaseData.date || new Date().toISOString().split('T')[0],
      items: purchaseData.items || [],
      total_amount: purchaseData.total_amount || 0,
      total_items: purchaseData.items?.reduce((sum, it) => sum + Number(it.quantity || 0), 0) || 0,
      status: purchaseData.status || 'completada',
      notes: purchaseData.notes || '',
      update_cost_applied: updateProductCost,
      payment_method: purchaseData.payment_method || 'Efectivo USD',
      payment_status: purchaseData.payment_status || 'pagado',
      due_date: purchaseData.due_date || undefined,
      installments_count: purchaseData.installments_count || undefined,
      installments: purchaseData.installments || undefined,
      created_at: purchaseData.created_at || new Date().toISOString(),
      created_by: purchaseData.created_by || 'Admin'
    };

    // 1. Save purchase to Supabase / localStorage
    if (supabase) {
      try {
        const payloadToSave = {
          ...newPurchase,
          items: JSON.stringify(newPurchase.items),
          installments: newPurchase.installments ? JSON.stringify(newPurchase.installments) : undefined
        };
        const { data, error } = await supabase.from('purchases').insert([payloadToSave]).select();
        if (error) {
          console.warn('Supabase insert purchase warning (using local fallback):', error);
        }
      } catch (e) {
        console.warn('Supabase insert purchase error (using local fallback):', e);
      }
    }

    try {
      const saved = localStorage.getItem('copias_bellavista_local_purchases');
      const localPurchases = saved ? JSON.parse(saved) : [];
      localPurchases.unshift(newPurchase);
      localStorage.setItem('copias_bellavista_local_purchases', JSON.stringify(localPurchases));
    } catch (e) {
      console.error('Failed to save purchase to localStorage:', e);
    }

    // 2. Obligatory stock update:
    // Locate each selected product by ID/SKU
    // Execute relative stock increase: Stock Nuevo = Stock Actual + Cantidad Comprada
    // (Optional) Update cost_price if updateProductCost is true
    const currentProducts = await this.getProducts();
    const updatedProducts: Product[] = [];

    for (const item of newPurchase.items) {
      if (!item.product_id && !item.sku) continue;
      const targetProd = currentProducts.find(p => p.id === item.product_id || (item.sku && p.sku === item.sku));
      if (targetProd) {
        const currentStock = Number(targetProd.stock || 0);
        const qtyBought = Number(item.quantity || 0);
        const newStock = Math.max(0, currentStock + qtyBought);

        const updatePayload: Partial<Product> = {
          stock: newStock
        };

        if (updateProductCost && item.unit_cost !== undefined && item.unit_cost !== null && item.unit_cost > 0) {
          updatePayload.cost_price = Number(item.unit_cost);
        }

        try {
          const updated = await this.updateProduct(targetProd.id, updatePayload);
          updatedProducts.push(updated);
        } catch (err) {
          console.error(`Failed to update product ${targetProd.id} stock in Supabase:`, err);
          // Fallback: update local storage copy of products if present
          try {
            const savedLocal = localStorage.getItem('copias_bellavista_local_products');
            if (savedLocal) {
              let localProds = JSON.parse(savedLocal);
              localProds = localProds.map((p: any) => p.id === targetProd.id ? { ...p, ...updatePayload } : p);
              localStorage.setItem('copias_bellavista_local_products', JSON.stringify(localProds));
            }
          } catch (le) {
            console.error('Failed to update local product copy:', le);
          }
          updatedProducts.push({ ...targetProd, ...updatePayload });
        }
      }
    }

    return { purchase: newPurchase, updatedProducts };
  },

  async deletePurchase(id: string): Promise<boolean> {
    if (supabase && id && !String(id).startsWith('pur-')) {
      try {
        const { error } = await supabase.from('purchases').delete().eq('id', id);
        if (!error) return true;
      } catch (e) {
        console.warn('Supabase delete purchase failed:', e);
      }
    }

    try {
      const saved = localStorage.getItem('copias_bellavista_local_purchases');
      if (saved) {
        let localPurchases = JSON.parse(saved);
        localPurchases = localPurchases.filter((p: any) => p.id !== id);
        localStorage.setItem('copias_bellavista_local_purchases', JSON.stringify(localPurchases));
      }
    } catch (e) {
      console.error('Failed to delete purchase from localStorage:', e);
    }
    return true;
  },

  // Publicidad: Banner Slides Operations
  async getBannerSlides(): Promise<BannerSlide[]> {
    const defaultSlides: BannerSlide[] = [
      {
        id: 'slide-1',
        title: 'Servicios de Impresión y Copiado de Alta Calidad',
        subtitle: 'Impresiones a color, b&n, plastificado, encuadernación y soluciones de oficina.',
        badge: '⚡ Servicio Rápido',
        image_url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=1500&h=600',
        button_text: 'Ver Papelería & Copias',
        target_category: 'Papelería y Oficina',
        active: true,
        sort_order: 1
      },
      {
        id: 'slide-2',
        title: 'Línea de Repostería Gourmet & Utensilios Especiales',
        subtitle: 'Descubre nuestros moldes, esencias, cortadores y las mejores tortas artesanales.',
        badge: '🍰 Especial Dulce',
        image_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=1500&h=600',
        button_text: 'Explorar Repostería',
        target_category: 'Repostería',
        active: true,
        sort_order: 2
      },
      {
        id: 'slide-3',
        title: 'Grandes Descuentos y Promociones Especiales',
        subtitle: 'Aprovecha nuestras ofertas semanales en productos seleccionados.',
        badge: '🔥 Ofertas Top',
        image_url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&q=80&w=1500&h=600',
        button_text: 'Ver Ofertas',
        target_offer: true,
        active: true,
        sort_order: 3
      }
    ];

    try {
      const savedLocal = localStorage.getItem('copias_bellavista_banner_slides');
      let slides: BannerSlide[] = savedLocal ? JSON.parse(savedLocal) : defaultSlides;

      if (supabase) {
        try {
          const { data, error } = await supabase.from('banner_slides').select('*').order('sort_order', { ascending: true });
          if (!error && data && data.length > 0) {
            slides = data as BannerSlide[];
            localStorage.setItem('copias_bellavista_banner_slides', JSON.stringify(slides));
          } else {
            // Also check key-value app_config
            const { data: configData } = await supabase.from('app_config').select('*').eq('key', 'banner_slides').maybeSingle();
            if (configData && configData.value && Array.isArray(configData.value)) {
              slides = configData.value as BannerSlide[];
              localStorage.setItem('copias_bellavista_banner_slides', JSON.stringify(slides));
            }
          }
        } catch (e) {}
      }
      return slides.sort((a, b) => a.sort_order - b.sort_order);
    } catch (e) {
      console.warn('Error reading banner slides:', e);
      return defaultSlides;
    }
  },

  async saveBannerSlides(slides: BannerSlide[]): Promise<boolean> {
    const sorted = [...slides].map((s, idx) => ({ ...s, sort_order: idx + 1 }));
    localStorage.setItem('copias_bellavista_banner_slides', JSON.stringify(sorted));

    if (supabase) {
      try {
        const { error } = await supabase.from('banner_slides').upsert(sorted);
        if (error) {
          console.warn('Notice upserting banner_slides to Supabase, trying app_config fallback:', error.message);
          await supabase.from('app_config').upsert({
            key: 'banner_slides',
            value: sorted,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
        }
      } catch (e) {
        console.warn('Supabase saveBannerSlides exception:', e);
      }
    }
    window.dispatchEvent(new CustomEvent('bellavista_banner_updated'));
    return true;
  },

  // Publicidad: Landing Special Operations
  async getLandingConfig(): Promise<LandingConfig> {
    const defaultConfig: LandingConfig = {
      is_active: false,
      title: '¡Novedad Dulce! Tres Leches Especial Gourmet',
      subtitle: 'Disfruta de nuestra exquisita torta Tres Leches artesanal preparada con la receta original Bella Vista.',
      badge: '🍰 Novedad Especial',
      image_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=600&h=400',
      button_text: 'Explorar Colección Gourmet'
    };

    try {
      const savedLocal = localStorage.getItem('copias_bellavista_landing_config');
      let config: LandingConfig = savedLocal ? JSON.parse(savedLocal) : defaultConfig;

      if (supabase) {
        try {
          const { data, error } = await supabase.from('app_config').select('*').eq('key', 'landing_config').maybeSingle();
          if (!error && data && data.value) {
            config = data.value as LandingConfig;
            localStorage.setItem('copias_bellavista_landing_config', JSON.stringify(config));
          }
        } catch (e) {}
      }
      return config;
    } catch (e) {
      return defaultConfig;
    }
  },

  async saveLandingConfig(config: LandingConfig): Promise<boolean> {
    localStorage.setItem('copias_bellavista_landing_config', JSON.stringify(config));
    localStorage.setItem('copias_bellavista_landing_active', String(config.is_active));

    // Also update disabled_settings disable_landing flag
    try {
      const savedDisabled = localStorage.getItem('copias_bellavista_disabled_settings');
      const parsed = savedDisabled ? JSON.parse(savedDisabled) : {};
      parsed.disable_landing = !config.is_active;
      localStorage.setItem('copias_bellavista_disabled_settings', JSON.stringify(parsed));
    } catch (e) {}

    if (supabase) {
      try {
        const { error } = await supabase.from('app_config').upsert({
          key: 'landing_config',
          value: config,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
        if (error) {
          console.warn('Notice saving landing_config to Supabase:', error.message);
        }
      } catch (e) {
        console.warn('Supabase saveLandingConfig exception:', e);
      }
    }
    window.dispatchEvent(new CustomEvent('bellavista_landing_updated'));
    window.dispatchEvent(new CustomEvent('bellavista_settings_updated'));
    return true;
  },

  // Publicidad: Home Carousel Cards Order Operations
  async getHomeCarouselCards(): Promise<HomeCarouselCardItem[]> {
    const defaultCards: HomeCarouselCardItem[] = [
      {
        id: 'cat-copias',
        title: 'Copias & Encuadernación',
        subtitle: 'Rápidas, nítidas y listas al instante',
        badge: 'Servicio Express',
        enabled: true,
        sort_order: 1
      },
      {
        id: 'featured-1',
        title: 'Nitidez & Calidad',
        subtitle: 'Nuestros productos estrella de impresión',
        badge: 'Destacado',
        enabled: true,
        sort_order: 2
      },
      {
        id: 'cat-papeleria',
        title: 'Papelería Creativa',
        subtitle: 'Todo para tus ideas al mejor precio',
        badge: 'Ofertas Diarias',
        enabled: true,
        sort_order: 3
      },
      {
        id: 'cat-escolar',
        title: 'Útiles Escolares',
        subtitle: 'Ahorros diarios para el regreso a clases',
        badge: 'Temporada Escolar',
        enabled: true,
        sort_order: 4
      },
      {
        id: 'cat-postres',
        title: 'Dulces & Postres',
        subtitle: 'Un antojo delicioso para acompañar tu día',
        badge: 'Recién Horneado',
        enabled: true,
        sort_order: 5
      },
      {
        id: 'featured-2',
        title: 'Super Oferta del Día',
        subtitle: 'Estilos y productos con precios de locura',
        badge: 'Oferta Especial',
        enabled: true,
        sort_order: 6
      }
    ];

    try {
      let cards: HomeCarouselCardItem[] | null = null;

      if (supabase) {
        try {
          const { data } = await supabase.from('app_config').select('*').eq('key', 'home_carousel_cards').maybeSingle();
          if (data && data.value && Array.isArray(data.value) && data.value.length > 0) {
            cards = data.value as HomeCarouselCardItem[];
            localStorage.setItem('copias_bellavista_home_carousel_cards', JSON.stringify(cards));
          }
        } catch (e) {
          console.warn('Notice loading home_carousel_cards from Supabase:', e);
        }
      }

      if (!cards) {
        const savedLocal = localStorage.getItem('copias_bellavista_home_carousel_cards');
        if (savedLocal) {
          try {
            cards = JSON.parse(savedLocal);
          } catch (e) {}
        }
      }

      if (!cards || cards.length === 0) {
        cards = defaultCards;
      }

      return cards.sort((a, b) => a.sort_order - b.sort_order);
    } catch (e) {
      return defaultCards;
    }
  },

  async getQuotes(): Promise<Quote[]> {
    let apiQuotes: Quote[] = [];
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('quotes')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) {
          apiQuotes = data as Quote[];
        } else {
          console.warn('Error fetching quotes from Supabase:', error);
        }
      } catch (e) {
        console.warn('Error in getQuotes (Supabase):', e);
      }
    }

    let localQuotes: Quote[] = [];
    try {
      const saved = localStorage.getItem('copias_bellavista_local_quotes');
      if (saved) {
        localQuotes = JSON.parse(saved);
      }
    } catch (e) {
      console.error("Error loading local quotes:", e);
    }

    let quotesToUse = apiQuotes.length > 0 ? apiQuotes : localQuotes;

    // Check automatic expiration for active quotes
    const now = new Date();
    let hasExpiredChanges = false;

    quotesToUse = quotesToUse.map(q => {
      if ((q.status === 'creada' || q.status === 'pendiente') && q.expiration_date) {
        const exp = new Date(q.expiration_date);
        if (!isNaN(exp.getTime()) && exp < now) {
          hasExpiredChanges = true;
          return { ...q, status: 'expirada' as const };
        }
      }
      return q;
    });

    if (hasExpiredChanges) {
      localStorage.setItem('copias_bellavista_local_quotes', JSON.stringify(quotesToUse));
    }

    return quotesToUse;
  },

  async saveQuote(quote: Omit<Quote, 'created_at' | 'quote_number'> & { created_at?: string; quote_number?: string }): Promise<Quote> {
    const localQuotes = await this.getQuotes();
    
    let targetQuote: Quote;
    const isEditing = !!quote.id && localQuotes.some(q => q.id === quote.id);

    if (isEditing) {
      const existing = localQuotes.find(q => q.id === quote.id)!;
      targetQuote = {
        ...existing,
        ...quote,
        updated_at: new Date().toISOString()
      } as Quote;
    } else {
      const id = quote.id || crypto.randomUUID();
      const count = localQuotes.length + 1;
      const quoteNumber = `COT-${String(1000 + count).padStart(4, '0')}`;
      targetQuote = {
        ...quote,
        id,
        quote_number: quoteNumber,
        status: quote.status || 'creada',
        created_at: quote.created_at || new Date().toISOString()
      } as Quote;
    }

    let updatedLocalQuotes: Quote[];
    if (isEditing) {
      updatedLocalQuotes = localQuotes.map(q => q.id === targetQuote.id ? targetQuote : q);
    } else {
      updatedLocalQuotes = [targetQuote, ...localQuotes];
    }
    localStorage.setItem('copias_bellavista_local_quotes', JSON.stringify(updatedLocalQuotes));

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('quotes')
          .upsert(targetQuote, { onConflict: 'id' })
          .select();

        if (error) {
          console.warn('Supabase saveQuote error, retrying with core columns fallback:', error.message);
          // Fallback if extra columns don't exist in Supabase table
          const corePayload = {
            id: targetQuote.id,
            quote_number: targetQuote.quote_number,
            client_name: targetQuote.client_name,
            client_phone: targetQuote.client_phone,
            client_email: targetQuote.client_email,
            concept: targetQuote.concept,
            items: targetQuote.items,
            total_price: targetQuote.total_price,
            status: targetQuote.status,
            created_at: targetQuote.created_at,
            notes: targetQuote.notes,
            order_id: targetQuote.order_id
          };
          const { data: fbData } = await supabase
            .from('quotes')
            .upsert(corePayload, { onConflict: 'id' })
            .select();
          if (fbData && fbData[0]) {
            return { ...targetQuote, ...fbData[0] };
          }
        } else if (data && data[0]) {
          const savedQuote = data[0] as Quote;
          const index = updatedLocalQuotes.findIndex(q => q.id === savedQuote.id);
          if (index !== -1) {
            updatedLocalQuotes[index] = savedQuote;
            localStorage.setItem('copias_bellavista_local_quotes', JSON.stringify(updatedLocalQuotes));
          }
          return savedQuote;
        }
      } catch (e) {
        console.warn('Exception in saveQuote (Supabase):', e);
      }
    }

    return targetQuote;
  },

  async deleteQuote(id: string): Promise<boolean> {
    const localQuotes = await this.getQuotes();
    const filtered = localQuotes.filter(q => q.id !== id);
    localStorage.setItem('copias_bellavista_local_quotes', JSON.stringify(filtered));

    if (supabase) {
      try {
        const { error } = await supabase.from('quotes').delete().eq('id', id);
        if (error) {
          console.warn('Error deleting quote from Supabase:', error.message);
        }
      } catch (e) {
        console.warn('Exception deleting quote from Supabase:', e);
      }
    }
    return true;
  },

  async saveHomeCarouselCards(cards: HomeCarouselCardItem[]): Promise<boolean> {
    const sorted = [...cards].map((c, idx) => ({ ...c, sort_order: idx + 1 }));
    localStorage.setItem('copias_bellavista_home_carousel_cards', JSON.stringify(sorted));

    if (supabase) {
      try {
        await supabase.from('app_config').upsert({
          key: 'home_carousel_cards',
          value: sorted,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      } catch (e) {
        console.warn('Supabase saveHomeCarouselCards exception:', e);
      }
    }
    window.dispatchEvent(new CustomEvent('bellavista_home_carousel_updated'));
    return true;
  },

  async getTaxes(): Promise<Tax[]> {
    const defaultTaxes: Tax[] = [
      { id: 'default-iva', name: 'IVA', rate: 16, is_active: true }
    ];
    try {
      const savedLocal = localStorage.getItem('copias_bellavista_taxes');
      let taxes: Tax[] = savedLocal ? JSON.parse(savedLocal) : defaultTaxes;

      if (supabase) {
        try {
          const { data, error } = await supabase.from('taxes').select('*').order('created_at', { ascending: true });
          if (!error && data) {
            taxes = data.map((t: any) => ({
              id: t.id,
              name: t.name,
              rate: parseFloat(t.rate) || 0,
              is_active: t.is_active === true,
              created_at: t.created_at
            })) as Tax[];
            localStorage.setItem('copias_bellavista_taxes', JSON.stringify(taxes));
          } else {
            console.warn('Supabase getTaxes failed (likely table does not exist). Using localStorage / defaults:', error?.message);
          }
        } catch (e) {
          console.warn('Supabase getTaxes exception:', e);
        }
      }
      return taxes;
    } catch (e) {
      console.warn('Error reading taxes:', e);
      return defaultTaxes;
    }
  },

  async saveTax(tax: Partial<Tax>): Promise<Tax> {
    const defaultTaxes: Tax[] = [
      { id: 'default-iva', name: 'IVA', rate: 16, is_active: true }
    ];
    const savedLocal = localStorage.getItem('copias_bellavista_taxes');
    const localTaxes: Tax[] = savedLocal ? JSON.parse(savedLocal) : defaultTaxes;

    const id = tax.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `local-tax-${Math.floor(Math.random() * 1000000)}`);
    const cleanTax: Tax = {
      id,
      name: tax.name || 'Nuevo Impuesto',
      rate: tax.rate !== undefined ? tax.rate : 0,
      is_active: tax.is_active !== undefined ? tax.is_active : true,
      created_at: tax.created_at || new Date().toISOString()
    };

    // Update locally
    const existingIndex = localTaxes.findIndex(t => t.id === id);
    if (existingIndex > -1) {
      localTaxes[existingIndex] = cleanTax;
    } else {
      localTaxes.push(cleanTax);
    }
    localStorage.setItem('copias_bellavista_taxes', JSON.stringify(localTaxes));

    if (supabase) {
      try {
        const { error } = await supabase.from('taxes').upsert({
          id: cleanTax.id,
          name: cleanTax.name,
          rate: cleanTax.rate,
          is_active: cleanTax.is_active,
          created_at: cleanTax.created_at
        });
        
        if (error) {
          console.warn('Supabase upsert tax failed. Table might not exist:', error.message);
        }
      } catch (e) {
        console.warn('Supabase saveTax exception:', e);
      }
    }
    
    // Dispatch custom event to notify components
    window.dispatchEvent(new CustomEvent('bellavista_taxes_updated'));
    return cleanTax;
  },

  // 💳 MÉTODOS DE PAGO (CONFIGURACIÓN)
  async getPaymentMethods(): Promise<PaymentMethodConfig[]> {
    const defaultMethods: PaymentMethodConfig[] = [
      {
        id: 'pm-pagomovil',
        code: 'PAGOMOVIL',
        name: 'Pago Móvil C2P / P2P',
        currency: 'VES',
        type: 'movil',
        description: 'Transferencia instantánea interbancaria en bolívares.',
        instructions: 'Indicar número de teléfono, banco de destino y cédula/RIF.',
        account_details: '0412-5043857 | Banesco (0134) | V-24567890',
        is_active: true,
        requires_reference: true,
        allow_pos: true,
        allow_online: true,
        sort_order: 1
      },
      {
        id: 'pm-efectivo-usd',
        code: 'EFECTIVO_USD',
        name: 'Efectivo Dólares (USD)',
        currency: 'USD',
        type: 'efectivo',
        description: 'Billetes en buen estado sin roturas ni marcas severas.',
        instructions: 'Entregar monto exacto o indicar con cuánto cancela para vuelto.',
        account_details: 'Recepción directa en mostrador / caja',
        is_active: true,
        requires_reference: false,
        allow_pos: true,
        allow_online: true,
        sort_order: 2
      },
      {
        id: 'pm-efectivo-ves',
        code: 'EFECTIVO_VES',
        name: 'Efectivo Bolívares (Bs.)',
        currency: 'VES',
        type: 'efectivo',
        description: 'Moneda de curso legal nacional a tasa oficial BCV.',
        instructions: 'Calculado al tipo de cambio oficial del día.',
        account_details: 'Recepción directa en mostrador / caja',
        is_active: true,
        requires_reference: false,
        allow_pos: true,
        allow_online: true,
        sort_order: 3
      },
      {
        id: 'pm-transferencia-ves',
        code: 'TRANSFERENCIA_VES',
        name: 'Transferencia Bancaria Nacional (Bs.)',
        currency: 'VES',
        type: 'transferencia',
        description: 'Transferencias Banesco, Mercantil, Venezuela y Provincial.',
        instructions: 'Adjuntar comprobante con número de referencia de 6 o más dígitos.',
        account_details: 'Banesco Cta Corriente: 0134-0000-00-0000000000 | Titular: Papelería Bella Vista, C.A. | RIF: J-50987654-3',
        is_active: true,
        requires_reference: true,
        allow_pos: true,
        allow_online: true,
        sort_order: 4
      },
      {
        id: 'pm-punto-venta',
        code: 'PUNTO_VENTA',
        name: 'Punto de Venta / Tarjeta Débito (POS)',
        currency: 'VES',
        type: 'punto',
        description: 'Tarjetas de débito y crédito nacionales e internacionales.',
        instructions: 'Procesamiento en terminal físico en tienda.',
        account_details: 'Terminal POS Inalámbrico Biopago / Credicard',
        is_active: true,
        requires_reference: true,
        allow_pos: true,
        allow_online: false,
        sort_order: 5
      },
      {
        id: 'pm-zelle',
        code: 'ZELLE',
        name: 'Zelle (USD)',
        currency: 'USD',
        type: 'digital',
        description: 'Transferencias electrónicas en dólares estadounidenses sin comisión.',
        instructions: 'Colocar número de pedido en la nota de Zelle.',
        account_details: 'pagos@bellavista.com | Bella Vista Services LLC',
        is_active: true,
        requires_reference: true,
        allow_pos: true,
        allow_online: true,
        sort_order: 6
      },
      {
        id: 'pm-binance',
        code: 'BINANCE_PAY',
        name: 'Binance Pay (USDT)',
        currency: 'USD',
        type: 'digital',
        description: 'Criptomoneda estable USDT / Binance Pay ID instantáneo.',
        instructions: 'Enviar por Pay ID o código QR Binance.',
        account_details: 'Binance Pay ID: 489201948',
        is_active: true,
        requires_reference: true,
        allow_pos: true,
        allow_online: true,
        sort_order: 7
      }
    ];

    try {
      const savedLocal = localStorage.getItem('copias_bellavista_payment_methods');
      let methods: PaymentMethodConfig[] = savedLocal ? JSON.parse(savedLocal) : defaultMethods;

      if (supabase) {
        try {
          const { data, error } = await supabase.from('payment_methods').select('*').order('sort_order', { ascending: true });
          if (!error && data && data.length > 0) {
            methods = data.map((pm: any) => ({
              id: pm.id,
              code: pm.code || pm.id,
              name: pm.name,
              currency: pm.currency || 'VES',
              type: pm.type || 'otro',
              description: pm.description || '',
              instructions: pm.instructions || '',
              account_details: pm.account_details || '',
              bank_account_id: pm.bank_account_id || undefined,
              bank_account_name: pm.bank_account_name || undefined,
              incoming_commission: pm.incoming_commission !== undefined ? Number(pm.incoming_commission) : 0,
              outgoing_commission: pm.outgoing_commission !== undefined ? Number(pm.outgoing_commission) : 0,
              is_active: pm.is_active !== false,
              requires_reference: pm.requires_reference === true,
              allow_pos: pm.allow_pos !== false,
              allow_online: pm.allow_online !== false,
              sort_order: pm.sort_order || 1,
              created_at: pm.created_at
            })) as PaymentMethodConfig[];
            localStorage.setItem('copias_bellavista_payment_methods', JSON.stringify(methods));
          } else {
            // Also check key-value app_config
            const { data: configData } = await supabase.from('app_config').select('*').eq('key', 'payment_methods_config').maybeSingle();
            if (configData && configData.value && Array.isArray(configData.value) && configData.value.length > 0) {
              methods = configData.value as PaymentMethodConfig[];
              localStorage.setItem('copias_bellavista_payment_methods', JSON.stringify(methods));
            }
          }
        } catch (e) {
          console.warn('Supabase getPaymentMethods exception:', e);
        }
      }
      return (methods || defaultMethods).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    } catch (e) {
      console.warn('Error reading payment methods:', e);
      return defaultMethods;
    }
  },

  async savePaymentMethod(method: Partial<PaymentMethodConfig>): Promise<PaymentMethodConfig> {
    const existingMethods = await this.getPaymentMethods();
    const id = method.id || `pm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    
    const cleanMethod: PaymentMethodConfig = {
      id,
      code: method.code?.trim().toUpperCase() || id.toUpperCase(),
      name: method.name?.trim() || 'Nuevo Método de Pago',
      currency: method.currency || 'VES',
      type: method.type || 'otro',
      description: method.description || '',
      instructions: method.instructions || '',
      account_details: method.account_details || '',
      bank_account_id: method.bank_account_id || undefined,
      bank_account_name: method.bank_account_name || undefined,
      incoming_commission: method.incoming_commission !== undefined ? Number(method.incoming_commission) : 0,
      outgoing_commission: method.outgoing_commission !== undefined ? Number(method.outgoing_commission) : 0,
      is_active: method.is_active !== undefined ? method.is_active : true,
      requires_reference: method.requires_reference !== undefined ? method.requires_reference : false,
      allow_pos: method.allow_pos !== undefined ? method.allow_pos : true,
      allow_online: method.allow_online !== undefined ? method.allow_online : true,
      sort_order: method.sort_order !== undefined ? method.sort_order : (existingMethods.length + 1),
      created_at: method.created_at || new Date().toISOString()
    };

    const existingIndex = existingMethods.findIndex(m => m.id === id);
    let updatedList: PaymentMethodConfig[] = [];
    if (existingIndex > -1) {
      updatedList = [...existingMethods];
      updatedList[existingIndex] = cleanMethod;
    } else {
      updatedList = [...existingMethods, cleanMethod];
    }

    localStorage.setItem('copias_bellavista_payment_methods', JSON.stringify(updatedList));

    if (supabase) {
      try {
        const { error } = await supabase.from('payment_methods').upsert(cleanMethod);
        if (error) {
          console.warn('Notice saving payment_methods directly, updating fallback app_config:', error.message);
          await supabase.from('app_config').upsert({
            key: 'payment_methods_config',
            value: updatedList,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
        }
      } catch (e) {
        console.warn('Supabase savePaymentMethod exception:', e);
      }
    }

    window.dispatchEvent(new CustomEvent('bellavista_payment_methods_updated'));
    return cleanMethod;
  },

  async deletePaymentMethod(id: string): Promise<boolean> {
    const existingMethods = await this.getPaymentMethods();
    const updatedList = existingMethods.filter(m => m.id !== id);
    localStorage.setItem('copias_bellavista_payment_methods', JSON.stringify(updatedList));

    if (supabase) {
      try {
        await supabase.from('payment_methods').delete().eq('id', id);
        await supabase.from('app_config').upsert({
          key: 'payment_methods_config',
          value: updatedList,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      } catch (e) {
        console.warn('Supabase deletePaymentMethod exception:', e);
      }
    }

    window.dispatchEvent(new CustomEvent('bellavista_payment_methods_updated'));
    return true;
  },

  async getReportModulesConfig(): Promise<ReportModuleConfig[]> {
    const defaultModules: ReportModuleConfig[] = [
      {
        id: 'tu_ganancia',
        title: 'Tu ganancia',
        description: 'Cuánto ganaste, costo y margen de ganancia',
        enabled: true,
        section: 'graficas',
        sort_order: 1
      },
      {
        id: 'tus_ventas',
        title: 'Tus ventas',
        description: 'Monto total de ventas y volumen de transacciones',
        enabled: true,
        section: 'graficas',
        sort_order: 2
      },
      {
        id: 'top_productos',
        title: 'Top productos',
        description: 'Productos más vendidos y con mayor ganancia',
        enabled: true,
        section: 'comparativos',
        sort_order: 3
      },
      {
        id: 'top_clientes',
        title: 'Top clientes',
        description: 'Clientes más recurrentes y con mayor volumen de compra',
        enabled: true,
        section: 'comparativos',
        sort_order: 4
      },
      {
        id: 'top_empleados',
        title: 'Top empleados',
        description: 'Desempeño del personal y ventas realizadas',
        enabled: true,
        section: 'comparativos',
        sort_order: 5
      },
      {
        id: 'tus_gastos',
        title: 'Tus gastos',
        description: 'Gastos operativos detallados por categoría',
        enabled: true,
        section: 'detalle',
        sort_order: 6
      },
      {
        id: 'report_multimoneda',
        title: 'Divisas y Multimoneda',
        description: 'Desglose de ingresos por divisa original (USD, VES, EUR, COP) y pagos mixtos',
        enabled: true,
        section: 'detalle',
        sort_order: 7
      }
    ];

    try {
      let configs: ReportModuleConfig[] | null = null;

      if (supabase) {
        try {
          const { data } = await supabase.from('app_config').select('*').eq('key', 'reportes_modules_config').maybeSingle();
          if (data && data.value && Array.isArray(data.value) && data.value.length > 0) {
            configs = data.value as ReportModuleConfig[];
            localStorage.setItem('copias_bellavista_report_modules', JSON.stringify(configs));
          }
        } catch (e) {
          console.warn('Notice loading reportes_modules_config from Supabase:', e);
        }
      }

      if (!configs) {
        const savedLocal = localStorage.getItem('copias_bellavista_report_modules');
        if (savedLocal) {
          configs = JSON.parse(savedLocal);
        }
      }

      if (configs && configs.length > 0) {
        const merged = defaultModules.map(dm => {
          const matched = configs!.find(c => c.id === dm.id);
          return matched ? { ...dm, ...matched } : dm;
        });
        return merged.sort((a, b) => a.sort_order - b.sort_order);
      }
    } catch (e) {
      console.error("Error loading report modules:", e);
    }

    return defaultModules;
  },

  async saveReportModulesConfig(modules: ReportModuleConfig[]): Promise<boolean> {
    const sorted = [...modules].map((m, idx) => ({ ...m, sort_order: idx + 1 }));
    localStorage.setItem('copias_bellavista_report_modules', JSON.stringify(sorted));

    if (supabase) {
      try {
        await supabase.from('app_config').upsert({
          key: 'reportes_modules_config',
          value: sorted,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      } catch (e) {
        console.warn('Supabase saveReportModulesConfig exception:', e);
      }
    }
    window.dispatchEvent(new CustomEvent('bellavista_report_modules_updated'));
    return true;
  },

  async deleteTax(id: string): Promise<boolean> {
    const savedLocal = localStorage.getItem('copias_bellavista_taxes');
    if (savedLocal) {
      const localTaxes: Tax[] = JSON.parse(savedLocal);
      const filtered = localTaxes.filter(t => t.id !== id);
      localStorage.setItem('copias_bellavista_taxes', JSON.stringify(filtered));
    }

    if (supabase) {
      try {
        const { error } = await supabase.from('taxes').delete().eq('id', id);
        if (error) {
          console.warn('Supabase delete tax failed:', error.message);
        }
      } catch (e) {
        console.warn('Supabase deleteTax exception:', e);
      }
    }
    window.dispatchEvent(new CustomEvent('bellavista_taxes_updated'));
    return true;
  },

  // ==========================================
  // BUSINESS PROFILE (INFORMACIÓN DEL NEGOCIO)
  // ==========================================
  async getBusinessProfile(): Promise<BusinessProfile> {
    const defaultProfile: BusinessProfile = {
      id: 'main',
      name: 'Copias Bella Vista, C.A.',
      business_type: 'Papelería y libros',
      address: 'Sector bella vista, a una cuadra subiendo de la Cruz roja, calle 20 entre carrera 3 y 4',
      city: 'Barinitas',
      phone: '+58 412-5043857',
      email: 'Fotocopiasfyp@gmail.com',
      rif: 'J-50987654-3',
      website: 'https://copiasbellavista.vercel.app/',
      logo_url: '',
      slogan: 'Equipando Tus Proyectos',
      saas_plan: 'pro'
    };

    try {
      // Check localStorage first as fast buffer
      const savedLocal = localStorage.getItem('copias_bellavista_business_profile');
      let profile: BusinessProfile = savedLocal ? { ...defaultProfile, ...JSON.parse(savedLocal) } : defaultProfile;

      if (supabase) {
        try {
          // 1. Try dedicated table 'business_profile'
          const { data, error } = await supabase.from('business_profile').select('*').limit(1).maybeSingle();
          if (!error && data) {
            profile = {
              id: data.id || 'main',
              name: data.name || profile.name,
              business_type: data.business_type || profile.business_type,
              address: data.address !== undefined ? data.address : profile.address,
              city: data.city !== undefined ? data.city : profile.city,
              phone: data.phone !== undefined ? data.phone : profile.phone,
              email: data.email !== undefined ? data.email : profile.email,
              rif: data.rif !== undefined ? data.rif : profile.rif,
              website: data.website !== undefined ? data.website : profile.website,
              logo_url: data.logo_url !== undefined ? data.logo_url : profile.logo_url,
              slogan: data.slogan !== undefined ? data.slogan : profile.slogan,
              saas_plan: data.saas_plan || profile.saas_plan,
              updated_at: data.updated_at
            };
            localStorage.setItem('copias_bellavista_business_profile', JSON.stringify(profile));
            return profile;
          }

          // 2. Fallback check 'app_config' table key 'business_profile'
          const { data: configData } = await supabase.from('app_config').select('*').eq('key', 'business_profile').maybeSingle();
          if (configData && configData.value) {
            profile = { ...defaultProfile, ...configData.value };
            localStorage.setItem('copias_bellavista_business_profile', JSON.stringify(profile));
            return profile;
          }
        } catch (dbErr) {
          console.warn("Notice fetching business profile from Supabase:", dbErr);
        }
      }

      return profile;
    } catch (e) {
      console.warn("getBusinessProfile error:", e);
      return defaultProfile;
    }
  },

  async saveBusinessProfile(profile: Partial<BusinessProfile>): Promise<BusinessProfile> {
    const current = await this.getBusinessProfile();
    const updated: BusinessProfile = {
      ...current,
      ...profile,
      id: current.id || 'main',
      updated_at: new Date().toISOString()
    };

    // Save to local storage for fast sync across tabs
    localStorage.setItem('copias_bellavista_business_profile', JSON.stringify(updated));
    localStorage.setItem('business_address', updated.address || '');
    localStorage.setItem('business_city', updated.city || '');
    localStorage.setItem('business_email', updated.email || '');
    localStorage.setItem('business_type', updated.business_type || '');
    localStorage.setItem('business_website', updated.website || '');

    if (supabase) {
      try {
        // Upsert to business_profile
        const { error } = await supabase.from('business_profile').upsert(updated, { onConflict: 'id' });
        if (error) {
          console.warn("Supabase upsert to business_profile failed, falling back to app_config:", error.message);
          await supabase.from('app_config').upsert({
            key: 'business_profile',
            value: updated,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
        }
      } catch (e) {
        console.warn("Supabase saveBusinessProfile exception:", e);
        try {
          await supabase.from('app_config').upsert({
            key: 'business_profile',
            value: updated,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
        } catch (e2) {}
      }
    }

    window.dispatchEvent(new CustomEvent('bellavista_business_profile_updated', { detail: updated }));
    window.dispatchEvent(new CustomEvent('bellavista_settings_updated'));
    return updated;
  },

  // ==========================================
  // SEDES / SUCURSALES (BUSINESS BRANCHES)
  // ==========================================
  async getBusinessBranches(): Promise<BusinessBranch[]> {
    const defaultBranches: BusinessBranch[] = [
      { 
        id: 'branch_main_barinitas', 
        name: 'Tienda Bella Vista', 
        code: 'SP-01', 
        address: 'Carrera 6 entre calle 19 y 20, Barinitas, Edo. Barinas', 
        phone: '+58 412-5043857', 
        active: true,
        created_at: new Date().toISOString()
      },
      { 
        id: 'branch_agua_dulce', 
        name: 'Almacén Agua Dulce', 
        code: 'SUC-02', 
        address: 'Sector Agua Dulce, Barinitas, Edo. Barinas', 
        phone: '+58 412-5043857', 
        active: true,
        created_at: new Date().toISOString()
      },
      { 
        id: 'branch_online', 
        name: 'Tienda Online - Almacén', 
        code: 'SUC-03', 
        address: 'Barinitas, Edo. Barinas', 
        phone: '+58 412-5043857', 
        active: true,
        created_at: new Date().toISOString()
      }
    ];

    try {
      if (supabase) {
        try {
          const { data, error } = await supabase.from('business_branches').select('*').order('created_at', { ascending: true });
          if (!error && data && Array.isArray(data)) {
            // Filter out old template sample branches if any exist
            const realBranches = data.filter((b: any) => b.id !== '2' && b.code !== 'SD-02');
            if (realBranches.length > 0) {
              localStorage.setItem('copias_bellavista_branches', JSON.stringify(realBranches));
              return realBranches as BusinessBranch[];
            }
          }

          // Fallback to app_config
          const { data: configData, error: cfgErr } = await supabase.from('app_config').select('*').eq('key', 'business_branches').maybeSingle();
          if (!cfgErr && configData && configData.value && Array.isArray(configData.value)) {
            const cleanList = (configData.value as BusinessBranch[]).filter(b => b.id !== '2' && b.code !== 'SD-02');
            if (cleanList.length > 0) {
              localStorage.setItem('copias_bellavista_branches', JSON.stringify(cleanList));
              return cleanList;
            }
          }
        } catch (dbErr) {
          console.warn("Notice fetching business branches from Supabase:", dbErr);
        }
      }

      const savedLocal = localStorage.getItem('copias_bellavista_branches');
      if (savedLocal !== null) {
        try {
          const parsed = JSON.parse(savedLocal);
          if (Array.isArray(parsed)) {
            const clean = parsed.filter(b => b.id !== '2' && b.code !== 'SD-02');
            if (clean.length > 0) return clean;
          }
        } catch (e) {}
      }

      localStorage.setItem('copias_bellavista_branches', JSON.stringify(defaultBranches));
      return defaultBranches;
    } catch (e) {
      console.warn("getBusinessBranches error:", e);
      return defaultBranches;
    }
  },

  async saveBusinessBranch(branch: BusinessBranch): Promise<BusinessBranch> {
    const currentBranches = await this.getBusinessBranches();
    const existingIndex = currentBranches.findIndex(b => b.id === branch.id);
    let updatedBranches: BusinessBranch[];

    if (existingIndex >= 0) {
      updatedBranches = [...currentBranches];
      updatedBranches[existingIndex] = branch;
    } else {
      updatedBranches = [...currentBranches, branch];
    }

    localStorage.setItem('copias_bellavista_branches', JSON.stringify(updatedBranches));

    if (supabase) {
      try {
        const { error } = await supabase.from('business_branches').upsert(branch, { onConflict: 'id' });
        if (error) {
          console.warn("Supabase upsert to business_branches notice:", error.message);
        }
      } catch (e) {
        console.warn("Supabase saveBusinessBranch exception:", e);
      }

      try {
        await supabase.from('app_config').upsert({
          key: 'business_branches',
          value: updatedBranches,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      } catch (e2) {}
    }

    window.dispatchEvent(new CustomEvent('bellavista_branches_updated', { detail: updatedBranches }));
    return branch;
  },

  async deleteBusinessBranch(id: string): Promise<boolean> {
    const currentBranches = await this.getBusinessBranches();
    const updatedBranches = currentBranches.filter(b => b.id !== id);
    localStorage.setItem('copias_bellavista_branches', JSON.stringify(updatedBranches));

    // Also delete associated terminals locally
    const currentTerminals = await this.getBusinessTerminals();
    const updatedTerminals = currentTerminals.filter(t => t.branch_id !== id);
    localStorage.setItem('copias_bellavista_terminals', JSON.stringify(updatedTerminals));

    if (supabase) {
      try {
        await supabase.from('business_branches').delete().eq('id', id);
      } catch (e) {
        console.warn("Supabase deleteBusinessBranch notice:", e);
      }

      try {
        await supabase.from('business_terminals').delete().eq('branch_id', id);
      } catch (e) {
        console.warn("Supabase delete terminals for branch notice:", e);
      }

      try {
        await supabase.from('app_config').upsert({
          key: 'business_branches',
          value: updatedBranches,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
        await supabase.from('app_config').upsert({
          key: 'business_terminals',
          value: updatedTerminals,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      } catch (e) {}
    }

    window.dispatchEvent(new CustomEvent('bellavista_branches_updated', { detail: updatedBranches }));
    window.dispatchEvent(new CustomEvent('bellavista_terminals_updated', { detail: updatedTerminals }));
    return true;
  },

  // ==========================================
  // TERMINALES / PUNTOS DE VENTA (CAJAS)
  // ==========================================
  async getBusinessTerminals(branchId?: string): Promise<BusinessTerminal[]> {
    const defaultTerminals: BusinessTerminal[] = [
      { id: 'term_main_01', branch_id: 'branch_main_barinitas', code: 'C1', name: 'Caja Principal (Mostrador)', active: true },
      { id: 'term_main_02', branch_id: 'branch_main_barinitas', code: 'C2', name: 'Caja Copias e Impresiones', active: true }
    ];

    try {
      if (supabase) {
        try {
          let query = supabase.from('business_terminals').select('*');
          if (branchId) {
            query = query.eq('branch_id', branchId);
          }
          const { data, error } = await query.order('created_at', { ascending: true });
          if (!error && data && Array.isArray(data) && data.length > 0) {
            if (!branchId) {
              localStorage.setItem('copias_bellavista_terminals', JSON.stringify(data));
            }
            return data as BusinessTerminal[];
          }

          // Fallback to app_config
          const { data: configData, error: cfgErr } = await supabase.from('app_config').select('*').eq('key', 'business_terminals').maybeSingle();
          if (!cfgErr && configData && configData.value && Array.isArray(configData.value)) {
            let list = configData.value as BusinessTerminal[];
            if (branchId) list = list.filter(t => t.branch_id === branchId);
            return list;
          }
        } catch (dbErr) {
          console.warn("Notice fetching terminals from Supabase:", dbErr);
        }
      }

      const savedLocal = localStorage.getItem('copias_bellavista_terminals');
      let terminals: BusinessTerminal[] = defaultTerminals;
      if (savedLocal !== null) {
        try {
          const parsed = JSON.parse(savedLocal);
          if (Array.isArray(parsed)) terminals = parsed;
        } catch (e) {}
      }

      if (branchId) {
        return terminals.filter(t => t.branch_id === branchId);
      }
      return terminals;
    } catch (e) {
      console.warn("getBusinessTerminals error:", e);
      return branchId ? defaultTerminals.filter(t => t.branch_id === branchId) : defaultTerminals;
    }
  },

  async saveBusinessTerminal(terminal: BusinessTerminal): Promise<BusinessTerminal> {
    const currentTerminals = await this.getBusinessTerminals();
    const existingIndex = currentTerminals.findIndex(t => t.id === terminal.id);
    let updatedTerminals: BusinessTerminal[];

    if (existingIndex >= 0) {
      updatedTerminals = [...currentTerminals];
      updatedTerminals[existingIndex] = terminal;
    } else {
      updatedTerminals = [...currentTerminals, terminal];
    }

    localStorage.setItem('copias_bellavista_terminals', JSON.stringify(updatedTerminals));

    if (supabase) {
      try {
        const { error } = await supabase.from('business_terminals').upsert(terminal, { onConflict: 'id' });
        if (error) {
          console.warn("Supabase upsert to business_terminals notice:", error.message);
        }
      } catch (e) {
        console.warn("Supabase saveBusinessTerminal exception:", e);
      }

      try {
        await supabase.from('app_config').upsert({
          key: 'business_terminals',
          value: updatedTerminals,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      } catch (e2) {}
    }

    window.dispatchEvent(new CustomEvent('bellavista_terminals_updated', { detail: updatedTerminals }));
    return terminal;
  },

  async deleteBusinessTerminal(id: string): Promise<boolean> {
    const currentTerminals = await this.getBusinessTerminals();
    const updatedTerminals = currentTerminals.filter(t => t.id !== id);
    localStorage.setItem('copias_bellavista_terminals', JSON.stringify(updatedTerminals));

    if (supabase) {
      try {
        await supabase.from('business_terminals').delete().eq('id', id);
      } catch (e) {
        console.warn("Supabase deleteBusinessTerminal notice:", e);
      }

      try {
        await supabase.from('app_config').upsert({
          key: 'business_terminals',
          value: updatedTerminals,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      } catch (e) {}
    }

    window.dispatchEvent(new CustomEvent('bellavista_terminals_updated', { detail: updatedTerminals }));
    return true;
  },

  // ============================================================================
  // FINANZAS: CUENTAS BANCARIAS
  // ============================================================================
  
  async getBankAccounts(): Promise<BankAccount[]> {
    if (!supabase) return this._getLocalFallback('bank_accounts', [] as BankAccount[]);
    try {
      const { data, error } = await supabase.from('bank_accounts').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        localStorage.setItem('copias_bellavista_bank_accounts', JSON.stringify(data));
        return data as BankAccount[];
      }
    } catch (e) {
      console.warn('Fallback to local bank accounts');
    }
    return this._getLocalFallback('bank_accounts', [] as BankAccount[]);
  },

  async saveBankAccount(account: BankAccount): Promise<BankAccount> {
    const isNew = !account.id;
    if (isNew) account.id = crypto.randomUUID();
    
    account.updated_at = new Date().toISOString();

    const current = await this.getBankAccounts();
    const updated = isNew ? [...current, account] : current.map(a => a.id === account.id ? account : a);
    localStorage.setItem('copias_bellavista_bank_accounts', JSON.stringify(updated));

    if (supabase) {
      try {
        await supabase.from('bank_accounts').upsert(account, { onConflict: 'id' });
      } catch (e) {
        console.warn("Supabase saveBankAccount fallback:", e);
      }
    }

    window.dispatchEvent(new CustomEvent('bellavista_bank_accounts_updated', { detail: updated }));
    return account;
  },

  async deleteBankAccount(id: string): Promise<boolean> {
    const current = await this.getBankAccounts();
    const updated = current.filter(a => a.id !== id);
    localStorage.setItem('copias_bellavista_bank_accounts', JSON.stringify(updated));

    if (supabase) {
      try {
        await supabase.from('bank_accounts').delete().eq('id', id);
      } catch (e) {}
    }
    window.dispatchEvent(new CustomEvent('bellavista_bank_accounts_updated', { detail: updated }));
    return true;
  },

  async updateBankAccountBalance(id: string, amountChange: number): Promise<boolean> {
    const current = await this.getBankAccounts();
    const account = current.find(a => a.id === id);
    if (!account) return false;

    account.balance = Number(account.balance) + amountChange;
    account.updated_at = new Date().toISOString();

    return !!(await this.saveBankAccount(account));
  },

  async getBankTransfers(): Promise<BankTransfer[]> {
    let transfers: BankTransfer[] = [];
    if (supabase) {
      try {
        const { data, error } = await supabase.from('bank_transfers').select('*').order('created_at', { ascending: false });
        if (!error && data) {
          transfers = data as BankTransfer[];
          localStorage.setItem('copias_bellavista_bank_transfers', JSON.stringify(transfers));
        }
      } catch (e) {}
    }
    if (transfers.length === 0) {
      transfers = this._getLocalFallback('bank_transfers', [] as BankTransfer[]);
    }

    // Auto-sanitize records: for VES records where amount was stored in USD (e.g. 0.50) while exchange_rate was 785.07
    transfers = transfers.map(t => {
      if (t.currency === 'VES' && t.exchange_rate && t.exchange_rate > 50 && Number(t.amount) > 0 && Number(t.amount) < 50) {
        const fullBs = Number(t.amount) * Number(t.exchange_rate);
        return {
          ...t,
          amount: fullBs,
          converted_amount: fullBs
        };
      }
      return t;
    });

    // Auto-reconciliation for mistargeted Banesco/Bank transactions
    try {
      const savedAccountsRaw = localStorage.getItem('copias_bellavista_bank_accounts');
      let accounts: BankAccount[] = savedAccountsRaw ? JSON.parse(savedAccountsRaw) : [];

      let banescoAcc = accounts.find(a => `${a.name} ${a.bank_name || ''}`.toLowerCase().includes('banesco'));
      if (!banescoAcc && accounts.length > 0) {
        banescoAcc = {
          id: 'acc-banesco-auto',
          name: 'Banesco',
          bank_name: 'Banco Banesco',
          account_number: '0134-0000-00-0000000000',
          currency: 'VES',
          balance: 0,
          is_active: true,
          notes: JSON.stringify([
            { id: 'pm-banesco-pm', name: 'Pago Móvil Banesco (Bs.)', incomingCommission: 0, outgoingCommission: 0, currency: 'VES', type: 'movil' },
            { id: 'pm-banesco-transf', name: 'Transferencia Banesco (Bs.)', incomingCommission: 0, outgoingCommission: 0, currency: 'VES', type: 'transferencia' }
          ]),
          created_at: new Date().toISOString()
        };
        accounts.push(banescoAcc);
      }

      if (banescoAcc) {
        let hasFix = false;
        transfers.forEach(t => {
          const note = (t.notes || '').toLowerCase();
          const ref = (t.reference || '').toLowerCase();
          const isBanescoPayment = note.includes('banesco') || note.includes('pago movil banesco') || ref.includes('banesco');

          if (isBanescoPayment && t.to_account_id !== banescoAcc!.id) {
            const oldAcc = accounts.find(a => a.id === t.to_account_id);
            if (oldAcc) {
              oldAcc.balance = Math.max(0, Number(oldAcc.balance || 0) - Number(t.amount || 0));
            }
            t.to_account_id = banescoAcc!.id;
            t.to_account_name = banescoAcc!.name || banescoAcc!.bank_name;
            banescoAcc!.balance = Number(banescoAcc!.balance || 0) + Number(t.amount || 0);

            if (t.notes && t.notes.includes('(Efectivo VES)')) {
              t.notes = t.notes.replace('(Efectivo VES)', '(Pago Móvil Banesco (Bs.))');
            }
            hasFix = true;
          }
        });

        if (hasFix) {
          localStorage.setItem('copias_bellavista_bank_transfers', JSON.stringify(transfers));
          localStorage.setItem('copias_bellavista_bank_accounts', JSON.stringify(accounts));
          if (supabase) {
            try {
              supabase.from('bank_accounts').upsert(accounts);
              supabase.from('bank_transfers').upsert(transfers);
            } catch (err) {}
          }
        }
      }
    } catch (e) {}

    return transfers;
  },

  async transferBetweenAccounts(transfer: BankTransfer): Promise<BankTransfer> {
    transfer.id = crypto.randomUUID();
    transfer.created_at = new Date().toISOString();

    const current = await this.getBankTransfers();
    const updated = [transfer, ...current];
    localStorage.setItem('copias_bellavista_bank_transfers', JSON.stringify(updated));

    if (transfer.from_account_id) {
      await this.updateBankAccountBalance(transfer.from_account_id, -transfer.amount);
    }
    if (transfer.to_account_id && transfer.converted_amount) {
      await this.updateBankAccountBalance(transfer.to_account_id, transfer.converted_amount);
    }

    if (supabase) {
      try {
        await supabase.from('bank_transfers').insert(transfer);
      } catch (e) {}
    }

    window.dispatchEvent(new CustomEvent('bellavista_bank_transfers_updated', { detail: updated }));
    return transfer;
  },

  async recordSaleIncomeToBankAccounts(params: {
    invoice: Invoice;
    splitPayments?: Array<{
      method: string;
      currency?: string;
      amount: number;
      amount_usd: number;
      amount_ves: number;
      rate?: number;
    }>;
    singlePaymentMethod?: string;
    totalUsd: number;
    totalVes: number;
    bcvRate: number;
    createdBy?: string;
  }): Promise<void> {
    try {
      let bankAccounts = await this.getBankAccounts();
      const paymentMethods = await this.getPaymentMethods();
      const bcvRate = params.bcvRate || 45.5;

      // If no bank accounts exist in DB, create initial seed accounts so money gets tracked
      if (bankAccounts.length === 0) {
        const seedAccounts: BankAccount[] = [
          {
            id: crypto.randomUUID(),
            name: 'Cuenta Dólares',
            bank_name: 'Cuenta Dólares',
            currency: 'USD',
            balance: 0,
            is_active: true,
            created_at: new Date().toISOString()
          },
          {
            id: crypto.randomUUID(),
            name: 'Cuenta Bolívares',
            bank_name: 'Cuenta Bolívares',
            currency: 'VES',
            balance: 0,
            is_active: true,
            created_at: new Date().toISOString()
          }
        ];
        for (const sa of seedAccounts) {
          await this.saveBankAccount(sa);
        }
        bankAccounts = await this.getBankAccounts();
      }

      // Helper function for normalisation
      const clean = (s: string) => (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Build payment items list
      const paymentEntries: Array<{
        method: string;
        amountUsd: number;
        amountVes: number;
        currency: string;
        rate: number;
      }> = [];

      if (params.splitPayments && params.splitPayments.length > 0) {
        params.splitPayments.forEach(sp => {
          paymentEntries.push({
            method: sp.method,
            amountUsd: Number(sp.amount_usd || 0),
            amountVes: Number(sp.amount_ves || (sp.amount_usd * bcvRate)),
            currency: sp.currency || (sp.amount_ves > 0 ? 'VES' : 'USD'),
            rate: sp.rate || bcvRate
          });
        });
      } else {
        const methodStr = params.singlePaymentMethod || params.invoice.payment_method || 'Efectivo';
        const isVes = methodStr.toLowerCase().includes('bs') || 
                      methodStr.toLowerCase().includes('bolivar') || 
                      methodStr.toLowerCase().includes('pago movil') || 
                      methodStr.toLowerCase().includes('punto') || 
                      methodStr.toLowerCase().includes('transferencia');
        paymentEntries.push({
          method: methodStr,
          amountUsd: Number(params.totalUsd || 0),
          amountVes: Number(params.totalVes || (params.totalUsd * bcvRate)),
          currency: isVes ? 'VES' : 'USD',
          rate: bcvRate
        });
      }

      const transfersToInsert: BankTransfer[] = [];

      for (const entry of paymentEntries) {
        if (entry.amountUsd <= 0 && entry.amountVes <= 0) continue;

        const rawMethod = entry.method || '';
        const normMethod = clean(rawMethod);
        
        // Find configured payment method
        const pmConfig = paymentMethods.find(p => {
          const normPName = clean(p.name);
          return normPName === normMethod || p.id === rawMethod || (normPName.length > 3 && normMethod.includes(normPName));
        });

        let targetBank: BankAccount | undefined;

        // 🏦 STEP 1: Direct link in PaymentMethodConfig (bank_account_id takes top priority!)
        if (pmConfig && pmConfig.bank_account_id) {
          targetBank = bankAccounts.find(a => a.id === pmConfig.bank_account_id);
        }

        // 🏦 STEP 2: Associated methods JSON in bankAccount.notes
        if (!targetBank) {
          targetBank = bankAccounts.find(a => {
            if (!a.notes) return false;
            try {
              const parsed = JSON.parse(a.notes);
              if (Array.isArray(parsed)) {
                return parsed.some(m => {
                  const mNorm = clean(m.name || '');
                  return mNorm === normMethod || (mNorm.length > 3 && normMethod.includes(mNorm)) || m.id === pmConfig?.id;
                });
              }
            } catch (e) {}
            return false;
          });
        }

        // 🏦 STEP 3: Institution keyword search in method name
        if (!targetBank) {
          const isBanesco = normMethod.includes('banesco');
          const isVenezuela = normMethod.includes('venezuela') || normMethod.includes('bdv') || normMethod.includes('vzla');
          const isBNC = normMethod.includes('bnc') || normMethod.includes('nacional de credito') || (normMethod.includes('credito') && !normMethod.includes('tarjeta'));
          const isMercantil = normMethod.includes('mercantil');
          const isProvincial = normMethod.includes('provincial') || normMethod.includes('bbva');
          const isBofA = normMethod.includes('bofa') || normMethod.includes('bank of america') || normMethod.includes('america');
          const isZelle = normMethod.includes('zelle');
          const isBinance = normMethod.includes('binance') || normMethod.includes('usdt');
          
          const isEfectivoVES = (normMethod.includes('efectivo') || normMethod.includes('cash')) && 
                               (normMethod.includes('ves') || normMethod.includes('bs') || normMethod.includes('bolivar') || normMethod.includes('bolivares'));
          
          const isEfectivoUSD = normMethod === 'efectivo' || 
                               normMethod === 'efectivo usd' || 
                               normMethod === 'efectivo dolares' || 
                               normMethod === 'efectivo dólares' || 
                               normMethod === 'dolares' || 
                               normMethod === 'usd' || 
                               ((normMethod.includes('efectivo') || normMethod.includes('cash')) && !isEfectivoVES);

          if (isBanesco) {
            targetBank = bankAccounts.find(a => clean(`${a.name} ${a.bank_name || ''}`).includes('3750')) ||
                         bankAccounts.find(a => clean(`${a.name} ${a.bank_name || ''}`).includes('banesco'));
          } else if (isVenezuela) {
            targetBank = bankAccounts.find(a => {
              const aText = clean(`${a.name} ${a.bank_name || ''}`);
              return aText.includes('ahorro') && (aText.includes('venezuela') || aText.includes('bdv') || aText.includes('vzla'));
            }) || bankAccounts.find(a => {
              const aText = clean(`${a.name} ${a.bank_name || ''}`);
              return aText.includes('venezuela') || aText.includes('bdv') || aText.includes('vzla');
            });
          } else if (isBNC) {
            targetBank = bankAccounts.find(a => {
              const aText = clean(`${a.name} ${a.bank_name || ''}`);
              return aText.includes('bnc') || aText.includes('nacional de credito') || aText.includes('credito');
            });
          } else if (isMercantil) {
            targetBank = bankAccounts.find(a => clean(`${a.name} ${a.bank_name || ''}`).includes('mercantil'));
          } else if (isProvincial) {
            targetBank = bankAccounts.find(a => {
              const aText = clean(`${a.name} ${a.bank_name || ''}`);
              return aText.includes('provincial') || aText.includes('bbva');
            });
          } else if (isBofA) {
            targetBank = bankAccounts.find(a => {
              const aText = clean(`${a.name} ${a.bank_name || ''}`);
              return aText.includes('bofa') || aText.includes('america');
            });
          } else if (isZelle) {
            targetBank = bankAccounts.find(a => {
              const aText = clean(`${a.name} ${a.bank_name || ''}`);
              return aText.includes('zelle') || (a.currency === 'USD' && aText.includes('dolar'));
            });
          } else if (isBinance) {
            targetBank = bankAccounts.find(a => {
              const aText = clean(`${a.name} ${a.bank_name || ''}`);
              return aText.includes('binance') || (a.currency === 'USD' && aText.includes('dolar'));
            });
          } else if (isEfectivoUSD) {
            targetBank = bankAccounts.find(a => {
              const aText = clean(`${a.name} ${a.bank_name || ''}`);
              return (aText.includes('efectivo') && (aText.includes('dolar') || aText.includes('dolares'))) || aText === 'efectivo dolares';
            }) || bankAccounts.find(a => {
              const aText = clean(`${a.name} ${a.bank_name || ''}`);
              return a.currency === 'USD' && (aText.includes('efectivo') || aText.includes('caja') || aText.includes('dolar'));
            }) || bankAccounts.find(a => a.currency === 'USD');
          } else if (isEfectivoVES) {
            targetBank = bankAccounts.find(a => {
              const aText = clean(`${a.name} ${a.bank_name || ''}`);
              return a.currency === 'VES' && (aText.includes('efectivo') || aText.includes('caja') || aText.includes('bolivar'));
            }) || bankAccounts.find(a => a.currency === 'VES' && clean(a.name).includes('efectivo'));
          }
        }

        // 🏦 STEP 4: Substring matching with bank account names
        if (!targetBank) {
          targetBank = bankAccounts.find(a => {
            const aNameNorm = clean(a.name);
            const aBankNorm = clean(a.bank_name || '');
            return normMethod.includes(aNameNorm) || (aNameNorm.length > 3 && normMethod.includes(aNameNorm)) ||
                   (aBankNorm.length > 3 && normMethod.includes(aBankNorm));
          });
        }

        // 🏦 STEP 5: Intelligent Fallback by currency (differentiating Cash vs Bank/Digital)
        if (!targetBank) {
          const isUsdMethod = entry.currency === 'USD' || normMethod.includes('usd') || normMethod.includes('dolar') || normMethod.includes('zelle');
          const isCashMethod = normMethod.includes('efectivo') || normMethod.includes('cash');

          if (isCashMethod) {
            targetBank = bankAccounts.find(a => a.currency === (isUsdMethod ? 'USD' : 'VES') && (clean(a.name).includes('efectivo') || clean(a.name).includes('caja')))
                      || bankAccounts.find(a => a.currency === (isUsdMethod ? 'USD' : 'VES'));
          } else {
            // Non-cash digital/bank payment method: PREFER a non-cash bank account over cash/box!
            targetBank = bankAccounts.find(a => a.currency === (isUsdMethod ? 'USD' : 'VES') && !clean(a.name).includes('efectivo') && !clean(a.name).includes('caja'))
                      || bankAccounts.find(a => a.currency === (isUsdMethod ? 'USD' : 'VES'));
          }
          if (!targetBank) {
            targetBank = bankAccounts[0];
          }
        }

        if (targetBank) {
          const isBankVES = targetBank.currency === 'VES';
          let creditAmount = isBankVES ? entry.amountVes : entry.amountUsd;

          // Deduct incoming commission if configured
          const commissionPercent = pmConfig?.incoming_commission || 0;
          if (commissionPercent > 0) {
            creditAmount = creditAmount - (creditAmount * (commissionPercent / 100));
          }

          creditAmount = parseFloat(creditAmount.toFixed(2));

          // 1. Update bank account balance
          targetBank.balance = Number(targetBank.balance || 0) + creditAmount;
          targetBank.updated_at = new Date().toISOString();
          await this.saveBankAccount(targetBank);

          // 2. Prepare movement record for bank_transfers
          const docTypeLabel = params.invoice.document_type === 'nota_entrega' ? 'Nota de Entrega' : 'Factura';
          const docNum = params.invoice.control_number || params.invoice.invoice_number || '';
          const clientName = params.invoice.customer_name || 'Consumidor Final';

          const transferItem: BankTransfer = {
            id: crypto.randomUUID(),
            to_account_id: targetBank.id,
            to_account_name: targetBank.name || targetBank.bank_name,
            amount: creditAmount,
            currency: targetBank.currency,
            exchange_rate: isBankVES ? entry.rate : undefined,
            converted_amount: creditAmount,
            reference: docNum ? `POS-${docNum}` : `VENTA-${Date.now().toString().slice(-6)}`,
            notes: `Ingreso Venta Flash (${entry.method}) - ${docTypeLabel} #${docNum} (${clientName})`,
            created_by: params.createdBy || params.invoice.created_by || 'Cajero POS',
            created_at: params.invoice.created_at || new Date().toISOString()
          };

          transfersToInsert.push(transferItem);
        }
      }

      if (transfersToInsert.length > 0) {
        const currentTransfers = await this.getBankTransfers();
        const updatedTransfers = [...transfersToInsert, ...currentTransfers];
        localStorage.setItem('copias_bellavista_bank_transfers', JSON.stringify(updatedTransfers));

        if (supabase) {
          try {
            await supabase.from('bank_transfers').insert(transfersToInsert);
          } catch (e) {
            console.warn("Error inserting bank transfers in Supabase:", e);
          }
        }

        window.dispatchEvent(new CustomEvent('bellavista_bank_accounts_updated'));
        window.dispatchEvent(new CustomEvent('bellavista_bank_transfers_updated', { detail: updatedTransfers }));
      }
    } catch (err) {
      console.error("Error in recordSaleIncomeToBankAccounts:", err);
    }
  },

  // ============================================================================
  // FINANZAS: GASTOS FIJOS Y VARIABLES
  // ============================================================================

  async getGastosFijos(): Promise<GastoFijo[]> {
    if (!supabase) return this._getLocalFallback('gastos_fijos', [] as GastoFijo[]);
    try {
      const { data, error } = await supabase.from('gastos_fijos').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        localStorage.setItem('copias_bellavista_gastos_fijos', JSON.stringify(data));
        return data as GastoFijo[];
      }
    } catch (e) {}
    return this._getLocalFallback('gastos_fijos', [] as GastoFijo[]);
  },

  async saveGastoFijo(gasto: GastoFijo): Promise<GastoFijo> {
    const isNew = !gasto.id;
    if (isNew) gasto.id = crypto.randomUUID();
    
    gasto.updated_at = new Date().toISOString();

    const current = await this.getGastosFijos();
    const updated = isNew ? [gasto, ...current] : current.map(g => g.id === gasto.id ? gasto : g);
    localStorage.setItem('copias_bellavista_gastos_fijos', JSON.stringify(updated));

    if (supabase) {
      try {
        await supabase.from('gastos_fijos').upsert(gasto, { onConflict: 'id' });
      } catch (e) {}
    }

    window.dispatchEvent(new CustomEvent('bellavista_gastos_fijos_updated', { detail: updated }));
    return gasto;
  },

  async deleteGastoFijo(id: string): Promise<boolean> {
    const current = await this.getGastosFijos();
    const updated = current.filter(g => g.id !== id);
    localStorage.setItem('copias_bellavista_gastos_fijos', JSON.stringify(updated));

    if (supabase) {
      try {
        await supabase.from('gastos_fijos').delete().eq('id', id);
      } catch (e) {}
    }
    window.dispatchEvent(new CustomEvent('bellavista_gastos_fijos_updated', { detail: updated }));
    return true;
  },

  async getGastoFijoPayments(): Promise<GastoFijoPayment[]> {
    if (!supabase) return this._getLocalFallback('gastos_fijos_payments', [] as GastoFijoPayment[]);
    try {
      const { data, error } = await supabase.from('gastos_fijos_payments').select('*').order('payment_date', { ascending: false });
      if (error) throw error;
      if (data) {
        localStorage.setItem('copias_bellavista_gastos_fijos_payments', JSON.stringify(data));
        return data as GastoFijoPayment[];
      }
    } catch (e) {}
    return this._getLocalFallback('gastos_fijos_payments', [] as GastoFijoPayment[]);
  },

  async payGastoFijo(payment: GastoFijoPayment, updateStatus?: string, updateNextDate?: string): Promise<GastoFijoPayment> {
    payment.id = crypto.randomUUID();
    if (!payment.created_at) payment.created_at = new Date().toISOString();

    const current = await this.getGastoFijoPayments();
    const updated = [payment, ...current];
    localStorage.setItem('copias_bellavista_gastos_fijos_payments', JSON.stringify(updated));

    // Deduct from bank if applicable with correct currency conversion & movement record
    if (payment.bank_account_id) {
      const bankAccounts = await this.getBankAccounts();
      const bank = bankAccounts.find(a => a.id === payment.bank_account_id);
      if (bank) {
        const isVES = bank.currency === 'VES';
        const amountToDeduct = isVES ? (Number(payment.amount_bs) || (Number(payment.amount) * 45)) : Number(payment.amount);
        
        bank.balance = Number(bank.balance) - amountToDeduct;
        bank.updated_at = new Date().toISOString();
        await this.saveBankAccount(bank);

        // Record movement in bank_transfers
        const bankMovement: BankTransfer = {
          id: crypto.randomUUID(),
          from_account_id: bank.id,
          from_account_name: bank.name || bank.bank_name,
          amount: amountToDeduct,
          currency: bank.currency,
          exchange_rate: isVES ? (amountToDeduct / (Number(payment.amount) || 1)) : undefined,
          converted_amount: amountToDeduct,
          reference: payment.reference || 'PAGO-GASTO',
          notes: payment.notes || `Pago de gasto fijo (${payment.payment_method})`,
          created_by: payment.created_by || 'Administrador',
          created_at: payment.payment_date || new Date().toISOString()
        };

        const currentTransfers = await this.getBankTransfers();
        const updatedTransfers = [bankMovement, ...currentTransfers];
        localStorage.setItem('copias_bellavista_bank_transfers', JSON.stringify(updatedTransfers));
        if (supabase) {
          try {
            await supabase.from('bank_transfers').insert(bankMovement);
          } catch (e) {}
        }
        window.dispatchEvent(new CustomEvent('bellavista_bank_transfers_updated', { detail: updatedTransfers }));
      }
    }

    // Update the gasto status
    if (updateStatus || updateNextDate) {
      const gastos = await this.getGastosFijos();
      const gasto = gastos.find(g => g.id === payment.gasto_fijo_id);
      if (gasto) {
        if (updateStatus) gasto.status = updateStatus as any;
        if (updateNextDate) gasto.next_due_date = updateNextDate;
        gasto.last_paid_date = payment.payment_date;
        await this.saveGastoFijo(gasto);
      }
    }

    if (supabase) {
      try {
        await supabase.from('gastos_fijos_payments').insert(payment);
      } catch (e) {}
    }

    window.dispatchEvent(new CustomEvent('bellavista_gastos_fijos_payments_updated', { detail: updated }));
    return payment;
  },

  // ============================================================================
  // FINANZAS: CUENTAS POR PAGAR (CxP)
  // ============================================================================

  async getAccountsPayable(): Promise<AccountPayable[]> {
    if (!supabase) return this._getLocalFallback('accounts_payable', [] as AccountPayable[]);
    try {
      const { data, error } = await supabase.from('accounts_payable').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        localStorage.setItem('copias_bellavista_accounts_payable', JSON.stringify(data));
        return data as AccountPayable[];
      }
    } catch (e) {}
    return this._getLocalFallback('accounts_payable', [] as AccountPayable[]);
  },

  async saveAccountPayable(cxp: AccountPayable): Promise<AccountPayable> {
    const isNew = !cxp.id;
    if (isNew) cxp.id = crypto.randomUUID();
    cxp.updated_at = new Date().toISOString();

    const current = await this.getAccountsPayable();
    const updated = isNew ? [cxp, ...current] : current.map(c => c.id === cxp.id ? cxp : c);
    localStorage.setItem('copias_bellavista_accounts_payable', JSON.stringify(updated));

    if (supabase) {
      try {
        await supabase.from('accounts_payable').upsert(cxp, { onConflict: 'id' });
      } catch (e) {}
    }

    window.dispatchEvent(new CustomEvent('bellavista_accounts_payable_updated', { detail: updated }));
    return cxp;
  },

  async deleteAccountPayable(id: string): Promise<boolean> {
    const current = await this.getAccountsPayable();
    const updated = current.filter(c => c.id !== id);
    localStorage.setItem('copias_bellavista_accounts_payable', JSON.stringify(updated));

    if (supabase) {
      try {
        await supabase.from('accounts_payable').delete().eq('id', id);
      } catch (e) {}
    }
    window.dispatchEvent(new CustomEvent('bellavista_accounts_payable_updated', { detail: updated }));
    return true;
  },

  async getAccountsPayablePayments(): Promise<AccountPayablePayment[]> {
    if (!supabase) return this._getLocalFallback('accounts_payable_payments', [] as AccountPayablePayment[]);
    try {
      const { data, error } = await supabase.from('accounts_payable_payments').select('*').order('payment_date', { ascending: false });
      if (error) throw error;
      if (data) {
        localStorage.setItem('copias_bellavista_accounts_payable_payments', JSON.stringify(data));
        return data as AccountPayablePayment[];
      }
    } catch (e) {}
    return this._getLocalFallback('accounts_payable_payments', [] as AccountPayablePayment[]);
  },

  async payAccountPayable(payment: AccountPayablePayment): Promise<AccountPayablePayment> {
    payment.id = crypto.randomUUID();
    if (!payment.created_at) payment.created_at = new Date().toISOString();

    const current = await this.getAccountsPayablePayments();
    const updated = [payment, ...current];
    localStorage.setItem('copias_bellavista_accounts_payable_payments', JSON.stringify(updated));

    // Deduct from bank account with currency conversion & bank movement registration
    if (payment.bank_account_id) {
      const bankAccounts = await this.getBankAccounts();
      const bank = bankAccounts.find(a => a.id === payment.bank_account_id);
      if (bank) {
        const isVES = bank.currency === 'VES';
        const amountToDeduct = isVES ? (Number(payment.amount_bs) || (Number(payment.amount) * 45)) : Number(payment.amount);
        
        bank.balance = Number(bank.balance) - amountToDeduct;
        bank.updated_at = new Date().toISOString();
        await this.saveBankAccount(bank);

        // Record movement in bank_transfers for audit and history in Cuentas Bancarias
        const bankMovement: BankTransfer = {
          id: crypto.randomUUID(),
          from_account_id: bank.id,
          from_account_name: bank.name || bank.bank_name,
          amount: amountToDeduct,
          currency: bank.currency,
          exchange_rate: isVES ? (amountToDeduct / (Number(payment.amount) || 1)) : undefined,
          converted_amount: amountToDeduct,
          reference: payment.reference || 'PAGO-CXP',
          notes: payment.notes || `Pago de cuenta por pagar (${payment.payment_method})`,
          created_by: payment.created_by || 'Administrador',
          created_at: payment.payment_date || new Date().toISOString()
        };

        const currentTransfers = await this.getBankTransfers();
        const updatedTransfers = [bankMovement, ...currentTransfers];
        localStorage.setItem('copias_bellavista_bank_transfers', JSON.stringify(updatedTransfers));
        if (supabase) {
          try {
            await supabase.from('bank_transfers').insert(bankMovement);
          } catch (e) {}
        }
        window.dispatchEvent(new CustomEvent('bellavista_bank_transfers_updated', { detail: updatedTransfers }));
      }
    }

    const cxps = await this.getAccountsPayable();
    const cxp = cxps.find(c => c.id === payment.account_payable_id);
    if (cxp) {
      cxp.paid_amount = Number(cxp.paid_amount) + payment.amount;
      cxp.remaining_amount = Math.max(0, Number(cxp.total_amount) - cxp.paid_amount);
      if (cxp.remaining_amount <= 0) cxp.status = 'pagado';
      else cxp.status = 'parcial';
      await this.saveAccountPayable(cxp);
    }

    if (supabase) {
      try {
        await supabase.from('accounts_payable_payments').insert(payment);
      } catch (e) {}
    }

    window.dispatchEvent(new CustomEvent('bellavista_accounts_payable_payments_updated', { detail: updated }));
    return payment;
  },

  async payBatchAccountsPayable(entityName: string, totalPaymentAmount: number, basePaymentData: Omit<AccountPayablePayment, 'id' | 'amount' | 'account_payable_id'>): Promise<AccountPayablePayment[]> {
    const allCxP = await this.getAccountsPayable();
    const entityCxPs = allCxP
      .filter(c => ((c.entity_name || c.provider_name || '').toLowerCase() === entityName.toLowerCase()) && (Number(c.remaining_amount) > 0 || c.status === 'pendiente' || c.status === 'parcial'))
      .sort((a, b) => new Date(a.issue_date || a.created_at || 0).getTime() - new Date(b.issue_date || b.created_at || 0).getTime());

    let remainingToPay = totalPaymentAmount;
    const generatedPayments: AccountPayablePayment[] = [];

    for (const cxp of entityCxPs) {
      if (remainingToPay <= 0.001) break;
      const amountForThis = Math.min(remainingToPay, Number(cxp.remaining_amount));
      if (amountForThis > 0) {
        const payment: AccountPayablePayment = {
          id: crypto.randomUUID(),
          account_payable_id: cxp.id,
          cxp_id: cxp.id,
          amount: amountForThis,
          amount_bs: basePaymentData.amount_bs ? (basePaymentData.amount_bs * (amountForThis / totalPaymentAmount)) : undefined,
          payment_method: basePaymentData.payment_method,
          bank_account_id: basePaymentData.bank_account_id,
          payment_date: basePaymentData.payment_date || new Date().toISOString(),
          reference: basePaymentData.reference,
          notes: basePaymentData.notes || `Pago agrupado a ${entityName}`,
          created_by: basePaymentData.created_by,
          created_at: new Date().toISOString()
        };
        await this.payAccountPayable(payment);
        generatedPayments.push(payment);
        remainingToPay -= amountForThis;
      }
    }
    return generatedPayments;
  },

  // ============================================================================
  // FINANZAS: CUENTAS POR COBRAR (CxC)
  // ============================================================================

  async getAccountsReceivable(): Promise<AccountReceivable[]> {
    if (!supabase) return this._getLocalFallback('accounts_receivable', [] as AccountReceivable[]);
    try {
      const { data, error } = await supabase.from('accounts_receivable').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        localStorage.setItem('copias_bellavista_accounts_receivable', JSON.stringify(data));
        return data as AccountReceivable[];
      }
    } catch (e) {}
    return this._getLocalFallback('accounts_receivable', [] as AccountReceivable[]);
  },

  async saveAccountReceivable(cxc: AccountReceivable): Promise<AccountReceivable> {
    const isNew = !cxc.id;
    if (isNew) cxc.id = crypto.randomUUID();
    cxc.updated_at = new Date().toISOString();

    const current = await this.getAccountsReceivable();
    const updated = isNew ? [cxc, ...current] : current.map(c => c.id === cxc.id ? cxc : c);
    localStorage.setItem('copias_bellavista_accounts_receivable', JSON.stringify(updated));

    if (supabase) {
      try {
        await supabase.from('accounts_receivable').upsert(cxc, { onConflict: 'id' });
      } catch (e) {}
    }

    window.dispatchEvent(new CustomEvent('bellavista_accounts_receivable_updated', { detail: updated }));
    return cxc;
  },

  async deleteAccountReceivable(id: string): Promise<boolean> {
    const current = await this.getAccountsReceivable();
    const updated = current.filter(c => c.id !== id);
    localStorage.setItem('copias_bellavista_accounts_receivable', JSON.stringify(updated));

    if (supabase) {
      try {
        await supabase.from('accounts_receivable').delete().eq('id', id);
      } catch (e) {}
    }
    window.dispatchEvent(new CustomEvent('bellavista_accounts_receivable_updated', { detail: updated }));
    return true;
  },

  async getAccountsReceivablePayments(): Promise<AccountReceivablePayment[]> {
    if (!supabase) return this._getLocalFallback('accounts_receivable_payments', [] as AccountReceivablePayment[]);
    try {
      const { data, error } = await supabase.from('accounts_receivable_payments').select('*').order('payment_date', { ascending: false });
      if (error) throw error;
      if (data) {
        localStorage.setItem('copias_bellavista_accounts_receivable_payments', JSON.stringify(data));
        return data as AccountReceivablePayment[];
      }
    } catch (e) {}
    return this._getLocalFallback('accounts_receivable_payments', [] as AccountReceivablePayment[]);
  },

  async payAccountReceivable(payment: AccountReceivablePayment): Promise<AccountReceivablePayment> {
    payment.id = crypto.randomUUID();
    if (!payment.created_at) payment.created_at = new Date().toISOString();

    const current = await this.getAccountsReceivablePayments();
    const updated = [payment, ...current];
    localStorage.setItem('copias_bellavista_accounts_receivable_payments', JSON.stringify(updated));

    // Credit to bank account with currency conversion & bank movement registration
    if (payment.bank_account_id) {
      const bankAccounts = await this.getBankAccounts();
      const bank = bankAccounts.find(a => a.id === payment.bank_account_id);
      if (bank) {
        const isVES = bank.currency === 'VES';
        const amountToCredit = isVES ? (Number(payment.amount_bs) || (Number(payment.amount) * 45)) : Number(payment.amount);
        
        bank.balance = Number(bank.balance) + amountToCredit;
        bank.updated_at = new Date().toISOString();
        await this.saveBankAccount(bank);

        // Record movement in bank_transfers for audit and history in Cuentas Bancarias
        const bankMovement: BankTransfer = {
          id: crypto.randomUUID(),
          to_account_id: bank.id,
          to_account_name: bank.name || bank.bank_name,
          amount: amountToCredit,
          currency: bank.currency,
          exchange_rate: isVES ? (amountToCredit / (Number(payment.amount) || 1)) : undefined,
          converted_amount: amountToCredit,
          reference: payment.reference || 'COBRO-CXC',
          notes: payment.notes || `Cobro de cuenta por cobrar (${payment.payment_method})`,
          created_by: payment.created_by || 'Administrador',
          created_at: payment.payment_date || new Date().toISOString()
        };

        const currentTransfers = await this.getBankTransfers();
        const updatedTransfers = [bankMovement, ...currentTransfers];
        localStorage.setItem('copias_bellavista_bank_transfers', JSON.stringify(updatedTransfers));
        if (supabase) {
          try {
            await supabase.from('bank_transfers').insert(bankMovement);
          } catch (e) {}
        }
        window.dispatchEvent(new CustomEvent('bellavista_bank_transfers_updated', { detail: updatedTransfers }));
      }
    }

    const cxcs = await this.getAccountsReceivable();
    const cxc = cxcs.find(c => c.id === payment.account_receivable_id);
    if (cxc) {
      cxc.paid_amount = Number(cxc.paid_amount) + payment.amount;
      cxc.remaining_amount = Math.max(0, Number(cxc.total_amount) - cxc.paid_amount);
      if (cxc.remaining_amount <= 0) cxc.status = 'cobrado';
      else cxc.status = 'parcial';
      await this.saveAccountReceivable(cxc);
    }

    if (supabase) {
      try {
        await supabase.from('accounts_receivable_payments').insert(payment);
      } catch (e) {}
    }

    window.dispatchEvent(new CustomEvent('bellavista_accounts_receivable_payments_updated', { detail: updated }));
    return payment;
  },

  async payBatchAccountsReceivable(entityName: string, totalPaymentAmount: number, basePaymentData: Omit<AccountReceivablePayment, 'id' | 'amount' | 'account_receivable_id'>): Promise<AccountReceivablePayment[]> {
    const allCxC = await this.getAccountsReceivable();
    const entityCxCs = allCxC
      .filter(c => ((c.entity_name || c.client_name || c.customer_name || '').toLowerCase() === entityName.toLowerCase()) && (Number(c.remaining_amount) > 0 || c.status === 'pendiente' || c.status === 'parcial'))
      .sort((a, b) => new Date(a.issue_date || a.created_at || 0).getTime() - new Date(b.issue_date || b.created_at || 0).getTime());

    let remainingToCollect = totalPaymentAmount;
    const generatedPayments: AccountReceivablePayment[] = [];

    for (const cxc of entityCxCs) {
      if (remainingToCollect <= 0.001) break;
      const amountForThis = Math.min(remainingToCollect, Number(cxc.remaining_amount));
      if (amountForThis > 0) {
        const payment: AccountReceivablePayment = {
          id: crypto.randomUUID(),
          account_receivable_id: cxc.id,
          cxc_id: cxc.id,
          amount: amountForThis,
          amount_bs: basePaymentData.amount_bs ? (basePaymentData.amount_bs * (amountForThis / totalPaymentAmount)) : undefined,
          payment_method: basePaymentData.payment_method,
          bank_account_id: basePaymentData.bank_account_id,
          payment_date: basePaymentData.payment_date || new Date().toISOString(),
          reference: basePaymentData.reference,
          notes: basePaymentData.notes || `Cobro agrupado a ${entityName}`,
          created_by: basePaymentData.created_by,
          created_at: new Date().toISOString()
        };
        await this.payAccountReceivable(payment);
        generatedPayments.push(payment);
        remainingToCollect -= amountForThis;
      }
    }
    return generatedPayments;
  }
};
