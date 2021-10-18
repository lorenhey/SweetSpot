/**
 * SweetSpot - Gráfico Espectral de Respuesta en Frecuencia (20 Hz - 500 Hz)
 * 
 * Dibuja en tiempo real sobre Canvas:
 * - Eje logarítmico calibrado en audiofrecuencia (20 Hz a 500 Hz)
 * - Eje vertical en escala decibélica (-30 dB a +18 dB con 0 dB de referencia)
 * - Curva total combinada (SPL Sintético en el Sweet Spot)
 * - Desglose de curva SBIR (interferencias de frontera) y Resonancia Modal
 * - Marcador de frecuencia de corte de Schroeder (f_s)
 * - Indicadores visuales de modos axiales, tangenciales y nulos de cuarto de onda
 * - Tooltip interactivo al pasar el cursor
 */

export class FrequencyResponseChart {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.curveData = [];
    this.modes = [];
    this.schroederFreq = 180;
    this.hoverX = null;
    this.hoverY = null;

    this.options = {
      minFreq: 20,
      maxFreq: 500,
      minDb: -30,
      maxDb: 18,
      showSBIROnly: true,
      showModalOnly: true
    };

    this.padding = { top: 25, right: 30, bottom: 40, left: 55 };
    this.initEvents();
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 280;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);

    this.width = width;
    this.height = height;
    this.plotWidth = width - this.padding.left - this.padding.right;
    this.plotHeight = height - this.padding.top - this.padding.bottom;

    this.render();
  }

  initEvents() {
    window.addEventListener('resize', () => this.resize());

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.hoverX = e.clientX - rect.left;
      this.hoverY = e.clientY - rect.top;
      this.render();
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoverX = null;
      this.hoverY = null;
      this.render();
    });
  }

  setData(curveData, modes, schroederFreq) {
    this.curveData = curveData;
    this.modes = modes || [];
    this.schroederFreq = schroederFreq || 180;
    this.render();
  }

  freqToX(freq) {
    const logMin = Math.log10(this.options.minFreq);
    const logMax = Math.log10(this.options.maxFreq);
    const logF = Math.log10(Math.max(this.options.minFreq, Math.min(this.options.maxFreq, freq)));
    return this.padding.left + ((logF - logMin) / (logMax - logMin)) * this.plotWidth;
  }

  xToFreq(x) {
    const logMin = Math.log10(this.options.minFreq);
    const logMax = Math.log10(this.options.maxFreq);
    const ratio = (x - this.padding.left) / this.plotWidth;
    return Math.pow(10, logMin + ratio * (logMax - logMin));
  }

  dbToY(db) {
    const { minDb, maxDb } = this.options;
    const clampedDb = Math.max(minDb, Math.min(maxDb, db));
    return this.padding.top + (1 - (clampedDb - minDb) / (maxDb - minDb)) * this.plotHeight;
  }

  render() {
    const { ctx, width, height, plotWidth, plotHeight, padding } = this;
    if (!width || !height) return;

    // Fondo oscuro con degradé sutil
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, width, height);

    // 1. Rejilla y ejes de frecuencia logarítmicos
    this.drawGridAndAxes();

    // 2. Línea y zona de frecuencia de Schroeder
    this.drawSchroederLine();

    // 3. Marcadores de modos propios en la base
    this.drawModeMarkers();

    // 4. Curvas de respuesta
    if (this.curveData && this.curveData.length > 0) {
      // Curva SBIR (desglose)
      if (this.options.showSBIROnly) {
        this.drawCurve(this.curveData.map(d => ({ freq: d.freq, val: d.sbirDb })), 'rgba(245, 158, 11, 0.45)', 1.2, [3, 3]);
      }

      // Curva Modal (desglose)
      if (this.options.showModalOnly) {
        this.drawCurve(this.curveData.map(d => ({ freq: d.freq, val: d.modalDb })), 'rgba(167, 139, 250, 0.45)', 1.2, [4, 4]);
      }

      // Curva Total Combinada
      this.drawCurve(this.curveData.map(d => ({ freq: d.freq, val: d.spl })), '#38bdf8', 2.5);
    }

    // 5. Marco exterior del gráfico
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding.left, padding.top, plotWidth, plotHeight);

    // 6. Tooltip interactivo al cursor
    this.drawHoverTooltip();
  }

  drawGridAndAxes() {
    const { ctx, padding, plotWidth, plotHeight } = this;
    const { minFreq, maxFreq, minDb, maxDb } = this.options;

    ctx.save();

    // Eje vertical: Niveles en dB (-30, -20, -10, 0, +10 dB)
    const dbSteps = [-30, -20, -10, 0, 10];
    dbSteps.forEach(db => {
      const y = this.dbToY(db);
      ctx.strokeStyle = db === 0 ? 'rgba(148, 163, 184, 0.45)' : '#161e2e';
      ctx.lineWidth = db === 0 ? 1.5 : 1;
      ctx.setLineDash(db === 0 ? [] : [2, 4]);

      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + plotWidth, y);
      ctx.stroke();

      // Texto de dB
      ctx.font = '10px monospace';
      ctx.fillStyle = db === 0 ? '#f8fafc' : '#64748b';
      ctx.textAlign = 'right';
      ctx.fillText(`${db > 0 ? '+' : ''}${db} dB`, padding.left - 8, y + 3);
    });

    // Eje horizontal: Frecuencias logarítmicas estándar
    const majorFreqs = [20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400, 500];
    const labeledFreqs = [20, 30, 50, 70, 100, 200, 300, 500];

    majorFreqs.forEach(f => {
      const x = this.freqToX(f);
      const isLabeled = labeledFreqs.includes(f);

      ctx.strokeStyle = isLabeled ? '#1e293b' : '#111827';
      ctx.lineWidth = 1;
      ctx.setLineDash(isLabeled ? [3, 3] : [1, 5]);

      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + plotHeight);
      ctx.stroke();

      if (isLabeled) {
        ctx.font = '10px monospace';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.fillText(`${f}Hz`, x, padding.top + plotHeight + 16);
      }
    });

    // Título de ejes
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText('Nivel Relativo (dB)', padding.left, padding.top - 8);

    ctx.restore();
  }

  drawSchroederLine() {
    const { ctx, padding, plotHeight } = this;
    const fs = this.schroederFreq;
    if (fs < this.options.minFreq || fs > this.options.maxFreq) return;

    const x = this.freqToX(fs);

    ctx.save();
    // Banda sombreada de transición modal
    ctx.fillStyle = 'rgba(234, 179, 8, 0.04)';
    ctx.fillRect(padding.left, padding.top, x - padding.left, plotHeight);

    // Línea de corte
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, padding.top + plotHeight);
    ctx.stroke();

    // Etiqueta
    ctx.fillStyle = '#eab308';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`fs = ${fs} Hz (Schroeder)`, x, padding.top + 12);
    ctx.restore();
  }

  drawModeMarkers() {
    const { ctx, padding, plotHeight } = this;
    ctx.save();

    this.modes.forEach(m => {
      if (m.freq < this.options.minFreq || m.freq > this.options.maxFreq) return;
      const x = this.freqToX(m.freq);

      let color = 'rgba(148, 163, 184, 0.3)';
      let height = 6;
      if (m.type === 'axial') {
        color = '#ef4444'; // Rojo: axial (mayor impacto)
        height = 14;
      } else if (m.type === 'tangential') {
        color = '#f59e0b'; // Naranja: tangencial
        height = 9;
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = m.type === 'axial' ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, padding.top + plotHeight);
      ctx.lineTo(x, padding.top + plotHeight - height);
      ctx.stroke();
    });

    ctx.restore();
  }

  drawCurve(points, color, lineWidth = 2, dash = []) {
    const { ctx } = this;
    if (!points || points.length === 0) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(dash);

    // Resplandor para la curva principal
    if (lineWidth > 2) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
    }

    ctx.beginPath();
    points.forEach((pt, idx) => {
      const x = this.freqToX(pt.freq);
      const y = this.dbToY(pt.val);
      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    ctx.restore();
  }

  drawHoverTooltip() {
    const { ctx, hoverX, hoverY, padding, plotWidth, plotHeight, curveData } = this;
    if (hoverX === null || hoverY === null) return;
    if (hoverX < padding.left || hoverX > padding.left + plotWidth) return;
    if (hoverY < padding.top || hoverY > padding.top + plotHeight) return;

    const fHover = this.xToFreq(hoverX);
    // Encontrar punto más cercano en la curva
    let closest = null;
    let minDiff = Infinity;
    for (const d of curveData) {
      const diff = Math.abs(d.freq - fHover);
      if (diff < minDiff) {
        minDiff = diff;
        closest = d;
      }
    }

    if (!closest) return;

    const xPos = this.freqToX(closest.freq);
    const yPos = this.dbToY(closest.spl);

    ctx.save();

    // Línea guía vertical
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(xPos, padding.top);
    ctx.lineTo(xPos, padding.top + plotHeight);
    ctx.stroke();

    // Punto resaltado sobre la curva
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(xPos, yPos, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cuadro de texto flotante
    const textFreq = `${closest.freq.toFixed(1)} Hz`;
    const textSPL = `${closest.spl > 0 ? '+' : ''}${closest.spl.toFixed(1)} dB`;
    const textSBIR = `SBIR: ${closest.sbirDb.toFixed(1)} dB`;
    const textModal = `Modal: ${closest.modalDb.toFixed(1)} dB`;

    const boxW = 120;
    const boxH = 68;
    let boxX = xPos + 12;
    let boxY = yPos - boxH / 2;

    if (boxX + boxW > padding.left + plotWidth) {
      boxX = xPos - boxW - 12;
    }
    if (boxY < padding.top) boxY = padding.top + 4;
    if (boxY + boxH > padding.top + plotHeight) boxY = padding.top + plotHeight - boxH - 4;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'left';
    ctx.fillText(textFreq, boxX + 8, boxY + 16);

    ctx.font = '10px monospace';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(`SPL: ${textSPL}`, boxX + 8, boxY + 32);

    ctx.fillStyle = '#f59e0b';
    ctx.fillText(textSBIR, boxX + 8, boxY + 46);

    ctx.fillStyle = '#a78bfa';
    ctx.fillText(textModal, boxX + 8, boxY + 60);

    ctx.restore();
  }
}
