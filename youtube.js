/** @typedef {Object} VideoInfo
 * @property {string} thumbnailUrl
 * @property {string} title
 */

const CONFIG = {
    API_KEYS: {
        RESTRICTED: 'AIzaSyAP5S1cb4P3HYlc0gGcxZGcv2-mlQwXc-8',
        ENV_FILE: './TOKEN.env'
    },
    API_ENDPOINTS: {
        PLAYLIST_ITEMS: 'https://www.googleapis.com/youtube/v3/playlistItems',
        VIDEOS: 'https://www.googleapis.com/youtube/v3/videos'
    },
    DEFAULTS: {
        FALLBACK_THUMBNAIL: 'https://img.youtube.com/vi/jF-yxeyEhsM/maxresdefault.jpg',
        FALLBACK_TITLE: 'Aarav Batra | Long Snapping Highlight Tape | Class of 2025 | East Brunswick High School'
    }
};

class YouTubeService {
    static async getApiKey() {
        try {
            // Try restricted key first
            const testResponse = await fetch(
                `${CONFIG.API_ENDPOINTS.VIDEOS}?part=snippet&id=jF-yxeyEhsM&key=${CONFIG.API_KEYS.RESTRICTED}`
            );
            const data = await testResponse.json();
            if (!data.error) return CONFIG.API_KEYS.RESTRICTED;
            
            // Fallback to env file
            const response = await fetch(CONFIG.API_KEYS.ENV_FILE);
            const text = await response.text();
            return text.match(/YOUTUBE_API_KEY=(.+)/)[1].trim();
        } catch (error) {
            console.error('API key fetch failed:', error);
            return null;
        }
    }

    static async getFirstVideoFromPlaylist(playlistId) {
        try {
            const apiKey = await this.getApiKey();
            if (!apiKey) throw new Error('No API key available');

            // Get first video from playlist
            const playlistResponse = await fetch(
                `${CONFIG.API_ENDPOINTS.PLAYLIST_ITEMS}?part=snippet&maxResults=1&playlistId=${playlistId}&key=${apiKey}`
            );
            const playlistData = await playlistResponse.json();
            
            if (!playlistData.items?.[0]) throw new Error('No videos in playlist');

            const videoId = playlistData.items[0].snippet.resourceId.videoId;

            // Get high quality thumbnail
            const videoResponse = await fetch(
                `${CONFIG.API_ENDPOINTS.VIDEOS}?part=snippet&id=${videoId}&key=${apiKey}`
            );
            const { items: [{ snippet }] } = await videoResponse.json();

            return {
                thumbnailUrl: snippet.thumbnails.maxres?.url || 
                             snippet.thumbnails.standard?.url ||
                             snippet.thumbnails.high.url,
                title: snippet.title
            };
        } catch (error) {
            console.error('Playlist fetch failed:', error);
            return {
                thumbnailUrl: CONFIG.DEFAULTS.FALLBACK_THUMBNAIL,
                title: CONFIG.DEFAULTS.FALLBACK_TITLE
            };
        }
    }
}

class YouTubePlayer {
    static createIframe(videoId, type) {
        const iframe = document.createElement('iframe');
        const embedUrl = type === 'playlist' 
            ? `https://www.youtube.com/embed/videoseries?list=${videoId}`
            : `https://www.youtube.com/embed/${videoId}`;

        iframe.setAttribute('src', `${embedUrl}&autoplay=1&rel=0&mute=1`);
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allowfullscreen', '1');
        iframe.setAttribute('allow', 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture');

        // Unmute after delay for autoplay
        setTimeout(() => {
            iframe.src = `${embedUrl}&autoplay=1&rel=0`;
        }, 1000);

        return iframe;
    }

    static async createThumbnail(videoId, type) {
        const div = document.createElement('div');
        div.dataset.id = videoId;
        div.dataset.type = type;

        const videoInfo = type === 'playlist'
            ? await YouTubeService.getFirstVideoFromPlaylist(videoId)
            : { 
                thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                title: 'Video'
              };

        div.innerHTML = `
            <img src="${videoInfo.thumbnailUrl}">
            <div class="thumbnail-shadow"></div>
            <div class="video-title-overlay">
                <img src="./images/youtube-pfp.png">
                <span>${videoInfo.title}</span>
            </div>
            <div class="play"></div>
        `;

        div.onclick = () => {
            const iframe = this.createIframe(videoId, type);
            div.parentNode.replaceChild(iframe, div);
            
            // Check if mobile device
            if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                // Request fullscreen after a short delay to allow iframe to load
                setTimeout(() => {
                    if (iframe.requestFullscreen) {
                        iframe.requestFullscreen();
                    } else if (iframe.webkitRequestFullscreen) {
                        iframe.webkitRequestFullscreen();
                    } else if (iframe.mozRequestFullScreen) {
                        iframe.mozRequestFullScreen();
                    } else if (iframe.msRequestFullscreen) {
                        iframe.msRequestFullscreen();
                    }
                }, 1000);
            }
        };

        return div;
    }
}

async function initYouTubeVideos() {
    const players = document.getElementsByClassName('youtube-player');
    
    for (const player of players) {
        const videoId = player.dataset.id;
        const type = player.dataset.type || 'video';
        
        const thumbnail = await YouTubePlayer.createThumbnail(videoId, type);
        
        if (player.children.length) {
            player.removeChild(player.firstChild);
        }
        player.appendChild(thumbnail);
    }
}

document.addEventListener('DOMContentLoaded', initYouTubeVideos);
