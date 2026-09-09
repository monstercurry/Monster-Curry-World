/*
==========================================================
MONSTER CURRY AR SCENE
==========================================================

All 8 standees are compiled together inside:

    images/targets.mind

IMPORTANT:
The targetIndex must match the order used when compiling
the images inside the MindAR compiler.

TARGET ORDER

0 = Katsu-Chan
1 = Monstora Sharemi
2 = Giga Nomu
3 = Tamago Puffy
4 = Cheezu Mellow
5 = Ramy Noodleton
6 = Hot Sizz
7 = Teppa Spark

==========================================================
*/


// ==========================================================
// CHARACTER CONFIGURATION
// ==========================================================

const CHARACTERS = [

    {
        id: "katsu",
        targetIndex: 0,
        name: "Katsu-Chan",
        poster: "images/Katsu-Chan.png",
        videoMp4: "images/Katsu-Chan.mp4",
        videoWebm: "images/Katsu-Chan.webm",
        videoIOSKeyed: "images/Katsu-Chan-Safari.mp4",
        keyColor: "#00FFFF",
        position: null
    },

    {
        id: "monstora",
        targetIndex: 1,
        name: "Monstora Sharemi",
        poster: "images/Monstora_Sharemi.png",
        videoMp4: "images/Monstora-Sharemi.mp4",
        videoWebm: "images/Monstora-Sharemi.webm",
        videoIOSKeyed: "images/Monstora-Sharemi-Safari.mp4",
        keyColor: "#8000FF",
        position: null
    },

    {
        id: "giga",
        targetIndex: 2,
        name: "Giga Nomu",
        poster: "images/Giga_Nomu.png",
        videoMp4: "images/Giga-Nomu.mp4",
        videoWebm: "images/Giga-Nomu.webm",
        videoIOSKeyed: "images/Giga-Nomu-Safari.mp4",
        keyColor: "#00FFFF",
        position: null
    },

    {
        id: "tamago",
        targetIndex: 3,
        name: "Tamago Puffy",
        poster: "images/Tamago_Puffy.png",
        videoMp4: "images/Tamago-Puffy.mp4",
        videoWebm: "images/Tamago-Puffy.webm",
        videoIOSKeyed: "images/Tamago-Puffy-Safari.mp4",
        keyColor: "#00FFFF",
        position: null
    },

    {
        id: "cheezu",
        targetIndex: 4,
        name: "Cheezu Mellow",
        poster: "images/Cheezu_Mellow.png",
        videoMp4: "images/Cheezu-Mellow.mp4",
        videoWebm: "images/Cheezu-Mellow.webm",
        videoIOSKeyed: "images/Cheezu-Mellow-Safari.mp4",
        keyColor: "#0000FF",
        position: null
    },

    {
        id: "ramy",
        targetIndex: 5,
        name: "Ramy Noodleton",
        poster: "images/Ramy_Noodleton.png",
        videoMp4: "images/Ramy-Noodleton.mp4",
        videoWebm: "images/Ramy-Noodleton.webm",
        videoIOSKeyed: "images/Ramy-Noodleton-Safari.mp4",
        keyColor: "#00FFFF",
        position: null
    },

    {
        id: "hotsizz",
        targetIndex: 6,
        name: "Hot Sizz",
        poster: "images/Hot_Sizz.png",
        videoMp4: "images/Hot-Sizz.mp4",
        videoWebm: "images/Hot-Sizz.webm",
        videoIOSKeyed: "images/Hot-Sizz-Safari.mp4",
        keyColor: "#0000FF",
        position: null
    },

    {
        id: "teppa",
        targetIndex: 7,
        name: "Teppa Spark",
        poster: "images/Teppa_Spark.png",
        videoMp4: "images/Teppa-Spark.mp4",
        videoWebm: "images/Teppa-Spark.webm",
        videoIOSKeyed: "images/Teppa-Spark-Safari.mp4",
        keyColor: "#00FF00",
        position: null
    }

];


// ==========================================================
// MINDAR TARGET FILE
// ==========================================================

const TARGETS_MIND_SRC = "images/targets.mind";

const CHARACTER_WIDTH = 0.45;
const CHARACTER_HEIGHT = 0.45;
const CHARACTER_SCALE = "1 1 1";
const CHARACTER_POSITION = "-0.02 -0.2 0.01";
const CHARACTER_ROTATION = "0 0 0";


// ==========================================================
// GET HTML ELEMENTS
// ==========================================================

const startGate = document.getElementById("start-gate");
const startButton = document.getElementById("start-button");
const errorScreen = document.getElementById("error-state");
const sceneContainer = document.getElementById("scene-container");
const characterBadge = document.getElementById("character-badge");
const scanHint = document.getElementById("scan-hint");
const closeArBtn = document.getElementById("close-ar");
const arHomeButton = document.getElementById("ar-home-button");
const arBackButton = document.getElementById("ar-back-button");
const characterStrip = document.getElementById("character-strip");
const shareButton = document.getElementById("ar-share-button");
const shareButtonLabel = document.getElementById("ar-share-button-label");

// ==========================================================
// SHARE BUTTON / PHOTO CAPTURE
// ==========================================================

// Character currently being shown by MindAR (null when none in view).
let activeCharacter = null;

const photoPreview = document.getElementById("photo-preview");
const photoPreviewImage = document.getElementById("photo-preview-image");
const photoPreviewNote = document.getElementById("photo-preview-note");
const photoShareButton = document.getElementById("photo-share-button");
const photoSaveButton = document.getElementById("photo-save-button");
const photoRetakeButton = document.getElementById("photo-retake-button");
const photoBackButton = document.getElementById("photo-back-button");
const photoCaptionText = document.getElementById("photo-caption-text");
const photoCaptionCopyButton = document.getElementById("photo-caption-copy");

let currentPhotoBlob = null;
let currentPhotoUrl = null;

function getShareUrl() {
    return "https://reito-bt.github.io/Monster-Curry-Personality-Prototype-Website/";
}

function getCaptionFor(character) {
    return `I found ${character.name} at Monster Curry! 🍛\n#MonsterCurry #MonsterCurryAR\nTry it yourself: ${getShareUrl()}`;
}

function getCoverSourceRect(source, naturalWidth, naturalHeight, targetRect) {

    const sourceRect = source.getBoundingClientRect();

    const scale = Math.max(
        sourceRect.width / naturalWidth,
        sourceRect.height / naturalHeight
    );

    const displayedWidth = naturalWidth * scale;
    const displayedHeight = naturalHeight * scale;

    const originX = sourceRect.left + (sourceRect.width - displayedWidth) / 2;
    const originY = sourceRect.top + (sourceRect.height - displayedHeight) / 2;

    return {
        sx: (targetRect.left - originX) / scale,
        sy: (targetRect.top - originY) / scale,
        sWidth: targetRect.width / scale,
        sHeight: targetRect.height / scale
    };

}

function captureARPhoto() {

    const videoEl = sceneContainer.querySelector(":scope > video");
    const canvasEl = sceneContainer.querySelector("canvas.a-canvas");

    const sceneEl = sceneContainer.querySelector("a-scene");

    if (sceneEl && sceneEl.renderer && sceneEl.object3D && sceneEl.camera) {
        sceneEl.renderer.render(sceneEl.object3D, sceneEl.camera);
    }

    if (!videoEl || !canvasEl) {
        console.warn("Could not find camera feed or AR canvas to capture.");
        return;
    }

    const targetRect = sceneContainer.getBoundingClientRect();
    const targetWidth = Math.round(targetRect.width);
    const targetHeight = Math.round(targetRect.height);

    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = targetWidth;
    captureCanvas.height = targetHeight;

    const ctx = captureCanvas.getContext("2d");

    const videoCrop = getCoverSourceRect(videoEl, videoEl.videoWidth, videoEl.videoHeight, targetRect);
    ctx.drawImage(videoEl, videoCrop.sx, videoCrop.sy, videoCrop.sWidth, videoCrop.sHeight, 0, 0, targetWidth, targetHeight);

    const canvasCrop = getCoverSourceRect(canvasEl, canvasEl.width, canvasEl.height, targetRect);
    ctx.drawImage(canvasEl, canvasCrop.sx, canvasCrop.sy, canvasCrop.sWidth, canvasCrop.sHeight, 0, 0, targetWidth, targetHeight);

    captureCanvas.toBlob(blob => {

        if (!blob) {
            console.warn("Photo capture failed.");
            return;
        }

        showPhotoPreview(blob);

    }, "image/png");

}

function showPhotoPreview(blob) {

    currentPhotoBlob = blob;
    currentPhotoUrl = URL.createObjectURL(blob);

    photoPreviewImage.src = currentPhotoUrl;
    photoPreviewNote.textContent = "";
    photoCaptionText.value = getCaptionFor(activeCharacter || { name: "a Monster Curry character" });
    photoPreview.classList.remove("hidden");

}

function hidePhotoPreview() {

    photoPreview.classList.add("hidden");

    if (currentPhotoUrl) URL.revokeObjectURL(currentPhotoUrl);

    currentPhotoBlob = null;
    currentPhotoUrl = null;

}

photoRetakeButton.onclick = hidePhotoPreview;

photoBackButton.onclick = () => {
    window.location.href = "index.html";
};

photoCaptionCopyButton.onclick = async () => {

    try {
        await navigator.clipboard.writeText(photoCaptionText.value);
        flashCaptionCopyLabel("Copied!");
    } catch (error) {
        photoCaptionText.select();
        flashCaptionCopyLabel("Select & copy");
    }

};

function flashCaptionCopyLabel(message) {

    const previous = photoCaptionCopyButton.textContent;
    photoCaptionCopyButton.textContent = message;

    setTimeout(() => {
        photoCaptionCopyButton.textContent = previous;
    }, 1800);

}

photoSaveButton.onclick = () => {

    if (!currentPhotoBlob || !currentPhotoUrl) return;

    const filename = `${activeCharacter?.id || "monster-curry"}-ar-photo.png`;

    const link = document.createElement("a");
    link.href = currentPhotoUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

};

photoShareButton.onclick = async () => {

    if (!currentPhotoBlob) return;

    const character = activeCharacter || { name: "a Monster Curry character", id: "monster-curry" };
    const caption = photoCaptionText.value;
    const file = new File([currentPhotoBlob], `${character.id}-ar-photo.png`, { type: "image/png" });

    navigator.clipboard.writeText(caption).catch(() => { });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {

        try {
            await navigator.share({
                files: [file],
                title: `Monster Curry — ${character.name}`,
                text: caption
            });
            window.location.href = "index.html";
            return;
        } catch (error) {
            if (error?.name === "AbortError") return;
        }

    }

    photoSaveButton.click();
    photoPreviewNote.textContent =
        "Caption copied & photo saved.";
    setTimeout(() => { window.location.href = "index.html"; }, 3000);

};

function showShareButton(character) {
    activeCharacter = character;
    shareButtonLabel.textContent = "Take a Photo";
    shareButton.classList.add("visible");
}

function hideShareButton() {
    activeCharacter = null;
    shareButton.classList.remove("visible");
}

let isCapturing = false;

shareButton.onclick = () => {

    if (isCapturing) return;
    isCapturing = true;

    const previousLabel = shareButtonLabel.textContent;
    shareButtonLabel.textContent = "Hold still…";
    shareButton.disabled = true;

    setTimeout(() => {

        captureARPhoto();

        shareButtonLabel.textContent = previousLabel;
        shareButton.disabled = false;
        isCapturing = false;

    }, 600);

};


// ==========================================================
// iOS SAFARI DETECTION
// ==========================================================

function isIOSSafari() {

    const ua = navigator.userAgent;

    const isIOSDevice =
        /iPad|iPhone|iPod/.test(ua) ||
        (ua.includes("Mac") && "ontouchend" in document);

    return isIOSDevice;

}


// ==========================================================
// iOS CHROMA-KEY SHADER
// ==========================================================

if (window.AFRAME && !AFRAME.shaders.chromakey) {

    AFRAME.registerShader("chromakey", {

        schema: {
            src: { type: "map", is: "uniform" },
            keyColor: { type: "color", is: "uniform", default: "#00FF00" },
            similarity: { type: "number", is: "uniform", default: 0.22 },
            smoothness: { type: "number", is: "uniform", default: 0.12 },
            spill: { type: "number", is: "uniform", default: 0.15 }
        },

        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,

        fragmentShader: `
            uniform sampler2D src;
            uniform vec3 keyColor;
            uniform float similarity;
            uniform float smoothness;
            uniform float spill;
            varying vec2 vUv;

            vec2 toChroma(vec3 rgb) {
                return vec2(
                    rgb.r * -0.169 + rgb.g * -0.331 + rgb.b *  0.5   + 0.5,
                    rgb.r *  0.5   + rgb.g * -0.419 + rgb.b * -0.081 + 0.5
                );
            }

            void main() {
                vec4 texel = texture2D(src, vUv);

                vec2 keyChroma = toChroma(keyColor);
                vec2 texChroma = toChroma(texel.rgb);

                float dist = distance(texChroma, keyChroma);

                float alpha = smoothstep(similarity, similarity + smoothness, dist);

                float spillAmount = 1.0 - smoothstep(similarity, similarity + spill, dist);
                float luma = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
                vec3 despilled = mix(texel.rgb, vec3(luma), spillAmount * 0.6);

                gl_FragColor = vec4(despilled, alpha * texel.a);
            }
        `

    });

}


// ==========================================================
// CHARACTER PREVIEW STRIP
// ==========================================================

characterStrip.innerHTML = CHARACTERS

    .map(character => {

        return `
            <img
                src="${character.poster}"
                alt="${character.name}"
                loading="lazy"
            >
        `;

    })

    .join("");


// ==========================================================
// CLOSE AR
// ==========================================================

closeArBtn.onclick = () => {

    window.location.href = "index.html";

};

arHomeButton.onclick = () => {

    window.location.href = "index.html";

};

arBackButton.onclick = () => {

    window.location.href = "index.html";

};


// ==========================================================
// START AR
// ==========================================================

startButton.onclick = () => {

    console.log("Starting Monster Curry AR...");

    startGate.style.display = "none";

    initARScene();

};


// ==========================================================
// INITIALISE AR SCENE
// ==========================================================

function initARScene() {


    // ======================================================
    // CREATE VIDEO ASSETS
    // ======================================================

    const onIOS = isIOSSafari();

    const assetTags = CHARACTERS

        .map(character => {

            if (onIOS) {

                return `
                    <video
                        id="loop-${character.id}"
                        preload="auto"
                        loop
                        muted
                        playsinline
                        webkit-playsinline
                    >
                        <source
                            src="${character.videoIOSKeyed}"
                            type="video/mp4"
                        >
                    </video>
                `;

            }

            // Android/desktop Chrome only ever gets the WebM
            // source. We intentionally do NOT also offer the
            // HEVC mp4 here: some Android/Chrome builds have
            // hardware HEVC decode and would pick that source
            // over the webm below, which loses alpha and shows
            // the baked matte background instead of a
            // transparent video.
            return `
                <video
                    id="loop-${character.id}"
                    preload="auto"
                    loop
                    muted
                    playsinline
                    webkit-playsinline
                    crossorigin="anonymous"
                >
                    <source
                        src="${character.videoWebm}"
                        type="video/webm"
                    >
                </video>
            `;

        })

        .join("");


    // ======================================================
    // CREATE IMAGE TARGETS
    // ======================================================

    const anchorTags = CHARACTERS

        .map(character => {

            const material = onIOS

                ? `
                    shader: chromakey;
                    src: #loop-${character.id};
                    keyColor: ${character.keyColor};
                    transparent: true;
                `

                : `
                    shader: flat;
                    src: #loop-${character.id};
                    transparent: true;
                `;

            return `
                <a-entity
                    mindar-image-target="
                        targetIndex: ${character.targetIndex}
                    "
                    data-character-id="${character.id}"
                    data-character-name="${character.name}"
                >
                    <a-video
                        src="#loop-${character.id}"
                        material="${material}"
                        width="${CHARACTER_WIDTH}"
                        height="${CHARACTER_HEIGHT}"
                        scale="${CHARACTER_SCALE}"
                        position="${character.position || CHARACTER_POSITION}"
                        rotation="${CHARACTER_ROTATION}"
                    >
                    </a-video>
                </a-entity>
            `;

        })

        .join("");


    // ======================================================
    // BUILD A-FRAME / MINDAR SCENE
    // ======================================================

    sceneContainer.innerHTML = `
        <a-scene
            mindar-image="
                imageTargetSrc: ${TARGETS_MIND_SRC};
                autoStart: true;
                uiScanning: no;
                uiLoading: no;
            "
            color-space="sRGB"
            renderer="
                colorManagement: true;
                physicallyCorrectLights: true;
                preserveDrawingBuffer: true;
            "
            vr-mode-ui="
                enabled: false
            "
            device-orientation-permission-ui="
                enabled: false
            "
        >

            <a-assets>
                ${assetTags}
            </a-assets>

            <a-camera
                position="0 0 0"
                look-controls="
                    enabled: false
                "
            >
            </a-camera>

            ${anchorTags}

        </a-scene>
    `;


    // ======================================================
    // iOS SAFARI: PRIME ALL VIDEOS
    // ======================================================

    if (isIOSSafari()) {

        CHARACTERS.forEach(character => {

            const videoEl =
                document.getElementById(`loop-${character.id}`);

            if (!videoEl) return;

            videoEl.muted = true;
            videoEl.playsInline = true;

            videoEl.load();

            const primePlay = videoEl.play();

            if (primePlay !== undefined) {

                primePlay
                    .then(() => {
                        videoEl.pause();
                        videoEl.currentTime = 0;
                    })
                    .catch(error => {
                        console.warn(
                            `iOS priming play failed for ${character.name}:`,
                            error
                        );
                    });

            }

        });

    }


    // ======================================================
    // GET GENERATED A-FRAME SCENE
    // ======================================================

    const sceneEl =
        sceneContainer.querySelector("a-scene");


    // ======================================================
    // DEBUG — A-FRAME SCENE LOADED
    // ======================================================

    sceneEl.addEventListener(
        "loaded",
        () => {
            console.log("A-Frame scene loaded");
        }
    );


    // ======================================================
    // DEBUG — MINDAR CAMERA READY
    // ======================================================

    sceneEl.addEventListener(
        "arReady",
        () => {

            console.log("MindAR camera ready");

            characterBadge.textContent = "Point at a standee...";
            characterBadge.classList.add("idle");

        }
    );


    // ======================================================
    // MINDAR ERROR
    // ======================================================

    sceneEl.addEventListener(
        "arError",
        error => {

            console.error("MindAR AR ERROR:", error);

            sceneContainer.innerHTML = "";
            errorScreen.style.display = "flex";

        }
    );


    // ======================================================
    // TARGET FOUND / LOST EVENTS
    // ======================================================

    CHARACTERS.forEach(character => {

        const anchorEl =
            sceneContainer.querySelector(
                `[data-character-id="${character.id}"]`
            );

        const videoEl =
            document.getElementById(`loop-${character.id}`);


        // --------------------------------------------------
        // TARGET FOUND
        // --------------------------------------------------

        anchorEl.addEventListener(
            "targetFound",
            () => {

                console.log("Target found:", character.name);

                characterBadge.textContent = character.name;
                characterBadge.classList.remove("idle");

                scanHint.classList.add("hidden");
                showShareButton(character);

                videoEl.currentTime = 0;

                videoEl
                    .play()
                    .then(() => {
                        console.log("Playing video:", character.name);
                    })
                    .catch(error => {
                        console.warn(
                            `Could not play ${character.name}:`,
                            error
                        );
                    });

            }
        );


        // --------------------------------------------------
        // TARGET LOST
        // --------------------------------------------------

        anchorEl.addEventListener(
            "targetLost",
            () => {

                console.log("Target lost:", character.name);

                videoEl.pause();

                characterBadge.textContent = "Point at a standee...";
                characterBadge.classList.add("idle");

                scanHint.classList.remove("hidden");
                hideShareButton();

            }
        );

    });

}