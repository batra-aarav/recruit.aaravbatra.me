/*
 * Light YouTube Embeds by @labnol
 * Credit: https://www.labnol.org/
 */

function labnolIframe(div) {
    var iframe = document.createElement('iframe');
    var videoId = div.dataset.id;
    var embedUrl = div.dataset.type === 'playlist' 
        ? 'https://www.youtube.com/embed/videoseries?list=' + videoId
        : 'https://www.youtube.com/embed/' + videoId;
    
    // Add mute=1 to enable autoplay on mobile
    iframe.setAttribute('src', embedUrl + '&autoplay=1&rel=0&mute=1');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allowfullscreen', '1');
    iframe.setAttribute('allow', 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture');
    
    // Unmute after a short delay to ensure autoplay works
    setTimeout(() => {
        iframe.src = embedUrl + '&autoplay=1&rel=0';
    }, 1000);
    
    div.parentNode.replaceChild(iframe, div);
}

async function getApiKey() {
    // First try the hardcoded API key that's IP restricted
    const restrictedApiKey = 'AIzaSyAP5S1cb4P3HYlc0gGcxZGcv2-mlQwXc-8';
    
    // Test if the restricted key works
    try {
        const testResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=1&playlistId=ANY_ID&key=${restrictedApiKey}`
        );
        if (testResponse.ok) {
            return restrictedApiKey;
        }
    } catch (e) {
        console.log('Restricted API key failed, trying fallback...');
    }

    // If restricted key doesn't work, try reading from TOKEN.env
    try {
        const response = await fetch('./TOKEN.env');
        const text = await response.text();
        const key = text.match(/YOUTUBE_API_KEY=(.+)/)[1];
        return key.trim();
    } catch (error) {
        console.error('Error loading API key:', error);
        return null;
    }
}

async function getFirstVideoFromPlaylist(playlistId) {
    try {
        const apiKey = await getApiKey();
        if (!apiKey) throw new Error('No API key found');
        
        // First get the playlist items to get the first video ID
        const playlistResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=1&playlistId=${playlistId}&key=${apiKey}`
        );
        const playlistData = await playlistResponse.json();
        
        if (!playlistData.items || !playlistData.items.length) {
            throw new Error('No videos in playlist');
        }

        const firstVideo = playlistData.items[0].snippet;
        const videoId = firstVideo.resourceId.videoId;

        // Get the video details for higher quality thumbnail
        const videoResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`
        );
        const videoData = await videoResponse.json();
        const videoSnippet = videoData.items[0].snippet;

        return {
            thumbnailUrl: videoSnippet.thumbnails.maxres?.url || 
                         videoSnippet.thumbnails.standard?.url ||
                         videoSnippet.thumbnails.high.url,
            title: videoSnippet.title
        };
    } catch (error) {
        console.error('Error fetching playlist:', error);
        return {
            thumbnailUrl: 'https://img.youtube.com/vi/jF-yxeyEhsM/maxresdefault.jpg',
            title: 'Playlist Unavailable'
        };
    }
}

async function initYouTubeVideos() {
    var playerElements = document.getElementsByClassName('youtube-player');
    for (var n = 0; n < playerElements.length; n++) {
        var videoId = playerElements[n].dataset.id;
        var isPlaylist = playerElements[n].dataset.type === 'playlist';
        var div = document.createElement('div');
        div.setAttribute('data-id', videoId);
        div.setAttribute('data-type', isPlaylist ? 'playlist' : 'video');
        
        var thumbNode = document.createElement('img');
        let videoTitle;
        
        if (isPlaylist) {
            const videoInfo = await getFirstVideoFromPlaylist(videoId);
            thumbNode.src = videoInfo.thumbnailUrl;
            videoTitle = videoInfo.title;
        } else {
            thumbNode.src = 'https://img.youtube.com/vi/' + videoId + '/maxresdefault.jpg';
            videoTitle = 'Video';
        }
        div.appendChild(thumbNode);
        
        // Add shadow overlay
        var shadowOverlay = document.createElement('div');
        shadowOverlay.className = 'thumbnail-shadow';
        div.appendChild(shadowOverlay);
        
        // Add title overlay
        var titleDiv = document.createElement('div');
        titleDiv.className = 'video-title-overlay';
        
        var favicon = document.createElement('img');
        favicon.src = './images/youtube-pfp.png';
        titleDiv.appendChild(favicon);
        
        var titleSpan = document.createElement('span');
        titleSpan.textContent = videoTitle;
        titleDiv.appendChild(titleSpan);
        
        div.appendChild(titleDiv);
        
        var playButton = document.createElement('div');
        playButton.setAttribute('class', 'play');
        div.appendChild(playButton);
        
        div.onclick = function() {
            labnolIframe(this);
        };
        
        if (playerElements[n].children.length) {
            playerElements[n].removeChild(playerElements[n].firstChild);
        }
        playerElements[n].appendChild(div);
    }
}

document.addEventListener('DOMContentLoaded', initYouTubeVideos);