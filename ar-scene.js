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
const characterStrip = document.getElementById("character-strip");


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

            }
        );

    });

}