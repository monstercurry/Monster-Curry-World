const quizData = [
	{
		prompt: "When your meal arrives, what do you notice first?",
		choices: [
			{ label: "Visual balance", detail: "I like a clean, even presentation.", score: 1 },
			{ label: "Bold aroma", detail: "I want the strongest scent in the room.", score: 2 },
			{ label: "Comfort factor", detail: "I care most about how cozy it feels.", score: 0 },
			{ label: "Texture variety", detail: "I want every bite to feel a little different.", score: 1 }
		]
	},
	{
		prompt: "How do you usually handle spice?",
		choices: [
			{ label: "Keep it calm", detail: "A smoother heat works best for me.", score: 0 },
			{ label: "Steady warmth", detail: "I like warmth that builds without surprise.", score: 1 },
			{ label: "Turn it up", detail: "I want the flavor to be loud and direct.", score: 2 },
			{ label: "Mix and match", detail: "Different levels make the experience fun.", score: 1 }
		]
	},
	{
		prompt: "What kind of pace feels right to you?",
		choices: [
			{ label: "Slow and settled", detail: "I prefer something thoughtful and measured.", score: 0 },
			{ label: "Smooth momentum", detail: "I like a rhythm that keeps moving.", score: 1 },
			{ label: "Fast impact", detail: "I want a result that grabs attention quickly.", score: 2 },
			{ label: "Flexible tempo", detail: "I enjoy changing pace depending on the moment.", score: 1 }
		]
	},
	{
		prompt: "What would the ideal side note be?",
		choices: [
			{ label: "Classic and tidy", detail: "The smallest details keep it polished.", score: 0 },
			{ label: "Rich and layered", detail: "I want a lot happening beneath the surface.", score: 1 },
			{ label: "Straight to the point", detail: "A strong core idea is enough for me.", score: 2 },
			{ label: "Lightly unexpected", detail: "A subtle twist makes it more memorable.", score: 1 }
		]
	},
	{
		prompt: "If this personality were a vibe, it would be...",
		choices: [
			{ label: "Quietly dependable", detail: "Balanced, soft, and always welcome.", score: 0 },
			{ label: "Focused and layered", detail: "Clear structure with a little depth.", score: 1 },
			{ label: "Hot-blooded and loud", detail: "Direct, intense, and impossible to ignore.", score: 2 },
			{ label: "Curious and adaptable", detail: "Able to fit into many moods.", score: 1 }
		]
	}
];

const results = [
	{
		min: 0,
		max: 1,
		name: "Gentle Broth",
		badge: "Low score bucket",
		description: "You read as calm, dependable, and easy to enjoy. This personality favors comfort over drama, with a steady presence that never asks for attention but still leaves an impression.",
		facts: [
			"Best at creating a relaxed first impression.",
			"Prefers smooth pacing and balanced choices.",
			"Feels most natural in quiet, cozy settings."
		]
	},
	{
		min: 2,
		max: 3,
		name: "Balanced Simmer",
		badge: "Middle-low score bucket",
		description: "You lean toward structure with enough personality to stay interesting. This is the adaptable result: practical, layered, and comfortable moving between mellow and bold moments.",
		facts: [
			"Carries a clear core with subtle depth.",
			"Works well when the experience needs balance.",
			"Feels thoughtful without becoming intense."
		]
	},
	{
		min: 4,
		max: 5,
		name: "Midnight Curry",
		badge: "Middle score bucket",
		description: "You have a sharper edge and a stronger sense of contrast. This personality feels composed at first, then reveals more intensity once the conversation gets going.",
		facts: [
			"Makes a strong impression without overpowering the room.",
			"Likes a mix of calm structure and bold accents.",
			"Often feels the most versatile in the lineup."
		]
	},
	{
		min: 6,
		max: 7,
		name: "Spice Surge",
		badge: "Middle-high score bucket",
		description: "You push toward louder flavor and quicker impact. This personality is confident, energetic, and very clear about what it wants to be.",
		facts: [
			"Thrives on strong contrasts and direct energy.",
			"Feels best when the result is impossible to miss.",
			"Leans into momentum, heat, and presence."
		]
	},
	{
		min: 8,
		max: 10,
		name: "Volcanic Heat",
		badge: "High score bucket",
		description: "You read as bold, intense, and unapologetically vivid. This is the most dramatic curry personality in the prototype, built for answers that keep choosing the strongest option.",
		facts: [
			"Commands attention the moment it appears.",
			"Prefers maximum flavor and confidence.",
			"Feels most at home in a high-energy setting."
		]
	}
];

const introScreen = document.getElementById("intro-screen");
const quizScreen = document.getElementById("quiz-screen");
const resultScreen = document.getElementById("result-screen");
const startButton = document.getElementById("start-button");
const previewButton = document.getElementById("skip-preview-button");
const backButton = document.getElementById("back-button");
const restartButton = document.getElementById("restart-button");
const nextButton = document.getElementById("next-button");
const playAgainButton = document.getElementById("play-again-button");
const editAnswersButton = document.getElementById("edit-answers-button");
const quizTitle = document.getElementById("quiz-title");
const progressLabel = document.getElementById("progress-label");
const progressFill = document.getElementById("progress-fill");
const questionViewport = document.getElementById("question-viewport");
const resultName = document.getElementById("result-name");
const resultBadge = document.getElementById("result-badge");
const resultDescription = document.getElementById("result-description");
const factList = document.getElementById("fact-list");
const scoreline = document.getElementById("scoreline");
const quizForm = document.getElementById("quiz-form");
const hintCopy = document.getElementById("hint-copy");

let currentQuestion = 0;
let totalScore = 0;
const selections = Array(quizData.length).fill(null);

function getResult(score) {
	return results.find((entry) => score >= entry.min && score <= entry.max) || results[results.length - 1];
}

function showScreen(screen) {
	introScreen.classList.toggle("hidden", screen !== "intro");
	quizScreen.classList.toggle("active", screen === "quiz");
	quizScreen.classList.toggle("hidden", screen !== "quiz");
	resultScreen.classList.toggle("active", screen === "result");
	resultScreen.classList.toggle("hidden", screen !== "result");
}

function renderQuestion() {
	const question = quizData[currentQuestion];
	quizTitle.textContent = "Answer the prompts";
	progressLabel.textContent = `Question ${currentQuestion + 1} of ${quizData.length}`;
	progressFill.style.width = `${(currentQuestion / quizData.length) * 100}%`;
	nextButton.textContent = currentQuestion === quizData.length - 1 ? "See result" : "Next question";
	backButton.disabled = currentQuestion === 0;
	backButton.style.opacity = currentQuestion === 0 ? 0.45 : 1;
	backButton.style.cursor = currentQuestion === 0 ? "not-allowed" : "pointer";
	hintCopy.textContent = "Pick the option that feels closest. Each answer nudges the final curry personality into a different bucket.";

	questionViewport.innerHTML = `
		<article class="question active" data-question-index="${currentQuestion}">
			<p class="question-kicker quiz-kicker">Prompt ${currentQuestion + 1}</p>
			<h3 class="question-text">${question.prompt}</h3>
			<div class="choice-grid" role="group" aria-label="${question.prompt}">
				${question.choices
					.map(
						(choice, index) => `
							<button
								type="button"
								class="choice"
								data-question="${currentQuestion}"
								data-choice-index="${index}"
								data-score="${choice.score}"
								aria-pressed="${selections[currentQuestion] === index ? "true" : "false"}"
							>
								<small>Option ${String.fromCharCode(65 + index)}</small>
								<span>${choice.label}</span>
								<span class="hint">${choice.detail}</span>
							</button>
						`
					)
					.join("")}
			</div>
		</article>
	`;

	questionViewport.querySelectorAll(".choice").forEach((choiceButton) => {
		choiceButton.addEventListener("click", () => {
			const choiceIndex = Number(choiceButton.dataset.choiceIndex);
			const score = Number(choiceButton.dataset.score);
			const previousSelection = selections[currentQuestion];

			selections[currentQuestion] = choiceIndex;
			if (previousSelection !== null) {
				const previousScore = quizData[currentQuestion].choices[previousSelection].score;
				totalScore -= previousScore;
			}
			totalScore += score;

			questionViewport.querySelectorAll(".choice").forEach((button) => {
				button.setAttribute("aria-pressed", button === choiceButton ? "true" : "false");
			});
		});
	});
}

function goToQuiz(startAtCurrent = 0) {
	currentQuestion = startAtCurrent;
	progressFill.style.width = `${(currentQuestion / quizData.length) * 100}%`;
	showScreen("quiz");
	renderQuestion();
}

function validateSelection() {
	return selections[currentQuestion] !== null;
}

function resetQuiz() {
	currentQuestion = 0;
	totalScore = 0;
	selections.fill(null);
	progressFill.style.width = "0%";
	factList.innerHTML = "";
	scoreline.textContent = "";
}

function renderResult() {
	const outcome = getResult(totalScore);
	resultName.textContent = outcome.name;
	resultBadge.textContent = outcome.badge;
	resultDescription.textContent = outcome.description;
	scoreline.textContent = `You scored ${totalScore} out of ${quizData.length * 2}.`;
	factList.innerHTML = outcome.facts.map((fact) => `<div class="fact">${fact}</div>`).join("");
	showScreen("result");
	progressFill.style.width = "100%";
}

function moveNext() {
	if (!validateSelection()) {
		hintCopy.textContent = "Choose one answer before moving on.";
		return;
	}

	if (currentQuestion < quizData.length - 1) {
		currentQuestion += 1;
		renderQuestion();
	} else {
		renderResult();
	}
}

function moveBack() {
	if (currentQuestion === 0) {
		return;
	}
	currentQuestion -= 1;
	renderQuestion();
}

function startOver() {
	resetQuiz();
	showScreen("intro");
}

startButton.addEventListener("click", () => {
	resetQuiz();
	goToQuiz(0);
});

previewButton.addEventListener("click", () => {
	resetQuiz();
	goToQuiz(0);
});

nextButton.addEventListener("click", moveNext);
backButton.addEventListener("click", moveBack);
restartButton.addEventListener("click", startOver);
playAgainButton.addEventListener("click", () => {
	resetQuiz();
	goToQuiz(0);
});
editAnswersButton.addEventListener("click", () => {
	showScreen("quiz");
	renderQuestion();
});

quizForm.addEventListener("submit", (event) => {
	event.preventDefault();
	moveNext();
});

showScreen("intro");
