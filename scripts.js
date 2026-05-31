const questions = [
	{ prompt: "What describes your mood right now?", options: [{ text: "Calm", score: 0 }, { text: "Curious", score: 1 }, { text: "Bold", score: 2 }, { text: "Wild", score: 3 }] },
	{ prompt: "Pick a weekend plan.", options: [{ text: "Stay in", score: 0 }, { text: "Cafe hop", score: 1 }, { text: "Road trip", score: 2 }, { text: "Festival", score: 3 }] },
	{ prompt: "How spicy is your ideal meal?", options: [{ text: "Mild", score: 0 }, { text: "Medium", score: 1 }, { text: "Hot", score: 2 }, { text: "Extreme", score: 3 }] },
	{ prompt: "Your work style is...", options: [{ text: "Steady", score: 0 }, { text: "Balanced", score: 1 }, { text: "Fast", score: 2 }, { text: "All-in", score: 3 }] },
	{ prompt: "Choose a flavor profile.", options: [{ text: "Creamy", score: 0 }, { text: "Savory", score: 1 }, { text: "Smoky", score: 2 }, { text: "Fiery", score: 3 }] },
	{ prompt: "When solving problems, you...", options: [{ text: "Take it slow", score: 0 }, { text: "Test options", score: 1 }, { text: "Trust instinct", score: 2 }, { text: "Dive first", score: 3 }] },
	{ prompt: "Pick your soundtrack.", options: [{ text: "Lo-fi", score: 0 }, { text: "Pop", score: 1 }, { text: "Rock", score: 2 }, { text: "EDM", score: 3 }] },
	{ prompt: "What motivates you most?", options: [{ text: "Stability", score: 0 }, { text: "Growth", score: 1 }, { text: "Impact", score: 2 }, { text: "Excitement", score: 3 }] },
	{ prompt: "Your social battery is usually...", options: [{ text: "Low", score: 0 }, { text: "Medium", score: 1 }, { text: "High", score: 2 }, { text: "Infinite", score: 3 }] },
	{ prompt: "How do you make decisions?", options: [{ text: "Carefully", score: 0 }, { text: "With context", score: 1 }, { text: "Quickly", score: 2 }, { text: "Instantly", score: 3 }] },
	{ prompt: "Choose a weather mood.", options: [{ text: "Cloudy", score: 0 }, { text: "Breezy", score: 1 }, { text: "Sunny", score: 2 }, { text: "Thunder", score: 3 }] },
	{ prompt: "Your communication style is...", options: [{ text: "Soft", score: 0 }, { text: "Friendly", score: 1 }, { text: "Direct", score: 2 }, { text: "Intense", score: 3 }] },
	{ prompt: "Pick a power-up.", options: [{ text: "Patience", score: 0 }, { text: "Focus", score: 1 }, { text: "Confidence", score: 2 }, { text: "Fearless", score: 3 }] },
	{ prompt: "How do friends describe you?", options: [{ text: "Reliable", score: 0 }, { text: "Thoughtful", score: 1 }, { text: "Energetic", score: 2 }, { text: "Explosive", score: 3 }] },
	{ prompt: "Final pick: your vibe tonight?", options: [{ text: "Cozy", score: 0 }, { text: "Chill", score: 1 }, { text: "Hyped", score: 2 }, { text: "Unstoppable", score: 3 }] }
];

const personalities = [
	{
		min: 0,
		max: 14,
		name: "Creamy Katsu",
		background: "Creamy Katsu is the cozy comfort bowl of the curry world, known for its soft flavor and calm presence.",
		description: "You are warm, reliable, and easy to love. You bring comfort to people around you and keep things steady even when life gets noisy. People likely feel safe opening up to you because you do not rush or judge. You prefer consistency, kindness, and a pace that lets everyone breathe. Even when things get busy, you help keep the mood gentle and grounded."
	},
	{
		min: 15,
		max: 29,
		name: "Classic Curry",
		background: "Classic Curry is a balanced favorite with a smooth flavor that feels familiar, flexible, and dependable.",
		description: "You are balanced and adaptable. You can play it cool, but you know when to turn up the flavor and make your presence known. You probably adjust well to different people and situations without losing yourself. There is a steady, thoughtful side to you that makes others trust your judgment. When needed, you can become more expressive and take the lead without feeling forced. You bring harmony while still keeping things interesting."
	},
	{
		min: 30,
		max: 44,
		name: "Spicy Dynamite",
		background: "Spicy Dynamite is the bold curry with a lively kick, made to stand out and wake up every bite.",
		description: "You are bold and high-energy. You move fast, think big, and make everything more exciting wherever you go. People notice your presence quickly because you bring momentum into the room. You likely enjoy action, change, and a little bit of challenge. Your confidence helps others feel more alive around you. At the same time, your energy can inspire people to be braver and speak up more."
	},
	{
		min: 45,
		max: 60,
		name: "Monster Volcano",
		background: "Monster Volcano is the hottest curry in the lineup, intense and unforgettable with a powerful kick.",
		description: "You are intense, fearless, and unforgettable. You do not hold back, and people always remember the heat you bring. You probably have a strong sense of direction and know what you want. Your presence can feel powerful, motivating, and impossible to ignore. You may push yourself harder than most people do. When you show up, you change the energy of the whole space."
	}
];

const introScreen = document.getElementById("intro-screen");
const quizScreen = document.getElementById("quiz-screen");
const resultScreen = document.getElementById("result-screen");
const startButton = document.getElementById("start-button");
const backButton = document.getElementById("back-button");
const homeButton = document.getElementById("home-button");
const progressFill = document.getElementById("progress-fill");
const progressLabel = document.getElementById("progress-label");
const questionPrompt = document.getElementById("question-prompt");
const optionList = document.getElementById("option-list");
const resultName = document.getElementById("result-name");
const resultIllustration = document.getElementById("result-illustration");
const resultBackground = document.getElementById("result-background");
const resultDescription = document.getElementById("result-description");

let currentQuestion = 0;
let totalScore = 0;
const answers = Array(questions.length).fill(null);

function showScreen(name) {
	introScreen.classList.toggle("hidden", name !== "intro");
	quizScreen.classList.toggle("hidden", name !== "quiz");
	resultScreen.classList.toggle("hidden", name !== "result");

	// update document title to follow naming convention
	if (name === "intro") {
		document.title = "Curry Personality Test - Home (Fun Background)";
	} else if (name === "quiz") {
		document.title = "Curry Personality Test - Quiz (Fun Background)";
	} else if (name === "result") {
		// result title is set in renderResult with personality name
		// fallback if no personality yet
		document.title = "Curry Personality Test - Result (Fun Background)";
	}
}

function resetQuiz() {
	currentQuestion = 0;
	totalScore = 0;
	answers.fill(null);
	progressFill.style.width = `${(1 / questions.length) * 100}%`;
	progressLabel.textContent = `1/${questions.length}`;
}

function renderQuestion() {
	const question = questions[currentQuestion];
	const progressPercent = ((currentQuestion + 1) / questions.length) * 100;

	progressFill.style.width = `${progressPercent}%`;
	progressLabel.textContent = `${currentQuestion + 1}/${questions.length}`;
	questionPrompt.textContent = question.prompt;
	optionList.innerHTML = "";

	question.options.forEach((option, optionIndex) => {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "option-button";
		button.textContent = option.text;
		button.dataset.optionIndex = String(optionIndex);

		button.addEventListener("click", () => {
			const previousSelection = answers[currentQuestion];
			if (previousSelection !== null) {
				totalScore -= question.options[previousSelection].score;
			}

			answers[currentQuestion] = optionIndex;
			totalScore += option.score;

			if (currentQuestion < questions.length - 1) {
				currentQuestion += 1;
				renderQuestion();
			} else {
				renderResult();
			}
		});

		optionList.appendChild(button);
	});
}

function getPersonality(score) {
	return personalities.find((entry) => score >= entry.min && score <= entry.max) || personalities[0];
}

function renderResult() {
	const personality = getPersonality(totalScore);
	resultName.textContent = personality.name;
	resultIllustration.textContent = `${personality.name}`;
	resultBackground.textContent = personality.background;
	resultDescription.textContent = personality.description;

	// set descriptive document title including personality name
	document.title = `Curry Personality Test - Result: ${personality.name} (Fun Background)`;
	showScreen("result");
}

startButton.addEventListener("click", () => {
	resetQuiz();
	showScreen("quiz");
	renderQuestion();
});

backButton.addEventListener("click", () => {
	if (currentQuestion === 0) {
		showScreen("intro");
		return;
	}

	currentQuestion -= 1;
	renderQuestion();
});

homeButton.addEventListener("click", () => {
	resetQuiz();
	showScreen("intro");
});

showScreen("intro");
