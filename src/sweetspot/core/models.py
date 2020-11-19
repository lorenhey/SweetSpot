from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import datetime

class MeasurementMode(str, Enum):
    QUICK = "QUICK"
    MEASUREMENT = "MEASUREMENT"
    EXTENDED_BAND = "EXTENDED_BAND"

class Position(BaseModel):
    x: float = Field(0.0, description="X coordinate (e.g. width from left wall)")
    y: float = Field(0.0, description="Y coordinate (e.g. length from front wall)")
    z: float = Field(0.0, description="Z coordinate (e.g. height from floor)")

class MonitorConfig(BaseModel):
    position: Position
    toe_in_deg: float = 0.0
    
class ListenerConfig(BaseModel):
    position: Position

class PlacementConfig(BaseModel):
    id: str
    name: str = "Configuration"
    listener: ListenerConfig
    left_monitor: MonitorConfig
    right_monitor: MonitorConfig
    notes: str = ""

class AudioDeviceConfig(BaseModel):
    name: str
    sample_rate: int
    channels: int
    
class MicrophoneConfig(BaseModel):
    name: str
    calibration_file: Optional[str] = None
    orientation_deg: float = 0.0
    
class MeasurementChain(BaseModel):
    output_device: AudioDeviceConfig
    input_device: AudioDeviceConfig
    microphone: MicrophoneConfig
    
class SweepConfig(BaseModel):
    start_freq: float
    end_freq: float
    duration_s: float
    level_dbfs: float
    sample_rate: int
    channel: str # 'left', 'right', 'both'

class Measurement(BaseModel):
    id: str
    timestamp: datetime.datetime
    config: PlacementConfig
    chain: MeasurementChain
    sweep: SweepConfig
    mode: MeasurementMode = MeasurementMode.QUICK
    raw_response_path: str # Path or identifier to the raw audio file
    ir_path: Optional[str] = None
    notes: str = ""

class PlacementExperiment(BaseModel):
    id: str
    variable_changed: str
    candidate_positions: List[PlacementConfig]
    measurements: Dict[str, Measurement] = Field(default_factory=dict)
    selected_config_id: Optional[str] = None
    reasoning: str = ""

class SweetSpotSession(BaseModel):
    id: str
    room_dimensions: Optional[Position] = None
    configurations: Dict[str, PlacementConfig] = Field(default_factory=dict)
    measurements: Dict[str, Measurement] = Field(default_factory=dict)
    experiments: List[PlacementExperiment] = Field(default_factory=list)
    version: str = "1.0.0"
