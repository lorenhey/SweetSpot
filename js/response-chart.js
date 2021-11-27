/**
 * SweetSpot - Gráfico logarítmico de respuesta en baja frecuencia (20-500 Hz)
 */

import { I18N } from './i18n.js';

const FONT_MONO = "Consolas, 'Liberation Mono', Menlo, monospace";
const FONT_SANS = "Helvetica, Arial, sans-serif";

export class FrequencyResponseChart {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.lang = 'es';
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

    this.padding = { top: 24, right: 22, bottom: 36, left: 48 };
    this.initEvents();
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || 680;
    const height = rect.height || 260;

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

  setLanguage(lang) {
    this.lang = lang === 'en' ? 'en' : 'es';
    this.render();
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
          'rgba(184, 109, 16, 0.78)',
          1.2,
          [4, 3]
        );
      }

      if (this.options.showModalOnly) {
        this.drawCurve(
          this.curveData.map((d) => ({ freq: d.freq, val: d.modalDb })),
          'rgba(43, 91, 132, 0.78)',
          1.2,
          [3, 3]
        );
      }

      this.drawCurve(
        this.curveData.map((d) => ({ freq: d.freq, val: d.spl })),
        '#111111',
        1.9
      );
    }

    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding.left, padding.top, plotWidth, plotHeight);

    this.drawHoverTooltip();
  }

  drawGridAndAxes() {
    const { ctx, padding, plotWidth, plotHeight } = this;

    ctx.save();

    const dbSteps = [-30, -20, -10, 0, 10];
    dbSteps.forEach((db) => {
      const y = this.dbToY(db);
      ctx.strokeStyle = db === 0 ? '#888888' : '#eeeeee';
      ctx.lineWidth = db === 0 ? 1.15 : 1;

      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + plotWidth, y);
      ctx.stroke();

      ctx.font = `10px ${FONT_MONO}`;
      ctx.fillStyle = db === 0 ? '#111111' : '#666666';
      ctx.textAlign = 'right';
      ctx.fillText(`${db > 0 ? '+' : ''}${db}`, padding.left - 7, y + 3.5);
    });

    const gridFreqs = [20, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200, 300, 400, 500];
    const labeledFreqs = [20, 30, 50, 70, 100, 200, 300, 500];

    gridFreqs.forEach((f) => {
      const x = this.freqToX(f);
      const isLabeled = labeledFreqs.includes(f);

      ctx.strokeStyle = isLabeled ? '#e2e2e2' : '#f3f3f3';
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + plotHeight);
      ctx.stroke();

      if (isLabeled) {
        ctx.font = `10px ${FONT_MONO}`;
        ctx.fillStyle = '#444444';
        ctx.textAlign = 'center';
        ctx.fillText(`${f}`, x, padding.top + plotHeight + 15);
      }
    });

    const t = I18N[this.lang].chart;
    ctx.font = `10px ${FONT_SANS}`;
    ctx.fillStyle = '#555555';
    ctx.textAlign = 'left';
    ctx.fillText(t.yAxis, padding.left, padding.top - 8);

    ctx.textAlign = 'right';
    ctx.fillText(t.xAxis, padding.left + plotWidth, padding.top + plotHeight + 29);

    ctx.restore();
  }

  drawSchroederLine() {
    const { ctx, padding, plotWidth, plotHeight } = this;
    const fs = this.schroederFreq;
    if (fs < this.options.minFreq || fs > this.options.maxFreq) return;

    const x = this.freqToX(fs);

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.025)';
    ctx.fillRect(padding.left, padding.top, x - padding.left, plotHeight);

    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, padding.top + plotHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = `10px ${FONT_MONO}`;
    const nearRight = x > padding.left + plotWidth - 65;
    ctx.textAlign = nearRight ? 'right' : 'left';
    ctx.fillStyle = '#444444';
    ctx.fillText(`fs = ${fs} Hz`, nearRight ? x - 5 : x + 5, padding.top + 12);

    ctx.restore();
  }

  drawModeMarkers() {
    const { ctx, padding, plotHeight } = this;
    ctx.save();

    this.modes.forEach((m) => {
      if (m.freq < this.options.minFreq || m.freq > this.options.maxFreq) return;
      const x = this.freqToX(m.freq);

      let color = '#bbbbbb';
      let height = 4;
      let width = 1;
      if (m.type === 'axial') {
        color = '#a81c1c';
        height = 11;
        width = 1.5;
      } else if (m.type === 'tangential') {
        color = '#8f4f00';
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

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(xPos, padding.top);
    ctx.lineTo(xPos, padding.top + plotHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#111111';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(xPos, yPos, 3.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const boxW = 128;
    const boxH = 66;
    let boxX = xPos + 10;
    let boxY = yPos - boxH / 2;

    if (boxX + boxW > padding.left + plotWidth) boxX = xPos - boxW - 10;
    if (boxY < padding.top + 2) boxY = padding.top + 4;
    if (boxY + boxH > padding.top + plotHeight - 2) boxY = padding.top + plotHeight - boxH - 4;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    const fmt = (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`;

    ctx.font = `bold 10.5px ${FONT_MONO}`;
    ctx.fillStyle = '#111111';
    ctx.textAlign = 'left';
    ctx.fillText(`${closest.freq.toFixed(1)} Hz`, boxX + 8, boxY + 15);

    ctx.font = `10px ${FONT_MONO}`;
    ctx.fillStyle = '#111111';
    ctx.fillText(`Total: ${fmt(closest.spl)}`, boxX + 8, boxY + 30);

    ctx.fillStyle = '#8f4f00';
    ctx.fillText(`SBIR:  ${fmt(closest.sbirDb)}`, boxX + 8, boxY + 44);

    ctx.fillStyle = '#2b5b84';
    ctx.fillText(`Modal: ${fmt(closest.modalDb)}`, boxX + 8, boxY + 58);

    ctx.restore();
  }
}
