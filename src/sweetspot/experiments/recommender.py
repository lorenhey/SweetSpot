from typing import List, Dict, Any
from sweetspot.core.models import PlacementConfig


def propose_next_move(
    current_config: PlacementConfig,
    history: List[Dict[str, Any]],
    target_problem: str = "null_70hz",
    lang: str = "es",
) -> Dict[str, Any]:
    """
    Propone el siguiente experimento físico cambiando una sola variable por vez.
    Proposes the next physical experiment based on measurements, changing one variable at a time.
    """
    is_en = lang.lower().startswith("en")

    if len(history) <= 1:
        new_y = current_config.listener.position.y + 0.10
        return {
            "action": (
                "Move listener 10 cm forward"
                if is_en
                else "Mover el oyente 10 cm hacia atrás (+Y)"
            ),
            "variable": "listener.y",
            "new_value": new_y,
            "reason": (
                "Initial coarse search to test spatial sensitivity of low frequency response."
                if is_en
                else "Búsqueda gruesa inicial para comprobar la sensibilidad espacial en baja frecuencia."
            ),
        }

    last_move = history[-1]
    prev_move = history[-2]
    improved = last_move["metrics"]["target_null_depth"] < prev_move["metrics"]["target_null_depth"]

    if last_move["variable"] == "listener.y":
        direction = 1 if last_move["value"] > prev_move["value"] else -1

        if improved:
            step = 0.05 * direction
            reason = (
                "Previous movement improved the target null. Continuing in same direction."
                if is_en
                else "El movimiento anterior redujo la profundidad del nulo. Se continúa en el mismo sentido."
            )
        else:
            step = -0.10 * direction
            reason = (
                "Previous movement worsened the target null. Reversing direction."
                if is_en
                else "El movimiento anterior empeoró el nulo. Se invierte el sentido."
            )

        new_y = current_config.listener.position.y + step
        cm = abs(step) * 100
        action = (
            f"Move listener {cm:.0f} cm {'forward' if step > 0 else 'backward'}"
            if is_en
            else f"Mover el oyente {cm:.0f} cm ({'+Y' if step > 0 else '-Y'})"
        )
        return {
            "action": action,
            "variable": "listener.y",
            "new_value": new_y,
            "reason": reason,
        }

    return {
        "action": "Maintain current position" if is_en else "Mantener la posición actual",
        "reason": (
            "Need more measurements to determine trend."
            if is_en
            else "Se necesitan más mediciones para determinar una tendencia."
        ),
    }
