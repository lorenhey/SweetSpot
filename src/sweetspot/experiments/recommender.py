from typing import List, Dict, Any, Optional
from sweetspot.core.models import PlacementConfig, Position

def propose_next_move(
    current_config: PlacementConfig,
    history: List[Dict[str, Any]], # Contains past configs and their metrics
    target_problem: str = "null_70hz"
) -> Dict[str, Any]:
    """
    Proposes the next physical experiment based on measurements, 
    changing one variable at a time.
    
    This is a heuristic engine. Example logic:
    If a null is deep, try moving the listener slightly forward or backward.
    If we moved forward and it improved, continue moving forward.
    If it worsened, reverse direction.
    """
    
    # If this is the very first move, propose a simple 10cm listener movement
    if len(history) <= 1:
        new_y = current_config.listener.position.y + 0.10
        return {
            "action": "Move listener 10 cm forward",
            "variable": "listener.y",
            "new_value": new_y,
            "reason": "Initial coarse search to test spatial sensitivity of low frequency response."
        }
        
    # Analyze the last move
    last_move = history[-1]
    prev_move = history[-2]
    
    # Very simplified heuristic for demonstration of the philosophy
    improved = last_move["metrics"]["target_null_depth"] < prev_move["metrics"]["target_null_depth"]
    
    if last_move["variable"] == "listener.y":
        direction = 1 if last_move["value"] > prev_move["value"] else -1
        
        if improved:
            # Keep going same direction, maybe smaller step
            step = 0.05 * direction
            reason = "Previous movement improved the target null. Continuing in same direction."
        else:
            # Reverse direction
            step = -0.10 * direction
            reason = "Previous movement worsened the target null. Reversing direction."
            
        new_y = current_config.listener.position.y + step
        return {
            "action": f"Move listener {abs(step)*100:.0f} cm {'forward' if step > 0 else 'backward'}",
            "variable": "listener.y",
            "new_value": new_y,
            "reason": reason
        }
        
    return {
        "action": "Maintain current position",
        "reason": "Need more measurements to determine trend."
    }
