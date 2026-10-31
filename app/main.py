"""starrobox_umi main window. Buttons are not wired yet."""
import sys
from PySide6.QtWidgets import (QApplication, QHBoxLayout, QLabel, QListWidget,
	QMainWindow, QPushButton, QVBoxLayout, QWidget)


class MainWindow(QMainWindow):
	def __init__(self) -> None:
		super().__init__()
		self.setWindowTitle("starrobox_umi")
		self.resize(960, 600)

		self.recordings = QListWidget()
		self.recordings.addItem("No recordings imported")
		self.import_button = QPushButton("Import Insta360 / GoPro")
		self.run_button = QPushButton("Run ORB-SLAM3")
		self.run_button.setEnabled(False)

		left = QVBoxLayout()
		left.addWidget(QLabel("Recordings"))
		left.addWidget(self.recordings)
		left.addWidget(self.import_button)
		left.addWidget(self.run_button)

		self.view = QLabel("Trajectory view (not implemented)")
		self.view.setStyleSheet("background:#1e1e1e;color:#bbb;")
		self.view.setMinimumWidth(600)

		root = QHBoxLayout()
		root.addLayout(left, 1)
		root.addWidget(self.view, 3)
		central = QWidget()
		central.setLayout(root)
		self.setCentralWidget(central)


def main() -> int:
	app = QApplication(sys.argv)
	window = MainWindow()
	window.show()
	return app.exec()


if __name__ == "__main__":
	sys.exit(main())
