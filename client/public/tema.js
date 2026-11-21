// Aplica el tema antes de pintar para evitar parpadeos
try { var t = localStorage.getItem('cio-tema'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
