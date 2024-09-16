import pytesseract
from PIL import Image
import cv2
import numpy as np

# Load the image
image_path = '3.png'
image = cv2.imread(image_path)

# Preprocess the image

# 1.Grayscale conversion
gray_image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

# 2.Noise reduction
denoised_image = cv2.fastNlMeansDenoising(gray_image)

# 3.Thresholding
_, binary_image = cv2.threshold(denoised_image, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)


# Deskewing
coords = np.column_stack(np.where(binary_image > 0))
angle = cv2.minAreaRect(coords)[-1]
if angle < -45:
       angle = -(90 + angle)
else:
       angle = -angle

(h, w) = binary_image.shape[:2]
center = (w // 2, h // 2)
M = cv2.getRotationMatrix2D(center, angle, 1.0)
rotated = cv2.warpAffine(binary_image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


# Perform OCR
text = pytesseract.image_to_string(binary_image)

# Print the extracted text
print(text)

