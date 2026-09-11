import React, { useRef, useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ShoppingCart, 
  Sparkles, 
  ArrowLeft, 
  ArrowRight, 
  Play, 
  Pause, 
  RotateCcw, 
  ArrowLeftRight,
  GripHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, Category, ProductImage, HomeCarouselCardItem } from '../types';
import { CurrencyCode, formatCurrency } from '../lib/currency';
import { dbService } from '../lib/supabase';

interface AmazonCarouselProps {
  products: Product[];
  categories: Category[];
  productImages: ProductImage[];
  onViewDetails: (product: Product) => void;
  onAddToCart?: (product: Product, e: React.MouseEvent) => void;
  activeCurrency: CurrencyCode;
  currencyRates: Record<CurrencyCode, number>;
  onSelectCategoryByName: (keyword: string) => void;
}

export default function AmazonCarousel({
  products,
  categories,
  productImages,
  onViewDetails,
  onAddToCart,
  activeCurrency,
  currencyRates,
  onSelectCategoryByName
}: AmazonCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [cardOrderConfig, setCardOrderConfig] = useState<HomeCarouselCardItem[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [autoSlideEnabled, setAutoSlideEnabled] = useState(true);
  const [swapNotice, setSwapNotice] = useState<string | null>(null);

  // Auto-scroll loop (moves from right to left smoothly)
  useEffect(() => {
    if (isPaused || !autoSlideEnabled) return;

    const interval = setInterval(() => {
      if (scrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        if (scrollLeft + clientWidth >= scrollWidth - 20) {
          scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          scrollRef.current.scrollBy({ left: 340, behavior: 'smooth' });
        }
      }
    }, 3200);

    return () => clearInterval(interval);
  }, [isPaused, autoSlideEnabled]);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const fetched = await dbService.getHomeCarouselCards();
        setCardOrderConfig(fetched);
      } catch (e) {
        console.error('Error loading carousel config:', e);
      }
    };
    loadConfig();
    window.addEventListener('bellavista_home_carousel_updated', loadConfig);
    return () => {
      window.removeEventListener('bellavista_home_carousel_updated', loadConfig);
    };
  }, []);

  // Helper to check scroll position to hide/show navigation arrows
  const checkScrollPosition = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 5);
      setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 5);
    }
  };

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (scrollEl) {
      scrollEl.addEventListener('scroll', checkScrollPosition);
      checkScrollPosition();
      window.addEventListener('resize', checkScrollPosition);
    }
    return () => {
      if (scrollEl) {
        scrollEl.removeEventListener('scroll', checkScrollPosition);
      }
      window.removeEventListener('resize', checkScrollPosition);
    };
  }, [products]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { clientWidth } = scrollRef.current;
      const scrollAmount = direction === 'left' ? -clientWidth * 0.8 : clientWidth * 0.8;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Helper to get product image or fallback
  const getProductImage = (product: Product): string => {
    const associated = productImages.find(img => img.product_id === product.id);
    if (associated?.image_url) return associated.image_url;
    if ((product as any).image_url) return (product as any).image_url;
    return 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&q=80&w=300';
  };

  // Find products matching categories
  const getProductsForCategoryKeyword = (categoryKeywords: string[], productKeywords: string[]): Product[] => {
    const matchedCategoryIds = categories
      .filter(c => c && c.name && categoryKeywords.some(kw => (c.name || '').toLowerCase().includes((kw || '').toLowerCase())))
      .map(c => c.id);

    let matchedProducts = products.filter(p => matchedCategoryIds.includes(p.category_id) && p.stock > 0);

    if (matchedProducts.length < 4) {
      const nameMatched = products.filter(p => 
        p && p.stock > 0 && 
        !matchedProducts.some(mp => mp.id === p.id) &&
        productKeywords.some(kw => 
          (p.name || '').toLowerCase().includes((kw || '').toLowerCase()) || 
          (p.description && (p.description || '').toLowerCase().includes((kw || '').toLowerCase()))
        )
      );
      matchedProducts = [...matchedProducts, ...nameMatched];
    }

    return matchedProducts.slice(0, 4);
  };

  const papeleriaProducts = getProductsForCategoryKeyword(
    ['papeleria', 'papelería'],
    ['papel', 'hoja', 'cartulina', 'cuaderno', 'lápiz', 'lapiz', 'bolígrafo', 'boligrafo', 'marcador', 'sacapuntas', 'borrador', 'tijera', 'regla', 'block', 'tempera', 'témpera', 'pincel', 'goma', 'pega', 'silicon', 'silicón']
  );
  const copiasProducts = getProductsForCategoryKeyword(
    ['copia', 'copias', 'impresion', 'impresión', 'encuadernacion', 'encuadernación', 'anillado', 'plastificado', 'digitalizacion', 'digitalización'],
    ['copia', 'copias', 'impresion', 'impresión', 'encuadernacion', 'encuadernación', 'anillado', 'plastificado', 'escaner', 'escáner']
  );
  const escolarProducts = getProductsForCategoryKeyword(
    ['escolar', 'útiles', 'utiles', 'colegio', 'escolares y marcadores', 'escolares', 'marcadores', 'escolares y utiles', 'escolares y útiles'],
    ['mochila', 'morral', 'cartuchera', 'sacapuntas', 'borrador', 'cuaderno', 'regla', 'marcador', 'marcadores', 'colores', 'creyones', 'lapiz', 'lápiz', 'lapices', 'lápices', 'tijera', 'pega', 'goma', 'tempera', 'témpera', 'escarcha']
  );
  const postresProducts = getProductsForCategoryKeyword(
    ['postre', 'postres', 'dulce', 'dulces', 'reposteria', 'repostería'],
    ['torta', 'tortas', 'quesillo', 'ponque', 'ponqué', 'galleta', 'galletas', 'chocolate', 'dulce', 'dulces', 'postre', 'postres', 'muffin', 'cupcake', 'brownie', 'marquesa']
  );

  const featuredProducts = products.filter(p => p.featured && p.stock > 0);
  const bestSellerProducts = products.filter(p => p.offer_price && p.stock > 0);

  const impresionesCategory = categories.find(c => 
    c && c.name && (
      (c.name || '').toLowerCase().includes('impresion') || 
      (c.name || '').toLowerCase().includes('copia') || 
      (c.name || '').toLowerCase().includes('copiado')
    )
  );
  const impresionesProducts = impresionesCategory 
    ? products.filter(p => p.category_id === impresionesCategory.id && p.stock > 0)
    : [];
  const nitidezCalidadProduct = impresionesProducts[0] || copiasProducts[0] || products.find(p => 
    p && p.name && (
      (p.name || '').toLowerCase().includes('copia') || 
      (p.name || '').toLowerCase().includes('impresion') || 
      (p.name || '').toLowerCase().includes('anillado')
    )
  ) || featuredProducts[0] || products[0];

  const singleFeatured1 = nitidezCalidadProduct;
  const singleFeatured2 = bestSellerProducts[0] || featuredProducts[1] || products[1];

  // Base raw cards definition
  const rawCards = [
    {
      id: 'cat-copias',
      type: 'grid',
      title: 'Copias & Encuadernación',
      subtitle: 'Rápidas, nítidas y listas al instante',
      bgClass: 'bg-gradient-to-br from-[#2f3542] to-[#1e272e] text-white',
      badge: 'Servicio Express',
      products: copiasProducts
    },
    {
      id: 'featured-1',
      type: 'single',
      title: 'Nitidez & Calidad',
      subtitle: 'Nuestros productos estrella de impresión',
      bgClass: 'bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 text-white',
      badge: 'Destacado',
      product: singleFeatured1
    },
    {
      id: 'cat-papeleria',
      type: 'grid',
      title: 'Papelería Creativa',
      subtitle: 'Todo para tus ideas al mejor precio',
      bgClass: 'bg-gradient-to-br from-[#c4e538] to-[#a3cb38] text-gray-900',
      badge: 'Ofertas Diarias',
      products: papeleriaProducts
    },
    {
      id: 'cat-escolar',
      type: 'grid',
      title: 'Útiles Escolares',
      subtitle: 'Ahorros diarios para el regreso a clases',
      bgClass: 'bg-gradient-to-br from-[#ff7f50] to-[#ff6347] text-white',
      badge: 'Temporada Escolar',
      products: escolarProducts
    },
    {
      id: 'cat-postres',
      type: 'grid',
      title: 'Dulces & Postres',
      subtitle: 'Un antojo delicioso para acompañar tu día',
      bgClass: 'bg-gradient-to-br from-[#f8c291] to-[#e77f67] text-gray-900',
      badge: 'Recién Horneado',
      products: postresProducts
    },
    {
      id: 'featured-2',
      type: 'single',
      title: 'Super Oferta del Día',
      subtitle: 'Estilos y productos con precios de locura',
      bgClass: 'bg-gradient-to-br from-[#00a8ff] to-[#0097e6] text-white',
      badge: 'Oferta Especial',
      product: singleFeatured2
    }
  ];

  // Order cards based on cardOrderConfig
  let cards = rawCards;
  if (cardOrderConfig && cardOrderConfig.length > 0) {
    const configMap = new Map<string, HomeCarouselCardItem>(cardOrderConfig.map(c => [c.id, c]));
    cards = [...rawCards]
      .filter(card => {
        const conf = configMap.get(card.id);
        return conf ? conf.enabled !== false : true;
      })
      .sort((a, b) => {
        const confA = configMap.get(a.id);
        const confB = configMap.get(b.id);
        const orderA = confA ? confA.sort_order : 99;
        const orderB = confB ? confB.sort_order : 99;
        return orderA - orderB;
      })
      .map(card => {
        const conf = configMap.get(card.id);
        if (conf) {
          return {
            ...card,
            title: conf.title || card.title,
            subtitle: conf.subtitle || card.subtitle,
            badge: conf.badge || card.badge
          };
        }
        return card;
      });
  }

  // Swap function to interchange position of two adjacent cards
  const handleSwapCards = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= cards.length) return;

    const newCards = [...cards];
    const temp = newCards[fromIndex];
    newCards[fromIndex] = newCards[toIndex];
    newCards[toIndex] = temp;

    // Show temporary notice
    setSwapNotice(`Tarjetas intercambiadas: "${temp.title}" movida a la posición #${toIndex + 1}`);
    setTimeout(() => setSwapNotice(null), 3000);

    // Save new order to config
    const updatedOrderItems: HomeCarouselCardItem[] = newCards.map((c, idx) => ({
      id: c.id,
      title: c.title,
      subtitle: c.subtitle,
      badge: c.badge,
      enabled: true,
      sort_order: idx + 1
    }));

    setCardOrderConfig(updatedOrderItems);

    try {
      await dbService.saveHomeCarouselCards(updatedOrderItems);
    } catch (e) {
      console.error('Error saving swapped cards order:', e);
    }
  };

  // Reset order to default configuration
  const handleResetOrder = async () => {
    const defaultOrderItems: HomeCarouselCardItem[] = rawCards.map((c, idx) => ({
      id: c.id,
      title: c.title,
      subtitle: c.subtitle,
      badge: c.badge,
      enabled: true,
      sort_order: idx + 1
    }));

    setCardOrderConfig(defaultOrderItems);
    setSwapNotice('Orden de tarjetas restablecido');
    setTimeout(() => setSwapNotice(null), 3000);

    try {
      await dbService.saveHomeCarouselCards(defaultOrderItems);
    } catch (e) {
      console.error('Error resetting cards order:', e);
    }
  };

  if (products.length === 0) return null;

  return (
    <div className="relative w-full my-6 select-none group/carousel max-w-[1440px] mx-auto px-1">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 px-2">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-[#FF9900] fill-[#FF9900] animate-pulse" />
          <h2 className="text-lg md:text-xl font-black text-[#131921] uppercase tracking-tight flex items-center gap-2">
            <span>Destacados & Categorías del Día</span>
          </h2>
        </div>
      </div>

      {/* Main Carousel Wrapper */}
      <div className="relative">
        {/* Left Scroll Button */}
        {showLeftArrow && (
          <button
            onClick={() => handleScroll('left')}
            className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-30 w-11 h-20 bg-white/95 hover:bg-white border border-gray-200 rounded-r-xl shadow-xl hover:shadow-2xl items-center justify-center transition duration-200 cursor-pointer text-gray-800 backdrop-blur-xs"
          >
            <ChevronLeft className="w-8 h-8 text-gray-900" />
          </button>
        )}

        {/* Right Scroll Button */}
        {showRightArrow && (
          <button
            onClick={() => handleScroll('right')}
            className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-30 w-11 h-20 bg-white/95 hover:bg-white border border-gray-200 rounded-l-xl shadow-xl hover:shadow-2xl items-center justify-center transition duration-200 cursor-pointer text-gray-800 backdrop-blur-xs"
          >
            <ChevronRight className="w-8 h-8 text-gray-900" />
          </button>
        )}

        {/* Scrollable Container with Motion Layout */}
        <div
          ref={scrollRef}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          className="flex gap-4 md:gap-5 overflow-x-auto pb-4 pt-1 px-2 scrollbar-none snap-x snap-mandatory scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {cards.map((card, idx) => {
            return (
              <motion.div
                layout
                key={card.id}
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                className={`snap-start shrink-0 w-[295px] md:w-[330px] h-[440px] rounded-2xl shadow-md border border-gray-200/50 p-5 flex flex-col justify-between ${card.bgClass} relative overflow-hidden transition-shadow duration-300 hover:shadow-xl group/card`}
              >
                {/* Top Control Bar: Card Badge & Swap / Move Buttons */}
                <div className="flex items-center justify-between gap-2 mb-2 z-20">
                  {/* Position Tag & Swap Controls */}
                  <div className="flex items-center gap-1 bg-black/30 backdrop-blur-md border border-white/20 p-1 rounded-full text-white shadow-sm">
                    {/* Move Left Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSwapCards(idx, idx - 1);
                      }}
                      disabled={idx === 0}
                      className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/30 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                      title="Mover hacia la izquierda"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 text-white" />
                    </button>

                    {/* Card Position Badge */}
                    <span className="text-[10px] font-black px-1.5 text-white/90 uppercase tracking-widest min-w-[20px] text-center">
                      #{idx + 1}
                    </span>

                    {/* Move Right Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSwapCards(idx, idx + 1);
                      }}
                      disabled={idx === cards.length - 1}
                      className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/30 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                      title="Mover hacia la derecha"
                    >
                      <ArrowRight className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>

                  {/* Accent Badge */}
                  {card.badge && (
                    <span className="bg-white/25 backdrop-blur-md text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full text-current shadow-2xs">
                      {card.badge}
                    </span>
                  )}
                </div>

                {/* Card Headings */}
                <div className="text-left pr-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider opacity-90 block mb-0.5">
                    {card.id.startsWith('featured') ? 'Recomendado' : 'Categorías'}
                  </span>
                  <h3 className="text-lg font-black leading-tight tracking-tight mb-1">
                    {card.title}
                  </h3>
                  <p className="text-[11px] font-medium leading-tight opacity-80">
                    {card.subtitle}
                  </p>
                </div>

                {/* Card Content Area */}
                {card.type === 'grid' && card.products ? (
                  /* 2X2 Grid Layout for Category Cards */
                  <div className="grid grid-cols-2 gap-2.5 my-2.5 flex-1 justify-center content-center">
                    {card.products.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => onViewDetails(p)}
                        className="bg-white rounded-xl p-2 flex flex-col items-center justify-between h-[125px] hover:scale-102 transition duration-200 cursor-pointer border border-gray-100 shadow-xs relative"
                      >
                        {/* Image inside box */}
                        <div className="w-full h-[75px] flex items-center justify-center overflow-hidden">
                          <img
                            src={getProductImage(p)}
                            alt={p.name}
                            className="max-w-full max-h-full object-contain mix-blend-multiply"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        {/* Short Caption */}
                        <div className="w-full text-center mt-1">
                          <p className="text-[10px] text-gray-700 font-bold truncate px-0.5" title={p.name}>
                            {p.name}
                          </p>
                          <span className="text-[11px] font-black text-[#007185]">
                            {formatCurrency(p.offer_price || p.price, activeCurrency, currencyRates)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : card.product ? (
                  /* Single Large Product Card Layout for Featured items */
                  <div
                    onClick={() => onViewDetails(card.product!)}
                    className="bg-white rounded-xl p-4 my-2 flex-1 flex flex-col justify-between hover:scale-[1.02] transition duration-200 cursor-pointer border border-gray-100 shadow-sm relative group/single"
                  >
                    {/* Discount badge inside white container */}
                    {card.product.offer_price && (
                      <span className="absolute top-2.5 left-2.5 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-sm">
                        OFERTA
                      </span>
                    )}

                    {/* Image Area */}
                    <div className="w-full h-[175px] flex items-center justify-center overflow-hidden relative p-1 mt-1">
                      <img
                        src={getProductImage(card.product)}
                        alt={card.product.name}
                        className="max-w-full max-h-full object-contain mix-blend-multiply transition duration-300 group-hover/single:scale-110"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    {/* Footer Info Area */}
                    <div className="text-left mt-2 border-t border-gray-100 pt-2 flex items-end justify-between">
                      <div className="flex-1 min-w-0 pr-2">
                        <h4 className="text-xs font-black text-gray-900 truncate" title={card.product.name}>
                          {card.product.name}
                        </h4>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className="text-[15px] font-black text-emerald-600">
                            {formatCurrency(card.product.offer_price || card.product.price, activeCurrency, currencyRates)}
                          </span>
                          {card.product.offer_price && (
                            <span className="text-[10px] text-gray-400 line-through font-bold">
                              {formatCurrency(card.product.price, activeCurrency, currencyRates)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Add to Cart quick button */}
                      {onAddToCart && card.product.stock > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddToCart(card.product!, e);
                          }}
                          className="w-8.5 h-8.5 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] rounded-full flex items-center justify-center transition border border-[#F2C200] active:scale-95 shadow-sm hover:shadow"
                          title="Añadir al Carrito"
                        >
                          <ShoppingCart className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-xs opacity-75">No hay productos para mostrar</p>
                  </div>
                )}

                {/* Footer view link & Drag / Swap helper */}
                <div className="text-left flex items-center justify-between pt-1">
                  {card.type === 'grid' ? (
                    <button
                      onClick={() => {
                        if (card.id === 'cat-copias') {
                          onSelectCategoryByName('copias');
                        } else if (card.id === 'cat-papeleria') {
                          onSelectCategoryByName('papelería');
                        } else if (card.id === 'cat-escolar') {
                          onSelectCategoryByName('Escolares y utiles');
                        } else if (card.id === 'cat-postres') {
                          onSelectCategoryByName('postres');
                        } else {
                          onSelectCategoryByName(card.title);
                        }
                      }}
                      className="text-[11px] font-bold uppercase tracking-wider hover:underline flex items-center gap-1 cursor-pointer focus:outline-none"
                    >
                      Ver más ofertas &rarr;
                    </button>
                  ) : card.product ? (
                    <button
                      onClick={() => onViewDetails(card.product!)}
                      className="text-[11px] font-bold uppercase tracking-wider hover:underline flex items-center gap-1 cursor-pointer focus:outline-none"
                    >
                      Comprar ahora &rarr;
                    </button>
                  ) : null}

                  </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

