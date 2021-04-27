import pytest
from sweetspot.experiments.recommender import propose_next_move
from sweetspot.core.models import PlacementConfig, ListenerConfig, MonitorConfig, Position

def test_propose_next_move_initial():
    config = PlacementConfig(
        id="pos_A",
        listener=ListenerConfig(position=Position(y=1.5)),
        left_monitor=MonitorConfig(position=Position()),
        right_monitor=MonitorConfig(position=Position())
    )
    
    # First move
    history = [{"variable": "baseline", "value": 1.5, "metrics": {"target_null_depth": 18.0}}]
    move = propose_next_move(config, history)
    
    assert move["variable"] == "listener.y"
    assert move["new_value"] == 1.6 # Moved +10cm

def test_propose_next_move_improving():
    config = PlacementConfig(
        id="pos_B",
        listener=ListenerConfig(position=Position(y=1.6)),
        left_monitor=MonitorConfig(position=Position()),
        right_monitor=MonitorConfig(position=Position())
    )
    
    # History shows improvement (depth decreased from 18 to 12)
    history = [
        {"variable": "baseline", "value": 1.5, "metrics": {"target_null_depth": 18.0}},
        {"variable": "listener.y", "value": 1.6, "metrics": {"target_null_depth": 12.0}}
    ]
    
    move = propose_next_move(config, history)
    
    # Should continue in the same direction but smaller step
    assert move["variable"] == "listener.y"
    assert move["new_value"] == pytest.approx(1.65) # +5cm
