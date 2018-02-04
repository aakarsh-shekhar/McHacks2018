"use strict";

function onLoad() {
	window.spark = ciscospark.init({
		credentials: {
			access_token: ACCESS_TOKEN
		}
	});
	//openAMediaStream();
	window.startupTime = Date.now();
	spark.phone.on("call:incoming", callHandler);
	spark.phone.register();
}

function openAMediaStream() {
	var elem = document.getElementById("theaudio");
	window.mediaStream = elem.captureStream? elem.captureStream() : elem.mozCaptureStream();
}

function overridePlay(destination) {
	// Checking the next speech item to handle
	var speechItem = this._waitingQueue[0];
	if (!speechItem) {
		return;
	}
	// If it's not ready yet, let's wait for 100ms more
	if (!speechItem.isReadyToPlay) {
		window.setTimeout(() => {
			this._play();
		}, 100);
		return;
	}
	// If it's ready to be decoded & played
	if (!this._playing) {
		this._playing = true;
		this._tools.audioContext.decodeAudioData(speechItem.data, (buffer) => {
			var source = this._tools.audioContext.createBufferSource();
			source.buffer = buffer;
			source.connect(destination);
			source.start(0);
			source.onended = (evt) => {
				this._playing = false;
				this._waitingQueue.splice(0, 1);
				this._waitingQueueIndex.splice(0, 1);
				if (speechItem.callback) {
					speechItem.callback();
				}
				if (this._waitingQueue.length > 0) {
					this._play();
				}
				else {
					this._nbWaitingItems = 0;
				}
			};
		});
	}
}

async function callHandler(call) {
	window.myCall = call;
	console.log(call);
	if (!call.remoteMember || Date.now() - startupTime < 5000) {
		console.log("no remote member?");
		await call.hangup();
		return;
	}

	let bingClient = new BingSpeech.RecognitionClient(BING_API_KEY);
	let bingTTS = new BingSpeech.TTSClient(BING_API_KEY);

	let audioContext = bingTTS._tools.audioContext;
	let mediaStreamDestination = audioContext.createMediaStreamDestination();
	bingTTS._play = overridePlay.bind(bingTTS, mediaStreamDestination);

	var audioElemRem = document.createElement("audio");
	document.body.appendChild(audioElemRem);

	bingClient.onFinalResponseReceived = async (text) => {
		console.log(text);
		let nuanceReply = await getNuanceReplyForText(text);
		let response = nuanceReply.answers.length == 0? "Can you repeat that?" : bestAnswer(nuanceReply);
		bingTTS.synthesize(response, "en-us");
	};

	call.on("localMediaStream:change", (stream) => {
		console.log("MediaStream changed: " + call.localMediaStream);
	});
	var oldMediaStream;
	call.on("remoteMediaStream:change", () => {
		console.log("Remote media stream changed");
		console.log(call.remoteMediaStream);
		audioElemRem.srcObject = call.remoteMediaStream;
	});

	audioElemRem.addEventListener("canplay", function() {
		audioElemRem.play();
		console.log("Starting the bing client");
		bingClient._continuous = true;
		bingClient._startVoiceDetection(audioElemRem.captureStream());
	});

	call.on("disconnected", () => {
		audioElemRem.remove();
		if (bingClient._vad) bingClient._vad.dispose();
	});
	let mediaStream = mediaStreamDestination.stream;
	console.log("Answering the call; stream " + mediaStream);
	await call.answer({constraints: {video: false, audio: true},
		localMediaStream: mediaStream});
	//call.localMediaStream = mediaStream;
	console.log("Start receiving audio");
	await call.startReceivingAudio();
	console.log("Start sending audio");
	await call.startSendingAudio();
	console.log("connection should be up");
}

async function getNuanceReplyForText(text) {
	var nuanceUrl = "/proxy.php?teamKey=" + NUANCE_TEAM_KEY + "&question=" + encodeURIComponent(text);
	var response = await fetch(nuanceUrl)
	return await response.json();
}

function bestAnswer (body) {
  var best = body.answers[0].summary;
  
  for(var i=0; i< Math.min(body.answers.length, 3); i++)
  {
    var ans = body.answers[i];
    if(ans.score>50 && ans.summary.length<best.length)
    {
      best = ans.summary;
    }
  }
  
  if(best.length>1000)
    best = best.substring(0, best.indexOf(".")+1);
  
  return best;
}


window.onload = onLoad;