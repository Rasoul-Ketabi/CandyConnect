import React, { useState, useEffect, useRef } from 'react';
import { ArrowDownIcon } from './icons';

interface ScrollDownArrowProps {
  containerRef: React.RefObject<HTMLElement>;
}

const ScrollDownArrow: React.FC<ScrollDownArrowProps> = ({ containerRef }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mouseDownRef = useRef(false);

  useEffect(() => {
    const checkScrollable = () => {
      if (containerRef.current) {
        const { scrollHeight, clientHeight, scrollTop } = containerRef.current;
        const isScrollable = scrollHeight > clientHeight;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
        setIsVisible(isScrollable && !isAtBottom);
      }
    };

    const handleScroll = () => {
      checkScrollable();
    };

    const container = containerRef.current;
    if (container) {
      checkScrollable();
      container.addEventListener('scroll', handleScroll);
      
      // Also check on resize
      const resizeObserver = new ResizeObserver(checkScrollable);
      resizeObserver.observe(container);

      return () => {
        container.removeEventListener('scroll', handleScroll);
        resizeObserver.disconnect();
      };
    }
  }, [containerRef]);

  const startScrolling = () => {
    if (!containerRef.current || isScrolling) return;
    
    setIsScrolling(true);
    mouseDownRef.current = true;

    const scroll = () => {
      if (containerRef.current && mouseDownRef.current) {
        containerRef.current.scrollBy({
          top: 8,
          behavior: 'smooth'
        });
        
        // Check if we've reached the bottom
        const { scrollHeight, clientHeight, scrollTop } = containerRef.current;
        if (scrollTop + clientHeight >= scrollHeight - 10) {
          stopScrolling();
          return;
        }
        
        scrollIntervalRef.current = setTimeout(scroll, 50);
      }
    };

    scroll();
  };

  const stopScrolling = () => {
    setIsScrolling(false);
    mouseDownRef.current = false;
    if (scrollIntervalRef.current) {
      clearTimeout(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  };

  const handleClick = () => {
    if (containerRef.current) {
      containerRef.current.scrollBy({
        top: 100,
        behavior: 'smooth'
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    startScrolling();
  };

  const handleMouseUp = () => {
    stopScrolling();
  };

  const handleMouseLeave = () => {
    stopScrolling();
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      stopScrolling();
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      stopScrolling();
    };
  }, []);

  if (!isVisible) return null;

  return (
    <button
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      className={`fixed bottom-6 right-6 z-50 w-12 h-12 bg-orange-500 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group ${
        isScrolling ? 'scale-95 bg-orange-600 dark:bg-orange-700' : 'hover:scale-105'
      }`}
      style={{
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <ArrowDownIcon 
        className={`w-6 h-6 transition-transform duration-300 ${
          isScrolling ? 'animate-bounce' : 'group-hover:translate-y-0.5'
        }`} 
      />
    </button>
  );
};

export default ScrollDownArrow;
