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

        // Per-character position override.
        // Leave as null to use the shared CHARACTER_POSITION below.
        // Set to "x y z" (same format as CHARACTER_POSITION) to
        // nudge just this character if it looks off-center on
        // its specific standee/video.
        position: null
    },


    {
        id: "monstora",
        targetIndex: 1,
        name: "Monstora Sharemi",

        poster: "images/Monstora_Sharemi.png",

        videoMp4: "images/Monstora-Sharemi.mp4",
        videoWebm: "images/Monstora-Sharemi.webm",

        position: null
    },


    {
        id: "giga",
        targetIndex: 2,
        name: "Giga Nomu",

        poster: "images/Giga_Nomu.png",

        videoMp4: "images/Giga-Nomu.mp4",
        videoWebm: "images/Giga-Nomu.webm",

        position: null
    },


    {
        id: "tamago",
        targetIndex: 3,
        name: "Tamago Puffy",

        poster: "images/Tamago_Puffy.png",

        videoMp4: "images/Tamago-Puffy.mp4",
        videoWebm: "images/Tamago-Puffy.webm",

        position: null
    },


    {
        id: "cheezu",
        targetIndex: 4,
        name: "Cheezu Mellow",

        poster: "images/Cheezu_Mellow.png",

        videoMp4: "images/Cheezu-Mellow.mp4",
        videoWebm: "images/Cheezu-Mellow.webm",

        position: null
    },


    {
        id: "ramy",
        targetIndex: 5,
        name: "Ramy Noodleton",

        poster: "images/Ramy_Noodleton.png",

        videoMp4: "images/Ramy-Noodleton.mp4",
        videoWebm: "images/Ramy-Noodleton.webm",

        position: null
    },


    {
        id: "hotsizz",
        targetIndex: 6,
        name: "Hot Sizz",

        poster: "images/Hot_Sizz.png",

        videoMp4: "images/Hot-Sizz.mp4",
        videoWebm: "images/Hot-Sizz.webm",

        position: null
    },


    {
        id: "teppa",
        targetIndex: 7,
        name: "Teppa Spark",

        poster: "images/Teppa_Spark.png",

        videoMp4: "images/Teppa-Spark.mp4",
        videoWebm: "images/Teppa-Spark.webm",

        position: null
    }

];



// ==========================================================
// MINDAR TARGET FILE
// ==========================================================

const TARGETS_MIND_SRC = "images/targets.mind";



// ==========================================================
// GLOBAL CHARACTER TRANSFORM
//
// THESE VALUES APPLY TO ALL 8 CHARACTERS.
//
// Adjust these if you want every AR character to:
// - move
// - resize
// - rotate
//
// ==========================================================


// Base plane size

const CHARACTER_WIDTH = 0.48;

const CHARACTER_HEIGHT = 0.48;


// Keep scale at 1 so positioning is easier to understand

const CHARACTER_SCALE = "1 1 1";


// X   Y    Z
//
// X:
// negative = left
// positive = right
//
// Y:
// negative = down
// positive = up
//
// Z:
// small positive value places video slightly above target

const CHARACTER_POSITION = "-0.02 -0.2 0.01";


// X Y Z rotation

const CHARACTER_ROTATION = "0 0 0";



// ==========================================================
// GET HTML ELEMENTS
// ==========================================================

const startGate =
    document.getElementById("start-gate");


const startButton =
    document.getElementById("start-button");


const errorScreen =
    document.getElementById("error-state");


const sceneContainer =
    document.getElementById("scene-container");


const characterBadge =
    document.getElementById("character-badge");


const scanHint =
    document.getElementById("scan-hint");


const closeArBtn =
    document.getElementById("close-ar");


const characterStrip =
    document.getElementById("character-strip");



// ==========================================================
// iOS SAFARI DETECTION
//
// Used ONLY to run an iOS-specific video "priming" step.
// Does not change anything about the Android code path.
// ==========================================================

function isIOSSafari() {

    const ua = navigator.userAgent;

    const isIOSDevice =
        /iPad|iPhone|iPod/.test(ua) ||
        // iPadOS 13+ reports as "Mac" but has touch support
        (ua.includes("Mac") && "ontouchend" in document);

    return isIOSDevice;

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


    // Hide start page

    startGate.style.display = "none";


    // Create AR scene

    initARScene();

};



// ==========================================================
// INITIALISE AR SCENE
// ==========================================================

function initARScene() {


    // ======================================================
    // CREATE VIDEO ASSETS
    // ======================================================

    const assetTags = CHARACTERS

        .map(character => {

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


                    <!--
                        iOS Safari can use HEVC MP4
                        with transparency.

                        NOTE: intentionally NOT specifying a codecs=
                        string here. A bare "hvc1" (without profile/
                        level, e.g. hvc1.1.6.L93.B0) can fail Safari's
                        canPlayType() check, causing Safari to silently
                        skip this <source> and fall through to the
                        webm source below -- which Safari can't play
                        at all, leaving the video with nothing valid
                        to load. Letting Safari sniff the container
                        itself is more reliable.

                        This has ZERO effect on Android: Chrome/Android
                        doesn't support hvc1 either way and always
                        falls through to the webm source below.
                    -->

                    <source

                        src="${character.videoMp4}"

                        type="video/mp4"

                    >


                    <!--
                        Android / Chrome should use WebM.
                    -->

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


                        material="
                            shader: flat;
                            src: #loop-${character.id};
                            transparent: true;
                        "


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


            <!-- ================= ASSETS ================= -->

            <a-assets>

                ${assetTags}

            </a-assets>



            <!-- ================= AR CAMERA ================= -->

            <a-camera

                position="0 0 0"

                look-controls="
                    enabled: false
                "

            >

            </a-camera>



            <!-- ================= TARGETS ================= -->

            ${anchorTags}


        </a-scene>

    `;



    // ======================================================
    // iOS SAFARI: PRIME ALL VIDEOS
    //
    // iOS Safari can refuse .play() on a video element that
    // was never explicitly started inside the original user
    // -gesture call stack. Our real .play() calls happen later,
    // async, inside the MindAR "targetFound" event -- which
    // iOS does not treat as gesture-authorized.
    //
    // Fix: immediately load() + play() + pause() every video
    // right here, still inside the synchronous startButton
    // click handler. This "unlocks" each element for iOS so
    // the later programmatic play() in targetFound works.
    //
    // Gated to iOS only -- Android's working path is untouched.
    // ======================================================

    if (isIOSSafari()) {

        CHARACTERS.forEach(character => {

            const videoEl =
                document.getElementById(`loop-${character.id}`);

            if (!videoEl) return;

            // Set as JS properties too, not just HTML attributes --
            // Safari's autoplay policy checks the live properties.
            videoEl.muted = true;
            videoEl.playsInline = true;

            // Force Safari to (re)parse the <source> children.
            // Sources injected via innerHTML aren't always picked
            // up automatically without an explicit load().
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

            console.log(
                "A-Frame scene loaded"
            );

        }
    );



    // ======================================================
    // DEBUG — MINDAR CAMERA READY
    // ======================================================

    sceneEl.addEventListener(
        "arReady",
        () => {

            console.log(
                "MindAR camera ready"
            );


            characterBadge.textContent =
                "Point at a standee...";


            characterBadge.classList.add(
                "idle"
            );

        }
    );



    // ======================================================
    // MINDAR ERROR
    // ======================================================

    sceneEl.addEventListener(
        "arError",
        error => {


            console.error(
                "MindAR AR ERROR:",
                error
            );


            sceneContainer.innerHTML = "";


            errorScreen.style.display =
                "flex";

        }
    );



    // ======================================================
    // TARGET FOUND / LOST EVENTS
    // ======================================================

    CHARACTERS.forEach(character => {


        // --------------------------------------------------
        // GET TARGET
        // --------------------------------------------------

        const anchorEl =

            sceneContainer.querySelector(

                `[data-character-id="${character.id}"]`

            );



        // --------------------------------------------------
        // GET VIDEO
        // --------------------------------------------------

        const videoEl =

            document.getElementById(

                `loop-${character.id}`

            );



        // --------------------------------------------------
        // TARGET FOUND
        // --------------------------------------------------

        anchorEl.addEventListener(

            "targetFound",

            () => {


                console.log(

                    "Target found:",

                    character.name

                );



                characterBadge.textContent =

                    character.name;



                characterBadge.classList.remove(

                    "idle"

                );



                scanHint.classList.add(

                    "hidden"

                );



                // Restart animation

                videoEl.currentTime = 0;



                videoEl

                    .play()

                    .then(() => {

                        console.log(

                            "Playing video:",

                            character.name

                        );

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


                console.log(

                    "Target lost:",

                    character.name

                );



                videoEl.pause();



                characterBadge.textContent =

                    "Point at a standee...";



                characterBadge.classList.add(

                    "idle"

                );



                scanHint.classList.remove(

                    "hidden"

                );

            }

        );


    });

}