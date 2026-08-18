// Background video controller.
// Uses the YouTube IFrame Player API so we can detect when playback is blocked
// (bot checks, embed restrictions, autoplay policies) and fall back to the
// still space image underneath.

(function () {
  var layer = document.querySelector('.landing-video')
  if (!layer) return

  var VIDEO_ID = layer.dataset.videoId
  var START = 7 // 0:07
  var END = 88 // 1:28
  var host = layer.querySelector('.landing-video-frame')
  var player = null
  var started = false
  var loopTimer = null

  // Loop only the 0:07 - 1:28 segment.
  function watchSegment() {
    if (loopTimer) return
    loopTimer = setInterval(function () {
      if (!player || typeof player.getCurrentTime !== 'function') return
      var t = player.getCurrentTime()
      if (t >= END || t < START - 1) player.seekTo(START, true)
    }, 250)
  }

  function fail() {
    if (started) return
    layer.classList.add('is-unavailable')
  }

  function succeed() {
    if (started) return
    started = true
    // YouTube paints its title bar / branding overlay for the first moment of
    // playback, so hold the still image until that overlay has faded out.
    setTimeout(function () {
      layer.classList.add('is-playing')
    }, 1600)
  }

  function createPlayer() {
    player = new window.YT.Player(host, {
      videoId: VIDEO_ID,
      host: 'https://www.youtube-nocookie.com',
      playerVars: {
        autoplay: 1,
        mute: 1,
        loop: 1,
        playlist: VIDEO_ID,
        start: START,
        end: END,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
        iv_load_policy: 3,
        cc_load_policy: 0,
        cc_lang_pref: 'none',
      },
      events: {
        onReady: function (event) {
          event.target.mute()
          // Make sure no YouTube subtitle track renders over the background.
          // (Text burned into the video frames themselves cannot be removed.)
          try {
            event.target.setOption('captions', 'track', {})
            event.target.unloadModule('captions')
            event.target.unloadModule('cc')
          } catch (err) {}
          event.target.seekTo(START, true)
          event.target.playVideo()
        },
        onStateChange: function (event) {
          if (event.data === window.YT.PlayerState.PLAYING) {
            try {
              event.target.unloadModule('captions')
              event.target.unloadModule('cc')
            } catch (err) {}
            succeed()
            watchSegment()
          }
          // Reaching `end` stops the player, so restart the segment.
          if (event.data === window.YT.PlayerState.ENDED) {
            event.target.seekTo(START, true)
            event.target.playVideo()
          }
        },
        onError: fail,
      },
    })
  }

  // If the player never reaches PLAYING, treat the video as unavailable.
  setTimeout(fail, 7000)

  window.onYouTubeIframeAPIReady = createPlayer

  var api = document.createElement('script')
  api.src = 'https://www.youtube.com/iframe_api'
  api.onerror = fail
  document.head.appendChild(api)
})()
