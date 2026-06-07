const totalQuestions = 5;
let completedQuestions = 0;

const fillWrapper = document.getElementById('fillWrapper');
const testBtn = document.getElementById('test-btn');

if (testBtn && fillWrapper) {
    testBtn.addEventListener('click', () => {
        if (completedQuestions < totalQuestions) {
            completedQuestions++;
            let percentage = (completedQuestions / totalQuestions) * 100;

            if (completedQuestions === totalQuestions) {
                fillWrapper.style.webkitMaskImage = 'none';
                fillWrapper.style.maskImage = 'none';
                percentage = 100;
            }

            fillWrapper.style.height = percentage + '%';
        }
    });
}