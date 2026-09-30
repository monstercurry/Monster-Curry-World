import { CHARACTERS, MOVES, getLevelCount, ensureGameData } from "./game-data.js?v=20260930-lazy-data";

const storefrontFirebaseConfig = {
	apiKey: "AIzaSyBq5lzgJAY4H_7py32FCSHTnxuwvU-1Ixk",
	authDomain: "storefront-game.firebaseapp.com",
	databaseURL: "https://storefront-game-default-rtdb.asia-southeast1.firebasedatabase.app",
	projectId: "storefront-game",
	storageBucket: "storefront-game.firebasestorage.app",
	messagingSenderId: "805711728537",
	appId: "1:805711728537:web:9aace7f18cd32020e78d08"
};

let storefrontDb = null;
let storefrontFirestore = null;
let storefrontAuth = null;
let firestoreDoc, firestoreGetDoc;
let get, goOffline, goOnline, onDisconnect, onValue, ref, serverTimestamp, set, update;
let firebaseAvailable = false;

// The uid of the signed-in anonymous user. Every write this client makes to its own
// lobby/pendingMoves/tutorialAcks entry must carry this, because database.rules.json
// checks newData.child('uid').val() === auth.uid before allowing the write.
function currentUid() {
	return storefrontAuth?.currentUser?.uid || null;
}

const firebaseReady = (async () => {
	try {
		const [appMod, databaseMod, authMod, appCheckMod, firestoreMod] = await Promise.all([
			import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
			import("https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js"),
			import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js"),
			import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-check.js"),
			import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js")
		]);
		({ get, goOffline, goOnline, onDisconnect, onValue, ref, serverTimestamp, set, update } = databaseMod);
		firestoreDoc = firestoreMod.doc;
		firestoreGetDoc = firestoreMod.getDoc;

		const storefrontApp = appMod.initializeApp(storefrontFirebaseConfig, "storefrontBattle");

		if (["localhost", "127.0.0.1"].includes(location.hostname) || location.hostname.startsWith("192.168.")) {
			self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
		}

		appCheckMod.initializeAppCheck(storefrontApp, {
			provider: new appCheckMod.ReCaptchaEnterpriseProvider("6LcSsdItAAAAAByIYOLLgdp8E0HdfGOr2SoBjwyU"),
			isTokenAutoRefreshEnabled: true
		});

		storefrontDb = databaseMod.getDatabase(storefrontApp);
		goOffline(storefrontDb); // stay disconnected until a player joins a battle
		storefrontFirestore = firestoreMod.getFirestore(storefrontApp);
		storefrontAuth = authMod.getAuth(storefrontApp);
		await authMod.signInAnonymously(storefrontAuth);

		firebaseAvailable = true;
	} catch (err) {
		console.warn("Storefront Firebase startup failed:", err?.code || err?.message || err, err);
		firebaseAvailable = false;
	}
	return firebaseAvailable;
})();

// Voucher links live in Firestore (collection "vouchers", doc id = personality id,
// field "url") so they never appear in the page source.
const voucherUrlCache = {};
async function fetchVoucherUrl(personalityId) {
	if (!personalityId) return null;
	if (voucherUrlCache[personalityId]) return voucherUrlCache[personalityId];
	const ready = await firebaseReady;
	if (!ready || !storefrontFirestore) return null;
	try {
		const snap = await firestoreGetDoc(firestoreDoc(storefrontFirestore, "vouchers", personalityId));
		const url = snap.exists() ? snap.data().url : null;
		if (typeof url === "string" && /^https:\/\//.test(url)) {
			voucherUrlCache[personalityId] = url;
			return url;
		}
	} catch (err) {
		console.warn("Could not load voucher", err);
	}
	return null;
}

// Storefront battle prize: Firestore doc vouchers/storefront-win (field "url"). The rules only
// let a phone read it while the kiosk's short-lived wins/{uid} record exists. The kiosk writes
// that record just after the game ends, so retry a few times to cover the gap.
async function fetchStorefrontWinUrl(attempts = 5) {
	for (let i = 0; i < attempts; i += 1) {
		const url = await fetchVoucherUrl("storefront-win");
		if (url) return url;
		if (i < attempts - 1) await new Promise(resolve => setTimeout(resolve, 1200));
	}
	return null;
}

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
		favouriteFood: "Chicken Katsu Curry",
		voucherDiscount: "$3 off Chicken Katsu Curry",
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
		voucherDiscount: "$35.00 Monster Combo Curry (U.P. $37.90)",
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
		voucherDiscount: "Free add-on rice with Super Monster Curry",
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
		voucherDiscount: "$15.90 Teriyaki Chicken Omelette Curry (U.P. $17.90)",
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
		voucherDiscount: "Free Extra Mozzarella Cheese on Cheese Omelette Curry",
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
		voucherDiscount: "20% off of all Curry Ramen",
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
		favouriteFood: "Salmon Teriyaki Hotplate",
		voucherDiscount: "20% off on Salmon Teriyaki Hotplate",
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
		voucherDiscount: "$12.90 Yaki Beef Curry Rice (U.P. $15.50)",
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
	lobbyLeaveButton: document.getElementById("battle-lobby-leave-button"),
	characterLeaveButton: document.getElementById("battle-character-leave-button"),
	characterWaitingLeaveButton: document.getElementById("battle-character-waiting-leave-button"),
	tutorialLeaveButton: document.getElementById("battle-tutorial-leave-button"),
	moveLeaveButton: document.getElementById("battle-move-leave-button"),
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
	moveTimer: document.getElementById("battle-move-timer"),
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

const BATTLE_CHARACTER_DISPLAY = {
	"katsu-chan": { image: "images/Katsu-Chan.png", playstyle: "Balanced all-rounder with an answer for every turn." },
	"monstora-sharemi": { image: "images/Monstora_Sharemi.png", playstyle: "Team support who heals, buffs, and weakens foes." },
	"giga-nomu": { image: "images/Giga_Nomu.png", playstyle: "Tough tank who taunts, shields, and heals by attacking." },
	"tamago-puffy": { image: "images/Tamago_Puffy.png", playstyle: "Pure healer who cleanses and protects wounded allies." },
	"cheezu-mellow": { image: "images/Cheezu_Mellow.png", playstyle: "Team guardian who shields, covers, and heals allies." },
	"ramy-noodleton": { image: "images/Ramy_Noodleton.png", playstyle: "Combo finisher who punishes weakened monsters." },
	"hot-sizz": { image: "images/Hot_Sizz.png", playstyle: "Glass cannon with explosive damage but fragile defense." },
	"teppa-spark": { image: "images/Teppa_Spark.png", playstyle: "Versatile tactician with damage, debuffs, and shields." }
};

function getBattleCharacter(characterId) {
	const base = CHARACTERS.find(c => c.id === characterId);
	if (!base) return null;
	return { ...base, ...(BATTLE_CHARACTER_DISPLAY[base.id] || {}) };
}

// Set by setupShare() below.
let shareGate = null;

let battleGameId = null;
let battlePlayerId = null;
let battleSessionRef = null;
let battleUnsubscribe = null;
let battleState = null;
let battleSelectedCharacterId = null;
let battleGameOverLocked = false;
let battleVoucherState = "idle"; // idle | loading | ready | failed
let battleRedeemLink = null;

function getBattleRedeemLink() {
	if (!battleRedeemLink && battleEls.playAgainButton) {
		battleRedeemLink = document.createElement("a");
		battleRedeemLink.className = battleEls.playAgainButton.className;
		battleRedeemLink.target = "_blank";
		battleRedeemLink.rel = "noopener noreferrer";
		battleRedeemLink.textContent = "Redeem Voucher";
		battleRedeemLink.hidden = true;
		battleEls.playAgainButton.insertAdjacentElement("afterend", battleRedeemLink);
	}
	return battleRedeemLink;
}

function resetBattleVoucherUi() {
	battleVoucherState = "idle";
	const link = getBattleRedeemLink();
	if (link) {
		link.hidden = true;
		link.removeAttribute("href");
	}
}

async function loadBattleVoucher() {
	const button = battleEls.playAgainButton;
	const link = getBattleRedeemLink();
	if (!button || !link || battleVoucherState === "loading") return;
	battleVoucherState = "loading";
	link.hidden = true;
	button.hidden = false;
	button.disabled = true;
	button.textContent = "Getting your voucher...";
	const url = await fetchStorefrontWinUrl();
	button.disabled = false;
	if (url) {
		link.href = url;
		link.hidden = false;
		button.hidden = true;
		battleVoucherState = "ready";
	} else {
		button.textContent = "Couldn't load voucher - tap to retry";
		battleVoucherState = "failed";
	}
}

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
	// Lets styles.css target the currently-active screen (used to safely
	// open up overflow on the intro screen so its card shadow isn't clipped).
	document.body.dataset.screen = name;
	window.scrollTo({ top: 0, behavior: "smooth" });

	if (headerHomeButton) {
		headerHomeButton.style.display = name === "home" ? "none" : "inline-flex";
	}
}

function goHome() {
	resetQuiz();
	battleGameOverLocked = false;
	showScreen("home");
}

function openArTeaser(fromScreen) {
	screenBeforeArTeaser = fromScreen;
	showScreen("ar-teaser");
}

function closeArTeaser() {
	showScreen(screenBeforeArTeaser);
}

async function openBattleScreen(fromScreen) {
	screenBeforeBattle = fromScreen;
	showScreen("battle");
	await ensureGameData();
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
	CHARACTERS.forEach(base => {
		const character =
			getBattleCharacter(base.id);
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
	const character = getBattleCharacter(characterId);
	if (!character || !battleEls.selectedCharacter) return;
	battleEls.selectedCharacter.classList.remove("hidden");
	battleEls.selectedCharacterArt.src = character.image;
	battleEls.selectedCharacterArt.alt = character.name;
	battleEls.selectedCharacterName.textContent = character.name;
	battleEls.selectedCharacterTitle.textContent = character.title;
	battleEls.selectedCharacterPlaystyle.textContent = character.playstyle;
	battleEls.selectedCharacterStats.textContent = `HP ${character.maxHp} / Attack ${character.atk}`;
	battleEls.selectedCharacterMoves.textContent = character.moves.map(moveId => MOVES[moveId]?.name || moveId).join(", ");
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

let characterTimerInterval = null;
const CHARACTER_TIMER_LIMIT_MS = 45000;

function stopCharacterTimer() {
	window.clearInterval(characterTimerInterval);
	characterTimerInterval = null;
	document.querySelectorAll(".battle-character-timer").forEach(el => el.classList.add("hidden"));
}

function updateCharacterTimer() {
	const state = battleState;
	const startedAt = Number(state?.characterSelectStartedAt || 0);
	if (!state || state.status !== "character-select" || !startedAt) {
		stopCharacterTimer();
		return;
	}
	const remainingMs = Math.max(0, startedAt + CHARACTER_TIMER_LIMIT_MS - (Date.now() + serverTimeOffsetMs));
	const seconds = Math.ceil(remainingMs / 1000);
	document.querySelectorAll(".battle-character-timer").forEach(el => {
		el.textContent = `Time left: ${seconds}s`;
		el.style.color = seconds <= 10 ? "#ed1d24" : "";
		el.classList.remove("hidden");
	});
}

function syncCharacterTimer() {
	updateCharacterTimer();
	if (!characterTimerInterval && battleState?.characterSelectStartedAt) {
		characterTimerInterval = window.setInterval(updateCharacterTimer, 250);
	}
}

function renderBattleCharacterSelect(state) {
	showBattlePanel("character");
	const entry = state?.lobby?.[battlePlayerId];
	battleSelectedCharacterId = entry?.characterId || battleSelectedCharacterId;
	if (battleSelectedCharacterId) {
		selectBattleCharacter(battleSelectedCharacterId);
	} else {
		battleEls.selectedCharacter?.classList.add("hidden");
		// Nothing is selected (e.g. re-joining after leaving): clear the highlight left on the old card.
		battleEls.characterGrid?.querySelectorAll(".battle-character-card").forEach(card => {
			card.setAttribute("aria-pressed", "false");
		});
	}

	const hasConfirmed = Boolean(entry?.confirmed);
	battleEls.characterWaitingOverlay?.classList.toggle("hidden", !hasConfirmed);
	battleEls.characterGrid?.querySelectorAll(".battle-character-card").forEach(card => {
		card.disabled = hasConfirmed;
	});
	if (battleEls.confirmCharacterButton) {
		battleEls.confirmCharacterButton.disabled = hasConfirmed;
	}
	syncCharacterTimer();
}

function renderBattleTeam(players) {
	battleEls.teamStatus.innerHTML = "";
	players.forEach(player => {
		const character = getBattleCharacter(player.characterId);
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
		const move = MOVES[moveId] || { id: moveId, name: moveId, description: "" };
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

let serverTimeOffsetMs = 0;
let moveTimerInterval = null;
const MOVE_TIMER_LIMIT_MS = 30000;

function stopMoveTimer() {
	window.clearInterval(moveTimerInterval);
	moveTimerInterval = null;
	battleEls.moveTimer?.classList.add("hidden");
}

function updateMoveTimer() {
	const state = battleState;
	const turnKey = `${Number(state?.levelIndex || 0)}:${Number(state?.turn || 1)}`;
	const startedAt = Number(state?.moveTurnStartedAt || 0);
	if (!state || state.status !== "battle" || state.showTutorial || state.moveTurnKey !== turnKey || !startedAt) {
		stopMoveTimer();
		return;
	}
	const remainingMs = Math.max(0, startedAt + MOVE_TIMER_LIMIT_MS - (Date.now() + serverTimeOffsetMs));
	const seconds = Math.ceil(remainingMs / 1000);
	battleEls.moveTimer.textContent = `Time left: ${seconds}s`;
	battleEls.moveTimer.style.color = seconds <= 10 ? "#ed1d24" : "";
	battleEls.moveTimer.classList.remove("hidden");
}

function syncMoveTimer() {
	updateMoveTimer();
	if (!moveTimerInterval && battleState?.moveTurnStartedAt) {
		moveTimerInterval = window.setInterval(updateMoveTimer, 250);
	}
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
	syncMoveTimer();
}

function renderBattleGameOver(state) {
	battleGameOverLocked = true;
	showBattlePanel("gameOver");
	const playersWon = state.winner === "players";
	const totalLevels = getLevelCount(state.mode);
	battleEls.gameOverTitle.textContent = playersWon ? "You won!" : "You lost";
	battleEls.gameOverMessage.textContent = playersWon
		? `Your curry party cleared all ${totalLevels} levels.`
		: "The monster won. Try again.";

	// Winners redeem a voucher; losers get a "Try Again" button instead
	const button = battleEls.playAgainButton;
	if (!button) return;
	button.classList.remove("hidden");
	button.dataset.won = playersWon ? "1" : "0";

	if (!playersWon) {
		resetBattleVoucherUi();
		button.hidden = false;
		button.disabled = false;
		button.textContent = "Try Again";
		return;
	}

	// Winners: fetch the voucher URL, then swap the button for a real <a target="_blank"> link.
	// A genuine link tap always opens a new tab; window.open() after a network wait gets blocked.
	if (battleVoucherState === "idle") {
		loadBattleVoucher();
	}
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
	if (battleGameOverLocked) return;
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
	const soloAlreadyStarted = state.mode === "solo"
		|| Object.values(state.lobby || {}).some(entry => entry.soloRequested === true);
	if (!existing && soloAlreadyStarted) {
		showBattlePanel("code");
		battleEls.codeStatus.textContent = "A game is already starting. Please wait for the next code.";
		return;
	}
	const slot = existing ? Number(existing.slot) : findBattleOpenSlot(state);
	if (slot === undefined) {
		battleEls.codeStatus.textContent = "This battle lobby is full.";
		return;
	}
	const uid = currentUid();
	if (!uid) {
		battleEls.codeStatus.textContent = "Still connecting, try again in a moment.";
		return;
	}
	// Only write our own lobby entry. status/mode are staff-owned fields (see
	// database.rules.json) and get flipped by the kiosk once it sees two entries here.
	await update(battleSessionRef, {
		[`lobby/${battlePlayerId}`]: {
			id: battlePlayerId,
			uid,
			slot,
			label: `Player ${slot + 1}`,
			joinedAt: existing?.joinedAt || Date.now(),
			soloRequested: Boolean(existing?.soloRequested),
			characterId: existing?.characterId || null,
			confirmed: Boolean(existing?.confirmed)
		},
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
		goOnline(storefrontDb);
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

	await ensureGameData();
	goOnline(storefrontDb);
	const nextSessionRef = ref(storefrontDb, `sessions/${cleanGameId}`);
	const snapshot = await get(nextSessionRef);
	const state = snapshot.val();
	if (!state || ["closed", "game-over"].includes(state.status)) {
		showBattlePanel("code");
		battleEls.codeStatus.textContent = "That code is not active. Check the big screen and try again.";
		return;
	}

	battleGameOverLocked = false;
	battleGameId = cleanGameId;
	battlePlayerId = getBattlePlayerId(battleGameId);
	battleSessionRef = nextSessionRef;
	setupBattlePresence();
	window.localStorage.setItem("storefront-last-game", battleGameId);
	if (battleUnsubscribe) battleUnsubscribe();
	onValue(ref(storefrontDb, ".info/serverTimeOffset"), snap => {
		serverTimeOffsetMs = Number(snap.val()) || 0;
	});
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
	const ownEntry = state?.lobby?.[battlePlayerId];
	if (!ownEntry) return;
	// Flag our own entry; the kiosk (screen.js resolveLobbyTransitions) is the one
	// that actually moves status -> "character-select" / mode -> "solo".
	await update(battleSessionRef, {
		[`lobby/${battlePlayerId}`]: {
			...ownEntry,
			slot: 0,
			soloRequested: true
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
	// Only confirm our own pick. The kiosk (screen.js resolveLobbyTransitions, section 2)
	// watches for every expected player to be confirmed+characterId and is the one that
	// builds players/monster and flips status -> "battle" — that write requires the
	// staff uid, which this phone client will never have.
	await update(battleSessionRef, {
		[`lobby/${battlePlayerId}`]: {
			...ownEntry,
			characterId: battleSelectedCharacterId,
			confirmed: true
		},
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
	resetBattleVoucherUi();
	hideBattleReconnectBanner();
	battleGameOverLocked = false;
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

async function leaveBattleGame() {
	resetBattleVoucherUi();
	const leavingSessionRef = battleSessionRef;
	const leavingPlayerId = battlePlayerId;
	const leavingPresenceRef = battlePresenceRef;

	// Best-effort: release our own lobby slot and presence flag so the kiosk (and anyone
	// else waiting on this code) sees the slot open up immediately instead of waiting for
	// the ~10s abandoned-session timeout. Only our own entries — the database rules only
	// ever let a player touch their own lobby/presence keys, never anyone else's.
	if (leavingSessionRef && leavingPlayerId) {
		try {
			await update(leavingSessionRef, {
				[`lobby/${leavingPlayerId}`]: null,
				lastActionAt: serverTimestamp()
			});
		} catch (error) {
			console.warn("Could not remove lobby entry on leave", error);
		}
	}
	if (leavingPresenceRef) {
		try {
			await onDisconnect(leavingPresenceRef).cancel();
		} catch (error) {
			// Ignore — the entry may already be gone.
		}
		try {
			await set(leavingPresenceRef, null);
		} catch (error) {
			console.warn("Could not clear presence on leave", error);
		}
	}

	if (battleConnectedUnsubscribe) {
		battleConnectedUnsubscribe();
		battleConnectedUnsubscribe = null;
	}
	if (battleUnsubscribe) {
		battleUnsubscribe();
		battleUnsubscribe = null;
	}
	window.clearTimeout(battleHiddenTimer);
	battleHiddenTimer = null;
	stopTeammateDisconnectCountdown();
	hideBattleReconnectBanner();

	battleGameOverLocked = false;
	battleGameId = null;
	battlePlayerId = null;
	battleSessionRef = null;
	battlePresenceRef = null;
	battleState = null;
	battleSelectedCharacterId = null;
	window.localStorage.removeItem("storefront-last-game");
	battleEls.manualCode.value = "";
	showBattlePanel("code");
	battleEls.codeStatus.textContent = "You left the game. Enter a code shown on the big screen to join another.";
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

let currentPersonality = null;

function populateResult(personality) {
	currentPersonality = personality;
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
[battleEls.lobbyLeaveButton, battleEls.characterLeaveButton, battleEls.characterWaitingLeaveButton].forEach((button) => {
	if (!button) return;
	button.onclick = () => {
		leaveBattleGame().catch((error) => console.error("Could not leave game", error));
	};
});
// Mid-game buttons need two taps so a stray tap while mashing moves can't quit the fight.
[battleEls.tutorialLeaveButton, battleEls.moveLeaveButton].forEach((button) => {
	if (!button) return;
	let armedTimer = null;
	const disarm = () => {
		window.clearTimeout(armedTimer);
		armedTimer = null;
		button.classList.remove("confirming");
		button.textContent = "Leave Game";
	};
	button.onclick = () => {
		if (!armedTimer) {
			button.classList.add("confirming");
			button.textContent = "Tap again to leave";
			armedTimer = window.setTimeout(disarm, 3000);
			return;
		}
		disarm();
		leaveBattleGame().catch((error) => console.error("Could not leave game", error));
	};
});
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
		if (battleEls.playAgainButton.dataset.won !== "1") {
			playBattleAgain();
		} else if (battleVoucherState === "failed") {
			loadBattleVoucher();
		}
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
	const shareFood = document.getElementById("share-modal-food");
	const whatsappLink = document.getElementById("share-whatsapp-link");
	const instagramLink = document.getElementById("share-instagram-link");
	const facebookLink = document.getElementById("share-facebook-link");
	const collectVoucherButton = document.getElementById("collect-food-voucher");
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
		const discount = currentPersonality?.voucherDiscount || "a discount";
		if (shareSubtitle) shareSubtitle.textContent = `Share your personality to win ${discount}`;
		if (shareFood) shareFood.textContent = `Your Personality Food: ${food}`;
		if (collectVoucherButton) {
			collectVoucherButton.hidden = true;
			collectVoucherButton.removeAttribute("href");
			collectVoucherButton.dataset.ready = "";
			collectVoucherButton.textContent = `Collect your ${food} voucher`;
		}
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

	async function markShareComplete() {
		if (!collectVoucherButton || !currentPersonality) return;
		const food = resultTraitFood?.textContent?.trim() || "favourite curry";
		const label = `Collect your ${food} voucher`;
		const personalityId = currentPersonality.id;

		collectVoucherButton.hidden = false;
		if (collectVoucherButton.dataset.ready === personalityId) return; // already loaded

		collectVoucherButton.removeAttribute("href");
		collectVoucherButton.textContent = "Loading your voucher...";
		const url = await fetchVoucherUrl(personalityId);
		if (currentPersonality?.id !== personalityId) return; // result changed while loading

		if (url) {
			collectVoucherButton.href = url;
			collectVoucherButton.dataset.ready = personalityId;
			collectVoucherButton.textContent = label;
		} else {
			collectVoucherButton.dataset.ready = "";
			collectVoucherButton.textContent = "Couldn't load voucher - tap to retry";
		}
	}

	collectVoucherButton?.addEventListener("click", (e) => {
		if (!collectVoucherButton.getAttribute("href")) {
			e.preventDefault();
			markShareComplete();
		}
	});

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

	if (closeShareBtn) closeShareBtn.addEventListener("click", closeModal);
	shareModal.addEventListener("click", (e) => { if (e.target === shareModal) closeModal(); });
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && shareModal.classList.contains("open")) closeModal();
	});

	shareGate = { present };
})();