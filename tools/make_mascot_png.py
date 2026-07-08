# 원본 마스코트(assets/images/MBC_icon.jpg, 검정 배경)를 투명 배경 PNG로 변환.
# 라이트 테마 헤더·로그인·아이콘에서 배경 없이 자연스럽게 얹기 위함.
# 거의 순수 검정(max(r,g,b) < 40)만 투명 처리 → 캐릭터의 진갈색 눈 등은 보존.
from PIL import Image

SRC = "assets/images/MBC_icon.jpg"
OUT = "frontend/images/mascot.png"

im = Image.open(SRC).convert("RGBA")
data = im.get_flattened_data() if hasattr(im, "get_flattened_data") else list(im.getdata())
new = [(r, g, b, 0) if max(r, g, b) < 40 else (r, g, b, 255) for (r, g, b, a) in data]
im.putdata(new)
im = im.crop(im.getbbox())  # 투명 여백 제거
im.save(OUT)
print("saved", OUT, im.size)
