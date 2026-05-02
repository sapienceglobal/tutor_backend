const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const normalizePassingConfig = ({ passingPercentage, passingMarks }, totalMarks, defaults = {}) => {
  const marks = Math.max(0, toNumber(totalMarks) || 0);
  const defaultPercentage = clamp(toNumber(defaults.defaultPercentage) ?? 33, 0, 100);
  const defaultMarks = marks > 0 ? Number(((defaultPercentage / 100) * marks).toFixed(2)) : 0;

  const percentageInput = toNumber(passingPercentage);
  const marksInput = toNumber(passingMarks);

  if (percentageInput !== null && percentageInput > 0) {
    const safePercentage = clamp(percentageInput, 0, 100);
    return {
      passingPercentage: safePercentage,
      passingMarks: marks > 0 ? Number(((safePercentage / 100) * marks).toFixed(2)) : 0,
    };
  }

  if (marksInput !== null) {
    const safeMarks = Math.max(0, marksInput);
    return {
      passingMarks: safeMarks,
      passingPercentage: marks > 0 ? Number(((safeMarks / marks) * 100).toFixed(2)) : 0,
    };
  }

  return {
    passingPercentage: defaultPercentage,
    passingMarks: defaultMarks,
  };
};

export const evaluatePass = ({ score, totalMarks, passingPercentage, passingMarks }) => {
  const safeScore = Math.max(0, toNumber(score) || 0);
  const safeTotalMarks = Math.max(0, toNumber(totalMarks) || 0);
  const rawPercentage = safeTotalMarks > 0 ? (safeScore / safeTotalMarks) * 100 : 0;
  const displayPercentage = Math.round(rawPercentage);

  const normalized = normalizePassingConfig(
    { passingPercentage, passingMarks },
    safeTotalMarks,
    { defaultPercentage: 33 }
  );

  const passThreshold = normalized.passingPercentage;
  const isPassed = safeTotalMarks > 0
    ? rawPercentage >= passThreshold
    : safeScore >= normalized.passingMarks;

  return {
    isPassed,
    rawPercentage,
    displayPercentage,
    passingPercentage: normalized.passingPercentage,
    passingMarks: normalized.passingMarks,
  };
};

const getAnsweredState = (answer) => {
  if (!answer) return false;
  if (typeof answer.selectedOption === 'number' && answer.selectedOption >= 0) return true;
  if (typeof answer.selectedOptionText === 'string' && answer.selectedOptionText.trim()) return true;
  if (answer.numericAnswer !== undefined && answer.numericAnswer !== null && answer.numericAnswer !== '') return true;
  if (answer.textAnswer && String(answer.textAnswer).trim()) return true;
  if (answer.matchAnswers && typeof answer.matchAnswers === 'object' && Object.keys(answer.matchAnswers).length > 0) return true;
  return false;
};

const getSelectedAnswerText = (question, studentAnswer) => {
  if (!studentAnswer) return null;

  if (typeof studentAnswer.selectedOptionText === 'string' && studentAnswer.selectedOptionText.trim()) {
    return studentAnswer.selectedOptionText.trim();
  }

  if (studentAnswer.numericAnswer !== undefined && studentAnswer.numericAnswer !== null && studentAnswer.numericAnswer !== '') {
    return String(studentAnswer.numericAnswer);
  }

  if (studentAnswer.matchAnswers && typeof studentAnswer.matchAnswers === 'object' && Object.keys(studentAnswer.matchAnswers).length > 0) {
    return Object.entries(studentAnswer.matchAnswers)
      .map(([left, right]) => `${left} -> ${right}`)
      .join(', ');
  }

  if (studentAnswer.textAnswer && String(studentAnswer.textAnswer).trim()) {
    return String(studentAnswer.textAnswer).trim();
  }

  const selectedIndex = typeof studentAnswer.selectedOption === 'number' ? studentAnswer.selectedOption : -1;
  if (selectedIndex >= 0 && Array.isArray(question.options)) {
    return question.options[selectedIndex]?.text || null;
  }

  return null;
};

export const buildAttemptQuestionResults = ({ exam, attempt }) => {
  const answerMap = new Map(
    (attempt?.answers || []).map((answer) => [String(answer.questionId), answer])
  );

  // Respect tutor-configured visibility toggles
  const canViewCorrectAnswer = exam?.showCorrectAnswers !== false;
  const canViewSolution = exam?.hideSolutions !== true;

  return (exam?.questions || []).map((question, index) => {
    const studentAnswer = answerMap.get(String(question._id));
    const correctIndex = (question.options || []).findIndex(
      (option) => option.isCorrect === true || option.isCorrect === 'true'
    );
    const selectedIndex = typeof studentAnswer?.selectedOption === 'number'
      ? studentAnswer.selectedOption
      : -1;

    const isAnswered = getAnsweredState(studentAnswer);
    const isCorrect = studentAnswer?.isCorrect === true;
    const status = !isAnswered ? 'unanswered' : isCorrect ? 'correct' : 'incorrect';

    const selectedAnswerText = getSelectedAnswerText(question, studentAnswer);
    const correctAnswerText = canViewCorrectAnswer && correctIndex >= 0
      ? question.options?.[correctIndex]?.text || null
      : null;
    const solutionText = canViewSolution ? question.explanation || null : null;

    return {
      questionId: question._id,
      questionNumber: index + 1,
      question: question.question,
      questionType: question.questionType || 'mcq',
      options: (question.options || []).map((option) => ({ text: option.text })),
      selectedIndex,
      correctIndex,
      status,
      isCorrect,
      isAnswered,
      selectedAnswerText,
      correctAnswerText,
      canViewCorrectAnswer,
      canViewSolution,
      solutionText,
      aiFeedback: studentAnswer?.aiFeedback || null,
      explanation: solutionText,
      pointsEarned: studentAnswer?.pointsEarned ?? 0,
      pointsPossible: question.points || 1,
    };
  });
};
