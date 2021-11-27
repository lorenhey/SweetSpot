/**
 * SweetSpot - Evaluación geométrica y propuestas de ajuste paso a paso (ES / EN)
 */

import { SPEED_OF_SOUND, calculateSBIRInterferences } from './acoustics.js';

export class AcousticRecommender {
  constructor() {
    this.history = [];
  }

  evaluateSetup(room, listener, leftMon, rightMon, lang = 'es') {
    const en = lang === 'en';
    const diagnostics = [];

    const distMM = Math.hypot(rightMon.x - leftMon.x, rightMon.y - leftMon.y);
    const distML = Math.hypot(listener.x - leftMon.x, listener.y - leftMon.y);
    const distMR = Math.hypot(listener.x - rightMon.x, listener.y - rightMon.y);
    const avgDistML = (distML + distMR) / 2;

    // 1. Stereo triangle
    const ratioTri = distMM / (avgDistML || 1);
    const catTri = en ? 'Stereo triangle' : 'Triángulo estéreo';
    if (Math.abs(ratioTri - 1.0) <= 0.05) {
      diagnostics.push({
        code: 'triangle_ok',
        category: catTri,
        severity: 'normal',
        message: en
          ? `Base ${distMM.toFixed(2)} m, listener distance ${avgDistML.toFixed(2)} m (approx. 60° equilateral).`
          : `Base ${distMM.toFixed(2)} m, distancia al oyente ${avgDistML.toFixed(2)} m (aprox. equilátero de 60°).`,
        action: null
      });
    } else if (ratioTri < 0.90) {
      diagnostics.push({
        code: 'triangle_narrow',
        category: catTri,
        severity: 'warning',
        message: en
          ? `Base ${distMM.toFixed(2)} m vs ${avgDistML.toFixed(2)} m to listener (narrow stereo image).`
          : `Base ${distMM.toFixed(2)} m frente a ${avgDistML.toFixed(2)} m hasta el oyente (escena cerrada).`,
        action: { type: 'spread_monitors', delta: 0.10 }
      });
    } else {
      diagnostics.push({
        code: 'triangle_wide',
        category: catTri,
        severity: 'warning',
        message: en
          ? `Base ${distMM.toFixed(2)} m vs ${avgDistML.toFixed(2)} m to listener (wide; phantom center may soften).`
          : `Base ${distMM.toFixed(2)} m frente a ${avgDistML.toFixed(2)} m hasta el oyente (abierto; puede aflojar el centro).`,
        action: { type: 'narrow_monitors', delta: -0.10 }
      });
    }

    // 2. Longitudinal Y position
    const ratioY = listener.y / room.L;
    const isCenterNode = Math.abs(ratioY - 0.50) < 0.04;
    const isQuarterNode = Math.abs(ratioY - 0.25) < 0.03 || Math.abs(ratioY - 0.75) < 0.03;
    const is38Percent = Math.abs(ratioY - 0.38) <= 0.04 || Math.abs(ratioY - 0.62) <= 0.04;
    const catY = en ? 'Y position' : 'Posición en Y';

    if (isCenterNode) {
      const f1 = (SPEED_OF_SOUND / (2 * room.L)).toFixed(1);
      diagnostics.push({
        code: 'center_node',
        category: catY,
        severity: 'danger',
        message: en
          ? `y = ${listener.y.toFixed(2)} m (${(ratioY * 100).toFixed(1)}% of L): on the 50% central node where odd axial modes cancel (~${f1} Hz).`
          : `y = ${listener.y.toFixed(2)} m (${(ratioY * 100).toFixed(1)}% de L): sobre el nodo central del 50%, donde caen los modos axiales impares (~${f1} Hz).`,
        action: { type: 'set_listener_y', targetY: Math.round(room.L * 0.38 * 100) / 100 }
      });
    } else if (is38Percent) {
      diagnostics.push({
        code: 'y_38_ok',
        category: catY,
        severity: 'normal',
        message: en
          ? `y = ${listener.y.toFixed(2)} m (${(ratioY * 100).toFixed(1)}% of L), away from the 50% node and quarter planes.`
          : `y = ${listener.y.toFixed(2)} m (${(ratioY * 100).toFixed(1)}% de L), alejado del nodo del 50% y de los cuartos.`,
        action: null
      });
    } else if (isQuarterNode) {
      diagnostics.push({
        code: 'quarter_node',
        category: catY,
        severity: 'warning',
        message: en
          ? `y = ${listener.y.toFixed(2)} m (${(ratioY * 100).toFixed(1)}% of L), near the 2nd-order nodal plane (~${(SPEED_OF_SOUND / room.L).toFixed(1)} Hz).`
          : `y = ${listener.y.toFixed(2)} m (${(ratioY * 100).toFixed(1)}% de L), cerca del nodo de 2.º orden (~${(SPEED_OF_SOUND / room.L).toFixed(1)} Hz).`,
        action: { type: 'move_listener_to_38' }
      });
    } else {
      diagnostics.push({
        code: 'y_neutral',
        category: catY,
        severity: 'normal',
        message: en
          ? `y = ${listener.y.toFixed(2)} m (${(ratioY * 100).toFixed(1)}% of L; 38% starting guide = ${(room.L * 0.38).toFixed(2)} m).`
          : `y = ${listener.y.toFixed(2)} m (${(ratioY * 100).toFixed(1)}% de L; referencia inicial 38% = ${(room.L * 0.38).toFixed(2)} m).`,
        action: null
      });
    }

    // 3. Lateral symmetry
    const midX = room.W / 2;
    const diffX = Math.abs(listener.x - midX);
    const catX = en ? 'X symmetry' : 'Simetría en X';
    if (diffX > 0.08) {
      diagnostics.push({
        code: 'lateral_offset',
        category: catX,
        severity: 'warning',
        message: en
          ? `x = ${listener.x.toFixed(2)} m (${(diffX * 100).toFixed(0)} cm off centerline ${midX.toFixed(2)} m; asymmetric side reflections).`
          : `x = ${listener.x.toFixed(2)} m (corrido ${(diffX * 100).toFixed(0)} cm respecto al eje ${midX.toFixed(2)} m; reflexiones laterales desparejas).`,
        action: { type: 'center_listener_x', targetX: midX }
      });
    } else {
      diagnostics.push({
        code: 'lateral_ok',
        category: catX,
        severity: 'normal',
        message: en
          ? `x = ${listener.x.toFixed(2)} m (centered on the longitudinal axis).`
          : `x = ${listener.x.toFixed(2)} m (centrado sobre el eje longitudinal).`,
        action: null
      });
    }

    // 4. Front wall SBIR
    const dFwLeft = leftMon.y;
    const sbirLeft = calculateSBIRInterferences(leftMon, listener, room);
    const frontBoundary = sbirLeft.boundaries.find((b) => b.id === 'front');
    const fNullFw = frontBoundary ? frontBoundary.fNull : Math.round(SPEED_OF_SOUND / (4 * Math.max(0.05, dFwLeft)));
    const catSBIR = en ? 'Front wall SBIR' : 'SBIR pared frontal';

    if (dFwLeft >= 0.55 && dFwLeft <= 1.25) {
      diagnostics.push({
        code: 'sbir_front_danger',
        category: catSBIR,
        severity: 'danger',
        message: en
          ? `Monitors at ${dFwLeft.toFixed(2)} m → 1st null at ${fNullFw} Hz (hard to treat without deep traps; usually better < 0.25 m or > 1.3 m).`
          : `Monitores a ${dFwLeft.toFixed(2)} m → 1.º nulo en ${fNullFw} Hz (zona difícil de absorber sin trampas gruesas; suele convenir < 0.25 m o > 1.3 m).`,
        action: { type: 'push_monitors_front', targetY: 0.22 }
      });
    } else if (dFwLeft < 0.35) {
      diagnostics.push({
        code: 'sbir_front_near',
        category: catSBIR,
        severity: 'normal',
        message: en
          ? `Monitors at ${dFwLeft.toFixed(2)} m → 1st null at ${fNullFw} Hz (treatable with 8–10 cm porous panels; compensate low-end boundary rise on monitor).`
          : `Monitores a ${dFwLeft.toFixed(2)} m → 1.º nulo en ${fNullFw} Hz (absorbible con paneles de 8 a 10 cm; compensar refuerzo de graves en el monitor).`,
        action: null
      });
    } else {
      diagnostics.push({
        code: 'sbir_front_far',
        category: catSBIR,
        severity: 'normal',
        message: en
          ? `Monitors at ${dFwLeft.toFixed(2)} m → estimated 1st null at ${fNullFw} Hz.`
          : `Monitores a ${dFwLeft.toFixed(2)} m → 1.º nulo estimado en ${fNullFw} Hz.`,
        action: null
      });
    }

    return diagnostics;
  }

  proposeNextExperiment(room, listener, leftMon, rightMon, lang = 'es') {
    const en = lang === 'en';
    const diagnostics = this.evaluateSetup(room, listener, leftMon, rightMon, lang);

    const centerDanger = diagnostics.find((d) => d.code === 'center_node');
    if (centerDanger && centerDanger.action) {
      const targetY = Math.round(room.L * 0.38 * 100) / 100;
      const deltaCm = (targetY - listener.y) * 100;
      return {
        actionName: en ? 'Move listener to 38% of room length' : 'Mover el oyente al 38% del largo',
        variable: 'listener.y',
        deltaText: `${deltaCm > 0 ? '+' : ''}${deltaCm.toFixed(0)} cm`,
        newConfig: { listenerY: targetY },
        reason: en
          ? 'Move off the 50% plane where odd longitudinal axial modes cancel.'
          : 'Salir del plano del 50%, donde se cancelan los modos axiales impares en el eje longitudinal.'
      };
    }

    const centerOff = diagnostics.find((d) => d.code === 'lateral_offset');
    if (centerOff && centerOff.action) {
      const targetX = Math.round((room.W / 2) * 100) / 100;
      const deltaCm = (targetX - listener.x) * 100;
      return {
        actionName: en ? 'Center listener along X' : 'Centrar el oyente en X',
        variable: 'listener.x',
        deltaText: `${deltaCm > 0 ? '+' : ''}${deltaCm.toFixed(0)} cm`,
        newConfig: { listenerX: targetX },
        reason: en
          ? 'Equalize distance to both side walls to reduce left/right asymmetry.'
          : 'Igualar la distancia a ambas paredes laterales para reducir asimetría entre L y R.'
      };
    }

    const sbirDanger = diagnostics.find((d) => d.code === 'sbir_front_danger');
    if (sbirDanger && sbirDanger.action) {
      const deltaCm = (0.22 - leftMon.y) * 100;
      return {
        actionName: en ? 'Move monitors close to front wall (0.22 m)' : 'Acercar los monitores a la pared frontal (0,22 m)',
        variable: 'monitors.y',
        deltaText: `${deltaCm.toFixed(0)} cm`,
        newConfig: { monitorsY: 0.22 },
        reason: en
          ? 'Push the first SBIR null above 340 Hz so an 8–10 cm porous panel can damp it effectively.'
          : 'Empujar el 1.º nulo SBIR por encima de 340 Hz para que un panel poroso de 8 a 10 cm alcance a amortiguarlo.'
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
        actionName: en
          ? (distMM < distML ? 'Widen monitors toward 60° triangle' : 'Narrow monitors toward 60° triangle')
          : (distMM < distML ? 'Abrir monitores hacia triángulo de 60°' : 'Cerrar monitores hacia triángulo de 60°'),
        variable: 'monitors.x',
        deltaText: `${deltaCm > 0 ? '+' : ''}${deltaCm.toFixed(0)} cm`,
        newConfig: { leftMonX: newLeftX, rightMonX: newRightX },
        reason: en
          ? 'Match monitor spacing to listening distance.'
          : 'Igualar la separación entre monitores con la distancia hasta la posición de escucha.'
      };
    }

    const nextY = Math.max(0.4, Math.round((listener.y - 0.05) * 100) / 100);
    return {
      actionName: en ? 'Fine listener offset (-5 cm along Y)' : 'Corrimiento fino del oyente (-5 cm en Y)',
      variable: 'listener.y',
      deltaText: '-5 cm',
      newConfig: { listenerY: nextY },
      reason: en
        ? 'Overall geometry looks reasonable; test local stability in the real room with small head/chair shifts.'
        : 'La geometría general está en orden; conviene verificar en sala real cuánto varía la curva al mover la cabeza pocos centímetros.'
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
