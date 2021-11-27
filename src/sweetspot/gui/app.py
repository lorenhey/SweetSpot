import sys
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout,
    QHBoxLayout, QPushButton, QLabel, QTabWidget,
    QProgressBar, QGroupBox
)

STRINGS = {
    "es": {
        "title": "SweetSpot - Asistente experimental de posicionamiento",
        "header": "SweetSpot - Medir, mover, comparar",
        "lang_btn": "EN",
        "tab_setup": "1. Configuración",
        "tab_measure": "2. Medir",
        "tab_understand": "3. Analizar",
        "tab_move": "4. Mover",
        "tab_compare": "5. Comparar",
        "cfg_group": "Configuración",
        "cfg_mode": "Modo: RÁPIDO (medición relativa, SPL no calibrado)",
        "cfg_in": "Entrada de audio: Micrófono predeterminado",
        "cfg_out": "Salida de audio: Monitores predeterminados",
        "btn_left": "Medir izquierdo (L)",
        "btn_right": "Medir derecho (R)",
        "log_ready": "Listo para medir.",
        "understand_1": "Acá se muestran las curvas obtenidas (FR, ETC, decaimiento).",
        "understand_2": "Renderizado con pyqtgraph.",
        "move_group": "Siguiente experimento",
        "move_action": "<b>Acción:</b> Mover el oyente 15 cm hacia adelante",
        "move_reason": "<b>Motivo:</b> Evaluar sensibilidad espacial del nulo en 72 Hz.",
        "btn_done": "Ya lo moví, volver a medir",
        "compare_text": "Acá se muestra la comparación antes y después de cada movimiento.",
    },
    "en": {
        "title": "SweetSpot - Experimental Placement Assistant",
        "header": "SweetSpot - Measure, Move, Compare",
        "lang_btn": "ES",
        "tab_setup": "1. Setup",
        "tab_measure": "2. Measure",
        "tab_understand": "3. Understand",
        "tab_move": "4. Move",
        "tab_compare": "5. Compare",
        "cfg_group": "Configuration",
        "cfg_mode": "Mode: QUICK (relative measurement, uncalibrated SPL)",
        "cfg_in": "Audio Input: Default Microphone",
        "cfg_out": "Audio Output: Default Speakers",
        "btn_left": "Measure Left (L)",
        "btn_right": "Measure Right (R)",
        "log_ready": "Ready for measurement.",
        "understand_1": "Measured curves will appear here (FR, ETC, Decay).",
        "understand_2": "Rendered with pyqtgraph.",
        "move_group": "Next Experiment",
        "move_action": "<b>Action:</b> Move listener 15 cm forward",
        "move_reason": "<b>Reason:</b> Testing spatial sensitivity of the 72 Hz null.",
        "btn_done": "Moved it, measure again",
        "compare_text": "Before/after comparison of placement moves will appear here.",
    },
}


class MainWindow(QMainWindow):
    def __init__(self, lang: str = "es"):
        super().__init__()
        self.lang = "en" if lang.lower().startswith("en") else "es"
        self.resize(1000, 700)

        self.central_widget = QWidget()
        self.setCentralWidget(self.central_widget)
        self.main_layout = QVBoxLayout(self.central_widget)

        top_bar = QHBoxLayout()
        self.header_label = QLabel()
        self.header_label.setStyleSheet("font-size: 18px; font-weight: bold;")
        self.btn_lang = QPushButton()
        self.btn_lang.setFixedWidth(48)
        self.btn_lang.clicked.connect(self.toggle_language)
        top_bar.addWidget(self.header_label)
        top_bar.addStretch()
        top_bar.addWidget(self.btn_lang)
        self.main_layout.addLayout(top_bar)

        self.tabs = QTabWidget()
        self.main_layout.addWidget(self.tabs)

        self.setup_tab()
        self.measure_tab()
        self.understand_tab()
        self.move_tab()
        self.compare_tab()

        self.apply_language()

    def setup_tab(self):
        widget = QWidget()
        layout = QVBoxLayout(widget)
        self.cfg_group = QGroupBox()
        glayout = QVBoxLayout(self.cfg_group)
        self.lbl_mode = QLabel()
        self.lbl_in = QLabel()
        self.lbl_out = QLabel()
        glayout.addWidget(self.lbl_mode)
        glayout.addWidget(self.lbl_in)
        glayout.addWidget(self.lbl_out)
        layout.addWidget(self.cfg_group)
        layout.addStretch()
        self.tabs.addTab(widget, "")

    def measure_tab(self):
        widget = QWidget()
        layout = QVBoxLayout(widget)
        btn_layout = QHBoxLayout()
        self.btn_left = QPushButton()
        self.btn_right = QPushButton()
        self.btn_left.setMinimumHeight(46)
        self.btn_right.setMinimumHeight(46)
        btn_layout.addWidget(self.btn_left)
        btn_layout.addWidget(self.btn_right)

        self.progress = QProgressBar()
        self.progress.setValue(0)
        self.log_label = QLabel()

        layout.addLayout(btn_layout)
        layout.addWidget(self.progress)
        layout.addWidget(self.log_label)
        layout.addStretch()
        self.tabs.addTab(widget, "")

    def understand_tab(self):
        widget = QWidget()
        layout = QVBoxLayout(widget)
        self.lbl_understand_1 = QLabel()
        self.lbl_understand_2 = QLabel()
        layout.addWidget(self.lbl_understand_1)
        layout.addWidget(self.lbl_understand_2)
        layout.addStretch()
        self.tabs.addTab(widget, "")

    def move_tab(self):
        widget = QWidget()
        layout = QVBoxLayout(widget)
        self.move_group = QGroupBox()
        slayout = QVBoxLayout(self.move_group)
        self.lbl_move_action = QLabel()
        self.lbl_move_reason = QLabel()
        self.btn_done = QPushButton()
        slayout.addWidget(self.lbl_move_action)
        slayout.addWidget(self.lbl_move_reason)
        slayout.addWidget(self.btn_done)
        layout.addWidget(self.move_group)
        layout.addStretch()
        self.tabs.addTab(widget, "")

    def compare_tab(self):
        widget = QWidget()
        layout = QVBoxLayout(widget)
        self.lbl_compare = QLabel()
        layout.addWidget(self.lbl_compare)
        layout.addStretch()
        self.tabs.addTab(widget, "")

    def toggle_language(self):
        self.lang = "en" if self.lang == "es" else "es"
        self.apply_language()

    def apply_language(self):
        t = STRINGS[self.lang]
        self.setWindowTitle(t["title"])
        self.header_label.setText(t["header"])
        self.btn_lang.setText(t["lang_btn"])

        self.tabs.setTabText(0, t["tab_setup"])
        self.tabs.setTabText(1, t["tab_measure"])
        self.tabs.setTabText(2, t["tab_understand"])
        self.tabs.setTabText(3, t["tab_move"])
        self.tabs.setTabText(4, t["tab_compare"])

        self.cfg_group.setTitle(t["cfg_group"])
        self.lbl_mode.setText(t["cfg_mode"])
        self.lbl_in.setText(t["cfg_in"])
        self.lbl_out.setText(t["cfg_out"])

        self.btn_left.setText(t["btn_left"])
        self.btn_right.setText(t["btn_right"])
        self.log_label.setText(t["log_ready"])

        self.lbl_understand_1.setText(t["understand_1"])
        self.lbl_understand_2.setText(t["understand_2"])

        self.move_group.setTitle(t["move_group"])
        self.lbl_move_action.setText(t["move_action"])
        self.lbl_move_reason.setText(t["move_reason"])
        self.btn_done.setText(t["btn_done"])

        self.lbl_compare.setText(t["compare_text"])


def main():
    app = QApplication(sys.argv)
    window = MainWindow(lang="es")
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
