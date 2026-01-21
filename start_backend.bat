@echo off
cd /d "%~dp0backend"
echo Installing Python dependencies...
pip install -r requirements.txt
echo Starting Flask backend on port 5000...
python app.py
pause
