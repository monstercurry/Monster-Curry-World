/*
==========================================================
MONSTER CURRY AR SCENE
==========================================================

TEST VERSION:
WEBM ONLY

This test deliberately removes the MP4/HEVC source.

The goal is to check whether modern iOS Safari can render
the same transparent WebM files that already work on Android.

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

        videoWebm: "images/Katsu-Chan.webm",

        position: null
    },


    {
        id: "monstora",
        targetIndex: 1,
        name: "Monstora Sharemi",

        poster: "images/Monstora_Sharemi.png",

        videoWebm: "images/Monstora-Sharemi.webm",

        position: null
    },


    {
        id: "giga",
        targetIndex: 2,
        name: "Giga Nomu",

        poster: "images/Giga_Nomu.png",

        videoWebm: "images/Giga-Nomu.webm",

        position: null
    },


    {
        id: "tamago",
        targetIndex: 3,
        name: "Tamago Puffy",

        poster: "images/Tamago_Puffy.png",

        videoWebm: "images/Tamago-Puffy.webm",

        position: null
    },


    {
        id: "cheezu",
        targetIndex: 4,
        name: "Cheezu Mellow",

        poster: "images/Cheezu_Mellow.png",

        videoWebm: "images/Cheezu-Mellow.webm",

        position: null
    },


    {
        id: "ramy",
        targetIndex: 5,
        name: "Ramy Noodleton",

        poster: "images/Ramy_Noodleton.png",

        videoWebm: "images/Ramy-Noodleton.webm",

        position: null
    },


    {
        id: "hotsizz",
        targetIndex: 6,
        name: "Hot Sizz",

        poster: "images/Hot_Sizz.png",

        videoWebm: "images/Hot-Sizz.webm",

        position: null
    },


    {
        id: "teppa",
        targetIndex: 7,
        name: "Teppa Spark",

        poster: "images/Teppa_Spark.png",

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
// UNCHANGED FROM YOUR CURRENT WORKING SETUP
// ==========================================================

const CHARACTER_WIDTH = 0.48;

const CHARACTER_HEIGHT = 0.48;


const CHARACTER_SCALE = "1 1 1";


const CHARACTER_POSITION = "-0.02 -0.2 0.01";


const CHARACTER_ROTATION = "0 0 0";



// ==========================================================
// HTML ELEMENTS
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

    console.log("WEBM-ONLY iOS TEST");


    startGate.style.display = "none";


    initARScene();

};



// ==========================================================
// INITIALISE AR
// ==========================================================

function initARScene() {



    // ======================================================
    // CREATE VIDEO ASSETS
    //
    // IMPORTANT:
    //
    // WEBM ONLY FOR THIS TEST.
    //
    // There is NO MP4 source in this version.
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
    // BUILD A-FRAME + MINDAR SCENE
    //
    // THIS PART IS UNCHANGED.
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
    // GET GENERATED SCENE
    // ======================================================

    const sceneEl =
        sceneContainer.querySelector("a-scene");



    // ======================================================
    // A-FRAME LOADED
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
    // MINDAR READY
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


            // ----------------------------------------------
            // DEBUG VIDEO SUPPORT
            // ----------------------------------------------

            const testVideo =
                document.createElement("video");


            console.log(
                "Safari WebM support:",
                testVideo.canPlayType("video/webm")
            );


            console.log(
                "Safari VP9 WebM support:",
                testVideo.canPlayType('video/webm; codecs="vp9"')
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
    // TARGET EVENTS
    // ======================================================

    CHARACTERS.forEach(character => {


        const anchorEl =

            sceneContainer.querySelector(

                `[data-character-id="${character.id}"]`

            );


        const videoEl =

            document.getElementById(

                `loop-${character.id}`

            );



        // ==================================================
        // VIDEO DEBUG EVENTS
        // ==================================================

        videoEl.addEventListener(
            "loadedmetadata",
            () => {

                console.log(
                    `${character.name} metadata loaded`
                );


                console.log(
                    `${character.name} size:`,
                    videoEl.videoWidth,
                    "x",
                    videoEl.videoHeight
                );


                console.log(
                    `${character.name} duration:`,
                    videoEl.duration
                );

            }
        );


        videoEl.addEventListener(
            "canplay",
            () => {

                console.log(
                    `${character.name} can play`
                );

            }
        );


        videoEl.addEventListener(
            "playing",
            () => {

                console.log(
                    `${character.name} IS PLAYING`
                );

            }
        );


        videoEl.addEventListener(
            "error",
            () => {

                console.error(
                    `${character.name} VIDEO ERROR`,
                    videoEl.error
                );

            }
        );



        // ==================================================
        // TARGET FOUND
        // ==================================================

        anchorEl.addEventListener(

            "targetFound",

            () => {


                console.log(
                    "Target found:",
                    character.name
                );


                console.log(
                    "Video readyState:",
                    videoEl.readyState
                );


                console.log(
                    "Video networkState:",
                    videoEl.networkState
                );


                console.log(
                    "Video currentSrc:",
                    videoEl.currentSrc
                );


                characterBadge.textContent =
                    character.name;


                characterBadge.classList.remove(
                    "idle"
                );


                scanHint.classList.add(
                    "hidden"
                );


                // Ensure iOS properties are set directly too.

                videoEl.muted = true;

                videoEl.playsInline = true;


                // Restart animation.

                try {

                    videoEl.currentTime = 0;

                }

                catch (error) {

                    console.warn(
                        "Could not reset video:",
                        error
                    );

                }



                const playPromise =
                    videoEl.play();


                if (playPromise !== undefined) {

                    playPromise

                        .then(() => {

                            console.log(
                                "Playing video:",
                                character.name
                            );


                            console.log(
                                "Current source:",
                                videoEl.currentSrc
                            );


                            console.log(
                                "Current time:",
                                videoEl.currentTime
                            );

                        })

                        .catch(error => {

                            console.error(
                                `Could not play ${character.name}:`,
                                error
                            );

                        });

                }

            }

        );



        // ==================================================
        // TARGET LOST
        // ==================================================

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