const totalQuestions = 5;
let completedQuestions = 0;

const fillWrapper = document.getElementById('fillWrapper');
const testBtn = document.getElementById('test-btn');

function updateFillLevel(answeredCount, totalCount) {
    if (!fillWrapper) return;
    const percentage = Math.max(0, Math.min(100, (answeredCount / totalCount) * 100));
    fillWrapper.style.height = percentage + '%';
}

updateFillLevel(completedQuestions, totalQuestions);

if (testBtn && fillWrapper) {
    testBtn.addEventListener('click', () => {
        if (completedQuestions < totalQuestions) {
            completedQuestions++;
            updateFillLevel(completedQuestions, totalQuestions);
        }
    });
}