/*
	==========================================================
	AR.html page logic
	Split out of AR.html so markup, styles, and script each live
	in their own file. Loaded via <script src="ar-scene.js" defer>
	at the end of AR.html's <body>, so all the DOM elements below
	already exist by the time this file runs (defer also waits
	for A-Frame + MindAR to finish loading first, since those
	<script> tags appear earlier in <head>).

	CHARACTER CONFIG
	All 8 persona illustrations are compiled TOGETHER into one
	targets.mind file (MindAR's offline compiler supports
	multi-target files). Each image gets an index (0–7) in the
	order it was fed into the compiler — that index is the
	`targetIndex` used below, and it's what ties a detected
	image back to the right character + video loop.

	IMPORTANT: if you re-run the compiler with a different image
	order, these indices must be updated to match.
	==========================================================
*/
const CHARACTERS = [
	{ id: "katsu",    targetIndex: 0, name: "Katsu-Chan",        poster: "images/Katsu-Chan.png",        videoMp4: "images/Katsu-Chan.mp4",        videoWebm: "images/Katsu-Chan.webm" },
	{ id: "monstora", targetIndex: 1, name: "Monstora Sharemi",  poster: "images/Monstora_Sharemi.png",  videoMp4: "images/Monstora-Sharemi.mp4",  videoWebm: "images/Monstora-Sharemi.webm" },
	{ id: "giga",     targetIndex: 2, name: "Giga Nomu",         poster: "images/Giga_Nomu.png",         videoMp4: "images/Giga-Nomu.mp4",         videoWebm: "images/Giga-Nomu.webm" },
	{ id: "tamago",   targetIndex: 3, name: "Tamago Puffy",      poster: "images/Tamago_Puffy.png",      videoMp4: "images/Tamago-Puffy.mp4",      videoWebm: "images/Tamago-Puffy.webm" },
	{ id: "cheezu",   targetIndex: 4, name: "Cheezu Mellow",     poster: "images/Cheezu_Mellow.png",     videoMp4: "images/Cheezu-Mellow.mp4",     videoWebm: "images/Cheezu-Mellow.webm" },
	{ id: "ramy",     targetIndex: 5, name: "Ramy Noodleton",    poster: "images/Ramy_Noodleton.png",    videoMp4: "images/Ramy-Noodleton.mp4",    videoWebm: "images/Ramy-Noodleton.webm" },
	{ id: "hotsizz",  targetIndex: 6, name: "Hot Sizz",          poster: "images/Hot_Sizz.png",          videoMp4: "images/Hot-Sizz.mp4",          videoWebm: "images/Hot-Sizz.webm" },
	{ id: "teppa",    targetIndex: 7, name: "Teppa Spark",       poster: "images/Teppa_Spark.png",       videoMp4: "images/Teppa-Spark.mp4",       videoWebm: "images/Teppa-Spark.webm" }
];

// NOTE: updated to match the path used in the uploaded demo (images/targets.mind).
// Confirm this is really where your compiled targets.mind lives — change back to
// "ar-assets/targets.mind" if not.
const TARGETS_MIND_SRC = "images/targets.mind";

const startGate      = document.getElementById("start-gate");
const startButton    = document.getElementById("start-button");
const errorScreen    = document.getElementById("error-state");
const sceneContainer = document.getElementById("scene-container");
const characterBadge = document.getElementById("character-badge");
const scanHint       = document.getElementById("scan-hint");
const closeArBtn     = document.getElementById("close-ar");
const characterStrip = document.getElementById("character-strip");

// Populate the small preview strip on the start screen
characterStrip.innerHTML = CHARACTERS
	.map(c => `<img src="${c.poster}" alt="${c.name}" loading="lazy">`)
	.join("");

closeArBtn.onclick = () => {
	// Adjust this to wherever "home" is in the main quiz app
	window.location.href = "index.html";
};

startButton.onclick = () => {
	startGate.style.display = "none";
	initARScene();
};

function initARScene() {
	// Build every <a-video> asset tag up front (one per character).
	// Two <source> children per video: Safari/iOS needs the HEVC-encoded
	// mp4 to get real alpha-channel transparency; every other browser
	// falls back to the webm. crossorigin keeps the video usable as a
	// WebGL texture without tainting the canvas.
	const assetTags = CHARACTERS
		.map(c => `<video id="loop-${c.id}" preload="auto" loop muted playsinline webkit-playsinline crossorigin="anonymous">
				<source src="${c.videoMp4}" type='video/mp4; codecs="hvc1"'>
				<source src="${c.videoWebm}" type="video/webm">
			</video>`)
		.join("\n\t\t\t\t\t");

	// Build one target anchor per character, each watching its own targetIndex
	const anchorTags = CHARACTERS
		.map(c => `
		<a-entity mindar-image-target="targetIndex: ${c.targetIndex}" data-character-id="${c.id}" data-character-name="${c.name}">
			<a-video src="#loop-${c.id}" material="shader: flat; src: #loop-${c.id}" width="1" height="1" position="0 0 0" rotation="0 0 0"></a-video>
		</a-entity>`)
		.join("");

	sceneContainer.innerHTML = `
		<a-scene
			mindar-image="imageTargetSrc: ${TARGETS_MIND_SRC}; autoStart: true; uiScanning: no; uiLoading: no;"
			color-space="sRGB"
			renderer="colorManagement: true, physicallyCorrectLights, alpha: true"
			vr-mode-ui="enabled: false"
			device-orientation-permission-ui="enabled: false"
		>
			<a-assets>
				${assetTags}
			</a-assets>

			<a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

			${anchorTags}
		</a-scene>
	`;

	const sceneEl = sceneContainer.querySelector("a-scene");

	sceneEl.addEventListener("loaded", () => {
		if (sceneEl.renderer) {
			sceneEl.renderer.setClearColor(0x000000, 0);
		}
	});

	// Wire up targetFound/targetLost for every character anchor.
	// Only the anchor whose image is currently in view plays its video;
	// all others stay paused, so there's never more than one loop
	// running (and drawing CPU/battery) at a time in practice.
	CHARACTERS.forEach(c => {
		const anchorEl = sceneContainer.querySelector(`[data-character-id="${c.id}"]`);
		const videoEl = document.getElementById(`loop-${c.id}`);

		anchorEl.addEventListener("targetFound", () => {
			characterBadge.textContent = c.name;
			characterBadge.classList.remove("idle");
			scanHint.classList.add("hidden");
			videoEl.currentTime = 0;
			videoEl.play().catch(() => {
				/* Autoplay might still be blocked on some browsers even
				   after the initial user gesture — video is muted so
				   this should be rare */
			});
		});

		anchorEl.addEventListener("targetLost", () => {
			videoEl.pause();
			characterBadge.textContent = "Point at a character…";
			characterBadge.classList.add("idle");
			scanHint.classList.remove("hidden");
		});
	});

	sceneEl.addEventListener("arError", () => {
		sceneContainer.innerHTML = "";
		errorScreen.style.display = "flex";
	});
}