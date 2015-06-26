// VARIABLES
getIP()
//var roomName = 'karaoke' + myIP().substring(1).replace(/\./g,'');
var defaultUsername = 'Computer';
var remotePeerArray = [];
var lastMargin = 120;
var colorCounter = 0;
var colorArray = ["#b2e3f5", "#a5def3", "#97d9f2", "#8ad5f0", "#7cd0ee", "#6fcbec", "#61c6ea"];
//var colorArray = ["#b2e3f5", "#aee2f4", "#a9e0f4", "#a5def3", "#a0ddf3", "#9cdbf2", "#97d9f2"];

// AUDIO VARIABLES
var lyricsData;
var currCue = 0;
var cueOffset = 0.0;
var cues;
var lyrics;
var parsedCues;
var parsedLyrics;
var bgVocalAudio;
var bgTrackAudio;
var songSelected;
var nowPlaying;
var trackVolume = 1.0;
var vocalVolume = 0.0;

// FLAGS
var mainViewHasLoaded = false;
var isStartingSong = true;
var peerAudioIsMuted = false;

window.onload = function() {
    // Create the loader
    var spinner = new Spinner({
       lines: 12, // The number of lines to draw
       length: 7, // The length of each line
       width: 3, // The line thickness
       radius: 10, // The radius of the inner circle
       color: '#1ca1ca', // #rbg or #rrggbb
       speed: 1, // Rounds per second
       trail: 100, // Afterglow percentage
       shadow: true // Whether to render a shadow
    }).spin(document.getElementById("loadingContainer"));
    
    // Create loading container
    var loadingContainer = document.getElementById('loadingContainer');
    var loadingText = document.createElement('div');
    loadingText.setAttribute('id','loadingText');
    loadingText.textContent = 'Looking for devices...';
    loadingContainer.appendChild(loadingText);
    
    // Get lyrics from json
    var HTTPReq = new XMLHttpRequest();
    HTTPReq.open("GET", 'http://sudeepag.github.io/karaoke/json/lyrics.json', false);
    HTTPReq.send(null);
    lyricsData = JSON.parse(HTTPReq.responseText);
    
}

// Decide whether its a local connection or a remote connection
var query = window.location.search;
if (query.substring(0, 1) == '?') {
    query = decodeURI(query.substring(1));
}

if (query) {
    console.log('remote connection');
    roomName = query;
}
else {
    console.log('local connection');
}

// Hide song container initially
var parentSongContainer = document.getElementById('parentSongContainer');
parentSongContainer.style.display = 'none';

// Create audio context
    window.AudioContext = window.AudioContext||window.webkitAudioContext;
    var context = new AudioContext();

// SKYLINK
var skylink = new Skylink();

skylink.init({
    apiKey: 'efd9fd9b-0fe3-43ff-885f-0b240325c6f0',
    defaultRoom: roomName,
    enableDataChannel: true
});
skylink.joinRoom({
    audio: {
        mute: true
    },
    video: false,
    userData: defaultUsername
});
skylink.on('mediaAccessSuccess', function(stream) {
    createBaseContainer();
});
skylink.on('peerJoined', function(peerId, peerInfo, isSelf) {

    if (isSelf) return;

    // Add peer's ID to the end of remote peer array
    remotePeerArray[remotePeerArray.length] = peerId;
    console.log('peer joined: '+peerId + ' with name: ' + peerInfo.userData);
    
    addDevice(peerId);
    
    // Show song container after the first peer has joined
    if (remotePeerArray.length == 1) {
        changeLoaderToSongContainer();
    }
    
    createUserContainer(peerId, peerInfo);

    if (mainViewHasLoaded) {
        fadeIn(document.getElementById('container'+peerId));
        window.scrollTo(0,document.body.scrollHeight);
    }
});

skylink.on('peerLeft', function(peerId, peerInfo, isSelf) {

    // Send endTransmission message to all peers if host is leaving
    if (isSelf) {
        skylink.sendMessage('endTransmission');
    }
    
    // Remove peer's ID from the array
    for (i = 0; i < remotePeerArray.length; i++) {
        if (remotePeerArray[i] == peerId) {
            remotePeerArray.splice(i, 1);
        }
    }
    
    console.log('peer left: '+peerId);
    removeDevice(peerId);
    removeUserContainer(peerId);
    
    if (remotePeerArray.length == 0) {
        removeBaseContainer();
        changeSongContainerToLoader();
    }

});
skylink.on('incomingStream', function(peerId, stream, isSelf, peerInfo) {

    if (isSelf) return;
    
    var peerAudio = document.getElementById('audio'+peerId);
    
    attachMediaStream(peerAudio, stream);

});
skylink.on('incomingMessage', function (message, peerId, peerInfo, isSelf) {

    if (isSelf) return;
    
    if (message.content == 'startTransmission') {
        //document.getElementById("indicator" + peerId).src = "activeIndicator.png";
    }
    else if (message.content == 'endTransmission') {
        resetAmplitudeBar(peerId);
        //document.getElementById("indicator" + peerId).src = "inactiveIndicator.png";
    }
    else {
        var amplitude = parseFloat(message.content);
        updateAmplitudeBar(amplitude, peerId);
    }

});

// HELPER FUNCTIONS
function addListener(element, eventName, handler) {
    if (element.addEventListener) {
        element.addEventListener(eventName, handler, false);
    }
    else if (element.attachEvent) {
        element.attachEvent('on' + eventName, handler);
    }
    else {
        element['on' + eventName] = handler;
    }
}

function removeListener(element, eventName, handler) {
  if (element.addEventListener) {
    element.removeEventListener(eventName, handler, false);
  }
  else if (element.detachEvent) {
    element.detachEvent('on' + eventName, handler);
  }
  else {
    element['on' + eventName] = null;
  }
}

function getIP() {
    if (window.XMLHttpRequest) xmlhttp = new XMLHttpRequest();
    else xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");

    xmlhttp.open("GET","http://ipinfo.io",false);
    xmlhttp.send();

    hostipInfo = xmlhttp.responseText.split("\n");

    console.log(hostipInfo);
}

function fadeOut(el){
    el.style.opacity = 1;

    (function fade() {
        if ((el.style.opacity -= .1) < 0) {
            el.style.display = "none";
        } else {
            requestAnimationFrame(fade);
        }
    })();
}

function fadeIn(el, display){
    el.style.opacity = 0;
    el.style.display = display || "block";

    (function fade() {
        var val = parseFloat(el.style.opacity);
        if (!((val += .1) > 1)) {
            el.style.opacity = val;
            requestAnimationFrame(fade);
        }
    })();
}

function addDevice(peerId) {
    var device = document.createElement('img');
    device.setAttribute('src', 'https://cloud.githubusercontent.com/assets/11940172/7155655/f951a7b0-e392-11e4-991e-5bcb5ddc0495.png');
    device.setAttribute('class', 'devicePhone');
    device.setAttribute('id', 'device' + peerId);
    device.style.marginLeft = 20 + lastMargin + 'px';
    lastMargin += 60;
    var deviceContainer = document.getElementById('deviceContainer');
    deviceContainer.appendChild(device);
    fadeIn(device, 'block');
    deviceContainer.style.width = deviceContainer.offsetWidth + 60;
}

function removeDevice(peerId) {
    var deviceContainer = document.getElementById('deviceContainer');
    deviceContainer.removeChild(document.getElementById('device' + peerId));
    deviceContainer.style.width = deviceContainer.offsetWidth - 60;
    
}

// ANIMATION METHODS

var selectedTableData;
function selectTableData(tableID) {
    if (selectedTableData) {
        unselectTableData(selectedTableData);
    }
    document.getElementById(tableID).setAttribute('class', 'selectedTd');
    selectedTableData = tableID;
}

function unselectTableData(tableID) {
    document.getElementById(tableID).setAttribute('class', '');
}

function changeLoaderToSongContainer() {
    var loadingContainer = document.getElementById('loadingContainer');
    fadeOut(loadingContainer);
    fadeIn(parentSongContainer, 'block');
    addListener(document.getElementById('startButton'), 'click', startButtonClicked);
}

function changeSongContainerToLoader() {
    fadeOut(parentSongContainer);
    removeListener(document.getElementById('startButton'), 'click', startButtonClicked);
    var loadingContainer = document.getElementById('loadingContainer');
    fadeIn(loadingContainer, 'block');
}

function changeBaseContainerToSongContainer() {
    isStartingSong = true;
    bgTrackAudio.removeEventListener("timeupdate", timeUpdate, true);
    currCue = 0;
    bgTrackAudio = null;
    bgVocalAudio = null;
    removeBaseContainer();
    removeAllUserContainers();
document.getElementById('baseContainer').removeChild(document.getElementById('lyricsContainer'));
    fadeIn(parentSongContainer, 'block');
}

function changeViewsForReplay() {
    
    isStartingSong = true;
    bgTrackAudio.removeEventListener("timeupdate", timeUpdate, true);
    currCue = 0;
    bgTrackAudio = null;
    bgVocalAudio = null;
    createBackgroundAudio(songSelected);
    document.getElementById('baseContainer').removeChild(document.getElementById('lyricsContainer'));
    createLyricsContainer();
    createEndSongView();
    document.getElementById('bottomLine').textContent = nowPlaying;
    changeEndSongViewToLyrics();
    
    
}

// BUTTON METHODS

function startButtonClicked() {
    if (selectedTableData) {
        
        createLyricsContainer();
        createEndSongView();
        
        // Set selected song and create audio
        songSelected = songTitleForSelectedTableData(selectedTableData);
        createBackgroundAudio(songSelected);
        document.getElementById('bottomLine').textContent = nowPlaying;
        
        fadeOut(parentSongContainer);
        changeEndSongViewToLyrics();
        fadeIn(document.getElementById('baseContainer'), 'block');
        mainViewHasLoaded = true;
        displayExistingContainers();
    }
    else {
        console.log('song not chosen!');
    }
}

function playButtonClicked() {

    if (isStartingSong) {
        // Send song data to devices
        var theMessage = 'now' + nowPlaying + '+' + 'lyr' + parsedLyrics + '+' + 'cue' + parsedCues;
        skylink.sendMessage(theMessage);
        
        document.getElementById('middleLine').textContent = document.getElementById('bottomLine').textContent;
        document.getElementById('bottomLine').textContent = ' ';
        
        isStartingSong = false;
    }
    else {
        skylink.sendMessage('resume');
    }
    
    bgTrackAudio.play();
    bgVocalAudio.play();
    
}

function pauseButtonClicked() {
    bgTrackAudio.pause();
    bgVocalAudio.pause();
    skylink.sendMessage('pause');
}

function backButtonClicked() {
    skylink.sendMessage('endSong');
    changeBaseContainerToSongContainer();
}

function replayButtonClicked() {
    
    skylink.sendMessage('endSong');
    changeViewsForReplay();
    
}

function muteButtonClicked(peerId) {
    
    var muteButton = document.getElementById('muteButton' + peerId);
    
    if (peerAudioIsMuted) {
        muteButton.setAttribute('class', 'muteButtonUnfilled');
        changePeerVolume('100', peerId);
        updatePeerVolumeSlider('100', peerId);
        peerAudioIsMuted = false;
    }
    else {
        muteButton.setAttribute('class', 'muteButtonFilled');
        changePeerVolume('0', peerId);
        updatePeerVolumeSlider('0', peerId);
        peerAudioIsMuted = true;
    }
    
}

function thumbsUpButtonClicked(peerId) {
    console.log('sending confetti to: ' + peerId);
    skylink.sendP2PMessage('confetti', peerId);
}

// CONTAINER METHODS

function createBaseContainer() {
    
    // Base container is created hidden
    
    // Create main container
    var baseContainer = document.createElement('div');
    baseContainer.style.display = "none";
    baseContainer.setAttribute('class', 'container');
    baseContainer.setAttribute('id', 'baseContainer');
    document.body.appendChild(baseContainer);
    
    // Create header for container
    var baseContainerHeader = document.createElement('div');
    baseContainerHeader.setAttribute('class', 'containerHeader');
    baseContainerHeader.textContent = 'COMPUTER';
    baseContainer.appendChild(baseContainerHeader);
    
    // Create controller container
    var controllerContainer = document.createElement('div');
    controllerContainer.setAttribute('class', 'controllerContainer');
    baseContainer.appendChild(controllerContainer);
    
    // Create labels for sliders
    var trackLabel = document.createElement('div');
    trackLabel.textContent = 'TRACK';
    trackLabel.setAttribute('class', 'trackLabel');
    controllerContainer.appendChild(trackLabel);
    
    var vocalLabel = document.createElement('div');
    vocalLabel.textContent = 'VOCALS';
    vocalLabel.setAttribute('class', 'vocalLabel');
    controllerContainer.appendChild(vocalLabel);
    
    // Create sliders
    var trackSlider = document.createElement('input');
    trackSlider.addEventListener('change', function() {
        changeTrackVolume(trackSlider.value);
    });
    trackSlider.style.float = "left";
    trackSlider.setAttribute("type", "range");
    trackSlider.setAttribute("value", "100");
    trackSlider.setAttribute("step", "1");
    trackSlider.setAttribute("min", "0");
    trackSlider.setAttribute("max", "100");
    controllerContainer.appendChild(trackSlider);
    
    var vocalSlider = document.createElement('input');
    vocalSlider.addEventListener('change', function() {
        changeVocalVolume(vocalSlider.value);
    });
    vocalSlider.style.float = "right";
    vocalSlider.setAttribute("type", "range");
    vocalSlider.setAttribute("value", "0");
    vocalSlider.setAttribute("step", "1");
    vocalSlider.setAttribute("min", "0");
    vocalSlider.setAttribute("max", "100");
    controllerContainer.appendChild(vocalSlider);
    
    // Create container for buttons
    var buttonsContainer = document.createElement('div');
    buttonsContainer.setAttribute('class', 'buttonsContainer');
    controllerContainer.appendChild(buttonsContainer);
    
    // Create buttons
    var playButton = document.createElement('div');
    playButton.setAttribute('class', 'playButton');
    buttonsContainer.appendChild(playButton);
    addListener(playButton, 'click', playButtonClicked);
    
    var pauseButton = document.createElement('div');
    pauseButton.setAttribute('class', 'pauseButton');
    buttonsContainer.appendChild(pauseButton);
    addListener(pauseButton, 'click', pauseButtonClicked);
    
}

function createLyricsContainer() {
    // Create container for lyrics
    var lyricsContainer = document.createElement('div');
    lyricsContainer.setAttribute('id', 'lyricsContainer');
    document.getElementById('baseContainer').appendChild(lyricsContainer);
    
    // Create lyrics lines
    var topLine = document.createElement('p');
    topLine.setAttribute("id", "topLine");
    topLine.textContent = 'KARAOKEmic v1.0';
    lyricsContainer.appendChild(topLine);

    var middleLine = document.createElement('p');
    middleLine.setAttribute("id", "middleLine");
    middleLine.textContent = 'Click play to start the song.';
    lyricsContainer.appendChild(middleLine);

    var bottomLine = document.createElement('p');
    bottomLine.setAttribute("id", "bottomLine");
    bottomLine.textContent = '?';
    lyricsContainer.appendChild(bottomLine);
}

function createUserContainer(peerId, peerInfo) {
    
    // User container is created hidden
    
    colorCounter++;
    
    var userContainer = document.createElement('div');
    userContainer.setAttribute('class', 'container');
    userContainer.setAttribute('id', 'container' + peerId);
    userContainer.style.backgroundColor = colorArray[colorCounter];
    userContainer.style.display = "none";
    document.body.appendChild(userContainer);
    
    // Create audio tag
    var audioTag = document.createElement('audio');
    audioTag.setAttribute("autoplay", "true");
    audioTag.setAttribute("id", "audio" + peerId);
    userContainer.appendChild(audioTag);
    
    // Create container header
    var userContainerHeader = document.createElement('div');
    userContainerHeader.setAttribute('class', 'containerHeader');
    userContainerHeader.textContent = peerInfo.userData;
    userContainer.appendChild(userContainerHeader);
    
    // Create controller container
    var controllerContainer = document.createElement('div');
    controllerContainer.setAttribute('class', 'controllerContainer');
    userContainer.appendChild(controllerContainer);
    
    // Create thumbs up button
    var thumbsUpButton = document.createElement('div');
    thumbsUpButton.setAttribute('class', 'thumbsUpButton');
    controllerContainer.appendChild(thumbsUpButton);
    addListener(thumbsUpButton, 'click', function() {
        thumbsUpButtonClicked(peerId);
    });
    
    // Create volume label
    var volumeLabel = document.createElement('div');
    volumeLabel.textContent = 'VOLUME';
    volumeLabel.setAttribute('class', 'volumeLabel');
    controllerContainer.appendChild(volumeLabel);
    
    // Create volume slider
    var volumeSlider = document.createElement('input');
    volumeSlider.setAttribute('id', 'volume' + peerId);
    volumeSlider.addEventListener('change', function() {
        changePeerVolume(volumeSlider.value, peerId);
    });
    volumeSlider.setAttribute("type", "range");
    volumeSlider.setAttribute("value", "100");
    volumeSlider.setAttribute("step", "1");
    volumeSlider.setAttribute("min", "0");
    volumeSlider.setAttribute("max", "100");
    controllerContainer.appendChild(volumeSlider);
    
    // Create mute button
    var muteButton = document.createElement('div');
    muteButton.setAttribute('id', 'muteButton' + peerId);
    muteButton.setAttribute('class', 'muteButtonUnfilled');
    controllerContainer.appendChild(muteButton);
    addListener(muteButton, 'click', function() {
        muteButtonClicked(peerId);
    });
    
    // Create amplitude container
    var amplitudeContainer = document.createElement('div');
    amplitudeContainer.setAttribute("class", "amplitudeContainer");
    userContainer.appendChild(amplitudeContainer);
    
    // Create amplitude bar
    var amplitudeBar = document.createElement('div');
    amplitudeBar.setAttribute("class", "amplitudeBar");
    amplitudeBar.setAttribute("id", "amp" + peerId);
    amplitudeContainer.appendChild(amplitudeBar);
    
}

function displayExistingContainers() {
    for (var i = 0; i < remotePeerArray.length; i++) {
        var userContainer = document.getElementById('container' + remotePeerArray[i]);
        fadeIn(userContainer, 'block');
    }
}

function createExistingContainers() {

    for (var i = 0; i < remotePeerArray.length; i++) {
        createUserContainer(remotePeerArray[i], skylink.getPeerInfo());
    }
    
}

function removeBaseContainer() {
    var baseContainer = document.getElementById('baseContainer');
    fadeOut(baseContainer);
}

function removeUserContainer (peerId) {
    var userContainer = document.getElementById('container' + peerId);
    fadeOut(userContainer);
}

function removeAllUserContainers() {
    for (var i = 0; i < remotePeerArray.length; i++) {
        removeUserContainer(remotePeerArray[i]);
    }
}

function createEndSongView() {
    
    // Initially hidden
    
    var endSongContainer = document.createElement('div');
    endSongContainer.setAttribute('id', 'endSongContainer');
    endSongContainer.style.display = 'none';
    
    var backContainer = document.createElement('div');
    backContainer.setAttribute('id', 'backContainer');
    endSongContainer.appendChild(backContainer);
    
    var backButton = document.createElement('div');
    backButton.setAttribute('class', 'backButton');
    backContainer.appendChild(backButton);
    addListener(backButton, 'click', backButtonClicked);
    
    var backLabel = document.createElement('div');
    backLabel.setAttribute('class', 'endSongButtonLabel');
    backLabel.textContent = 'SELECT SONG';
    backContainer.appendChild(backLabel);
    
    var replayContainer = document.createElement('div');
    replayContainer.setAttribute('id', 'replayContainer');
    endSongContainer.appendChild(replayContainer);
    
    var replayButton = document.createElement('div');
    replayButton.setAttribute('class', 'replayButton');
    replayContainer.appendChild(replayButton);
    addListener(replayButton, 'click', replayButtonClicked);
    
    var replayLabel = document.createElement('div');
    replayLabel.setAttribute('class', 'endSongButtonLabel');
    replayLabel.textContent = 'REPLAY';
    replayContainer.appendChild(replayLabel);
    
    document.getElementById('lyricsContainer').appendChild(endSongContainer);
   
    
}

function displayEndSongView() {
    fadeOut(document.getElementById('topLine'));
    fadeOut(document.getElementById('middleLine'));
    fadeOut(document.getElementById('bottomLine'));
    fadeIn(document.getElementById('endSongContainer'), 'block');
}

function changeEndSongViewToLyrics() {
    fadeOut(document.getElementById('endSongContainer'));
    fadeIn(document.getElementById('topLine'), 'block');
    fadeIn(document.getElementById('middleLine'), 'block');
    fadeIn(document.getElementById('bottomLine'), 'block');
}

// AMPLITUDE BAR METHODS

function updateAmplitudeBar(amplitude, peerId) {
    var barWidth = amplitude * 635.0;
    document.getElementById("amp" + peerId).style.width = barWidth;
}

function resetAmplitudeBar(peerId) {
    document.getElementById("amp" + peerId).style.width = 0;
}

// AUDIO METHODS 

function timeUpdate() {
    if (bgTrackAudio.currentTime > (cues[currCue] - cueOffset)) {
        document.getElementById('topLine').textContent = document.getElementById('middleLine').textContent;
        document.getElementById('middleLine').textContent = lyrics[currCue];
        if (currCue+1 <= lyrics.length) {
            document.getElementById('bottomLine').textContent = lyrics[currCue+1];
            currCue++;
        }
        if (currCue == lyrics.length) {
            displayEndSongView();
        }
    }
}

function songTitleForSelectedTableData(tableData) {
    if (tableData == 'td0') {
        return 'This Love';
    }
    else if (tableData == 'td1') {
        return 'Blank Space';
    }
    else if (tableData == 'td2') {
        return 'Discipline';
    }
    else if (tableData == 'td3') {
        return null;
    }
}

function changeTrackVolume(string) {
    var value = parseFloat(string) / 100.0;
    trackVolume = value;
    bgTrackAudio.volume = trackVolume;
}

function changeVocalVolume(string) {
    var value = parseFloat(string) / 100.0;
    vocalVolume = value;
    bgVocalAudio.volume = vocalVolume;
}

function changePeerVolume(value, peerId) {
    var newValue = parseFloat(value) / 100.0;
    var peerAudio = document.getElementById("audio" + peerId);
    peerAudio.volume = newValue;
}

function updatePeerVolumeSlider(value, peerId) {
    var peerVolumeSlider = document.getElementById('volume' + peerId);
    peerVolumeSlider.value = parseFloat(value);
}

function createBackgroundAudio(songSelected) {
    console.log('song selected: '+ songSelected);
    // Create vocal audio
    bgVocalAudio = new Audio();
    var vocalSourceNode = context.createMediaElementSource(bgVocalAudio);
    bgVocalAudio.volume = vocalVolume;

    // Create track audio
    bgTrackAudio = new Audio();
    var trackSourceNode = context.createMediaElementSource(bgTrackAudio);
    
    if (songSelected == 'This Love') {
        bgVocalAudio.src = "http://sudeep.co/misc/ThisLove_vocals.mp3";
        bgTrackAudio.src = "http://sudeep.co/misc/ThisLove_novocals.mp3";
        nowPlaying = 'This Love - Maroon 5';
        cues = lyricsData.songs[0].cues;
        lyrics = lyricsData.songs[0].lyrics;
        cueOffset = 0.0;
    }
    else if (songSelected == 'Blank Space') {
        bgVocalAudio.src = "http://sudeep.co/misc/blankspace_withVocals.mp3";
        bgTrackAudio.src = "http://sudeep.co/misc/blankSpace.mp3";
        nowPlaying = 'Blank Space - Taylor Swift';
        cues = lyricsData.songs[1].cues;
        lyrics = lyricsData.songs[1].lyrics;
        cueOffset = 0.0;
    }
    else if (songSelected == 'Discipline') {
        bgVocalAudio.src = "http://randallagordon.com/jaraoke/audio/discipline_mixdown-wvocal.mp3";
        bgTrackAudio.src = "http://randallagordon.com/jaraoke/audio/discipline_mixdown-nvocal.mp3";
        nowPlaying = 'Discipline - Nine Inch Nails';
        cues = lyricsData.songs[2].cues;
        lyrics = lyricsData.songs[2].lyrics;
        cueOffset = 4.9;
    }
    
    // Create cue and lyrics string variables
    parsedCues = cues.join('!');
    parsedLyrics = lyrics.join('!');
    
     // Connect nodes
    vocalSourceNode.connect(context.destination);
    trackSourceNode.connect(context.destination);

    // Force audio buffering
    bgVocalAudio.play(); bgVocalAudio.pause();
    bgTrackAudio.play(); bgTrackAudio.pause();
    
    // Set up time update
    bgTrackAudio.addEventListener("timeupdate", timeUpdate, true);
    
}
