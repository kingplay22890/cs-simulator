// Инициализация слайдера Win Rate
(function() {
  'use strict';
  
  let isInitialized = false;
  let observer = null;
  
  function switchWinRateSlide(slide) {
    const slides = document.querySelectorAll('.winrate-slide');
    slides.forEach(s => s.classList.remove('winrate-slide-active'));
    const targetSlide = document.querySelector(`.winrate-slide[data-slide="${slide}"]`);
    if (targetSlide) {
      targetSlide.classList.add('winrate-slide-active');
    }
  }
  
  function initWinRateSlider() {
    // Проверяем, не инициализирован ли уже слайдер
    const buttons = document.querySelectorAll('.winrate-slider-btn');
    if (buttons.length === 0) {
      return;
    }
    
    // Проверяем, есть ли уже обработчики
    let needsInit = false;
    buttons.forEach(btn => {
      if (!btn.hasAttribute('data-slider-initialized')) {
        needsInit = true;
      }
    });
    
    if (!needsInit && isInitialized) {
      return;
    }
    
    buttons.forEach(btn => {
      if (!btn.hasAttribute('data-slider-initialized')) {
        btn.setAttribute('data-slider-initialized', 'true');
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const target = btn.getAttribute('data-target');
          if (target) {
            switchWinRateSlide(target);
          }
        });
      }
    });
    
    isInitialized = true;
  }
  
  // Делаем функции глобальными
  window.switchWinRateSlide = switchWinRateSlide;
  window.initWinRateSlider = initWinRateSlider;
  
  // Инициализируем при загрузке DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initWinRateSlider, 200);
    });
  } else {
    setTimeout(initWinRateSlider, 200);
  }
})();

