# SweetSpot

> **Simulador Acústico Interactivo y Asistente Experimental de Posicionamiento de Monitores y Oyente.**
> 
> *Optimizar la ubicación física antes de intentar corregir electrónicamente.*

[![GitHub Pages](https://img.shields.io/badge/Demo%20En%20Vivo-GitHub%20Pages-0284c7?style=for-the-badge&logo=github)](https://lorenhey.github.io/SweetSpot/)
[![Python](https://img.shields.io/badge/Python-3.12-blue?style=flat-square&logo=python)](https://python.org)
[![PySide6](https://img.shields.io/badge/GUI-PySide6-41cd52?style=flat-square&logo=qt)](https://qt.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

---

## 🌐 Simulador Web Interactivo (Zero-Backend)

Probá el simulador directamente desde tu navegador sin instalar nada:

👉 **[https://lorenhey.github.io/SweetSpot/](https://lorenhey.github.io/SweetSpot/)**

- **Lienzo 2D a 60 FPS:** Arrastrá y ubicá libremente los monitores y tu cabeza en el plano métrico de la sala.
- **Física de Modos Propios:** Cálculo exacto de modos axiales, tangenciales y oblicuos mediante la fórmula de Rayleigh.
- **Corte de Schroeder ($f_s$):** Cálculo de la frontera entre comportamiento modal discreto y campo difuso.
- **Interferencias de Frontera (SBIR):** Cancelaciones de cuarto de onda ($\lambda / 4$) en tiempo real para paredes frontal, laterales, piso y techo.
- **Trazado de Rayos Especulares (RFZ):** Detección visual de los puntos de primeras reflexiones sobre los muros para ubicar paneles absorbentes con la técnica del espejo.
- **Asistente Heurístico:** Propuestas paso a paso de experimentos físicos modificando una variable a la vez.

---

## 🎯 Filosofía de Ingeniería

Antes de aplicar ecualización electrónica (Dirac, Sonarworks, miniDSP), **mové tus parlantes y tu silla**. 

Un nulo acústico profundo provocado por interferencia destructiva de frontera (SBIR) o un nodo axial de la sala es un **sistema de fase no mínima**:
1. La onda directa y la onda reflejada provienen del mismo parlante.
2. Si aplicás $+12\text{ dB}$ en el DSP a 80 Hz, amplificás tanto la onda directa como la que choca contra la pared.
3. Ambas se cancelan con la misma severidad en tus oídos, pero tu amplificador pierde todo el *headroom* y el parlante entra en distorsión armónica no lineal.

**Los problemas de ubicación física requieren soluciones acústicas físicas.**

---

## 📦 Suite de Escritorio Python (`sweetspot`)

Además de la aplicación web, el repositorio incluye el paquete de escritorio profesional en Python:

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/lorenhey/SweetSpot.git
cd SweetSpot

# Crear entorno virtual e instalar dependencias
uv sync

# O con pip tradicional:
python -m venv .venv
source .venv/bin/activate  # En Windows: .venv\Scripts\Activate.ps1
pip install -e .
```

### Ejecución de la Interfaz Gráfica (PySide6)

```bash
uv run sweetspot-gui
```

### CLI y Medición por Sine Sweep Logarítmico

```bash
# Ejecutar demo sintética
uv run sweetspot demo

# Generar barrido sinusoidal de prueba
uv run sweetspot sweep --start 20 --end 20000 --duration 5.0 --output sweep.wav

# Medir respuesta al impulso real con interfaz de audio y micrófono calibrado
uv run sweetspot measure --input-device 1 --output-device 2 --out-dir ./mediciones
```

### Ejecución de Tests

```bash
$env:PYTHONPATH="src"; uv run pytest
```

---

## 📐 Criterios y Métricas Soportadas

- **Frecuencia de Schroeder:** $f_s \approx 2000 \sqrt{T_{60} / V}$
- **Ecuación de Rayleigh:** $f = \frac{c}{2} \sqrt{(n_x/W)^2 + (n_y/L)^2 + (n_z/H)^2}$
- **Nulo de Cuarto de Onda SBIR:** $f_{\text{null}} \approx \frac{c}{4 d_w}$
- **Criterio de Bonello:** Monotonía en densidad de modos por tercio de octava (20 Hz - 250 Hz).
- **Proporciones de Bolt & Sepmeyer:** Detección de degeneraciones modales en salas cúbicas o de planta cuadrada.
- **Regla del 38% de Wes Lachot:** Ubicación neutral respecto a nodos centrales (50%) y de cuartos de onda (25% / 75%).
- **Integración Retrocedida de Schroeder:** Extracción de EDT, T20 y T30 a partir de respuestas al impulso (IR).

---

## 📄 Licencia

Distribuido bajo licencia MIT. Consultá el archivo [LICENSE](LICENSE) para más información.
