        let db;
        const dbName = "DJProSoundDB";
        const storeName = "songsStore";
        let currentCategory = 'all';
        let globalSongs = [];
        let currentAudio = null; 
        let currentTrackIndex = 0; 
        let isLooping = false;    

        // DOM Elements
        const audioPlayer = document.getElementById('audioPlayer');
        const playPauseBtn = document.getElementById('playPauseBtn');
        const progressBar = document.getElementById('progressBar');
        const currentTimeEl = document.getElementById('currentTime');
        const durationTimeEl = document.getElementById('durationTime');
        const songListEl = document.getElementById('songList');
        const currentTitle = document.getElementById('currentTitle');
        const currentSub = document.getElementById('currentSub');

        document.addEventListener("DOMContentLoaded", () => {
          fetch("playlist.json")
            .then(response => response.json())
            .then(data => {
              globalSongs = data;
              renderSongs(globalSongs);
            })
            .catch(error => console.error("Error loading playlist:", error));
        });

        // 1. Initialize IndexedDB
        const request = indexedDB.open(dbName, 2);

        request.onerror = (event) => {
          console.error("IndexedDB error:", event.target.error);
        };

        request.onsuccess = (event) => {
          db = event.target.result;
          syncPlaylistWithServer();
        };

        request.onupgradeneeded = (event) => {
          let database = event.target.result;
          if (database.objectStoreNames.contains(storeName)) {
            database.deleteObjectStore(storeName);
          }
          database.createObjectStore(storeName, { keyPath: "id" });
        };

        // 2. Auto-Sync with playlist.json
        async function syncPlaylistWithServer() {
          try {
            let response = await fetch('playlist.json');
            let serverSongs = await response.json();

            let transaction = db.transaction(storeName, "readonly");
            let store = transaction.objectStore(storeName);
            let req = store.getAll();

            req.onsuccess = async () => {
              let localSongs = req.result;
              let localIds = localSongs.map(s => s.id);
              let newSongs = serverSongs.filter(s => !localIds.includes(s.id));

              if (newSongs.length > 0) {
                console.log(`Downloading ${newSongs.length} new tracks...`);
                for (let songData of newSongs) {
                  try {
                    let audioRes = await fetch(songData.fileUrl);
                    let blob = await audioRes.blob();

                    let writeTx = db.transaction(storeName, "readwrite");
                    let writeStore = writeTx.objectStore(storeName);
                    writeStore.add({
                      id: songData.id,
                      title: songData.title,
                      category: songData.category,
                      audioBlob: blob
                    });
                  } catch (err) {
                    console.error("Failed to download:", songData.title);
                  }
                }
                setTimeout(() => loadSongsFromDB(), 1000);
              } else {
                loadSongsFromDB();
              }
            };
          } catch (e) {
            console.log("Offline mode: Loading directly from IndexedDB.");
            loadSongsFromDB();
          }
        }

        // 3. Load Songs from IndexedDB
        function loadSongsFromDB() {
          if (!db) return;
          let transaction = db.transaction(storeName, "readonly");
          let store = transaction.objectStore(storeName);
          let req = store.getAll();

          req.onsuccess = () => {
            globalSongs = req.result;
            renderSongs(globalSongs, currentCategory);
          };
        }

        // 4. Category Filter Logic
        function filterCategory(category, event) {
            currentCategory = category;
            
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            if (event && event.currentTarget) {
                event.currentTarget.classList.add('active');
            }
            
            if (category === 'all') {
                renderSongs(globalSongs);
            } else {
                let filtered = globalSongs.filter(s => {
                    let dbCat = s.category ? s.category.toLowerCase().trim().replace(/[\s-_]/g, '') : '';
                    let targetCat = category.toLowerCase().trim().replace(/[\s-_]/g, '');
                    return dbCat === targetCat;
                });
                renderSongs(filtered);
            }
        }

        // 5. Render Songs UI
        function renderSongs(songsToRender) {
          if (!songListEl) return;
          songListEl.innerHTML = '';

          if (!songsToRender || songsToRender.length === 0) {
            songListEl.innerHTML = `<li style="padding: 20px; text-align: center; color: #888899;">No tracks found in this category!</li>`;
            return;
          }

          songsToRender.forEach(song => {
            let originalIndex = globalSongs.indexOf(song); 
            let li = document.createElement('li');
            li.className = 'song-item';
            
            li.innerHTML = `
              <div class="song-info">
                <h4>${song.title}</h4>
                <span>📁 ${song.category}</span>
              </div>
              <button class="play-song-btn" onclick="playAudio(${originalIndex})">Play</button>
            `;
            songListEl.appendChild(li);
          });
        }

        // 6. Play Audio Function
        function playAudio(index) {
            let song = globalSongs[index];
            if (!song) {
                console.error("Song vetiyena!");
                return;
            }

            currentTrackIndex = index;
            let audioUrl = "";

            if (song.audioBlob) {
                audioUrl = URL.createObjectURL(song.audioBlob);
            } else if (song.fileUrl) {
                audioUrl = song.fileUrl;
            } else {
                console.error("Audio source vetiyena!");
                return;
            }

            console.log("Playing:", song.title);

            let titleEl = document.getElementById('currentTitle'); 
            if (titleEl) {
                titleEl.innerText = song.title;
                titleEl.style.display = "block";
                titleEl.style.color = "#ffffff";
            }

            if (!currentAudio) {
                currentAudio = new Audio(audioUrl);
            } else {
                currentAudio.src = audioUrl;
            }

            currentAudio.loop = isLooping;

            currentAudio.play().then(() => {
                if (playPauseBtn) playPauseBtn.innerText = "⏸";
            }).catch(err => {
                console.error("Playback error:", err);
            });

            currentAudio.onloadedmetadata = () => {
                if (durationTimeEl) {
                    durationTimeEl.innerText = formatTime(currentAudio.duration);
                }
            };

            currentAudio.ontimeupdate = () => {
                if (currentAudio.duration) {
                    let progressPercent = (currentAudio.currentTime / currentAudio.duration) * 100;
                    if (progressBar) progressBar.value = progressPercent;
                    if (currentTimeEl) currentTimeEl.innerText = formatTime(currentAudio.currentTime);
                }
            };

            currentAudio.onended = () => {
                if (playPauseBtn) playPauseBtn.innerText = "▶";

                if (isLooping) {
                    currentAudio.currentTime = 0;
                    currentAudio.play();
                    if (playPauseBtn) playPauseBtn.innerText = "⏸";
                } else {
                    currentTrackIndex = (currentTrackIndex + 1) % globalSongs.length;
                    playAudio(currentTrackIndex);
                }
            };
        }

        // 7. Toggle Play/Pause Button
        function togglePlayPause() {
          if (!currentAudio) return;
          
          if (currentAudio.paused) {
            currentAudio.play();
            if (playPauseBtn) playPauseBtn.innerText = "⏸";
          } else {
            currentAudio.pause();
            if (playPauseBtn) playPauseBtn.innerText = "▶";
          }
        }

        // 8. Seek Audio
        function seekAudio(val) {
          if (!currentAudio || !currentAudio.duration) return;
          let seekTime = (val / 100) * currentAudio.duration;
          currentAudio.currentTime = seekTime;
        }

        // 9. Time Formatting Helper
        function formatTime(seconds) {
          let mins = Math.floor(seconds / 60);
          let secs = Math.floor(seconds % 60);
          return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
        }

        // 10. External HTML Buttons Controls
        function playNext() {
          if (!globalSongs || globalSongs.length === 0) return;
          currentTrackIndex = (currentTrackIndex + 1) % globalSongs.length;
          playAudio(currentTrackIndex);
        }

        function playPrevious() {
          if (!globalSongs || globalSongs.length === 0) return;
          currentTrackIndex = (currentTrackIndex - 1 + globalSongs.length) % globalSongs.length;
          playAudio(currentTrackIndex);
        }

        function toggleLoop() {
          isLooping = !isLooping;
          if (currentAudio) {
            currentAudio.loop = isLooping;
          }
          alert(isLooping ? "Loop: ON" : "Loop: OFF");
        }

        // --- MODAL TOGGLES ---
        function toggleDownloadModal() {
            const downloadModal = document.getElementById('downloadModal');
            if (downloadModal) {
                downloadModal.style.display = (downloadModal.style.display === 'flex' || downloadModal.style.display === 'block') ? 'none' : 'flex';
            }
        }

        function toggleSearchModal() {
            const searchModal = document.getElementById('searchModal');
            if (searchModal) {
                searchModal.style.display = (searchModal.style.display === 'flex' || searchModal.style.display === 'block') ? 'none' : 'flex';
            }
        }

        // --- LIVE SEARCH FUNCTION ---
        function filterSongsLive() {
            const query = document.getElementById('popupSearchInput').value.toLowerCase().trim();
            const songList = document.getElementById('songList');
            if (!songList) return;
            const songs = songList.getElementsByTagName('li');

            for (let i = 0; i < songs.length; i++) {
                const songText = songs[i].innerText.toLowerCase();
                if (songText.includes(query)) {
                    songs[i].style.display = ""; 
                } else {
                    songs[i].style.display = "none"; 
                }
            }
        }

     
async function handleYtDownload() {
    const urlInput = document.getElementById('ytUrlInput');
    
    if (!urlInput || !urlInput.value.trim()) {
        alert("Kripya YouTube link halnus!");
        return;
    }

    const youtubeUrl = urlInput.value.trim();
    const selectedCategory = (currentCategory && currentCategory !== 'all') ? currentCategory : "General";

    toggleDownloadModal();
    alert("Download suru hudai xa, kripya kshyan parkhinus...");

    try {
        const API_URL = "https://engineer-choice-backend-1.onrender.com/download";

        console.log("Capacitor HTTP POST bata request pathaidai xa...");

        const options = {
            url: API_URL,
            headers: {
                'Content-Type': 'application/json'
            },
            data: {
                url: youtubeUrl
            }
        };

        let responseData;
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) {
            // Native POST request via CapacitorHttp
            const result = await window.Capacitor.Plugins.CapacitorHttp.post(options);
            responseData = result.data;
        } else {
            // Fallback to fetch POST request if tested in browser
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url: youtubeUrl })
            });
            responseData = await res.json();
        }

        console.log("API Response:", responseData);

        // Extracting correct keys from backend response
        const audioDownloadUrl = responseData.download_url || responseData.dl || responseData.url;
        const audioTitle = responseData.title || "Unknown YouTube Audio";

        if (responseData.success && audioDownloadUrl) {
            console.log("Download Link Payo:", audioDownloadUrl);
            await saveAudioToCategory(audioTitle, audioDownloadUrl, selectedCategory);
        } else {
            alert("Error: " + (responseData.error || "Audio link vetiyena, feri try garnus!"));
        }

    } catch (error) {
        console.error("Fetch Error:", error);
        alert("Catch Error: " + error.message);
    }
}
// 2. Audio Blob fetch garera IndexedDB ra UI ma add garne function
async function saveAudioToCategory(title, downloadUrl, category) {
    try {
        console.log("Audio file download gardai from direct link...");
        let response = await fetch(downloadUrl);
        let blob = await response.blob();

        let newSong = {
            id: 'song_' + Date.now(),
            title: title,
            category: category,
            audioBlob: blob
        };

        // IndexedDB ma save garne
        if (db) {
            let writeTx = db.transaction(storeName, "readwrite");
            let writeStore = writeTx.objectStore(storeName);
            writeStore.put(newSong);
        }

        // Global list ma push garne ra UI refresh garne
        globalSongs.push(newSong);
        renderSongs(globalSongs, currentCategory);
        
        alert("Song successfully download vayera category ma add vayo!");
    } catch (err) {
        console.error("Save Error:", err);
        alert("Blob download garna sakiyena: " + err.message);
    }
}

        // IndexedDB ma song save garne function
        function saveSongToDB(song) {
            if (!db) return;
            let writeTx = db.transaction(storeName, "readwrite");
            let writeStore = writeTx.objectStore(storeName);
            writeStore.put(song);
        }
        