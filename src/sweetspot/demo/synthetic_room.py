import numpy as np

class SyntheticRoom:
    """
    A synthetic room generator for demonstration purposes.
    It doesn't use AI or complex physics modeling. It just returns
    an IR based on hardcoded rules to demonstrate the experimental flow.
    """
    
    def __init__(self):
        self.sample_rate = 48000
        
    def measure(self, listener_y: float) -> np.ndarray:
        """
        Returns a synthetic impulse response.
        If listener_y is near 1.5, it has a strong null at 74 Hz.
        If listener_y moves to 1.6, the null is shallower.
        If listener_y moves to 1.65, the null is even shallower, but a peak at 105 Hz grows.
        """
        ir_len = int(1.0 * self.sample_rate)
        ir = np.zeros(ir_len)
        
        # Direct sound at 10ms
        direct_idx = int(0.01 * self.sample_rate)
        ir[direct_idx] = 1.0
        
        # We simulate the frequency response features by adding a delayed inverted pulse (comb filtering)
        # 74 Hz null -> delay of 1/(2*74) = 6.75 ms
        delay_74_s = 1.0 / (2 * 74.0)
        delay_74_idx = int(delay_74_s * self.sample_rate)
        
        # Depth of null depends on listener_y
        # baseline y=1.5 -> depth = 0.9 (deep null)
        # y=1.6 -> depth = 0.6
        # y=1.65 -> depth = 0.3
        
        if abs(listener_y - 1.5) < 0.02:
            amp_74 = 0.9
            amp_105 = 0.1
        elif abs(listener_y - 1.6) < 0.02:
            amp_74 = 0.6
            amp_105 = 0.2
        elif abs(listener_y - 1.65) < 0.02:
            amp_74 = 0.3
            amp_105 = 0.4
        else:
            amp_74 = 0.5
            amp_105 = 0.2
            
        ir[direct_idx + delay_74_idx] -= amp_74
        
        # 105 Hz peak -> delay of 1/(105) = 9.5 ms, positive addition
        delay_105_s = 1.0 / 105.0
        delay_105_idx = int(delay_105_s * self.sample_rate)
        ir[direct_idx + delay_105_idx] += amp_105
        
        # Decay (exponential)
        decay = np.exp(-10 * np.linspace(0, 1, ir_len - direct_idx))
        ir[direct_idx:] *= decay
        
        return ir
