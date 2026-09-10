/* ---------------- FIREBASE (loaded dynamically, not statically) ----------------
   Firebase's SDK is fetched from gstatic.com. Ad blockers and browser tracking
   protection (Opera GX's built-in blocker, Chrome extensions like uBlock Origin,
   etc.) frequently block gstatic.com/firebasejs requests. A blocked *static*
   import at the top of an ES module fails the ENTIRE module before a single
   line of it runs — meaning every button on the page (Start Quiz, Back, Home,
   star ratings, AR/Battle nav) silently had no click handler attached whenever
   Firebase was blocked, which is exactly what browsers/extensions with
   tracking protection do. Loading Firebase dynamically means the rest of the
   app always initializes even if Firebase never loads; only feedback
   submission and storefront battle multiplayer sync degrade gracefully. */
const firebaseConfig = {
	apiKey: "AIzaSyC1lCGw5eI3oFxw9_FKxBp86k1cMPGWbic",
	authDomain: "monstercurryfeedback.firebaseapp.com",
	projectId: "monstercurryfeedback",
	storageBucket: "monstercurryfeedback.appspot.com",
	messagingSenderId: "881609695456",
	appId: "1:881609695456:web:b84a60ed669112d937b085"
};

const storefrontFirebaseConfig = {
	apiKey: "AIzaSyBq5lzgJAY4H_7py32FCSHTnxuwvU-1Ixk",
	authDomain: "storefront-game.firebaseapp.com",
	databaseURL: "https://storefront-game-default-rtdb.asia-southeast1.firebasedatabase.app",
	projectId: "storefront-game",
	storageBucket: "storefront-game.firebasestorage.app",
	messagingSenderId: "805711728537",
	appId: "1:805711728537:web:9aace7f18cd32020e78d08"
};

let db = null;
let storefrontDb = null;
let collection, addDoc, get, onDisconnect, onValue, ref, serverTimestamp, set, update;
let firebaseAvailable = false;

// Fire-and-forget: the rest of this file does NOT wait on this promise, so a
// blocked/slow/failed Firebase load never delays or breaks UI initialization.
const firebaseReady = (async () => {
	try {
		const [appMod, firestoreMod, databaseMod] = await Promise.all([
			import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
			import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js"),
			import("https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js")
		]);
		({ collection, addDoc } = firestoreMod);
		({ get, onDisconnect, onValue, ref, serverTimestamp, set, update } = databaseMod);

		const app = appMod.initializeApp(firebaseConfig);
		db = firestoreMod.getFirestore(app);

		const storefrontApp = appMod.initializeApp(storefrontFirebaseConfig, "storefrontBattle");
		storefrontDb = databaseMod.getDatabase(storefrontApp);

		firebaseAvailable = true;
	} catch (err) {
		console.warn("Firebase failed to load (likely blocked by an ad/tracker blocker). Feedback submission and storefront battle sync are unavailable this session, but the quiz itself still works.", err);
		firebaseAvailable = false;
	}
	return firebaseAvailable;
})();



/* ---------------- QUIZ DATA ---------------- */
// Scoring: each option awards points to specific personalities.
// +3 = strong match, +1 = similar, -1 = opposite
const P = {
	katsu: "katsu",
	monstora: "monstora",
	giga: "giga",
	tamago: "tamago",
	cheezu: "cheezu",
	ramy: "ramy",
	hotsizz: "hotsizz",
	teppa: "teppa"
};

const questions = [
	{
		prompt: "I always want extra toppings on my curry.",
		options: [
			{ text: "More toppings = better life", scores: { [P.giga]: 3, [P.monstora]: 1, [P.hotsizz]: 1, [P.teppa]: -1 } },
			{ text: "Simple is enough", scores: { [P.katsu]: 3, [P.tamago]: 1, [P.teppa]: 1, [P.hotsizz]: -1 } },
			{ text: "Depends on mood", scores: { [P.ramy]: 3, [P.teppa]: 1, [P.hotsizz]: 1, [P.monstora]: -1 } },
			{ text: "Only exciting toppings", scores: { [P.hotsizz]: 3, [P.giga]: 1, [P.ramy]: 1, [P.katsu]: -1 } }
		]
	},
	{
		prompt: "Spicy food makes meals more exciting.",
		options: [
			{ text: "Extra spicy please", scores: { [P.hotsizz]: 3, [P.giga]: 1, [P.ramy]: 1, [P.katsu]: -1 } },
			{ text: "Medium spice is enough", scores: { [P.teppa]: 3, [P.katsu]: 1, [P.ramy]: 1, [P.giga]: -1 } },
			{ text: "Mild only", scores: { [P.cheezu]: 3, [P.monstora]: 1, [P.tamago]: 1 } },
			{ text: "No spice at all", scores: { [P.tamago]: 3, [P.katsu]: 1, [P.cheezu]: 1 } }
		]
	},
	{
		prompt: "I usually order the same safe menu item.",
		options: [
			{ text: "I stay loyal to favorites", scores: { [P.katsu]: 3, [P.tamago]: 1, [P.teppa]: 1, [P.hotsizz]: -1 } },
			{ text: "I love trying new dishes", scores: { [P.hotsizz]: 3, [P.giga]: 1, [P.ramy]: 1, [P.katsu]: -1 } },
			{ text: "Depends on my mood", scores: { [P.ramy]: 3, [P.teppa]: 1, [P.hotsizz]: 1, [P.monstora]: -1 } },
			{ text: "Friends decide for me", scores: { [P.monstora]: 3, [P.giga]: 1, [P.cheezu]: 1, [P.ramy]: -1 } }
		]
	},
	{
		prompt: "Food presentation matters as much as taste.",
		options: [
			{ text: "Looks are everything", scores: { [P.teppa]: 3, [P.katsu]: 1, [P.ramy]: 1, [P.giga]: -1 } },
			{ text: "Taste is more important", scores: { [P.giga]: 3, [P.monstora]: 1, [P.hotsizz]: 1, [P.teppa]: -1 } },
			{ text: "Both matter", scores: { [P.monstora]: 3, [P.giga]: 1, [P.cheezu]: 1, [P.ramy]: -1 } },
			{ text: "I want comfort food", scores: { [P.tamago]: 3, [P.katsu]: 1, [P.cheezu]: 1 } }
		]
	},
	{
		prompt: "I would try the giant Monster Challenge curry.",
		options: [
			{ text: "Definitely", scores: { [P.giga]: 3, [P.monstora]: 1, [P.hotsizz]: 1, [P.teppa]: -1 } },
			{ text: "Maybe with friends", scores: { [P.monstora]: 3, [P.giga]: 1, [P.cheezu]: 1, [P.ramy]: -1 } },
			{ text: "Probably not", scores: { [P.tamago]: 3, [P.katsu]: 1, [P.cheezu]: 1 } },
			{ text: "Only if there's a reward", scores: { [P.teppa]: 3, [P.katsu]: 1, [P.ramy]: 1, [P.giga]: -1 } }
		]
	},
	{
		prompt: "Cheese makes every dish better.",
		options: [
			{ text: "Cheese solves everything", scores: { [P.cheezu]: 3, [P.monstora]: 1, [P.tamago]: 1 } },
			{ text: "Sometimes yes", scores: { [P.katsu]: 3, [P.tamago]: 1, [P.teppa]: 1, [P.hotsizz]: -1 } },
			{ text: "Not necessary", scores: { [P.teppa]: 3, [P.katsu]: 1, [P.ramy]: 1, [P.giga]: -1 } },
			{ text: "I prefer strong flavors", scores: { [P.hotsizz]: 3, [P.giga]: 1, [P.ramy]: 1, [P.katsu]: -1 } }
		]
	},
	{
		prompt: "I choose food based on comfort, not adventure.",
		options: [
			{ text: "Comfort food forever", scores: { [P.tamago]: 3, [P.katsu]: 1, [P.cheezu]: 1 } },
			{ text: "Usually comfort food", scores: { [P.katsu]: 3, [P.tamago]: 1, [P.teppa]: 1, [P.hotsizz]: -1 } },
			{ text: "I like both", scores: { [P.ramy]: 3, [P.teppa]: 1, [P.hotsizz]: 1, [P.monstora]: -1 } },
			{ text: "Adventure first", scores: { [P.hotsizz]: 3, [P.giga]: 1, [P.ramy]: 1, [P.katsu]: -1 } }
		]
	},
	{
		prompt: "I like sharing food with friends.",
		options: [
			{ text: "Sharing is caring", scores: { [P.monstora]: 3, [P.giga]: 1, [P.cheezu]: 1, [P.ramy]: -1 } },
			{ text: "Depends who", scores: { [P.cheezu]: 3, [P.monstora]: 1, [P.tamago]: 1 } },
			{ text: "Maybe one bite", scores: { [P.katsu]: 3, [P.tamago]: 1, [P.teppa]: 1, [P.hotsizz]: -1 } },
			{ text: "My food is mine", scores: { [P.ramy]: 3, [P.teppa]: 1, [P.hotsizz]: 1, [P.monstora]: -1 } }
		]
	},
	{
		prompt: "I prefer a balanced meal over a heavy meal.",
		options: [
			{ text: "Healthy and balanced", scores: { [P.teppa]: 3, [P.katsu]: 1, [P.ramy]: 1, [P.giga]: -1 } },
			{ text: "Balance with some fun", scores: { [P.katsu]: 3, [P.tamago]: 1, [P.teppa]: 1, [P.hotsizz]: -1 } },
			{ text: "Heavy meals are best", scores: { [P.giga]: 3, [P.monstora]: 1, [P.hotsizz]: 1, [P.teppa]: -1 } },
			{ text: "Depends on hunger", scores: { [P.ramy]: 3, [P.teppa]: 1, [P.hotsizz]: 1, [P.monstora]: -1 } }
		]
	},
	{
		prompt: "I would post my Monster Curry meal on Instagram.",
		options: [
			{ text: "Of course", scores: { [P.hotsizz]: 3, [P.giga]: 1, [P.ramy]: 1, [P.katsu]: -1 } },
			{ text: "Only if it looks amazing", scores: { [P.teppa]: 3, [P.katsu]: 1, [P.ramy]: 1, [P.giga]: -1 } },
			{ text: "Rarely", scores: { [P.monstora]: 3, [P.giga]: 1, [P.cheezu]: 1, [P.ramy]: -1 } },
			{ text: "Never", scores: { [P.ramy]: 3, [P.teppa]: 1, [P.hotsizz]: 1, [P.monstora]: -1 } }
		]
	},
	{
		prompt: "Which Monster Curry menu item speaks to you most?",
		options: [
			{ text: "Classic Chicken Katsu Curry", scores: { katsu: 3, tamago: 1, teppa: 1, hotsizz: -1 } },
			{ text: "Monster Challenge (Extra Large)", scores: { giga: 3, monstora: 1, hotsizz: 1, teppa: -1 } },
			{ text: "Cheese Curry with Extra Toppings", scores: { cheezu: 3, monstora: 1, tamago: 1 } },
			{ text: "Spicy Hotplate Sizzling Curry", scores: { hotsizz: 3, giga: 1, ramy: 1, katsu: -1 } }
		]
	},
	{
		prompt: "How do you like your curry sauce?",
		options: [
			{ text: "Rich and thick — the more the better", scores: { giga: 3, monstora: 1, cheezu: 1, teppa: -1 } },
			{ text: "Smooth and balanced, not too heavy", scores: { katsu: 3, tamago: 1, teppa: 1, hotsizz: -1 } },
			{ text: "Fiery and bold with a strong kick", scores: { hotsizz: 3, giga: 1, ramy: 1, katsu: -1 } },
			{ text: "Light and flavourful — just enough", scores: { ramy: 3, teppa: 1, hotsizz: 1, monstora: -1 } }
		]
	},
	{
		prompt: "What would you add first as an extra topping?",
		options: [
			{ text: "Melted cheese — always", scores: { cheezu: 3, monstora: 1, tamago: 1 } },
			{ text: "A perfectly fried egg", scores: { tamago: 3, katsu: 1, cheezu: 1 } },
			{ text: "Extra crispy katsu", scores: { katsu: 3, tamago: 1, teppa: 1, hotsizz: -1 } },
			{ text: "Extra chilli — make it hurt", scores: { hotsizz: 3, giga: 1, ramy: 1, katsu: -1 } }
		]
	},
	{
		prompt: "You're eating at Monster Curry with friends. You:",
		options: [
			{ text: "Order the sharing Monster Combo platter", scores: { monstora: 3, giga: 1, cheezu: 1, ramy: -1 } },
			{ text: "Get your personal favourite and focus", scores: { katsu: 3, tamago: 1, teppa: 1, hotsizz: -1 } },
			{ text: "Try something new from the specials board", scores: { hotsizz: 3, giga: 1, ramy: 1, katsu: -1 } },
			{ text: "Let everyone order first, then decide", scores: { ramy: 3, teppa: 1, hotsizz: 1, monstora: -1 } }
		]
	},
	{
		prompt: "Pick your ideal Monster Curry experience:",
		options: [
			{ text: "Teppanyaki-style — watching the chef cook live", scores: { teppa: 3, katsu: 1, ramy: 1, giga: -1 } },
			{ text: "Sizzling hotplate arriving at the table", scores: { hotsizz: 3, giga: 1, ramy: 1, katsu: -1 } },
			{ text: "Giant bowl challenge with the whole group", scores: { giga: 3, monstora: 1, hotsizz: 1, teppa: -1 } },
			{ text: "Quiet solo meal with a comforting classic", scores: { tamago: 3, katsu: 1, cheezu: 1 } }
		]
	}
];

const personalities = [
	{
		id: P.katsu,
		image: "images/Katsu-Chan.png",
		name: "🍗 Katsu-Chan",
		title: "The Classic Comfort Hero",
		birthday: "12ᵗʰ May",
		catchphrase: '"Simple is best! You can always count on me!"',
		favouriteFood: "Katsu Curry",
		coreTraits: "Reliable · Friendly · Dependable · Simple taste · Always safe choice",
		background: "Katsu-Chan is the heart of every meal — never flashy, but always satisfying. Just like a classic chicken katsu curry, they are the person everyone trusts when they don't know what to choose.",
		description: "Calm, comforting, and consistently good in any situation. You are reliable, friendly, and dependable. People gravitate toward you because you bring stability and warmth without making things complicated. You're everyone's safe choice — and that's a superpower."
	},
	{
		id: P.monstora,
		image: "images/Monstora_Sharemi.png",
		name: "🍛 Monstora Sharemi",
		title: "The Social Feast Buddy",
		birthday: "3ʳᵈ November",
		catchphrase: '"Food tastes way better when we eat together!"',
		favouriteFood: "Super Monster Combo",
		coreTraits: "Outgoing · Generous · Friendly · Loves sharing · Group-oriented",
		background: "Monstora Sharemi believes food tastes better together. Always ordering the Monster Combo, they bring people to the table and make every meal feel like a party.",
		description: "Outgoing, generous, and group-oriented — you love sharing and bringing people together. If you're eating with someone, expect extra spoons and shared bites. You thrive in social settings and make everyone feel included in the fun."
	},
	{
		id: P.giga,
		image: "images/Giga_Nomu.png",
		name: "🍖 Giga Nomu",
		title: "The Big Appetite Beast",
		birthday: "15ᵗʰ August",
		catchphrase: '"Bring on the giant plate! I’m still hungry!"',
		favouriteFood: "Super Monster Curry",
		coreTraits: "Bold · Energetic · Greedy for food · Loves large portions · Fearless eater",
		background: "Giga Nomu never leaves anything behind. The bigger the portion, the happier they are. Just like a super monster curry, they live life with huge energy and an even bigger appetite.",
		description: "Bold, energetic, and fearless — you live for big experiences and never hold back. You always finish what others can't, and your enthusiasm is contagious. You're built for full-throttle living, and people love your unstoppable energy."
	},
	{
		id: P.tamago,
		image: "images/Tamago_Puffy.png",
		name: "🥚 Tamago Puffy",
		title: "The Soft & Cozy Dreamer",
		birthday: "14ᵗʰ March",
		catchphrase: '"Shhh... let’s stay under the blanket a bit longer..."',
		favouriteFood: "Teriyaki Chicken Omelette Curry",
		coreTraits: "Gentle · Cute · Emotional · Comfort-loving · Soft-spoken",
		background: "Tamago Puffy is soft on the outside and even softer inside. Warm, calming, and a little shy, they bring peace and sweetness wherever they go.",
		description: "Gentle, cute, and comfort-loving — you find joy in the quiet, cozy moments of life. You're the person who makes others feel instantly at ease. Your warmth is subtle but deeply felt, and your emotional softness is your greatest strength."
	},
	{
		id: P.cheezu,
		image: "images/Cheezu_Mellow.png",
		name: "🧀 Cheezu Mellow",
		title: "The Cheesy Comfort Lover",
		birthday: "8ᵗʰ July",
		catchphrase: '"Oh my goodness, this is so good my heart is melting!"',
		favouriteFood: "Cheese Omelette Curry",
		coreTraits: "Affectionate · Cozy · Over-the-top emotional · Loves indulgence · Warm",
		background: "Cheezu Mellow believes everything is better with cheese — especially life. Their presence melts stress away like cheese on hot curry.",
		description: "Affectionate, cozy, and a little over-the-top in the best way. You love indulgence and emotional warmth. You're expressive, caring, and impossible not to love. When you're around, people feel wrapped in something warm and good."
	},
	{
		id: P.ramy,
		image: "images/Ramy_Noodleton.png",
		name: "🍜 Ramy Noodleton",
		title: "The Chill Slurper",
		birthday: "19ᵗʰ Febuary",
		catchphrase: '"Just relax, go with the flow, and enjoy the slurp."',
		favouriteFood: "Curry Ramen",
		coreTraits: "Relaxed · Easygoing · Quietly cool · Comfort seeker · Go-with-flow",
		background: "Ramy Noodleton is the definition of chill. Always relaxed and enjoying noodle moments, they don't rush anything in life. Like a comforting ramen-curry fusion, they are smooth, soothing, and effortlessly likable.",
		description: "Relaxed, easygoing, and quietly cool — you go with the flow and never let life stress you out. You have a laid-back charm that draws people in. You know how to enjoy the moment without overcomplicating things."
	},
	{
		id: P.hotsizz,
		image: "images/Hot_Sizz.png",
		name: "🔥 Hot Sizz",
		title: "The Hotplate Performer",
		birthday: "5ᵗʰ April",
		catchphrase: '"Listen up, everyone! Let’s turn up the heat!"',
		favouriteFood: "Chicken Karaage Hotplate",
		coreTraits: "Energetic · Dramatic · Attention-grabbing · Passionate · Loud presence",
		background: "Hot Sizz arrives with a literal sizzle. Just like a hotplate curry, they are loud, exciting, and impossible to ignore. They love attention and always turn ordinary moments into performances.",
		description: "Energetic, dramatic, and passionate — you bring heat wherever you go. You thrive in the spotlight and have the kind of presence people can't look away from. Your intensity is magnetic, and life is never boring when you're in the room."
	},
	{
		id: P.teppa,
		image: "images/Teppa_Spark.png",
		name: "🍳 Teppa Spark",
		title: "The Precision Show Chef",
		birthday: "18ᵗʰ September",
		catchphrase: '"Cooking is an art. Watch closely."',
		favouriteFood: "Yaki Beef Curry",
		coreTraits: "Focused · Skillful · Stylish · Confident · Detail-oriented",
		background: "Teppa Spark is cool, sharp, and precise. Like teppanyaki cooking, everything they do feels like a performance of skill and control. They may seem calm, but their presence always leaves a lasting impression.",
		description: "Focused, skillful, and stylish — you do everything with intention and flair. You're the kind of person who makes hard things look effortless. Detail-oriented and quietly confident, your precision and cool-headedness make you someone people deeply respect."
	}
];
// Expose for the 'Check out other personalities' modal
window.CHARACTERS = personalities;
window.showResult = function (p) {
	updateQuizLogoProgress(questions.length);
	populateResult(p);
	const img = document.getElementById('result-illustration-img');
	if (img) { img.src = p.image; img.alt = p.name; }
	showScreen('result');
};

/* ---------------- UI ELEMENTS ---------------- */
const homeScreen = document.getElementById("home-screen");
const introScreen = document.getElementById("intro-screen");
const quizScreen = document.getElementById("quiz-screen");
const resultScreen = document.getElementById("result-screen");
const arTeaserScreen = document.getElementById("ar-teaser-screen");
const battleScreen = document.getElementById("battle-screen");

const startButton = document.getElementById("start-button");
const quizBackButton = document.getElementById("quiz-back-button");
const quizNextButton = document.getElementById("quiz-next-button");
const headerHomeButton = document.getElementById("header-home-button");
const personalityBackButton = document.getElementById("personality-back-button");
const resultHomeButton = document.getElementById("result-home-button");
const homeTestButton = document.getElementById("home-test-button");
const homeArButton = document.getElementById("home-ar-button");
const homeGameButton = document.getElementById("home-game-button");
const launchArButton = document.getElementById("launch-ar-button");
const arTeaserBackButton = document.getElementById("ar-teaser-back-button");
const quizLogoFillWrapper = document.getElementById("quiz-logo-fill-wrapper");
const quizQuestionCount = document.getElementById("quiz-question-count");
const questionPrompt = document.getElementById("question-prompt");
const optionList = document.getElementById("option-list");
const resultName = document.getElementById("result-name");
const resultCoreTraits = document.getElementById("result-core-traits");
const resultBackground = document.getElementById("result-background");
const resultDescription = document.getElementById("result-description");
const resultTraitCatchphrase = document.getElementById("result-trait-catchphrase");
const resultTraitBirthday = document.getElementById("result-trait-birthday");
const resultTraitFood = document.getElementById("result-trait-food");
const resultLearnMoreButton = document.getElementById("result-learn-more");
const resultMore = document.getElementById("result-more");
const resultShareButton = document.getElementById("result-share-button");
const battleEls = {
	codePanel: document.getElementById("battle-code-panel"),
	lobbyPanel: document.getElementById("battle-lobby-panel"),
	characterPanel: document.getElementById("battle-character-panel"),
	tutorialPanel: document.getElementById("battle-tutorial-panel"),
	movePanel: document.getElementById("battle-move-panel"),
	gameOverPanel: document.getElementById("battle-gameover-panel"),
	codeStatus: document.getElementById("battle-code-status"),
	manualCode: document.getElementById("battle-manual-code"),
	manualJoinButton: document.getElementById("battle-manual-join-button"),
	lobbyMessage: document.getElementById("battle-lobby-message"),
	lobbySlots: document.getElementById("battle-lobby-slots"),
	startSoloButton: document.getElementById("battle-start-solo-button"),
	characterGrid: document.getElementById("battle-character-grid"),
	selectedCharacter: document.getElementById("battle-selected-character"),
	selectedCharacterArt: document.getElementById("battle-selected-character-art"),
	selectedCharacterName: document.getElementById("battle-selected-character-name"),
	selectedCharacterTitle: document.getElementById("battle-selected-character-title"),
	selectedCharacterPlaystyle: document.getElementById("battle-selected-character-playstyle"),
	selectedCharacterStats: document.getElementById("battle-selected-character-stats"),
	selectedCharacterMoves: document.getElementById("battle-selected-character-moves"),
	confirmCharacterButton: document.getElementById("battle-confirm-character-button"),
	tutorialStatus: document.getElementById("battle-tutorial-status"),
	tutorialGotItButton: document.getElementById("battle-tutorial-gotit-button"),
	modeLabel: document.getElementById("battle-mode-label"),
	turnLabel: document.getElementById("battle-turn-label"),
	moveTitle: document.getElementById("battle-move-title"),
	teamStatus: document.getElementById("battle-team-status"),
	monsterName: document.getElementById("battle-monster-name"),
	monsterHpBar: document.getElementById("battle-monster-hp-bar"),
	monsterHpText: document.getElementById("battle-monster-hp-text"),
	moveGrid: document.getElementById("battle-move-grid"),
	effectsText: document.getElementById("battle-effects-text"),
	gameOverTitle: document.getElementById("battle-gameover-title"),
	gameOverMessage: document.getElementById("battle-gameover-message"),
	playAgainButton: document.getElementById("battle-play-again-button"),
	backButton: document.getElementById("battle-back-button"),
	characterWaitingOverlay: document.getElementById("battle-character-waiting-overlay"),
};

const battleReconnectBanner = document.getElementById("battle-reconnect-banner");

function showBattleReconnectBanner(message) {
	if (!battleReconnectBanner) return;
	battleReconnectBanner.textContent = message;
	battleReconnectBanner.classList.remove("hidden");
}

function hideBattleReconnectBanner() {
	battleReconnectBanner?.classList.add("hidden");
}

let battleTeammateCountdownInterval = null;
let battleTeammateCountdownValue = null;

function startTeammateDisconnectCountdown(teammateName) {
	if (battleTeammateCountdownInterval) return;
	battleTeammateCountdownValue = 10;
	showBattleReconnectBanner(`${teammateName} disconnected — the battle will end in ${battleTeammateCountdownValue} seconds if they don't reconnect.`);
	battleTeammateCountdownInterval = window.setInterval(() => {
		battleTeammateCountdownValue -= 1;
		if (battleTeammateCountdownValue < 0) {
			stopTeammateDisconnectCountdown();
			return;
		}
		showBattleReconnectBanner(`${teammateName} disconnected — the battle will end in ${battleTeammateCountdownValue} seconds if they don't reconnect.`);
	}, 1000);
}

function stopTeammateDisconnectCountdown() {
	window.clearInterval(battleTeammateCountdownInterval);
	battleTeammateCountdownInterval = null;
	battleTeammateCountdownValue = null;
}

/* ---------------- STATE ---------------- */
let currentQuestion = 0;
const answers = Array(questions.length).fill(null);

// Remembers which screen to return to when leaving the AR teaser via its Back
// button, so it works from either intro or result.
let screenBeforeArTeaser = "intro";
let screenBeforeBattle = "intro";

const BATTLE_MOVES = {
	"crispy-slash": { id: "crispy-slash", name: "Crispy Slash", description: "Deals 25 Power damage." },
	"heros-courage": { id: "heros-courage", name: "Hero's Courage", description: "Increase own Attack for 2 turns." },
	"comfort-meal": { id: "comfort-meal", name: "Comfort Meal", description: "Heal self for 20% HP." },
	"counter-guard": { id: "counter-guard", name: "Counter Guard", description: "Reduce damage and counter." },
	"vine-whip": { id: "vine-whip", name: "Vine Whip", description: "Deals 20 Power damage." },
	"sharing-feast": { id: "sharing-feast", name: "Sharing Feast", description: "Heal all allies." },
	"rally-together": { id: "rally-together", name: "Rally Together", description: "Boost all allies' Attack." },
	"tangling-vines": { id: "tangling-vines", name: "Tangling Vines", description: "Lower monster Attack." },
	"mega-chomp": { id: "mega-chomp", name: "Mega Chomp", description: "Deals 30 Power damage." },
	"devour": { id: "devour", name: "Devour", description: "Damage and recover HP." },
	"belly-shield": { id: "belly-shield", name: "Belly Shield", description: "Gain a large shield." },
	"hungry-challenge": { id: "hungry-challenge", name: "Hungry Challenge", description: "Taunt the monster." },
	"egg-toss": { id: "egg-toss", name: "Egg Toss", description: "Deals 15 Power damage." },
	"fluffy-hug": { id: "fluffy-hug", name: "Fluffy Hug", description: "Heal the weakest ally." },
	"sunny-side-up": { id: "sunny-side-up", name: "Sunny Side Up", description: "Remove ally debuffs." },
	"sweet-dreams": { id: "sweet-dreams", name: "Sweet Dreams", description: "Guard and regenerate." },
	"cheese-wheel": { id: "cheese-wheel", name: "Cheese Wheel", description: "Deals 20 Power damage." },
	"melted-cheese": { id: "melted-cheese", name: "Melted Cheese", description: "Shield the weakest ally." },
	"cover-up": { id: "cover-up", name: "Cover Up", description: "Cover an ally." },
	"comfort-feast": { id: "comfort-feast", name: "Comfort Feast", description: "Heal and guard all allies." },
	"noodle-strike": { id: "noodle-strike", name: "Noodle Strike", description: "Deals 25 Power damage." },
	"slurp-combo": { id: "slurp-combo", name: "Slurp Combo", description: "Attack twice." },
	"cold-broth": { id: "cold-broth", name: "Cold Broth", description: "Boost own Attack." },
	"finishing-slurp": { id: "finishing-slurp", name: "Finishing Slurp", description: "Big finishing hit." },
	"sizzling-plate": { id: "sizzling-plate", name: "Sizzling Plate", description: "Deals 35 Power damage." },
	"flame-burst": { id: "flame-burst", name: "Flame Burst", description: "Damage and burn." },
	"heat-up": { id: "heat-up", name: "Heat Up", description: "Boost own Attack." },
	"grand-performance": { id: "grand-performance", name: "Grand Performance", description: "Huge damage, then Defense down." },
	"precision-skewer": { id: "precision-skewer", name: "Precision Skewer", description: "Deals 28 Power damage." },
	"spark-plate": { id: "spark-plate", name: "Spark Plate", description: "Damage and lower monster Attack." },
	"focus-flambe": { id: "focus-flambe", name: "Focus Flambe", description: "Boost own Attack." },
	"final-showpiece": { id: "final-showpiece", name: "Final Showpiece", description: "Damage and gain shield." }
};

const BATTLE_CHARACTERS = [
	{ id: "katsu-chan", quizId: "katsu", name: "Katsu-Chan", title: "The Classic Comfort Hero", playstyle: "Balanced all-rounder with an answer for every turn.", maxHp: 1100, atk: 90, image: "images/Katsu-Chan.png", screenAsset: "./assets/characters/katsu-chan.png", moves: ["crispy-slash", "heros-courage", "comfort-meal", "counter-guard"] },
	{ id: "monstora-sharemi", quizId: "monstora", name: "Monstora Sharemi", title: "The Social Feast Buddy", playstyle: "Team support who heals, buffs, and weakens foes.", maxHp: 900, atk: 70, image: "images/Monstora_Sharemi.png", screenAsset: "./assets/characters/monstora-sharemi.png", moves: ["vine-whip", "sharing-feast", "rally-together", "tangling-vines"] },
	{ id: "giga-nomu", quizId: "giga", name: "Giga Nomu", title: "The Big Appetite Beast", playstyle: "Tough tank who taunts, shields, and heals by attacking.", maxHp: 1500, atk: 80, image: "images/Giga_Nomu.png", screenAsset: "./assets/characters/giga-nomu.png", moves: ["mega-chomp", "devour", "belly-shield", "hungry-challenge"] },
	{ id: "tamago-puffy", quizId: "tamago", name: "Tamago Puffy", title: "The Soft & Cozy Dreamer", playstyle: "Pure healer who cleanses and protects wounded allies.", maxHp: 950, atk: 60, image: "images/Tamago_Puffy.png", screenAsset: "./assets/characters/tamago-puffy.png", moves: ["egg-toss", "fluffy-hug", "sunny-side-up", "sweet-dreams"] },
	{ id: "cheezu-mellow", quizId: "cheezu", name: "Cheezu Mellow", title: "The Cheesy Comfort Lover", playstyle: "Team guardian who shields, covers, and heals allies.", maxHp: 1200, atk: 80, image: "images/Cheezu_Mellow.png", screenAsset: "./assets/characters/cheezu-mellow.png", moves: ["cheese-wheel", "melted-cheese", "cover-up", "comfort-feast"] },
	{ id: "ramy-noodleton", quizId: "ramy", name: "Ramy Noodleton", title: "The Chill Slurper", playstyle: "Combo finisher who punishes weakened monsters.", maxHp: 850, atk: 120, image: "images/Ramy_Noodleton.png", screenAsset: "./assets/characters/ramy-noodleton.png", moves: ["noodle-strike", "slurp-combo", "cold-broth", "finishing-slurp"] },
	{ id: "hot-sizz", quizId: "hotsizz", name: "Hot Sizz", title: "The Hotplate Performer", playstyle: "Glass cannon with explosive damage but fragile defense.", maxHp: 850, atk: 140, image: "images/Hot_Sizz.png", screenAsset: "./assets/characters/hot-sizz.png", moves: ["sizzling-plate", "flame-burst", "heat-up", "grand-performance"] },
	{ id: "teppa-spark", quizId: "teppa", name: "Teppa Spark", title: "The Precision Show Chef", playstyle: "Versatile tactician with damage, debuffs, and shields.", maxHp: 1000, atk: 100, image: "images/Teppa_Spark.png", screenAsset: "./assets/characters/teppa-spark.png", moves: ["precision-skewer", "spark-plate", "focus-flambe", "final-showpiece"] }
];

const BATTLE_LEVELS = {
	solo: [
		{ name: "Curry Goblin", maxHp: 500, atk: 70, color: "#657d2f", accent: "#f5ad0f", asset: "./assets/enemies/curry-goblin.webp", moves: ["sauce-swipe", "curry-splash"] },
		{ name: "Root Curry Brute", maxHp: 700, atk: 78, color: "#a9601d", accent: "#8cad2d", asset: "./assets/enemies/root-curry-brute.webp", moves: ["root-bash", "gravy-snare"] },
		{ name: "Sporeback Brute", maxHp: 900, atk: 86, color: "#557329", accent: "#c7b274", asset: "./assets/enemies/sporeback-brute.webp", moves: ["spore-punch", "mushroom-haze", "fungal-guard"] },
	],
	multiplayer: [
		{ name: "Curry Goblin", maxHp: 1400, atk: 82, color: "#657d2f", accent: "#f5ad0f", asset: "./assets/enemies/curry-goblin.webp", moves: ["sauce-swipe", "curry-splash", "curry-cloud"] },
		{ name: "Root Curry Brute", maxHp: 1780, atk: 92, color: "#a9601d", accent: "#8cad2d", asset: "./assets/enemies/root-curry-brute.webp", moves: ["root-bash", "gravy-snare", "root-guard"] },
		{ name: "Sporeback Brute", maxHp: 2180, atk: 102, color: "#557329", accent: "#c7b274", asset: "./assets/enemies/sporeback-brute.webp", moves: ["spore-punch", "mushroom-haze", "fungal-guard"] },
	]
};

// Set by setupShare() below.
let shareGate = null;

let battleGameId = null;
let battlePlayerId = null;
let battleSessionRef = null;
let battleUnsubscribe = null;
let battleState = null;
let battleSelectedCharacterId = null;

/* ---------------- HELPERS ---------------- */
const SCREENS = {
	home: homeScreen,
	intro: introScreen,
	quiz: quizScreen,
	result: resultScreen,
	"ar-teaser": arTeaserScreen,
	battle: battleScreen
};

function showScreen(name) {
	Object.values(SCREENS).forEach(el => {
		if (!el) return;
		el.style.display = "none";
		el.classList.add("hidden");
	});
	const active = SCREENS[name] || introScreen;
	active.style.display = "flex";
	active.classList.remove("hidden");
	window.scrollTo({ top: 0, behavior: "smooth" });

	if (headerHomeButton) {
		headerHomeButton.style.display = name === "home" ? "none" : "inline-flex";
	}
}

function goHome() {
	resetQuiz();
	resetFeedback();
	showScreen("home");
}

function openArTeaser(fromScreen) {
	screenBeforeArTeaser = fromScreen;
	showScreen("ar-teaser");
}

function closeArTeaser() {
	showScreen(screenBeforeArTeaser);
}

function openBattleScreen(fromScreen) {
	screenBeforeBattle = fromScreen;
	showScreen("battle");
	renderBattleCharacters();
	if (battleState) {
		renderBattleState(battleState);
	} else {
		attemptBattleReconnect();
	}
}

function closeBattleScreen() {
	if (battleEls.manualCode) battleEls.manualCode.value = "";
	showScreen(screenBeforeBattle);
}

function sanitizeBattleGameId(value) {
	if (!value) return null;
	const clean = String(value).trim();
	return /^\d{4}$/.test(clean) ? clean : null;
}

function getBattleGameIdFromValue(value) {
	return sanitizeBattleGameId(value);
}

function getBattlePlayerId(gameId) {
	const key = `storefront-player:${gameId}`;
	const stored = window.localStorage.getItem(key);
	if (stored) return stored;
	const generated = window.crypto?.randomUUID
		? window.crypto.randomUUID()
		: `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	window.localStorage.setItem(key, generated);
	return generated;
}

function battleEffects() {
	return {
		attackUpPct: 0,
		attackUpTurns: 0,
		attackDownPct: 0,
		attackDownTurns: 0,
		damageReductionPct: 0,
		damageReductionTurns: 0,
		defenseDownPct: 0,
		defenseDownTurns: 0,
		regenPct: 0,
		regenTurns: 0,
		burnPct: 0,
		burnTurns: 0,
		counterPower: 0,
		coverForId: null,
		tauntTurns: 0
	};
}

function buildBattlePlayer(characterId, playerId, slot = 0) {
	const character = BATTLE_CHARACTERS.find(c => c.id === characterId) || BATTLE_CHARACTERS[0];
	return {
		id: playerId,
		slot,
		characterId: character.id,
		name: character.name,
		title: character.title,
		maxHp: character.maxHp,
		hp: character.maxHp,
		atk: character.atk,
		shield: 0,
		color: "#ed1d24",
		accent: "#f5ad0f",
		asset: character.screenAsset,
		moves: character.moves,
		effects: battleEffects()
	};
}

function buildBattleMonster(mode = "solo", levelIndex = 0) {
	const levels = BATTLE_LEVELS[mode] || BATTLE_LEVELS.solo;
	const level = levels[Math.min(Math.max(levelIndex, 0), levels.length - 1)];
	return {
		id: `monster-${mode}-${levelIndex + 1}`,
		name: level.name,
		title: mode === "multiplayer" ? "Co-op challenge" : "Solo challenge",
		maxHp: level.maxHp,
		hp: level.maxHp,
		atk: level.atk,
		shield: 0,
		color: level.color || "#1d6e58",
		accent: level.accent || "#f5ad0f",
		asset: level.asset || "./assets/monster-curry-beast.svg",
		moves: level.moves,
		effects: battleEffects()
	};
}

function battleHpPercent(fighter) {
	if (!fighter?.maxHp) return 0;
	return Math.max(0, Math.min(100, Math.round((Number(fighter.hp || 0) / Number(fighter.maxHp)) * 100)));
}

function battleOrderedPlayers(state) {
	const players = state?.players || {};
	const order = Array.isArray(state?.playerOrder) ? state.playerOrder : Object.keys(players);
	return order.map(id => players[id]).filter(Boolean).sort((a, b) => Number(a.slot || 0) - Number(b.slot || 0));
}

function battleLobbyEntries(state) {
	return Object.values(state?.lobby || {}).sort((a, b) => Number(a.slot || 0) - Number(b.slot || 0));
}

function showBattlePanel(name) {
	const panels = {
		code: battleEls.codePanel,
		lobby: battleEls.lobbyPanel,
		character: battleEls.characterPanel,
		tutorial: battleEls.tutorialPanel,
		move: battleEls.movePanel,
		gameOver: battleEls.gameOverPanel
	};
	Object.entries(panels).forEach(([panelName, panel]) => {
		if (!panel) return;
		panel.classList.toggle("hidden", panelName !== name);
	});
}

function battleEffectText(fighter) {
	const effects = fighter?.effects || {};
	const parts = [];
	if (fighter?.shield > 0) parts.push(`Shield ${fighter.shield}`);
	if (effects.attackUpTurns > 0) parts.push("Attack up");
	if (effects.attackDownTurns > 0) parts.push("Attack down");
	if (effects.damageReductionTurns > 0) parts.push("Guarded");
	if (effects.defenseDownTurns > 0) parts.push("Defense down");
	if (effects.regenTurns > 0) parts.push("Regenerating");
	if (effects.burnTurns > 0) parts.push("Burning");
	if (effects.tauntTurns > 0) parts.push("Taunting");
	return parts.join(" / ") || "No active effects.";
}

function renderBattleCharacters() {
	if (!battleEls.characterGrid || battleEls.characterGrid.dataset.ready === "true") return;
	battleEls.characterGrid.innerHTML = "";
	BATTLE_CHARACTERS.forEach(character => {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "battle-character-card";
		button.dataset.characterId = character.id;
		button.setAttribute("aria-pressed", String(character.id === battleSelectedCharacterId));
		button.innerHTML = `
			<img src="${character.image}" alt="" aria-hidden="true">
			<span>${character.title}</span>
			<strong>${character.name}</strong>
			<span class="battle-character-playstyle">${character.playstyle}</span>
			<small>HP ${character.maxHp} / ATK ${character.atk}</small>
		`;
		button.addEventListener("click", () => selectBattleCharacter(character.id, true));
		battleEls.characterGrid.appendChild(button);
	});
	battleEls.characterGrid.dataset.ready = "true";
}

function selectBattleCharacter(characterId, revealSelection = false) {
	battleSelectedCharacterId = characterId;
	const character = BATTLE_CHARACTERS.find(c => c.id === characterId);
	if (!character || !battleEls.selectedCharacter) return;
	battleEls.selectedCharacter.classList.remove("hidden");
	battleEls.selectedCharacterArt.src = character.image;
	battleEls.selectedCharacterArt.alt = character.name;
	battleEls.selectedCharacterName.textContent = character.name;
	battleEls.selectedCharacterTitle.textContent = character.title;
	battleEls.selectedCharacterPlaystyle.textContent = character.playstyle;
	battleEls.selectedCharacterStats.textContent = `HP ${character.maxHp} / Attack ${character.atk}`;
	battleEls.selectedCharacterMoves.textContent = character.moves.map(moveId => BATTLE_MOVES[moveId]?.name || moveId).join(", ");
	battleEls.characterGrid?.querySelectorAll(".battle-character-card").forEach(card => {
		card.setAttribute("aria-pressed", String(card.dataset.characterId === character.id));
	});
	if (revealSelection && window.matchMedia("(max-width: 899px)").matches) {
		requestAnimationFrame(() => {
			battleEls.selectedCharacter.scrollIntoView({ behavior: "smooth", block: "center" });
		});
	}
}

function renderBattleLobby(state) {
	showBattlePanel("lobby");
	const entries = battleLobbyEntries(state);
	const isInLobby = entries.some(entry => entry.id === battlePlayerId);
	battleEls.lobbySlots.innerHTML = "";
	[0, 1].forEach(slot => {
		const entry = entries.find(item => Number(item.slot) === slot);
		const node = document.createElement("div");
		node.className = `battle-lobby-slot ${entry ? "filled" : ""}`;
		node.innerHTML = `<span>Player ${slot + 1}</span><strong>${entry ? entry.label || "Joined" : "Open"}</strong>`;
		battleEls.lobbySlots.appendChild(node);
	});
	battleEls.lobbyMessage.textContent = isInLobby
		? "You are in. Start alone now, or wait for another player to enter the code."
		: "This battle lobby is full. Please wait for the next reset.";
	battleEls.startSoloButton.disabled = !isInLobby;
}

function renderBattleCharacterSelect(state) {
	showBattlePanel("character");
	const entry = state?.lobby?.[battlePlayerId];
	battleSelectedCharacterId = entry?.characterId || battleSelectedCharacterId;
	if (battleSelectedCharacterId) {
		selectBattleCharacter(battleSelectedCharacterId);
	} else if (battleEls.selectedCharacter) {
		battleEls.selectedCharacter.classList.add("hidden");
	}

	const hasConfirmed = Boolean(entry?.confirmed);
	battleEls.characterWaitingOverlay?.classList.toggle("hidden", !hasConfirmed);
	battleEls.characterGrid?.querySelectorAll(".battle-character-card").forEach(card => {
		card.disabled = hasConfirmed;
	});
	if (battleEls.confirmCharacterButton) {
		battleEls.confirmCharacterButton.disabled = hasConfirmed;
	}
}

function renderBattleTeam(players) {
	battleEls.teamStatus.innerHTML = "";
	players.forEach(player => {
		const character = BATTLE_CHARACTERS.find(c => c.id === player.characterId);
		const node = document.createElement("article");
		node.className = `battle-fighter-strip ${player.id === battlePlayerId ? "self" : ""}`;
		node.innerHTML = `
			<img src="${character?.image || ""}" alt="${player.name}">
			<div>
				<span>${player.id === battlePlayerId ? "You" : `Player ${Number(player.slot || 0) + 1}`}</span>
				<strong>${player.name}</strong>
				<div class="battle-hp-track"><div style="width:${battleHpPercent(player)}%"></div></div>
				<small>${player.hp}/${player.maxHp} HP</small>
			</div>
		`;
		battleEls.teamStatus.appendChild(node);
	});
}

function renderBattleMoveButtons(state, self) {
	const locked = state.status !== "battle" || Boolean(state.pendingMoves?.[battlePlayerId]) || self.hp <= 0;
	battleEls.moveGrid.innerHTML = "";
	self.moves.forEach(moveId => {
		const move = BATTLE_MOVES[moveId] || { id: moveId, name: moveId, description: "" };
		const button = document.createElement("button");
		button.type = "button";
		button.className = "battle-move-button";
		const selectedMoveId = state.pendingMoves?.[battlePlayerId]?.moveId || state.activeMoves?.[battlePlayerId]?.moveId || null;
		if (selectedMoveId === move.id) {
			button.classList.add('chosen');
		}
		button.disabled = locked;
		button.innerHTML = `<strong>${move.name}</strong><span>${move.description}</span>`;
		button.addEventListener("click", () => submitBattleMove(move.id));
		battleEls.moveGrid.appendChild(button);
	});
}

function renderBattleMoveState(state) {
	const players = battleOrderedPlayers(state);
	const self = state.players?.[battlePlayerId];
	if (!self) {
		showBattlePanel("code");
		battleEls.codeStatus.textContent = "This battle already has its players.";
		return;
	}
	showBattlePanel("move");
	renderBattleTeam(players);

	// Detect a disconnected teammate in multiplayer.
	const presence = state.presence || {};
	const teammate = players.find(player => player.id !== battlePlayerId);
	const teammateDisconnected = Boolean(teammate) && presence[teammate.id] !== true;
	if (teammateDisconnected) {
		startTeammateDisconnectCountdown(teammate.name);
	} else {
		stopTeammateDisconnectCountdown();
		hideBattleReconnectBanner();
	}

	battleEls.modeLabel.textContent = state.mode === "multiplayer" ? "Co-op Mode" : "Solo Mode";
	battleEls.turnLabel.textContent = `Turn ${state.turn || 1}`;
	battleEls.monsterName.textContent = state.monster?.name || "Monster";
	battleEls.monsterHpBar.style.width = `${battleHpPercent(state.monster)}%`;
	battleEls.monsterHpText.textContent = `${state.monster?.hp || 0} / ${state.monster?.maxHp || 0}`;
	if (state.status === "resolving") {
		battleEls.moveTitle.textContent = "Resolving";
		battleEls.effectsText.textContent = "Watch the big screen.";
	} else if (state.status === "level-complete") {
		battleEls.moveTitle.textContent = "Level cleared";
		battleEls.effectsText.textContent = "The next monster is coming.";
	} else if (state.pendingMoves?.[battlePlayerId]) {
		battleEls.moveTitle.textContent = "Move sent";
		battleEls.effectsText.textContent = "Locked in. Wait for the other player or watch the big screen.";
	} else if (self.hp <= 0) {
		battleEls.moveTitle.textContent = "You are down";
		battleEls.effectsText.textContent = "Your teammate may still finish the fight.";
	} else {
		battleEls.moveTitle.textContent = "Choose Your Move!";
		battleEls.effectsText.textContent = `${battleEffectText(self)} Monster: ${battleEffectText(state.monster)}`;
	}
	renderBattleMoveButtons(state, self);
}

function renderBattleGameOver(state) {
	showBattlePanel("gameOver");
	const playersWon = state.winner === "players";
	const totalLevels = (BATTLE_LEVELS[state.mode] || BATTLE_LEVELS.solo).length;
	battleEls.gameOverTitle.textContent = playersWon ? "You won!" : "You lost";
	battleEls.gameOverMessage.textContent = playersWon
		? `Your curry party cleared all ${totalLevels} levels.`
		: "The monster won. Try a different character combination.";
}

function renderBattleTutorial(state) {
	showBattlePanel("tutorial");
	const acks = state.tutorialAcks || {};
	const selfAcked = Boolean(acks[battlePlayerId]);
	const players = battleOrderedPlayers(state);
	const waitingOn = players.filter(player => player.id !== battlePlayerId && !acks[player.id]);

	battleEls.tutorialGotItButton.disabled = selfAcked;
	battleEls.tutorialGotItButton.textContent = selfAcked ? "Waiting..." : "Got It!";
	battleEls.tutorialStatus.textContent = selfAcked
		? (waitingOn.length ? `Waiting for ${waitingOn.map(p => p.name).join(", ")}...` : "Starting battle...")
		: "Look up at the big screen for a quick tutorial!";
}

function renderBattleState(state) {
	battleState = state;
	if (!battleGameId) {
		stopTeammateDisconnectCountdown();
		hideBattleReconnectBanner();
		showBattlePanel("code");
		return;
	}
	if (!state || state.status === "closed") {
		stopTeammateDisconnectCountdown();
		hideBattleReconnectBanner();
		showBattlePanel("code");
		battleEls.codeStatus.textContent = "That code has expired. Enter the new code shown on the big screen.";
		return;
	}
	if (state.status === "attract" || state.status === "lobby") {
		renderBattleLobby(state);
		return;
	}
	if (state.status === "character-select") {
		if (!state.lobby?.[battlePlayerId]) {
			showBattlePanel("code");
			battleEls.codeStatus.textContent = "This battle lobby is full.";
			return;
		}
		renderBattleCharacterSelect(state);
		return;
	}
	if (["battle", "resolving", "level-complete"].includes(state.status)) {
		if (state.showTutorial) {
			renderBattleTutorial(state);
			return;
		}
		renderBattleMoveState(state);
		return;
	}
	if (state.status === "game-over") {
		renderBattleGameOver(state);
		return;
	}
	showBattlePanel("code");
}

function findBattleOpenSlot(state) {
	const usedSlots = new Set(battleLobbyEntries(state).map(entry => Number(entry.slot)));
	return [0, 1].find(slot => !usedSlots.has(slot));
}

async function getBattleSession() {
	const snapshot = await get(battleSessionRef);
	return snapshot.exists() ? snapshot.val() : null;
}

async function joinBattleLobby(initialState = null) {
	const state = initialState || await getBattleSession();
	if (!state || ["closed", "game-over"].includes(state.status)) {
		showBattlePanel("code");
		battleEls.codeStatus.textContent = "That code is no longer active. Enter the new code shown on the big screen.";
		return;
	}
	if (["battle", "resolving", "level-complete"].includes(state.status)) {
		renderBattleState(state);
		return;
	}
	const existing = state.lobby?.[battlePlayerId];
	const slot = existing ? Number(existing.slot) : findBattleOpenSlot(state);
	if (slot === undefined) {
		battleEls.codeStatus.textContent = "This battle lobby is full.";
		return;
	}
	const nextLobby = {
		...(state.lobby || {}),
		[battlePlayerId]: {
			id: battlePlayerId,
			slot,
			label: `Player ${slot + 1}`,
			joinedAt: Date.now(),
			characterId: existing?.characterId || null,
			confirmed: Boolean(existing?.confirmed)
		}
	};
	const joinedCount = Object.keys(nextLobby).length;
	await update(battleSessionRef, {
		status: joinedCount >= 2 ? "character-select" : "lobby",
		mode: joinedCount >= 2 ? "multiplayer" : state.mode || null,
		lobby: nextLobby,
		lastActionAt: serverTimestamp()
	});
}

let battleHiddenTimer = null;
const BATTLE_HIDDEN_MARK_AWAY_MS = 10000; // 10s of being backgrounded before marking away

function handleBattleVisibilityChange() {
	if (!battlePresenceRef) return;

	if (document.hidden) {
		if (battleHiddenTimer) return;
		battleHiddenTimer = window.setTimeout(async () => {
			battleHiddenTimer = null;
			if (await battleSessionStillExists()) {
				set(battlePresenceRef, false).catch(() => { });
			}
		}, BATTLE_HIDDEN_MARK_AWAY_MS);
	} else {
		window.clearTimeout(battleHiddenTimer);
		battleHiddenTimer = null;
		markBattlePresent();
	}
}

async function battleSessionStillExists() {
	if (!battleSessionRef) return false;
	try {
		const snapshot = await get(battleSessionRef);
		const state = snapshot.exists() ? snapshot.val() : null;
		return Boolean(state) && !["closed", "game-over"].includes(state.status);
	} catch (error) {
		console.error("Could not check session", error);
		return false;
	}
}

async function markBattlePresent() {
	if (!battlePresenceRef) return;

	const stillActive = await battleSessionStillExists();
	if (!stillActive) {
		battlePresenceRef = null;
		window.localStorage.removeItem("storefront-last-game");
		stopTeammateDisconnectCountdown();
		hideBattleReconnectBanner();
		showBattlePanel("code");
		battleEls.codeStatus.textContent = "Your last game has ended. Enter the code shown on the big screen.";
		return;
	}

	set(battlePresenceRef, true).catch(() => { });
}

document.addEventListener("visibilitychange", handleBattleVisibilityChange);

let battlePresenceRef = null;
let battleConnectedUnsubscribe = null;

function setupBattlePresence() {
	if (battleConnectedUnsubscribe) {
		battleConnectedUnsubscribe();
		battleConnectedUnsubscribe = null;
	}
	if (!battleSessionRef || !battlePlayerId) return;

	battlePresenceRef = ref(storefrontDb, `sessions/${battleGameId}/presence/${battlePlayerId}`);
	const connectedRef = ref(storefrontDb, ".info/connected");
	battleConnectedUnsubscribe = onValue(connectedRef, (snapshot) => {
		if (snapshot.val() !== true) return;
		onDisconnect(battlePresenceRef).remove().then(() => {
			markBattlePresent();
		});
	});
}

async function attemptBattleReconnect() {
	const storedGameId = sanitizeBattleGameId(window.localStorage.getItem("storefront-last-game"));
	if (!storedGameId) {
		hideBattleReconnectBanner();
		showBattlePanel("code");
		return;
	}

	showBattlePanel("code");
	battleEls.codeStatus.textContent = "Reconnecting to your last game...";

	await firebaseReady;
	if (!firebaseAvailable) {
		battleEls.codeStatus.textContent = "Couldn't reconnect (connection blocked). Enter the code shown on the big screen.";
		return;
	}

	try {
		const snapshot = await get(ref(storefrontDb, `sessions/${storedGameId}`));
		const state = snapshot.val();
		const stillActive = state && !["closed", "game-over"].includes(state.status);

		if (!stillActive) {
			stopTeammateDisconnectCountdown();
			hideBattleReconnectBanner();
			window.localStorage.removeItem("storefront-last-game");
			battleEls.codeStatus.textContent = "Your last game has ended. Enter the code shown on the big screen.";
			return;
		}

		showBattleReconnectBanner("You were disconnected from your last game — reconnecting you now.");
		await connectBattleGame(storedGameId);
	} catch (error) {
		console.error(error);
		battleEls.codeStatus.textContent = "Couldn't reconnect. Enter the code shown on the big screen.";
	}
}

async function connectBattleGame(gameId) {
	const cleanGameId = sanitizeBattleGameId(gameId);
	if (!cleanGameId) {
		battleEls.codeStatus.textContent = "Enter the four-digit code shown on the big screen.";
		return;
	}

	await firebaseReady;
	if (!firebaseAvailable) {
		battleEls.codeStatus.textContent = "Battle mode couldn't connect (a browser or ad blocker may be blocking it). Try disabling content blockers for this site.";
		return;
	}

	const nextSessionRef = ref(storefrontDb, `sessions/${cleanGameId}`);
	const snapshot = await get(nextSessionRef);
	const state = snapshot.val();
	if (!state || ["closed", "game-over"].includes(state.status)) {
		showBattlePanel("code");
		battleEls.codeStatus.textContent = "That code is not active. Check the big screen and try again.";
		return;
	}

	battleGameId = cleanGameId;
	battlePlayerId = getBattlePlayerId(battleGameId);
	battleSessionRef = nextSessionRef;
	setupBattlePresence();
	window.localStorage.setItem("storefront-last-game", battleGameId);
	if (battleUnsubscribe) battleUnsubscribe();
	battleUnsubscribe = onValue(battleSessionRef, snapshot => {
		renderBattleState(snapshot.val());
	}, error => {
		console.error(error);
		showBattlePanel("code");
		battleEls.codeStatus.textContent = "Firebase connection failed.";
	});
	await joinBattleLobby(state);
}

async function startBattleSolo() {
	if (!battleSessionRef || !battlePlayerId) return;
	const snapshot = await get(battleSessionRef);
	const state = snapshot.val();
	if (!state?.lobby?.[battlePlayerId]) return;
	await update(battleSessionRef, {
		status: "character-select",
		mode: "solo",
		lobby: {
			[battlePlayerId]: {
				...state.lobby[battlePlayerId],
				slot: 0
			}
		},
		lastActionAt: serverTimestamp()
	});
}

async function confirmBattleCharacter() {
	if (!battleSessionRef || !battleSelectedCharacterId) return;
	const snapshot = await get(battleSessionRef);
	const state = snapshot.val();
	const ownEntry = state?.lobby?.[battlePlayerId];
	if (!ownEntry || state.status !== "character-select" || ownEntry.confirmed) return;
	const nextLobby = {
		...(state.lobby || {}),
		[battlePlayerId]: {
			...ownEntry,
			characterId: battleSelectedCharacterId,
			confirmed: true
		}
	};
	const entries = Object.values(nextLobby);
	const expectedCount = state.mode === "multiplayer" ? 2 : 1;
	const readyEntries = entries
		.filter(entry => entry.confirmed && entry.characterId)
		.sort((a, b) => Number(a.slot || 0) - Number(b.slot || 0))
		.slice(0, expectedCount);
	if (readyEntries.length < expectedCount) {
		await update(battleSessionRef, { lobby: nextLobby, lastActionAt: serverTimestamp() });
		return;
	}
	const players = Object.fromEntries(readyEntries.map((entry, index) => {
		const player = buildBattlePlayer(entry.characterId, entry.id, index);
		return [entry.id, player];
	}));
	const playerOrder = readyEntries.map(entry => entry.id);
	const monster = buildBattleMonster(state.mode, 0);
	const log = [
		`${readyEntries.length === 2 ? "Two players" : "One player"} entered ${state.mode === "multiplayer" ? "co-op" : "solo"} mode.`,
		`${monster.name} enters the battle.`
	];
	await update(battleSessionRef, {
		status: "battle",
		lobby: nextLobby,
		activePlayerIds: playerOrder,
		playerOrder,
		players,
		monster,
		levelIndex: 0,
		turn: 1,
		pendingMoves: {},
		activeMoves: {},
		roundResult: { messages: log, createdAt: Date.now() },
		winner: null,
		log,
		showTutorial: true,
		tutorialAcks: {},
		battleStartedAt: serverTimestamp(),
		lastActionAt: serverTimestamp()
	});
}

async function submitBattleMove(moveId) {
	if (!battleSessionRef) return;
	const snapshot = await get(battleSessionRef);
	const state = snapshot.val();
	if (!state || state.status !== "battle" || !state.players?.[battlePlayerId] || state.pendingMoves?.[battlePlayerId]) return;
	const token = `${battlePlayerId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	await update(battleSessionRef, {
		[`pendingMoves/${battlePlayerId}`]: {
			moveId,
			playerId: battlePlayerId,
			token,
			createdAt: serverTimestamp()
		},
		lastActionAt: serverTimestamp()
	});
}

async function acknowledgeBattleTutorial() {
	if (!battleSessionRef || !battlePlayerId) return;
	await update(battleSessionRef, {
		[`tutorialAcks/${battlePlayerId}`]: true,
		lastActionAt: serverTimestamp()
	});
}

function playBattleAgain() {
	hideBattleReconnectBanner();
	if (battleUnsubscribe) {
		battleUnsubscribe();
		battleUnsubscribe = null;
	}
	battleGameId = null;
	battlePlayerId = null;
	battleSessionRef = null;
	battleState = null;
	battleSelectedCharacterId = null;
	battleEls.manualCode.value = "";
	showBattlePanel("code");
	battleEls.codeStatus.textContent = "Look at the big screen and enter its new four-digit code.";
}

function joinBattleFromManualInput() {
	hideBattleReconnectBanner();
	const gameId = getBattleGameIdFromValue(battleEls.manualCode?.value || "");
	if (!gameId) {
		battleEls.codeStatus.textContent = "Enter the game code shown on the big screen.";
		return;
	}
	connectBattleGame(gameId).catch(err => {
		console.error(err);
		battleEls.codeStatus.textContent = "Could not join that game.";
	});
}

function updateQuizLogoProgress(answeredCount) {
	if (!quizLogoFillWrapper) return;
	const pct = Math.max(0, Math.min(100, (answeredCount / questions.length) * 100));
	quizLogoFillWrapper.style.height = `${pct}%`;
	const noMask = pct >= 100 ? "none" : "";
	quizLogoFillWrapper.style.webkitMaskImage = noMask;
	quizLogoFillWrapper.style.maskImage = noMask;
}

function updateQuizQuestionCount(questionIndex) {
	if (!quizQuestionCount) return;
	const questionNumber = Math.max(1, Math.min(questions.length, Number(questionIndex) + 1));
	quizQuestionCount.textContent = `${questionNumber}/${questions.length}`;
	quizQuestionCount.setAttribute("aria-label", `Question ${questionNumber} of ${questions.length}`);
}

function resetQuiz() {
	currentQuestion = 0;
	answers.fill(null);
	updateQuizLogoProgress(0);
	updateQuizQuestionCount(0);
}

function populateResult(personality) {
	const displayName = personality.name.replace(/\p{Emoji_Presentation}\s*/gu, "").trim();
	resultName.textContent = displayName;
	document.getElementById("result-title").textContent = personality.title;
	resultTraitCatchphrase.textContent = personality.catchphrase;
	resultTraitBirthday.textContent = personality.birthday;
	resultTraitFood.textContent = personality.favouriteFood;
	resultCoreTraits.textContent = personality.coreTraits;
	resultBackground.textContent = personality.background;
	resultDescription.textContent = personality.description;
	resultMore.hidden = true;
	resultLearnMoreButton.textContent = "Learn more →";
	resultLearnMoreButton.setAttribute("aria-expanded", "false");
}

/* ---------------- QUIZ ---------------- */
function renderQuestion() {
	const q = questions[currentQuestion];
	updateQuizLogoProgress(currentQuestion);
	updateQuizQuestionCount(currentQuestion);
	if (quizBackButton) {
		quizBackButton.hidden = currentQuestion === 0;
		quizBackButton.setAttribute("aria-label", "Previous question");
	}
	if (quizNextButton) {
		quizNextButton.hidden = currentQuestion === questions.length - 1;
		quizNextButton.disabled = answers[currentQuestion] === null;
		quizNextButton.innerHTML = currentQuestion === questions.length - 1
			? 'Finish <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>'
			: 'Next <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>';
	}
	questionPrompt.textContent = q.prompt;
	optionList.innerHTML = "";

	q.options.forEach((opt, i) => {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = "option-button";
		btn.classList.toggle("selected", answers[currentQuestion] === i);
		btn.setAttribute("aria-pressed", String(answers[currentQuestion] === i));
		btn.textContent = opt.text;
		btn.onclick = () => {
			// Visual feedback: add .selected (iOS-safe alternative to :active)
			optionList.querySelectorAll('.option-button').forEach(b => {
				b.classList.remove('selected');
				b.setAttribute('aria-pressed', 'false');
			});
			btn.classList.add('selected');
			btn.setAttribute('aria-pressed', 'true');
			answers[currentQuestion] = i;
			if (quizNextButton) quizNextButton.disabled = false;
			if (currentQuestion < questions.length - 1) {
				currentQuestion++;
				renderQuestion();
			} else {
				renderResult();
			}
		};
		optionList.appendChild(btn);
	});
}

function getPersonality() {
	const tally = {};
	personalities.forEach(p => tally[p.id] = 0);
	answers.forEach((ansIdx, qIdx) => {
		if (ansIdx === null) return;
		Object.entries(questions[qIdx].options[ansIdx].scores).forEach(([id, pts]) => {
			if (tally[id] !== undefined) tally[id] += pts;
		});
	});
	return personalities.reduce((best, p) => tally[p.id] > tally[best.id] ? p : best, personalities[0]);
}

function renderResult() {
	const p = getPersonality();
	updateQuizLogoProgress(questions.length);
	populateResult(p);
	const img = document.getElementById("result-illustration-img");
	if (img) { img.src = p.image; img.alt = p.name; }
	showScreen("result");
}

/* ---------------- EVENTS ---------------- */
startButton.onclick = () => { resetQuiz(); showScreen("quiz"); renderQuestion(); };

quizBackButton.onclick = () => {
	if (currentQuestion === 0) {
		resetQuiz();
		showScreen("intro");
	} else {
		currentQuestion--;
		renderQuestion();
	}
};

quizNextButton.onclick = () => {
	if (answers[currentQuestion] === null) return;
	if (currentQuestion < questions.length - 1) {
		currentQuestion++;
		renderQuestion();
	} else {
		renderResult();
	}
};

headerHomeButton?.addEventListener("click", goHome);
resultHomeButton?.addEventListener("click", goHome);
homeTestButton?.addEventListener("click", () => showScreen("intro"));
personalityBackButton?.addEventListener("click", goHome);
homeArButton?.addEventListener("click", () => { window.location.href = "AR.html"; });
homeGameButton?.addEventListener("click", () => openBattleScreen("home"));

resultLearnMoreButton?.addEventListener("click", () => {
	const expanded = resultLearnMoreButton.getAttribute("aria-expanded") === "true";
	resultMore.hidden = expanded;
	resultLearnMoreButton.setAttribute("aria-expanded", String(!expanded));
	resultLearnMoreButton.innerHTML = expanded
		? "Learn more <span aria-hidden=\"true\">→</span>"
		: "Show less <span aria-hidden=\"true\">↑</span>";
});

resultShareButton?.addEventListener("click", () => shareGate?.present());

showScreen(window.location.hash === "#quiz" ? "intro" : "home");

/* ---------------- AR TEASER ---------------- */

// From the teaser screen: launch the standalone AR camera experience
if (launchArButton) {
	launchArButton.onclick = () => {
		window.location.href = "AR.html";
	};
}

if (battleEls.manualJoinButton) {
	battleEls.manualJoinButton.onclick = () => joinBattleFromManualInput();
}
if (battleEls.manualCode) {
	battleEls.manualCode.addEventListener("keydown", (event) => {
		if (event.key === "Enter") {
			event.preventDefault();
			joinBattleFromManualInput();
		}
	});
}
if (battleEls.startSoloButton) {
	battleEls.startSoloButton.onclick = () => startBattleSolo();
}
if (battleEls.confirmCharacterButton) {
	battleEls.confirmCharacterButton.onclick = () => confirmBattleCharacter();
}
if (battleEls.tutorialGotItButton) {
	battleEls.tutorialGotItButton.onclick = () => acknowledgeBattleTutorial();
}
if (battleEls.playAgainButton) {
	battleEls.playAgainButton.onclick = () => {
		window.location.href = "https://www.monstercurry.com.sg/";
	};
}
if (battleEls.backButton) {
	battleEls.backButton.onclick = () => closeBattleScreen();
}

// Explicit back button for the AR teaser
if (arTeaserBackButton) {
	arTeaserBackButton.onclick = () => closeArTeaser();
}

/* ---------------- SHARE ---------------- */
(function setupShare() {
	const shareModal = document.getElementById("share-modal");
	const shareLinkInput = document.getElementById("share-link-input");
	const copyLinkBtn = document.getElementById("copy-share-link");
	const closeShareBtn = document.getElementById("close-share-modal");
	const shareSubtitle = document.getElementById("share-modal-subtitle");
	const whatsappLink = document.getElementById("share-whatsapp-link");
	const instagramLink = document.getElementById("share-instagram-link");
	const facebookLink = document.getElementById("share-facebook-link");
	const collectVoucherButton = document.getElementById("collect-food-voucher");
	const voucherMessage = document.getElementById("food-voucher-message");
	if (!shareModal) return;

	// Always share the quiz landing page, even if the person shares from
	// somewhere deeper in the app (e.g. AR.html down the line).
	function getShareUrl() {
		const quizUrl = new URL("index.html", window.location.href);
		quizUrl.hash = "quiz";
		return quizUrl.href;
	}

	function getShareText() {
		const name = (resultName?.textContent || "").replace(/\p{Emoji_Presentation}\s*/gu, "").trim();
		const food = resultTraitFood?.textContent?.trim() || "favourite curry";
		return name
			? `I got ${name} on the Monster Curry Personality Quiz! My personality food is ${food}. Find your personality:`
			: "Find out your Monster Curry flavour personality:";
	}

	function openModal(url) {
		shareLinkInput.value = url;
		const food = resultTraitFood?.textContent?.trim() || "favourite curry";
		if (shareSubtitle) shareSubtitle.textContent = `Share your personality to win 10% off your personality food: ${food}`;
		if (collectVoucherButton) {
			collectVoucherButton.hidden = true;
			collectVoucherButton.textContent = `Collect your ${food} voucher`;
		}
		if (voucherMessage) voucherMessage.hidden = true;
		const text = encodeURIComponent(getShareText());
		const encodedUrl = encodeURIComponent(url);
		if (whatsappLink) whatsappLink.href = `https://wa.me/?text=${text}%20${encodedUrl}`;
		if (instagramLink) instagramLink.href = "https://www.instagram.com/";
		if (facebookLink) facebookLink.href = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
		shareModal.classList.add("open");
		document.body.style.overflow = "hidden";
	}

	function closeModal() {
		shareModal.classList.remove("open");
		document.body.style.overflow = "";
	}

	function present() {
		const url = getShareUrl();
		openModal(url);
	}

	function markShareComplete() {
		const food = resultTraitFood?.textContent?.trim() || "favourite curry";
		if (collectVoucherButton) {
			collectVoucherButton.hidden = false;
			collectVoucherButton.textContent = `Collect your ${food} voucher`;
		}
	}

	if (copyLinkBtn) {
		copyLinkBtn.addEventListener("click", async () => {
			try {
				await navigator.clipboard.writeText(shareLinkInput.value);
				copyLinkBtn.textContent = "Copied!";
				markShareComplete();
			} catch (err) {
				const copyArea = document.createElement("textarea");
				copyArea.value = shareLinkInput.value;
				copyArea.setAttribute("readonly", "");
				copyArea.style.position = "fixed";
				copyArea.style.opacity = "0";
				document.body.appendChild(copyArea);
				copyArea.select();
				const copied = document.execCommand("copy");
				copyArea.remove();
				copyLinkBtn.textContent = copied ? "Copied!" : "Copy failed";
				if (copied) markShareComplete();
			}
			setTimeout(() => { copyLinkBtn.textContent = "Copy"; }, 1800);
		});
	}

	[whatsappLink, instagramLink, facebookLink].forEach((link) => {
		link?.addEventListener("click", markShareComplete);
	});

	collectVoucherButton?.addEventListener("click", () => {
		const food = resultTraitFood?.textContent?.trim() || "favourite curry";
		const code = `CURRY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
		if (voucherMessage) {
			voucherMessage.hidden = false;
			voucherMessage.textContent = `Your 10% off ${food} voucher is ready: ${code}`;
		}
		collectVoucherButton.textContent = "Voucher collected!";
		collectVoucherButton.disabled = true;
	});

	if (closeShareBtn) closeShareBtn.addEventListener("click", closeModal);
	shareModal.addEventListener("click", (e) => { if (e.target === shareModal) closeModal(); });
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && shareModal.classList.contains("open")) closeModal();
	});

	shareGate = { present };
})();

/* ---------------- FEEDBACK ---------------- */
let selectedRating = 0;

const stars = document.querySelectorAll(".star");
const submitBtn = document.getElementById("submit-feedback");
const feedbackMessage = document.getElementById("feedback-message");

function resetFeedback() {
	selectedRating = 0;
	stars.forEach(s => s.classList.remove("active"));
	document.getElementById("feedback-comment").value = "";
	feedbackMessage.textContent = "";
}

stars.forEach(star => {
	star.onclick = () => {
		selectedRating = Number(star.dataset.rating);
		stars.forEach(s => s.classList.toggle("active", Number(s.dataset.rating) <= selectedRating));
	};
});

submitBtn.onclick = async () => {
	const comment = document.getElementById("feedback-comment").value.trim();
	if (selectedRating === 0) { feedbackMessage.textContent = "Please select a star rating."; return; }

	submitBtn.disabled = true;
	submitBtn.textContent = "Sending…";

	await firebaseReady;
	if (!firebaseAvailable) {
		feedbackMessage.textContent = "Couldn't send feedback (a browser or ad blocker may be blocking it). Please try again later.";
		submitBtn.disabled = false;
		submitBtn.textContent = "Submit Feedback";
		return;
	}

	try {
		await addDoc(collection(db, "feedback"), {
			rating: selectedRating,
			comment,
			createdAt: new Date()
		});
		feedbackMessage.textContent = "Thanks for your feedback!";
		document.getElementById("feedback-comment").value = "";
		stars.forEach(s => s.classList.remove("active"));
		selectedRating = 0;
	} catch (err) {
		console.error(err);
		feedbackMessage.textContent = "Error sending feedback. Please try again.";
	} finally {
		submitBtn.disabled = false;
		submitBtn.textContent = "Submit Feedback";
	}
};
