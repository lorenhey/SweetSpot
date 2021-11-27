# SweetSpot

[Español](#español) · [English](#english)

Simulador web / Web tool: [https://lorenhey.github.io/SweetSpot/](https://lorenhey.github.io/SweetSpot/)

---

## Español

Asistente experimental y herramienta de acústica de salas para ubicar dos monitores de estudio y una única posición de escucha antes de recurrir a ecualización electrónica.

La premisa de trabajo es directa: el modelo geométrico sugiere qué probar, y el micrófono decide en la sala real. El ciclo consiste en medir, cambiar una sola variable física por vez (posición del oyente, distancia a la pared frontal, separación o toe-in), volver a medir y comparar qué mejoró y qué empeoró.

### Herramienta web (GitHub Pages)

Disponible en [https://lorenhey.github.io/SweetSpot/](https://lorenhey.github.io/SweetSpot/) sin backend ni instalación (con selector `ES / EN` en la barra superior):

- Planta 2D interactiva de sala rectangular con arrastre de monitores y oyente.
- Modos propios teóricos (axiales, tangenciales y oblicuos según Rayleigh) con mapa de presión 2D al hacer clic en cualquier modo.
- Frecuencia de transición de Schroeder ($f_s$), proporciones de Bolt/Sepmeyer y criterio de Bonello por tercios de octava.
- Interferencia con fronteras (SBIR) por método de fuente imagen para las seis superficies de la sala.
- Trazado de rayos de primeras reflexiones y puntos de tratamiento (RFZ / técnica del espejo).
- Curva estimada de baja frecuencia (20 a 500 Hz) combinando modos y SBIR.
- Asistente paso a paso para proponer ajustes de una variable por vez y exportar sesiones en JSON, CSV o PNG.

### Por qué mover antes de ecualizar

Un nulo profundo causado por interferencia destructiva con una pared (SBIR) o por sentarse en un plano nodal (por ejemplo al 50% del largo de la sala) no es un sistema de fase mínima. La onda directa y la reflejada provienen del mismo parlante: aplicar $+12\text{ dB}$ en un ecualizador amplifica ambas ondas por igual y la cancelación persiste, a costa de perder *headroom* y aumentar la distorsión del woofer. La corrección efectiva empieza moviendo los monitores o la silla y midiendo cada cambio.

### Paquete Python y CLI (`sweetspot`)

Además de la herramienta web, el repositorio incluye el paquete en Python 3.12 para medición por *sweep* exponencial, deconvolución de respuesta al impulso (IR), integración retrocedida de Schroeder (EDT, T20, T30) e interfaz de escritorio en PySide6.

#### Instalación

```bash
git clone https://github.com/lorenhey/SweetSpot.git
cd SweetSpot

# Con uv
uv sync

# O con entorno virtual estándar
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e .
```

#### Uso

```bash
# Interfaz de escritorio (PySide6)
uv run sweetspot-gui

# Listar dispositivos de audio detectados por sounddevice
uv run sweetspot devices

# Demo iterativo en consola con sala sintética (sin hardware)
uv run sweetspot demo

# Flujo de medición por canal
uv run sweetspot measure --device-id 0 --channel left --duration 3.0 --level -12.0
```

#### Pruebas

```bash
uv run pytest
```

### Alcance y limitaciones

- Pensado para 1 sala, 2 monitores (L/R) y 1 posición principal de escucha.
- No genera filtros EQ ni FIR automáticos.
- La versión web calcula un modelo analítico de paredes rígidas (modos + SBIR de primer orden) para formular hipótesis; no reemplaza la medición acústica real.

### Licencia

MIT.

---

## English

Experimental assistant and room acoustics tool for placing two studio monitors and a single listening position before resorting to electronic equalization.

The working principle is straightforward: the geometric model suggests what to test next, and the microphone decides in the real room. The loop is measure, change one physical variable at a time (listener position, front-wall distance, monitor spacing, or toe-in), measure again, and compare trade-offs.

### Web tool (GitHub Pages)

Available at [https://lorenhey.github.io/SweetSpot/](https://lorenhey.github.io/SweetSpot/) with no backend or installation required (includes an `ES / EN` switch in the top bar):

- Interactive 2D rectangular room floor plan with draggable monitors and listener.
- Theoretical room modes (axial, tangential, and oblique via Rayleigh's formula) with a 2D pressure map when clicking any mode row.
- Schroeder transition frequency ($f_s$), Bolt/Sepmeyer room ratio checks, and third-octave Bonello modal density check.
- Speaker-Boundary Interference Response (SBIR) via image sources across all six room boundaries.
- Specular first-reflection ray tracing and reflection-free zone (RFZ / mirror technique) wall markers.
- Estimated low-frequency response curve (20 to 500 Hz) combining modal coupling and first-order SBIR.
- Step-by-step single-variable placement suggestions with JSON, CSV, and PNG export.

### Why placement comes before EQ

A deep acoustic null caused by wall boundary interference (SBIR) or by sitting on a modal nodal plane (such as 50% of room length) is not a minimum-phase problem. Direct and reflected waves come from the same driver: boosting $+12\text{ dB}$ in EQ raises both waves equally, so the cancellation remains while amplifier headroom drops and woofer excursion and distortion rise. Effective correction starts by moving speakers or the chair and verifying each move by measurement.

### Python package and CLI (`sweetspot`)

Alongside the browser tool, the repository contains the Python 3.12 `sweetspot` package for exponential sine sweep generation, inverse-filter impulse response (IR) deconvolution, Schroeder backward integration (EDT, T20, T30), and a PySide6 desktop GUI.

#### Installation

```bash
git clone https://github.com/lorenhey/SweetSpot.git
cd SweetSpot

# With uv
uv sync

# Or with a standard virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\Activate.ps1
pip install -e .
```

#### Usage

```bash
# Desktop GUI (PySide6)
uv run sweetspot-gui

# List audio devices detected by sounddevice
uv run sweetspot devices

# Interactive console demo with a synthetic room (no audio hardware required)
uv run sweetspot demo --lang en

# Run single-channel measurement workflow
uv run sweetspot measure --device-id 0 --channel left --duration 3.0 --level -12.0 --lang en
```

#### Tests

```bash
uv run pytest
```

### Scope and limitations

- Scoped to 1 room, 2 monitors (L/R), and 1 primary listening position.
- Does not generate automatic EQ or FIR correction filters.
- The web tool computes an ideal rigid-wall analytical model (modes + first-order SBIR) to form hypotheses; it does not replace real microphone measurements.

### License

MIT.
