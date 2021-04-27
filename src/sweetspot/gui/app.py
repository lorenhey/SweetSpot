import sys
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, 
    QHBoxLayout, QPushButton, QLabel, QTabWidget,
    QProgressBar, QMessageBox, QGroupBox
)
from PySide6.QtCore import Qt

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("SweetSpot: Experimental Placement Assistant")
        self.resize(1000, 700)
        
        self.central_widget = QWidget()
        self.setCentralWidget(self.central_widget)
        self.main_layout = QVBoxLayout(self.central_widget)
        
        # Header
        self.header_label = QLabel("SweetSpot - Measure, Move, Compare")
        self.header_label.setStyleSheet("font-size: 18px; font-weight: bold; margin-bottom: 10px;")
        self.main_layout.addWidget(self.header_label)
        
        # Tabs for workflow
        self.tabs = QTabWidget()
        self.main_layout.addWidget(self.tabs)
        
        self.setup_tab()
        self.measure_tab()
        self.understand_tab()
        self.move_tab()
        self.compare_tab()
        
    def setup_tab(self):
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        group = QGroupBox("Configuration")
        glayout = QVBoxLayout(group)
        glayout.addWidget(QLabel("Mode: QUICK (Relative Measurement)"))
        glayout.addWidget(QLabel("Audio Input: Default Microphone"))
        glayout.addWidget(QLabel("Audio Output: Default Speakers"))
        
        layout.addWidget(group)
        layout.addStretch()
        
        self.tabs.addTab(widget, "1. Setup")
        
    def measure_tab(self):
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        btn_layout = QHBoxLayout()
        btn_left = QPushButton("Measure Left")
        btn_right = QPushButton("Measure Right")
        btn_left.setMinimumHeight(50)
        btn_right.setMinimumHeight(50)
        
        btn_layout.addWidget(btn_left)
        btn_layout.addWidget(btn_right)
        
        self.progress = QProgressBar()
        self.progress.setValue(0)
        
        log_label = QLabel("Ready for measurement.")
        
        layout.addLayout(btn_layout)
        layout.addWidget(self.progress)
        layout.addWidget(log_label)
        layout.addStretch()
        
        self.tabs.addTab(widget, "2. Measure")
        
    def understand_tab(self):
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        layout.addWidget(QLabel("Graphs will appear here (FR, ETC, Decay)."))
        layout.addWidget(QLabel("Using pyqtgraph for high-performance rendering."))
        layout.addStretch()
        
        self.tabs.addTab(widget, "3. Understand")
        
    def move_tab(self):
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        suggest_group = QGroupBox("Next Experiment")
        slayout = QVBoxLayout(suggest_group)
        slayout.addWidget(QLabel("<b>Action:</b> Move listener 15 cm forward"))
        slayout.addWidget(QLabel("<b>Reason:</b> Testing spatial sensitivity of 72Hz null."))
        
        btn_done = QPushButton("I moved it. Let's remeasure.")
        btn_done.setStyleSheet("background-color: #4CAF50; color: white; padding: 10px;")
        slayout.addWidget(btn_done)
        
        layout.addWidget(suggest_group)
        layout.addStretch()
        
        self.tabs.addTab(widget, "4. Move")
        
    def compare_tab(self):
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        layout.addWidget(QLabel("Comparison of Before and After moves will appear here."))
        layout.addStretch()
        
        self.tabs.addTab(widget, "5. Compare")

def main():
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())

if __name__ == "__main__":
    main()
