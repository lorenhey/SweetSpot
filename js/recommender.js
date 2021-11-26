/**
 * SweetSpot - Evaluación geométrica y propuestas de ajuste paso a paso
 */

import { SPEED_OF_SOUND, calculateSBIRInterferences } from './acoustics.js';

export class AcousticRecommender {
  constructor() {
    this.history = [];
  }

  evaluateSetup(room, listener, leftMon, rightMon) {
    const diagnostics = [];

    const distMM = Math.hypot(rightMon.x - leftMon.x, rightMon.y - leftMon.y);
    const distML = Math.hypot(listener.x - leftMon.x, listener.y - leftMon.y);
    const distMR = Math.hypot(listener.x - rightMon.x, listener.y - rightMon.y);
    const avgDistML = (distML + distMR) / 2;

    // 1. Triángulo estéreo
    const ratioTri = distMM / (avgDistML || 1);
    if (Math.abs(ratioTri - 1.0) <= 0.05) {
      diagnostics.push({
        code: 'triangle_ok',
        category: 'Triángulo estéreo',
        severity: 'normal',
        message: `Base ${distMM.toFixed(2)} m, distancia al oyente ${avgDistML.toFixed(2)} m (aprox. equilátero de 60°).`,
        action: null
      });
    } else if (ratioTri < 0.90) {
      diagnostics.push({
        code: 'triangle_narrow',
        category: 'Triángulo estéreo',
        severity: 'warning',
        message: `Base ${distMM.toFixed(2)} m frente a ${avgDistML.toFixed(2)} m hasta el oyente (escena cerrada).`,
        action: { label: 'Separar monitores', type: 'spread_monitors', delta: 0.10 }
      });
    } else {
      diagnostics.push({
        code: 'triangle_wide',
        category: 'Triángulo estéreo',
        severity: 'warning',
        message: `Base ${distMM.toFixed(2)} m frente a ${avgDistML.toFixed(2)} m hasta el oyente (abierto; puede aflojar el centro).`,
        action: { label: 'Acercar monitores', type: 'narrow_monitors', delta: -0.10 }
      });
    }

    // 2. Posición longitudinal del oyente
    const ratioY = listener.y / room.L;
    const isCenterNode = Math.abs(ratioY - 0.50) < 0.04;
    const isQuarterNode = Math.abs(ratioY - 0.25) < 0.03 || Math.abs(ratioY - 0.75) < 0.03;
    const is38Percent = Math.abs(ratioY - 0.38) <= 0.04 || Math.abs(ratioY - 0.62) <= 0.04;

    if (isCenterNode) {
      const f1 = (SPEED_OF_SOUND / (2 * room.L)).toFixed(1);
      diagnostics.push({
        code: 'center_node',
        category: 'Posición en Y',
        severity: 'danger',
        message: `y = ${listener.y.toFixed(2)} m (${(ratioY * 100).toFixed(1)}% de L): sobre el nodo central del 50%, donde caen los modos axiales impares (~${f1} Hz).`,
        action: { label: 'Mover oyente al 38%', type: 'set_listener_y', targetY: Math.round(room.L * 0.38 * 100) / 100 }
      });
    } else if (is38Percent) {
      diagnostics.push({
        code: 'y_38_ok',
        category: 'Posición en Y',
        severity: 'normal',
        message: `y = ${listener.y.toFixed(2)} m (${(ratioY * 100).toFixed(1)}% de L), alejado del nodo del 50% y de los cuartos.`,
        action: null
      });
    } else if (isQuarterNode) {
      diagnostics.push({
        code: 'quarter_node',
        category: 'Posición en Y',
        severity: 'warning',
        message: `y = ${listener.y.toFixed(2)} m (${(ratioY * 100).toFixed(1)}% de L), cerca del nodo de 2.º orden (~${(SPEED_OF_SOUND / room.L).toFixed(1)} Hz).`,
        action: { label: 'Acercar al 38%', type: 'move_listener_to_38' }
      });
    } else {
      diagnostics.push({
        code: 'y_neutral',
        category: 'Posición en Y',
        severity: 'normal',
        message: `y = ${listener.y.toFixed(2)} m (${(ratioY * 100).toFixed(1)}% de L; referencia inicial 38% = ${(room.L * 0.38).toFixed(2)} m).`,
        action: null
      });
    }

    // 3. Simetría lateral
    const midX = room.W / 2;
    const diffX = Math.abs(listener.x - midX);
    if (diffX > 0.08) {
      diagnostics.push({
        code: 'lateral_offset',
        category: 'Simetría en X',
        severity: 'warning',
        message: `x = ${listener.x.toFixed(2)} m (corrido ${(diffX * 100).toFixed(0)} cm respecto al eje ${midX.toFixed(2)} m; reflexiones laterales desparejas).`,
        action: { label: 'Centrar en X', type: 'center_listener_x', targetX: midX }
      });
    } else {
      diagnostics.push({
        code: 'lateral_ok',
        category: 'Simetría en X',
        severity: 'normal',
        message: `x = ${listener.x.toFixed(2)} m (centrado sobre el eje longitudinal).`,
        action: null
      });
    }

    // 4. SBIR pared frontal
    const dFwLeft = leftMon.y;
    const sbirLeft = calculateSBIRInterferences(leftMon, listener, room);
    const frontBoundary = sbirLeft.boundaries.find((b) => b.id === 'front');
    const fNullFw = frontBoundary ? frontBoundary.fNull : Math.round(SPEED_OF_SOUND / (4 * Math.max(0.05, dFwLeft)));

    if (dFwLeft >= 0.55 && dFwLeft <= 1.25) {
      diagnostics.push({
        code: 'sbir_front_danger',
        category: 'SBIR pared frontal',
        severity: 'danger',
        message: `Monitores a ${dFwLeft.toFixed(2)} m → 1.º nulo en ${fNullFw} Hz (zona difícil de absorber sin trampas gruesas; suele convenir < 0.25 m o > 1.3 m).`,
        action: { label: 'Acercar monitores (< 25 cm)', type: 'push_monitors_front', targetY: 0.22 }
      });
    } else if (dFwLeft < 0.35) {
      diagnostics.push({
        code: 'sbir_front_near',
        category: 'SBIR pared frontal',
        severity: 'normal',
        message: `Monitores a ${dFwLeft.toFixed(2)} m → 1.º nulo en ${fNullFw} Hz (absorbible con paneles de 8 a 10 cm; compensar refuerzo de graves en el monitor).`,
        action: null
      });
    } else {
      diagnostics.push({
        code: 'sbir_front_far',
        category: 'SBIR pared frontal',
        severity: 'normal',
        message: `Monitores a ${dFwLeft.toFixed(2)} m → 1.º nulo estimado en ${fNullFw} Hz.`,
        action: null
      });
    }

    return diagnostics;
  }

  proposeNextExperiment(room, listener, leftMon, rightMon) {
    const diagnostics = this.evaluateSetup(room, listener, leftMon, rightMon);

    const centerDanger = diagnostics.find((d) => d.code === 'center_node');
    if (centerDanger && centerDanger.action) {
      const targetY = Math.round(room.L * 0.38 * 100) / 100;
      const deltaCm = (targetY - listener.y) * 100;
      return {
        actionName: 'Mover el oyente al 38% del largo',
        variable: 'listener.y',
        deltaText: `${deltaCm > 0 ? '+' : ''}${deltaCm.toFixed(0)} cm`,
        newConfig: { listenerY: targetY },
        reason: 'Salir del plano del 50%, donde se cancelan los modos axiales impares en el eje longitudinal.'
      };
    }

    const centerOff = diagnostics.find((d) => d.code === 'lateral_offset');
    if (centerOff && centerOff.action) {
      const targetX = Math.round((room.W / 2) * 100) / 100;
      const deltaCm = (targetX - listener.x) * 100;
      return {
        actionName: 'Centrar el oyente en X',
        variable: 'listener.x',
        deltaText: `${deltaCm > 0 ? '+' : ''}${deltaCm.toFixed(0)} cm`,
        newConfig: { listenerX: targetX },
        reason: 'Igualar la distancia a ambas paredes laterales para reducir asimetría entre L y R.'
      };
    }

    const sbirDanger = diagnostics.find((d) => d.code === 'sbir_front_danger');
    if (sbirDanger && sbirDanger.action) {
      const deltaCm = (0.22 - leftMon.y) * 100;
      return {
        actionName: 'Acercar los monitores a la pared frontal (0,22 m)',
        variable: 'monitors.y',
        deltaText: `${deltaCm.toFixed(0)} cm`,
        newConfig: { monitorsY: 0.22 },
        reason: 'Empujar el 1.º nulo SBIR por encima de 340 Hz para que un panel poroso de 8 a 10 cm alcance a amortiguarlo.'
      };
    }

    const distMM = Math.hypot(rightMon.x - leftMon.x, rightMon.y - leftMon.y);
    const distML = Math.hypot(listener.x - leftMon.x, listener.y - leftMon.y);
    if (Math.abs(distMM - distML) > 0.08) {
      const targetHalfWidth = Math.min((room.W / 2) - 0.2, distML * Math.sin(Math.PI / 6));
      const newLeftX = Math.round(((room.W / 2) - targetHalfWidth) * 100) / 100;
      const newRightX = Math.round(((room.W / 2) + targetHalfWidth) * 100) / 100;
      const deltaCm = ((targetHalfWidth * 2) - distMM) * 100;

      return {
        actionName: distMM < distML ? 'Abrir monitores hacia triángulo de 60°' : 'Cerrar monitores hacia triángulo de 60°',
        variable: 'monitors.x',
        deltaText: `${deltaCm > 0 ? '+' : ''}${deltaCm.toFixed(0)} cm`,
        newConfig: { leftMonX: newLeftX, rightMonX: newRightX },
        reason: 'Igualar la separación entre monitores con la distancia hasta la posición de escucha.'
      };
    }

    const nextY = Math.max(0.4, Math.round((listener.y - 0.05) * 100) / 100);
    return {
      actionName: 'Corrimiento fino del oyente (-5 cm en Y)',
      variable: 'listener.y',
      deltaText: '-5 cm',
      newConfig: { listenerY: nextY },
      reason: 'La geometría general está en orden; conviene verificar en sala real cuánto varía la curva al mover la cabeza pocos centímetros.'
    };
  }

  logExperiment(experiment) {
    this.history.push({
      timestamp: new Date().toLocaleTimeString(),
      id: this.history.length + 1,
      ...experiment
    });
  }
}
