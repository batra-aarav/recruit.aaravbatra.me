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
    static isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    static isIOS() {
        return /iPhone|iPad|iPod/.test(navigator.userAgent);
    }

    static createIframe(videoId, type) {
        const iframe = document.createElement('iframe');
        const embedUrl = type === 'playlist' 
            ? `https://www.youtube.com/embed/videoseries?list=${videoId}`
            : `https://www.youtube.com/embed/${videoId}`;

        const params = 'rel=0&autoplay=1&playsinline=0&fs=1' + (this.isMobile() ? '' : '&mute=1');
        iframe.setAttribute('src', `${embedUrl}&${params}`);
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allowfullscreen', '1');
        iframe.setAttribute('allow', 'accelerometer; autoplay; encrypted-media; gyroscope; fullscreen');
        
        if (this.isIOS()) {
            iframe.setAttribute('webkit-playsinline', '0');
            iframe.setAttribute('playsinline', '0');
            iframe.setAttribute('allow-pip', 'false');
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            
            // Inject script to force fullscreen
            const forceFullscreen = `
                var video = document.querySelector('video');
                if (video) {
                    video.webkitEnterFullscreen();
                    video.addEventListener('play', function() {
                        video.webkitEnterFullscreen();
                    });
                }
            `;
            
            iframe.onload = () => {
                try {
                    iframe.contentWindow.postMessage(`{"event":"command","func":"${forceFullscreen}","args":""}`, '*');
                } catch (e) {
                    console.warn('Could not inject fullscreen script:', e);
                }
            };
        }

        if (!this.isMobile()) {
            // Unmute after delay for desktop
            setTimeout(() => {
                iframe.src = `${embedUrl}&rel=0&autoplay=1`;
            }, 1000);
        }

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

            if (this.isMobile()) {
                // Handle fullscreen for mobile devices
                setTimeout(() => {
                    if (this.isIOS()) {
                        // Force video player fullscreen
                        const tryFullscreen = () => {
                            try {
                                const video = iframe.contentDocument?.querySelector('video');
                                if (video) {
                                    video.webkitEnterFullscreen();
                                    video.play();
                                }
                            } catch (e) {
                                console.warn('Could not force fullscreen:', e);
                            }
                        };

                        // Try multiple times as the video might not be immediately available
                        tryFullscreen();
                        setTimeout(tryFullscreen, 500);
                        setTimeout(tryFullscreen, 1000);
                    } else {
                        const requestFullscreen = iframe.requestFullscreen?.bind(iframe) ||
                                               iframe.webkitRequestFullscreen?.bind(iframe) ||
                                               iframe.mozRequestFullScreen?.bind(iframe) ||
                                               iframe.msRequestFullscreen?.bind(iframe);
                        if (requestFullscreen) requestFullscreen();
                    }
                }, 100);
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
        
        const element = await YouTubePlayer.createThumbnail(videoId, type);
        
        if (player.children.length) {
            player.removeChild(player.firstChild);
        }
        player.appendChild(element);

        // Add fullscreen handling for mobile
        if (YouTubePlayer.isMobile() && element.tagName === 'IFRAME') {
            element.addEventListener('click', () => {
                element.requestFullscreen?.() || 
                element.webkitRequestFullscreen?.() || 
                element.mozRequestFullScreen?.() || 
                element.msRequestFullscreen?.();
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', initYouTubeVideos);
