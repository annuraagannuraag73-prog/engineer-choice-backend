import os
import json

songs_dir = "songs"
playlist = []
song_id = 1

if os.path.exists(songs_dir):
    # Loop through each category folder (e.g., hindi songs, nepali songs)
    for category in os.listdir(songs_dir):
        category_path = os.path.join(songs_dir, category)
        
        if os.path.isdir(category_path):
            # Loop through each mp3 file inside the category folder
            for file in os.listdir(category_path):
                if file.lower().endswith('.mp3'):
                    # Get original filename as title (without .mp3 extension)
                    title = os.path.splitext(file)[0]
                    file_url = f"{songs_dir}/{category}/{file}".replace("\\", "/")
                    
                    playlist.append({
                        "id": song_id,
                        "title": title,
                        "category": category,
                        "fileUrl": file_url
                    })
                    song_id += 1

    # Save to playlist.json
    with open("playlist.json", "w", encoding="utf-8") as f:
        json.dump(playlist, f, indent=4, ensure_ascii=False)
    
    print(f"Success! {len(playlist)} ota geet automatic playlist.json ma add vayo!")
else:
    print("Error: 'songs' folder vetiyena!")

    