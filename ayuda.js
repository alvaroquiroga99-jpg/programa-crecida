/* Ayuda contextual: ícono ℹ junto a cada indicador con una explicación de cómo leerlo.
   No toca ningún dato ni lógica: solo agrega los íconos y un tooltip. */
(function () {
  "use strict";
  var TEXTOS = {
    "Mapa operativo": "El color de cada departamento refleja el riesgo hidrológico en vivo (aforos del INA). Rojo = emergencia, Naranja = preparación, Amarillo = vigilancia, Verde = sin afectación. Tocá un departamento para ver su detalle.",
    "Pronóstico de lluvia": "Lluvia prevista para las próximas 24 h (Open-Meteo), en bloques de 3 h. Cada bloque muestra los mm acumulados y la probabilidad (%). Más mm y más % = mayor chance de lluvia fuerte.",
    "Caudal de ríos · pronóstico": "Caudal previsto de los ríos (GloFAS, modelado). El número es el caudal de hoy en m³/s y la flecha la tendencia a 7 días (↑ crece, → estable, ↓ baja). Sirve para anticipar crecidas antes de que lo marque el aforo del INA.",
    "Contexto hídrico": "Aforos observados del INA en vivo: altura del río en metros. 'En crecida' cuenta las estaciones que están subiendo y 'Mayor altura' es el pico actual. Es el dato medido (complementa el pronóstico de ríos).",
    "Sugerencias de alerta": "Propuestas automáticas según los datos en vivo (INA/SMN). El color indica severidad (roja/naranja). 'Cargar en alerta' la pasa a una alerta manual para revisar y distribuir. Son sugerencias: siempre las valida una persona.",
    "Capas del mapa": "Activá o desactivá puntos de referencia en el mapa: 🚒 bomberos, 🚓 policía, 🔥 focos de calor (NASA), 🏥 efectores de salud y 🌧️ radar de lluvia. Tocá un punto para ver su información."
  };
  var tip = null;
  function norm(s) { return (s || "").replace(/\s+/g, " ").trim(); }
  function getTip() {
    if (!tip) { tip = document.createElement("div"); tip.className = "ayuda-tip"; tip.setAttribute("role", "tooltip"); document.body.appendChild(tip); }
    return tip;
  }
  function show(btn) {
    var t = getTip();
    t.textContent = btn.getAttribute("data-ayuda");
    t.style.display = "block";
    var r = btn.getBoundingClientRect();
    var tw = Math.min(300, window.innerWidth - 24);
    t.style.width = tw + "px";
    var left = Math.min(Math.max(8, r.left - 6), window.innerWidth - tw - 8);
    t.style.left = left + "px";
    t.style.top = (r.bottom + 8) + "px";
    if (r.bottom + 8 + t.offsetHeight > window.innerHeight - 8) {
      t.style.top = Math.max(8, r.top - t.offsetHeight - 8) + "px";
    }
  }
  function hide() { if (tip) tip.style.display = "none"; }
  function addIcon(elTitle, texto) {
    if (elTitle.classList.contains("ayuda-done")) return;
    elTitle.classList.add("ayuda-done");
    var b = document.createElement("button");
    b.type = "button"; b.className = "ayuda-ic"; b.textContent = "ℹ";
    b.setAttribute("aria-label", "Cómo se lee este indicador");
    b.setAttribute("data-ayuda", texto);
    b.addEventListener("mouseenter", function () { show(b); });
    b.addEventListener("mouseleave", function () { setTimeout(function () { if (!b._sticky) hide(); }, 80); });
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      document.querySelectorAll(".ayuda-ic").forEach(function (x) { if (x !== b) x._sticky = false; });
      b._sticky = !b._sticky;
      if (b._sticky) show(b); else hide();
    });
    elTitle.appendChild(b);
  }
  var pend = null;
  function aplicar() {
    document.querySelectorAll(".eyebrow, h2, h3").forEach(function (el) {
      if (el.classList.contains("ayuda-done")) return;
      var key = norm(el.textContent);
      if (TEXTOS[key]) addIcon(el, TEXTOS[key]);
    });
  }
  function aplicarDebounced() { clearTimeout(pend); pend = setTimeout(aplicar, 200); }
  document.addEventListener("click", function () {
    document.querySelectorAll(".ayuda-ic").forEach(function (b) { b._sticky = false; });
    hide();
  });
  window.addEventListener("scroll", hide, true);
  window.addEventListener("resize", hide);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", aplicar);
  else aplicar();
  try { new MutationObserver(aplicarDebounced).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  setTimeout(aplicar, 1500); setTimeout(aplicar, 3500);
})();
