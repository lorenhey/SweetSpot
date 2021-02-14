import numpy as np
import sounddevice as sd
from typing import Optional, List, Dict, Any

class AudioDevice:
    """Wrapper around sounddevice for physical measurements."""
    
    @staticmethod
    def list_devices() -> List[Dict[str, Any]]:
        return list(sd.query_devices())
        
    @staticmethod
    def get_default_devices() -> tuple:
        return sd.default.device
        
    @staticmethod
    def check_routing(
        output_device_id: int,
        input_device_id: int,
        sample_rate: int = 48000
    ) -> bool:
        """
        Performs a basic routing check (plays a soft tone, checks if input picks it up).
        In a real implementation, this should be a short, low-level chirp.
        """
        # A simple check just tries to open the stream
        try:
            with sd.Stream(
                device=(input_device_id, output_device_id),
                samplerate=sample_rate,
                channels=(1, 2)
            ):
                pass
            return True
        except Exception:
            return False
            
    @staticmethod
    def measure_sweep(
        sweep: np.ndarray,
        output_device_id: int,
        input_device_id: int,
        sample_rate: int,
        output_channel: int = 0, # 0 for Left, 1 for Right
        input_channel: int = 0
    ) -> np.ndarray:
        """
        Plays the sweep and records the response simultaneously.
        """
        # Prepare stereo output buffer (or whatever channels the device takes)
        out_buffer = np.zeros((len(sweep), 2))
        out_buffer[:, output_channel] = sweep
        
        # We record some extra time to capture the decay/reverb tail
        tail_s = 2.0
        tail_samples = int(tail_s * sample_rate)
        
        padded_out = np.vstack([out_buffer, np.zeros((tail_samples, 2))])
        
        recording = sd.playrec(
            padded_out,
            samplerate=sample_rate,
            input_mapping=[input_channel + 1], # sounddevice mapping is 1-indexed
            device=(input_device_id, output_device_id),
            blocking=True
        )
        
        return recording[:, 0]

class MockAudioDevice:
    """Mock audio device for testing and CI without physical hardware."""
    
    @staticmethod
    def measure_sweep(
        sweep: np.ndarray,
        sample_rate: int,
        distance_m: float = 1.0,
        reflection_delay_s: float = 0.005,
        noise_level: float = 1e-4
    ) -> np.ndarray:
        """
        Simulates a room response by delaying and attenuating the sweep,
        adding a simulated reflection and some noise.
        """
        speed_of_sound = 343.0
        direct_delay_s = distance_m / speed_of_sound
        
        direct_delay_samples = int(direct_delay_s * sample_rate)
        reflection_delay_samples = direct_delay_samples + int(reflection_delay_s * sample_rate)
        
        # Tail for decay
        tail_samples = int(2.0 * sample_rate)
        total_len = len(sweep) + tail_samples
        
        recorded = np.zeros(total_len)
        
        # Add direct sound
        if direct_delay_samples < len(recorded):
            copy_len = min(len(sweep), len(recorded) - direct_delay_samples)
            recorded[direct_delay_samples:direct_delay_samples+copy_len] += sweep[:copy_len]
            
        # Add reflection (attenuated and inverted)
        if reflection_delay_samples < len(recorded):
            copy_len = min(len(sweep), len(recorded) - reflection_delay_samples)
            recorded[reflection_delay_samples:reflection_delay_samples+copy_len] -= 0.5 * sweep[:copy_len]
            
        # Add noise
        recorded += np.random.normal(0, noise_level, len(recorded))
        
        return recorded
