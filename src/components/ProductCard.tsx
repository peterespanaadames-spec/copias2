import React, { useState } from 'react';
import { Share2, AlertTriangle, MessageCircle, Star, CheckCircle2, ShoppingCart, Heart } from 'lucide-react';
import { motion } from 'motion/react';
import { Product } from '../types.ts';
import { CurrencyCode, CURRENCIES, formatCurrency } from '../lib/currency';
import { useI18n } from '../lib/i18n.ts';

interface ProductCardProps {
  product: Product;
  categoryName: string;
  brandName: string;
  images: string[];
  onViewDetails: (p: Product) => void;
  onShare: (p: Product, e: React.MouseEvent) => void;
  onWhatsAppQuery: (p: Product, e: React.MouseEvent) => void;
  onAddToCart?: (p: Product, e: React.MouseEvent) => void;
  activeCurrency: CurrencyCode;
  currencyRates: Record<CurrencyCode, number>;
  isWishlisted?: boolean;
  onToggleWishlist?: (p: Product, e: React.MouseEvent) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  categoryName,
  brandName,
  images,
  onViewDetails,
  onShare,
  onWhatsAppQuery,
  onAddToCart,
  activeCurrency,
  currencyRates,
  isWishlisted = false,
  onToggleWishlist
}) => {
  const { t } = useI18n();
  const [imageLoaded, setImageLoaded] = useState(false);

  let optimizedImage = images[0];
  if (optimizedImage && optimizedImage.includes('supabase.co') && !optimizedImage.includes('?')) {
    optimizedImage = `${optimizedImage}?width=400&quality=80&format=webp`;
  }
  const mainImage = optimizedImage || 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&q=80&w=400';

  const discountPercentage = product.offer_price 
    ? Math.round(((product.price - product.offer_price) / product.price) * 100)
    : 0;

  const formatPrice = (priceUSD: number) => {
    const rate = currencyRates[activeCurrency] || 1;
    const converted = priceUSD * rate;
    const config = CURRENCIES[activeCurrency];
    const isCOP = activeCurrency === 'COP';
    const decimals = config.decimals;
    
    const formattedNumStr = isCOP ? Math.round(converted).toFixed(0) : converted.toFixed(decimals);
    
    const standardParts = formattedNumStr.split('.');
    const integerPart = standardParts[0];
    const decimalPart = standardParts[1] || '';

    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, config.thousandSeparator);

    if (config.position === 'prefix') {
      return (
        <div className="flex items-start text-[#0F1111]">
          <span className="text-[10px] sm:text-[12px] font-extrabold mt-[2px] sm:mt-[4px] mr-[2px] sm:mr-[4px]">{config.symbol}</span>
          <span className="text-lg sm:text-[24px] md:text-[28px] font-black leading-none tracking-tight">{formattedInteger}</span>
          {decimals > 0 && decimalPart && (
            <span className="text-[10px] sm:text-[12px] font-bold ml-[1px] sm:ml-[2px] leading-none mt-[2px] sm:mt-[4px]">{config.decimalSeparator}{decimalPart}</span>
          )}
        </div>
      );
    } else {
      return (
        <div className="flex items-start text-[#0F1111]">
          <span className="text-lg sm:text-[24px] md:text-[28px] font-black leading-none tracking-tight">{formattedInteger}</span>
          {decimals > 0 && decimalPart && (
            <span className="text-[10px] sm:text-[12px] font-bold ml-[1px] sm:ml-[2px] leading-none mt-[2px] sm:mt-[4px]">{config.decimalSeparator}{decimalPart}</span>
          )}
          <span className="text-[10px] sm:text-[12px] font-extrabold mt-[2px] sm:mt-[4px] ml-[2px] sm:ml-[4px]">{config.symbol}</span>
        </div>
      );
    }
  };

  return (
    <div 
      onClick={() => onViewDetails(product)}
      className="bg-white rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col cursor-pointer group select-none relative border border-gray-200 h-[310px] sm:h-[390px] md:h-[420px]"
      id={`product-card-${product.id}`}
    >
      {/* Top Image area */}
      <div className="relative pt-[80%] sm:pt-[100%] bg-white overflow-hidden border-b border-gray-100">
        {/* Badges top-left */}
        <div className="absolute top-1.5 left-1.5 sm:top-2.5 sm:left-2.5 z-10 flex flex-col gap-1">
          {product.featured && (
            <span className="bg-[#FF9900] text-[#131921] text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 rounded shadow-xs uppercase tracking-wide">
              {t('product.featured', 'Destacado')}
            </span>
          )}
          {discountPercentage > 0 && (
            <span className="bg-red-600 text-white text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 rounded shadow-xs tracking-wide">
              -{discountPercentage}%
            </span>
          )}
        </div>

        {/* Action icons top-right */}
        <div className="absolute top-1.5 right-1.5 sm:top-2.5 sm:right-2.5 z-10 flex flex-col gap-1 sm:gap-1.5">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              onToggleWishlist?.(product, e);
            }}
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border flex items-center justify-center shadow-xs transition cursor-pointer ${
              isWishlisted
                ? 'bg-red-50 text-red-500 border-red-200'
                : 'bg-white text-gray-400 hover:text-red-500 hover:bg-red-50 border-gray-200'
            }`}
            title={isWishlisted ? "Eliminar de la lista de deseos" : "Añadir a la lista de deseos"}
            id={`btn-wishlist-${product.id}`}
          >
            <motion.div
              key={isWishlisted ? 'wishlisted' : 'not-wishlisted'}
              initial={{ scale: 0.8 }}
              animate={{ scale: [0.8, 1.3, 1] }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="flex items-center justify-center"
            >
              <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isWishlisted ? 'fill-red-500 text-red-500' : ''}`} />
            </motion.div>
          </motion.button>
          <button
            onClick={(e) => onShare(product, e)}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white hover:bg-gray-100 border border-gray-200 hidden sm:flex items-center justify-center text-gray-700 shadow-xs transition cursor-pointer"
            title="Copiar enlace de producto"
            id={`btn-share-${product.id}`}
          >
            <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>

        {/* Placeholder SVG */}
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-4">
            <div className="w-full h-full bg-gray-100 rounded animate-pulse"></div>
          </div>
        )}

        {/* Product Image */}
        <img
          src={mainImage}
          alt={product.name}
          className={`absolute inset-0 w-full h-full object-contain p-2.5 sm:p-4 mix-blend-multiply group-hover:scale-105 transition-transform duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          referrerPolicy="no-referrer"
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
        />

        {/* Out of Stock visual mask overlay */}
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center backdrop-blur-[1px]">
            <span className="bg-gray-900 text-white text-[10px] sm:text-xs font-black uppercase tracking-wider px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md shadow-lg flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FF9900]" />
              {t('product.out_of_stock', 'Agotado')}
            </span>
          </div>
        )}
      </div>

      {/* Info Content Area */}
      <div className="p-2.5 sm:p-4 flex-1 flex flex-col text-left">
        {/* Product Name */}
        <h3 className="font-semibold text-xs sm:text-[13px] md:text-[14px] text-[#0F1111] line-clamp-2 leading-tight mb-1 sm:mb-2" title={product.name}>
          {product.name}
        </h3>

        {/* Price display */}
        <div className="mt-auto">
          {product.offer_price ? (
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1 sm:gap-1.5">
                {formatPrice(product.offer_price)}
                <span className="text-[10px] sm:text-xs text-gray-400 line-through">
                  {formatCurrency(product.price, activeCurrency, currencyRates)}
                </span>
              </div>
            </div>
          ) : (
            formatPrice(product.price)
          )}
        </div>

        {/* Add to Cart Button if onAddToCart is supplied */}
        {onAddToCart && (
          <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-100">
            {product.stock > 0 ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToCart(product, e);
                }}
                className="w-full h-[28px] sm:h-[30px] bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] font-bold text-[11px] sm:text-[13px] rounded-md transition flex items-center justify-center gap-1 sm:gap-2 cursor-pointer shadow-xs border border-[#F2C200] active:scale-95 duration-150"
              >
                <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">{t('product.add_to_cart', 'Añadir al Carrito')}</span>
              </button>
            ) : (
              <div className="w-full h-[28px] sm:h-[30px] bg-gray-100 text-gray-400 font-medium text-[11px] sm:text-[13px] rounded-md flex items-center justify-center gap-1 border border-gray-200">
                {t('product.out_of_stock', 'Agotado')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProductCard;
