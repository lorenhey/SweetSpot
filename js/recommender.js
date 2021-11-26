/**
 * SweetSpot — Evaluación geométrica y propuestas de ajuste físico paso a paso
 * Regla de trabajo: proponer una sola variable por iteración y contrastar en sala.
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
        category: 'Geometría estéreo',
        title: 'Triángulo equilátero (~60°)',
        severity: 'success',
        message: `Separación entre monitores (${distMM.toFixed(2)} m) acorde a la distancia al oyente (${avgDistML.toFixed(2)} m).`,
        action: null
      });
    } else if (ratioTri < 0.90) {
      diagnostics.push({
        code: 'triangle_narrow',
        category: 'Geometría estéreo',
        title: 'Base estéreo angosta',
        severity: 'warning',
        message: `Los monitores están a ${distMM.toFixed(2)} m entre sí frente a ${avgDistML.toFixed(2)} m hasta el oyente; la escena queda cerrada.`,
        action: {
          label: 'Separar monitores',
          type: 'spread_monitors',
          delta: 0.10
        }
      });
    } else {
      diagnostics.push({
        code: 'triangle_wide',
        category: 'Geometría estéreo',
        title: 'Base estéreo abierta',
        severity: 'warning',
        message: `Los monitores están a ${distMM.toFixed(2)} m frente a ${avgDistML.toFixed(2)} m hasta el oyente; suele perderse definición en el centro fantasma.`,
        action: {
          label: 'Acercar monitores',
          type: 'narrow_monitors',
          delta: -0.10
        }
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
        category: 'Eje longitudinal (Y)',
        title: 'Oyente en el nodo central (50% L)',
        severity: 'danger',
        message: `Posición en ${listener.y.toFixed(2)} m de ${room.L.toFixed(2)} m. En el centro de la sala se cancelan los modos axiales impares (fundamental ~${f1} Hz); la ecualización no recupera ese pozo.`,
        action: {
          label: 'Mover oyente al 38%',
          type: 'set_listener_y',
          targetY: Math.round(room.L * 0.38 * 100) / 100
        }
      });
    } else if (is38Percent) {
      diagnostics.push({
        code: 'y_38_ok',
        category: 'Eje longitudinal (Y)',
        title: `Referencia longitudinal (${(ratioY * 100).toFixed(1)}% L)`,
        severity: 'success',
        message: `Ubicado en y = ${listener.y.toFixed(2)} m, fuera del nodo central del 50% y de los planos de cuartos de onda. Buen punto de partida para medir.`,
        action: null
      });
    } else if (isQuarterNode) {
      diagnostics.push({
        code: 'quarter_node',
        category: 'Eje longitudinal (Y)',
        title: 'Cerca de nodo de 2.º orden (25% / 75% L)',
        severity: 'warning',
        message: `En y = ${listener.y.toFixed(2)} m suele aparecer una cancelación cerca del segundo armónico longitudinal (~${(SPEED_OF_SOUND / room.L).toFixed(1)} Hz).`,
        action: {
          label: 'Acercar al 38%',
          type: 'move_listener_to_38'
        }
      });
    } else {
      diagnostics.push({
        code: 'y_neutral',
        category: 'Eje longitudinal (Y)',
        title: `Oyente al ${(ratioY * 100).toFixed(1)}% del largo`,
        severity: 'info',
        message: `Posición utilizable; como referencia inicial suele probarse alrededor del 38% (${(room.L * 0.38).toFixed(2)} m) y luego ajustar según medición.`,
        action: null
      });
    }

    // 3. Simetría lateral
    const midX = room.W / 2;
    const diffX = Math.abs(listener.x - midX);
    if (diffX > 0.08) {
      diagnostics.push({
        code: 'lateral_offset',
        category: 'Simetría lateral (X)',
        title: `Oyente desplazado ${(diffX * 100).toFixed(0)} cm del eje`,
        severity: 'warning',
        message: `Respecto al centro de la sala (${midX.toFixed(2)} m). Las primeras reflexiones laterales llegan asimétricas entre izquierda y derecha.`,
        action: {
          label: 'Centrar en el eje X',
          type: 'center_listener_x',
          targetX: midX
        }
      });
    } else {
      diagnostics.push({
        code: 'lateral_ok',
        category: 'Simetría lateral (X)',
        title: 'Centrado en el eje lateral',
        severity: 'success',
        message: `Oyente sobre el eje x = ${midX.toFixed(2)} m, con caminos laterales equivalentes.`,
        action: null
      });
    }

    // 4. SBIR pared frontal (usa el cálculo 3D de fuente imagen para coincidir con la tabla)
    const dFwLeft = leftMon.y;
    const sbirLeft = calculateSBIRInterferences(leftMon, listener, room);
    const frontBoundary = sbirLeft.boundaries.find((b) => b.id === 'front');
    const fNullFw = frontBoundary ? frontBoundary.fNull : Math.round(SPEED_OF_SOUND / (4 * Math.max(0.05, dFwLeft)));

    if (dFwLeft >= 0.55 && dFwLeft <= 1.25) {
      diagnostics.push({
        code: 'sbir_front_danger',
        category: 'SBIR pared frontal',
        title: `Cancelación frontal en ${fNullFw} Hz`,
        severity: 'danger',
        message: `Monitores a ${dFwLeft.toFixed(2)} m de la pared frontal. El primer nulo cae en la franja crítica de graves-medios, difícil de absorber sin trampas gruesas (> 25 cm).`,
        action: {
          label: 'Acercar monitores (< 25 cm)',
          type: 'push_monitors_front',
          targetY: 0.22
        }
      });
    } else if (dFwLeft < 0.35) {
      diagnostics.push({
        code: 'sbir_front_near',
        category: 'SBIR pared frontal',
        title: `Montaje cercano a pared (${dFwLeft.toFixed(2)} m)`,
        severity: 'success',
        message: `El primer nulo sube a ${fNullFw} Hz, donde absorción porosa convencional (8–10 cm) es efectiva. Compensar el refuerzo de graves con el filtro de frontera del monitor.`,
        action: null
      });
    } else {
      diagnostics.push({
        code: 'sbir_front_far',
        category: 'SBIR pared frontal',
        title: `Monitores alejados (${dFwLeft.toFixed(2)} m)`,
        severity: 'info',
        message: `Primer nulo frontal estimado en ${fNullFw} Hz; comprobar en medición real si coincide con algún modo de la sala.`,
        action: null
      });
    }

    return diagnostics;
  }

  proposeNextExperiment(room, listener, leftMon, rightMon) {
    const diagnostics = this.evaluateSetup(room, listener, leftMon, rightMon);

    // Prioridad 1: salir del nodo central del 50%
    const centerDanger = diagnostics.find((d) => d.code === 'center_node');
    if (centerDanger && centerDanger.action) {
      const targetY = Math.round(room.L * 0.38 * 100) / 100;
      const deltaCm = (targetY - listener.y) * 100;
      return {
        actionName: 'Desplazar oyente hacia el 38% del largo',
        variable: 'listener.y',
        deltaText: `${deltaCm > 0 ? '+' : ''}${deltaCm.toFixed(0)} cm`,
        newConfig: { listenerY: targetY },
        reason: 'Salir del plano nodal del 50% donde se cancelan los modos axiales longitudinales impares.'
      };
    }

    // Prioridad 2: centrar eje lateral
    const centerOff = diagnostics.find((d) => d.code === 'lateral_offset');
    if (centerOff && centerOff.action) {
      const targetX = Math.round((room.W / 2) * 100) / 100;
      const deltaCm = (targetX - listener.x) * 100;
      return {
        actionName: 'Centrar oyente en el eje lateral',
        variable: 'listener.x',
        deltaText: `${deltaCm > 0 ? '+' : ''}${deltaCm.toFixed(0)} cm`,
        newConfig: { listenerX: targetX },
        reason: 'Igualar la distancia a paredes laterales para reducir asimetría entre canal izquierdo y derecho.'
      };
    }

    // Prioridad 3: SBIR frontal crítico
    const sbirDanger = diagnostics.find((d) => d.code === 'sbir_front_danger');
    if (sbirDanger && sbirDanger.action) {
      const deltaCm = (0.22 - leftMon.y) * 100;
      return {
        actionName: 'Acercar monitores a la pared frontal (0,22 m)',
        variable: 'monitors.y',
        deltaText: `${deltaCm.toFixed(0)} cm`,
        newConfig: { monitorsY: 0.22 },
        reason: 'Subir el primer nulo SBIR por encima de ~350 Hz para poder amortiguarlo con paneles porosos finos.'
      };
    }

    // Prioridad 4: triángulo equilátero
    const distMM = Math.hypot(rightMon.x - leftMon.x, rightMon.y - leftMon.y);
    const distML = Math.hypot(listener.x - leftMon.x, listener.y - leftMon.y);
    if (Math.abs(distMM - distML) > 0.08) {
      const targetHalfWidth = Math.min((room.W / 2) - 0.2, distML * Math.sin(Math.PI / 6));
      const newLeftX = Math.round(((room.W / 2) - targetHalfWidth) * 100) / 100;
      const newRightX = Math.round(((room.W / 2) + targetHalfWidth) * 100) / 100;
      const deltaCm = ((targetHalfWidth * 2) - distMM) * 100;

      return {
        actionName: distMM < distML ? 'Separar monitores hacia triángulo de 60°' : 'Acercar monitores hacia triángulo de 60°',
        variable: 'monitors.x',
        deltaText: `${deltaCm > 0 ? '+' : ''}${deltaCm.toFixed(0)} cm`,
        newConfig: { leftMonX: newLeftX, rightMonX: newRightX },
        reason: 'Igualar la base entre monitores con la distancia de escucha para estabilizar el centro fantasma.'
      };
    }

    // Ajuste fino exploratorio
    const nextY = Math.max(0.4, Math.round((listener.y - 0.05) * 100) / 100);
    return {
      actionName: 'Prueba de sensibilidad fina del oyente (-5 cm en Y)',
      variable: 'listener.y',
      deltaText: '-5 cm',
      newConfig: { listenerY: nextY },
      reason: 'La geometría general es razonable; evaluar en medición real cuán estable es la respuesta ante un corrimiento chico de la cabeza.'
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
