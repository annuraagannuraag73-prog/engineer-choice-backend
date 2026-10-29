from flask import Flask, request, jsonify
from flask_cors import CORS
import yt_dlp
import os

app = Flask(__name__)
CORS(app)

# 1. Root route - Browser ma kholda 404 audaina, server active xa vanera dekhauxa
@app.route('/', methods=['GET'])
def home():
    return jsonify({
        'success': True, 
        'message': 'Engineer Choice Backend is running successfully!'
    }), 200

# 2. Download route - App bata audio link nikalna ko lagi
@app.route('/download', methods=['POST'])
def download_audio():
    data = request.get_json(silent=True)
    print("Received data from frontend:", data)

    if not data or 'url' not in data:
        return jsonify({'success': False, 'message': 'URL missing'}), 400

    yt_url = data.get('url')

    try:
        # yt-dlp options with multi-client anti-bot bypass
        ydl_opts = {
            'format': 'bestaudio/best',
            'quiet': True,
            'no_warnings': True,
            'extractor_args': {
                'youtube': {
                    'player_client': ['ios', 'mweb', 'android', 'web']
                }
            },
        }

        # Check if cookies.txt exists on server for stable authentication
        if os.path.exists('cookies.txt'):
            ydl_opts['cookiefile'] = 'cookies.txt'

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(yt_url, download=False)
            audio_url = info.get('url')
            song_title = info.get('title', 'Unknown Title')

        if audio_url:
            print(f"Successfully extracted: {song_title}")
            return jsonify({
                'success': True, 
                'audioUrl': audio_url,
                'title': song_title
            })
        else:
            return jsonify({'success': False, 'message': 'Audio stream link payena'}), 400

    except Exception as e:
        print("Error:", e)
        return jsonify({'success': False, 'message': str(e)}), 500

if __name__ == '__main__':
    print("Python Flask Server running with yt-dlp on port 5000...")
    app.run(port=5000, debug=True)