# SweetSpot

> SweetSpot helps you find better monitor and listening positions by measuring what actually happens in the room. It guides a simple loop: measure, move one thing, measure again, compare.

> It optimizes placement before correction.

**SweetSpot is not an automatic EQ system.** It is an experimental assistant to find the physical "sweet spot" in your room.

## Philosophy

Before you apply electronic equalization (EQ, Dirac, Sonarworks), you should move your speakers and your chair. A deep acoustic null caused by a room mode or an early reflection cannot be properly fixed with +12dB of EQ.

SweetSpot provides:
1. **Quick Mode**: Relative measurements to compare positions rapidly.
2. **Measurement Mode**: Calibrated measurements when precision is needed.
3. **Controlled Experiments**: Recommends moving one variable at a time (e.g., "Move listener 10cm forward").
4. **Transparent Trade-offs**: Shows exactly what improved and what worsened with each move.

## Features

- **Measure**: Sine sweeps and IR deconvolution.
- **Understand**: Frequency response, Energy Time Curve (ETC), L/R mismatch, Decay.
- **Move**: Heuristic engine suggests the next physical placement experiment.
- **Compare**: Before/After overlays, null depth tracking.

## Quick Start

```bash
# Clone the repository
git clone https://github.com/lorenhey/SweetSpot.git
cd SweetSpot

# Install dependencies using uv
uv sync

# Run the CLI Demo
uv run sweetspot demo

# Run the GUI
uv run sweetspot-gui
```

## Development

SweetSpot is built with Python, PySide6, numpy, and scipy.

```bash
uv run pytest
```

## Limitations

- V1 assumes 1 room, 1 listener, 2 monitors.
- No automatic EQ or FIR generation. (Position first!)
- No multi-seat optimization.
- Extended band measurements require explicit opt-in.

## License

MIT
