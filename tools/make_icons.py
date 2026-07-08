# 마스코트(투명 배경 PNG)를 흰 배경 정사각 PNG 아이콘으로 변환.
# 표준 아이콘: 여백 8%. maskable: 안전영역 위해 여백 20%.
# (mascot.png는 원본 MBC_icon.jpg의 검정 배경을 투명 처리한 파일 — tools/make_mascot_png.py 참고)
from PIL import Image
import os

SRC = "frontend/images/mascot.png"
OUT = "frontend/icons"
BG = (255, 255, 255)  # 흰 배경(라이트 테마)

os.makedirs(OUT, exist_ok=True)
mascot = Image.open(SRC).convert("RGBA")

def make(size, pad_ratio, name):
    canvas = Image.new("RGB", (size, size), BG)
    inner = int(size * (1 - 2 * pad_ratio))
    m = mascot.copy()
    m.thumbnail((inner, inner), Image.LANCZOS)
    x = (size - m.width) // 2
    y = (size - m.height) // 2
    canvas.paste(m, (x, y), m)  # 알파를 마스크로 사용
    canvas.save(os.path.join(OUT, name))
    print("wrote", name, size)

make(180, 0.08, "icon-180.png")
make(192, 0.08, "icon-192.png")
make(512, 0.08, "icon-512.png")
make(512, 0.20, "icon-maskable-512.png")
