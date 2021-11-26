/**
 * SweetSpot — Gráfico logarítmico de respuesta en baja frecuencia (20–500 Hz)
 * Papel gráfico científico claro: sin resplandores ni efectos decorativos.
 */

const FONT_MONO = "'IBM Plex Mono', Consolas, Menlo, monospace";
const FONT_SANS = "'IBM Plex Sans', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

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

    this.padding = { top: 24, right: 24, bottom: 36, left: 52 };
    this.initEvents();
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || 720;
    const height = rect.height || 270;

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

  setOptions(partialOptions) {
    Object.assign(this.options, partialOptions);
    this.render();
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

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    this.drawGridAndAxes();
    this.drawSchroederLine();
    this.drawModeMarkers();

    if (this.curveData && this.curveData.length > 0) {
      if (this.options.showSBIROnly) {
        this.drawCurve(
          this.curveData.map((d) => ({ freq: d.freq, val: d.sbirDb })),
          'rgba(161, 92, 7, 0.72)',
          1.25,
          [4, 3]
        );
      }

      if (this.options.showModalOnly) {
        this.drawCurve(
          this.curveData.map((d) => ({ freq: d.freq, val: d.modalDb })),
          'rgba(59, 105, 152, 0.72)',
          1.25,
          [3, 3]
        );
      }

      this.drawCurve(
        this.curveData.map((d) => ({ freq: d.freq, val: d.spl })),
        '#191918',
        2.0
      );
    }

    // Marco limpio del gráfico
    ctx.strokeStyle = '#3a3935';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding.left, padding.top, plotWidth, plotHeight);

    this.drawHoverTooltip();
  }

  drawGridAndAxes() {
    const { ctx, padding, plotWidth, plotHeight } = this;

    ctx.save();

    // Líneas horizontales de dB
    const dbSteps = [-30, -20, -10, 0, 10];
    dbSteps.forEach((db) => {
      const y = this.dbToY(db);
      ctx.strokeStyle = db === 0 ? '#8c8b83' : '#ecebe4';
      ctx.lineWidth = db === 0 ? 1.15 : 1;
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + plotWidth, y);
      ctx.stroke();

      ctx.font = `400 10px ${FONT_MONO}`;
      ctx.fillStyle = db === 0 ? '#191918' : '#6e6d66';
      ctx.textAlign = 'right';
      ctx.fillText(`${db > 0 ? '+' : ''}${db}`, padding.left - 8, y + 3.5);
    });

    // Frecuencias logarítmicas
    const gridFreqs = [20, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200, 300, 400, 500];
    const labeledFreqs = [20, 30, 50, 70, 100, 200, 300, 500];

    gridFreqs.forEach((f) => {
      const x = this.freqToX(f);
      const isLabeled = labeledFreqs.includes(f);

      ctx.strokeStyle = isLabeled ? '#e3e1d8' : '#f2f1eb';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + plotHeight);
      ctx.stroke();

      if (isLabeled) {
        ctx.font = `400 10px ${FONT_MONO}`;
        ctx.fillStyle = '#54534e';
        ctx.textAlign = 'center';
        ctx.fillText(`${f}`, x, padding.top + plotHeight + 15);
      }
    });

    // Etiquetas de ejes
    ctx.font = `500 10px ${FONT_SANS}`;
    ctx.fillStyle = '#54534e';
    ctx.textAlign = 'left';
    ctx.fillText('Nivel relativo (dB)', padding.left, padding.top - 8);

    ctx.textAlign = 'right';
    ctx.fillText('Frecuencia (Hz)', padding.left + plotWidth, padding.top + plotHeight + 29);

    ctx.restore();
  }

  drawSchroederLine() {
    const { ctx, padding, plotWidth, plotHeight } = this;
    const fs = this.schroederFreq;
    if (fs < this.options.minFreq || fs > this.options.maxFreq) return;

    const x = this.freqToX(fs);

    ctx.save();
    // Región modal discreta levemente sombreada
    ctx.fillStyle = 'rgba(25, 25, 24, 0.028)';
    ctx.fillRect(padding.left, padding.top, x - padding.left, plotHeight);

    ctx.strokeStyle = '#6e6d66';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, padding.top + plotHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    const label = `fs = ${fs} Hz`;
    ctx.font = `500 9.5px ${FONT_MONO}`;
    const nearRight = x > padding.left + plotWidth - 65;
    ctx.textAlign = nearRight ? 'right' : 'left';
    const lx = nearRight ? x - 5 : x + 5;
    ctx.fillStyle = '#4e4d48';
    ctx.fillText(label, lx, padding.top + 12);

    ctx.restore();
  }

  drawModeMarkers() {
    const { ctx, padding, plotHeight } = this;
    ctx.save();

    this.modes.forEach((m) => {
      if (m.freq < this.options.minFreq || m.freq > this.options.maxFreq) return;
      const x = this.freqToX(m.freq);

      let color = '#b5b3aa';
      let height = 4;
      let width = 1;
      if (m.type === 'axial') {
        color = '#b42318';
        height = 11;
        width = 1.5;
      } else if (m.type === 'tangential') {
        color = '#a15c07';
        height = 7;
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = width;
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
    ctx.lineJoin = 'round';
    ctx.setLineDash(dash);

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

    ctx.strokeStyle = 'rgba(25, 25, 24, 0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(xPos, padding.top);
    ctx.lineTo(xPos, padding.top + plotHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#191918';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(xPos, yPos, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const boxW = 132;
    const boxH = 68;
    let boxX = xPos + 12;
    let boxY = yPos - boxH / 2;

    if (boxX + boxW > padding.left + plotWidth) {
      boxX = xPos - boxW - 12;
    }
    if (boxY < padding.top + 2) boxY = padding.top + 4;
    if (boxY + boxH > padding.top + plotHeight - 2) boxY = padding.top + plotHeight - boxH - 4;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.strokeStyle = '#3a3935';
    ctx.lineWidth = 1;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    const splStr = `${closest.spl > 0 ? '+' : ''}${closest.spl.toFixed(1)} dB`;
    const sbirStr = `${closest.sbirDb > 0 ? '+' : ''}${closest.sbirDb.toFixed(1)} dB`;
    const modalStr = `${closest.modalDb > 0 ? '+' : ''}${closest.modalDb.toFixed(1)} dB`;

    ctx.font = `600 10.5px ${FONT_MONO}`;
    ctx.fillStyle = '#191918';
    ctx.textAlign = 'left';
    ctx.fillText(`${closest.freq.toFixed(1)} Hz`, boxX + 8, boxY + 15);

    ctx.font = `400 10px ${FONT_MONO}`;
    ctx.fillStyle = '#191918';
    ctx.fillText(`Total: ${splStr}`, boxX + 8, boxY + 31);

    ctx.fillStyle = '#a15c07';
    ctx.fillText(`SBIR:  ${sbirStr}`, boxX + 8, boxY + 46);

    ctx.fillStyle = '#3b6998';
    ctx.fillText(`Modal: ${modalStr}`, boxX + 8, boxY + 60);

    ctx.restore();
  }
}
