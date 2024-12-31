/**
 * @typedef {Object} VideoInfo
 * @property {string} thumbnailUrl - URL of the video thumbnail
 * @property {string} title - Title of the video
 * @property {string} [videoId] - YouTube video ID
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

class DeviceDetector {
    static isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    static isIOS() {
        return /iPhone|iPad|iPod/.test(navigator.userAgent);
    }
}

class YouTubeAPI {
    static async getApiKey() {
        try {
            const testResponse = await fetch(
                `${CONFIG.API_ENDPOINTS.VIDEOS}?part=snippet&id=jF-yxeyEhsM&key=${CONFIG.API_KEYS.RESTRICTED}`
            );
            const data = await testResponse.json();
            if (!data.error) return CONFIG.API_KEYS.RESTRICTED;
            
            const response = await fetch(CONFIG.API_KEYS.ENV_FILE);
            const text = await response.text();
            const match = text.match(/YOUTUBE_API_KEY=(.+)/);
            return match ? match[1].trim() : null;
        } catch (error) {
            console.error('[YouTubeAPI] Key fetch failed:', error);
            return null;
        }
    }

    static async fetchVideoInfo(videoId, apiKey) {
        const response = await fetch(
            `${CONFIG.API_ENDPOINTS.VIDEOS}?part=snippet&id=${videoId}&key=${apiKey}`
        );
        const data = await response.json();
        if (!data.items?.[0]) throw new Error('Video not found');
        return data.items[0].snippet;
    }

    static async getFirstPlaylistVideo(playlistId) {
        try {
            const apiKey = await this.getApiKey();
            if (!apiKey) throw new Error('No API key available');

            const playlistResponse = await fetch(
                `${CONFIG.API_ENDPOINTS.PLAYLIST_ITEMS}?part=snippet&maxResults=1&playlistId=${playlistId}&key=${apiKey}`
            );
            const playlistData = await playlistResponse.json();
            if (!playlistData.items?.[0]) throw new Error('Empty playlist');

            const videoId = playlistData.items[0].snippet.resourceId.videoId;
            const snippet = await this.fetchVideoInfo(videoId, apiKey);

            return {
                thumbnailUrl: snippet.thumbnails.maxres?.url || 
                             snippet.thumbnails.standard?.url ||
                             snippet.thumbnails.high.url,
                title: snippet.title,
                videoId
            };
        } catch (error) {
            console.error('[YouTubeAPI] Playlist fetch failed:', error);
            return {
                thumbnailUrl: CONFIG.DEFAULTS.FALLBACK_THUMBNAIL,
                title: CONFIG.DEFAULTS.FALLBACK_TITLE
            };
        }
    }
}

class YouTubeEmbed {
    static createIframe(videoId, type) {
        const iframe = document.createElement('iframe');
        const embedUrl = type === 'playlist' 
            ? `https://www.youtube.com/embed/videoseries?list=${videoId}`
            : `https://www.youtube.com/embed/${videoId}`;

        const params = new URLSearchParams({
            rel: '0',
            autoplay: '1',
            playsinline: '0',
            fs: '1',
            enablejsapi: '1',
            mute: DeviceDetector.isMobile() ? '0' : '1'
        });

        iframe.src = `${embedUrl}&${params}`;
        iframe.frameBorder = '0';
        iframe.allowFullscreen = true;
        iframe.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; fullscreen';

        if (DeviceDetector.isIOS()) {
            this.setupIOSFullscreen(iframe);
        } else if (!DeviceDetector.isMobile()) {
            this.setupDesktopAutoplay(iframe, embedUrl);
        }

        return iframe;
    }

    static setupIOSFullscreen(iframe) {
        Object.assign(iframe, {
            webkitPlaysinline: '0',
            playsinline: '0',
            style: 'width: 100%; height: 100%;'
        });

        const fullscreenScript = `
            const video = document.querySelector('video');
            if (video) {
                const enterFullscreen = () => {
                    video.webkitEnterFullscreen();
                    video.play();
                };
                
                if (video.readyState >= 1) enterFullscreen();
                video.addEventListener('loadedmetadata', enterFullscreen);
                video.addEventListener('canplay', enterFullscreen);
            }
        `;

        iframe.onload = () => {
            setTimeout(() => {
                try {
                    iframe.contentWindow.postMessage(
                        JSON.stringify({ event: 'command', func: fullscreenScript }), 
                        '*'
                    );
                } catch (e) {
                    console.warn('[YouTubeEmbed] Fullscreen injection failed:', e);
                }
            }, 500);
        };
    }

    static setupDesktopAutoplay(iframe, embedUrl) {
        setTimeout(() => {
            iframe.src = `${embedUrl}&rel=0&autoplay=1`;
        }, 1000);
    }

    static async createThumbnail(videoId, type) {
        const container = document.createElement('div');
        Object.assign(container.dataset, { id: videoId, type });

        const videoInfo = type === 'playlist'
            ? await YouTubeAPI.getFirstPlaylistVideo(videoId)
            : { 
                thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                title: 'Video'
              };

        container.innerHTML = this.getThumbnailHTML(videoInfo);
        container.onclick = () => this.handleThumbnailClick(container, videoId, type);
        return container;
    }

    static getThumbnailHTML(videoInfo) {
        return `
            <img src="${videoInfo.thumbnailUrl}">
            <div class="thumbnail-shadow"></div>
            <div class="video-title-overlay">
                <img src="./images/youtube-pfp.png">
                <span>${videoInfo.title}</span>
            </div>
            <div class="play"></div>
        `;
    }

    static handleThumbnailClick(container, videoId, type) {
        const iframe = this.createIframe(videoId, type);
        container.parentNode.replaceChild(iframe, container);
        this.handleFullscreen(iframe);
    }

    static handleFullscreen(element) {
        if (!DeviceDetector.isMobile()) return;

        if (DeviceDetector.isIOS()) {
            this.attemptIOSFullscreen(element);
        } else {
            element.requestFullscreen?.() || 
            element.webkitRequestFullscreen?.() || 
            element.mozRequestFullScreen?.() || 
            element.msRequestFullscreen?.();
        }
    }

    static attemptIOSFullscreen(iframe, attempts = 0) {
        try {
            const video = iframe.contentDocument?.querySelector('video');
            if (video) {
                const enterFullscreen = () => {
                    video.webkitEnterFullscreen();
                    video.play();
                };

                if (video.readyState >= 1) {
                    enterFullscreen();
                } else {
                    video.addEventListener('loadedmetadata', enterFullscreen);
                    video.addEventListener('canplay', enterFullscreen);
                }
            } else if (attempts < 10) {
                setTimeout(() => this.attemptIOSFullscreen(iframe, attempts + 1), 300);
            }
        } catch (e) {
            console.warn('[YouTubeEmbed] iOS fullscreen failed:', e);
        }
    }
}

async function initYouTubeVideos() {
    const players = document.getElementsByClassName('youtube-player');
    
    for (const player of players) {
        const { id: videoId, type = 'video' } = player.dataset;
        
        // Create iframe directly for mobile devices
        if (DeviceDetector.isMobile()) {
            const iframe = YouTubeEmbed.createIframe(videoId, type);
            if (player.firstChild) {
                player.removeChild(player.firstChild);
            }
            player.appendChild(iframe);
            YouTubeEmbed.handleFullscreen(iframe);
        } else {
            // Desktop behavior remains the same
            const element = await YouTubeEmbed.createThumbnail(videoId, type);
            if (player.firstChild) {
                player.removeChild(player.firstChild);
            }
            player.appendChild(element);
        }
    }
}

document.addEventListener('DOMContentLoaded', initYouTubeVideos);
