// Smoothly brings a page section into view, moves focus there and briefly highlights it.
export function scrollToSection(id) {
  const element = document.getElementById(id);
  if (!element) return;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  element.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  element.focus({ preventScroll: true });
  element.classList.remove('section-flash');
  void element.offsetWidth;
  element.classList.add('section-flash');
}
