import React, { useRef } from 'react';

export const PrinterLogoCarousel: React.FC = () => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const brands = [
    { name: 'HP', desc: 'LaserJet & DeskJet' },
    { name: 'Canon', desc: 'imageRUNNER & PIXMA' },
    { name: 'EPSON', desc: 'EcoTank & WorkForce' },
    { name: 'brother', desc: 'HL & MFC Series' },
    { name: 'xerox', desc: 'WorkCentre & VersaLink' },
    { name: 'RICOH', desc: 'Aficio & MP Series' },
    { name: 'SAMSUNG', desc: 'ProXpress & MultiXpress' },
    { name: 'KYOCERA', desc: 'TASKalfa & ECOSYS' },
    { name: 'KONICA MINOLTA', desc: 'bizhub Multifunction' },
    { name: 'Lexmark', desc: 'Enterprise Mono/Color' },
  ];

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -260 : 260;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4 px-1">
        <span className="text-xs uppercase font-extrabold tracking-wider text-[#5B6475]">
          Universal Hardware Compatibility (USB, Wi-Fi & LAN)
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scroll('left')}
            aria-label="Scroll left"
            className="w-7 h-7 rounded-full border border-[#E6E9F2] bg-white text-[#172031] hover:bg-gray-100 flex items-center justify-center font-bold text-xs transition-colors shadow-2xs"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            aria-label="Scroll right"
            className="w-7 h-7 rounded-full border border-[#E6E9F2] bg-white text-[#172031] hover:bg-gray-100 flex items-center justify-center font-bold text-xs transition-colors shadow-2xs"
          >
            →
          </button>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex items-center gap-4 overflow-x-auto scrollbar-none py-2 px-1 scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {brands.map((brand, idx) => (
          <div
            key={idx}
            className="shrink-0 bg-white border border-[#E6E9F2] rounded-xl px-5 py-3.5 flex flex-col items-center justify-center min-w-[145px] hover:border-[#4D64E6]/50 transition-colors shadow-2xs"
          >
            <span className="font-extrabold text-[#172031] text-sm tracking-wide uppercase">
              {brand.name}
            </span>
            <span className="text-[10px] text-[#98A2B3] mt-0.5 text-center whitespace-nowrap">
              {brand.desc}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
