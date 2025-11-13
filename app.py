# -*- coding: utf-8 -*-
import os
import uuid
import numpy as np
import cv2
import pytesseract
from flask import Flask, render_template, request, send_file, jsonify, send_from_directory
from PIL import Image, ImageOps, ImageEnhance
import torch
import io
import base64
from werkzeug.utils import secure_filename

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['UPLOAD_FOLDER'] = 'static/images'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Create upload directory if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Load models (this will happen once when the app starts)
print("Loading AnimeGAN2 models...")
try:
    model_celeba = torch.hub.load("bryandlee/animegan2-pytorch:main", "generator", pretrained="celeba_distill")
    model_facev1 = torch.hub.load("bryandlee/animegan2-pytorch:main", "generator", pretrained="face_paint_512_v1")
    model_facev2 = torch.hub.load("bryandlee/animegan2-pytorch:main", "generator", pretrained="face_paint_512_v2")
    model_paprika = torch.hub.load("bryandlee/animegan2-pytorch:main", "generator", pretrained="paprika")
    face2paint = torch.hub.load("bryandlee/animegan2-pytorch:main", "face2paint", size=512)
    models_loaded = True
    print("All models loaded successfully!")
except Exception as e:
    print(f"Error loading models: {e}")
    models_loaded = False

# Allowed file extensions
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'bmp', 'tiff', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def convert_color_mode(img, mode):
    """Convert image to different color modes"""
    try:
        if mode == 'grayscale':
            return img.convert('L')
        elif mode == 'sepia':
            # Create sepia tone
            width, height = img.size
            pixels = img.load()
            for py in range(height):
                for px in range(width):
                    r, g, b = img.getpixel((px, py))
                    tr = int(0.393 * r + 0.769 * g + 0.189 * b)
                    tg = int(0.349 * r + 0.686 * g + 0.168 * b)
                    tb = int(0.272 * r + 0.534 * g + 0.131 * b)
                    pixels[px, py] = (min(255, tr), min(255, tg), min(255, tb))
            return img
        elif mode == 'invert':
            return ImageOps.invert(img.convert('RGB'))
        elif mode == 'cmyk':
            return img.convert('CMYK')
        elif mode == 'hsv':
            # Convert to HSV using numpy
            img_array = np.array(img.convert('RGB'))
            hsv_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2HSV)
            return Image.fromarray(hsv_array, 'HSV')
        elif mode == 'hsl':
            # Convert to HSL using numpy
            img_array = np.array(img.convert('RGB'))
            hls_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2HLS)
            return Image.fromarray(hls_array, 'HLS')
        else:
            return img.convert(mode.upper())
    except Exception as e:
        print(f"Error in color conversion: {e}")
        return img

def extract_text_from_image(img):
    """Extract text from image using OCR"""
    try:
        # Use pytesseract to extract text
        text = pytesseract.image_to_string(img)
        return text.strip() if text.strip() else "No text detected in the image."
    except Exception as e:
        return f"Error in OCR: {str(e)}"

def adjust_hsv(img, h_factor, s_factor, v_factor):
    """Adjust HSV values of image"""
    try:
        # Convert to HSV
        img_array = np.array(img.convert('RGB'))
        hsv_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2HSV).astype(np.float32)
        
        # Adjust values
        hsv_array[:, :, 0] = (hsv_array[:, :, 0] * h_factor) % 180  # Hue
        hsv_array[:, :, 1] = np.clip(hsv_array[:, :, 1] * s_factor, 0, 255)  # Saturation
        hsv_array[:, :, 2] = np.clip(hsv_array[:, :, 2] * v_factor, 0, 255)  # Value
        
        # Convert back to RGB
        hsv_array = hsv_array.astype(np.uint8)
        rgb_array = cv2.cvtColor(hsv_array, cv2.COLOR_HSV2RGB)
        return Image.fromarray(rgb_array)
    except Exception as e:
        print(f"Error in HSV adjustment: {e}")
        return img

@app.route('/')
def index():
    return render_template('index.html', models_loaded=models_loaded)

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file selected'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if file and allowed_file(file.filename):
        # Generate unique filename
        file_ext = file.filename.rsplit('.', 1)[1].lower()
        unique_filename = f"{uuid.uuid4().hex}.{file_ext}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        
        # Save uploaded file
        file.save(filepath)
        
        # Open and process image
        img = Image.open(filepath).convert("RGB")
        
        # Store original image info
        result_data = {
            'original': f"/static/images/{unique_filename}",
            'converted': {},
            'text': extract_text_from_image(img)
        }
        
        # Generate anime versions if models are loaded
        if models_loaded:
            try:
                out_celeba = face2paint(model_celeba, img)
                out_facev1 = face2paint(model_facev1, img)
                out_facev2 = face2paint(model_facev2, img)
                out_paprika = face2paint(model_paprika, img)
                
                # Save generated images
                out_celeba_path = os.path.join(app.config['UPLOAD_FOLDER'], f"celeba_{unique_filename}")
                out_facev1_path = os.path.join(app.config['UPLOAD_FOLDER'], f"facev1_{unique_filename}")
                out_facev2_path = os.path.join(app.config['UPLOAD_FOLDER'], f"facev2_{unique_filename}")
                out_paprika_path = os.path.join(app.config['UPLOAD_FOLDER'], f"paprika_{unique_filename}")
                
                out_celeba.save(out_celeba_path)
                out_facev1.save(out_facev1_path)
                out_facev2.save(out_facev2_path)
                out_paprika.save(out_paprika_path)
                
                result_data.update({
                    'celeba': f"/static/images/celeba_{unique_filename}",
                    'facev1': f"/static/images/facev1_{unique_filename}",
                    'facev2': f"/static/images/facev2_{unique_filename}",
                    'paprika': f"/static/images/paprika_{unique_filename}"
                })
            except Exception as e:
                print(f"Error generating anime images: {e}")
        
        # Generate color mode conversions
        color_modes = ['grayscale', 'sepia', 'invert', 'cmyk', 'hsv', 'hsl']
        for mode in color_modes:
            try:
                converted_img = convert_color_mode(img.copy(), mode)
                converted_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{mode}_{unique_filename}")
                converted_img.save(converted_path)
                result_data['converted'][mode] = f"/static/images/{mode}_{unique_filename}"
            except Exception as e:
                print(f"Error in {mode} conversion: {e}")
        
        return jsonify(result_data)
    
    return jsonify({'error': 'Invalid file type. Please upload a valid image file.'}), 400

@app.route('/convert', methods=['POST'])
def convert_image():
    """Handle specific conversion requests"""
    data = request.json
    filename = data.get('filename')
    conversion_type = data.get('type')
    params = data.get('params', {})
    
    if not filename or not conversion_type:
        return jsonify({'error': 'Missing parameters'}), 400
    
    try:
        img_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        img = Image.open(img_path).convert("RGB")
        
        if conversion_type == 'hsv_adjust':
            h_factor = params.get('h', 1.0)
            s_factor = params.get('s', 1.0)
            v_factor = params.get('v', 1.0)
            converted_img = adjust_hsv(img, h_factor, s_factor, v_factor)
        elif conversion_type == 'enhance':
            factor = params.get('factor', 1.0)
            enhancer = ImageEnhance.Color(img)
            converted_img = enhancer.enhance(factor)
        else:
            return jsonify({'error': 'Invalid conversion type'}), 400
        
        # Save converted image
        converted_filename = f"converted_{uuid.uuid4().hex}.jpg"
        converted_path = os.path.join(app.config['UPLOAD_FOLDER'], converted_filename)
        converted_img.save(converted_path)
        
        return jsonify({
            'converted': f"/static/images/{converted_filename}"
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download/<path:filename>')
def download_file(filename):
    """Download file in specified format"""
    format_type = request.args.get('format', 'JPEG')
    quality = request.args.get('quality', 95)
    
    try:
        img_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        img = Image.open(img_path)
        
        # Convert to desired format
        if format_type.upper() == 'PNG':
            img = img.convert('RGBA')
        else:
            img = img.convert('RGB')
        
        # Save to bytes buffer
        buffer = io.BytesIO()
        img.save(buffer, format=format_type, quality=int(quality), optimize=True)
        buffer.seek(0)
        
        download_filename = f"converted_{filename.split('_')[-1].split('.')[0]}.{format_type.lower()}"
        
        return send_file(
            buffer,
            as_attachment=True,
            download_name=download_filename,
            mimetype=f'image/{format_type.lower()}'
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)